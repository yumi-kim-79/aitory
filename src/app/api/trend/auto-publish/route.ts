import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ────────────────────────────────────────────
// 카테고리 정의
// ────────────────────────────────────────────
const CATEGORIES = [
  '연예/문화',
  '경제/비즈니스',
  '사회/생활',
  'IT/과학',
  '스포츠',
] as const;
type Category = (typeof CATEGORIES)[number];

interface TrendKeyword {
  keyword: string;
  category: Category | '정치' | '기타';
  rank: number;
}

interface PublishResult {
  keyword: string;
  category: string;
  success: boolean;
  wpUrl?: string;
  error?: string;
}

// ────────────────────────────────────────────
// 1. Google Trends RSS 수집 (TOP 15)
// ────────────────────────────────────────────
async function fetchTrendKeywords(): Promise<{ keywords: string[]; debug: { source: string; error?: string } }> {
  // 기존 /api/trend/fetch API를 내부 호출 (프론트엔드에서 정상 작동 확인됨)
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://aitory.vercel.app';

  const url = `${baseUrl}/api/trend/fetch`;
  console.log(`[fetchTrends] 내부 API 호출: ${url}`);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    console.log(`[fetchTrends] 응답 status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[fetchTrends] API 에러:`, text.slice(0, 300));
      return { keywords: [], debug: { source: url, error: `HTTP ${res.status}: ${text.slice(0, 200)}` } };
    }

    const data = await res.json();
    const keywords = (data.keywords || []).map((k: { title: string }) => k.title).slice(0, 15);
    console.log(`[fetchTrends] 키워드 ${keywords.length}개 수집:`, keywords);

    return { keywords, debug: { source: url } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fetchTrends] 에러:`, msg);
    return { keywords: [], debug: { source: url, error: msg } };
  }
}

// ────────────────────────────────────────────
// 2. Claude로 키워드 카테고리 분류 + 정치 필터
// ────────────────────────────────────────────
async function classifyKeywords(keywords: string[]): Promise<TrendKeyword[]> {
  const prompt = `다음 키워드들을 각각 아래 카테고리 중 하나로 분류해줘.
카테고리: 연예/문화, 경제/비즈니스, 사회/생활, IT/과학, 스포츠, 정치, 기타

키워드 목록:
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

응답 형식(JSON 배열만, 다른 텍스트 없이):
[
  {"keyword": "키워드", "category": "카테고리명"},
  ...
]`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return keywords.map((k, i) => ({ keyword: k, category: '기타', rank: i + 1 }));

  const parsed: { keyword: string; category: string }[] = JSON.parse(jsonMatch[0]);
  return parsed.map((item, i) => ({
    keyword: item.keyword,
    category: item.category as TrendKeyword['category'],
    rank: i + 1,
  }));
}

// ────────────────────────────────────────────
// 3. 카테고리별 대표 1개 선정
// ────────────────────────────────────────────
function selectOnePerCategory(classified: TrendKeyword[]): TrendKeyword[] {
  // 정치 제외
  const filtered = classified.filter((k) => k.category !== '정치');

  const selected: TrendKeyword[] = [];
  const usedCategories = new Set<string>();

  // 순위 순으로 카테고리별 1개씩 선정
  for (const item of filtered) {
    const cat = item.category;
    if (!usedCategories.has(cat) && CATEGORIES.includes(cat as Category)) {
      selected.push(item);
      usedCategories.add(cat);
    }
    // 5개 카테고리 모두 채웠으면 종료
    if (selected.length >= CATEGORIES.length) break;
  }

  return selected;
}

// ────────────────────────────────────────────
// 4. RSS 뉴스 수집
// ────────────────────────────────────────────
async function fetchNews(keyword: string): Promise<string> {
  try {
    const query = encodeURIComponent(keyword);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`,
      { next: { revalidate: 0 } }
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
// 5. Claude 블로그 글 생성
// ────────────────────────────────────────────
async function generateBlog(
  keyword: string,
  category: string,
  news: string
): Promise<{ title: string; content: string; metaDesc: string; tags: string[] }> {
  const prompt = `당신은 SEO 전문 블로거입니다. 다음 정보를 바탕으로 블로그 글을 작성하세요.

키워드: ${keyword}
카테고리: ${category}
관련 뉴스:
${news}

요구사항:
- HTML 형식(h2, h3, p, strong 태그 사용)
- 1500자 이상
- 소제목 3개 이상
- SEO에 최적화된 자연스러운 한국어
- 사실에 기반한 내용, 추측 최소화
- 사람 얼굴/인물 묘사 최소화

응답 JSON(다른 텍스트 없이):
{
  "title": "SEO 제목 (50자 이내)",
  "content": "HTML 블로그 본문",
  "metaDesc": "메타 설명 (150자 이내)",
  "tags": ["태그1", "태그2", "태그3"]
}`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('블로그 생성 JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

// ────────────────────────────────────────────
// 6. DALL-E 3 이미지 생성
// ────────────────────────────────────────────
async function generateImage(keyword: string, category: string): Promise<string | null> {
  try {
    // 키워드 → 영어 프롬프트 변환
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
    return imgRes.data?.[0]?.url ?? null;
  } catch (e) {
    console.error('DALL-E 생성 실패:', e);
    return null;
  }
}

// ────────────────────────────────────────────
// 7. WP 포스팅 (이미지 포함)
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
  const wpBase = process.env.WP_URL;
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
      const imgFetch = await fetch(params.imageUrl);
      const imgBuffer = await imgFetch.arrayBuffer();
      const mediaRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${params.keyword}-thumbnail.png"`,
        },
        body: imgBuffer,
      });
      const media = await mediaRes.json();
      if (media.id) {
        featuredMediaId = media.id;
        // alt text 설정
        await fetch(`${wpBase}/wp-json/wp/v2/media/${media.id}`, {
          method: 'POST', headers,
          body: JSON.stringify({ alt_text: params.keyword }),
        });
      }
    } catch (e) {
      console.error('WP 미디어 업로드 실패:', e);
    }
  }

  // 포스트 발행
  const postBody: Record<string, unknown> = {
    title: params.title,
    content: params.content,
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
  // Bearer 인증
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: PublishResult[] = [];

  try {
    // 1. 트렌드 TOP 15 수집
    console.log('[auto-publish] 트렌드 수집 중...');
    const { keywords, debug: trendDebug } = await fetchTrendKeywords();
    console.log('[auto-publish] 수집된 키워드:', keywords, '디버그:', trendDebug);

    if (keywords.length === 0) {
      return NextResponse.json({
        success: false,
        error: '트렌드 키워드 수집 실패 (0개)',
        debugInfo: trendDebug,
        results,
      });
    }

    // 2. 카테고리 분류
    console.log('[auto-publish] 카테고리 분류 중...');
    const classified = await classifyKeywords(keywords);
    console.log('[auto-publish] 분류 결과:', classified);

    // 3. 카테고리별 1개 선정
    const selected = selectOnePerCategory(classified);
    console.log('[auto-publish] 선정된 키워드:', selected);

    // 4. 선정된 키워드별 순차 처리
    for (const item of selected) {
      const { keyword, category } = item;
      console.log(`[auto-publish] 처리 중: ${keyword} (${category})`);

      try {
        // 뉴스 수집
        const news = await fetchNews(keyword);

        // 블로그 생성
        const blog = await generateBlog(keyword, category, news);

        // DALL-E 이미지 생성
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
      categoriesSelected: selected.map((s) => `${s.category}: ${s.keyword}`),
      results,
      debugInfo: { trendSource: trendDebug.source, keywordCount: keywords.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-publish] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}