"use client";

import { useState } from "react";
import Link from "next/link";

type Category = "전체" | "문서작성" | "문서분석" | "마케팅" | "비즈니스";

const CATEGORIES: { id: Category; icon: string; label: string }[] = [
  { id: "전체", icon: "🏠", label: "전체" },
  { id: "문서작성", icon: "📄", label: "문서 작성" },
  { id: "문서분석", icon: "🔍", label: "문서 분석" },
  { id: "마케팅", icon: "📣", label: "마케팅" },
  { id: "비즈니스", icon: "🏢", label: "비즈니스" },
];

const services = [
  // 문서 작성
  { href: "/resume", icon: "📑", title: "AI 이력서/자기소개서", description: "지원 직무에 최적화된 이력서와 자기소개서를 AI가 작성합니다", available: true, category: "문서작성" as Category },
  { href: "/invoice", icon: "📋", title: "AI 견적서/인보이스", description: "전문적인 견적서를 자동으로 생성합니다", available: true, category: "문서작성" as Category },
  { href: "/meeting", icon: "📝", title: "AI 회의록 자동 생성", description: "회의 내용을 자동으로 정리하고 액션 아이템을 추출합니다", available: true, category: "문서작성" as Category },
  { href: "/legal", icon: "⚖️", title: "AI 법률 문서 + 상담", description: "내용증명 등 법률 문서 자동 작성 + AI 법률 상담", available: true, category: "문서작성" as Category },
  { href: "/labor", icon: "📃", title: "AI 근로계약서", description: "근로조건에 맞는 표준 근로계약서를 자동 생성합니다", available: false, category: "문서작성" as Category },

  // 문서 분석
  { href: "/contract", icon: "📄", title: "계약서 검토기", description: "AI가 계약서를 분석해 위험 조항을 찾아드립니다", available: true, category: "문서분석" as Category },
  { href: "/translate", icon: "🌐", title: "AI 번역 + 요약", description: "외국어 문서를 번역하고 핵심만 요약합니다", available: true, category: "문서분석" as Category },
  { href: "/receipt", icon: "🧾", title: "AI 영수증/가계부", description: "영수증 사진으로 가계부를 자동 기록합니다", available: true, category: "문서분석" as Category },

  // 마케팅
  { href: "/review", icon: "⭐", title: "리뷰 분석 마케팅 문구", description: "고객 리뷰를 분석해 마케팅 문구를 자동 생성합니다", available: true, category: "마케팅" as Category },
  { href: "/sns", icon: "📱", title: "SNS 콘텐츠 재가공", description: "블로그/영상 콘텐츠를 SNS용으로 자동 변환합니다", available: true, category: "마케팅" as Category },
  { href: "/store", icon: "🛒", title: "스마트스토어 상품등록", description: "상품 정보를 입력하면 플랫폼별 등록 문구를 자동 생성합니다", available: true, category: "마케팅" as Category },
  { href: "/menu", icon: "🍽️", title: "AI 식당 메뉴판", description: "메뉴 정보를 입력하면 매력적인 메뉴판을 자동 생성합니다", available: false, category: "마케팅" as Category },

  // 비즈니스
  { href: "/realestate", icon: "🏠", title: "부동산 공고문 생성", description: "조건 입력만으로 플랫폼별 공고문을 자동 생성합니다", available: true, category: "비즈니스" as Category },
  { href: "/business-card", icon: "💼", title: "AI 명함 스캐너", description: "명함 사진으로 거래처를 자동으로 관리합니다", available: true, category: "비즈니스" as Category },
  { href: "/cs", icon: "💬", title: "AI 쇼핑몰 CS 답변", description: "고객 문의에 대한 전문적인 답변을 자동 생성합니다", available: false, category: "비즈니스" as Category },
  { href: "/petition", icon: "🏛️", title: "AI 민원서류 작성", description: "민원 내용을 입력하면 공공기관 제출용 서류를 작성합니다", available: false, category: "비즈니스" as Category },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("전체");

  const filtered = services.filter((svc) => {
    const matchCategory =
      activeCategory === "전체" || svc.category === activeCategory;
    const matchSearch =
      !search.trim() ||
      svc.title.toLowerCase().includes(search.toLowerCase()) ||
      svc.description.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-5xl">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Aitory</h1>
          <p className="text-xl text-slate-500">
            AI가 당신의 업무를 대신합니다
          </p>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="서비스 검색... (예: 이력서, 계약서, SNS)"
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-sm"
          />
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* 서비스 카드 그리드 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((svc) => {
              const catIcon =
                CATEGORIES.find((c) => c.id === svc.category)?.icon || "";
              const card = (
                <div
                  className={`relative bg-white rounded-2xl border border-slate-200 p-7 transition-all ${
                    svc.available
                      ? "hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 cursor-pointer"
                      : "opacity-60 cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{svc.icon}</span>
                    <span className="text-xs text-slate-400">{catIcon}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    {svc.title}
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">
                    {svc.description}
                  </p>
                  <span
                    className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                      svc.available
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {svc.available ? "사용 가능" : "준비중"}
                  </span>
                </div>
              );

              if (svc.available) {
                return (
                  <Link key={svc.href} href={svc.href} className="block">
                    {card}
                  </Link>
                );
              }
              return <div key={svc.href}>{card}</div>;
            })}
          </div>
        )}

        {/* 하단 크레딧 안내 */}
        <div className="mt-14 text-center">
          <div className="inline-flex items-center gap-3 text-sm text-slate-400 bg-slate-50 rounded-full px-6 py-3 border border-slate-200">
            <span>무료 체험 10회</span>
            <span className="w-px h-4 bg-slate-300" />
            <span>스타터 9,900원/월</span>
            <span className="w-px h-4 bg-slate-300" />
            <span>프로 29,900원/월</span>
          </div>
        </div>
      </div>
    </div>
  );
}
