"use client";

import { useState } from "react";
import Link from "next/link";

const CONTRACT_TYPES = ["매매", "전세", "월세"];
const STATUS_STYLE = { danger: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500 text-white", text: "text-red-800", label: "위험" }, warning: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500 text-white", text: "text-amber-800", label: "주의" }, safe: { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-500 text-white", text: "text-emerald-800", label: "안전" } };

interface CheckItem { item: string; status: "danger" | "warning" | "safe"; detail: string; action: string }
interface CheckResult { summary: string; riskScore: number; checklist: CheckItem[] }

export default function RealEstateCheckPage() {
  const [contractType, setContractType] = useState("전세");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) { setError("계약서 내용을 입력해주세요."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/realestate/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractType, text }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "분석 실패");
      else setResult(data);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex flex-col flex-1 items-center justify-center px-4"><div className="text-center"><div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" /><h2 className="text-2xl font-bold text-slate-900 mb-2">계약서를 분석하고 있어요...</h2></div></div>;

  if (result) {
    const scoreColor = result.riskScore >= 70 ? "text-red-500 border-red-500" : result.riskScore >= 40 ? "text-amber-500 border-amber-500" : "text-emerald-500 border-emerald-500";
    return (
      <div className="flex flex-col flex-1 items-center px-4 py-12">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-slate-900">부동산 계약서 체크리스트</h1>
            <button onClick={() => setResult(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">다시 분석</button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-full border-4 ${scoreColor} flex items-center justify-center shrink-0`}>
                <span className={`text-2xl font-bold ${scoreColor.split(" ")[0]}`}>{result.riskScore}</span>
              </div>
              <div><h2 className="text-lg font-semibold text-slate-900 mb-1">위험도 점수</h2><p className="text-sm text-slate-600">{result.summary}</p></div>
            </div>
          </div>

          <div className="space-y-3">
            {result.checklist.map((c, i) => {
              const s = STATUS_STYLE[c.status];
              return (
                <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-5`}>
                  <div className="flex items-start gap-3 mb-2">
                    <span className={`${s.badge} px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0`}>{s.label}</span>
                    <p className={`${s.text} font-medium`}>{c.item}</p>
                  </div>
                  <p className="text-slate-600 text-sm ml-14">{c.detail}</p>
                  {c.action && <p className="text-sm text-blue-600 font-medium ml-14 mt-1">{c.action}</p>}
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
            <p className="text-xs text-amber-700">본 분석은 AI 참고용이며, 실제 거래 시 공인중개사/변호사 확인을 권장합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/realestate" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 부동산 공고문으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">부동산 계약서 체크리스트</h1>
          <p className="text-lg text-slate-500">부동산 계약서의 위험 요소를 AI가 체크합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">계약 유형</p>
            <div className="flex gap-2">{CONTRACT_TYPES.map((t) => (
              <button key={t} onClick={() => setContractType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${contractType === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
            ))}</div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">계약서 내용 *</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="계약서 내용을 붙여넣으세요..." className="w-full h-48 p-4 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!text.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            체크리스트 생성<span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}
