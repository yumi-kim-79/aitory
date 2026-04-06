import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "인증 필요" }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (userDoc?.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const { title, content, excerpt, slug, status } = (await request.json()) as {
      title: string;
      content: string;
      excerpt: string;
      slug?: string;
      status: "draft" | "publish";
    };

    const wpUrl = process.env.WP_SITE_URL;
    const wpUser = process.env.WP_USERNAME;
    const wpPass = process.env.WP_APP_PASSWORD;

    if (!wpUrl || !wpUser || !wpPass) {
      return Response.json({ error: "WordPress 연동 설정 부족" }, { status: 500 });
    }

    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

    // 마크다운 잔여물 → HTML 변환
    let htmlContent = content
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      .replace(/<\/ul>\s*<ul>/g, "");

    // 단락 감싸기 (이미 <h2>, <p> 등이 있으면 스킵)
    if (!htmlContent.includes("<p>") && !htmlContent.includes("<h2>")) {
      htmlContent = htmlContent.split("\n\n").map((p) => `<p>${p.trim()}</p>`).join("\n");
    }

    console.log("[wp] 포스팅:", { title: title?.slice(0, 30), slug, status, contentLen: htmlContent.length });

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title,
        content: htmlContent,
        status: status || "draft",
        excerpt: excerpt || "",
        ...(slug ? { slug } : {}),
      }),
      signal: AbortSignal.timeout(25000),
    });

    const responseText = await wpRes.text();
    console.log("[wp] 응답:", wpRes.status, responseText.slice(0, 300));

    if (!wpRes.ok) {
      return Response.json({
        error: `WordPress 포스팅 실패 (${wpRes.status}): ${responseText.slice(0, 200)}`,
      }, { status: 502 });
    }

    let wpData;
    try { wpData = JSON.parse(responseText); }
    catch { return Response.json({ error: "WordPress 응답 파싱 실패" }, { status: 502 }); }

    return Response.json({
      ok: true,
      postId: wpData.id,
      postUrl: wpData.link,
      status: wpData.status,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[wp] 에러:", msg);
    return Response.json({ error: `포스팅 에러: ${msg}` }, { status: 500 });
  }
}
