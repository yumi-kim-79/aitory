import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";
import { checkCredits, useCredits } from "@/lib/credits";

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
      articles?: { title: string }[];
    };

    if (!keyword?.trim()) return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });

    const credits = mode === "blog" ? 3 : 2;
    const hasCredits = await checkCredits(decoded.userId, credits);
    if (!hasCredits) return Response.json({ error: "크레딧이 부족합니다." }, { status: 402 });

    // 뉴스 제목만 전달 (토큰 절약)
    const newsTitles = articles?.length
      ? articles.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
      : "";

    if (mode === "blog") {
      if (/정치|선거|탄핵|대통령|정당|국회|여당|야당|민주당|국민의힘/.test(keyword)) {
        return Response.json({ error: "정치/선거 관련 주제는 작성할 수 없습니다." }, { status: 400 });
      }

      const today = new Date().toISOString().slice(0, 10);

      // Claude API 호출
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `키워드: ${keyword} (${today})
${newsTitles ? `뉴스:\n${newsTitles}\n` : ""}
SEO 블로그 글 작성. JSON만 반환:
{"title":"SEO 제목 40~60자","slug":"영문-슬러그","content":"HTML 본문 1500자+","excerpt":"메타설명 150자이내","category":"IT/AI|K뷰티|K팝/한류|경제|글로벌|사회|인사이트","tags":["한국어태그x7"]}

content: <h2> 4개+, 각 300자+, <p><strong><ul><li> 사용, 내부링크 1개, 이미지위치 2곳, 마지막 전망/결론`,
        }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      let result;
      try { result = JSON.parse(extractJSON(responseText)); }
      catch { return Response.json({ error: "AI 응답 처리 실패. 다시 시도해주세요." }, { status: 502 }); }
      if (result.error) return Response.json({ error: result.error }, { status: 400 });

      // 성공 시에만 크레딧 차감
      await useCredits(decoded.userId, credits, "AI 블로그 글 생성");
      return Response.json(result);
    }

    // SNS
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `키워드: ${keyword}\n${newsTitles ? `뉴스:\n${newsTitles}\n` : ""}SNS 콘텐츠 JSON만 반환:\n{"summary":"3줄요약","instagram":"200자+해시태그","blog":"블로그도입300자","twitter":"X 140자","youtube":"유튜브제목60자"}`,
      }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try { result = JSON.parse(extractJSON(responseText)); }
    catch { return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 }); }

    // 성공 시에만 크레딧 차감
    await useCredits(decoded.userId, credits, "AI SNS 콘텐츠 생성");
    return Response.json(result);
  } catch (error) {
    // 실패 시 크레딧 차감 안 함
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `생성 실패 (크레딧 미차감): ${msg}` }, { status: 500 });
  }
}
