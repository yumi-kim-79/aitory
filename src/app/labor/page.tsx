"use client";

import { useState } from "react";
import Link from "next/link";

interface LaborResult { title: string; content: string; highlights: string[] }

export default function LaborPage() {
  const [empName, setEmpName] = useState("");
  const [empBiz, setEmpBiz] = useState("");
  const [empAddr, setEmpAddr] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerAddr, setWorkerAddr] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [task, setTask] = useState("");
  const [location, setLocation] = useState("");
  const [contractPeriod, setContractPeriod] = useState("");
  const [workHours, setWorkHours] = useState("09:00~18:00");
  const [salary, setSalary] = useState("");
  const [payDay, setPayDay] = useState("매월 10일");
  const [probation, setProbation] = useState("없음");
  const [insurance, setInsurance] = useState("4대보험 가입");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaborResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!empName.trim() || !workerName.trim()) { setError("고용주명과 근로자명은 필수입니다."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/labor/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employer: { name: empName, bizNumber: empBiz, address: empAddr },
          worker: { name: workerName, address: workerAddr, phone: workerPhone },
          conditions: { task, location, contractPeriod, workHours, salary, payDay, probation, insurance },
          extra,
        }),
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">근로계약서를 작성하고 있어요...</h2>
        <p className="text-slate-500">AI가 근로기준법에 맞는 계약서를 작성합니다</p>
      </div>
    </div>
  );

  if (result) return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{result.title}</h1>
          <button onClick={() => setResult(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">다시 작성</button>
        </div>

        {result.highlights?.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-2">핵심 조항</p>
            <ul className="text-xs text-blue-700 space-y-1">{result.highlights.map((h, i) => <li key={i}>• {h}</li>)}</ul>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex justify-end mb-4">
            <button onClick={async () => { await navigator.clipboard.writeText(result.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">{copied ? "복사됨!" : "복사하기"}</button>
          </div>
          <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[32rem] overflow-y-auto">{result.content}</div>
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
          <p className="text-xs text-amber-700">본 계약서는 참고용이며 실제 사용 전 노무사/변호사 확인을 권장합니다.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 근로계약서</h1>
          <p className="text-lg text-slate-500">근로조건에 맞는 표준 근로계약서를 자동 생성합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium text-slate-700 px-2">고용주 정보</legend>
            <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="상호명/이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={empBiz} onChange={(e) => setEmpBiz(e.target.value)} placeholder="사업자번호" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={empAddr} onChange={(e) => setEmpAddr(e.target.value)} placeholder="사업장 주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </fieldset>

          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium text-slate-700 px-2">근로자 정보</legend>
            <input value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={workerAddr} onChange={(e) => setWorkerAddr(e.target.value)} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </fieldset>

          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium text-slate-700 px-2">근무 조건</legend>
            <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="업무 내용 (예: 웹 개발)" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="근무 장소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={contractPeriod} onChange={(e) => setContractPeriod(e.target.value)} placeholder="계약 기간 (예: 1년)" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={workHours} onChange={(e) => setWorkHours(e.target.value)} placeholder="근무 시간" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="급여 (예: 월 300만원)" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input value={payDay} onChange={(e) => setPayDay(e.target.value)} placeholder="급여일" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={probation} onChange={(e) => setProbation(e.target.value)} placeholder="수습 기간" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="4대보험" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </fieldset>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">추가사항</label>
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="기타 특약사항이 있으면 입력하세요" className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!empName.trim() || !workerName.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            근로계약서 생성하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}
