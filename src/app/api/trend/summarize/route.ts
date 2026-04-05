import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { keyword, articles } = (await request.json()) as {
      keyword: string;
      articles: { title: string; summary: string }[];
    };

    const newsText = articles
      .map((a, i) => `${i + 1}. ${a.title}\n   ${a.summary}`)
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.7,
      system: `당신은 한국 SNS 콘텐츠 전문가입니다. 반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "summary": "핵심 내용 3줄 요약",
  "instagram": "인스타그램 포스팅 (해시태그 포함, 200자 이내)",
  "blog": "블로그 도입부 (300자 이내, SEO 키워드 포함)",
  "twitter": "X/트위터 포스팅 (140자 이내)"
}`,
      messages: [
        {
          role: "user",
          content: `"${keyword}" 키워드 관련 뉴스를 요약하고 SNS 콘텐츠를 생성해주세요.\n\n뉴스:\n${newsText}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 });
    }
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
