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
  // context=edit는 일부 호스팅(예: cafe24)에서 권한 문제가 있어 사용하지 않음
  // rendered만 받고, 중복 방지는 Firestore postId를 1차 신호로 사용
  for (const page of [1, 2]) {
    try {
      const res = await fetch(
        `${wp.wpBase}/wp-json/wp/v2/posts?status=publish&per_page=50&page=${page}&orderby=date`,
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
// 이미 업데이트된 글 조회 (Firestore postId 1차 신호)
// 문서 ID 자체를 postId로 사용하여 deterministic 조회
// ────────────────────────────────────────────
async function getUpdatedIds(): Promise<Set<number>> {
  try {
    const snap = await adminDb.collection('aitory_seo_updated').get();
    const ids = new Set<number>();
    for (const doc of snap.docs) {
      // 문서 ID에서 postId 추출 (신규: post_<id>)
      if (doc.id.startsWith('post_')) {
        const n = parseInt(doc.id.slice(5), 10);
        if (!isNaN(n)) ids.add(n);
      }
      // 호환: 기존 random ID 문서의 postId 필드도 수용
      const data = doc.data();
      if (typeof data.postId === 'number') ids.add(data.postId);
    }
    console.log(`[seo-update] Firestore updatedIds ${ids.size}개`);
    return ids;
  } catch (e) {
    console.error('[seo-update] getUpdatedIds 실패:', e instanceof Error ? e.message : e);
    return new Set();
  }
}

// ────────────────────────────────────────────
// SEO+AEO 마커 감지 (보조 신호)
// rendered만 (context=edit 미사용으로 raw 없음)
// ────────────────────────────────────────────
function hasSeoMarkers(post: WpPost): boolean {
  const haystack = post.content?.rendered || '';
  return SEO_AEO_MARKER_REGEX.test(haystack);
}

// ────────────────────────────────────────────
// pending 글 추출
// 1차: Firestore postId 매칭 (신뢰)
// 2차: WP rendered 마커 (보조 fallback)
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

  // Firebase Admin sanity check
  console.log(`[seo-update] adminDb 상태: ${!!adminDb}, 타입: ${typeof adminDb}`);
  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin 미초기화' }, { status: 500 });
  }

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
    const results: { postId: number; title: string; success: boolean; error?: string; firestoreError?: string; firestoreSaved?: boolean }[] = [];

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
        console.log(`[seo-update] WP 성공: ${post.id} ${title}`);

        // 4. Firestore 기록 (postId 기반 deterministic doc ID, idempotent set)
        // 1차 중복 방지 신호이므로 반드시 성공시켜야 함
        let firestoreSaved = false;
        let firestoreError: string | undefined;
        try {
          console.log(`[seo-update] Firestore .set() 호출 시작: post_${post.id}, adminDb 존재=${!!adminDb}`);
          const ref = adminDb.collection('aitory_seo_updated').doc(`post_${post.id}`);
          console.log(`[seo-update] Firestore ref 생성됨: ${ref.path}`);
          await ref.set({
            postId: post.id,
            url: post.link,
            title,
            updatedAt: new Date(),
            faqCount: longtail.faqs.length,
          });
          firestoreSaved = true;
          console.log(`[seo-update] ✅ Firestore 기록 성공: post_${post.id}`);
        } catch (fsErr) {
          firestoreError = fsErr instanceof Error ? `${fsErr.name}: ${fsErr.message}` : String(fsErr);
          console.error(`[seo-update] ❌ Firestore 기록 실패: post_${post.id}`, firestoreError);
          if (fsErr instanceof Error && fsErr.stack) {
            console.error(`[seo-update] Firestore 스택:`, fsErr.stack.slice(0, 500));
          }
        }
        results.push({ postId: post.id, title, success: true, firestoreSaved, firestoreError });
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
