import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';

export const maxDuration = 30;

// ────────────────────────────────────────────
// 디버그: Firestore 컬렉션 상태 + 테스트 쓰기/읽기
// ────────────────────────────────────────────
export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const debug: Record<string, unknown> = {};

  // 1. Firebase Admin 초기화 상태
  try {
    debug.firebaseAdminInitialized = !!adminDb;
  } catch (e) {
    debug.firebaseAdminError = e instanceof Error ? e.message : String(e);
  }

  // 2. aitory_seo_updated 컬렉션 전체 문서 수 + 샘플
  try {
    const seoSnap = await adminDb.collection('aitory_seo_updated').get();
    const docs = seoSnap.docs.map((d) => ({
      id: d.id,
      postId: d.data().postId ?? null,
      title: (d.data().title as string | undefined)?.slice(0, 50) ?? null,
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
    }));
    debug.aitory_seo_updated = {
      totalCount: seoSnap.size,
      sample: docs.slice(0, 20),
      idPatterns: {
        post_prefix: docs.filter((d) => d.id.startsWith('post_')).length,
        random: docs.filter((d) => !d.id.startsWith('post_')).length,
      },
    };
  } catch (e) {
    debug.aitory_seo_updated_error = e instanceof Error ? e.message : String(e);
  }

  // 3. aitory_indexed_urls 컬렉션 전체 문서 수
  try {
    const idxSnap = await adminDb.collection('aitory_indexed_urls').get();
    debug.aitory_indexed_urls = {
      totalCount: idxSnap.size,
      sample: idxSnap.docs.slice(0, 5).map((d) => ({
        id: d.id,
        url: d.data().url ?? null,
        postId: d.data().postId ?? null,
      })),
    };
  } catch (e) {
    debug.aitory_indexed_urls_error = e instanceof Error ? e.message : String(e);
  }

  // 4. 테스트 쓰기/읽기 (aitory_debug_test 컬렉션)
  const testDocId = `test_${Date.now()}`;
  try {
    const testRef = adminDb.collection('aitory_debug_test').doc(testDocId);
    await testRef.set({
      writtenAt: new Date(),
      by: decoded.email,
      note: 'debug write test',
    });
    const readBack = await testRef.get();
    debug.testWriteRead = {
      success: true,
      docId: testDocId,
      exists: readBack.exists,
      data: readBack.data() ? JSON.parse(JSON.stringify(readBack.data())) : null,
    };
    // 정리
    await testRef.delete();
  } catch (e) {
    debug.testWriteRead = {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({ success: true, debug });
}
