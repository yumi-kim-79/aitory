"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

interface Log {
  id: string;
  service: string;
  credits: number;
  createdAt: string | { _seconds: number };
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading, getIdToken, refreshUser } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

  // 이용권 등록 상태
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
      return;
    }
    if (user) {
      getIdToken().then((token) => {
        if (!token) return;
        fetch("/api/auth/usage", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => setLogs(d.logs || []))
          .catch(() => {});
      });
    }
  }, [user, loading, router, getIdToken]);

  async function handleRedeem() {
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemMsg({ type: "err", text: data.error || "등록에 실패했습니다." });
      } else {
        setRedeemMsg({ type: "ok", text: `크레딧 ${data.credits}회가 충전되었습니다!` });
        setCode("");
        refreshUser();
      }
    } catch {
      setRedeemMsg({ type: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setRedeeming(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  const planLabel = user.plan === "free" ? "무료 체험" : user.plan === "starter" ? "스타터" : "PRO";

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">마이페이지</h1>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{user.name || "사용자"}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl text-center">
              <p className="text-xs text-slate-500 mb-1">플랜</p>
              <p className="font-bold text-slate-900">{planLabel}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl text-center">
              <p className="text-xs text-slate-500 mb-1">남은 크레딧</p>
              <p className="font-bold text-slate-900 text-2xl">{user.credits}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl text-center">
              <p className="text-xs text-slate-500 mb-1">이번달 사용</p>
              <p className="font-bold text-slate-900">{logs.length}회</p>
            </div>
          </div>

          <Link href="/pricing" className="block w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-medium text-center hover:bg-blue-700 transition-colors">
            플랜 업그레이드
          </Link>
        </div>

        {/* 이용권 등록 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">이용권 등록</h2>
          <p className="text-sm text-slate-500 mb-4">구매하신 이용권 코드를 입력하면 크레딧이 바로 충전됩니다.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              placeholder="AITORY-XXXX-XXXX"
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl font-mono tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !code.trim()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              {redeeming ? "확인 중..." : "등록"}
            </button>
          </div>
          {redeemMsg && (
            <p className={`mt-3 text-sm font-medium ${redeemMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {redeemMsg.text}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">크레딧 사용 이력</h2>
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">사용 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const dateStr = typeof log.createdAt === "string"
                  ? new Date(log.createdAt).toLocaleDateString("ko-KR")
                  : new Date((log.createdAt as { _seconds: number })._seconds * 1000).toLocaleDateString("ko-KR");
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{log.service}</p>
                      <p className="text-xs text-slate-400">{dateStr}</p>
                    </div>
                    <span className="text-sm font-medium text-red-600">-{log.credits}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
