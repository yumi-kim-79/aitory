import Link from "next/link";

const services = [
  {
    href: "/contract",
    icon: "📄",
    title: "계약서 검토기",
    description: "AI가 계약서를 분석해 위험 조항을 찾아드립니다",
    available: true,
  },
  {
    href: "/review",
    icon: "⭐",
    title: "리뷰 분석 마케팅 문구",
    description: "고객 리뷰를 분석해 마케팅 문구를 자동 생성합니다",
    available: true,
  },
  {
    href: "/sns",
    icon: "📱",
    title: "SNS 콘텐츠 재가공",
    description: "블로그/영상 콘텐츠를 SNS용으로 자동 변환합니다",
    available: true,
  },
  {
    href: "/realestate",
    icon: "🏠",
    title: "부동산 공고문 생성",
    description: "조건 입력만으로 플랫폼별 공고문을 자동 생성합니다",
    available: true,
  },
  {
    href: "/store",
    icon: "🛒",
    title: "스마트스토어 상품등록",
    description: "상품 정보를 입력하면 플랫폼별 등록 문구를 자동 생성합니다",
    available: true,
  },
  {
    href: "/receipt",
    icon: "🧾",
    title: "AI 영수증/가계부",
    description: "영수증 사진으로 가계부를 자동 기록합니다",
    available: true,
  },
  {
    href: "/translate",
    icon: "🌐",
    title: "AI 번역 + 요약",
    description: "외국어 문서를 번역하고 핵심만 요약합니다",
    available: true,
  },
  {
    href: "/invoice",
    icon: "📋",
    title: "AI 견적서/인보이스",
    description: "전문적인 견적서를 자동으로 생성합니다",
    available: true,
  },
  {
    href: "/business-card",
    icon: "💼",
    title: "AI 명함 스캐너",
    description: "명함 사진으로 거래처를 자동으로 관리합니다",
    available: true,
  },
  {
    href: "/meeting",
    icon: "📝",
    title: "AI 회의록",
    description: "회의 내용을 자동으로 정리하고 액션 아이템을 추출합니다",
    available: true,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-5xl">
        {/* 헤더 */}
        <div className="text-center mb-14">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Aitory</h1>
          <p className="text-xl text-slate-500">
            AI가 당신의 업무를 대신합니다
          </p>
        </div>

        {/* 서비스 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {services.map((svc) => {
            const card = (
              <div
                className={`relative bg-white rounded-2xl border border-slate-200 p-7 transition-all ${
                  svc.available
                    ? "hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 cursor-pointer"
                    : "opacity-60 cursor-default"
                }`}
              >
                <div className="text-4xl mb-4">{svc.icon}</div>
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
