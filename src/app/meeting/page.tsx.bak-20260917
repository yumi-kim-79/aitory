"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMeeting, type MeetingRecord, type ActionItem } from "@/lib/meeting-store";

type Tab = "text" | "file";
const TYPES = ["정기회의", "킥오프", "브레인스토밍", "보고", "협의", "기타"];
const OUTPUT_OPTS = ["회의 요약", "주요 결정 사항", "액션 아이템", "다음 회의 안건 제안", "전체 회의록"];

interface MeetingResult {
  summary: string;
  bullet_points: string[];
  decisions: string[];
  action_items: { task: string; assignee: string; due_date: string; priority: string }[];
  next_agenda: string[];
  full_minutes: string;
}

export default function MeetingPage() {
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("");
  const [meetingType, setMeetingType] = useState("정기회의");
  const [outputOpts, setOutputOpts] = useState<string[]>([...OUTPUT_OPTS]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [error, setError] = useState("");

  const toggleOpt = (o: string) =>
    setOutputOpts((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "txt") {
      setText(await file.text());
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await file.arrayBuffer());
      const r = await mammoth.extractRawText({ buffer });
      setText(r.value);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) { setError("회의 내용을 입력해주세요."); return; }
    if (outputOpts.length === 0) { setError("출력 옵션을 1개 이상 선택해주세요."); return; }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/meeting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title,
          date,
          attendees: attendees.split(",").map((s) => s.trim()).filter(Boolean),
          meetingType,
          outputOptions: outputOpts,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "생성 오류"); }
      else {
        setResult(data);
        saveMeeting({
          id: crypto.randomUUID(),
          title: title || "회의록",
          date,
          attendees: attendees.split(",").map((s) => s.trim()).filter(Boolean),
          meetingType,
          summary: data.summary || "",
          bulletPoints: data.bullet_points || [],
          decisions: data.decisions || [],
          actionItems: (data.action_items || []).map((a: MeetingResult["action_items"][0]) => ({
            task: a.task, assignee: a.assignee, dueDate: a.due_date, priority: a.priority, done: false,
          })),
          nextAgenda: data.next_agenda || [],
          fullMinutes: data.full_minutes || "",
          createdAt: new Date().toISOString(),
        });
      }
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">회의 내용을 분석하고 있어요...</h2>
          <p className="text-slate-500">AI가 회의록을 작성하고 액션 아이템을 추출합니다</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        title={title || "회의록"}
        date={date}
        attendees={attendees.split(",").map((s) => s.trim()).filter(Boolean)}
        meetingType={meetingType}
        onReset={() => setResult(null)}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 회의록 자동 생성</h1>
          <p className="text-lg text-slate-500">회의 내용을 자동으로 정리하고 액션 아이템을 추출합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 탭 */}
          <div className="flex gap-2">
            <button onClick={() => setTab("text")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${tab === "text" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>텍스트 입력</button>
            <button onClick={() => setTab("file")} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${tab === "file" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>파일 업로드</button>
          </div>

          {tab === "text" && (
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="회의 중 메모한 내용이나 STT 변환 텍스트를 붙여넣으세요..." className="w-full h-48 p-4 border border-slate-300 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400" />
          )}

          {tab === "file" && (
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
              <input type="file" accept=".txt,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              {text ? (
                <p className="text-emerald-700 font-medium">파일 로드 완료 ({text.length}자)</p>
              ) : (
                <>
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-slate-600 font-medium">.txt 또는 .docx 파일 업로드</p>
                </>
              )}
            </label>
          )}

          {/* 회의 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">회의 제목</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 주간 정기회의" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">날짜</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">참석자</label>
            <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="홍길동, 김영희, 이철수 (콤마로 구분)" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">회의 유형</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} onClick={() => setMeetingType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${meetingType === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* 출력 옵션 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">출력 옵션</label>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_OPTS.map((o) => (
                <button key={o} onClick={() => toggleOpt(o)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${outputOpts.includes(o) ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {outputOpts.includes(o) ? "✓ " : ""}{o}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!text.trim() || outputOpts.length === 0} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            회의록 생성하기
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">2 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 화면 ──

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};
const PRIORITY_LABEL: Record<string, string> = { high: "높음", medium: "중간", low: "낮음" };

function ResultScreen({
  result, title, date, attendees, meetingType, onReset,
}: {
  result: MeetingResult;
  title: string; date: string; attendees: string[]; meetingType: string;
  onReset: () => void;
}) {
  type RTab = "summary" | "decisions" | "actions" | "full";
  const [activeTab, setActiveTab] = useState<RTab>("summary");
  const [copied, setCopied] = useState(false);
  const [actionsDone, setActionsDone] = useState<boolean[]>(
    (result.action_items || []).map(() => false),
  );
  const [dlWord, setDlWord] = useState(false);
  const [dlExcel, setDlExcel] = useState(false);

  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = async (url: string, body: unknown, filename: string, setL: (b: boolean) => void) => {
    setL(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) return;
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = filename; a.click();
      URL.revokeObjectURL(u);
    } catch {} finally { setL(false); }
  };

  const wordBody = {
    title, date, attendees, meetingType,
    summary: result.summary, bulletPoints: result.bullet_points,
    decisions: result.decisions, actionItems: result.action_items?.map((a) => ({
      task: a.task, assignee: a.assignee, dueDate: a.due_date, priority: a.priority,
    })),
    fullMinutes: result.full_minutes,
  };

  const tabs: { id: RTab; label: string; show: boolean }[] = [
    { id: "summary", label: "요약", show: !!result.summary },
    { id: "decisions", label: "결정사항", show: (result.decisions?.length || 0) > 0 },
    { id: "actions", label: "액션아이템", show: (result.action_items?.length || 0) > 0 },
    { id: "full", label: "전체회의록", show: !!result.full_minutes },
  ];

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <div className="flex gap-2">
            <Link href="/meeting/history" className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200">이력</Link>
            <button onClick={onReset} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200">새로 만들기</button>
          </div>
        </div>

        {/* 헤더 */}
        <div className="flex flex-wrap gap-2 mb-6 text-sm text-slate-500">
          <span>{date}</span>
          <span>·</span>
          <span>{attendees.join(", ")}</span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{meetingType}</span>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t.label}</button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {activeTab === "summary" && result.summary && (
            <>
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">회의 요약</h2>
                <button onClick={() => copy(result.summary + "\n" + (result.bullet_points || []).map((b) => `• ${b}`).join("\n"))} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200">{copied ? "복사됨!" : "복사"}</button>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">{result.summary}</p>
              {result.bullet_points?.length > 0 && (
                <ul className="space-y-2">
                  {result.bullet_points.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="text-blue-500 mt-0.5">•</span>{b}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {activeTab === "decisions" && result.decisions?.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">주요 결정 사항</h2>
              <div className="space-y-3">
                {result.decisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 flex items-center justify-center bg-slate-900 text-white rounded-full text-xs font-bold shrink-0">{i + 1}</span>
                    <p className="text-sm text-slate-700 flex-1">{d}</p>
                    <button onClick={() => copy(d)} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">복사</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "actions" && result.action_items?.length > 0 && (
            <>
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">액션 아이템</h2>
                <button onClick={() => downloadFile("/api/meeting/download-excel", { actionItems: result.action_items, title, date }, "액션아이템.xlsx", setDlExcel)} disabled={dlExcel} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200 disabled:opacity-50">
                  {dlExcel ? "생성중..." : "엑셀 다운로드 (1 크레딧)"}
                </button>
              </div>
              <div className="space-y-3">
                {result.action_items.map((a, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${actionsDone[i] ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={actionsDone[i]} onChange={() => setActionsDone((p) => { const n = [...p]; n[i] = !n[i]; return n; })} className="mt-1 rounded" />
                      <div className="flex-1">
                        <p className={`font-medium text-slate-900 ${actionsDone[i] ? "line-through" : ""}`}>{a.task}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs">
                          <span className="text-slate-500">담당: {a.assignee}</span>
                          <span className="text-slate-500">기한: {a.due_date}</span>
                          <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.low}`}>{PRIORITY_LABEL[a.priority] || a.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "full" && result.full_minutes && (
            <>
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">전체 회의록</h2>
                <button onClick={() => copy(result.full_minutes)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200">{copied ? "복사됨!" : "복사"}</button>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.full_minutes}
              </div>
            </>
          )}
        </div>

        {/* 다운로드 */}
        <div className="flex gap-3 mt-6">
          <button onClick={() => downloadFile("/api/meeting/download-word", wordBody, `${title}.docx`, setDlWord)} disabled={dlWord} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-2">
            {dlWord ? "생성중..." : <>Word 다운로드<span className="text-xs bg-white/20 px-2 py-0.5 rounded">2 크레딧</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
