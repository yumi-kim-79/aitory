export const maxDuration = 300;

import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // 관리자 인증
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (userDoc?.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 서버에서 CRON_SECRET으로 auto-publish 내부 호출
    const cronSecret = process.env.CRON_SECRET;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://aitory.vercel.app";

    const res = await fetch(`${baseUrl}/api/trend/auto-publish`, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      signal: AbortSignal.timeout(280000),
    });

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
