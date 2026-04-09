import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RepublishResult {
  originalKeyword: string;
  newTitle?: string;
  newPostId?: number;
  newWpUrl?: string;
  success: boolean;
  error?: string;
}

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

function tryParseJSON(text: string): Record<string, unknown> {
  const raw = extractJSON(text);
  try { return JSON.parse(raw); } catch {}
  let fixed = raw;
  const quotes = (fixed.match(/"/g) || []).length;
  if (quotes % 2 !== 0) fixed += '"';
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
  return JSON.parse(fixed);
}

function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?:\n(?!<li>))/g, '<ul>$1</ul>\n');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
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
// WP 글 정보 조회 (featured_media 포함)
// ────────────────────────────────────────────
async function fetchPostInfo(postId: number): Promise<{ title: string; content: string; featuredMedia?: number } | null> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return null;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  try {
    const res = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const post = await res.json();
    const featuredMedia = typeof post.featured_media === 'number' && post.featured_media > 0 ? post.featured_media : undefined;
    return {
      title: (post.title?.rendered || '').replace(/<[^>]+>/g, ''),
      content: (post.content?.raw || post.content?.rendered || '').replace(/<[^>]+>/g, '').slice(0, 1500),
      featuredMedia,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────
// 같은 카테고리 최근 글 3개 조회
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
// 다른 각도로 재작성
// ────────────────────────────────────────────
async function regenerateFromAngle(
  originalTitle: string, originalContent: string, category: string,
  relatedPosts: { title: string; url: string }[],
): Promise<{ title: string; content: string; metaDesc: string; tags: string[]; slug: string }> {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const linkInstruction = relatedPosts.length > 0
    ? `\n본문 중 자연스러운 위치에 아래 관련 글 중 1~2개를 [텍스트](URL) 형식으로 마크다운 링크 삽입:
${relatedPosts.map((p) => `- [${p.title}](${p.url})`).join('\n')}`
    : '';

  const prompt = `다음 글을 완전히 다른 각도로 재작성해줘.

원본 제목: ${originalTitle}
카테고리: ${category}
원본 본문:
${originalContent}

재작성 요건:
- 같은 주제, 다른 관점 (예: "X 분석" → "X에서 성공한 5가지 이유")
- 리스트형/분석형/전망형 중 선택
- 원본과 중복 없는 새로운 시각

JSON만 반환:
{"title":"제목 40~60자","slug":"english-slug","content":"마크다운 본문","excerpt":"메타설명 140자이내","tags":["태그1","태그2","태그3","태그4","태그5"]}

slug: 핵심 키워드 영문, 50자 이내, 소문자, 하이픈
content 요건: 1500자 이상 마크다운, ## 소제목 4개+, 각 2~3단락, **굵게**, - 리스트 활용, 오늘(${today}) 기준
excerpt는 140자 이내.${linkInstruction}`;

  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.content[0].type === 'text' ? res.content[0].text : '';
  const parsed = tryParseJSON(text);

  let content = markdownToHtml(parsed.content as string);

  // 관련 글 섹션 자동 추가
  if (relatedPosts.length > 0) {
    const relatedHtml = relatedPosts.map((p) => `<li><a href="${p.url}">${p.title}</a></li>`).join('\n');
    content += `\n<h3>관련 글</h3>\n<ul>\n${relatedHtml}\n</ul>`;
  }

  const metaDesc = (parsed.metaDesc as string || parsed.excerpt as string || '').slice(0, 150);
  let slug = (parsed.slug as string || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (slug.length > 50) slug = slug.slice(0, 50).replace(/-$/, '');

  return {
    title: parsed.title as string,
    content,
    metaDesc,
    tags: (parsed.tags as string[]) || [],
    slug,
  };
}

// ────────────────────────────────────────────
// WP draft 저장
// ────────────────────────────────────────────
async function postDraftToWP(params: {
  title: string; content: string; metaDesc: string; tags: string[]; category: string; slug?: string; featuredMedia?: number;
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
    if (cats.length > 0) { categoryId = cats[0].id; }
    else {
      const cc = await fetch(`${wpBase}/wp-json/wp/v2/categories`, { method: 'POST', headers, body: JSON.stringify({ name: params.category }), signal: AbortSignal.timeout(8000) });
      categoryId = (await cc.json()).id;
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
  if (params.featuredMedia) postBody.featured_media = params.featuredMedia;

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, { method: 'POST', headers, body: JSON.stringify(postBody) });
  const post = await postRes.json();
  if (!post.id) throw new Error(post.message ?? 'WP draft 저장 실패');
  return { postId: post.id, wpUrl: post.link || `${wpBase}/?p=${post.id}` };
}

// ────────────────────────────────────────────
// 핸들러: 인기글 5개 재발행 (관리자 전용)
// ────────────────────────────────────────────
export async function POST(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const results: RepublishResult[] = [];

  try {
    // 최근 30일 발행 글에서 랜덤 5개 선정 (조회수 플러그인 없으므로 랜덤)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('publishedAt', '>=', thirtyDaysAgo)
      .get();

    if (snap.size === 0) {
      return NextResponse.json({ success: true, message: '재발행 대상 없음', results });
    }

    // 랜덤 5개 셔플
    const allDocs = snap.docs.slice();
    for (let i = allDocs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDocs[i], allDocs[j]] = [allDocs[j], allDocs[i]];
    }
    const selected = allDocs.slice(0, 5);

    console.log(`[republish] ${selected.length}개 재발행 시작`);

    for (const doc of selected) {
      const data = doc.data();
      const { keyword, category, postId } = data as { keyword: string; category: string; postId: number };

      try {
        const [original, relatedPosts] = await Promise.all([
          fetchPostInfo(postId),
          fetchRelatedPosts(category),
        ]);
        if (!original) throw new Error('원본 글 조회 실패');
        console.log(`[republish] ${keyword}: 관련글 ${relatedPosts.length}개, featuredMedia=${original.featuredMedia ?? '없음'}`);

        const regen = await regenerateFromAngle(original.title, original.content, category, relatedPosts);
        const { postId: newPostId, wpUrl: newWpUrl } = await postDraftToWP({
          title: regen.title, content: regen.content, metaDesc: regen.metaDesc,
          tags: regen.tags, category, slug: regen.slug,
          featuredMedia: original.featuredMedia,
        });

        await adminDb.collection('aitory_published_keywords').add({
          keyword: regen.title,
          category, wpUrl: newWpUrl, postId: newPostId,
          // 이미지 재활용했으면 done, 없으면 pending
          imageStatus: original.featuredMedia ? 'done' : 'pending',
          status: 'draft', publishedAt: new Date(),
          tweetUrl: null, tweetError: null,
          republishedFrom: keyword,
          reusedFeaturedMedia: original.featuredMedia ?? null,
        });

        results.push({ originalKeyword: keyword, newTitle: regen.title, newPostId, newWpUrl, success: true });
        console.log(`[republish] 성공: ${keyword} → ${regen.title}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ originalKeyword: keyword, success: false, error: msg });
        console.error(`[republish] 실패: ${keyword}`, msg);
      }
    }

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      total: selected.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[republish] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
