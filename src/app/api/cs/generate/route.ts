import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

const PLATFORM_GUIDE: Record<string, string> = {
  쿠팡: "쿠팡 판매자 CS 답변 스타일. 간결하고 명확하게.",
  네이버스마트스토어: "네이버 스마트스토어 톡톡/문의 답변 스타일.",
  "11번가": "11번가 판매자 답변 스타일. 정중하고 상세하게.",
  옥션: "옥션 판매자 답변 스타일.",
  G마켓: "G마켓 판매자 답변 스타일.",
  자사몰: "자사몰 고객센터 답변 스타일. 브랜드 이미지 유지.",
};

export async function POST(request: Request) {
  try {
    const { platform, inquiryType, content, tone } = (await request.json()) as {
      platform: string;
      inquiryType: string;
      content: string;
      tone: string;
    };

    if (!content?.trim()) {
      return Response.json({ error: "고객 문의 내용을 입력해주세요." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `당신은 한국 이커머스 쇼핑몰 CS 전문가입니다.
고객 문의에 대한 판매자 답변을 작성해주세요.

반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "reply": "CS 답변 전문",
  "tips": ["답변 시 참고할 팁 2~3개"]
}

플랫폼: ${platform} — ${PLATFORM_GUIDE[platform] || "일반적인 톤"}
문의 유형: ${inquiryType}
톤: ${tone || "정중한"}

작성 원칙:
- 고객 감정에 공감하는 첫 문장
- 문제 해결 방안을 구체적으로 제시
- 플랫폼 정책에 맞는 안내
- 재구매/만족을 유도하는 마무리`,
      messages: [
        {
          role: "user",
          content: `고객 문의 내용:\n${content}`,
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
    return Response.json({ error: `CS 답변 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
