import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

function buildSystemPrompt(types: string[]): string {
  const typeList = types.map((t) => `"${t}"`).join(", ");
  return `당신은 마케팅 전문가입니다. 고객 리뷰를 분석하여 마케팅 문구를 생성해주세요.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "positive_keywords": ["긍정 키워드 5~10개"],
  "negative_keywords": ["부정 키워드 (없으면 빈 배열)"],
  "purchase_reasons": ["주요 구매 이유 3~5개"],
  "improvements": ["개선 요구 사항 (없으면 빈 배열)"],
  "marketing_copies": [
    {
      "type": "문구 종류",
      "content": "생성된 마케팅 문구"
    }
  ]
}

marketing_copies에서 type은 다음 중에서만 사용: ${typeList}
각 type별로 2~3개씩 문구를 생성하세요.
문구는 한국 소비자에게 맞게 자연스러운 한국어로 작성하세요.`;
}

export async function POST(request: Request) {
  try {
    const { text, types } = (await request.json()) as {
      text: string;
      types: string[];
    };

    if (!text?.trim()) {
      return Response.json(
        { error: "리뷰 텍스트를 입력해주세요." },
        { status: 400 },
      );
    }

    if (!types?.length) {
      return Response.json(
        { error: "생성할 문구 종류를 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(types),
      messages: [
        {
          role: "user",
          content: `다음 고객 리뷰를 분석하고 마케팅 문구를 생성해주세요:\n\n${text}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = extractJSON(responseText);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.error("JSON 파싱 실패:", responseText.slice(0, 300));
      return Response.json(
        { error: "AI 응답을 처리할 수 없습니다. 다시 시도해주세요." },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("리뷰 분석 오류:", msg);
    return Response.json(
      { error: `리뷰 분석 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
