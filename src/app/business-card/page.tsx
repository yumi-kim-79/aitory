"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getCards,
  searchCards,
  deleteCard,
  generateVCard,
  type BusinessCard,
} from "@/lib/business-card-store";

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-amber-100 text-amber-700",
  잠재고객: "bg-blue-100 text-blue-700",
  거래중: "bg-emerald-100 text-emerald-700",
  파트너: "bg-purple-100 text-purple-700",
  협력사: "bg-pink-100 text-pink-700",
  기타: "bg-slate-100 text-slate-600",
};

export default function BusinessCardPage() {
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCards(getCards());
  }, []);

  const filtered = query.trim() ? searchCards(query) : cards;

  const handleCSV = () => {
    const header = "이름,회사,직책,전화,이메일,태그";
    const rows = cards.map(
      (c) =>
        `"${c.name}","${c.company}","${c.title}","${c.phones.join(";")}","${c.emails.join(";")}","${c.tags.join(";")}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "거래처목록.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVCard = (card: BusinessCard) => {
    const vcf = generateVCard(card);
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${card.name || "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    deleteCard(id);
    setCards(getCards());
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 명함 스캐너</h1>
          <p className="text-lg text-slate-500">명함 사진으로 거래처를 자동으로 관리합니다</p>
        </div>

        {/* 상단 액션 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Link href="/business-card/scan" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-medium text-center hover:bg-slate-800 transition-colors">
            명함 스캔하기
          </Link>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 회사, 이메일 검색..."
            className="flex-1 p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {cards.length > 0 && (
            <button onClick={handleCSV} className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors shrink-0">
              CSV 내보내기
            </button>
          )}
        </div>

        {/* 거래처 목록 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">💼</div>
            <p className="text-slate-400">
              {query ? "검색 결과가 없습니다." : "저장된 거래처가 없습니다."}
            </p>
            {!query && (
              <Link href="/business-card/scan" className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
                명함 스캔하기 →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((card) => (
              <div key={card.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start gap-4">
                  {card.imageData && (
                    <img
                      src={card.imageData}
                      alt="명함"
                      className="w-20 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{card.name || "이름 없음"}</span>
                      {card.tags.map((t) => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[t] || TAG_COLORS["기타"]}`}>{t}</span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-500">{[card.company, card.title].filter(Boolean).join(" · ")}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                      {card.phones[0] && <span>{card.phones[0]}</span>}
                      {card.emails[0] && <span>{card.emails[0]}</span>}
                      {card.lastContact && <span>최근접촉: {card.lastContact}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {card.phones[0] && (
                      <a href={`tel:${card.phones[0]}`} className="p-2 text-slate-400 hover:text-blue-600" title="전화">📞</a>
                    )}
                    {card.emails[0] && (
                      <a href={`mailto:${card.emails[0]}`} className="p-2 text-slate-400 hover:text-blue-600" title="이메일">✉️</a>
                    )}
                    <button onClick={() => handleVCard(card)} className="p-2 text-slate-400 hover:text-emerald-600" title="vCard 다운로드">📇</button>
                    <button onClick={() => handleDelete(card.id)} className="p-2 text-slate-400 hover:text-red-500" title="삭제">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6">{cards.length}개 거래처</p>
      </div>
    </div>
  );
}
