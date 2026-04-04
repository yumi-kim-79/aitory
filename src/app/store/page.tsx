"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "manual" | "excel";

const CATEGORIES = [
  "의류", "식품", "전자기기", "생활용품",
  "뷰티", "스포츠", "가구/인테리어", "기타",
];
const TARGETS = ["20대여성", "30대여성", "남성", "주부", "시니어", "전체"];
const SELL_PLATFORMS = [
  { id: "스마트스토어", icon: "🟢" },
  { id: "쿠팡", icon: "🟠" },
  { id: "11번가", icon: "🔴" },
  { id: "지마켓/옥션", icon: "🟡" },
];
const GEN_ITEMS = [
  "상품명", "상품 소개글", "상세설명", "검색 태그/키워드", "상품 특징 bullet points",
];

interface PlatformResult {
  platform: string;
  product_name: string;
  intro: string;
  description: string;
  tags: string[];
  bullets: string[];
}

interface StoreResult {
  platforms: PlatformResult[];
}

export default function StorePage() {
  const [tab, setTab] = useState<Tab>("manual");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("의류");
  const [features, setFeatures] = useState("");
  const [price, setPrice] = useState("");
  const [target, setTarget] = useState("전체");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "스마트스토어", "쿠팡",
  ]);
  const [selectedItems, setSelectedItems] = useState<string[]>([...GEN_ITEMS]);
  const [excelProducts, setExcelProducts] = useState<
    { name: string; category: string; features: string; price: string; target: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoreResult | null>(null);
  const [error, setError] = useState("");

  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  const toggleItem = (i: string) =>
    setSelectedItems((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const handleExcelUpload = async (file: File) => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
    const products = rows.map((r) => ({
      name: r["상품명"] || "",
      category: r["카테고리"] || "",
      features: r["특징/스펙"] || "",
      price: r["가격"] || "",
      target: r["타겟고객"] || "",
    }));
    setExcelProducts(products);
    if (products.length > 0) {
      setProductName(products[0].name);
      setCategory(products[0].category || "기타");
      setFeatures(products[0].features);
      setPrice(products[0].price);
      setTarget(products[0].target || "전체");
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!productName.trim()) {
      setError("상품명을 입력해주세요.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("플랫폼을 1개 이상 선택해주세요.");
      return;
    }
    if (selectedItems.length === 0) {
      setError("생성할 항목을 1개 이상 선택해주세요.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/store/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          category,
          features,
          price,
          target,
          platforms: selectedPlatforms,
          items: selectedItems,
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
            상품 문구를 생성하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 플랫폼별 최적화된 상품 등록 문구를 작성합니다
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
            스마트스토어 상품등록 자동화
          </h1>
          <p className="text-lg text-slate-500">
            상품 정보를 입력하면 플랫폼별 등록 문구를 자동 생성합니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab("manual")}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tab === "manual"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              직접 입력
            </button>
            <button
              onClick={() => setTab("excel")}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tab === "excel"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              엑셀 업로드
            </button>
          </div>

          {tab === "excel" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex-1 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleExcelUpload(f);
                    }}
                  />
                  <p className="text-slate-600 text-sm font-medium">
                    엑셀 파일을 선택하세요 (.xlsx)
                  </p>
                </label>
                <a
                  href="/api/store/sample-excel"
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors shrink-0"
                >
                  샘플 양식
                </a>
              </div>
              {excelProducts.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm text-emerald-700 font-medium mb-1">
                    {excelProducts.length}개 상품 로드됨
                  </p>
                  <p className="text-xs text-emerald-600">
                    첫 번째 상품: {excelProducts[0].name}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 상품 정보 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              상품명
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="예: 여성 니트 가디건 울혼방"
              className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    category === c
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              주요 특징/스펙
            </label>
            <textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="소재, 사이즈, 색상, 원산지 등 상품 특징을 입력하세요"
              className="w-full h-24 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                가격
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="예: 29,900원"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                타겟 고객
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TARGETS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      target === t
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 플랫폼 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              생성할 플랫폼
            </label>
            <div className="flex flex-wrap gap-2">
              {SELL_PLATFORMS.map((p) => (
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

          {/* 항목 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              생성할 항목
            </label>
            <div className="flex flex-wrap gap-2">
              {GEN_ITEMS.map((i) => (
                <button
                  key={i}
                  onClick={() => toggleItem(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedItems.includes(i)
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {selectedItems.includes(i) ? "✓ " : ""}
                  {i}
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
              !productName.trim() ||
              selectedPlatforms.length === 0 ||
              selectedItems.length === 0
            }
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            상품 문구 생성하기
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 transition-colors shrink-0"
    >
      {copied ? "복사됨 ✓" : "복사"}
    </button>
  );
}

function ResultScreen({
  result,
  onReset,
}: {
  result: StoreResult;
  onReset: () => void;
}) {
  const [activeTab, setActiveTab] = useState(
    result.platforms[0]?.platform || "",
  );
  const [downloading, setDownloading] = useState(false);

  const activePlatform = result.platforms.find(
    (p) => p.platform === activeTab,
  );

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/store/download-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: result.platforms }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "상품등록_결과.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setDownloading(false);
    }
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

        {/* 플랫폼 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {result.platforms.map((p) => (
            <button
              key={p.platform}
              onClick={() => setActiveTab(p.platform)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === p.platform
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p.platform}
            </button>
          ))}
        </div>

        {/* 활성 플랫폼 결과 */}
        {activePlatform && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-5">
            {/* 상품명 */}
            {activePlatform.product_name && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">
                    상품명
                  </span>
                  <CopyButton text={activePlatform.product_name} />
                </div>
                <p className="text-lg font-semibold text-slate-900">
                  {activePlatform.product_name}
                </p>
              </div>
            )}

            {/* 소개글 */}
            {activePlatform.intro && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">
                    소개글
                  </span>
                  <CopyButton text={activePlatform.intro} />
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {activePlatform.intro}
                </p>
              </div>
            )}

            {/* 상세설명 */}
            {activePlatform.description && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">
                    상세설명
                  </span>
                  <CopyButton text={activePlatform.description} />
                </div>
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap p-4 bg-slate-50 rounded-lg">
                  {activePlatform.description}
                </p>
              </div>
            )}

            {/* 태그 */}
            {activePlatform.tags?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">
                    검색 태그
                  </span>
                  <CopyButton
                    text={activePlatform.tags.join(", ")}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activePlatform.tags.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bullets */}
            {activePlatform.bullets?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">
                    상품 특징
                  </span>
                  <CopyButton
                    text={activePlatform.bullets
                      .map((b) => `• ${b}`)
                      .join("\n")}
                  />
                </div>
                <ul className="space-y-1.5">
                  {activePlatform.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span className="text-blue-500 mt-0.5">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 엑셀 다운로드 */}
        <button
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="w-full mt-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              엑셀로 전체 결과 다운로드
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                2 크레딧
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
