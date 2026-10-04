"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface Coupon {
  code: string;
  credits: number;
  batch: string;
  note: string;
  used: boolean;
  usedBy: string | null;
}

export default function AdminCouponsPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();

  const [count, setCount] = useState(10);
  const [credits, setCredits] = useState(100);
  const [batch, setBatch] = useState("");
  const [note, setNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading, router]);

  async function loadCoupons() {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch("/api/admin/coupons", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) setCoupons(data.coupons || []);
  }

  useEffect(() => {
    if (user?.role === "admin") loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setMsg("");
    setNewCodes([]);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ count, credits, batch, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "발급 실패");
      } else {
        setNewCodes(data.codes || []);
        setMsg(`${data.codes.length}개 발급 완료`);
        loadCoupons();
      }
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setGenerating(false);
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(newCodes.join("\n"));
    setMsg("클립보드에 복사했습니다.");
  }

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const usedCount = coupons.filter((c) => c.used).length;

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">이용권 코드 관리</h1>
        <p className="text-sm text-slate-500 mb-8">발급 {coupons.length}개 · 사용됨 {usedCount}개 · 미사용 {coupons.length - usedCount}개</p>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">코드 발급</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">발급 수량</span>
              <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">코드당 크레딧(회)</span>
              <input type="number" min={1} value={credits} onChange={(e) => setCredits(+e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">배치명(선택)</span>
              <input type="text" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="예: 스마트스토어 9900원"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">메모(선택)</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </label>
          </div>
          <button onClick={generate} disabled={generating}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-40">
            {generating ? "발급 중..." : "코드 발급"}
          </button>
          {msg && <span className="ml-3 text-sm text-slate-600">{msg}</span>}

          {newCodes.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">발급된 코드</span>
                <button onClick={copyAll} className="text-sm text-blue-600 hover:underline">전체 복사</button>
              </div>
              <textarea readOnly value={newCodes.join("\n")} rows={Math.min(newCodes.length, 12)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm bg-slate-50" />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">발급 현황 (최근 200개)</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {coupons.map((c) => (
              <div key={c.code} className="flex items-center justify-between p-2 text-sm border-b border-slate-100">
                <span className="font-mono">{c.code}</span>
                <span className="text-slate-400">{c.credits}회 · {c.batch || "-"}</span>
                <span className={c.used ? "text-red-500" : "text-green-600"}>{c.used ? "사용됨" : "미사용"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
