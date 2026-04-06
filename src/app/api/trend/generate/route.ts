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
      // 정치/선거 키워드 필터링
      if (/정치|선거|탄핵|대통령|정당|국회|여당|야당|민주당|국민의힘/.test(keyword)) {
        return Response.json({ error: "정치/선거 관련 주제는 작성할 수 없습니다." }, { status: 400 });
      }

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0.7,
        system: `당신은 한국의 전문 블로그 작가입니다.
반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "title": "SEO 최적화된 제목 (클릭 유도, 30~60자)",
  "slug": "english-slug-50chars-max",
  "content": "본문 내용 (마크다운 형식, 이미지 위치 표시 포함)",
  "excerpt": "메타 설명 160자 이내",
  "category": "IT/AI | K뷰티 | K팝/한류 | 경제 | 글로벌 | 사회 | 인사이트 중 하나",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "imageAlt": "대표 이미지 alt 텍스트"
}

본문 작성 규칙:
1. 최소 800자 이상 (필수)
2. ## 소제목 3개 이상 포함
3. 정치/선거/탄핵/정당 관련 내용 절대 제외
4. 독자적 분석과 인사이트 포함 (타 사이트 내용 복사 금지)
5. 본문 마지막에 관련 글 유도 문장 1개 포함
   예: "관련 글도 함께 읽어보세요: K팝 최신 트렌드 모아보기"

이미지 위치 표시 규칙:
- 대표 이미지: 제목 아래 첫 번째 단락 앞에 아래 표시
  [대표이미지: {키워드} 관련 이미지 | alt텍스트: {설명}]
- 본문 이미지: H2 소제목 중 하나 아래에 아래 표시
  [본문이미지: {설명} | alt텍스트: {설명}]

JSON 필드 규칙:
- tags: 5~10개, 한국어
- slug: 영문 소문자와 하이픈만
- excerpt: 160자 이내
- content: 마크다운 형식 (## 소제목, **굵게**, - 목록 등)`,
        messages: [{ role: "user", content: `"${keyword}" 키워드로 고품질 블로그 포스팅을 작성해주세요.${newsContext}` }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      let result;
      try { result = JSON.parse(extractJSON(responseText)); }
      catch { return Response.json({ error: "AI 응답 처리 실패" }, { status: 502 }); }
      if (result.error) return Response.json({ error: result.error }, { status: 400 });
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
