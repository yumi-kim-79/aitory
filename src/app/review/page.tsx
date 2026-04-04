"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "url" | "text";

const PLATFORMS = ["스마트스토어", "쿠팡", "11번가", "지마켓"] as const;

const COPY_TYPES = [
  "상품 소개 문구",
  "SNS 광고 카피",
  "상세페이지 헤드라인",
  "검색 키워드",
] as const;

interface ReviewResult {
  positive_keywords: string[];
  negative_keywords: string[];
  purchase_reasons: string[];
  improvements: string[];
  marketing_copies: { type: string; content: string }[];
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<string>("스마트스토어");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    ...COPY_TYPES,
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState("");

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setResult(null);

    let reviewText = "";
    if (tab === "url") {
      if (!url.trim()) {
        setError("URL을 입력해주세요.");
        setLoading(false);
        return;
      }
      // URL에서 리뷰 크롤링은 서버에서 처리 불가 → 안내
      setError(
        "URL에서 리뷰를 자동으로 가져올 수 없습니다. 리뷰를 직접 복사해서 '리뷰 직접 입력' 탭에 붙여넣어 주세요.",
      );
      setLoading(false);
      return;
    } else {
      reviewText = text.trim();
    }

    if (!reviewText) {
      setError("리뷰 텍스트를 입력해주세요.");
      setLoading(false);
      return;
    }

    if (selectedTypes.length === 0) {
      setError("생성할 문구 종류를 1개 이상 선택해주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/review/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reviewText, types: selectedTypes }),
      });
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
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            리뷰를 분석하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 리뷰에서 키워드를 추출하고 마케팅 문구를 생성합니다
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        onReset={() => setResult(null)}
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
            리뷰 분석 마케팅 문구
          </h1>
          <p className="text-lg text-slate-500">
            고객 리뷰를 분석해 최적의 마케팅 문구를 생성합니다
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
              리뷰 직접 입력
            </button>
          </div>

          {/* URL 탭 */}
          {tab === "url" && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      platform === p
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`${platform} 상품 URL을 붙여넣으세요`}
                className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
              />
            </>
          )}

          {/* 텍스트 탭 */}
          {tab === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="고객 리뷰를 여기에 붙여넣으세요...&#10;&#10;예시:&#10;배송이 빠르고 포장도 꼼꼼해요. 품질이 좋고 가격도 합리적이에요.&#10;다만 색상이 사진과 약간 달라요."
              className="w-full h-48 p-4 border border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder:text-slate-400"
            />
          )}

          {/* 문구 종류 선택 */}
          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              생성할 문구 종류
            </p>
            <div className="flex flex-wrap gap-2">
              {COPY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedTypes.includes(t)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {selectedTypes.includes(t) ? "✓ " : ""}
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
              selectedTypes.length === 0
            }
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            분석 시작하기
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

function CopyCard({
  copy,
}: {
  copy: { type: string; content: string };
}) {
  const [copied, setCopied] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImprove = async () => {
    setImproving(true);
    try {
      const res = await fetch("/api/review/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `기존 마케팅 문구를 더 매력적이고 클릭율이 높도록 개선해줘. 기존 문구: "${copy.content}"`,
          types: [copy.type],
        }),
      });
      const data = await res.json();
      if (res.ok && data.marketing_copies?.[0]) {
        setImproved(data.marketing_copies[0].content);
      }
    } catch {
      /* ignore */
    } finally {
      setImproving(false);
    }
  };

  const typeBadgeColor: Record<string, string> = {
    "상품 소개 문구": "bg-blue-100 text-blue-700",
    "SNS 광고 카피": "bg-pink-100 text-pink-700",
    "상세페이지 헤드라인": "bg-amber-100 text-amber-700",
    "검색 키워드": "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            typeBadgeColor[copy.type] || "bg-slate-100 text-slate-600"
          }`}
        >
          {copy.type}
        </span>
        <button
          onClick={() => handleCopy(improved || copy.content)}
          className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
        >
          {copied ? "복사됨 ✓" : "복사하기"}
        </button>
      </div>
      <p className="text-slate-800 leading-relaxed">{copy.content}</p>

      {improved && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium mb-1">
            개선된 문구
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">{improved}</p>
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
              이 문구 개선하기
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

function ResultScreen({
  result,
  onReset,
}: {
  result: ReviewResult;
  onReset: () => void;
}) {
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = async () => {
    const allText = result.marketing_copies
      .map((c) => `[${c.type}]\n${c.content}`)
      .join("\n\n");
    await navigator.clipboard.writeText(allText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
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

        {/* 리뷰 분석 요약 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-5">
            리뷰 분석 요약
          </h2>

          {/* 긍정 키워드 */}
          {result.positive_keywords.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600 mb-2">
                긍정 키워드
              </p>
              <div className="flex flex-wrap gap-2">
                {result.positive_keywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full border border-emerald-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 부정 키워드 */}
          {result.negative_keywords.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600 mb-2">
                부정 키워드
              </p>
              <div className="flex flex-wrap gap-2">
                {result.negative_keywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-red-50 text-red-700 text-sm rounded-full border border-red-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 구매 이유 */}
          {result.purchase_reasons.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-600 mb-2">
                주요 구매 이유
              </p>
              <ul className="text-sm text-slate-700 space-y-1">
                {result.purchase_reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선 사항 */}
          {result.improvements.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">
                개선 요구 사항
              </p>
              <ul className="text-sm text-slate-700 space-y-1">
                {result.improvements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 마케팅 문구 카드 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            생성된 마케팅 문구
          </h2>
          <button
            onClick={handleCopyAll}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            {allCopied ? "전체 복사됨!" : "전체 복사"}
          </button>
        </div>

        <div className="space-y-4">
          {result.marketing_copies.map((copy, i) => (
            <CopyCard key={i} copy={copy} />
          ))}
        </div>
      </div>
    </div>
  );
}
