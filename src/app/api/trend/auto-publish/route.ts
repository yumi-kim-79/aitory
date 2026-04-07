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
// RSS 뉴스 제목 수집 헬퍼
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
    const query = encodeURIComponent(keyword);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`,
      { signal: AbortSignal.timeout(10000) }
    );
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    const newsTexts = items.map((m) => {
      const title = m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const desc = m[1].match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '';
      return `제목: ${title.replace(/<[^>]+>/g, '')}\n내용: ${desc.replace(/<[^>]+>/g, '').slice(0, 200)}`;
    });
    return newsTexts.join('\n\n');
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
      // 동일 키워드
      if (prev === keyword) return true;
      // 70% 이상 글자 겹침
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
    return false; // 에러 시 발행 허용
  }
}

// ────────────────────────────────────────────
// 발행 이력 저장
// ────────────────────────────────────────────
async function savePublished(keyword: string, category: string, wpUrl: string) {
  try {
    await adminDb.collection('aitory_published_keywords').add({
      keyword,
      category,
      wpUrl,
      publishedAt: new Date(),
    });
  } catch (e) {
    console.error('[savePublished] 에러:', e instanceof Error ? e.message : e);
  }
}

// ────────────────────────────────────────────
// K-콘텐츠 키워드 수집 (RSS 최신순 → Claude 대표 키워드 선정)
// ────────────────────────────────────────────
async function fetchKContentKeywords(): Promise<SelectedKeyword[]> {
  const kQueries: { query: string; category: string; count: number }[] = [
    { query: 'K-드라마 OR K-팝 OR 아이돌 OR 한류 OR 미스트롯 OR 미스터트롯', category: 'K-연예/한류', count: 2 },
    { query: '손흥민 OR 류현진 OR 한국축구 OR 한국야구 OR 김민재 OR KBO OR K리그', category: 'K-스포츠', count: 1 },
  ];

  const results: SelectedKeyword[] = [];

  for (const { query, category, count } of kQueries) {
    console.log(`[K-콘텐츠] ${category} RSS 수집 중...`);
    const titles = await fetchRssTitles(query, 10);
    console.log(`[K-콘텐츠] ${category} 뉴스 ${titles.length}개:`, titles.slice(0, 5));

    if (titles.length === 0) continue;

    // Claude로 대표 키워드 선정
    const prompt = `아래 뉴스 제목 중에서 블로그 글을 쓰기 좋은 핵심 키워드를 ${count}개 선정해줘.
카테고리: ${category}

뉴스 제목:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

선정 기준:
- 구체적인 인물/이벤트/작품명 포함
- 검색량이 높을 것 같은 키워드
- 정치/선거 관련 제외

응답 형식(JSON 배열만):
["키워드1"${count > 1 ? ', "키워드2"' : ''}]`;

    try {
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
          // 중복 체크
          if (await isDuplicate(kw)) {
            console.log(`[K-콘텐츠] 중복 스킵: ${kw}`);
            continue;
          }
          const news = await fetchNews(kw);
          results.push({ keyword: kw, category, news });
        }
      }
    } catch (e) {
      console.error(`[K-콘텐츠] ${category} Claude 에러:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[K-콘텐츠] 최종 ${results.length}개 선정`);
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

  // 1. 트렌드 TOP 10 수집
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
  console.log(`[일반] 트렌드 키워드 ${trendKeywords.length}개:`, trendKeywords);

  // 2. 트렌드 키워드를 카테고리 분류
  let classified: { keyword: string; category: string }[] = [];
  if (trendKeywords.length > 0) {
    try {
      const prompt = `다음 키워드들을 각각 아래 카테고리 중 하나로 분류해줘.
카테고리: 경제/비즈니스, 사회/생활, IT/과학, 기타

키워드 목록:
${trendKeywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

응답 형식(JSON 배열만):
[{"keyword": "키워드", "category": "카테고리명"}]`;

      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) classified = JSON.parse(match[0]);
    } catch {}
  }

  const results: SelectedKeyword[] = [];

  for (const cat of categories) {
    // 트렌드에서 해당 카테고리 찾기
    const fromTrend = classified.find(
      (c) => c.category === cat.name && !results.some((r) => r.keyword === c.keyword)
    );

    if (fromTrend) {
      if (await isDuplicate(fromTrend.keyword)) {
        console.log(`[일반] 트렌드 중복 스킵: ${fromTrend.keyword}`);
      } else {
        const news = await fetchNews(fromTrend.keyword);
        results.push({ keyword: fromTrend.keyword, category: cat.name, news });
        console.log(`[일반] 트렌드에서 선정: ${fromTrend.keyword} (${cat.name})`);
        continue;
      }
    }

    // RSS 보완
    console.log(`[일반] ${cat.name} RSS 보완 수집 중...`);
    const titles = await fetchRssTitles(cat.rssQuery, 7);
    if (titles.length === 0) continue;

    try {
      const prompt = `아래 뉴스 제목 중에서 블로그 글을 쓰기 좋은 핵심 키워드를 1개 선정해줘.
카테고리: ${cat.name}

뉴스 제목:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

응답 형식(JSON 배열만):
["키워드"]`;

      const res = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const kw = JSON.parse(match[0])[0];
        if (kw && !(await isDuplicate(kw))) {
          const news = await fetchNews(kw);
          results.push({ keyword: kw, category: cat.name, news });
          console.log(`[일반] RSS에서 선정: ${kw} (${cat.name})`);
        }
      }
    } catch {}
  }

  console.log(`[일반] 최종 ${results.length}개 선정`);
  return results;
}

// ────────────────────────────────────────────
// Claude 블로그 글 생성
// ────────────────────────────────────────────
async function generateBlog(
  keyword: string,
  category: string,
  news: string
): Promise<{ title: string; content: string; metaDesc: string; tags: string[]; slug?: string }> {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `키워드: ${keyword}
카테고리: ${category}
오늘: ${today}
뉴스:
${news}

SEO 블로그 글 작성. JSON만 반환:
{"title":"SEO 제목 40~60자","slug":"영문-슬러그","content":"HTML 본문 1500자+","excerpt":"메타설명 150자이내","category":"${category}","tags":["한국어태그x5"]}

content: <h2> 4개+, 각300자+, <p><strong><ul><li>, 전망/결론
오늘(${today}) 기준 최신 정보로 작성.`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  console.log('[generateBlog] 응답 앞 300자:', text.slice(0, 300));

  let parsed;
  try {
    parsed = JSON.parse(extractJSON(text));
  } catch {
    console.error('[generateBlog] JSON 파싱 실패, 원문:', text.slice(0, 500));
    throw new Error('블로그 생성 JSON 파싱 실패');
  }

  const metaDesc = (parsed.metaDesc || parsed.excerpt || '').slice(0, 150);
  return {
    title: parsed.title,
    content: parsed.content,
    metaDesc,
    tags: parsed.tags || [],
    slug: parsed.slug,
  };
}

// ────────────────────────────────────────────
// DALL-E 3 이미지 생성
// ────────────────────────────────────────────
async function generateImage(keyword: string, category: string): Promise<string | null> {
  try {
    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Create a DALL-E 3 image prompt in English for a blog about "${keyword}" (category: ${category}).
Requirements: no human faces, professional blog thumbnail style, clean and modern, relevant to the topic.
Respond with only the English prompt, no other text.`,
        },
      ],
    });
    const dallePrompt =
      promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : keyword;

    console.log(`[generateImage] DALL-E 프롬프트: ${dallePrompt.slice(0, 100)}`);

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1792x1024',
      quality: 'standard',
      style: 'natural',
      n: 1,
    });
    const url = imgRes.data?.[0]?.url ?? null;
    console.log(`[generateImage] 결과: ${url ? '성공' : '실패 (null)'}`);
    return url;
  } catch (e) {
    console.error('[generateImage] DALL-E 생성 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ────────────────────────────────────────────
// WP 포스팅 (이미지 포함)
// ────────────────────────────────────────────
async function postToWordPress(params: {
  title: string;
  content: string;
  metaDesc: string;
  tags: string[];
  category: string;
  imageUrl: string | null;
  keyword: string;
}): Promise<string> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // 태그 ID 수집/생성
  const tagIds: number[] = [];
  for (const tag of params.tags.slice(0, 5)) {
    try {
      const s = await fetch(`${wpBase}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}`, { headers });
      const existing = await s.json();
      if (existing.length > 0) {
        tagIds.push(existing[0].id);
      } else {
        const c = await fetch(`${wpBase}/wp-json/wp/v2/tags`, {
          method: 'POST', headers,
          body: JSON.stringify({ name: tag }),
        });
        const created = await c.json();
        if (created.id) tagIds.push(created.id);
      }
    } catch {}
  }

  // 카테고리 ID 수집/생성
  let categoryId: number | undefined;
  try {
    const cs = await fetch(
      `${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(params.category)}`,
      { headers }
    );
    const cats = await cs.json();
    if (cats.length > 0) {
      categoryId = cats[0].id;
    } else {
      const cc = await fetch(`${wpBase}/wp-json/wp/v2/categories`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: params.category }),
      });
      const created = await cc.json();
      categoryId = created.id;
    }
  } catch {}

  // 이미지 WP 미디어 업로드
  let featuredMediaId: number | undefined;
  if (params.imageUrl) {
    try {
      const imgFetch = await fetch(params.imageUrl, { signal: AbortSignal.timeout(30000) });
      const imgBuffer = await imgFetch.arrayBuffer();
      const mediaRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(params.keyword)}-thumbnail.png"`,
        },
        body: imgBuffer,
        signal: AbortSignal.timeout(30000),
      });
      const media = await mediaRes.json();
      if (media.id) {
        featuredMediaId = media.id;
        await fetch(`${wpBase}/wp-json/wp/v2/media/${media.id}`, {
          method: 'POST', headers,
          body: JSON.stringify({ alt_text: params.keyword }),
        });
        console.log(`[postToWP] 이미지 업로드 성공: mediaId=${media.id}`);
      }
    } catch (e) {
      console.error('[postToWP] WP 미디어 업로드 실패:', e instanceof Error ? e.message : e);
    }
  }

  // AI 이미지 안내 문구
  let finalContent = params.content;
  if (featuredMediaId) {
    finalContent += '\n<p style="color:#888;font-size:0.85em;border-top:1px solid #eee;margin-top:30px;padding-top:15px;text-align:center;">※ 본문의 이미지는 기사의 내용을 바탕으로 AI로 재구성하였습니다.</p>';
  }

  // 포스트 발행
  const postBody: Record<string, unknown> = {
    title: params.title,
    content: finalContent,
    status: 'publish',
    excerpt: params.metaDesc.slice(0, 150),
    tags: tagIds,
    meta: { _surerank_description: params.metaDesc.slice(0, 150) },
  };
  if (categoryId) postBody.categories = [categoryId];
  if (featuredMediaId) postBody.featured_media = featuredMediaId;

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, {
    method: 'POST', headers,
    body: JSON.stringify(postBody),
  });
  const post = await postRes.json();
  if (!post.link) throw new Error(post.message ?? 'WP 포스팅 실패');
  return post.link;
}

// ────────────────────────────────────────────
// Cron 핸들러
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: PublishResult[] = [];

  try {
    // 1. K-콘텐츠 키워드 수집 (RSS 최신순)
    console.log('[auto-publish] K-콘텐츠 수집 중...');
    const kKeywords = await fetchKContentKeywords();

    // 2. 일반 카테고리 키워드 수집 (트렌드 우선 + RSS 보완)
    console.log('[auto-publish] 일반 카테고리 수집 중...');
    const generalKeywords = await fetchGeneralKeywords();

    const allKeywords = [...kKeywords, ...generalKeywords];
    console.log('[auto-publish] 전체 선정:', allKeywords.map((k) => `${k.category}: ${k.keyword}`));

    if (allKeywords.length === 0) {
      return NextResponse.json({
        success: false,
        error: '키워드 수집 실패 (0개)',
        results,
      });
    }

    // 3. 각 키워드별 순차 처리
    for (const item of allKeywords) {
      const { keyword, category, news } = item;
      console.log(`[auto-publish] 처리 중: ${keyword} (${category})`);

      try {
        // 블로그 생성
        const blog = await generateBlog(keyword, category, news);

        // DALL-E 이미지 생성 (실패해도 글은 발행)
        const imageUrl = await generateImage(keyword, category);

        // WP 포스팅
        const wpUrl = await postToWordPress({
          title: blog.title,
          content: blog.content,
          metaDesc: blog.metaDesc,
          tags: blog.tags,
          category,
          imageUrl,
          keyword,
        });

        // 발행 이력 저장
        await savePublished(keyword, category, wpUrl);

        results.push({ keyword, category, success: true, wpUrl });
        console.log(`[auto-publish] 성공: ${keyword} → ${wpUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ keyword, category, success: false, error: msg });
        console.error(`[auto-publish] 실패: ${keyword}`, msg);
      }

      // 5초 간격
      await new Promise((r) => setTimeout(r, 5000));
    }

    return NextResponse.json({
      success: true,
      publishedAt: new Date().toISOString(),
      categoriesSelected: allKeywords.map((k) => `${k.category}: ${k.keyword}`),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-publish] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
