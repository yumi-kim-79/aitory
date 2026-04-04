import { verifyToken } from "@/lib/middleware";
import { getUserDoc, ensureUserDoc } from "@/lib/auth";

export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ user: null });

  const data = await getUserDoc(decoded.userId);
  if (!data) return Response.json({ user: null });

  return Response.json({
    user: {
      id: decoded.userId,
      email: data.email || decoded.email,
      name: data.name || "",
      plan: data.plan || "free",
      credits: data.credits ?? 10,
    },
  });
}
