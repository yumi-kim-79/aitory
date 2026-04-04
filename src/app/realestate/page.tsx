"use client";

import { useState } from "react";
import Link from "next/link";

const PROPERTY_TYPES = ["원룸", "투룸", "오피스텔", "아파트", "상가", "사무실"];
const DEAL_TYPES = ["월세", "전세", "매매"];
const OPTIONS = [
  "주차가능", "엘리베이터", "풀옵션", "반려동물가능",
  "남향", "역세권", "신축", "관리비포함", "보안시스템",
  "에어컨", "세탁기", "냉장고", "인터넷포함",
];
const PLATFORMS = [
  { id: "네이버부동산", icon: "🏠" },
  { id: "직방", icon: "🔑" },
  { id: "다방", icon: "🚪" },
  { id: "당근마켓", icon: "🥕" },
];

interface PlatformResult {
  platform: string;
  title: string;
  content: string;
  char_count: number;
}

interface RealEstateResult {
  appeal_points: string[];
  platforms: PlatformResult[];
}

export default function RealEstatePage() {
  const [propertyType, setPropertyType] = useState("원룸");
  const [dealType, setDealType] = useState("월세");
  const [deposit, setDeposit] = useState("");
  const [monthly, setMonthly] = useState("");
  const [area, setArea] = useState("");
  const [floor, setFloor] = useState("");
  const [address, setAddress] = useState("");
  const [moveInType, setMoveInType] = useState<"immediate" | "date">("immediate");
  const [moveInDate, setMoveInDate] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "네이버부동산", "당근마켓",
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RealEstateResult | null>(null);
  const [error, setError] = useState("");

  const toggleOption = (o: string) =>
    setSelectedOptions((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );

  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const handleSubmit = async () => {
    setError("");
    if (!deposit.trim()) {
      setError("보증금을 입력해주세요.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("생성할 플랫폼을 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/realestate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType,
          dealType,
          deposit,
          monthly,
          area,
          floor,
          address,
          moveInDate: moveInType === "immediate" ? "즉시입주" : moveInDate,
          options: selectedOptions,
          extra,
          platforms: selectedPlatforms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "생성 중 오류가 발생했습니다.");
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
            공고문을 생성하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 플랫폼별 최적화된 공고문을 작성합니다
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return <ResultScreen result={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors"
        >
          &larr; 홈으로
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            부동산 임대 공고문 생성
          </h1>
          <p className="text-lg text-slate-500">
            조건 입력만으로 플랫폼별 공고문을 자동 생성합니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 매물 종류 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              매물 종류
            </label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setPropertyType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    propertyType === t
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 거래 종류 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              거래 종류
            </label>
            <div className="flex gap-2">
              {DEAL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setDealType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dealType === t
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 가격 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {dealType === "매매" ? "매매가" : "보증금"}
              </label>
              <input
                type="text"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="예: 1000만원"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {dealType === "월세" && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  월세
                </label>
                <input
                  type="text"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  placeholder="예: 50만원"
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            )}
          </div>

          {/* 면적 / 층수 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                면적
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="예: 33㎡ (10평)"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                층수
              </label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="예: 3층/5층"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* 주소 / 입주일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                주소
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울시 강남구"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                입주가능일
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setMoveInType("immediate")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    moveInType === "immediate"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  즉시입주
                </button>
                <button
                  onClick={() => setMoveInType("date")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    moveInType === "date"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  날짜 선택
                </button>
              </div>
              {moveInType === "date" && (
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              )}
            </div>
          </div>

          {/* 옵션 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              옵션/특징
            </label>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => toggleOption(o)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedOptions.includes(o)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {selectedOptions.includes(o) ? "✓ " : ""}
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* 추가 사항 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              추가 특이사항
            </label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="기타 어필하고 싶은 내용을 자유롭게 입력하세요..."
              className="w-full h-24 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* 플랫폼 선택 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              생성할 플랫폼
            </label>
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

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!deposit.trim() || selectedPlatforms.length === 0}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            공고문 생성하기
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
              2 크레딧
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 플랫폼 카드 ──

function PlatformCard({ item }: { item: PlatformResult }) {
  const [copied, setCopied] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improved, setImproved] = useState<string | null>(null);

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(`${item.title}\n\n${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImprove = async () => {
    setImproving(true);
    try {
      const res = await fetch("/api/realestate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType: "",
          dealType: "",
          deposit: "",
          monthly: "",
          area: "",
          floor: "",
          address: "",
          moveInDate: "",
          options: [],
          extra: `기존 ${item.platform} 공고문을 더 매력적으로 수정해줘. 기존 내용:\n제목: ${item.title}\n${item.content}`,
          platforms: [item.platform],
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

  const icons: Record<string, string> = {
    네이버부동산: "🏠",
    직방: "🔑",
    다방: "🚪",
    당근마켓: "🥕",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icons[item.platform] || "🏢"}</span>
          <span className="font-semibold text-slate-900">{item.platform}</span>
          <span className="text-xs text-slate-400">{item.char_count}자</span>
        </div>
        <button
          onClick={() => handleCopy(improved || item.content)}
          className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
        >
          {copied ? "복사됨 ✓" : "복사하기"}
        </button>
      </div>

      <p className="text-sm font-semibold text-slate-900 mb-2">{item.title}</p>
      <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
        {item.content}
      </p>

      {improved && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium mb-1">수정된 공고문</p>
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
              수정 중...
            </>
          ) : (
            <>
              이 공고문 수정하기
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
  result: RealEstateResult;
  onReset: () => void;
}) {
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = async () => {
    const allText = result.platforms
      .map((p) => `[${p.platform}]\n${p.title}\n\n${p.content}`)
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(allText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">생성 결과</h1>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            다시 생성하기
          </button>
        </div>

        {/* 어필 포인트 */}
        {result.appeal_points.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              핵심 어필 포인트
            </h2>
            <div className="flex flex-wrap gap-2">
              {result.appeal_points.map((p, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 플랫폼별 결과 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            플랫폼별 공고문
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
