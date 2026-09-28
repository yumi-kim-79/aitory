import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";
import { createCoupons, listCoupons } from "@/lib/coupons";

async function requireAdmin(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return { error: "로그인이 필요합니다.", status: 401 as const };
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== "admin") {
    return { error: "관리자 권한이 필요합니다.", status: 403 as const };
  }
  return { decoded };
}

// 발급 현황 조회
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const coupons = await listCoupons(200);
  return Response.json({ coupons });
}

// 이용권 코드 발급
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { count, credits, batch, note } = (await request.json()) as {
    count: number;
    credits: number;
    batch?: string;
    note?: string;
  };
  if (!count || count < 1 || count > 500) {
    return Response.json({ error: "발급 수량은 1~500개 사이여야 합니다." }, { status: 400 });
  }
  if (!credits || credits < 1) {
    return Response.json({ error: "크레딧 수를 입력해 주세요." }, { status: 400 });
  }

  const codes = await createCoupons({
    count,
    credits,
    batch,
    note,
    createdBy: auth.decoded.userId,
  });
  return Response.json({ ok: true, codes });
}
