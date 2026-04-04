"use client";

import { useState } from "react";
import Link from "next/link";

const PLATFORMS = ["쿠팡", "네이버스마트스토어", "11번가", "옥션", "G마켓", "자사몰"];
const INQUIRY_TYPES = ["배송지연", "환불", "교환", "상품불량", "단순문의", "악성리뷰"];
const TONES = ["정중한", "친근한", "공식적인"];

interface CsResult { reply: string; tips: string[] }

export default function CsPage() {
  const [platform, setPlatform] = useState("쿠팡");
  const [inquiryType, setInquiryType] = useState("배송지연");
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("정중한");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CsResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) { setError("고객 문의 내용을 입력해주세요."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/cs/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, inquiryType, content, tone }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else setResult(data);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex flex-col flex-1 items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">CS 답변을 생성하고 있어요...</h2>
        <p className="text-slate-500">AI가 플랫폼에 맞는 답변을 작성합니다</p>
      </div>
    </div>
  );

  if (result) return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">CS 답변</h1>
          <button onClick={() => setResult(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">다시 생성</button>
        </div>

        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{platform}</span>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">{inquiryType}</span>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">{tone}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex justify-end mb-4">
            <button onClick={async () => { await navigator.clipboard.writeText(result.reply); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">{copied ? "복사됨!" : "답변 복사"}</button>
          </div>
          <div className="p-5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{result.reply}</div>
        </div>

        {result.tips?.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-2">답변 팁</p>
            <ul className="text-xs text-blue-700 space-y-1">{result.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
          </div>
        )}

        <button onClick={() => { setResult(null); handleSubmit(); }} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
          다른 버전으로 재생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">2 크레딧</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 쇼핑몰 CS 답변</h1>
          <p className="text-lg text-slate-500">고객 문의에 대한 전문적인 답변을 자동 생성합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">판매 플랫폼</p>
            <div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => (
              <button key={p} onClick={() => setPlatform(p)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${platform === p ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{p}</button>
            ))}</div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">문의 유형</p>
            <div className="flex flex-wrap gap-2">{INQUIRY_TYPES.map((t) => (
              <button key={t} onClick={() => setInquiryType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inquiryType === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
            ))}</div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">고객 문의 내용 *</p>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="고객이 보낸 문의 내용을 붙여넣으세요&#10;&#10;예: 주문한지 일주일인데 아직 배송이 안 왔어요. 언제 오나요?" className="w-full h-36 p-4 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">답변 톤</p>
            <div className="flex gap-2">{TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tone === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
            ))}</div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!content.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            CS 답변 생성하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">2 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}
