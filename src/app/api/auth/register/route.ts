import { verifyToken } from "@/lib/middleware";
import { ensureUserDoc } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) {
      return Response.json({ error: "인증 토큰 검증 실패" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body as { name?: string }).name || "";
    await ensureUserDoc(decoded.userId, decoded.email, name);

    return Response.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("register 오류:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
