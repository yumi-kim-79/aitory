import { verifyToken } from "@/lib/middleware";
import { redeemCoupon } from "@/lib/coupons";

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { code } = (await request.json()) as { code: string };
    if (!code) return Response.json({ error: "코드를 입력해 주세요." }, { status: 400 });

    const result = await redeemCoupon(decoded.userId, code);
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: 400 });
    }
    return Response.json({ ok: true, credits: result.credits });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
