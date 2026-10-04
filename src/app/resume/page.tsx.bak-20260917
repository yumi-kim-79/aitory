"use client";

import { useState } from "react";
import Link from "next/link";

interface Career {
  company: string;
  position: string;
  period: string;
  description: string;
}

interface ResumeResult {
  resume: {
    name: string;
    email: string;
    phone: string;
    address: string;
    summary: string;
    education: string;
    careers: { company: string; position: string; period: string; description: string }[];
    skills: string;
  };
  coverLetter: string;
  summary: string;
}

export default function ResumePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [careers, setCareers] = useState<Career[]>([
    { company: "", position: "", period: "", description: "" },
  ]);
  const [skills, setSkills] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [keywords, setKeywords] = useState("");
  const [existingText, setExistingText] = useState("");
  const [tab, setTab] = useState<"manual" | "upload">("manual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [error, setError] = useState("");

  const addCareer = () =>
    setCareers((p) => [...p, { company: "", position: "", period: "", description: "" }]);
  const removeCareer = (i: number) =>
    setCareers((p) => p.filter((_, j) => j !== i));
  const updateCareer = (i: number, field: keyof Career, value: string) =>
    setCareers((p) => { const n = [...p]; n[i] = { ...n[i], [field]: value }; return n; });

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "txt") {
      setExistingText(await file.text());
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const buf = Buffer.from(await file.arrayBuffer());
      const r = await mammoth.extractRawText({ buffer: buf });
      setExistingText(r.value);
    } else {
      setError("PDF는 텍스트 복사 후 붙여넣기 해주세요.");
    }
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone, address, school, major, gradYear,
          careers: careers.filter((c) => c.company),
          skills, targetJob, keywords, existingText: tab === "upload" ? existingText : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else setResult(data);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">이력서를 생성하고 있어요...</h2>
          <p className="text-slate-500">AI가 지원 직무에 최적화된 이력서와 자기소개서를 작성합니다</p>
        </div>
      </div>
    );
  }

  if (result) return <ResultScreen result={result} onReset={() => setResult(null)} />;

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 이력서/자기소개서</h1>
          <p className="text-lg text-slate-500">지원 직무에 최적화된 이력서와 자기소개서를 AI가 작성합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 탭 */}
          <div className="flex gap-2">
            <button onClick={() => setTab("manual")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${tab === "manual" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>직접 입력</button>
            <button onClick={() => setTab("upload")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${tab === "upload" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>기존 이력서 개선</button>
          </div>

          {tab === "upload" ? (
            <div className="space-y-4">
              <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50">
                <input type="file" accept=".txt,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                {existingText ? <p className="text-emerald-700 font-medium">파일 로드 완료 ({existingText.length}자)</p> : <><p className="text-slate-600 font-medium">기존 이력서 업로드 (.txt, .docx)</p><p className="text-slate-400 text-sm mt-1">또는 아래에 직접 붙여넣기</p></>}
              </label>
              <textarea value={existingText} onChange={(e) => setExistingText(e.target.value)} placeholder="기존 이력서 내용을 붙여넣으세요..." className="w-full h-40 p-4 border border-slate-300 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">지원 직무</label><input value={targetJob} onChange={(e) => setTargetJob(e.target.value)} placeholder="예: 프론트엔드 개발자" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">키워드</label><input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: React, TypeScript, 협업" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
              </div>
            </div>
          ) : (
            <>
              {/* 기본 정보 */}
              <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
                <legend className="text-sm font-medium text-slate-700 px-2">기본 정보</legend>
                <div className="grid grid-cols-2 gap-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 *" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="전화번호" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </fieldset>

              {/* 학력 */}
              <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
                <legend className="text-sm font-medium text-slate-700 px-2">학력</legend>
                <div className="grid grid-cols-3 gap-3">
                  <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="학교명" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="전공" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="졸업연도" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </fieldset>

              {/* 경력 */}
              <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
                <legend className="text-sm font-medium text-slate-700 px-2">경력</legend>
                {careers.map((c, i) => (
                  <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-lg">
                    <div className="flex gap-2">
                      <input value={c.company} onChange={(e) => updateCareer(i, "company", e.target.value)} placeholder="회사명" className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      <input value={c.position} onChange={(e) => updateCareer(i, "position", e.target.value)} placeholder="직책" className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      <input value={c.period} onChange={(e) => updateCareer(i, "period", e.target.value)} placeholder="기간" className="w-32 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                      {careers.length > 1 && <button onClick={() => removeCareer(i)} className="text-slate-400 hover:text-red-500 px-2">&times;</button>}
                    </div>
                    <textarea value={c.description} onChange={(e) => updateCareer(i, "description", e.target.value)} placeholder="업무 내용 (성과 중심으로 작성하면 AI가 더 잘 개선합니다)" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  </div>
                ))}
                <button onClick={addCareer} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ 경력 추가</button>
              </fieldset>

              {/* 스킬 + 지원직무 */}
              <div><label className="text-sm font-medium text-slate-700 mb-1 block">스킬/자격증</label><input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="예: React, TypeScript, AWS, 정보처리기사" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">지원 직무 *</label><input value={targetJob} onChange={(e) => setTargetJob(e.target.value)} placeholder="예: 프론트엔드 개발자" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
                <div><label className="text-sm font-medium text-slate-700 mb-1 block">키워드</label><input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="강조하고 싶은 키워드" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={(tab === "manual" && !name.trim()) || (tab === "upload" && !existingText.trim())} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {tab === "upload" ? "이력서 개선하기" : "이력서 생성하기"}
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 화면 ──

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 shrink-0">
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}

function ResultScreen({ result, onReset }: { result: ResumeResult; onReset: () => void }) {
  const [activeTab, setActiveTab] = useState<"resume" | "cover">("resume");
  const r = result.resume;

  const resumeText = [
    `이름: ${r.name}`, `이메일: ${r.email}`, `전화: ${r.phone}`, `주소: ${r.address}`,
    "", `프로필: ${r.summary}`, "", `학력: ${r.education}`, "",
    "경력:",
    ...(r.careers || []).map((c) => `  ${c.company} / ${c.position} (${c.period})\n  ${c.description}`),
    "", `스킬: ${r.skills}`,
  ].join("\n");

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">생성 결과</h1>
          <button onClick={onReset} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">다시 수정하기</button>
        </div>

        {result.summary && (
          <p className="text-slate-500 text-sm mb-6 p-3 bg-slate-50 rounded-lg">{result.summary}</p>
        )}

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab("resume")} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === "resume" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>이력서</button>
          <button onClick={() => setActiveTab("cover")} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === "cover" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>자기소개서</button>
        </div>

        {activeTab === "resume" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">이력서</h2>
              <CopyBtn text={resumeText} />
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-900">{r.name}</p>
                <p className="text-slate-500">{[r.email, r.phone, r.address].filter(Boolean).join(" · ")}</p>
              </div>
              {r.summary && <p className="text-slate-700 italic border-l-2 border-slate-300 pl-3">{r.summary}</p>}
              {r.education && <div><p className="font-semibold text-slate-800 mb-1">학력</p><p className="text-slate-700">{r.education}</p></div>}
              {r.careers?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-800 mb-2">경력</p>
                  {r.careers.map((c, i) => (
                    <div key={i} className="mb-3 pl-3 border-l-2 border-blue-200">
                      <p className="font-medium text-slate-900">{c.company} — {c.position}</p>
                      <p className="text-xs text-slate-400">{c.period}</p>
                      <p className="text-slate-700 mt-1">{c.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {r.skills && <div><p className="font-semibold text-slate-800 mb-1">스킬/자격증</p><p className="text-slate-700">{r.skills}</p></div>}
            </div>
          </div>
        )}

        {activeTab === "cover" && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">자기소개서</h2>
              <CopyBtn text={result.coverLetter} />
            </div>
            <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {result.coverLetter}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
