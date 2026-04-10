import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();
const collectionRef = db.collection("aitory_published_keywords");

// wpUrl 있고 kbuzzStatus 없는 문서 조회
console.log("\n[1/3] 전체 문서 조회 중...");
const snap = await collectionRef.get();
console.log(`전체 문서 수: ${snap.size}`);

const targets = [];
let alreadyHasKbuzz = 0;
let noWpUrl = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  if (data.kbuzzStatus) { alreadyHasKbuzz++; continue; }
  if (!data.wpUrl) { noWpUrl++; continue; }
  targets.push({ ref: doc.ref, id: doc.id, data });
}

console.log(`✅ 이미 kbuzzStatus 있음: ${alreadyHasKbuzz}`);
console.log(`⏭️  wpUrl 없어 스킵: ${noWpUrl}`);
console.log(`🎯 업데이트 대상: ${targets.length}개`);

if (targets.length === 0) {
  console.log("\n업데이트할 문서가 없습니다.");
  process.exit(0);
}

console.log("\n[2/3] 일괄 업데이트 진행...");
let updated = 0;
let failed = 0;

for (const t of targets) {
  try {
    const update = {
      kbuzzUrl: t.data.wpUrl,
      kbuzzTitle: t.data.title || t.data.kbuzzTitle || "(제목 없음)",
      kbuzzPostId: t.data.postId ?? null,
      kbuzzPublishedAt: t.data.publishedAt || new Date(),
      kbuzzStatus: "published",
      status: "published",
    };
    await t.ref.set(update, { merge: true });
    updated++;
    if (updated % 10 === 0) console.log(`  진행: ${updated}/${targets.length}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${t.id}: ${e.message}`);
  }
}

console.log("\n[3/3] 완료");
console.log(`✅ 업데이트 성공: ${updated}`);
console.log(`❌ 업데이트 실패: ${failed}`);

// 검증
const verifySnap = await collectionRef.where("kbuzzStatus", "==", "published").get();
console.log(`\n검증: kbuzzStatus='published' 문서 수: ${verifySnap.size}`);

process.exit(0);
