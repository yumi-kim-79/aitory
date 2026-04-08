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
async function postToX(params: {
  title: string; metaDesc: string; wpUrl: string; category: string;
}): Promise<{ tweetUrl: string }> {
  const { TwitterApi } = await import('twitter-api-v2');
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API 환경변수 부족');
  }

  const xClient = new TwitterApi({
    appKey: apiKey, appSecret: apiSecret,
    accessToken, accessSecret,
  });

  const catTag = params.category.replace(/[\/\s]/g, '');
  const desc = params.metaDesc.length > 80 ? params.metaDesc.slice(0, 77) + '...' : params.metaDesc;
  let text = `📰 ${params.title}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  if (text.length > 280) {
    const overflow = text.length - 280;
    const newTitle = params.title.slice(0, params.title.length - overflow - 3) + '...';
    text = `📰 ${newTitle}\n\n${desc}\n\n🔗 ${params.wpUrl}\n\n#Kbuzz #한국트렌드 #${catTag}`;
  }

  const tweet = await xClient.v2.tweet(text);
  if (!tweet.data?.id) throw new Error('트윗 ID 없음');
  return { tweetUrl: `https://x.com/i/web/status/${tweet.data.id}` };
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
