import { verifyToken } from "@/lib/middleware";
import { useCredits, checkCredits } from "@/lib/credits";

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { amount, service } = (await request.json()) as { amount: number; service: string };
    if (!amount || amount < 1) return Response.json({ error: "잘못된 크레딧 수" }, { status: 400 });

    const hasCredits = await checkCredits(decoded.userId, amount);
    if (!hasCredits) return Response.json({ error: "크레딧이 부족합니다." }, { status: 402 });

    const ok = await useCredits(decoded.userId, amount, service || "트렌드");
    if (!ok) return Response.json({ error: "크레딧 차감 실패" }, { status: 500 });

    return Response.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
