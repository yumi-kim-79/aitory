import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';

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
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    return items.map((m) => {
      const title = m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const desc = m[1].match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '';
      return `제목: ${title.replace(/<[^>]+>/g, '')}\n내용: ${desc.replace(/<[^>]+>/g, '').slice(0, 200)}`;
    }).join('\n\n');
  } catch {
    return `${keyword} 관련 최신 뉴스`;
  }
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

SEO 블로그 글을 JSON으로 반환. 다른 텍스트 없이 JSON만:
{"title":"제목 40~60자","slug":"seo-english-slug","content":"<h2>소제목1</h2><p>본문300자+</p><h2>소제목2</h2><p>본문300자+</p><h2>소제목3</h2><p>본문300자+</p>","excerpt":"메타설명 140자이내","tags":["태그1","태그2","태그3","태그4","태그5"]}
slug: 핵심 키워드만 영문 변환, 50자 이내, 소문자, 하이픈 구분
content는 1500자 이상 HTML(<h2><p><strong><ul><li>). 소제목 3개+, 각 300자+. 오늘(${today}) 기준 작성.
excerpt는 반드시 140자 이내로 작성.${linkInstruction}`;

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

  let content = parsed.content as string;
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

    const allKeywords = [...kEntertainment, ...kSports, ...generalKeywords];
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

    // 블로그 생성 + WP draft 저장 (병렬, 개별 60초 타임아웃)
    console.log('[auto-publish] 블로그 생성 + draft 저장 (병렬)...');
    const settled = await Promise.allSettled(
      allKeywords.map(async (item) => {
        const { keyword, category, news } = item;

        return withTimeout(
          (async () => {
            const blog = await generateBlog(keyword, category, news);
            const { postId, wpUrl } = await postDraftToWP({
              title: blog.title, content: blog.content, metaDesc: blog.metaDesc,
              tags: blog.tags, category, keyword, slug: blog.slug,
            });

            await adminDb.collection('aitory_published_keywords').add({
              keyword, category, wpUrl, postId,
              imageStatus: 'pending', status: 'draft', publishedAt: new Date(),
            });

            return { keyword, category, postId, wpUrl };
          })(),
          60000,
          keyword
        );
      })
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push({ keyword: s.value.keyword, category: s.value.category, success: true, wpUrl: s.value.wpUrl });
        console.log(`[auto-publish] draft 성공: ${s.value.keyword}`);
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
