import { adminDb } from "@/lib/firebase-admin";
import { postToTwitter } from "@/lib/twitter";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, postId, title, url, category, excerpt, keyword } = body as {
      secret?: string;
      postId?: number;
      title?: string;
      url?: string;
      category?: string;
      excerpt?: string;
      keyword?: string;
    };

    // 1. secret 검증
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret || secret !== webhookSecret) {
      console.error("[webhook] secret 불일치");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!postId || !title || !url) {
      return Response.json({ error: "postId, title, url 필수" }, { status: 400 });
    }

    console.log(`[webhook] WordPress 발행 수신: postId=${postId}, title="${title.slice(0, 50)}"`);

    const docId = `kbuzz_${postId}`;
    const docRef = adminDb.collection("aitory_published_keywords").doc(docId);

    // 2. 중복 트윗 방지: tweetUrl 이미 있으면 스킵
    try {
      const existDoc = await docRef.get();
      const existTweet = existDoc.data()?.tweetUrl;
      if (existTweet && typeof existTweet === "string" && existTweet.startsWith("http")) {
        console.log("[webhook] 이미 트윗됨, 스킵:", existTweet);
        return Response.json({ success: true, skipped: true, tweetUrl: existTweet });
      }
    } catch {}

    // 3. Firestore 문서 생성/업데이트 (Aitory 외부 발행 글도 기록)
    await docRef.set({
      kbuzzUrl: url,
      kbuzzTitle: title,
      kbuzzPostId: postId,
      kbuzzPublishedAt: new Date(),
      kbuzzStatus: "published",
      keyword: keyword || "",
      category: category || "",
      metaDesc: (excerpt || "").slice(0, 150),
      source: "wordpress-webhook",
    }, { merge: true });

    // 4. X(트위터) 포스팅 (15초 타임아웃)
    let tweetUrl: string | null = null;
    let tweetError: string | null = null;
    try {
      const result = await Promise.race([
        postToTwitter({
          title,
          kbuzzUrl: url,
          keyword: keyword || "",
          category: category || "",
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Twitter timeout 15초")), 15000)),
      ]);
      tweetUrl = result.tweetUrl;
      await docRef.set({ tweetUrl, tweetError: null, tweetedAt: new Date() }, { merge: true });
      console.log("[webhook] 트위터 포스팅 성공:", tweetUrl);
    } catch (err) {
      tweetError = err instanceof Error ? err.message : String(err);
      console.error("[webhook] 트위터 포스팅 실패:", tweetError);
      await docRef.set({ tweetUrl: null, tweetError }, { merge: true }).catch(() => {});
    }

    return Response.json({
      success: true,
      postId,
      tweetUrl,
      tweetError,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[webhook] 에러:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
