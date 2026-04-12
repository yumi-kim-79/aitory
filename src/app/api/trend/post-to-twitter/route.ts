import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { postToTwitter } from "@/lib/twitter";

export const maxDuration = 30;

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

    // 중복 포스팅 방지: tweetUrl 이미 있으면 스킵
    if (firestoreDocId) {
      try {
        const doc = await adminDb.collection("aitory_published_keywords").doc(firestoreDocId).get();
        const existing = doc.data()?.tweetUrl;
        if (existing && typeof existing === "string" && existing.startsWith("http")) {
          console.log("[Twitter] 이미 포스팅됨, 스킵:", existing);
          return Response.json({ success: true, tweetUrl: existing, skipped: true });
        }
      } catch {}
    }

    const { tweetId, tweetUrl } = await postToTwitter({
      title, kbuzzUrl,
      keyword: keyword || "",
      category: category || "",
      metaDesc: metaDesc || "",
    });

    // Firestore 업데이트
    if (firestoreDocId) {
      try {
        await adminDb.collection("aitory_published_keywords").doc(firestoreDocId).set({
          tweetUrl, tweetError: null, tweetedAt: new Date(),
        }, { merge: true });
      } catch (fsErr) {
        console.error("[Twitter] Firestore 업데이트 실패:", fsErr instanceof Error ? fsErr.message : fsErr);
      }
    }

    return Response.json({ success: true, tweetId, tweetUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[Twitter] 포스팅 실패:", msg);
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
