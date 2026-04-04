import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const input = await request.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 노동법 전문가입니다. 근로기준법에 맞는 표준 근로계약서를 작성해주세요.
반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "title": "근로계약서",
  "content": "계약서 전문 (줄바꿈 포함, 조항별 정리)",
  "highlights": ["핵심 조항 요약 3~5개"]
}

작성 원칙:
- 근로기준법 제17조(근로조건 명시) 준수
- 임금, 근로시간, 휴일, 연차, 4대보험 등 필수 항목 포함
- 계약 기간, 수습 기간 명시
- 해고/퇴직 조건 명시
- 날짜: ${new Date().toISOString().slice(0, 10)}`,
      messages: [
        {
          role: "user",
          content: `다음 정보로 근로계약서를 작성해주세요.

고용주: ${input.employer?.name || ""} (사업자번호: ${input.employer?.bizNumber || ""})
주소: ${input.employer?.address || ""}

근로자: ${input.worker?.name || ""}
주소: ${input.worker?.address || ""}
연락처: ${input.worker?.phone || ""}

근무조건:
- 업무 내용: ${input.conditions?.task || ""}
- 근무 장소: ${input.conditions?.location || ""}
- 계약 기간: ${input.conditions?.contractPeriod || ""}
- 근무 시간: ${input.conditions?.workHours || "09:00~18:00"}
- 급여: ${input.conditions?.salary || ""}
- 급여일: ${input.conditions?.payDay || "매월 10일"}
- 수습 기간: ${input.conditions?.probation || "없음"}
- 4대보험: ${input.conditions?.insurance || "가입"}
추가사항: ${input.extra || "없음"}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      return Response.json({ error: "AI 응답을 처리할 수 없습니다." }, { status: 502 });
    }
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `계약서 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
