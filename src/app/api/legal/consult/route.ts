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
    const { consultType, situation, direction } = (await request.json()) as {
      consultType: string;
      situation: string;
      direction: string;
    };

    if (!situation?.trim()) {
      return Response.json({ error: "상황 설명을 입력해주세요." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 법률 전문 AI 상담사입니다.
사용자의 법률 상황을 분석하고 일반적인 법률 정보를 제공해주세요.

반드시 JSON 형식으로만 응답하세요. JSON 외 텍스트는 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "summary": "상황 분석 요약 (3~5문장)",
  "legalBasis": ["관련 법조항 또는 판례 3~5개"],
  "steps": ["권장 대응 단계 3~5개 (구체적으로)"],
  "recommendedDocs": ["필요한 법률 문서명 (해당 시)"],
  "disclaimer": "본 상담은 AI가 제공하는 일반적인 법률 정보이며, 법적 효력이 없습니다. 실제 법적 문제는 반드시 변호사와 상담하시기 바랍니다."
}

원칙:
- 한국 법률 기준으로 분석
- 관련 법률 조항을 구체적으로 언급 (예: 민법 제750조)
- 실행 가능한 단계별 대응 방법 제시
- 변호사 상담이 필요한 경우 명확히 권고`,
      messages: [
        {
          role: "user",
          content: `상담 유형: ${consultType || "기타"}
조언 방향: ${direction || "전반적 조언"}

상황 설명:
${situation}`,
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
    return Response.json({ error: `상담 중 오류: ${msg}` }, { status: 500 });
  }
}
