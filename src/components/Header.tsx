"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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
    <header className="sticky top-0 z-50 border-b border-[rgba(138,153,173,0.14)] bg-[#0a0e14]/72 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-[#eef4fb]" style={{ fontFamily: "var(--font-display)" }}>
          <span className="inline-flex w-6 h-6 rounded-md bg-[#22d3ee] items-center justify-center text-[#04141a] text-[13px] font-extrabold">A</span>
          Aitory
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm text-[#8a99ad] hover:text-[#eef4fb] transition-colors">
            요금제
          </Link>
          <a href="https://appmonster.co.kr" className="inline-flex items-center gap-1 text-sm text-[#8a99ad] hover:text-[#eef4fb] border border-[rgba(138,153,173,0.20)] hover:border-[rgba(34,211,238,0.45)] rounded-lg px-2.5 py-1.5 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            <span>앱몬스터</span>
          </a>

          {loading ? (
            <div className="w-20 h-8 bg-[#1a2333] rounded-lg animate-pulse" />
          ) : user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1a2333] rounded-lg hover:bg-[#223047] transition-colors"
              >
                <span className="text-sm font-medium text-[#eef4fb]">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="text-xs bg-[rgba(34,211,238,0.16)] text-[#67e8f9] px-1.5 py-0.5 rounded font-semibold">
                  {user.credits}
                </span>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 bg-[#131b28] rounded-xl shadow-lg border border-[rgba(138,153,173,0.18)] py-2 z-50">
                  <div className="px-4 py-2 border-b border-[rgba(138,153,173,0.14)]">
                    <p className="text-xs text-[#56657a]">{user.email}</p>
                    <p className="text-xs text-[#8a99ad] mt-0.5">
                      {user.plan === "free" ? "무료" : user.plan === "starter" ? "스타터" : "PRO"} · 크레딧 {user.credits}
                    </p>
                  </div>
                  <Link href="/mypage" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-[#eef4fb] hover:bg-[#1a2333]">마이페이지</Link>
                  <Link href="/pricing" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-[#eef4fb] hover:bg-[#1a2333]">요금제</Link>
                  {user.role === "admin" && (
                    <Link href="/admin/coupons" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-[#67e8f9] hover:bg-[#1a2333]">이용권 코드 발급</Link>
                  )}
                  <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">로그아웃</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/signin" className="text-sm text-[#8a99ad] hover:text-[#eef4fb] font-medium">로그인</Link>
              <Link href="/auth/signup" className="text-sm bg-[#22d3ee] text-[#04141a] px-4 py-1.5 rounded-lg font-semibold hover:bg-[#67e8f9] transition-colors">회원가입</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
