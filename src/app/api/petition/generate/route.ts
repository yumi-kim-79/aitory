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
    const { petitionType, agency, applicant, content, demand } = await request.json();

    if (!content?.trim()) {
      return Response.json({ error: "민원 내용을 입력해주세요." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 행정 민원 서류 작성 전문가입니다.
반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "title": "민원서류 제목",
  "content": "서류 전문 (줄바꿈 포함, 공문서 형식)",
  "tips": ["제출 시 참고사항 2~3개"]
}

작성 원칙:
- 공공기관 제출용 표준 양식 준수
- 정중하고 공식적인 문체
- 날짜: ${new Date().toISOString().slice(0, 10)}
- 민원인 정보, 제출 기관, 민원 내용, 요청 사항 명시
- 관련 법령이 있으면 인용`,
      messages: [{
        role: "user",
        content: `${petitionType || "일반 민원"}을 작성해주세요.
제출기관: ${agency || ""}
신청인: ${applicant?.name || ""}, ${applicant?.address || ""}, ${applicant?.phone || ""}
민원 내용: ${content}
요청 사항: ${demand || ""}`,
      }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try { result = JSON.parse(extractJSON(responseText)); }
    catch { return Response.json({ error: "AI 응답을 처리할 수 없습니다." }, { status: 502 }); }
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
