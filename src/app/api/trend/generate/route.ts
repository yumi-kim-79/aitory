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

      const today = new Date().toISOString().slice(0, 10);
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: `키워드: ${keyword}
오늘: ${today}
${newsText ? `뉴스:\n${newsText}\n` : ""}
위 뉴스 바탕으로 SEO 최적화 블로그 글 작성. JSON만 반환, 코드블록 없이:
{"title":"SEO 제목 40~60자","slug":"영문-슬러그-50자이내","content":"HTML 본문 1500자+","excerpt":"메타설명 150자 이내","category":"IT/AI|K뷰티|K팝/한류|경제|글로벌|사회|인사이트","tags":["태그1","태그2","태그3","태그4","태그5","태그6","태그7"]}

content 필수 규칙:
- 1500자 이상 (절대 미만 금지)
- <h2>소제목</h2> 4개 이상, 각 300자+ 내용
- HTML 형식: <h2> <p> <strong> <ul><li> 사용 (마크다운 ## 금지)
- 뉴스 수치/날짜/인물명 구체적으로 포함
- 내부링크 1개: <a href="/관련-슬러그">관련 글</a>
- 이미지 위치 2곳: <!-- 이미지: 설명 | alt: 텍스트 -->
- 마지막 섹션: "앞으로의 전망" 또는 "결론"
- excerpt: 150자 이내 (절대 초과 금지)`,
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
