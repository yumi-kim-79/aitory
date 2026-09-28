import Link from "next/link";

// 이용권 판매 채널 URL (스마트스토어 등). 준비되면 여기에 입력하세요.
const STORE_URL = "";

const plans = [
  {
    name: "무료 체험",
    price: "0원",
    period: "",
    credits: "10 크레딧",
    maxFiles: "최대 3개",
    features: ["모든 서비스 사용 가능", "파일 업로드 3개", "가입 즉시 지급"],
    cta: "무료로 시작하기",
    href: "/auth/signup",
    kind: "free" as const,
    highlight: false,
  },
  {
    name: "스타터 이용권",
    price: "9,900원",
    period: "",
    credits: "100 크레딧",
    maxFiles: "최대 10개",
    features: ["모든 서비스 사용 가능", "파일 업로드 10개", "유효기간 없음", "사용 이력 관리"],
    cta: "이용권 구매",
    kind: "paid" as const,
    highlight: true,
  },
  {
    name: "프로 이용권",
    price: "29,900원",
    period: "",
    credits: "500 크레딧",
    maxFiles: "최대 20개",
    features: ["모든 서비스 사용 가능", "파일 업로드 20개", "유효기간 없음", "우선 지원"],
    cta: "이용권 구매",
    kind: "paid" as const,
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">요금제</h1>
          <p className="text-lg text-slate-500">필요한 만큼 이용권을 충전해서 사용하세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
              {plan.kind === "free" ? (
                <Link
                  href={plan.href!}
                  className="block text-center py-3 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                >
                  {plan.cta}
                </Link>
              ) : STORE_URL ? (
                <a
                  href={STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </a>
              ) : (
                <a
                  href="#how"
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* 구매 방법 */}
        <div id="how" className="max-w-2xl mx-auto mb-16 bg-blue-50 border border-blue-100 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">이용권 구매 & 등록 방법</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3"><span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span> 스마트스토어에서 이용권을 구매합니다.</li>
            <li className="flex gap-3"><span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span> 구매 완료 후 <b>이용권 코드</b>(AITORY-XXXX-XXXX)를 받습니다.</li>
            <li className="flex gap-3"><span className="flex-none w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span> <Link href="/mypage" className="text-blue-700 underline font-medium">마이페이지 → 이용권 등록</Link>에 코드를 입력하면 크레딧이 즉시 충전됩니다.</li>
          </ol>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">자주 묻는 질문</h2>
          {[
            { q: "크레딧이란 무엇인가요?", a: "크레딧은 각 AI 서비스를 사용할 때 소모되는 포인트입니다. 서비스별로 1~3 크레딧이 소모됩니다." },
            { q: "이용권은 유효기간이 있나요?", a: "없습니다. 충전한 크레딧은 소진할 때까지 유지됩니다." },
            { q: "이용권 코드는 어디서 등록하나요?", a: "로그인 후 마이페이지의 '이용권 등록'란에 코드를 입력하면 바로 충전됩니다." },
            { q: "환불 정책은 어떻게 되나요?", a: "등록(사용) 전 코드는 구매처 정책에 따라 환불 가능합니다. 이미 등록된 코드는 환불되지 않습니다." },
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
