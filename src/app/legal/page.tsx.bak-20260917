"use client";

import { useState } from "react";
import Link from "next/link";

type MainTab = "document" | "consult";

// ── 문서 생성 관련 ──

const DOC_TYPES = [
  { id: "내용증명", icon: "📨", desc: "상대방에게 법적 의사를 전달하는 공식 문서" },
  { id: "계약해지 통보서", icon: "📤", desc: "계약을 해지할 때 상대방에게 보내는 통보서" },
  { id: "환불/손해배상 요청서", icon: "💰", desc: "환불이나 손해배상을 요청하는 문서" },
  { id: "임금체불 내용증명", icon: "💼", desc: "체불 임금 지급을 요구하는 내용증명" },
  { id: "부동산 계약 해지 통보", icon: "🏠", desc: "임대차/매매 계약 해지를 통보하는 문서" },
];

interface DocResult { title: string; content: string; warnings: string[] }

// ── 상담 관련 ──

const CONSULT_TYPES = ["근로", "계약", "부동산", "소비자", "형사", "가족", "기타"];
const DIRECTIONS = ["대응 방법", "법적 근거", "문서 필요 여부"];

interface ConsultResult {
  summary: string;
  legalBasis: string[];
  steps: string[];
  recommendedDocs: string[];
  disclaimer: string;
}

const DISCLAIMER = "본 서비스는 AI가 제공하는 법률 정보로, 법적 효력이 없으며 실제 법적 문제는 반드시 변호사와 상담하시기 바랍니다.";

export default function LegalPage() {
  const [mainTab, setMainTab] = useState<MainTab>("document");

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 법률 문서 + 상담</h1>
          <p className="text-lg text-slate-500">법률 문서 자동 작성 및 AI 법률 상담</p>
        </div>

        {/* 메인 탭 */}
        <div className="flex gap-2 mb-8">
          <button onClick={() => setMainTab("document")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${mainTab === "document" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            법률 문서 생성
          </button>
          <button onClick={() => setMainTab("consult")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${mainTab === "consult" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            AI 법률 상담
          </button>
        </div>

        {mainTab === "document" ? <DocumentTab /> : <ConsultTab />}

        {/* 면책 조항 */}
        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <p className="text-xs text-slate-400">{DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}

// ── 문서 생성 탭 ──

function DocumentTab() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [docType, setDocType] = useState("");
  const [sName, setSName] = useState("");
  const [sAddr, setSAddr] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [rName, setRName] = useState("");
  const [rAddr, setRAddr] = useState("");
  const [incident, setIncident] = useState("");
  const [demand, setDemand] = useState("");
  const [deadline, setDeadline] = useState("서면 수령 후 7일 이내");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DocResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!sName.trim() || !incident.trim()) { setError("발신인 이름과 사건 개요는 필수입니다."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/legal/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType, sender: { name: sName, address: sAddr, phone: sPhone }, receiver: { name: rName, address: rAddr }, incident, demand, deadline }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else { setResult(data); setStep(3); }
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return <Spinner text="법률 문서를 작성하고 있어요..." />;

  if (step === 1) return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700 mb-2">문서 종류를 선택하세요</p>
      {DOC_TYPES.map((dt) => (
        <button key={dt.id} onClick={() => { setDocType(dt.id); setStep(2); }} className="w-full flex items-start gap-4 p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all text-left">
          <span className="text-3xl">{dt.icon}</span>
          <div><p className="font-semibold text-slate-900">{dt.id}</p><p className="text-sm text-slate-500 mt-0.5">{dt.desc}</p></div>
        </button>
      ))}
    </div>
  );

  if (step === 2) return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
      <div className="flex items-center gap-2"><button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 text-sm">&larr; 뒤로</button><span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{docType}</span></div>
      <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3"><legend className="text-sm font-medium text-slate-700 px-2">발신인 (나)</legend>
        <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        <div className="grid grid-cols-2 gap-3"><input value={sAddr} onChange={(e) => setSAddr(e.target.value)} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /><input value={sPhone} onChange={(e) => setSPhone(e.target.value)} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
      </fieldset>
      <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3"><legend className="text-sm font-medium text-slate-700 px-2">수신인 (상대방)</legend>
        <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="이름 또는 회사명" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        <input value={rAddr} onChange={(e) => setRAddr(e.target.value)} placeholder="주소" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </fieldset>
      <div><label className="text-sm font-medium text-slate-700 mb-1 block">사건 개요 *</label><textarea value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="어떤 일이 있었는지 구체적으로 설명해주세요" className="w-full h-32 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
      <div><label className="text-sm font-medium text-slate-700 mb-1 block">요구사항</label><textarea value={demand} onChange={(e) => setDemand(e.target.value)} placeholder="상대방에게 원하는 것" className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
      <div><label className="text-sm font-medium text-slate-700 mb-1 block">처리 기한</label><input value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <button onClick={handleSubmit} disabled={!sName.trim() || !incident.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">문서 생성하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span></button>
    </div>
  );

  // step 3 결과
  return result ? (
    <div>
      <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-sm font-medium text-amber-800 mb-2">주의사항</p>
        <ul className="text-xs text-amber-700 space-y-1">{result.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul>
      </div>
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">{result.title}</h2>
          <button onClick={async () => { await navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">{copied ? "복사됨!" : "복사하기"}</button>
        </div>
        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto">{result.content}</div>
      </div>
      <button onClick={() => { setStep(1); setResult(null); }} className="w-full mt-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">새 문서 작성</button>
    </div>
  ) : null;
}

// ── 상담 탭 ──

function ConsultTab() {
  const [consultType, setConsultType] = useState("계약");
  const [situation, setSituation] = useState("");
  const [direction, setDirection] = useState("대응 방법");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!situation.trim()) { setError("상황을 설명해주세요."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/legal/consult", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultType, situation, direction }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "상담 실패");
      else setResult(data);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return <Spinner text="법률 상황을 분석하고 있어요..." />;

  if (result) return (
    <div className="space-y-6">
      {/* 분석 요약 */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">상황 분석</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
      </div>

      {/* 법적 근거 */}
      {result.legalBasis?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">법적 근거</h2>
          <ul className="space-y-2">{result.legalBasis.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm"><span className="text-blue-500 mt-0.5 shrink-0">§</span><span className="text-slate-700">{b}</span></li>
          ))}</ul>
        </div>
      )}

      {/* 대응 단계 */}
      {result.steps?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">권장 대응 방법</h2>
          <div className="space-y-3">{result.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 flex items-center justify-center bg-slate-900 text-white rounded-full text-xs font-bold shrink-0">{i + 1}</span>
              <p className="text-sm text-slate-700">{s}</p>
            </div>
          ))}</div>
        </div>
      )}

      {/* 추천 문서 */}
      {result.recommendedDocs?.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <p className="text-sm font-medium text-blue-800 mb-2">필요한 법률 문서</p>
          <div className="flex flex-wrap gap-2">{result.recommendedDocs.map((d, i) => (
            <span key={i} className="px-3 py-1.5 bg-white text-blue-700 text-sm rounded-full border border-blue-200 font-medium">{d}</span>
          ))}</div>
          <p className="text-xs text-blue-600 mt-2">&larr; 법률 문서 생성 탭에서 바로 작성할 수 있습니다</p>
        </div>
      )}

      {/* 면책 */}
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-xs text-amber-700">{result.disclaimer}</p>
      </div>

      <button onClick={() => setResult(null)} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">새 상담하기</button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">상담 유형</p>
        <div className="flex flex-wrap gap-2">{CONSULT_TYPES.map((t) => (
          <button key={t} onClick={() => setConsultType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${consultType === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
        ))}</div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-1">상황 설명 *</p>
        <textarea value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="어떤 법률 문제가 있는지 자유롭게 설명해주세요.&#10;&#10;예: 회사에서 3개월째 월급을 안 주고 있습니다. 근로계약서는 작성했고..." className="w-full h-40 p-4 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">조언 방향</p>
        <div className="flex flex-wrap gap-2">{DIRECTIONS.map((d) => (
          <button key={d} onClick={() => setDirection(d)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${direction === d ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>{direction === d ? "✓ " : ""}{d}</button>
        ))}</div>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button onClick={handleSubmit} disabled={!situation.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
        AI 상담 시작하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">2 크레딧</span>
      </button>
    </div>
  );
}

// ── 공통 스피너 ──

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{text}</h2>
    </div>
  );
}
