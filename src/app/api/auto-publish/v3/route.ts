import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { generateLongtailContent } from '@/lib/longtail-title';
import { buildSummaryBox, buildFaqSection, buildArticleJsonLd, safeExcerpt, appendJsonLd } from '@/lib/seo-aeo';
import { requestIndexing } from '@/lib/google-indexing';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────
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
  const ob = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
  for (let i = 0; i < ob; i++) fixed += ']';
  const oc = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
  for (let i = 0; i < oc; i++) fixed += '}';
  try { return JSON.parse(fixed); } catch {}
  throw new Error('JSON 파싱 실패');
}

function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?:\n(?!<li>))/g, '<ul>$1</ul>\n');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^<(h[1-6]|ul|ol|li|p|strong|a|figure|img|div|script)/i.test(t)) result.push(t);
    else result.push(`<p>${t}</p>`);
  }
  return result.join('\n');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms / 1000}초)`)), ms)),
  ]);
}

interface SelectedKeyword { keyword: string; category: string; news: string; }
interface V3Result {
  keyword: string; category: string; success: boolean;
  title?: string; wpUrl?: string; indexed?: boolean; error?: string;
}

// ────────────────────────────────────────────
// RSS
// ────────────────────────────────────────────
async function fetchRssTitles(query: string, count = 10): Promise<string[]> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, count).map((m) => {
      return (m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
    }).filter(Boolean);
  } catch { return []; }
}

async function fetchNews(keyword: string): Promise<string> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`, { signal: AbortSignal.timeout(10000) });
    const xml = await res.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map((m) => {
      const title = m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const desc = m[1].match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '';
      const pubDate = m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
      const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';
      return `${title.replace(/<[^>]+>/g, '')}${date ? ` (${date})` : ''}\n${desc.replace(/<[^>]+>/g, '').slice(0, 500)}`;
    }).join('\n\n');
  } catch { return `${keyword} 관련 최신 뉴스`; }
}

// ────────────────────────────────────────────
// 중복 체크
// ────────────────────────────────────────────
let _dupCache: string[] | null = null;

async function loadDupCache(): Promise<void> {
  if (_dupCache) return;
  try {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const snap = await adminDb.collection('aitory_published_keywords').where('publishedAt', '>=', d).get();
    _dupCache = snap.docs.map((doc) => doc.data().keyword as string).filter(Boolean);
  } catch { _dupCache = []; }
}

function isDup(kw: string): boolean {
  if (!_dupCache) return false;
  for (const prev of _dupCache) {
    if (prev === kw) return true;
    const overlap = [...kw].filter((c) => prev.includes(c)).length;
    if (overlap / Math.max(kw.length, prev.length) >= 0.7) return true;
  }
  return false;
}

// ────────────────────────────────────────────
// Claude 키워드 선정
// ────────────────────────────────────────────
async function selectFromRss(query: string, category: string, count: number, batch: Set<string>): Promise<SelectedKeyword[]> {
  const titles = await fetchRssTitles(query);
  if (!titles.length) return [];
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 300,
      messages: [{ role: 'user', content: `뉴스 제목 중 블로그 키워드 ${count + 2}개 선정. 카테고리: ${category}\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n응답(JSON 배열만): ["키워드1","키워드2",...]` }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const kws: string[] = JSON.parse(match[0]);
    const results: SelectedKeyword[] = [];
    for (const kw of kws) {
      if (results.length >= count) break;
      if (batch.has(kw) || isDup(kw)) continue;
      batch.add(kw);
      results.push({ keyword: kw, category, news: '' });
    }
    return results;
  } catch { return []; }
}

// ────────────────────────────────────────────
// WP 관련 글 + draft 저장
// ────────────────────────────────────────────
async function fetchRelatedPosts(category: string): Promise<{ title: string; url: string }[]> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return [];
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  try {
    const catRes = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(category)}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!catRes.ok) return [];
    const cats = await catRes.json();
    if (!cats.length) return [];
    const postsRes = await fetch(`${wpBase}/wp-json/wp/v2/posts?categories=${cats[0].id}&status=publish&per_page=3&orderby=date`, { headers, signal: AbortSignal.timeout(8000) });
    if (!postsRes.ok) return [];
    const posts = await postsRes.json();
    return posts.map((p: { title: { rendered: string }; link: string }) => ({
      title: p.title.rendered.replace(/<[^>]+>/g, ''), url: p.link,
    }));
  } catch { return []; }
}

async function postDraftToWP(params: {
  title: string; content: string; metaDesc: string; tags: string[]; category: string; slug?: string;
}): Promise<{ postId: number; wpUrl: string }> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  const tagIds = (await Promise.all(
    params.tags.slice(0, 5).map(async (tag) => {
      try {
        const s = await fetch(`${wpBase}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}`, { headers, signal: AbortSignal.timeout(8000) });
        const existing = await s.json();
        if (existing.length > 0) return existing[0].id as number;
        const c = await fetch(`${wpBase}/wp-json/wp/v2/tags`, { method: 'POST', headers, body: JSON.stringify({ name: tag }), signal: AbortSignal.timeout(8000) });
        return (await c.json()).id as number | undefined;
      } catch { return undefined; }
    })
  )).filter((id): id is number => !!id);

  let categoryId: number | undefined;
  try {
    const cs = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(params.category)}`, { headers, signal: AbortSignal.timeout(8000) });
    const cats = await cs.json();
    if (cats.length > 0) categoryId = cats[0].id;
    else {
      const cc = await fetch(`${wpBase}/wp-json/wp/v2/categories`, { method: 'POST', headers, body: JSON.stringify({ name: params.category }), signal: AbortSignal.timeout(8000) });
      categoryId = (await cc.json()).id;
    }
  } catch {}

  const safe = safeExcerpt(params.metaDesc);
  const postBody: Record<string, unknown> = {
    title: params.title, content: params.content, status: 'draft',
    excerpt: safe, tags: tagIds,
    meta: { _surerank_description: safe, _yoast_wpseo_metadesc: safe },
  };
  if (params.slug) postBody.slug = params.slug;
  if (categoryId) postBody.categories = [categoryId];

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
  const post = await postRes.json();
  if (!post.id) throw new Error(post.message ?? 'WP draft 저장 실패');
  return { postId: post.id, wpUrl: post.link || `${wpBase}/?p=${post.id}` };
}

// ────────────────────────────────────────────
// V3 파이프라인: 제목최적화 → 본문생성 → WP발행 → Google색인
// ────────────────────────────────────────────
async function processKeyword(item: SelectedKeyword): Promise<V3Result> {
  const { keyword, category, news } = item;
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. 롱테일 제목 3안 + FAQ + 요약 생성
  const longtail = await generateLongtailContent(keyword, category, news);
  const bestTitle = longtail.titles[0] || keyword;

  // 2. 관련 글 조회
  const relatedPosts = await fetchRelatedPosts(category);
  const linkInstruction = relatedPosts.length > 0
    ? `\n본문 중 자연스러운 위치에 아래 관련 글 중 1~2개를 [텍스트](URL) 형식 마크다운 링크 삽입:
${relatedPosts.map((p) => `- [${p.title}](${p.url})`).join('\n')}`
    : '';

  // 3. 블로그 본문 생성
  const prompt = `키워드: ${keyword}
카테고리: ${category}
오늘: ${today}
뉴스:
${news}

SEO 블로그 글을 JSON으로 반환. 반드시 완전한 JSON만 반환:
{"title":"${bestTitle}","slug":"seo-english-slug","content":"마크다운 본문","excerpt":"메타설명 140자이내","tags":["태그1","태그2","태그3","태그4","태그5"]}

slug: 핵심 키워드 영문, 50자 이내, 소문자, 하이픈
content 요건 (마크다운):
- 2000자 이상, ## 소제목 4개+, 각 2~3단락
- **굵게**, - 리스트 활용, 구체적 수치/날짜/인용구
- 오늘(${today}) 기준 최신 정보
excerpt는 반드시 140자 이내.${linkInstruction}
⚠️ JSON content 안의 줄바꿈은 \\n, 따옴표는 \\"로 이스케이프.`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  const parsed = tryParseJSON(text);

  // 4. 콘텐츠 조립: 본문 + 요약박스 + FAQ + 관련글 + JSON-LD
  let content = markdownToHtml(parsed.content as string);

  // 상단 요약 박스
  if (longtail.summary) {
    content = buildSummaryBox(longtail.summary) + '\n' + content;
  }

  // 관련 글 섹션
  if (relatedPosts.length > 0) {
    const relatedHtml = relatedPosts.map((p) => `<li><a href="${p.url}">${p.title}</a></li>`).join('\n');
    content += `\n<h3>관련 글</h3>\n<ul>\n${relatedHtml}\n</ul>`;
  }

  // FAQ 섹션
  if (longtail.faqs.length > 0) {
    const { html: faqHtml, jsonLd: faqJsonLd } = buildFaqSection(longtail.faqs);
    content += '\n' + faqHtml;
    content = appendJsonLd(content, faqJsonLd);
  }

  const metaDesc = safeExcerpt(parsed.metaDesc as string || parsed.excerpt as string || '');
  let slug = (parsed.slug as string || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (slug.length > 50) slug = slug.slice(0, 50).replace(/-$/, '');
  if (!slug) slug = keyword.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 50).replace(/-+/g, '-').replace(/-$/, '');

  const title = parsed.title as string || bestTitle;

  // 5. WP draft 저장
  const { postId, wpUrl } = await postDraftToWP({
    title, content, metaDesc,
    tags: (parsed.tags as string[]) || [],
    category, slug,
  });

  // 6. Article JSON-LD (WP 포스트 업데이트)
  const articleLd = buildArticleJsonLd({ title, url: wpUrl, description: metaDesc, datePublished: new Date().toISOString() });
  // append JSON-LD to the post content
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (wpBase && wpUser && wpPass) {
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const contentWithLd = appendJsonLd(content, articleLd);
    await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contentWithLd }),
    }).catch(() => {});
  }

  // 7. Firestore 저장
  await adminDb.collection('aitory_published_keywords').add({
    keyword, category, wpUrl, postId,
    title, slug, metaDesc,
    imageStatus: 'pending', status: 'draft',
    publishedAt: new Date(),
    tweetUrl: null, tweetError: null,
    pipeline: 'v3',
    longtailTitles: longtail.titles,
    faqCount: longtail.faqs.length,
  });

  // 8. Google Indexing
  let indexed = false;
  const indexResult = await requestIndexing(wpUrl);
  indexed = indexResult.success;

  console.log(`[v3] 완료: ${keyword} → ${title} (indexed=${indexed})`);
  return { keyword, category, success: true, title, wpUrl, indexed };
}

// ────────────────────────────────────────────
// V3 파이프라인 실행 (공통)
// ────────────────────────────────────────────
async function runV3Pipeline(): Promise<NextResponse> {
  const results: V3Result[] = [];
  _dupCache = null;

  try {
    const batch = new Set<string>();

    console.log('[v3] 키워드 수집 시작...');
    const [,, kEntertainment, kSports] = await Promise.all([
      loadDupCache(),
      Promise.resolve(),
      selectFromRss('K-드라마 OR K-팝 OR 아이돌 OR 한류 OR 미스트롯', 'K-연예/한류', 3, batch),
      selectFromRss('손흥민 OR 류현진 OR 한국축구 OR 한국야구 OR KBO', 'K-스포츠', 2, batch),
    ]);

    const general: SelectedKeyword[] = [];
    for (const cat of [
      { name: '경제/비즈니스', q: '주식 OR 부동산 OR 경제 OR 환율', n: 2 },
      { name: '사회/생활', q: '생활 OR 건강 OR 날씨 OR 교육', n: 2 },
      { name: 'IT/과학', q: 'AI OR IT OR 기술 OR 과학', n: 1 },
    ]) {
      const r = await selectFromRss(cat.q, cat.name, cat.n, batch);
      general.push(...r);
    }

    const allKeywords = [...kEntertainment, ...kSports, ...general];
    console.log(`[v3] ${allKeywords.length}개 선정:`, allKeywords.map((k) => `${k.category}: ${k.keyword}`));

    if (allKeywords.length === 0) {
      return NextResponse.json({ success: false, error: '키워드 0개', results });
    }

    const newsResults = await Promise.all(allKeywords.map((k) => fetchNews(k.keyword)));
    allKeywords.forEach((k, i) => { k.news = newsResults[i]; });

    console.log('[v3] 파이프라인 병렬 실행...');
    const settled = await Promise.allSettled(
      allKeywords.map((item) => withTimeout(processKeyword(item), 90000, item.keyword))
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        results.push({ keyword: '(에러)', category: '', success: false, error: msg });
        console.error('[v3] 실패:', msg);
      }
    }

    return NextResponse.json({
      success: true,
      pipeline: 'v3',
      publishedAt: new Date().toISOString(),
      total: allKeywords.length,
      succeeded: results.filter((r) => r.success).length,
      indexed: results.filter((r) => r.indexed).length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[v3] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// GET: Cron (CRON_SECRET)
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runV3Pipeline();
}

// ────────────────────────────────────────────
// POST: 관리자 수동 실행 (Firebase admin token)
// ────────────────────────────────────────────
export async function POST(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  return runV3Pipeline();
}
