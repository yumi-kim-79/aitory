/**
 * Firebase 인증 오류를 사람이 읽을 수 있는 한국어로 바꿉니다.
 *
 * 그냥 두면 손님에게 "Firebase: Error (auth/email-already-in-use)" 같은
 * 영어 코드가 그대로 보입니다. 무슨 말인지 몰라서 거기서 이탈합니다.
 */
const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "이미 가입된 이메일입니다. 아래 '로그인'으로 들어가 주세요.",
  "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않습니다.",
  "auth/wrong-password": "비밀번호가 맞지 않습니다.",
  "auth/user-not-found": "가입되지 않은 이메일입니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/weak-password": "비밀번호는 8자 이상으로 해주세요.",
  "auth/missing-password": "비밀번호를 입력해 주세요.",
  "auth/too-many-requests": "시도가 너무 잦습니다. 잠시 후 다시 해주세요.",
  "auth/network-request-failed": "네트워크에 연결하지 못했습니다. 연결 상태를 확인해 주세요.",
  "auth/user-disabled": "사용이 정지된 계정입니다.",
  "auth/popup-closed-by-user": "구글 로그인 창이 닫혔습니다. 다시 시도해 주세요.",
  "auth/popup-blocked": "팝업이 차단되었습니다. 브라우저의 팝업 차단을 풀어주세요.",
  "auth/account-exists-with-different-credential":
    "같은 이메일로 다른 방식의 계정이 있습니다. 이메일/비밀번호로 로그인해 주세요.",
  "auth/operation-not-allowed": "현재 이 로그인 방식은 사용할 수 없습니다.",
};

export function authErrorMessage(err: unknown, fallback: string): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return MESSAGES[code] ?? fallback;
}
