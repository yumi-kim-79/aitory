import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';
import { generateLongtailContent } from '@/lib/longtail-title';
import { buildSummaryBox, buildFaqSection, buildArticleJsonLd, safeExcerpt, appendJsonLd, SEO_AEO_MARKER, SEO_AEO_MARKER_REGEX } from '@/lib/seo-aeo';

export const maxDuration = 300;

interface WpPost {
  id: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string };
  date: string;
  categories: number[];
  featured_media?: number;
}

interface WpMedia {
  source_url: string;
}

// ────────────────────────────────────────────
// WP 인증 헤더
// ────────────────────────────────────────────
function wpAuth() {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return null;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  return { wpBase, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } };
}

// ────────────────────────────────────────────
// 최근 100개 발행 글 조회
// ────────────────────────────────────────────
async function fetchRecentWpPosts(): Promise<WpPost[]> {
  const wp = wpAuth();
  if (!wp) return [];
  const all: WpPost[] = [];
  for (const page of [1, 2]) {
    try {
      const res = await fetch(
        `${wp.wpBase}/wp-json/wp/v2/posts?status=publish&per_page=50&page=${page}&orderby=date&context=edit`,
        { headers: wp.headers, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) break;
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;
      all.push(...(posts as WpPost[]));
      if (posts.length < 50) break;
    } catch {
      break;
    }
  }
  return all.slice(0, 100);
}

// ────────────────────────────────────────────
// 카테고리 ID → 이름 매핑
// ────────────────────────────────────────────
async function fetchCategoryNames(ids: number[]): Promise<Map<number, string>> {
  const wp = wpAuth();
  if (!wp || ids.length === 0) return new Map();
  const map = new Map<number, string>();
  try {
    const res = await fetch(
      `${wp.wpBase}/wp-json/wp/v2/categories?include=${ids.join(',')}&per_page=100`,
      { headers: wp.headers, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return map;
    const cats = await res.json();
    for (const c of cats as { id: number; name: string }[]) {
      map.set(c.id, c.name);
    }
  } catch {}
  return map;
}

async function fetchMediaUrl(mediaId: number): Promise<string | undefined> {
  const wp = wpAuth();
  if (!wp || !mediaId) return undefined;
  try {
    const res = await fetch(`${wp.wpBase}/wp-json/wp/v2/media/${mediaId}`, {
      headers: wp.headers, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const media = (await res.json()) as WpMedia;
    return media.source_url;
  } catch {
    return undefined;
  }
}

// ────────────────────────────────────────────
// 이미 업데이트된 글 조회
// ────────────────────────────────────────────
async function getUpdatedIds(): Promise<Set<number>> {
  try {
    const snap = await adminDb.collection('aitory_seo_updated').get();
    return new Set(snap.docs.map((d) => d.data().postId as number).filter((n) => typeof n === 'number'));
  } catch {
    return new Set();
  }
}

// ────────────────────────────────────────────
// SEO+AEO 마커 감지 (이미 업데이트된 본문)
// rendered/raw 양쪽 + HTML 주석 마커 모두 확인
// ────────────────────────────────────────────
function hasSeoMarkers(post: WpPost): boolean {
  const haystack = (post.content?.raw || '') + '\n' + (post.content?.rendered || '');
  return SEO_AEO_MARKER_REGEX.test(haystack);
}

// ────────────────────────────────────────────
// pending 글 추출
// ────────────────────────────────────────────
async function getPendingPosts(): Promise<WpPost[]> {
  const [posts, updatedIds] = await Promise.all([fetchRecentWpPosts(), getUpdatedIds()]);
  return posts.filter((p) => {
    if (updatedIds.has(p.id)) return false;
    if (hasSeoMarkers(p)) return false;
    return true;
  });
}

async function checkAdmin(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return { error: '로그인이 필요합니다.', status: 401 };
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.', status: 403 };
  }
  return { ok: true as const };
}

// ────────────────────────────────────────────
// GET: 업데이트 대기 글 개수
// ────────────────────────────────────────────
export async function GET(request: Request) {
  const auth = await checkAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [posts, updatedIds] = await Promise.all([fetchRecentWpPosts(), getUpdatedIds()]);
    const pending = posts.filter((p) => {
      if (updatedIds.has(p.id)) return false;
      return !hasSeoMarkers(p);
    });
    return NextResponse.json({
      success: true,
      total: posts.length,
      pending: pending.length,
      updated: posts.length - pending.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// POST: 일괄 SEO+AEO 업데이트
// ────────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await checkAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const wp = wpAuth();
  if (!wp) return NextResponse.json({ error: 'WP 환경변수 부족' }, { status: 500 });

  const BATCH_SIZE = 5;

  try {
    const allPending = await getPendingPosts();
    console.log(`[seo-update] 전체 대기 ${allPending.length}개`);

    if (allPending.length === 0) {
      return NextResponse.json({ success: true, message: '업데이트 대기 글 없음', total: 0, succeeded: 0, failed: 0, totalRemaining: 0 });
    }

    // 이번 배치만 처리
    const pending = allPending.slice(0, BATCH_SIZE);
    console.log(`[seo-update] 배치 처리 ${pending.length}/${allPending.length}`);

    // 카테고리 ID 매핑 (배치 글만)
    const allCatIds = Array.from(new Set(pending.flatMap((p) => p.categories || [])));
    const catMap = await fetchCategoryNames(allCatIds);

    let succeeded = 0;
    let failed = 0;
    const results: { postId: number; title: string; success: boolean; error?: string }[] = [];

    for (const post of pending) {
      const title = (post.title?.rendered || '').replace(/<[^>]+>/g, '').trim();
      const rawContent = post.content?.raw || post.content?.rendered || '';
      const plainSnippet = rawContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 800);
      const categoryName = (post.categories || []).map((id) => catMap.get(id)).filter(Boolean)[0] || '사회/생활';

      try {
        // 1. 롱테일 + FAQ + 요약 생성
        const longtail = await generateLongtailContent(title, categoryName, plainSnippet);

        // 2. 본문 조립: [마커-항상] + [요약박스-옵션] + 기존 본문 + [FAQ-옵션] + [JSON-LD]
        // ⚠️ SEO_AEO_MARKER는 longtail.summary 유무와 무관하게 항상 본문 맨 앞에 삽입
        let newContent = SEO_AEO_MARKER + '\n' + rawContent;
        if (longtail.summary) {
          newContent = SEO_AEO_MARKER + '\n' + buildSummaryBox(longtail.summary) + '\n' + rawContent;
        }
        const jsonLds: string[] = [];
        if (longtail.faqs.length > 0) {
          const { html: faqHtml, jsonLd: faqJsonLd } = buildFaqSection(longtail.faqs);
          newContent += '\n' + faqHtml;
          if (faqJsonLd) jsonLds.push(faqJsonLd);
        }
        // Article JSON-LD
        const newMetaDesc = safeExcerpt(longtail.summary || (post.excerpt?.rendered || '').replace(/<[^>]+>/g, ''));
        const imageUrl = post.featured_media ? await fetchMediaUrl(post.featured_media) : undefined;
        const articleLd = buildArticleJsonLd({
          title, url: post.link, description: newMetaDesc,
          datePublished: post.date, imageUrl,
        });
        jsonLds.push(articleLd);
        newContent = appendJsonLd(newContent, ...jsonLds);

        // 3. WP 업데이트
        const updateBody: Record<string, unknown> = {
          content: newContent,
          excerpt: newMetaDesc,
          meta: {
            _surerank_description: newMetaDesc,
            _yoast_wpseo_metadesc: newMetaDesc,
          },
        };
        const updateRes = await fetch(`${wp.wpBase}/wp-json/wp/v2/posts/${post.id}`, {
          method: 'POST',
          headers: wp.headers,
          body: JSON.stringify(updateBody),
        });
        if (!updateRes.ok) {
          const text = await updateRes.text();
          throw new Error(`WP 업데이트 실패 (${updateRes.status}): ${text.slice(0, 150)}`);
        }

        // WP 업데이트 성공 → 즉시 succeeded 카운트
        succeeded++;
        results.push({ postId: post.id, title, success: true });
        console.log(`[seo-update] WP 성공: ${post.id} ${title}`);

        // 검증: 저장된 본문에 마커가 실제로 남아있는지 재조회 (진단)
        try {
          const verifyRes = await fetch(`${wp.wpBase}/wp-json/wp/v2/posts/${post.id}?context=edit`, {
            headers: wp.headers, signal: AbortSignal.timeout(8000),
          });
          if (verifyRes.ok) {
            const verifyPost = (await verifyRes.json()) as WpPost;
            const haystack = (verifyPost.content?.raw || '') + '\n' + (verifyPost.content?.rendered || '');
            const markerFound = SEO_AEO_MARKER_REGEX.test(haystack);
            if (!markerFound) {
              console.warn(`[seo-update] ⚠️ 마커 누락! postId=${post.id} - WP가 마커를 strip 했을 가능성. raw 앞 200자:`, (verifyPost.content?.raw || '').slice(0, 200));
            } else {
              console.log(`[seo-update] ✅ 마커 검증 성공: ${post.id}`);
            }
          }
        } catch (verifyErr) {
          console.error(`[seo-update] 검증 조회 실패: ${post.id}`, verifyErr instanceof Error ? verifyErr.message : verifyErr);
        }

        // 4. Firestore 기록 (실패해도 WP 성공은 유지 - 마커가 백업)
        try {
          await adminDb.collection('aitory_seo_updated').add({
            postId: post.id,
            url: post.link,
            title,
            updatedAt: new Date(),
            faqCount: longtail.faqs.length,
          });
          console.log(`[seo-update] Firestore 기록 성공: ${post.id}`);
        } catch (fsErr) {
          const fsMsg = fsErr instanceof Error ? fsErr.message : String(fsErr);
          console.error(`[seo-update] Firestore 기록 실패 (계속 진행): ${post.id}`, fsMsg);
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ postId: post.id, title, success: false, error: msg });
        console.error(`[seo-update] 실패: ${post.id}`, msg);
      }

      // API 부하 방지 1초
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      success: true,
      total: pending.length,
      succeeded,
      failed,
      totalRemaining: allPending.length - pending.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seo-update] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
