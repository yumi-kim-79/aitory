import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';
import { requestIndexing } from '@/lib/google-indexing';

export const maxDuration = 300;

// ────────────────────────────────────────────
// WP 최근 발행 글 100개 조회
// ────────────────────────────────────────────
async function fetchRecentWpPosts(): Promise<{ id: number; url: string }[]> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return [];

  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  // WP API per_page max는 100
  const all: { id: number; url: string }[] = [];
  for (const page of [1, 2]) {
    try {
      const res = await fetch(
        `${wpBase}/wp-json/wp/v2/posts?status=publish&per_page=50&page=${page}&orderby=date`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) break;
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;
      for (const p of posts) {
        if (p.link && p.id) all.push({ id: p.id, url: p.link });
      }
      if (posts.length < 50) break;
    } catch {
      break;
    }
  }
  return all.slice(0, 100);
}

// ────────────────────────────────────────────
// 이미 색인 요청한 URL 조회 (7일 이내)
// ────────────────────────────────────────────
async function getIndexedUrls(): Promise<Set<string>> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const snap = await adminDb
      .collection('aitory_indexed_urls')
      .where('requestedAt', '>=', sevenDaysAgo)
      .get();
    return new Set(snap.docs.map((d) => d.data().url as string).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function checkAdmin(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return { error: '로그인이 필요합니다.', status: 401 };
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return { error: '관리자 권한이 필요합니다.', status: 403 };
  }
  return { ok: true };
}

// ────────────────────────────────────────────
// GET: 색인 대기 중인 글 개수 조회
// ────────────────────────────────────────────
export async function GET(request: Request) {
  const auth = await checkAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [posts, indexedSet] = await Promise.all([fetchRecentWpPosts(), getIndexedUrls()]);
    const pending = posts.filter((p) => !indexedSet.has(p.url));
    return NextResponse.json({
      success: true,
      total: posts.length,
      pending: pending.length,
      indexed: posts.length - pending.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// POST: 색인 대기 글 일괄 요청
// ────────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await checkAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [posts, indexedSet] = await Promise.all([fetchRecentWpPosts(), getIndexedUrls()]);
    const pending = posts.filter((p) => !indexedSet.has(p.url));

    console.log(`[bulk-index] 색인 대상 ${pending.length}개`);

    if (pending.length === 0) {
      return NextResponse.json({ success: true, message: '색인 대기 글 없음', total: 0, succeeded: 0, failed: 0 });
    }

    const results: { url: string; success: boolean; error?: string }[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const p of pending) {
      const r = await requestIndexing(p.url);
      const ok = r.success;
      results.push({ url: p.url, success: ok, error: r.error });
      if (ok) {
        succeeded++;
        // Firestore에 기록
        try {
          await adminDb.collection('aitory_indexed_urls').add({
            url: p.url,
            postId: p.id,
            requestedAt: new Date(),
          });
        } catch (e) {
          console.error('[bulk-index] Firestore 기록 실패:', e instanceof Error ? e.message : e);
        }
      } else {
        failed++;
      }
      // Google Indexing API rate limit (200/day, 600/min) — 1초 간격
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      success: true,
      total: pending.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bulk-index] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
