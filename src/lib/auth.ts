import { adminDb } from "./firebase-admin";

export async function ensureUserDoc(userId: string, email: string, name?: string) {
  const ref = adminDb.collection("aitory_users").doc(userId);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({
      email,
      name: name || "",
      plan: "free",
      credits: 10,
      createdAt: new Date(),
    });
  }
  return (await ref.get()).data()!;
}

export async function getUserDoc(userId: string) {
  const doc = await adminDb.collection("aitory_users").doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data() as { email?: string; name?: string; plan?: string; credits?: number; role?: string };
  return { id: doc.id, ...data };
}
