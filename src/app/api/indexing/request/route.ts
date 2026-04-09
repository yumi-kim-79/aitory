import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';
import { requestIndexing, requestIndexingBatch } from '@/lib/google-indexing';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (!userDoc || userDoc.role !== 'admin') {
      return Response.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { url, urls } = body as { url?: string; urls?: string[] };

    if (urls?.length) {
      const results = await requestIndexingBatch(urls);
      return Response.json({ success: true, results });
    }

    if (url) {
      const result = await requestIndexing(url);
      return Response.json(result);
    }

    return Response.json({ error: 'url 또는 urls 필드가 필요합니다.' }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return Response.json({ error: msg }, { status: 500 });
  }
}
