"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    router.push("/");
  };

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-slate-900">
          Aitory
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-800">
            요금제
          </Link>

          {loading ? (
            <div className="w-20 h-8 bg-slate-100 rounded-lg animate-pulse" />
          ) : user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <span className="text-sm font-medium text-slate-700">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  {user.credits}
                </span>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {user.plan === "free" ? "무료" : user.plan === "starter" ? "스타터" : "PRO"} · 크레딧 {user.credits}
                    </p>
                  </div>
                  <Link href="/mypage" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">마이페이지</Link>
                  <Link href="/pricing" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">요금제</Link>
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">로그아웃</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/signin" className="text-sm text-slate-600 hover:text-slate-900 font-medium">로그인</Link>
              <Link href="/auth/signup" className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-slate-800">회원가입</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
