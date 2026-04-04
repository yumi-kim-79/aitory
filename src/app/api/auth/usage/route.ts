import { verifyToken } from "@/lib/middleware";
import { getUsageLogs } from "@/lib/credits";

export async function GET(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ logs: [] });
  const logs = await getUsageLogs(decoded.userId);
  return Response.json({ logs });
}
