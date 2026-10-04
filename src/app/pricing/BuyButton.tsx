"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 이용권 구매 버튼.
 *
 * 로그인한 사람  → 스마트스토어 상품 페이지를 새 탭으로 바로 엽니다.
 * 로그인 안 한 사람 → 가입 안내를 한 번 띄웁니다.
 *   이용권 코드는 Aitory 계정에 등록해야 크레딧이 들어가므로,
 *   가입을 먼저 해두면 구매 후 코드만 붙여넣으면 끝나기 때문입니다.
 *   그래도 그냥 사겠다는 사람은 막지 않습니다. (판매를 놓치면 안 되니까)
 *
 * storeUrl 이 비어 있으면 기존처럼 아래 "구매 & 등록 방법"(#how)으로 스크롤합니다.
 */
export default function BuyButton({
  cta,
  storeUrl,
  highlight,
}: {
  cta: string;
  storeUrl: string;
  highlight: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const primaryRef = useRef<HTMLAnchorElement>(null);

  // 모달이 열린 동안: ESC 로 닫기, 뒤쪽 스크롤 막기, 첫 버튼에 포커스
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const btnClass = `block text-center py-3 rounded-xl font-semibold transition-colors ${
    highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-800"
  }`;

  // 판매 주소가 아직 없을 때 — 기존 동작 유지
  if (!storeUrl) {
    return <a href="#how" className={btnClass}>{cta}</a>;
  }

  const backHere = "/pricing";

  return (
    <>
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
        onClick={(e) => {
          if (!user) {           // 로그인 전이면 바로 보내지 않고 안내를 먼저
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {cta}
        <span className="ml-1.5 text-xs opacity-70" aria-hidden="true">↗</span>
      </a>

      <p className="mt-3 text-center text-xs text-slate-500">
        새 탭에서 열립니다 ·{" "}
        <Link href="/mypage" className="underline hover:text-slate-700">
          이미 구매했다면 코드 등록
        </Link>
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-guide-title"
            className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="buy-guide-title" className="text-xl font-bold text-slate-900 mb-2">
              가입하고 구매하시면 바로 충전됩니다
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              이용권 코드는 <b>Aitory 계정에 등록해야</b> 크레딧이 들어갑니다.
              먼저 가입해 두시면 구매 후 코드만 붙여넣으면 끝납니다.
              가입은 무료이고, 지금 가입하면 <b>10 크레딧</b>을 바로 드립니다.
            </p>

            <ol className="mb-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {["무료로 가입 (10 크레딧 즉시 지급)",
                "스마트스토어에서 이용권 구매",
                "받은 코드를 마이페이지에 등록"].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-none w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>

            <div className="space-y-2">
              <Link
                ref={primaryRef}
                href={`/auth/signup?next=${encodeURIComponent(backHere)}`}
                className="block text-center py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                무료로 가입하고 구매하기
              </Link>
              <Link
                href={`/auth/signin?next=${encodeURIComponent(backHere)}`}
                className="block text-center py-3 rounded-xl font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                이미 계정이 있어요
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="text-slate-500 underline hover:text-slate-700"
              >
                가입 없이 먼저 구매할게요
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
