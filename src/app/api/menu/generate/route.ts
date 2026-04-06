import Anthropic from "@anthropic-ai/sdk";
export const maxDuration = 60;

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

const PLATFORM_GUIDE: Record<string, string> = {
  배달의민족: "배민 메뉴 등록용. 메뉴 설명은 2줄 이내, 핵심 재료와 맛 포인트 강조, 이모지 가능.",
  쿠팡이츠: "쿠팡이츠 메뉴 등록용. 간결하고 식욕 자극하는 표현, 1~2줄.",
  카카오채널: "카카오톡 채널 메뉴판용. 친근한 톤, 이모지 활용, 추천 메뉴 강조.",
  인쇄용: "실제 인쇄 메뉴판용. 깔끔하고 정돈된 표현, 이모지 없이, 메뉴 카테고리 구분.",
};

export async function POST(request: Request) {
  try {
    const { storeName, storeDesc, items, platforms, mood } = (await request.json()) as {
      storeName: string;
      storeDesc: string;
      items: { name: string; price: string; desc: string }[];
      platforms: string[];
      mood: string;
    };

    if (!storeName?.trim() || !items?.length) {
      return Response.json({ error: "가게명과 메뉴 항목을 입력해주세요." }, { status: 400 });
    }

    const platSpecs = platforms.map((p) => `- ${p}: ${PLATFORM_GUIDE[p] || "자연스러운 톤"}`).join("\n");
    const menuList = items.filter((i) => i.name).map((i) => `${i.name} (${i.price}) — ${i.desc || "설명 없음"}`).join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 외식업 메뉴 마케팅 전문가입니다.
메뉴 항목을 각 플랫폼에 맞게 매력적으로 재작성해주세요.

반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "platforms": [
    {
      "platform": "플랫폼명",
      "menus": [
        {"name": "메뉴명", "price": "가격", "description": "AI가 작성한 매력적인 설명"}
      ]
    }
  ]
}

가게 분위기: ${mood || "캐주얼"}
플랫폼별 가이드:
${platSpecs}

작성 원칙:
- 식욕을 자극하는 감각적 표현
- 메뉴 특징과 재료를 매력적으로 표현
- 가게 분위기에 맞는 톤 유지`,
      messages: [
        {
          role: "user",
          content: `가게명: ${storeName}\n소개: ${storeDesc || ""}\n\n메뉴 목록:\n${menuList}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try { result = JSON.parse(extractJSON(responseText)); }
    catch { return Response.json({ error: "AI 응답을 처리할 수 없습니다." }, { status: 502 }); }
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `메뉴판 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
