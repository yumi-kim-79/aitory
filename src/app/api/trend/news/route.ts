import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";
import { useCredits } from "@/lib/credits";

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
    // 크레딧 차감 (1 크레딧)
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const ok = await useCredits(decoded.userId, 1, "트렌드 뉴스 검색");
    if (!ok) return Response.json({ error: "크레딧이 부족합니다. 요금제를 업그레이드해주세요." }, { status: 402 });

    const { keyword } = (await request.json()) as { keyword: string };
    if (!keyword?.trim()) {
      return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `"${keyword}" 키워드로 한국 최신 뉴스를 검색해주세요.

반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다.

{
  "articles": [
    {
      "title": "뉴스 제목",
      "source": "언론사",
      "summary": "1~2줄 요약",
      "url": "뉴스 URL"
    }
  ]
}

최신 뉴스 3~5개를 찾아주세요. URL은 실제 존재하는 뉴스 URL이어야 합니다.`,
        },
      ],
    });

    // 마지막 text 블록에서 JSON 추출
    const textBlock = message.content.filter((b) => b.type === "text").pop();
    const responseText = textBlock?.type === "text" ? textBlock.text : "";
    let result;
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      result = { articles: [] };
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
