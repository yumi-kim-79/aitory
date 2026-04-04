"use client";

import { useState } from "react";
import Link from "next/link";

const DOC_TYPES = [
  { id: "내용증명", icon: "📨", desc: "상대방에게 법적 의사를 전달하는 공식 문서" },
  { id: "계약해지 통보서", icon: "📤", desc: "계약을 해지할 때 상대방에게 보내는 통보서" },
  { id: "환불/손해배상 요청서", icon: "💰", desc: "환불이나 손해배상을 요청하는 문서" },
  { id: "임금체불 내용증명", icon: "💼", desc: "체불 임금 지급을 요구하는 내용증명" },
  { id: "부동산 계약 해지 통보", icon: "🏠", desc: "임대차/매매 계약 해지를 통보하는 문서" },
];

interface LegalResult {
  title: string;
  content: string;
  warnings: string[];
}

export default function LegalPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [docType, setDocType] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [incident, setIncident] = useState("");
  const [demand, setDemand] = useState("");
  const [deadline, setDeadline] = useState("서면 수령 후 7일 이내");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LegalResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!senderName.trim() || !incident.trim()) {
      setError("발신인 이름과 사건 개요는 필수입니다.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/legal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          sender: { name: senderName, address: senderAddress, phone: senderPhone },
          receiver: { name: receiverName, address: receiverAddress },
          incident,
          demand,
          deadline,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else { setResult(data); setStep(3); }
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">법률 문서를 작성하고 있어요...</h2>
          <p className="text-slate-500">AI가 법률 문서 형식에 맞게 작성합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 내용증명/법률 문서</h1>
          <p className="text-lg text-slate-500">실생활에서 필요한 법률 문서를 AI가 작성합니다</p>
        </div>

        {/* Step 1: 문서 종류 선택 */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 mb-2">문서 종류를 선택하세요</p>
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { setDocType(dt.id); setStep(2); }}
                className="w-full flex items-start gap-4 p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left"
              >
                <span className="text-3xl">{dt.icon}</span>
                <div>
                  <p className="font-semibold text-slate-900">{dt.id}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{dt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: 정보 입력 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 text-sm">&larr; 뒤로</button>
              <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{docType}</span>
            </div>

            <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium text-slate-700 px-2">발신인 (나)</legend>
              <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <div className="grid grid-cols-2 gap-3">
                <input value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium text-slate-700 px-2">수신인 (상대방)</legend>
              <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="이름 또는 회사명" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} placeholder="주소" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </fieldset>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">사건 개요 *</label>
              <textarea value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="어떤 일이 있었는지 구체적으로 설명해주세요&#10;(날짜, 상황, 피해 내용 등)" className="w-full h-32 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">요구사항</label>
              <textarea value={demand} onChange={(e) => setDemand(e.target.value)} placeholder="상대방에게 원하는 것 (예: 환불, 임금 지급, 계약 이행 등)" className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">처리 기한</label>
              <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="서면 수령 후 7일 이내" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button onClick={handleSubmit} disabled={!senderName.trim() || !incident.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              문서 생성하기
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span>
            </button>
          </div>
        )}

        {/* Step 3: 결과 */}
        {step === 3 && result && (
          <div>
            {/* 주의사항 */}
            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm font-medium text-amber-800 mb-2">법적 주의사항</p>
              <ul className="text-xs text-amber-700 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
                <li>• 본 문서는 AI가 생성한 참고용이며, 법적 효력을 위해 변호사 검토를 권장합니다.</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">{result.title}</h2>
                <button onClick={handleCopy} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
                  {copied ? "복사됨!" : "복사하기"}
                </button>
              </div>
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto font-mono">
                {result.content}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setStep(1); setResult(null); }} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">
                새 문서 작성
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
