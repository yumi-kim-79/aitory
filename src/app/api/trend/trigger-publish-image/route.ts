export const maxDuration = 30;

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
    console.log("[trigger-image] 백그라운드 호출:", targetUrl);

    fetch(targetUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).then(async (res) => {
      const text = await res.text();
      console.log("[trigger-image] 완료:", res.status, text.slice(0, 500));
    }).catch((err) => {
      console.error("[trigger-image] 에러:", err instanceof Error ? err.message : err);
    });

    return Response.json({
      success: true,
      message: "이미지 생성 및 발행을 백그라운드에서 시작했습니다. 2~5분 후 WordPress를 확인해주세요.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
