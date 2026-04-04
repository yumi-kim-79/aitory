"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "file" | "text" | "url";

const LANGUAGES = [
  "자동감지", "영어", "일본어", "중국어",
  "스페인어", "프랑스어", "독일어", "기타",
];

const OUTPUT_OPTIONS = [
  "전체 번역",
  "핵심 요약",
  "주요 키워드 추출",
];

interface Keyword {
  word: string;
  importance: string;
}

interface TranslateResult {
  detected_language: string;
  translated_text: string;
  summary: string;
  bullet_points: string[];
  keywords: Keyword[];
  is_contract: boolean;
}

export default function TranslatePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [sourceLang, setSourceLang] = useState("자동감지");
  const [outputOptions, setOutputOptions] = useState<string[]>([
    ...OUTPUT_OPTIONS,
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleOption = (o: string) =>
    setOutputOptions((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );

  const handleSubmit = async () => {
    setError("");

    if (tab === "url") {
      setError("URL에서 내용을 자동으로 가져올 수 없습니다. 텍스트를 직접 입력해주세요.");
      return;
    }

    if (tab === "file" && !file) {
      setError("파일을 업로드해주세요.");
      return;
    }
    if (tab === "text" && !text.trim()) {
      setError("텍스트를 입력해주세요.");
      return;
    }
    if (outputOptions.length === 0) {
      setError("출력 옵션을 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      if (tab === "file" && file) fd.append("file", file);
      if (tab === "text") fd.append("text", text);
      fd.append("sourceLang", sourceLang);
      fd.append("outputOptions", JSON.stringify(outputOptions));

      const res = await fetch("/api/translate/analyze", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "번역 중 오류가 발생했습니다.");
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
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            문서를 번역하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 번역, 요약, 키워드 추출을 수행합니다
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        onReset={() => {
          setResult(null);
          setFile(null);
        }}
        onContractAnalyze={() => {
          // 번역된 텍스트를 sessionStorage에 저장 후 계약서 페이지로 이동
          if (result.translated_text) {
            sessionStorage.setItem(
              "aitory_contract_text",
              result.translated_text,
            );
          }
          router.push("/contract");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors"
        >
          &larr; 홈으로
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            AI 번역 + 문서 요약
          </h1>
          <p className="text-lg text-slate-500">
            외국어 문서를 한국어로 번역하고 핵심만 요약합니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 탭 */}
          <div className="flex gap-2">
            {(
              [
                ["file", "파일 업로드"],
                ["text", "텍스트 입력"],
                ["url", "URL 입력"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors text-sm ${
                  tab === id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "file" && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                file
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <>
                  <p className="text-emerald-700 font-medium">{file.name}</p>
                  <p className="text-slate-400 text-sm mt-1">
                    클릭하여 변경
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-slate-600 font-medium">
                    PDF, Word, 이미지 파일 업로드
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    클릭하여 파일을 선택하세요
                  </p>
                </>
              )}
            </div>
          )}

          {tab === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="번역할 텍스트를 붙여넣으세요..."
              className="w-full h-48 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {tab === "url" && (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="웹페이지 URL을 붙여넣으세요"
              className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {/* 원본 언어 */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              원본 언어
            </p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => setSourceLang(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sourceLang === l
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 출력 옵션 */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              출력 옵션
            </p>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_OPTIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => toggleOption(o)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    outputOptions.includes(o)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {outputOptions.includes(o) ? "✓ " : ""}
                  {o}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={
              (tab === "file" && !file) ||
              (tab === "text" && !text.trim()) ||
              (tab === "url" && !url.trim()) ||
              outputOptions.length === 0
            }
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            번역 시작하기
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
              2 크레딧
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 화면 ──

function ResultScreen({
  result,
  onReset,
  onContractAnalyze,
}: {
  result: TranslateResult;
  onReset: () => void;
  onContractAnalyze: () => void;
}) {
  type ResultTab = "translation" | "summary" | "keywords";
  const [activeTab, setActiveTab] = useState<ResultTab>("translation");
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: ResultTab; label: string; show: boolean }[] = [
    {
      id: "translation",
      label: "전체 번역",
      show: !!result.translated_text,
    },
    { id: "summary", label: "핵심 요약", show: !!result.summary },
    {
      id: "keywords",
      label: "키워드",
      show: result.keywords?.length > 0,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  const importanceColor: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">번역 결과</h1>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            다시 번역하기
          </button>
        </div>

        {/* 감지 언어 */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-slate-500">감지된 언어:</span>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200 font-medium">
            {result.detected_language}
          </span>
          <span className="text-slate-400">→</span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full border border-emerald-200 font-medium">
            한국어
          </span>
        </div>

        {/* 계약서 감지 알림 */}
        {result.is_contract && (
          <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm text-amber-800 font-medium mb-2">
              계약서가 감지됐어요!
            </p>
            <p className="text-xs text-amber-700 mb-3">
              위험 조항이 있는지 AI가 분석해드릴 수 있어요.
            </p>
            <button
              onClick={onContractAnalyze}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              계약서 검토기로 분석하기
            </button>
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 전체 번역 */}
        {activeTab === "translation" && result.translated_text && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                전체 번역
              </h2>
              <button
                onClick={() => handleCopy(result.translated_text)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                {copied ? "복사됨!" : "복사하기"}
              </button>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {result.translated_text}
            </div>
          </div>
        )}

        {/* 핵심 요약 */}
        {activeTab === "summary" && result.summary && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                핵심 요약
              </h2>
              <button
                onClick={() =>
                  handleCopy(
                    result.summary +
                      "\n\n" +
                      (result.bullet_points || [])
                        .map((b) => `• ${b}`)
                        .join("\n"),
                  )
                }
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                {copied ? "복사됨!" : "복사하기"}
              </button>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              {result.summary}
            </p>
            {result.bullet_points?.length > 0 && (
              <ul className="space-y-2">
                {result.bullet_points.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="text-blue-500 mt-0.5">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 키워드 */}
        {activeTab === "keywords" && result.keywords?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              주요 키워드
            </h2>
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((k, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 text-sm rounded-full border font-medium ${
                    importanceColor[k.importance] || importanceColor.low
                  }`}
                >
                  {k.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
