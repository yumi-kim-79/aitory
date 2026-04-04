import Link from "next/link";

const plans = [
  {
    name: "무료",
    price: "0원",
    period: "",
    credits: "월 10회",
    maxFiles: "최대 3개",
    features: ["모든 서비스 사용 가능", "파일 업로드 3개", "기본 지원"],
    cta: "시작하기",
    href: "/auth/signup",
    highlight: false,
  },
  {
    name: "스타터",
    price: "9,900원",
    period: "/월",
    credits: "월 100회",
    maxFiles: "최대 10개",
    features: ["모든 서비스 사용 가능", "파일 업로드 10개", "우선 지원", "사용 이력 관리"],
    cta: "선택하기",
    href: "/auth/signup",
    highlight: true,
  },
  {
    name: "프로",
    price: "29,900원",
    period: "/월",
    credits: "무제한",
    maxFiles: "최대 20개",
    features: ["모든 서비스 사용 가능", "파일 업로드 20개", "전담 지원", "API 접근", "팀 공유 기능"],
    cta: "선택하기",
    href: "/auth/signup",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">요금제</h1>
          <p className="text-lg text-slate-500">필요에 맞는 플랜을 선택하세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-blue-500 shadow-xl ring-2 ring-blue-500 relative"
                  : "border-slate-200 shadow-lg"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  추천
                </span>
              )}
              <h2 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h2>
              <div className="mb-4">
                <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-slate-500">{plan.period}</span>
              </div>
              <div className="flex gap-4 mb-6 text-sm">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">{plan.credits}</span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">{plan.maxFiles}</span>
              </div>
              <ul className="space-y-2 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">자주 묻는 질문</h2>
          {[
            { q: "크레딧이란 무엇인가요?", a: "크레딧은 각 AI 서비스를 사용할 때 소모되는 포인트입니다. 서비스별로 1~3 크레딧이 소모됩니다." },
            { q: "크레딧은 매월 초기화되나요?", a: "네, 매월 1일에 플랜에 해당하는 크레딧으로 초기화됩니다." },
            { q: "플랜을 변경할 수 있나요?", a: "언제든지 업그레이드 또는 다운그레이드할 수 있습니다. 변경 즉시 적용됩니다." },
            { q: "환불 정책은 어떻게 되나요?", a: "결제 후 7일 이내 사용 이력이 없으면 전액 환불 가능합니다." },
          ].map((faq, i) => (
            <div key={i} className="mb-4 p-5 bg-white rounded-xl border border-slate-200">
              <p className="font-medium text-slate-900 mb-2">{faq.q}</p>
              <p className="text-sm text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
