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
    const { contractType, text } = (await request.json()) as { contractType: string; text: string };

    if (!text?.trim()) {
      return Response.json({ error: "계약서 내용을 입력해주세요." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 부동산 거래 전문가입니다. ${contractType || "부동산"} 계약서를 분석하여 체크리스트를 생성하세요.

반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "summary": "계약서 요약 (2~3문장)",
  "riskScore": 0~100,
  "checklist": [
    {
      "item": "확인 항목",
      "status": "danger" | "warning" | "safe",
      "detail": "상세 설명",
      "action": "필요한 조치"
    }
  ]
}

체크리스트 필수 항목:
- 등기부등본 확인 여부
- 선순위 채권/근저당 확인
- 전입신고/확정일자 안내
- 특약사항 위험도
- 계약금/중도금/잔금 조건
- 임대인 본인 확인
- 관리비/수선비 조항`,
      messages: [{ role: "user", content: `${contractType} 계약서를 분석해주세요:\n\n${text}` }],
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
