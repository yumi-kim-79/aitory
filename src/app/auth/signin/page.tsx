"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function SigninPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      // redirect 방식이라 페이지가 자동 리로드됨
    } catch (err) {
      setError(err instanceof Error ? err.message : "구글 로그인 실패");
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">로그인</h1>
          <p className="text-slate-500">Aitory에 로그인하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <button onClick={handleGoogle} type="button" className="w-full py-3 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mb-4">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google로 로그인
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">또는</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 disabled:bg-slate-300 transition-colors">
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            계정이 없으신가요? <Link href="/auth/signup" className="text-blue-600 hover:text-blue-800 font-medium">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
