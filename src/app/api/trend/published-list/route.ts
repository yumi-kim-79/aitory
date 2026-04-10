import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export const maxDuration = 30;

interface PublishedItem {
  id: string;
  keyword: string;
  category: string;
  kbuzzTitle: string;
  kbuzzUrl: string;
  kbuzzPostId?: number;
  kbuzzPublishedAt: string;
  metaDesc?: string;
}

export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  try {
    const snap = await adminDb
      .collection("aitory_published_keywords")
      .where("kbuzzStatus", "==", "published")
      .orderBy("kbuzzPublishedAt", "desc")
      .limit(20)
      .get();

    const items: PublishedItem[] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.kbuzzUrl || !data.kbuzzTitle) continue;
      const ts = data.kbuzzPublishedAt;
      const publishedAt = ts?.toDate?.()?.toISOString?.() ?? (typeof ts === "string" ? ts : "");
      items.push({
        id: doc.id,
        keyword: (data.keyword as string) || "",
        category: (data.category as string) || "",
        kbuzzTitle: data.kbuzzTitle as string,
        kbuzzUrl: data.kbuzzUrl as string,
        kbuzzPostId: data.kbuzzPostId as number | undefined,
        kbuzzPublishedAt: publishedAt,
        metaDesc: (data.metaDesc as string) || "",
      });
    }

    return NextResponse.json({ success: true, items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[published-list] 에러:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
