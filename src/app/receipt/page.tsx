"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  saveReceipt,
  getReceiptsByMonth,
  getCategoryTotals,
  type Receipt,
} from "@/lib/receipt-store";

type Tab = "upload" | "manual";

const CATEGORIES = [
  { id: "식비", icon: "🍽️" },
  { id: "교통", icon: "🚗" },
  { id: "쇼핑", icon: "🛍️" },
  { id: "의료", icon: "🏥" },
  { id: "여가", icon: "🎮" },
  { id: "교육", icon: "📚" },
  { id: "주거", icon: "🏠" },
  { id: "업무", icon: "💼" },
  { id: "기타", icon: "📋" },
];

interface AnalyzeResult {
  store_name: string;
  date: string;
  time: string;
  items: { name: string; price: number }[];
  total: number;
  category: string;
  payment_method: string;
}

export default function ReceiptPage() {
  const [tab, setTab] = useState<Tab>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [manualStore, setManualStore] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [manualCategory, setManualCategory] = useState("식비");
  const [manualMemo, setManualMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [memo, setMemo] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이번달 통계
  const [monthTotal, setMonthTotal] = useState(0);
  const [catTotals, setCatTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const monthReceipts = getReceiptsByMonth(ym);
    setMonthTotal(monthReceipts.reduce((s, r) => s + r.total, 0));
    setCatTotals(getCategoryTotals(monthReceipts));
  }, [saved]);

  const handleUploadSubmit = async () => {
    if (files.length === 0) {
      setError("영수증 이미지를 업로드해주세요.");
      return;
    }

    const MAX_SIZE = 4 * 1024 * 1024;
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_SIZE) {
      setError(`파일이 너무 큽니다 (${(totalSize / 1024 / 1024).toFixed(1)}MB). 4MB 이하로 압축해주세요.`);
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
      // 파일을 base64로 변환 (FormData 대신 JSON 사용 — Vercel serverless에서 더 안정적)
      const images = await Promise.all(
        files.map(async (f) => {
          const buffer = await f.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
          return { name: f.name, ext, base64 };
        }),
      );

      console.log("[receipt] 업로드 시작:", images.length, "개, 총", (totalSize / 1024).toFixed(0), "KB");

      const res = await fetch("/api/receipt/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      console.log("[receipt] 응답:", res.status, res.statusText);

      const data = await res.json().catch(() => ({ error: `응답 파싱 실패 (${res.status})` }));

      if (!res.ok) {
        setError(data.error || `분석 실패 (${res.status})`);
      } else {
        setResult(data);
        setEditCategory(data.category || "기타");
      }
    } catch (e) {
      console.error("[receipt] 업로드 에러:", e);
      setError(`업로드 실패: ${e instanceof Error ? e.message : "알 수 없음"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualStore.trim() || !manualAmount.trim()) {
      setError("가게명과 금액을 입력해주세요.");
      return;
    }
    const amount = parseInt(manualAmount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(amount)) {
      setError("올바른 금액을 입력해주세요.");
      return;
    }
    setResult({
      store_name: manualStore,
      date: manualDate,
      time: "",
      items: [{ name: "직접 입력", price: amount }],
      total: amount,
      category: manualCategory,
      payment_method: "기타",
    });
    setEditCategory(manualCategory);
    setMemo(manualMemo);
    setSaved(false);
  };

  const handleSave = () => {
    if (!result) return;
    const receipt: Receipt = {
      id: crypto.randomUUID(),
      store_name: result.store_name,
      date: result.date,
      time: result.time,
      items: result.items,
      total: result.total,
      category: editCategory,
      memo,
      payment_method: result.payment_method,
      created_at: new Date().toISOString(),
    };
    saveReceipt(receipt);
    setSaved(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            영수증을 분석하고 있어요...
          </h2>
          <p className="text-slate-500">
            AI가 영수증에서 품목과 금액을 인식합니다
          </p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col flex-1 items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-slate-900">분석 결과</h1>
            <button
              onClick={() => {
                setResult(null);
                setFiles([]);
                setSaved(false);
                setMemo("");
              }}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              다시 분석
            </button>
          </div>

          {/* 영수증 정보 */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
            {(() => {
              const sn = (result.store_name || "").trim();
              const uncertain =
                !sn ||
                /알 수 없음|불명확|미확인|unknown|항목\d*/i.test(sn) ||
                sn.length < 2;
              return uncertain ? (
                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700">
                    ⚠️ 가게명 인식이 불확실합니다. 영수증을 더 선명하게 촬영해서 다시 올려주세요.
                  </p>
                </div>
              ) : null;
            })()}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {result.store_name || "가게명 미확인"}
              </h2>
              <span className="text-sm text-slate-500">
                {result.date}
                {result.time ? ` ${result.time}` : ""}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {result.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-sm text-slate-700">{item.name}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {item.price.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t-2 border-slate-900">
              <span className="font-semibold text-slate-900">합계</span>
              <span className="text-xl font-bold text-slate-900">
                {result.total.toLocaleString()}원
              </span>
            </div>

            {/* 카테고리 */}
            <div className="mt-6">
              <p className="text-sm font-medium text-slate-600 mb-2">
                카테고리
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setEditCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      editCategory === c.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.icon} {c.id}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="mt-4">
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모 추가..."
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* 저장 */}
            <button
              onClick={handleSave}
              disabled={saved}
              className={`w-full mt-4 py-3 rounded-xl font-medium transition-colors ${
                saved
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {saved ? "저장 완료 ✓" : "가계부에 저장"}
            </button>
          </div>

          {/* 재촬영 안내 */}
          <div className="mb-6">
            <button
              onClick={() => {
                setResult(null);
                setFiles([]);
                setSaved(false);
                setMemo("");
                setError("");
              }}
              className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
            >
              📷 인식이 잘못됐나요? 다시 선명하게 찍어서 올리기
            </button>
          </div>

          {/* 이번달 요약 */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                이번달 지출 요약
              </h2>
              <Link
                href="/receipt/history"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                지출 내역 보기 →
              </Link>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-4">
              {monthTotal.toLocaleString()}원
            </p>
            {Object.keys(catTotals).length > 0 && (
              <div className="space-y-2">
                {Object.entries(catTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => {
                    const pct =
                      monthTotal > 0
                        ? Math.round((amount / monthTotal) * 100)
                        : 0;
                    const icon =
                      CATEGORIES.find((c) => c.id === cat)?.icon || "📋";
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-600">
                            {icon} {cat}
                          </span>
                          <span className="text-slate-900 font-medium">
                            {amount.toLocaleString()}원 ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 입력 화면 ──
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
            AI 영수증/가계부
          </h1>
          <p className="text-lg text-slate-500">
            영수증 사진으로 가계부를 자동으로 기록합니다
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
              영수증 업로드
            </button>
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
          </div>

          {tab === "upload" && (
            <>
              {files.length > 0 && (
                <div className="mb-3 space-y-2">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <span className="text-purple-500 text-sm font-bold px-2 py-0.5 rounded bg-purple-50">
                        IMG
                      </span>
                      <span className="text-sm text-slate-700 flex-1 truncate">
                        {f.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles(files.filter((_, j) => j !== i));
                        }}
                        className="text-slate-400 hover:text-red-500 text-lg px-1"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const dropped = Array.from(e.dataTransfer.files);
                  const heic = dropped.find((f) => /\.(heic|heif)$/i.test(f.name));
                  if (heic) {
                    setError("HEIC 파일은 지원하지 않습니다. 아이폰 설정 → 카메라 → 포맷 → '높은 호환성'으로 변경 후 촬영해주세요.");
                    return;
                  }
                  const newFiles = dropped.filter((f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(f.name));
                  if (newFiles.length === 0) {
                    setError("JPG, PNG, WEBP 이미지만 업로드 가능합니다.");
                    return;
                  }
                  setError("");
                  setFiles((prev) => [...prev, ...newFiles]);
                }}
                className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                  files.length > 0 ? "p-6" : "p-12"
                } ${
                  dragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const selected = Array.from(e.target.files);
                      const heic = selected.find((f) => /\.(heic|heif)$/i.test(f.name));
                      if (heic) {
                        setError("HEIC 파일은 지원하지 않습니다. 아이폰 설정 → 카메라 → 포맷 → '높은 호환성'으로 변경 후 촬영해주세요.");
                      } else {
                        setError("");
                        setFiles((prev) => [...prev, ...selected]);
                      }
                    }
                    e.target.value = "";
                  }}
                />
                {files.length > 0 ? (
                  <p className="text-slate-500 text-sm">
                    클릭하거나 드래그하여 추가
                  </p>
                ) : (
                  <>
                    <div className="text-4xl mb-3">📷</div>
                    <p className="text-slate-600 font-medium">
                      영수증 사진을 업로드하세요
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      JPG, PNG, WEBP · 여러 장 가능 · 4MB 이하
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      HEIC는 미지원 (아이폰: 설정 → 카메라 → &lsquo;높은 호환성&rsquo;)
                    </p>
                  </>
                )}
              </div>

              {/* 촬영 가이드 */}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800 font-medium mb-1">📷 영수증이 선명하게 보이도록 촬영해주세요</p>
                <ul className="text-xs text-blue-700 space-y-0.5">
                  <li>• 글씨가 흐리거나 기울어지면 인식 오류가 생길 수 있어요</li>
                  <li>• 4MB 이하 JPG, PNG 형식을 권장합니다</li>
                  <li>• 전체가 프레임 안에 들어오도록 촬영해주세요</li>
                </ul>
              </div>
            </>
          )}

          {tab === "manual" && (
            <div className="space-y-4">
              <input
                type="text"
                value={manualStore}
                onChange={(e) => setManualStore(e.target.value)}
                placeholder="가게명"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <input
                type="text"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="금액 (예: 15000)"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setManualCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      manualCategory === c.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.icon} {c.id}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={manualMemo}
                onChange={(e) => setManualMemo(e.target.value)}
                placeholder="메모 (선택)"
                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          )}

          {error && (
            <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={
              tab === "upload" ? handleUploadSubmit : handleManualSubmit
            }
            disabled={
              (tab === "upload" && files.length === 0) ||
              (tab === "manual" &&
                (!manualStore.trim() || !manualAmount.trim()))
            }
            className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {tab === "upload" ? "분석하기" : "저장하기"}
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">
              1 크레딧
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
