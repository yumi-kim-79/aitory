import { TwitterApi } from 'twitter-api-v2';

// ────────────────────────────────────────────
// 카테고리별 이모지
// ────────────────────────────────────────────
function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    'K-연예/한류': '🎤',
    'K-스포츠': '⚽',
    '경제/비즈니스': '📈',
    'IT/과학': '🤖',
    '사회/생활': '📰',
    '건강': '💊',
    '여행': '✈️',
    '교육': '📚',
    '음식': '🍽️',
  };
  return map[category] ?? '📌';
}

// ────────────────────────────────────────────
// 트윗 텍스트 생성 (템플릿, Claude API 없이)
// ────────────────────────────────────────────
function buildTweetText({
  title, kbuzzUrl, keyword, category,
}: {
  title: string; kbuzzUrl: string; keyword: string; category: string;
}): string {
  const emoji = getCategoryEmoji(category);
  const tag = '#' + keyword.replace(/\s+/g, '');
  const base = `${emoji} ${title}\n\n${kbuzzUrl}\n\n${tag} #Kbuzz #K컬처`;

  if (base.length <= 280) return base;

  // 280자 초과 시 제목 자르기
  const overhead = kbuzzUrl.length + tag.length + 20;
  const maxTitle = 280 - overhead;
  return `${emoji} ${title.slice(0, maxTitle)}...\n\n${kbuzzUrl}\n\n${tag} #Kbuzz`;
}

// ────────────────────────────────────────────
// X(트위터) 포스팅 메인 함수
// ────────────────────────────────────────────
export async function postToTwitter({
  title, kbuzzUrl, keyword, category,
}: {
  title: string;
  kbuzzUrl: string;
  keyword: string;
  category: string;
  metaDesc?: string;
}): Promise<{ tweetId: string; tweetUrl: string }> {
  console.log('[Twitter] 환경변수 확인:', {
    hasApiKey: !!process.env.X_API_KEY,
    hasApiSecret: !!process.env.X_API_SECRET,
    hasAccessToken: !!process.env.X_ACCESS_TOKEN,
    hasAccessSecret: !!process.env.X_ACCESS_TOKEN_SECRET,
  });

  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API 환경변수 부족 (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)');
  }

  const client = new TwitterApi({
    appKey: apiKey.trim(),
    appSecret: apiSecret.trim(),
    accessToken: accessToken.trim(),
    accessSecret: accessSecret.trim(),
  });

  const tweetText = buildTweetText({ title, kbuzzUrl, keyword, category });
  console.log('[Twitter] 트윗 내용:', tweetText);
  console.log('[Twitter] 트윗 길이:', tweetText.length);

  const result = await client.v2.tweet(tweetText);
  if (!result.data?.id) throw new Error('트윗 ID 없음');

  const tweetId = result.data.id;
  const tweetUrl = `https://x.com/KbuzzNews/status/${tweetId}`;
  console.log('[Twitter] 포스팅 성공:', tweetUrl);

  return { tweetId, tweetUrl };
}
