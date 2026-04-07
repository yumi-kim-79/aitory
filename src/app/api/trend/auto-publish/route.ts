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
  return text.trim();
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
async function isDuplicate(keyword: string): Promise<boolean> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('publishedAt', '>=', sevenDaysAgo)
      .get();
    for (const doc of snap.docs) {
      const prev = doc.data().keyword as string;
      if (!prev) continue;
      if (prev === keyword) return true;
      const overlap = [...keyword].filter((c) => prev.includes(c)).length;
      const ratio = overlap / Math.max(keyword.length, prev.length);
      if (ratio >= 0.7) {
        console.log(`[중복] "${keyword}" ≈ "${prev}" (${(ratio * 100).toFixed(0)}%)`);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('[isDuplicate] 에러:', e instanceof Error ? e.message : e);
    return false;
  }
}

// ────────────────────────────────────────────
// K-콘텐츠 키워드 수집
// ────────────────────────────────────────────
async function fetchKContentKeywords(): Promise<SelectedKeyword[]> {
  const kQueries = [
    { query: 'K-드라마 OR K-팝 OR 아이돌 OR 한류 OR 미스트롯 OR 미스터트롯', category: 'K-연예/한류', count: 2 },
    { query: '손흥민 OR 류현진 OR 한국축구 OR 한국야구 OR 김민재 OR KBO OR K리그', category: 'K-스포츠', count: 1 },
  ];

  const results: SelectedKeyword[] = [];

  for (const { query, category, count } of kQueries) {
    console.log(`[K-콘텐츠] ${category} RSS 수집 중...`);
    const titles = await fetchRssTitles(query, 10);
    if (titles.length === 0) continue;

    try {
      const prompt = `아래 뉴스 제목 중에서 블로그 글을 쓰기 좋은 핵심 키워드를 ${count}개 선정해줘.
카테고리: ${category}
뉴스 제목:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}
선정 기준: 구체적 인물/이벤트/작품명, 검색량 높은 키워드, 정치 제외
응답 형식(JSON 배열만): ["키워드1"${count > 1 ? ', "키워드2"' : ''}]`;

      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const keywords: string[] = JSON.parse(match[0]);
        for (const kw of keywords.slice(0, count)) {
          if (await isDuplicate(kw)) { console.log(`[K-콘텐츠] 중복 스킵: ${kw}`); continue; }
          const news = await fetchNews(kw);
          results.push({ keyword: kw, category, news });
        }
      }
    } catch (e) {
      console.error(`[K-콘텐츠] ${category} 에러:`, e instanceof Error ? e.message : e);
    }
  }
  return results;
}

// ────────────────────────────────────────────
// 일반 카테고리 키워드 수집 (트렌드 우선 + RSS 보완)
// ────────────────────────────────────────────
async function fetchGeneralKeywords(): Promise<SelectedKeyword[]> {
  const categories = [
    { name: '경제/비즈니스', rssQuery: '주식 OR 부동산 OR 경제 OR 환율' },
    { name: '사회/생활', rssQuery: '생활 OR 건강 OR 날씨 OR 교육' },
    { name: 'IT/과학', rssQuery: 'AI OR IT OR 기술 OR 과학 OR 스마트폰' },
  ];

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://aitory.vercel.app';

  let trendKeywords: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/trend/fetch`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json();
      trendKeywords = (data.keywords || []).map((k: { title: string }) => k.title).slice(0, 10);
    }
  } catch {}

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
    const fromTrend = classified.find(
      (c) => c.category === cat.name && !results.some((r) => r.keyword === c.keyword)
    );
    if (fromTrend && !(await isDuplicate(fromTrend.keyword))) {
      const news = await fetchNews(fromTrend.keyword);
      results.push({ keyword: fromTrend.keyword, category: cat.name, news });
      continue;
    }

    const titles = await fetchRssTitles(cat.rssQuery, 7);
    if (titles.length === 0) continue;
    try {
      const prompt = `뉴스 제목 중 블로그 키워드 1개 선정. 카테고리: ${cat.name}
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}
응답(JSON 배열만): ["키워드"]`;
      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const kw = JSON.parse(match[0])[0];
        if (kw && !(await isDuplicate(kw))) {
          const news = await fetchNews(kw);
          results.push({ keyword: kw, category: cat.name, news });
        }
      }
    } catch {}
  }
  return results;
}

// ────────────────────────────────────────────
// Claude 블로그 글 생성 (max_tokens 축소)
// ────────────────────────────────────────────
async function generateBlog(keyword: string, category: string, news: string) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const prompt = `키워드: ${keyword}
카테고리: ${category}
오늘: ${today}
뉴스:
${news}

SEO 블로그 글 작성. JSON만 반환:
{"title":"SEO 제목 40~60자","slug":"영문-슬러그","content":"HTML 본문 1500자+","excerpt":"메타설명 150자이내","category":"${category}","tags":["한국어태그x5"]}
content: <h2> 3개+, 각200자+, <p><strong>, 전망/결론. 오늘(${today}) 기준 최신 정보.`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  let parsed;
  try { parsed = JSON.parse(extractJSON(text)); }
  catch { throw new Error('블로그 생성 JSON 파싱 실패'); }

  const metaDesc = (parsed.metaDesc || parsed.excerpt || '').slice(0, 150);
  return { title: parsed.title, content: parsed.content, metaDesc, tags: parsed.tags || [], slug: parsed.slug };
}

// ────────────────────────────────────────────
// WP draft 저장 (이미지 없이)
// ────────────────────────────────────────────
async function postDraftToWP(params: {
  title: string; content: string; metaDesc: string; tags: string[]; category: string; keyword: string;
}): Promise<{ postId: number; wpUrl: string }> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // 태그
  const tagIds: number[] = [];
  for (const tag of params.tags.slice(0, 5)) {
    try {
      const s = await fetch(`${wpBase}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}`, { headers });
      const existing = await s.json();
      if (existing.length > 0) { tagIds.push(existing[0].id); }
      else {
        const c = await fetch(`${wpBase}/wp-json/wp/v2/tags`, { method: 'POST', headers, body: JSON.stringify({ name: tag }) });
        const created = await c.json();
        if (created.id) tagIds.push(created.id);
      }
    } catch {}
  }

  // 카테고리
  let categoryId: number | undefined;
  try {
    const cs = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(params.category)}`, { headers });
    const cats = await cs.json();
    if (cats.length > 0) { categoryId = cats[0].id; }
    else {
      const cc = await fetch(`${wpBase}/wp-json/wp/v2/categories`, { method: 'POST', headers, body: JSON.stringify({ name: params.category }) });
      const created = await cc.json();
      categoryId = created.id;
    }
  } catch {}

  const postBody: Record<string, unknown> = {
    title: params.title,
    content: params.content,
    status: 'draft',
    excerpt: params.metaDesc.slice(0, 150),
    tags: tagIds,
    meta: { _surerank_description: params.metaDesc.slice(0, 150) },
  };
  if (categoryId) postBody.categories = [categoryId];

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
  const post = await postRes.json();
  if (!post.id) throw new Error(post.message ?? 'WP draft 저장 실패');
  return { postId: post.id, wpUrl: post.link || `${wpBase}/?p=${post.id}` };
}

// ────────────────────────────────────────────
// Cron 핸들러 (1단계: draft 저장만)
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: PublishResult[] = [];

  try {
    console.log('[auto-publish] 1단계: K-콘텐츠 수집...');
    const kKeywords = await fetchKContentKeywords();

    console.log('[auto-publish] 1단계: 일반 카테고리 수집...');
    const generalKeywords = await fetchGeneralKeywords();

    const allKeywords = [...kKeywords, ...generalKeywords];
    console.log('[auto-publish] 전체 선정:', allKeywords.map((k) => `${k.category}: ${k.keyword}`));

    if (allKeywords.length === 0) {
      return NextResponse.json({ success: false, error: '키워드 수집 실패 (0개)', results });
    }

    // 병렬 처리: 블로그 생성 + WP draft 저장
    const settled = await Promise.allSettled(
      allKeywords.map(async (item) => {
        const { keyword, category, news } = item;
        console.log(`[auto-publish] 처리 중: ${keyword} (${category})`);

        const blog = await generateBlog(keyword, category, news);
        const { postId, wpUrl } = await postDraftToWP({
          title: blog.title, content: blog.content, metaDesc: blog.metaDesc,
          tags: blog.tags, category, keyword,
        });

        // Firestore에 pending 상태로 저장
        await adminDb.collection('aitory_published_keywords').add({
          keyword, category, wpUrl, postId,
          imageStatus: 'pending',
          status: 'draft',
          publishedAt: new Date(),
        });

        return { keyword, category, postId, wpUrl };
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
      message: 'Draft 저장 완료. 5분 후 이미지 생성 및 publish 예정.',
      categoriesSelected: allKeywords.map((k) => `${k.category}: ${k.keyword}`),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-publish] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
