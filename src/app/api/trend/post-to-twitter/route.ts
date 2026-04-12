import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

export const maxDuration = 30;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `K-Culture 블로그 Kbuzz의 SNS 담당자입니다.
블로그 글 정보를 받아서 X(트위터)용 포스트를 작성하세요.
규칙:
- 총 230자 이내 (URL은 별도 추가됨)
- 첫 줄: 강렬한 훅 문장 + 이모지
- 중간: 핵심 내용 1~2줄
- 마지막 줄: 관련 해시태그 3~5개
- #Kbuzz 해시태그 반드시 포함
- 자연스러운 한국어로 작성
- URL은 포함하지 마세요 (별도 추가됩니다)
- 트윗 텍스트만 출력, 다른 설명 없이`;

async function generateTweetText(params: {
  title: string; keyword: string; category: string; metaDesc: string;
}): Promise<string> {
  const res = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `제목: ${params.title}\n키워드: ${params.keyword}\n카테고리: ${params.category}\n요약: ${params.metaDesc}`,
    }],
  });
  return res.content[0].type === "text" ? res.content[0].text.trim() : params.title;
}

async function postTweet(text: string): Promise<{ tweetId: string; tweetUrl: string }> {
  const { TwitterApi } = await import("twitter-api-v2");
  const apiKey = process.env.TWITTER_API_KEY || process.env.X_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET || process.env.X_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN || process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error("Twitter API 환경변수 부족 (TWITTER_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_TOKEN_SECRET)");
  }

  const client = new TwitterApi({
    appKey: apiKey.trim(), appSecret: apiSecret.trim(),
    accessToken: accessToken.trim(), accessSecret: accessSecret.trim(),
  });

  const tweet = await client.readWrite.v2.tweet(text);
  if (!tweet.data?.id) throw new Error("트윗 ID 없음");

  const tweetId = tweet.data.id;
  const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
  return { tweetId, tweetUrl };
}

// ────────────────────────────────────────────
// 공통 함수: 트위터 포스팅 (API 내부/외부 모두 사용)
// ────────────────────────────────────────────
export async function postToTwitter(params: {
  title: string;
  kbuzzUrl: string;
  keyword: string;
  category: string;
  metaDesc: string;
  firestoreDocId?: string;
}): Promise<{ success: boolean; tweetUrl?: string; error?: string }> {
  try {
    // Claude로 트윗 텍스트 생성
    let tweetBody = await generateTweetText({
      title: params.title,
      keyword: params.keyword,
      category: params.category,
      metaDesc: params.metaDesc,
    });

    // URL 추가 (트윗 본문 끝에 링크)
    const fullTweet = `${tweetBody}\n\n🔗 ${params.kbuzzUrl}`;
    // 280자 초과 시 본문 축소
    const tweetText = fullTweet.length <= 280
      ? fullTweet
      : `${tweetBody.slice(0, 280 - params.kbuzzUrl.length - 10)}...\n\n🔗 ${params.kbuzzUrl}`;

    // 트윗 발행
    const { tweetUrl } = await postTweet(tweetText);
    console.log(`[twitter] 포스팅 성공: ${tweetUrl}`);

    // Firestore 업데이트
    if (params.firestoreDocId) {
      try {
        await adminDb.collection("aitory_published_keywords").doc(params.firestoreDocId).set({
          tweetUrl,
          tweetError: null,
          tweetedAt: new Date(),
        }, { merge: true });
      } catch (fsErr) {
        console.error("[twitter] Firestore 업데이트 실패:", fsErr instanceof Error ? fsErr.message : fsErr);
      }
    }

    return { success: true, tweetUrl };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[twitter] 포스팅 실패:", error);

    // Firestore에 에러 기록
    if (params.firestoreDocId) {
      try {
        await adminDb.collection("aitory_published_keywords").doc(params.firestoreDocId).set({
          tweetUrl: null,
          tweetError: error,
        }, { merge: true });
      } catch {}
    }

    return { success: false, error };
  }
}

// ────────────────────────────────────────────
// POST 핸들러 (관리자 수동 호출)
// ────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (!userDoc || userDoc.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const { title, kbuzzUrl, keyword, category, metaDesc, firestoreDocId } = body as {
      title: string; kbuzzUrl: string; keyword?: string; category?: string; metaDesc?: string; firestoreDocId?: string;
    };

    if (!title || !kbuzzUrl) {
      return Response.json({ error: "title, kbuzzUrl 필수" }, { status: 400 });
    }

    const result = await postToTwitter({
      title, kbuzzUrl,
      keyword: keyword || "",
      category: category || "",
      metaDesc: metaDesc || "",
      firestoreDocId,
    });

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
