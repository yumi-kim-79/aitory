"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const FileUploadArea = dynamic(
  () => import("@/components/FileUploadArea"),
  { ssr: false },
);

interface AnalysisResult {
  riskScore: number;
  summary: string;
  clauses: {
    text: string;
    level: "danger" | "warning" | "safe";
    reason: string;
    suggestion: string;
  }[];
}

type Tab = "upload" | "text";

export default function Home() {
  const [tab, setTab] = useState<Tab>("upload");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setResult(null);

    try {
      let res: Response;

      if (tab === "upload" && files.length > 0) {
        const formData = new FormData();
        for (const f of files) {
          formData.append("files", f);
        }
        res = await fetch("/api/analyze", { method: "POST", body: formData });
      } else if (tab === "text" && text.trim()) {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } else {
        setError("계약서 파일을 업로드하거나 텍스트를 입력해주세요.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "분석 중 오류가 발생했습니다.");
      } else {
        setResult(data);
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen files={files} />;
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        originalFile={files[0] || null}
        onReset={() => setResult(null)}
      />
    );
  }

  return (
    <div suppressHydrationWarning={true} className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors"
        >
          &larr; 홈으로
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            계약서 검토기
          </h1>
          <p className="text-lg text-slate-500">
            AI가 계약서를 분석해 위험 조항을 찾아드립니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* 탭 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab("upload")}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tab === "upload"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              파일 업로드
            </button>
            <button
              onClick={() => setTab("text")}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tab === "text"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              텍스트 입력
            </button>
          </div>

          {/* 업로드 탭 */}
          {tab === "upload" && (
            <FileUploadArea
              files={files}
              dragging={dragging}
              error={error}
              onFilesChange={setFiles}
              onDraggingChange={setDragging}
              onError={setError}
            />
          )}

          {/* 텍스트 탭 */}
          {tab === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="계약서 내용을 여기에 붙여넣으세요..."
              className="w-full h-64 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {error && tab === "text" && (
            <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={
              (tab === "upload" && files.length === 0) ||
              (tab === "text" && !text.trim())
            }
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            계약서 분석하기
            {tab === "upload" && files.length > 0 && (
              <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
                {files.length === 1
                  ? "1 크레딧"
                  : files.length <= 3
                    ? "2 크레딧"
                    : "3 크레딧"}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ files }: { files: File[] }) {
  const imageExts = new Set(["jpg", "jpeg", "png", "webp"]);
  const isImage = files.some((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    return imageExts.has(ext);
  });

  return (
    <div suppressHydrationWarning={true} className="flex flex-col flex-1 items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isImage ? "이미지에서 텍스트를 추출하고 있어요..." : "계약서 분석 중..."}
        </h2>
        <p className="text-slate-500">
          {isImage
            ? "이미지를 OCR 처리한 후 계약서를 분석합니다"
            : "AI가 계약서의 각 조항을 검토하고 있습니다"}
        </p>
      </div>
    </div>
  );
}

function ClauseCard({
  clause,
  index,
}: {
  clause: AnalysisResult["clauses"][number];
  index: number;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{
    fixed: string;
    explanation: string;
  } | null>(null);
  const [clauseCopied, setClauseCopied] = useState(false);

  const levelConfig = {
    danger: {
      label: "위험",
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-500 text-white",
      text: "text-red-800",
    },
    warning: {
      label: "주의",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-500 text-white",
      text: "text-amber-800",
    },
    safe: {
      label: "안전",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badge: "bg-emerald-500 text-white",
      text: "text-emerald-800",
    },
  };

  const config = levelConfig[clause.level];

  const handleFix = async () => {
    setFixing(true);
    try {
      const res = await fetch("/api/fix-clause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause: clause.text, reason: clause.reason }),
      });
      const data = await res.json();
      if (res.ok) setFixResult(data);
    } catch {
      /* ignore */
    } finally {
      setFixing(false);
    }
  };

  return (
    <div
      key={index}
      className={`${config.bg} border ${config.border} rounded-xl p-6`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`${config.badge} px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0`}
        >
          {config.label}
        </span>
        <p className={`${config.text} font-medium leading-relaxed`}>
          {clause.text}
        </p>
      </div>
      <p className="text-slate-600 text-sm ml-14">{clause.reason}</p>
      {clause.suggestion && (
        <div className="mt-3 ml-14 p-3 bg-white/70 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-500 mb-1 font-medium">수정 제안</p>
          <p className="text-sm text-slate-700">{clause.suggestion}</p>
        </div>
      )}

      {/* 수정하기 버튼 (위험/주의만) */}
      {clause.level !== "safe" && !fixResult && (
        <div className="mt-4 ml-14">
          <button
            onClick={handleFix}
            disabled={fixing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg font-medium hover:bg-slate-800 disabled:bg-slate-400 transition-colors"
          >
            {fixing ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                수정 중...
              </>
            ) : (
              <>
                이 조항 수정하기
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                  1 크레딧
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* AI 수정 결과 */}
      {fixResult && (
        <div className="mt-4 ml-14 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-blue-600 font-semibold">AI 수정 문구</p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(fixResult.fixed);
                setClauseCopied(true);
                setTimeout(() => setClauseCopied(false), 2000);
              }}
              className="px-3 py-1 bg-white text-slate-600 rounded-md text-xs font-medium border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {clauseCopied ? "복사됨 ✓" : "복사하기"}
            </button>
          </div>
          <p className="text-sm text-slate-800 leading-relaxed">
            {fixResult.fixed}
          </p>
          <p className="text-xs text-slate-500 mt-2">{fixResult.explanation}</p>
        </div>
      )}
    </div>
  );
}

function ResultScreen({
  result,
  originalFile,
  onReset,
}: {
  result: AnalysisResult;
  originalFile: File | null;
  onReset: () => void;
}) {
  const [fixingAll, setFixingAll] = useState(false);
  const [fixAllResult, setFixAllResult] = useState<{
    fullText: string;
    changes: string[];
    fixedClauses: { original: string; fixed: string; modified: boolean }[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  const scoreColor =
    result.riskScore >= 70
      ? "text-red-500"
      : result.riskScore >= 40
        ? "text-amber-500"
        : "text-emerald-500";

  const scoreRingColor =
    result.riskScore >= 70
      ? "border-red-500"
      : result.riskScore >= 40
        ? "border-amber-500"
        : "border-emerald-500";

  const dangerCount = result.clauses.filter((c) => c.level === "danger").length;
  const warningCount = result.clauses.filter(
    (c) => c.level === "warning",
  ).length;
  const safeCount = result.clauses.filter((c) => c.level === "safe").length;
  const hasFixable = dangerCount + warningCount > 0;

  const handleFixAll = async () => {
    setFixingAll(true);
    try {
      const res = await fetch("/api/fix-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauses: result.clauses }),
      });
      const data = await res.json();
      if (res.ok) setFixAllResult(data);
    } catch {
      /* ignore */
    } finally {
      setFixingAll(false);
    }
  };

  const handleCopy = async () => {
    if (!fixAllResult) return;
    await navigator.clipboard.writeText(fixAllResult.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const origExt = originalFile?.name.split(".").pop()?.toLowerCase() || "";
  const isOrigDocx = origExt === "docx";
  const isOrigXlsx = origExt === "xlsx" || origExt === "xls";

  const handleDownloadDocx = async () => {
    if (!fixAllResult) return;
    setDownloadingDocx(true);
    try {
      const fd = new FormData();
      fd.append(
        "data",
        JSON.stringify({
          fixedClauses: fixAllResult.fixedClauses,
          changes: fixAllResult.changes,
        }),
      );
      if (originalFile && isOrigDocx) {
        fd.append("file", originalFile);
      }
      const res = await fetch("/api/generate-docx", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("DOCX 생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "수정된_계약서.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadXlsx = async () => {
    if (!fixAllResult) return;
    setDownloadingXlsx(true);
    try {
      const fd = new FormData();
      fd.append(
        "data",
        JSON.stringify({
          fixedClauses: fixAllResult.fixedClauses,
          changes: fixAllResult.changes,
        }),
      );
      if (originalFile && isOrigXlsx) {
        fd.append("file", originalFile);
      }
      const res = await fetch("/api/generate-xlsx", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("XLSX 생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "수정된_계약서.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setDownloadingXlsx(false);
    }
  };

  return (
    <div suppressHydrationWarning={true} className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">분석 결과</h1>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            다시 분석하기
          </button>
        </div>

        {/* 위험도 점수 카드 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <div className="flex items-center gap-8">
            <div
              className={`w-28 h-28 rounded-full border-4 ${scoreRingColor} flex items-center justify-center shrink-0`}
            >
              <span className={`text-4xl font-bold ${scoreColor}`}>
                {result.riskScore}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                위험도 점수
              </h2>
              <p className="text-slate-600">{result.summary}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-red-600 font-medium">
                  위험 {dangerCount}
                </span>
                <span className="text-amber-600 font-medium">
                  주의 {warningCount}
                </span>
                <span className="text-emerald-600 font-medium">
                  안전 {safeCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 조항 목록 */}
        <div className="space-y-4">
          {result.clauses.map((clause, i) => (
            <ClauseCard key={i} clause={clause} index={i} />
          ))}
        </div>

        {/* 전체 자동 수정 버튼 */}
        {hasFixable && !fixAllResult && (
          <div className="mt-8">
            <button
              onClick={handleFixAll}
              disabled={fixingAll}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-3"
            >
              {fixingAll ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  계약서 전체 수정 중...
                </>
              ) : (
                <>
                  계약서 전체 자동 수정
                  <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
                    3 크레딧
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 전체 수정 결과 */}
        {fixAllResult && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                수정된 계약서
              </h2>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                {copied ? "복사됨!" : "텍스트 복사"}
              </button>
            </div>

            {fixAllResult.changes.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 font-medium mb-1">
                  변경 사항
                </p>
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                  {fixAllResult.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed max-h-96 overflow-y-auto">
              {fixAllResult.fullText}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleDownloadDocx}
                disabled={downloadingDocx}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-2"
              >
                {downloadingDocx ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    {isOrigDocx
                      ? "원본 양식 유지 다운로드 (.docx)"
                      : "Word로 변환 다운로드 (.docx)"}
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                      2 크레딧
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadXlsx}
                disabled={downloadingXlsx}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors flex items-center justify-center gap-2"
              >
                {downloadingXlsx ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    {isOrigXlsx
                      ? "원본 양식 유지 다운로드 (.xlsx)"
                      : "Excel로 변환 다운로드 (.xlsx)"}
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                      1 크레딧
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
