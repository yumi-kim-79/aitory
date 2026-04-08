import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TweetResult {
  keyword: string;
  postId: number;
  success: boolean;
  tweetUrl?: string;
  error?: string;
}

// ────────────────────────────────────────────
// 트윗용 DALL-E 이미지 생성 (1024x1024 standard)
// ────────────────────────────────────────────
async function generateTweetImage(keyword: string, category: string): Promise<Buffer | null> {
  try {
    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Create a DALL-E 3 image prompt in English for a Twitter post about "${keyword}" (category: ${category}).
Requirements: square 1:1 composition, no human faces, no text/letters, vibrant and eye-catching, social media optimized, professional quality.
Respond with only the English prompt, no other text.`,
      }],
    });
    const dallePrompt = promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : keyword;

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
      n: 1,
    });
    const url = imgRes.data?.[0]?.url;
    if (!url) return null;

    const fetched = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!fetched.ok) return null;
    return Buffer.from(await fetched.arrayBuffer());
  } catch (e) {
    console.error('[tweet-image] 생성 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ────────────────────────────────────────────
// X 트윗 발행
// ────────────────────────────────────────────
async function postToX(params: {
  title: string; metaDesc: string; wpUrl: string; category: string; keyword: string;
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

  let mediaIds: [string] | undefined;
  try {
    const imgBuffer = await generateTweetImage(params.keyword, params.category);
    if (imgBuffer) {
      const mediaId = await xClient.v1.uploadMedia(imgBuffer, { mimeType: 'image/png' });
      mediaIds = [mediaId];
      console.log(`[tweet] 이미지 업로드 성공: ${mediaId}`);
    }
  } catch (e) {
    console.error('[tweet] 이미지 업로드 실패, 텍스트만 트윗:', e instanceof Error ? e.message : e);
  }

  const tweet = mediaIds
    ? await xClient.v2.tweet(text, { media: { media_ids: mediaIds } })
    : await xClient.v2.tweet(text);

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
// Cron 핸들러: tweetUrl 없는 최근 글에 트윗 발행
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const { tweetUrl } = await postToX({ title, metaDesc, wpUrl, category, keyword });

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
      await new Promise((r) => setTimeout(r, 5000));
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
