import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // 관리자 권한 체크
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "인증 필요" }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (userDoc?.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const { title, content, category, tags, excerpt, status } = (await request.json()) as {
      title: string;
      content: string;
      category: string;
      tags: string[];
      excerpt: string;
      status: "draft" | "publish";
    };

    const wpUrl = process.env.WP_SITE_URL;
    const wpUser = process.env.WP_USERNAME;
    const wpPass = process.env.WP_APP_PASSWORD;

    if (!wpUrl || !wpUser || !wpPass) {
      return Response.json({ error: "WordPress 연동 설정이 필요합니다." }, { status: 500 });
    }

    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title,
        content,
        status: status || "draft",
        excerpt,
        tags: tags || [],
      }),
    });

    if (!wpRes.ok) {
      const errText = await wpRes.text();
      console.error("[wp] 포스팅 실패:", wpRes.status, errText);
      return Response.json({ error: `WordPress 포스팅 실패: ${wpRes.status}` }, { status: 502 });
    }

    const wpData = await wpRes.json();
    return Response.json({
      ok: true,
      postId: wpData.id,
      postUrl: wpData.link,
      status: wpData.status,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
