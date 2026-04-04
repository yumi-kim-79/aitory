"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Log {
  id: string;
  service: string;
  credits: number;
  createdAt: string | { _seconds: number };
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

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
