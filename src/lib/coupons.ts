import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const COL = "aitory_coupons";

// 코드 정규화: 공백/소문자 제거, 대문자 통일
export function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

// 랜덤 코드 생성 (혼동되는 문자 O,0,I,1,L 제외)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomBlock(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

// 이용권 코드 발급 (관리자) — 예: AITORY-XXXX-XXXX
export async function createCoupons(opts: {
  count: number;
  credits: number;
  batch?: string;
  note?: string;
  createdBy: string;
}): Promise<string[]> {
  const { count, credits, batch = "", note = "", createdBy } = opts;
  const codes: string[] = [];
  const writer = adminDb.bulkWriter();

  for (let i = 0; i < count; i++) {
    const code = `AITORY-${randomBlock(4)}-${randomBlock(4)}`;
    codes.push(code);
    writer.create(adminDb.collection(COL).doc(code), {
      code,
      credits,
      batch,
      note,
      used: false,
      usedBy: null,
      usedAt: null,
      createdBy,
      createdAt: new Date(),
    });
  }
  await writer.close();
  return codes;
}

export type RedeemResult =
  | { ok: true; credits: number }
  | { ok: false; reason: "not_found" | "already_used"; message: string };

// 이용권 사용 (사용자) — 트랜잭션으로 중복 사용 방지 + 크레딧 충전
export async function redeemCoupon(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "not_found", message: "코드를 입력해 주세요." };

  const couponRef = adminDb.collection(COL).doc(code);
  const userRef = adminDb.collection("aitory_users").doc(userId);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(couponRef);
    if (!snap.exists) {
      return { ok: false as const, reason: "not_found" as const, message: "존재하지 않는 코드입니다." };
    }
    const data = snap.data()!;
    if (data.used) {
      return { ok: false as const, reason: "already_used" as const, message: "이미 사용된 코드입니다." };
    }
    const credits = data.credits || 0;

    tx.update(couponRef, {
      used: true,
      usedBy: userId,
      usedAt: new Date(),
    });
    tx.update(userRef, { credits: FieldValue.increment(credits) });

    return { ok: true as const, credits };
  });
}

// 발급/사용 현황 (관리자)
export async function listCoupons(limit = 100) {
  const snap = await adminDb
    .collection(COL)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      code: d.id,
      credits: x.credits,
      batch: x.batch || "",
      note: x.note || "",
      used: !!x.used,
      usedBy: x.usedBy || null,
    };
  });
}
