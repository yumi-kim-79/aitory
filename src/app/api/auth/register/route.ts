import { verifyToken } from "@/lib/middleware";
import { ensureUserDoc } from "@/lib/auth";

export async function POST(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ error: "인증 필요" }, { status: 401 });

  const { name } = await request.json();
  await ensureUserDoc(decoded.userId, decoded.email, name);

  return Response.json({ ok: true });
}
