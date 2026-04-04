import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  인스타그램:
    "짧고 감성적인 톤, 해시태그 10~15개 포함, 이모지 자연스럽게 활용, 300자 내외",
  스레드: "간결하고 대화체, 핵심만 전달, 이모지 최소, 200자 내외",
  "네이버 블로그":
    "SEO 최적화, 소제목 포함, 정보 전달 중심, 800~1500자",
  카카오채널:
    "친근한 톤, 이모지 적극 활용, CTA(행동 유도) 포함, 200자 내외",
  링크드인: "전문적이고 인사이트 있는 톤, 업계 용어 활용, 400~600자",
  "트위터/X": "140자 이내, 핵심 메시지 하나, 임팩트 있게",
};

function buildSystemPrompt(platforms: string[], tone: string): string {
  const platformSpecs = platforms
    .map((p) => `- ${p}: ${PLATFORM_INSTRUCTIONS[p] || "자연스러운 톤"}`)
    .join("\n");

  return `당신은 SNS 콘텐츠 전문 마케터입니다.
원본 콘텐츠를 각 SNS 플랫폼에 최적화된 형태로 재가공해주세요.
톤: ${tone}

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "original_topic": "원본 콘텐츠의 핵심 주제 한 줄 요약",
  "keywords": ["핵심 키워드 5~8개"],
  "platforms": [
    {
      "platform": "플랫폼명",
      "content": "재가공된 콘텐츠 전문",
      "hashtags": ["#해시태그"] (인스타그램만, 나머지는 빈 배열),
      "char_count": 글자수(숫자)
    }
  ]
}

플랫폼별 가이드:
${platformSpecs}

한국 SNS 사용자에 맞게 자연스러운 한국어로 작성하세요.`;
}

export async function POST(request: Request) {
  try {
    const { text, platforms, tone } = (await request.json()) as {
      text: string;
      platforms: string[];
      tone: string;
    };

    if (!text?.trim()) {
      return Response.json(
        { error: "콘텐츠 텍스트를 입력해주세요." },
        { status: 400 },
      );
    }

    if (!platforms?.length) {
      return Response.json(
        { error: "변환할 플랫폼을 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(platforms, tone || "친근한"),
      messages: [
        {
          role: "user",
          content: `다음 콘텐츠를 각 SNS 플랫폼에 맞게 재가공해주세요:\n\n${text}`,
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
    console.error("SNS 분석 오류:", msg);
    return Response.json(
      { error: `콘텐츠 재가공 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
