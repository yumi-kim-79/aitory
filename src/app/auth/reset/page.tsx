"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // 존재하지 않는 이메일도 보안상 성공처럼 안내
      if (msg.includes("user-not-found") || msg.includes("invalid-email")) {
        setSent(true);
      } else {
        setError("메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">비밀번호 찾기</h1>
          <p className="text-slate-500">가입한 이메일로 재설정 링크를 보내드립니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p className="text-slate-700 font-medium mb-1">메일을 보냈습니다</p>
              <p className="text-sm text-slate-500 mb-6">
                <b className="text-slate-700">{email}</b> 로 재설정 링크를 보냈어요.<br />
                메일함(스팸함 포함)을 확인해 주세요.
              </p>
              <Link href="/auth/signin" className="inline-block py-3 px-6 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="가입한 이메일"
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 disabled:bg-slate-300 transition-colors">
                  {loading ? "발송 중..." : "재설정 링크 받기"}
                </button>
              </form>
              <p className="text-center text-sm text-slate-500 mt-4">
                <Link href="/auth/signin" className="text-blue-600 hover:text-blue-800 font-medium">로그인으로 돌아가기</Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          구글로 가입한 계정은 비밀번호가 없습니다. 구글 로그인을 이용해 주세요.
        </p>
      </div>
    </div>
  );
}
