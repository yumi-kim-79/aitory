import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export const maxDuration = 30;

// SNS 콘텐츠 생성 전용 (blog는 클라이언트에서 직접 호출)
export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { keyword, articles } = (await request.json()) as {
      keyword: string;
      articles?: { title: string; summary: string }[];
    };

    if (!keyword?.trim()) return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });

    const newsText = articles?.length
      ? articles.map((a, i) => `${i + 1}. ${a.title}: ${a.summary}`).join("\n")
      : "";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{
        role: "user",
        content: `키워드: ${keyword}
${newsText ? `뉴스:\n${newsText}\n` : ""}
아래 JSON으로 SNS 콘텐츠 생성. JSON만 반환:
{"summary":"3줄 요약","instagram":"인스타 200자+해시태그","blog":"블로그 도입 300자","twitter":"X 140자","youtube":"유튜브 제목 60자"}`,
      }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try { result = JSON.parse(extractJSON(responseText)); }
    catch { return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 }); }
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
