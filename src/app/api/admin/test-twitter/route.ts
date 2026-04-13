import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';

export const maxDuration = 30;

export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') return Response.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const envInfo = {
    hasApiKey: !!process.env.X_API_KEY,
    hasApiSecret: !!process.env.X_API_SECRET,
    hasAccessToken: !!process.env.X_ACCESS_TOKEN,
    hasAccessSecret: !!process.env.X_ACCESS_TOKEN_SECRET,
    apiKeyPrefix: process.env.X_API_KEY?.slice(0, 5) || '없음',
    apiKeyLength: process.env.X_API_KEY?.length || 0,
    accessTokenPrefix: process.env.X_ACCESS_TOKEN?.slice(0, 5) || '없음',
    accessTokenLength: process.env.X_ACCESS_TOKEN?.length || 0,
  };

  console.log('[Test] 환경변수:', envInfo);

  if (!process.env.X_API_KEY || !process.env.X_API_SECRET || !process.env.X_ACCESS_TOKEN || !process.env.X_ACCESS_TOKEN_SECRET) {
    return Response.json({
      success: false,
      error: 'X API 환경변수 부족',
      envInfo,
    });
  }

  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const client = new TwitterApi({
      appKey: process.env.X_API_KEY.trim(),
      appSecret: process.env.X_API_SECRET.trim(),
      accessToken: process.env.X_ACCESS_TOKEN.trim(),
      accessSecret: process.env.X_ACCESS_TOKEN_SECRET.trim(),
    });

    const testText = `🧪 Kbuzz X 연동 테스트 ${new Date().toISOString().slice(0, 19)}`;
    console.log('[Test] 트윗 시도:', testText);

    const result = await client.v2.tweet(testText);
    const tweetId = result.data?.id;
    const tweetUrl = tweetId ? `https://x.com/KbuzzNews/status/${tweetId}` : null;

    console.log('[Test] ✅ 성공:', tweetId);
    return Response.json({ success: true, tweetId, tweetUrl, envInfo });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: number; data?: unknown };
    console.error('[Test] ❌ 실패:', e.message, 'code:', e.code, 'data:', JSON.stringify(e.data));
    return Response.json({
      success: false,
      error: e.message || String(err),
      code: e.code,
      data: e.data,
      envInfo,
    });
  }
}
