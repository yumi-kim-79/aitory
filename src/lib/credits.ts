import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function checkCredits(userId: string, amount: number): Promise<boolean> {
  const doc = await adminDb.collection("aitory_users").doc(userId).get();
  return (doc.data()?.credits || 0) >= amount;
}

export async function useCredits(
  userId: string,
  amount: number,
  service: string,
): Promise<boolean> {
  const userRef = adminDb.collection("aitory_users").doc(userId);

  return adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(userRef);
    const credits = doc.data()?.credits || 0;
    if (credits < amount) return false;

    tx.update(userRef, { credits: FieldValue.increment(-amount) });
    tx.create(adminDb.collection("aitory_usage_logs").doc(), {
      userId,
      service,
      credits: amount,
      createdAt: new Date(),
    });

    return true;
  });
}

export async function addCredits(userId: string, amount: number): Promise<void> {
  await adminDb
    .collection("aitory_users")
    .doc(userId)
    .update({ credits: FieldValue.increment(amount) });
}

export async function getUsageLogs(userId: string, limit = 50) {
  const snap = await adminDb
    .collection("aitory_usage_logs")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
