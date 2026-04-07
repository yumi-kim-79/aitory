export const maxDuration = 300;

import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (!userDoc || userDoc.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return Response.json({ error: "서버 설정 오류 (CRON_SECRET)" }, { status: 500 });

    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://aitory.vercel.app";

    const targetUrl = `${baseUrl}/api/trend/auto-publish-image`;
    console.log("[trigger-image] 직접 호출:", targetUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240000);

    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    console.log("[trigger-image] 응답:", res.status, text.slice(0, 500));

    let data;
    try { data = JSON.parse(text); }
    catch { return Response.json({ error: `응답 파싱 실패: ${text.slice(0, 200)}` }, { status: 502 }); }

    return Response.json(data, { status: res.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[trigger-image] 오류:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
