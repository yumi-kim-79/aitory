export const maxDuration = 30;

import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // 1. 관리자 인증
    console.log("[trigger-publish] 인증 시작");
    const decoded = await verifyToken(request);
    if (!decoded) {
      console.error("[trigger-publish] 토큰 인증 실패");
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.log("[trigger-publish] 유저:", decoded.userId);

    const userDoc = await getUserDoc(decoded.userId);
    if (!userDoc || userDoc.role !== "admin") {
      console.error("[trigger-publish] 관리자 아님:", userDoc?.role);
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 2. 내부 auto-publish를 fire-and-forget으로 호출
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[trigger-publish] CRON_SECRET 환경변수 없음");
      return Response.json({ error: "서버 설정 오류 (CRON_SECRET)" }, { status: 500 });
    }

    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://aitory.vercel.app";

    const targetUrl = `${baseUrl}/api/trend/auto-publish`;
    console.log("[trigger-publish] 백그라운드 호출:", targetUrl);

    // 응답을 기다리지 않음 (fire and forget)
    fetch(targetUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).then(async (res) => {
      const text = await res.text();
      console.log("[trigger-publish] 백그라운드 완료:", res.status, text.slice(0, 500));
    }).catch((err) => {
      console.error("[trigger-publish] 백그라운드 에러:", err instanceof Error ? err.message : err);
    });

    // 즉시 응답 반환
    return Response.json({
      success: true,
      message: "자동 발행을 백그라운드에서 시작했습니다. 1~3분 후 WordPress를 확인해주세요.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[trigger-publish] 치명적 오류:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
