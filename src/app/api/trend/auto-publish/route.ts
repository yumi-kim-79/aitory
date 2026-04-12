import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { generateLongtailContent } from '@/lib/longtail-title';
import { buildSummaryBox, buildFaqSection, buildArticleJsonLd, safeExcerpt, appendJsonLd, ensureAiImageNotice } from '@/lib/seo-aeo';
import { requestIndexing } from '@/lib/google-indexing';
import { appendPhotoSuffix } from '@/lib/dalle-photo-prompt';
import { postToTwitter } from '@/app/api/trend/post-to-twitter/route';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  const start = text.indexOf('{');
  if (start >= 0) return text.slice(start);
  return text.trim();
}

function tryParseJSON(text: string): Record<string, unknown> {
  const raw = extractJSON(text);
  try { return JSON.parse(raw); } catch {}
  let fixed = raw;
  const quotes = (fixed.match(/"/g) || []).length;
  if (quotes % 2 !== 0) fixed += '"';
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
  try { return JSON.parse(fixed); } catch {}
  throw new Error('JSON 파싱 실패');
}

// ────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────
interface SelectedKeyword {
  keyword: string;
  category: string;
  news: string;
}

interface PublishResult {
  keyword: string;
  category: string;
  success: boolean;
  wpUrl?: string;
  tweetUrl?: string;
  tweetError?: string;
  seoApplied?: boolean;
  indexed?: boolean;
  title?: string;
  error?: string;
}

// ────────────────────────────────────────────
// 타임아웃 래퍼 (개별 60초)
// ────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms / 1000}초)`)), ms)
    ),
  ]);
}

// ────────────────────────────────────────────
// RSS 뉴스 제목 수집
// ────────────────────────────────────────────
async function fetchRssTitles(query: string, count = 5): Promise<string[]> {
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, count);
    return items.map((m) => {
      const title = m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      return title.replace(/<[^>]+>/g, '').trim();
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────
// RSS 뉴스 본문 수집 (블로그 작성용)
// ────────────────────────────────────────────
async function fetchNews(keyword: string): Promise<string> {
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`,
      { signal: AbortSignal.timeout(10000) }
    );
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10);
    return items.map((m) => {
      const title = m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const desc = m[1].match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '';
      const pubDate = m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
      const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';
      return `${title.replace(/<[^>]+>/g, '')}${date ? ` (${date})` : ''}\n${desc.replace(/<[^>]+>/g, '').slice(0, 500)}`;
    }).join('\n\n');
  } catch {
    return `${keyword} 관련 최신 뉴스`;
  }
}

// ────────────────────────────────────────────
// 마크다운 → HTML 변환
// ────────────────────────────────────────────
function markdownToHtml(md: string): string {
  let html = md;
  // 헤딩
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  // 강조
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 리스트
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?:\n(?!<li>))/g, '<ul>$1</ul>\n');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  // 단락 (이미 HTML 태그가 아닌 줄을 <p>로 감싸기)
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^<(h[1-6]|ul|ol|li|p|strong|a|figure|img|div)/i.test(trimmed)) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.join('\n');
}

// ────────────────────────────────────────────
// 중복 체크 (Firestore 7일 이내)
// ────────────────────────────────────────────
let _dupCache: { keyword: string }[] | null = null;

async function loadDupCache(): Promise<void> {
  if (_dupCache) return;
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('publishedAt', '>=', sevenDaysAgo)
      .get();
    _dupCache = snap.docs.map((d) => ({ keyword: d.data().keyword as string })).filter((d) => d.keyword);
  } catch {
    _dupCache = [];
  }
}

function isDuplicateSync(keyword: string): boolean {
  if (!_dupCache) return false;
  for (const prev of _dupCache) {
    if (prev.keyword === keyword) return true;
    const overlap = [...keyword].filter((c) => prev.keyword.includes(c)).length;
    const ratio = overlap / Math.max(keyword.length, prev.keyword.length);
    if (ratio >= 0.7) return true;
  }
  return false;
}

// ────────────────────────────────────────────
// Claude로 키워드 선정 (RSS 기반)
// ────────────────────────────────────────────
async function selectKeywordsFromRss(
  query: string, category: string, count: number, batchKeywords: Set<string>
): Promise<SelectedKeyword[]> {
  const titles = await fetchRssTitles(query, 10);
  if (titles.length === 0) return [];

  try {
    const prompt = `아래 뉴스 제목 중에서 블로그 글을 쓰기 좋은 핵심 키워드를 ${count + 2}개 선정해줘.
카테고리: ${category}
뉴스 제목:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}
선정 기준: 구체적 인물/이벤트/작품명, 검색량 높은 키워드, 정치 제외, 서로 다른 주제
응답 형식(JSON 배열만): [${Array.from({ length: count + 2 }, (_, i) => `"키워드${i + 1}"`).join(', ')}]`;

    const res = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const keywords: string[] = JSON.parse(match[0]);
    const results: SelectedKeyword[] = [];

    for (const kw of keywords) {
      if (results.length >= count) break;
      if (batchKeywords.has(kw) || isDuplicateSync(kw)) continue;
      batchKeywords.add(kw);
      results.push({ keyword: kw, category, news: '' }); // news는 나중에 병렬 수집
    }
    return results;
  } catch (e) {
    console.error(`[selectKeywords] ${category} 에러:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// ────────────────────────────────────────────
// 일반 카테고리: 트렌드 우선 + RSS 보완
// ────────────────────────────────────────────
async function selectGeneralKeywords(
  trendKeywords: string[], batchKeywords: Set<string>
): Promise<SelectedKeyword[]> {
  const categories = [
    { name: '경제/비즈니스', rssQuery: '주식 OR 부동산 OR 경제 OR 환율', count: 2 },
    { name: '사회/생활', rssQuery: '생활 OR 건강 OR 날씨 OR 교육', count: 2 },
    { name: 'IT/과학', rssQuery: 'AI OR IT OR 기술 OR 과학 OR 스마트폰', count: 1 },
  ];

  // 트렌드 키워드 분류
  let classified: { keyword: string; category: string }[] = [];
  if (trendKeywords.length > 0) {
    try {
      const prompt = `다음 키워드들을 카테고리로 분류. 카테고리: 경제/비즈니스, 사회/생활, IT/과학, 기타
키워드: ${trendKeywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}
응답(JSON 배열만): [{"keyword":"키워드","category":"카테고리명"}]`;
      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) classified = JSON.parse(match[0]);
    } catch {}
  }

  const results: SelectedKeyword[] = [];

  for (const cat of categories) {
    let filled = 0;

    // 트렌드에서 해당 카테고리 찾기
    for (const c of classified) {
      if (filled >= cat.count) break;
      if (c.category !== cat.name) continue;
      if (batchKeywords.has(c.keyword) || isDuplicateSync(c.keyword)) continue;
      if (results.some((r) => r.keyword === c.keyword)) continue;
      batchKeywords.add(c.keyword);
      results.push({ keyword: c.keyword, category: cat.name, news: '' });
      filled++;
    }

    // RSS 보완
    if (filled < cat.count) {
      const rssResults = await selectKeywordsFromRss(cat.rssQuery, cat.name, cat.count - filled, batchKeywords);
      results.push(...rssResults);
    }
  }

  return results;
}

// ────────────────────────────────────────────
// WP 같은 카테고리 최근 글 조회
// ────────────────────────────────────────────
async function fetchRelatedPosts(category: string): Promise<{ title: string; url: string }[]> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return [];

  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  try {
    const catRes = await fetch(
      `${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(category)}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!catRes.ok) return [];
    const cats = await catRes.json();
    if (!cats.length) return [];

    const postsRes = await fetch(
      `${wpBase}/wp-json/wp/v2/posts?categories=${cats[0].id}&status=publish&per_page=3&orderby=date`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!postsRes.ok) return [];
    const posts = await postsRes.json();

    return posts.map((p: { title: { rendered: string }; link: string }) => ({
      title: p.title.rendered.replace(/<[^>]+>/g, ''),
      url: p.link,
    }));
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────
// Claude 블로그 글 생성
// ────────────────────────────────────────────
async function generateBlog(keyword: string, category: string, news: string) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const relatedPosts = await fetchRelatedPosts(category);
  const linkInstruction = relatedPosts.length > 0
    ? `\n본문 중 자연스러운 위치에 아래 관련 글 중 1~2개를 앵커 태그로 링크 삽입:
${relatedPosts.map((p) => `- <a href="${p.url}">${p.title}</a>`).join('\n')}`
    : '';

  const prompt = `키워드: ${keyword}
카테고리: ${category}
오늘: ${today}
뉴스:
${news}

SEO 블로그 글을 JSON으로 반환. 반드시 완전한 JSON만 반환, 중간에 절대 끊지 말 것. 다른 텍스트 없이 JSON만:
{"title":"제목 40~60자","slug":"seo-english-slug","content":"마크다운 본문","excerpt":"메타설명 140자이내","tags":["태그1","태그2","태그3","태그4","태그5"]}

slug: 핵심 키워드 영문, 50자 이내, 소문자, 하이픈
content 필수 요건 (마크다운 형식):
- 2000자 이상
- ## 소제목 4개 이상, 각 소제목 아래 2~3단락
- **굵게**, - 리스트 활용
- 구체적 수치/날짜/인용구 포함
- 오늘(${today}) 기준 최신 정보
excerpt는 반드시 140자 이내.${linkInstruction}

⚠️ JSON content 안의 줄바꿈은 \\n으로 이스케이프, 따옴표는 \\"로 이스케이프할 것.`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  console.log(`[generateBlog] ${keyword} 길이: ${text.length}, stop: ${res.stop_reason}`);

  let parsed;
  try { parsed = tryParseJSON(text); }
  catch { throw new Error('블로그 생성 JSON 파싱 실패'); }

  // 마크다운 → HTML 변환
  let content = markdownToHtml(parsed.content as string);
  if (relatedPosts.length > 0) {
    const relatedHtml = relatedPosts.map((p) => `<li><a href="${p.url}">${p.title}</a></li>`).join('\n');
    content += `\n<h3>관련 글</h3>\n<ul>\n${relatedHtml}\n</ul>`;
  }

  const metaDesc = (parsed.metaDesc as string || parsed.excerpt as string || '').slice(0, 150);
  let slug = (parsed.slug as string || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (slug.length > 50) slug = slug.slice(0, 50).replace(/-$/, '');
  if (!slug) slug = keyword.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 50).replace(/-+/g, '-').replace(/-$/, '');

  return { title: parsed.title as string, content, metaDesc, tags: (parsed.tags as string[]) || [], slug };
}

// ────────────────────────────────────────────
// 트윗용 DALL-E 이미지 생성 (1024x1024 standard)
// ────────────────────────────────────────────
async function generateTweetImage(keyword: string, category: string): Promise<Buffer | null> {
  try {
    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Create a photorealistic DALL-E 3 image prompt in English for a Twitter post about "${keyword}" (category: ${category}).
Requirements: square 1:1 composition, real photograph style (NOT illustration/cartoon), visualize the topic concretely.
Respond with ONLY the English prompt, no other text. Keep it under 150 chars.`,
      }],
    });
    const basePrompt = promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : keyword;
    const dallePrompt = appendPhotoSuffix(basePrompt, category);

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
      n: 1,
    });
    const url = imgRes.data?.[0]?.url;
    if (!url) return null;

    const fetched = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!fetched.ok) return null;
    return Buffer.from(await fetched.arrayBuffer());
  } catch (e) {
    console.error('[tweet-image] 생성 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ────────────────────────────────────────────
// X(트위터) 트윗 발행
// ────────────────────────────────────────────
async function postToX(params: {
  title: string; metaDesc: string; wpUrl: string; category: string; keyword: string;
}): Promise<{ tweetUrl: string }> {
  const { TwitterApi } = await import('twitter-api-v2');
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API 환경변수 부족');
  }

  const xClient = new TwitterApi({
    appKey: apiKey, appSecret: apiSecret,
    accessToken, accessSecret,
  });

  // 카테고리 해시태그
  const catTag = params.category.replace(/[\/\s]/g, '');

  // 트윗 텍스트 (280자 제한, URL은 23자 차지)
  const desc = params.metaDesc.length > 80 ? params.metaDesc.slice(0, 77) + '...' : params.metaDesc;
  let text = `📰 ${params.title}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  if (text.length > 280) {
    const overflow = text.length - 280;
    const newTitle = params.title.slice(0, params.title.length - overflow - 3) + '...';
    text = `📰 ${newTitle}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  }

  // 이미지 생성 + 업로드
  let mediaIds: [string] | undefined;
  try {
    const imgBuffer = await generateTweetImage(params.keyword, params.category);
    if (imgBuffer) {
      const mediaId = await xClient.v1.uploadMedia(imgBuffer, { mimeType: 'image/png' });
      mediaIds = [mediaId];
      console.log(`[tweet] 이미지 업로드 성공: ${mediaId}`);
    }
  } catch (e) {
    console.error('[tweet] 이미지 업로드 실패, 텍스트만 트윗:', e instanceof Error ? e.message : e);
  }

  // 트윗 발행
  const tweet = mediaIds
    ? await xClient.v2.tweet(text, { media: { media_ids: mediaIds } })
    : await xClient.v2.tweet(text);

  if (!tweet.data?.id) throw new Error('트윗 ID 없음');
  const tweetUrl = `https://x.com/i/web/status/${tweet.data.id}`;
  console.log(`[tweet] 발행 성공: ${tweetUrl}`);
  return { tweetUrl };
}

// ────────────────────────────────────────────
// 롱테일 키워드 생성 (Claude)
// ────────────────────────────────────────────
async function generateLongtailKeyword(mainKeyword: string, category: string): Promise<string | null> {
  try {
    const prompt = `메인 키워드 "${mainKeyword}" (카테고리: ${category})를 기반으로 SEO 롱테일 키워드 1개를 생성해줘.
요건:
- 메인 키워드와 다른 각도(전망, 분석, 비교, 5가지 이유 등)
- 검색량이 있을만한 구체적인 표현
- 15자 이내

응답: 키워드 한 개만, 다른 텍스트 없이.`;
    const res = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
    return text || null;
  } catch (e) {
    console.error('[longtail] 생성 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ────────────────────────────────────────────
// WP draft 저장
// ────────────────────────────────────────────
async function postDraftToWP(params: {
  title: string; content: string; metaDesc: string; tags: string[]; category: string; keyword: string; slug?: string;
}): Promise<{ postId: number; wpUrl: string }> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // 태그 병렬 처리
  const tagIds = (await Promise.all(
    params.tags.slice(0, 5).map(async (tag) => {
      try {
        const s = await fetch(`${wpBase}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}`, { headers, signal: AbortSignal.timeout(8000) });
        const existing = await s.json();
        if (existing.length > 0) return existing[0].id as number;
        const c = await fetch(`${wpBase}/wp-json/wp/v2/tags`, { method: 'POST', headers, body: JSON.stringify({ name: tag }), signal: AbortSignal.timeout(8000) });
        const created = await c.json();
        return created.id as number | undefined;
      } catch { return undefined; }
    })
  )).filter((id): id is number => !!id);

  // 카테고리
  let categoryId: number | undefined;
  try {
    const cs = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(params.category)}`, { headers, signal: AbortSignal.timeout(8000) });
    const cats = await cs.json();
    if (cats.length > 0) { categoryId = cats[0].id; }
    else {
      const cc = await fetch(`${wpBase}/wp-json/wp/v2/categories`, { method: 'POST', headers, body: JSON.stringify({ name: params.category }), signal: AbortSignal.timeout(8000) });
      const created = await cc.json();
      categoryId = created.id;
    }
  } catch {}

  const safeExcerpt = params.metaDesc.slice(0, 150);
  const postBody: Record<string, unknown> = {
    title: params.title, content: params.content, status: 'draft',
    excerpt: safeExcerpt, tags: tagIds,
    meta: { _surerank_description: safeExcerpt, _yoast_wpseo_metadesc: safeExcerpt },
  };
  if (params.slug) postBody.slug = params.slug;
  if (categoryId) postBody.categories = [categoryId];

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
  const post = await postRes.json();
  if (!post.id) throw new Error(post.message ?? 'WP draft 저장 실패');
  return { postId: post.id, wpUrl: post.link || `${wpBase}/?p=${post.id}` };
}

// ────────────────────────────────────────────
// Cron 핸들러 (1단계: draft 저장)
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // KST 기준 주말(토/일) 자동 스킵 (Cron 호출만, 수동 트리거는 우회)
  const isManual = req.headers.get('x-manual-trigger') === 'true';
  if (!isManual) {
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay(); // 0: 일, 6: 토
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? '일요일' : '토요일';
      console.log(`[auto-publish] 주말(${dayName}) 자동 스킵`);
      return NextResponse.json({
        success: false,
        message: '주말에는 자동 발행이 실행되지 않습니다.',
        day: dayName,
      }, { status: 200 });
    }
  } else {
    console.log('[auto-publish] 수동 트리거 - 주말 체크 우회');
  }

  const results: PublishResult[] = [];
  _dupCache = null; // 캐시 초기화

  try {
    const batchKeywords = new Set<string>();

    // 중복 캐시 로드 + 트렌드 수집 + K-콘텐츠 RSS 수집 병렬
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://aitory.vercel.app';

    console.log('[auto-publish] 키워드 수집 시작 (병렬)...');

    const [, trendResult, kEntertainment, kSports] = await Promise.all([
      loadDupCache(),
      // 트렌드 TOP 10 수집
      fetch(`${baseUrl}/api/trend/fetch`, { signal: AbortSignal.timeout(15000) })
        .then(async (r) => r.ok ? ((await r.json()).keywords || []).map((k: { title: string }) => k.title).slice(0, 10) as string[] : [])
        .catch(() => [] as string[]),
      // K-연예/한류 RSS (3개)
      selectKeywordsFromRss('K-드라마 OR K-팝 OR 아이돌 OR 한류 OR 미스트롯 OR 미스터트롯', 'K-연예/한류', 3, batchKeywords),
      // K-스포츠 RSS (2개)
      selectKeywordsFromRss('손흥민 OR 류현진 OR 한국축구 OR 한국야구 OR 김민재 OR KBO OR K리그', 'K-스포츠', 2, batchKeywords),
    ]);

    console.log(`[auto-publish] K-연예: ${kEntertainment.length}개, K-스포츠: ${kSports.length}개, 트렌드: ${trendResult.length}개`);

    // 일반 카테고리 수집 (트렌드 우선)
    const generalKeywords = await selectGeneralKeywords(trendResult, batchKeywords);
    console.log(`[auto-publish] 일반: ${generalKeywords.length}개`);

    // K-연예/한류 첫 키워드 기반 롱테일 1개 추가 (총 11개)
    const longtailKeywords: SelectedKeyword[] = [];
    if (kEntertainment.length > 0) {
      const main = kEntertainment[0];
      const longtail = await generateLongtailKeyword(main.keyword, main.category);
      if (longtail && !batchKeywords.has(longtail) && !isDuplicateSync(longtail)) {
        batchKeywords.add(longtail);
        longtailKeywords.push({ keyword: longtail, category: main.category, news: '' });
        console.log(`[auto-publish] 롱테일 추가: ${longtail}`);
      }
    }

    const allKeywords = [...kEntertainment, ...kSports, ...generalKeywords, ...longtailKeywords];
    console.log('[auto-publish] 전체 선정:', allKeywords.map((k) => `${k.category}: ${k.keyword}`));

    if (allKeywords.length === 0) {
      return NextResponse.json({ success: false, error: '키워드 수집 실패 (0개)', results });
    }

    // 뉴스 병렬 수집
    console.log('[auto-publish] 뉴스 수집 (병렬)...');
    const newsResults = await Promise.all(allKeywords.map((kw) => fetchNews(kw.keyword)));
    for (let i = 0; i < allKeywords.length; i++) {
      allKeywords[i].news = newsResults[i];
    }

    // V3 파이프라인 (병렬, 개별 90초 타임아웃)
    // 블로그 생성 → SEO/AEO 조립 → WP draft → Google 색인
    console.log('[auto-publish v3] 파이프라인 병렬 실행...');
    const settled = await Promise.allSettled(
      allKeywords.map(async (item) => {
        const { keyword, category, news } = item;

        return withTimeout(
          (async () => {
            // 1. 롱테일 제목 3안 + FAQ + 요약 생성
            const longtail = await generateLongtailContent(keyword, category, news);
            const bestTitle = longtail.titles[0] || keyword;

            // 2. 블로그 본문 생성 (기존 generateBlog 활용)
            const blog = await generateBlog(keyword, category, news);
            const finalTitle = bestTitle || blog.title;

            // 3. 콘텐츠 조립: 요약박스 + 본문 + FAQ + JSON-LD
            let content = blog.content;
            if (longtail.summary) {
              content = buildSummaryBox(longtail.summary) + '\n' + content;
            }
            const jsonLds: string[] = [];
            if (longtail.faqs.length > 0) {
              const { html: faqHtml, jsonLd: faqJsonLd } = buildFaqSection(longtail.faqs);
              content += '\n' + faqHtml;
              if (faqJsonLd) jsonLds.push(faqJsonLd);
            }
            // AI 이미지 안내 문구 (모든 글 하단 공통)
            content = ensureAiImageNotice(content);

            const finalMetaDesc = safeExcerpt(blog.metaDesc || longtail.summary);

            // 4. WP draft 저장
            const { postId, wpUrl } = await postDraftToWP({
              title: finalTitle, content, metaDesc: finalMetaDesc,
              tags: blog.tags, category, keyword, slug: blog.slug,
            });

            // 5. Article JSON-LD 추가하여 본문 업데이트
            const articleLd = buildArticleJsonLd({
              title: finalTitle, url: wpUrl, description: finalMetaDesc,
              datePublished: new Date().toISOString(),
            });
            jsonLds.push(articleLd);
            const contentWithLd = appendJsonLd(content, ...jsonLds);
            const wpBase = process.env.WP_SITE_URL;
            const wpUser = process.env.WP_USERNAME;
            const wpPass = process.env.WP_APP_PASSWORD;
            if (wpBase && wpUser && wpPass) {
              const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
              await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
                method: 'POST',
                headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: contentWithLd }),
              }).catch(() => {});
            }

            // 6. Firestore 기록 (deterministic doc ID = kbuzz_<postId>, Shorts 목록 호환)
            const publishedAt = new Date();
            await adminDb.collection('aitory_published_keywords').doc(`kbuzz_${postId}`).set({
              keyword, category, wpUrl, postId,
              title: finalTitle, slug: blog.slug, metaDesc: finalMetaDesc,
              imageStatus: 'pending', status: 'published', publishedAt,
              tweetUrl: null, tweetError: null,
              pipeline: 'v3-cron',
              longtailTitles: longtail.titles,
              faqCount: longtail.faqs.length,
              seoApplied: true,
              // Kbuzz/Shorts 호환 필드
              kbuzzUrl: wpUrl,
              kbuzzTitle: finalTitle,
              kbuzzPostId: postId,
              kbuzzPublishedAt: publishedAt,
              kbuzzStatus: 'published',
            }, { merge: true });

            // 7. Google Indexing API 색인 요청 (실패해도 진행)
            const indexResult = await requestIndexing(wpUrl);
            const indexed = indexResult.success;

            // 8. X(트위터) 자동 포스팅 (실패해도 진행)
            let tweetUrl: string | undefined;
            try {
              const tweetResult = await postToTwitter({
                title: finalTitle, kbuzzUrl: wpUrl,
                keyword, category, metaDesc: finalMetaDesc,
                firestoreDocId: `kbuzz_${postId}`,
              });
              if (tweetResult.success) tweetUrl = tweetResult.tweetUrl;
            } catch (tweetErr) {
              console.error(`[auto-publish] 트위터 실패 (계속 진행): ${keyword}`, tweetErr instanceof Error ? tweetErr.message : tweetErr);
            }

            return { keyword, category, postId, wpUrl, title: finalTitle, indexed, tweetUrl };
          })(),
          90000,
          keyword
        );
      })
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push({
          keyword: s.value.keyword, category: s.value.category, success: true,
          wpUrl: s.value.wpUrl, title: s.value.title,
          seoApplied: true, indexed: s.value.indexed,
          tweetUrl: s.value.tweetUrl,
        });
        console.log(`[auto-publish v3] 성공: ${s.value.keyword} → ${s.value.title} (indexed=${s.value.indexed}, tweet=${!!s.value.tweetUrl})`);
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        results.push({ keyword: '(에러)', category: '', success: false, error: msg });
        console.error(`[auto-publish] draft 실패:`, msg);
      }
    }

    return NextResponse.json({
      success: true,
      publishedAt: new Date().toISOString(),
      stage: 'draft',
      message: `Draft ${results.filter((r) => r.success).length}/${allKeywords.length}개 저장 완료.`,
      categoriesSelected: allKeywords.map((k) => `${k.category}: ${k.keyword}`),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-publish] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
