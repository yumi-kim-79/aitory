import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

// .env.local 파싱
const envFile = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.startsWith("#")) {
    let key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
}

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
let privateKey = env.FIREBASE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/\\n/g, "\n");

console.log("projectId:", projectId);
console.log("clientEmail:", clientEmail?.slice(0, 20) + "...");
console.log("privateKey 길이:", privateKey.length);

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();
const auth = getAuth();

const ADMIN_EMAIL = "yusung790926@gmail.com";

// Firebase Auth에서 유저 찾기
let uid;
try {
  const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
  uid = userRecord.uid;
  console.log("Firebase Auth UID:", uid);
} catch (e) {
  console.error("Firebase Auth에서 유저를 찾을 수 없음:", e.message);
  console.log("UID 없이 이메일 기반으로 검색합니다...");
}

const usersRef = db.collection("aitory_users");

if (uid) {
  // UID로 직접 문서 생성/업데이트
  const docRef = usersRef.doc(uid);
  const doc = await docRef.get();
  if (doc.exists) {
    await docRef.update({ role: "admin", plan: "pro", credits: 9999 });
    console.log("✅ 기존 문서 업데이트 완료:", uid);
  } else {
    await docRef.set({
      email: ADMIN_EMAIL,
      name: "유성Climb TV",
      role: "admin",
      plan: "pro",
      credits: 9999,
      createdAt: new Date(),
    });
    console.log("✅ 새 문서 생성 완료:", uid);
  }
} else {
  // 이메일로 검색
  const snapshot = await usersRef.where("email", "==", ADMIN_EMAIL).get();
  if (snapshot.empty) {
    const docRef = await usersRef.add({
      email: ADMIN_EMAIL,
      name: "유성Climb TV",
      role: "admin",
      plan: "pro",
      credits: 9999,
      createdAt: new Date(),
    });
    console.log("✅ 관리자 문서 생성 완료:", docRef.id);
  } else {
    for (const doc of snapshot.docs) {
      await doc.ref.update({ role: "admin", plan: "pro", credits: 9999 });
      console.log("✅ role: admin 설정 완료:", doc.id);
    }
  }
}

// 확인
const allDocs = await usersRef.get();
console.log("\naitory_users 컬렉션 문서 수:", allDocs.size);
allDocs.forEach((d) => {
  console.log(`  ${d.id}: ${JSON.stringify(d.data()).slice(0, 100)}`);
});

process.exit(0);
