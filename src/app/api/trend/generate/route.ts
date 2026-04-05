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
    const { keyword, mode, articles } = (await request.json()) as {
      keyword: string;
      mode: "sns" | "blog";
      articles?: { title: string; summary: string }[];
    };

    if (!keyword?.trim()) {
      return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const newsContext = articles?.length
      ? `\n관련 뉴스:\n${articles.map((a, i) => `${i + 1}. ${a.title} — ${a.summary}`).join("\n")}`
      : "";

    if (mode === "blog") {
      // Kbuzz 블로그 전문 생성
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.7,
        system: `당신은 한국 블로그 SEO 전문 작가입니다. 반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작.

{
  "title": "SEO 최적화 블로그 제목",
  "content": "본문 1500자 이상 (HTML 태그 포함: <h2>, <p>, <strong>, <ul>, <li>)",
  "category": "IT|AI|K뷰티|K팝|경제|글로벌|사회|인사이트",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "metaDescription": "메타 설명 160자 이내",
  "excerpt": "요약 200자 이내"
}

작성 원칙:
- 제목은 클릭 유도형, 키워드 포함
- 본문은 소제목(H2) 3~4개 + 단락 + 불릿포인트
- SEO 키워드 자연스럽게 배치
- 한국어 독자 대상`,
        messages: [{ role: "user", content: `"${keyword}" 키워드로 Kbuzz 블로그 포스팅을 작성해주세요.${newsContext}` }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      let result;
      try { result = JSON.parse(extractJSON(responseText)); }
      catch { return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 }); }
      return Response.json(result);
    }

    // SNS 콘텐츠 생성
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.7,
      system: `당신은 한국 SNS 콘텐츠 전문가입니다. 반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작.

{
  "summary": "핵심 내용 3줄 요약",
  "instagram": "인스타그램 포스팅 (해시태그 포함, 200자 이내)",
  "blog": "블로그 도입부 (300자 이내, SEO 키워드 포함)",
  "twitter": "X/트위터 포스팅 (140자 이내)",
  "youtube": "유튜브 제목 (60자 이내, 클릭 유도)"
}`,
      messages: [{ role: "user", content: `"${keyword}" 키워드로 SNS 콘텐츠를 생성해주세요.${newsContext}` }],
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
