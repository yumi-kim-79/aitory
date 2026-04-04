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
  스마트스토어:
    "네이버 검색 SEO 최적화. 상품명에 핵심 키워드를 자연스럽게 배치. 태그는 검색 유입에 효과적인 키워드 위주.",
  쿠팡:
    "간결하고 임팩트 있게. 소비자가 빠르게 판단할 수 있도록 핵심 장점 강조. 로켓배송/와우할인 감성.",
  "11번가":
    "상세하고 신뢰감 있게. 스펙 중심 정보 전달. 공식 판매처 느낌.",
  "지마켓/옥션":
    "가격 경쟁력과 혜택 강조. 할인/쿠폰 감성. 구매 욕구 자극.",
};

interface ProductInput {
  productName: string;
  category: string;
  features: string;
  price: string;
  target: string;
  platforms: string[];
  items: string[];
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ProductInput;

    if (!input.productName?.trim()) {
      return Response.json(
        { error: "상품명을 입력해주세요." },
        { status: 400 },
      );
    }
    if (!input.platforms?.length) {
      return Response.json(
        { error: "플랫폼을 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }
    if (!input.items?.length) {
      return Response.json(
        { error: "생성할 항목을 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }

    const platformSpecs = input.platforms
      .map((p) => `- ${p}: ${PLATFORM_STYLE[p] || "자연스러운 톤"}`)
      .join("\n");

    const itemList = input.items.map((i) => `"${i}"`).join(", ");

    const productInfo = [
      `원래 상품명: ${input.productName}`,
      input.category ? `카테고리: ${input.category}` : null,
      input.features ? `특징/스펙: ${input.features}` : null,
      input.price ? `가격: ${input.price}` : null,
      input.target ? `타겟 고객: ${input.target}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `당신은 이커머스 상품 등록 전문 카피라이터입니다.
도매 상품 정보를 기반으로 각 쇼핑 플랫폼에 최적화된 상품 등록 문구를 생성해주세요.

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "platforms": [
    {
      "platform": "플랫폼명",
      "product_name": "SEO 최적화 상품명 (50자 이내)",
      "intro": "상품 소개글 (2~3문장)",
      "description": "상세설명 (300~500자)",
      "tags": ["검색태그 10~15개"],
      "bullets": ["상품 특징 5~7개"]
    }
  ]
}

생성할 항목: ${itemList}
포함되지 않은 항목은 빈 문자열 또는 빈 배열로 설정하세요.

플랫폼별 가이드:
${platformSpecs}

한국 쇼핑몰 소비자에게 맞는 자연스러운 한국어로 작성하세요.
상품명은 검색에 잘 걸리도록 키워드를 포함하되 자연스럽게 구성하세요.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `다음 상품의 등록 문구를 생성해주세요:\n\n${productInfo}`,
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
    console.error("상품 문구 생성 오류:", msg);
    return Response.json(
      { error: `상품 문구 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
