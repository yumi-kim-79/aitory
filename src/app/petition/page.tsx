"use client";

import { useState } from "react";
import Link from "next/link";

const PETITION_TYPES = [
  { id: "일반 민원", icon: "📋", desc: "시청/구청/동사무소 등 일반 민원" },
  { id: "행정심판 청구서", icon: "⚖️", desc: "행정처분에 대한 심판 청구" },
  { id: "진정서", icon: "📨", desc: "수사기관 또는 감독기관에 제출하는 진정서" },
  { id: "탄원서", icon: "🙏", desc: "선처를 구하는 탄원서" },
  { id: "고충 민원", icon: "📢", desc: "공공기관의 부당한 처분에 대한 고충 민원" },
];

interface PetitionResult { title: string; content: string; tips: string[] }

export default function PetitionPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [petitionType, setPetitionType] = useState("");
  const [agency, setAgency] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [content, setContent] = useState("");
  const [demand, setDemand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PetitionResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) { setError("신청인 이름과 민원 내용은 필수입니다."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/petition/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petitionType, agency, applicant: { name, address, phone }, content, demand }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else { setResult(data); setStep(3); }
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex flex-col flex-1 items-center justify-center px-4"><div className="text-center"><div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" /><h2 className="text-2xl font-bold text-slate-900 mb-2">민원서류를 작성하고 있어요...</h2></div></div>;

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 민원서류 작성</h1>
          <p className="text-lg text-slate-500">민원 내용을 입력하면 공공기관 제출용 서류를 작성합니다</p>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 mb-2">민원 종류를 선택하세요</p>
            {PETITION_TYPES.map((pt) => (
              <button key={pt.id} onClick={() => { setPetitionType(pt.id); setStep(2); }} className="w-full flex items-start gap-4 p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left">
                <span className="text-3xl">{pt.icon}</span>
                <div><p className="font-semibold text-slate-900">{pt.id}</p><p className="text-sm text-slate-500 mt-0.5">{pt.desc}</p></div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
            <div className="flex items-center gap-2"><button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 text-sm">&larr; 뒤로</button><span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{petitionType}</span></div>

            <div><label className="text-sm font-medium text-slate-700 mb-1 block">제출 기관</label><input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="예: 서울특별시 강남구청" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>

            <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium text-slate-700 px-2">신청인 정보</legend>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <div className="grid grid-cols-2 gap-3">
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </fieldset>

            <div><label className="text-sm font-medium text-slate-700 mb-1 block">민원 내용 *</label><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="상황을 구체적으로 설명해주세요" className="w-full h-32 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">요청 사항</label><textarea value={demand} onChange={(e) => setDemand(e.target.value)} placeholder="원하는 처리 결과" className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button onClick={handleSubmit} disabled={!name.trim() || !content.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">민원서류 생성하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">2 크레딧</span></button>
          </div>
        )}

        {step === 3 && result && (
          <div>
            {result.tips?.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm font-medium text-blue-800 mb-2">제출 시 참고사항</p>
                <ul className="text-xs text-blue-700 space-y-1">{result.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">{result.title}</h2>
                <button onClick={async () => { await navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">{copied ? "복사됨!" : "복사하기"}</button>
              </div>
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto">{result.content}</div>
            </div>
            <button onClick={() => { setStep(1); setResult(null); }} className="w-full mt-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">새 민원서류 작성</button>
          </div>
        )}
      </div>
    </div>
  );
}
