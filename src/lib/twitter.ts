import { TwitterApi } from 'twitter-api-v2';

// ────────────────────────────────────────────
// 트윗 텍스트 생성 (Claude API 직접 호출)
// ────────────────────────────────────────────
async function generateTweetText({
  title, kbuzzUrl, keyword, category, metaDesc,
}: {
  title: string; kbuzzUrl: string; keyword: string; category: string; metaDesc: string;
}): Promise<string> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 300,
        system: `당신은 K-Culture 블로그 Kbuzz의 X(트위터) SNS 담당자입니다.
블로그 글 정보를 받아서 X(트위터)용 포스트를 작성하세요.
규칙:
- URL 제외 230자 이내
- 첫 줄: 강렬한 훅 문장 + 이모지
- 중간: 핵심 내용 1~2줄
- 마지막: 해시태그 3~5개
- #Kbuzz 반드시 포함
- 자연스러운 한국어
- URL은 포함하지 말 것 (별도 추가됨)
- 트윗 텍스트만 출력, 다른 설명 없이`,
        messages: [{
          role: 'user',
          content: `제목: ${title}\n키워드: ${keyword}\n카테고리: ${category}\n설명: ${metaDesc}\n\n위 정보로 트윗을 작성해줘.`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error('[Twitter] Claude API 실패:', res.status);
      throw new Error(`Claude API ${res.status}`);
    }

    const data = await res.json();
    const tweetBody = data.content?.[0]?.text?.trim() || '';
    if (!tweetBody) throw new Error('Claude 응답 비어있음');

    // URL 추가
    const fullTweet = `${tweetBody}\n\n${kbuzzUrl}`;
    // 280자 초과 시 본문 축소
    if (fullTweet.length <= 280) return fullTweet;
    const maxBody = 280 - kbuzzUrl.length - 5; // \n\n + 여유
    return `${tweetBody.slice(0, maxBody)}...\n\n${kbuzzUrl}`;
  } catch (e) {
    // Claude 실패 시 기본 트윗 생성
    const fallbackTitle = title.length > 80 ? title.slice(0, 77) + '...' : title;
    const catTag = category.replace(/[\/\s]/g, '');
    return `📰 ${fallbackTitle}\n\n${kbuzzUrl}\n\n#Kbuzz #${catTag}`;
  }
}

// ────────────────────────────────────────────
// X(트위터) 포스팅 메인 함수
// ────────────────────────────────────────────
export async function postToTwitter({
  title, kbuzzUrl, keyword, category, metaDesc,
}: {
  title: string;
  kbuzzUrl: string;
  keyword: string;
  category: string;
  metaDesc: string;
}): Promise<{ tweetId: string; tweetUrl: string }> {
  // 환경변수 확인 로그
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

  // Claude로 트윗 텍스트 생성
  const tweetText = await generateTweetText({ title, kbuzzUrl, keyword, category, metaDesc });
  console.log('[Twitter] 트윗 내용:', tweetText.slice(0, 100));

  // 트윗 발행
  const result = await client.v2.tweet(tweetText);
  if (!result.data?.id) throw new Error('트윗 ID 없음');

  const tweetId = result.data.id;
  const tweetUrl = `https://x.com/KbuzzNews/status/${tweetId}`;
  console.log('[Twitter] 포스팅 성공:', tweetUrl);

  return { tweetId, tweetUrl };
}
