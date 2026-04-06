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

반드시 최근 7일 이내 최신 뉴스만 포함하세요.
오늘(${new Date().toISOString().slice(0, 10)}) 기준 최신순 정렬.
반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작.

{"articles":[{"title":"뉴스 제목","source":"언론사","summary":"1~2줄 요약","url":"뉴스 URL","publishedAt":"YYYY-MM-DD"}]}

최신 뉴스 3~5개. URL은 실제 존재하는 뉴스 URL이어야 합니다.`,
        },
      ],
    });

    const textBlock = message.content.filter((b) => b.type === "text").pop();
    const responseText = textBlock?.type === "text" ? textBlock.text : "";

    // cite 태그 제거
    const clean = (s: string) => s.replace(/<cite[^>]*>/g, "").replace(/<\/cite>/g, "").trim();

    let result;
    try {
      result = JSON.parse(extractJSON(clean(responseText)));
      if (result.articles) {
        result.articles = result.articles.map((a: Record<string, string>) => ({
          ...a,
          title: clean(a.title || ""),
          summary: clean(a.summary || ""),
          source: clean(a.source || ""),
        }));
      }
    } catch {
      result = { articles: [] };
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
