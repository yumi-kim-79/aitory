import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";

  // Vercel/서버 환경에서 \n이 리터럴 문자열로 들어올 수 있음
  // 실제 줄바꿈이 이미 있으면 그대로, 없으면 \n 리터럴을 줄바꿈으로 변환
  const privateKey = rawKey.includes("\n")
    ? rawKey
    : rawKey.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey && privateKey.includes("PRIVATE KEY")) {
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } catch (e) {
      console.error("Firebase Admin 초기화 실패:", e);
      initializeApp({ projectId });
    }
  } else if (projectId) {
    initializeApp({ projectId });
  } else {
    initializeApp({ projectId: "aitory-dev" });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
