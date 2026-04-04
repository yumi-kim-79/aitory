import { adminAuth } from "./firebase-admin";

export async function verifyToken(
  request: Request,
): Promise<{ userId: string; email: string; name: string } | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      userId: decoded.uid,
      email: decoded.email || "",
      name: decoded.name || "",
    };
  } catch (error) {
    console.error("verifyToken 실패:", error instanceof Error ? error.message : error);
    return null;
  }
}
