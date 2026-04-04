import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

const PLATFORM_STYLE: Record<string, string> = {
  네이버부동산: "상세하고 전문적인 톤, 매물 장점을 구체적으로 서술, 500~800자",
  직방: "깔끔하고 핵심 위주, 조건 중심 정리, 300~500자",
  다방: "간결하면서 매력적인 톤, 키 포인트 강조, 300~500자",
  당근마켓: "친근하고 동네 이웃에게 말하듯, 이모지 활용, 200~400자",
};

interface PropertyInput {
  propertyType: string;
  dealType: string;
  deposit: string;
  monthly: string;
  area: string;
  floor: string;
  address: string;
  moveInDate: string;
  options: string[];
  extra: string;
  platforms: string[];
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as PropertyInput;

    if (!input.propertyType || !input.dealType || !input.deposit) {
      return Response.json(
        { error: "매물 종류, 거래 종류, 보증금은 필수 입력입니다." },
        { status: 400 },
      );
    }

    if (!input.platforms?.length) {
      return Response.json(
        { error: "생성할 플랫폼을 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }

    const platformSpecs = input.platforms
      .map((p) => `- ${p}: ${PLATFORM_STYLE[p] || "자연스러운 톤"}`)
      .join("\n");

    const conditionText = [
      `매물 종류: ${input.propertyType}`,
      `거래 종류: ${input.dealType}`,
      `보증금: ${input.deposit}`,
      input.monthly ? `월세: ${input.monthly}` : null,
      input.area ? `면적: ${input.area}` : null,
      input.floor ? `층수: ${input.floor}` : null,
      input.address ? `주소: ${input.address}` : null,
      input.moveInDate ? `입주가능일: ${input.moveInDate}` : null,
      input.options.length > 0
        ? `옵션: ${input.options.join(", ")}`
        : null,
      input.extra ? `추가 특이사항: ${input.extra}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `당신은 부동산 전문 카피라이터입니다.
임대 조건을 기반으로 각 플랫폼에 최적화된 공고문을 생성해주세요.

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "appeal_points": ["어필 포인트 3~5개"],
  "platforms": [
    {
      "platform": "플랫폼명",
      "title": "공고 제목 (30자 이내)",
      "content": "공고문 전문",
      "char_count": 글자수(숫자)
    }
  ]
}

플랫폼별 스타일:
${platformSpecs}

공고문에 매물 조건을 빠짐없이 포함하고, 매력적으로 작성하세요.
한국 부동산 시장에 맞는 자연스러운 한국어로 작성하세요.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `다음 조건으로 임대 공고문을 생성해주세요:\n\n${conditionText}`,
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
    console.error("부동산 공고문 오류:", msg);
    return Response.json(
      { error: `공고문 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
