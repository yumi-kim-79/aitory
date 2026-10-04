/**
 * ?next= 로 돌아갈 경로를 읽습니다.
 *
 * 로그인·가입을 마친 뒤 원래 보던 페이지로 되돌려보낼 때 씁니다.
 * 예) /auth/signup?next=/pricing  →  가입 후 /pricing 으로
 *
 * 외부 주소로 튕겨 보내는 공격(open redirect)을 막기 위해
 * **같은 사이트의 경로만** 허용합니다. `//evil.com` 같은 값은 무시합니다.
 */
export function nextPath(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;      // 절대 주소 차단
  if (raw.startsWith("//")) return fallback;      // 프로토콜 상대 주소 차단
  if (raw.includes("\\")) return fallback;        // 역슬래시 우회 차단
  return raw;
}
