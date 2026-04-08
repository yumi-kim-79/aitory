import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';

export const maxDuration = 300;

interface TweetResult {
  keyword: string;
  postId: number;
  success: boolean;
  tweetUrl?: string;
  error?: string;
}

// ────────────────────────────────────────────
// X 트윗 발행 (텍스트 전용)
// ────────────────────────────────────────────
// 모듈 레벨에서 1회 클라이언트 생성/검증
let _xClientCache: import('twitter-api-v2').TwitterApi | null = null;

async function getXClient() {
  if (_xClientCache) return _xClientCache;

  const { TwitterApi } = await import('twitter-api-v2');
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  // 환경변수 진단 로깅 (앞 4자리만)
  console.log('[X-API] 환경변수 진단:', {
    apiKey: apiKey ? `${apiKey.slice(0, 4)}... (${apiKey.length}자)` : '없음',
    apiSecret: apiSecret ? `${apiSecret.slice(0, 4)}... (${apiSecret.length}자)` : '없음',
    accessToken: accessToken ? `${accessToken.slice(0, 4)}... (${accessToken.length}자)` : '없음',
    accessSecret: accessSecret ? `${accessSecret.slice(0, 4)}... (${accessSecret.length}자)` : '없음',
  });

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API 환경변수 부족 (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET 확인 필요)');
  }

  // 공백/따옴표 trim
  const cleaned = {
    appKey: apiKey.trim().replace(/^["']|["']$/g, ''),
    appSecret: apiSecret.trim().replace(/^["']|["']$/g, ''),
    accessToken: accessToken.trim().replace(/^["']|["']$/g, ''),
    accessSecret: accessSecret.trim().replace(/^["']|["']$/g, ''),
  };

  _xClientCache = new TwitterApi(cleaned);
  return _xClientCache;
}

async function postToX(params: {
  title: string; metaDesc: string; wpUrl: string; category: string;
}): Promise<{ tweetUrl: string }> {
  const xClient = await getXClient();
  // readWrite 권한 명시 (OAuth 1.0a User Context)
  const rwClient = xClient.readWrite;

  const catTag = params.category.replace(/[\/\s]/g, '');
  const desc = params.metaDesc.length > 80 ? params.metaDesc.slice(0, 77) + '...' : params.metaDesc;
  let text = `📰 ${params.title}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  if (text.length > 280) {
    const overflow = text.length - 280;
    const newTitle = params.title.slice(0, params.title.length - overflow - 3) + '...';
    text = `📰 ${newTitle}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  }

  try {
    const tweet = await rwClient.v2.tweet(text);
    if (!tweet.data?.id) throw new Error('트윗 ID 없음');
    return { tweetUrl: `https://x.com/i/web/status/${tweet.data.id}` };
  } catch (err) {
    // twitter-api-v2 ApiResponseError 상세 진단
    const e = err as { code?: number; data?: unknown; message?: string };
    console.error('[X-API] 트윗 실패 상세:', { code: e.code, data: e.data, message: e.message });
    if (e.code === 401) {
      throw new Error('X API 401 Unauthorized: 앱 권한이 Read and Write인지 + 권한 변경 후 Access Token 재발급했는지 확인');
    }
    if (e.code === 403) {
      throw new Error('X API 403 Forbidden: 앱 권한 또는 Free Tier 트윗 한도 초과');
    }
    throw err;
  }
}

// ────────────────────────────────────────────
// WP 글 정보 조회 (제목 + 메타설명)
// ────────────────────────────────────────────
async function fetchPostMeta(postId: number): Promise<{ title: string; excerpt: string } | null> {
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
    return {
      title: (post.title?.rendered || '').replace(/<[^>]+>/g, ''),
      excerpt: (post.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim(),
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────
// 핸들러: tweetUrl 없는 최근 글에 트윗 발행 (관리자 전용)
// ────────────────────────────────────────────
export async function POST(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const results: TweetResult[] = [];

  try {
    // 최근 7일 내 tweetUrl 없는 글 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('publishedAt', '>=', sevenDaysAgo)
      .get();

    const pending = snap.docs.filter((d) => {
      const data = d.data();
      return !data.tweetUrl && data.postId;
    });

    console.log(`[post-to-x-bulk] 트윗 대상 ${pending.length}개`);

    if (pending.length === 0) {
      return NextResponse.json({ success: true, message: '트윗 대상 없음', results });
    }

    for (const doc of pending) {
      const data = doc.data();
      const { keyword, category, wpUrl, postId } = data as { keyword: string; category: string; wpUrl: string; postId: number };

      try {
        const meta = await fetchPostMeta(postId);
        const title = meta?.title || keyword;
        const metaDesc = meta?.excerpt || keyword;

        const { tweetUrl } = await postToX({ title, metaDesc, wpUrl, category });

        await doc.ref.update({ tweetUrl, tweetError: null, tweetedAt: new Date() });
        results.push({ keyword, postId, success: true, tweetUrl });
        console.log(`[post-to-x-bulk] 성공: ${keyword} → ${tweetUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ keyword, postId, success: false, error: msg });
        await doc.ref.update({ tweetError: msg }).catch(() => {});
        console.error(`[post-to-x-bulk] 실패: ${keyword}`, msg);
      }

      // 5초 간격 (X rate limit + DALL-E rate limit)
      // 3초 간격 (X rate limit)
      await new Promise((r) => setTimeout(r, 3000));
    }

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      total: pending.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[post-to-x-bulk] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
