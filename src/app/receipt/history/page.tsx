"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getReceipts,
  getCategoryTotals,
  type Receipt,
} from "@/lib/receipt-store";

const CATEGORIES = [
  { id: "전체", icon: "📋" },
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

export default function HistoryPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [catFilter, setCatFilter] = useState("전체");

  useEffect(() => {
    setReceipts(getReceipts());
  }, []);

  const filtered = receipts.filter((r) => {
    if (!r.date.startsWith(month)) return false;
    if (catFilter !== "전체" && r.category !== catFilter) return false;
    return true;
  });

  const total = filtered.reduce((s, r) => s + r.total, 0);
  const catTotals = getCategoryTotals(
    receipts.filter((r) => r.date.startsWith(month)),
  );

  const handleCSV = () => {
    const header = "날짜,가게명,금액,카테고리,메모";
    const rows = filtered.map(
      (r) =>
        `${r.date},${r.store_name},${r.total},${r.category},${r.memo || ""}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `가계부_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <Link
          href="/receipt"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors"
        >
          &larr; 영수증 분석으로
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">지출 내역</h1>
          <button
            onClick={handleCSV}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            CSV 다운로드
          </button>
        </div>

        {/* 월 선택 */}
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="mb-4 p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                catFilter === c.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.icon} {c.id}
            </button>
          ))}
        </div>

        {/* 월별 총계 + 카테고리 분석 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <p className="text-sm text-slate-500 mb-1">
            {month.replace("-", "년 ")}월 총 지출
          </p>
          <p className="text-3xl font-bold text-slate-900 mb-4">
            {total.toLocaleString()}원
          </p>
          {Object.keys(catTotals).length > 0 && (
            <div className="space-y-2">
              {Object.entries(catTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                  const monthAll = receipts
                    .filter((r) => r.date.startsWith(month))
                    .reduce((s, r) => s + r.total, 0);
                  const pct =
                    monthAll > 0
                      ? Math.round((amount / monthAll) * 100)
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

        {/* 내역 목록 */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-12">
              저장된 내역이 없습니다.
            </p>
          )}
          {filtered.map((r) => {
            const icon =
              CATEGORIES.find((c) => c.id === r.category)?.icon || "📋";
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200"
              >
                <span className="text-2xl">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {r.store_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.date} · {r.category}
                    {r.memo ? ` · ${r.memo}` : ""}
                  </p>
                </div>
                <p className="font-semibold text-slate-900 shrink-0">
                  {r.total.toLocaleString()}원
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
