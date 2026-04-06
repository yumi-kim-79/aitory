import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

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

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

const user = await auth.getUserByEmail("yusung790926@gmail.com");
console.log("Firebase Auth UID:", user.uid);

const byUid = await db.collection("aitory_users").doc(user.uid).get();
console.log("uid로 조회:", byUid.exists ? JSON.stringify(byUid.data(), null, 2) : "없음");

const byEmail = await db.collection("aitory_users").where("email", "==", "yusung790926@gmail.com").get();
console.log("email로 조회:", byEmail.empty ? "없음" : byEmail.docs.map((d) => ({ id: d.id, ...d.data() })));

const all = await db.collection("aitory_users").get();
console.log("\n전체 aitory_users:", all.docs.map((d) => ({ id: d.id, ...d.data() })));

process.exit(0);
