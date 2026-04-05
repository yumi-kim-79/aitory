import { adminDb } from "./firebase-admin";

export async function ensureUserDoc(userId: string, email: string, name?: string) {
  try {
    const ref = adminDb.collection("aitory_users").doc(userId);
    const doc = await ref.get();
    if (!doc.exists) {
      console.log("[auth] aitory_users 문서 생성:", userId, email);
      await ref.set({
        email,
        name: name || "",
        role: "user",
        plan: "free",
        credits: 10,
        createdAt: new Date(),
      });
      console.log("[auth] 문서 생성 완료");
    }
    return (await ref.get()).data()!;
  } catch (error) {
    console.error("[auth] ensureUserDoc 에러:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getUserDoc(userId: string) {
  const doc = await adminDb.collection("aitory_users").doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data() as { email?: string; name?: string; plan?: string; credits?: number; role?: string };
  return { id: doc.id, ...data };
}
