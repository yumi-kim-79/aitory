import { verifyToken } from "@/lib/middleware";
import { getUserDoc, ensureUserDoc } from "@/lib/auth";

export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ user: null });

  let data = await getUserDoc(decoded.userId);
  if (!data) {
    // 유저 문서가 없으면 자동 생성 (구글 로그인 시 name도 전달)
    await ensureUserDoc(decoded.userId, decoded.email, decoded.name);
    data = await getUserDoc(decoded.userId);
    if (!data) return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: decoded.userId,
      email: data.email || decoded.email,
      name: data.name || decoded.name || "",
      plan: data.plan || "free",
      credits: data.credits ?? 10,
      role: data.role || "user",
    },
  });
}
