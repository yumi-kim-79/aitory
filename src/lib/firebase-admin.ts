import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";

  // PRIVATE_KEY 줄바꿈 처리: 모든 케이스 대응
  // 1) Vercel에서 실제 줄바꿈으로 저장된 경우 → 그대로
  // 2) JSON 이스케이프된 \\n 리터럴 → 실제 줄바꿈으로 변환
  // 3) 쌍따옴표로 감싸진 경우 → 제거
  let privateKey = rawKey;
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  // 디버깅 (배포 후 Vercel 로그에서 확인)
  console.log("[firebase-admin] projectId:", projectId || "(없음)");
  console.log("[firebase-admin] clientEmail:", clientEmail ? clientEmail.slice(0, 15) + "..." : "(없음)");
  console.log("[firebase-admin] privateKey 길이:", privateKey.length, "PRIVATE KEY 포함:", privateKey.includes("PRIVATE KEY"));

  if (projectId && clientEmail && privateKey.includes("PRIVATE KEY")) {
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      console.log("[firebase-admin] cert 초기화 성공");
    } catch (e) {
      console.error("[firebase-admin] cert 초기화 실패:", e);
      initializeApp({ projectId });
    }
  } else {
    console.warn("[firebase-admin] 환경변수 부족, projectId만으로 초기화");
    initializeApp({ projectId: projectId || "aitory-dev" });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
