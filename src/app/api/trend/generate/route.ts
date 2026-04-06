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

const BLOG_SYSTEM = `당신은 한국의 전문 블로그 작가입니다.
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
1. 최소 800자 이상
2. ## 소제목 3개 이상
3. 정치/선거/탄핵/정당 관련 내용 제외
4. 독자적 분석과 인사이트 포함
5. 본문 마지막에 관련 글 유도 문장

이미지 위치 표시:
- [대표이미지: {키워드} 관련 이미지 | alt텍스트: {설명}]
- [본문이미지: {설명} | alt텍스트: {설명}]

tags: 5~10개 한국어, slug: 영문+하이픈, excerpt: 160자 이내`;

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { keyword, mode, articles } = (await request.json()) as {
      keyword: string;
      mode: "sns" | "blog";
      articles?: { title: string; summary: string }[];
    };

    if (!keyword?.trim()) {
      return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const credits = mode === "blog" ? 3 : 2;
    const ok = await useCredits(decoded.userId, credits, mode === "blog" ? "AI 블로그 글 생성" : "AI SNS 콘텐츠 생성");
    if (!ok) return Response.json({ error: "크레딧이 부족합니다." }, { status: 402 });

    const newsContext = articles?.length
      ? `\n관련 뉴스:\n${articles.map((a, i) => `${i + 1}. ${a.title} — ${a.summary}`).join("\n")}`
      : "";

    if (mode === "blog") {
      if (/정치|선거|탄핵|대통령|정당|국회|여당|야당|민주당|국민의힘/.test(keyword)) {
        return Response.json({ error: "정치/선거 관련 주제는 작성할 수 없습니다." }, { status: 400 });
      }

      // 스트리밍 방식 — 타임아웃 방지
      const stream = client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: 0.7,
        system: BLOG_SYSTEM,
        messages: [{ role: "user", content: `"${keyword}" 키워드로 고품질 블로그 포스팅을 작성해주세요.${newsContext}` }],
      });

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const event of stream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if ("text" in delta) {
                controller.enqueue(encoder.encode(delta.text));
              }
            }
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // SNS — 빠르므로 기존 방식 유지
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.7,
      system: `당신은 한국 SNS 콘텐츠 전문가입니다. 반드시 JSON 형식으로만 응답하세요. 응답은 반드시 { 로 시작.

{
  "summary": "핵심 내용 3줄 요약",
  "instagram": "인스타그램 포스팅 (해시태그 포함, 200자 이내)",
  "blog": "블로그 도입부 (300자 이내)",
  "twitter": "X/트위터 포스팅 (140자 이내)",
  "youtube": "유튜브 제목 (60자 이내)"
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
