import Anthropic from "@anthropic-ai/sdk";
export const maxDuration = 60;

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const input = await request.json();

    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 6000,
      system: `당신은 한국 비즈니스 문서(견적서·인보이스·발주서·납품확인서) 작성 전문가입니다.
이번 문서 종류는 "${input.docType}" 입니다. 종류에 딱 맞는 문구를 작성하세요.
- 견적서: 견적 제출 인사 / 거래·결제 조건 안내 / 검토 요청 마무리
- 인보이스: 대금 청구 인사 / 입금 계좌·기한 안내 / 정산 협조 마무리
- 발주서: 발주 요청 인사 / 납품 일정·조건 안내(결제 아님) / 협조 요청 마무리
- 납품확인서: 납품 완료 확인 인사 / 검수·인수 확인 안내(결제 아님) / 감사 마무리

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "greeting": "문서 종류에 맞는 정중한 인사말 (2~3문장)",
  "payment_guide": "문서 종류에 맞는 안내 문구 (2~3문장)",
  "closing": "문서 종류에 맞는 마무리 문구 (1~2문장)"
}`,
      messages: [
        {
          role: "user",
          content: `다음 정보로 ${input.docType} 문구를 생성해주세요.
발신: ${input.sender?.companyName || ""}
수신: ${input.client?.clientName || ""} (${input.client?.contactPerson || ""})
금액: ${input.total?.toLocaleString() || 0}원
결제조건: ${input.paymentTerms || "협의"}
메모: ${input.memo || "없음"}`,
        },
      ],
    });

    const responseText =
      message.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");

    let result;
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      result = {
        greeting: `안녕하세요, ${input.docType || "견적서"}를 보내드립니다.`,
        payment_guide: "",
        closing: "감사합니다. 잘 부탁드립니다.",
      };
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("견적서 생성 오류:", msg);
    return Response.json(
      { error: `견적서 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
