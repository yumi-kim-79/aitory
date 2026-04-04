"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "url" | "text";

const PLATFORMS = [
  { id: "인스타그램", icon: "📸" },
  { id: "스레드", icon: "🧵" },
  { id: "네이버 블로그", icon: "📝" },
  { id: "카카오채널", icon: "💬" },
  { id: "링크드인", icon: "💼" },
  { id: "트위터/X", icon: "🐦" },
] as const;

const TONES = ["전문적", "친근한", "유머러스", "감성적"] as const;

interface PlatformResult {
  platform: string;
  content: string;
  hashtags: string[];
  char_count: number;
}

interface SnsResult {
  original_topic: string;
  keywords: string[];
  platforms: PlatformResult[];
}

export default function SnsPage() {
  const [tab, setTab] = useState<Tab>("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "인스타그램",
    "스레드",
  ]);
  const [tone, setTone] = useState("친근한");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnsResult | null>(null);
  const [error, setError] = useState("");

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setResult(null);

    let content = "";
    if (tab === "url") {
      if (!url.trim()) {
        setError("URL을 입력해주세요.");
        setLoading(false);
        return;
      }
      setError(
        "URL에서 내용을 자동으로 가져올 수 없습니다. 텍스트를 직접 입력해주세요.",
      );
      setLoading(false);
      return;
    } else {
      content = text.trim();
    }

    if (!content) {
      setError("콘텐츠 텍스트를 입력해주세요.");
      setLoading(false);
      return;
    }

    if (selectedPlatforms.length === 0) {
      setError("변환할 플랫폼을 1개 이상 선택해주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/sns/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          platforms: selectedPlatforms,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "재가공 중 오류가 발생했습니다.");
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
            콘텐츠를 재가공하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 각 플랫폼에 최적화된 콘텐츠를 생성합니다
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return <ResultScreen result={result} onReset={() => setResult(null)} />;
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
            SNS 콘텐츠 재가공
          </h1>
          <p className="text-lg text-slate-500">
            블로그/영상 콘텐츠를 SNS용으로 자동 변환합니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* 탭 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab("url")}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tab === "url"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              URL 입력
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

          {tab === "url" && (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="블로그/뉴스 URL을 붙여넣으세요"
              className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {tab === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="블로그 글이나 콘텐츠 내용을 붙여넣으세요..."
              className="w-full h-48 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {/* 플랫폼 선택 */}
          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              변환할 플랫폼
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedPlatforms.includes(p.id)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {selectedPlatforms.includes(p.id) ? "✓ " : ""}
                  {p.icon} {p.id}
                </button>
              ))}
            </div>
          </div>

          {/* 톤 선택 */}
          <div className="mt-5">
            <p className="text-sm font-medium text-slate-700 mb-3">톤 선택</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tone === t
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={
              (tab === "url" && !url.trim()) ||
              (tab === "text" && !text.trim()) ||
              selectedPlatforms.length === 0
            }
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            재가공 시작하기
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
              2 크레딧
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 카드 ──

function PlatformCard({ item }: { item: PlatformResult }) {
  const [copied, setCopied] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);

  const handleCopy = async (content: string) => {
    const full =
      item.hashtags.length > 0
        ? `${content}\n\n${item.hashtags.join(" ")}`
        : content;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImprove = async () => {
    setImproving(true);
    try {
      const res = await fetch("/api/sns/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `기존 ${item.platform} 콘텐츠를 더 매력적이고 참여율이 높도록 개선해줘. 기존 내용: "${item.content}"`,
          platforms: [item.platform],
          tone: "친근한",
        }),
      });
      const data = await res.json();
      if (res.ok && data.platforms?.[0]) {
        setImproved(data.platforms[0].content);
      }
    } catch {
      /* ignore */
    } finally {
      setImproving(false);
    }
  };

  const platformIcon: Record<string, string> = {
    인스타그램: "📸",
    스레드: "🧵",
    "네이버 블로그": "📝",
    카카오채널: "💬",
    링크드인: "💼",
    "트위터/X": "🐦",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">
            {platformIcon[item.platform] || "📱"}
          </span>
          <span className="font-semibold text-slate-900">{item.platform}</span>
          <span className="text-xs text-slate-400">
            {item.char_count}자
          </span>
        </div>
        <button
          onClick={() => handleCopy(improved || item.content)}
          className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
        >
          {copied ? "복사됨 ✓" : "복사하기"}
        </button>
      </div>

      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
        {item.content}
      </p>

      {item.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.hashtags.map((tag, i) => (
            <span
              key={i}
              className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {improved && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium mb-1">
            개선된 콘텐츠
          </p>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {improved}
          </p>
        </div>
      )}

      {!improved && (
        <button
          onClick={handleImprove}
          disabled={improving}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
        >
          {improving ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              개선 중...
            </>
          ) : (
            <>
              이 콘텐츠 개선하기
              <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">
                1 크레딧
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── 결과 화면 ──

function ResultScreen({
  result,
  onReset,
}: {
  result: SnsResult;
  onReset: () => void;
}) {
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = async () => {
    const allText = result.platforms
      .map((p) => {
        let s = `[${p.platform}]\n${p.content}`;
        if (p.hashtags.length > 0) s += `\n\n${p.hashtags.join(" ")}`;
        return s;
      })
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(allText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">재가공 결과</h1>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            다시 재가공하기
          </button>
        </div>

        {/* 요약 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            콘텐츠 분석
          </h2>
          <p className="text-slate-700 mb-4">{result.original_topic}</p>
          {result.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((k, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 플랫폼별 결과 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            플랫폼별 콘텐츠
          </h2>
          <button
            onClick={handleCopyAll}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            {allCopied ? "전체 복사됨!" : "전체 복사"}
          </button>
        </div>

        <div className="space-y-4">
          {result.platforms.map((p, i) => (
            <PlatformCard key={i} item={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
