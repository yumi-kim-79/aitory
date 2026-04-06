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
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { keyword, mode, articles } = (await request.json()) as {
      keyword: string;
      mode: "sns" | "blog";
      articles?: { title: string; summary: string }[];
    };

    if (!keyword?.trim()) return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });

    const credits = mode === "blog" ? 3 : 2;
    const ok = await useCredits(decoded.userId, credits, mode === "blog" ? "AI 블로그 글 생성" : "AI SNS 콘텐츠 생성");
    if (!ok) return Response.json({ error: "크레딧이 부족합니다." }, { status: 402 });

    const newsText = articles?.length
      ? articles.map((a, i) => `${i + 1}. ${a.title}: ${a.summary}`).join("\n")
      : "";

    if (mode === "blog") {
      if (/정치|선거|탄핵|대통령|정당|국회|여당|야당|민주당|국민의힘/.test(keyword)) {
        return Response.json({ error: "정치/선거 관련 주제는 작성할 수 없습니다." }, { status: 400 });
      }

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `키워드: ${keyword}\n${newsText ? `뉴스:\n${newsText}\n` : ""}아래 JSON으로 한국어 블로그 글 작성. JSON만 반환:\n{"title":"SEO 제목","slug":"영문-슬러그","content":"본문(## 소제목 3개, 800자+)","excerpt":"메타설명 160자","category":"IT/AI|K뷰티|K팝/한류|경제|글로벌|사회|인사이트","tags":["태그1","태그2","태그3","태그4","태그5"],"imageAlt":"이미지 alt"}`,
        }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      let result;
      try { result = JSON.parse(extractJSON(responseText)); }
      catch { return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 }); }
      if (result.error) return Response.json({ error: result.error }, { status: 400 });
      return Response.json(result);
    }

    // SNS
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `키워드: ${keyword}\n${newsText ? `뉴스:\n${newsText}\n` : ""}아래 JSON으로 SNS 콘텐츠 생성. JSON만 반환:\n{"summary":"3줄 요약","instagram":"인스타 200자+해시태그","blog":"블로그 도입 300자","twitter":"X 140자","youtube":"유튜브 제목 60자"}`,
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
