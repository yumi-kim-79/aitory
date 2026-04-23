import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";
import { checkCredits, useCredits } from "@/lib/credits";
import { ensureAiImageNotice } from "@/lib/seo-aeo";

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

    const body = (await request.json()) as {
      keyword: string;
      mode?: string;
      articles?: { title: string }[];
    };
    const keyword = body.keyword;
    const articles = body.articles;
    const rawMode = body.mode || "blog";
    const isKbuzz = rawMode === "kbuzz";
    const mode = (rawMode === "blog" || rawMode === "kbuzz") ? "blog" : "sns";

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

      const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

      const systemPrompt = `당신은 K-Culture 트렌드 전문 블로그 작가입니다.

주어진 Google Trends 키워드와 Google News 기사를 바탕으로 SEO 최적화된 블로그 포스트를 생성합니다.

응답은 반드시 다음 JSON 형식으로 작성하세요:

{
  "title": "클릭을 유도하는 매력적인 제목 (60자 이내)",
  "content": "HTML 형식 본문 (최소 1500자, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li> 태그 사용)",
  "category": "적절한 카테고리 (예: IT/AI, K뷰티, K팝/한류, 경제, 글로벌, 사회, 인사이트)",
  "tags": ["태그1", "태그2"],

  "metaDescription": "검색 결과에 표시될 요약 (140-150자, 키워드 포함, 클릭 유도)",
  "focusKeyphrase": "메인 키워드 (2-4단어)",
  "urlSlug": "seo-friendly-url-slug",
  "ogDescription": "SNS 공유 시 표시될 설명 (150-160자, 흥미 유발)",

  "suggestedCategories": ["카테고리1", "카테고리2", "카테고리3"],
  "internalLinkKeywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],

  "factCheckWarnings": ["검증이 필요한 사실 또는 수치"],
  "copyrightRisks": ["초상권/저작권 위험이 있는 인물명/브랜드명"],
  "suggestedSources": ["공식 출처 URL 1", "공식 출처 URL 2"]
}

**작성 가이드라인:**

1. **제목 (title)**: 60자 이내, Focus Keyphrase 포함, 숫자/의문문/감탄문 활용.
2. **본문 (content)**: HTML 형식, 최소 1500자. 구조는 서론 → 본론(3-5개 섹션) → 결론. 각 섹션에 <h2> 필수. <p><strong><ul><li> 적극 활용. 내부링크 키워드는 자연스럽게 배치(링크 태그 삽입 금지). 이미지 위치 2개 표시(<!-- 이미지:설명|alt-->). 마지막은 전망/결론.
3. **metaDescription**: 140-150자, Focus Keyphrase 앞부분 배치, 신뢰 키워드("완벽 정리/총정리/분석/전망") 포함, 클릭 유도 문구.
4. **focusKeyphrase**: 2-4단어, 검색량 많을 것으로 예상되는 핵심 키워드.
5. **urlSlug**: 영문 소문자 + 하이픈만 사용, focusKeyphrase 포함, 50자 이내.
6. **ogDescription**: 150-160자, metaDescription보다 더 감정적/흥미 유발, 이모지 사용 가능.
7. **suggestedCategories**: 3개 후보(예: K팝, K드라마, K뷰티, K푸드, K패션, 한류, 엔터테인먼트, IT/AI, 경제).
8. **internalLinkKeywords**: 본문에서 다른 글로 링크할만한 K-Culture 키워드 5개.
9. **factCheckWarnings**: 공식 발표 없이 추정한 내용, 수치/통계/수상 내역 등 검증 필요 항목. 없으면 빈 배열.
10. **copyrightRisks**: 실명 연예인/유명인, 브랜드/회사명. 없으면 빈 배열.
11. **suggestedSources**: 팩트 체크 가능한 공식 URL (예: https://ibighit.com). 없으면 빈 배열.

**중요:**
- JSON 형식 엄수 (마크다운 코드블록 사용 금지)
- 모든 필드 필수 포함(빈 배열/문자열 허용)
- content는 반드시 HTML 태그로 작성
- 한국어로 작성 (urlSlug 제외)
- 오늘(${today}) 기준 최신 정보로 작성. 과거 연도를 현재 시제로 쓰지 말 것.`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `키워드: ${keyword}
오늘: ${today}
${newsTitles ? `뉴스:\n${newsTitles}\n` : ""}위 키워드/뉴스로 SEO 최적화 블로그 포스트 JSON을 생성하세요.`,
        }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      console.log('=== Claude Raw Response ===');
      console.log(responseText.substring(0, 500));
      let result;
      try {
        const jsonStr = extractJSON(responseText);
        result = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error("[generate/blog] JSON 파싱 실패:", responseText.slice(0, 500));
        return Response.json({ error: "AI 응답 처리 실패. 다시 시도해주세요. (크레딧 미차감)" }, { status: 502 });
      }
      console.log('=== Parsed Result ===');
      console.log(JSON.stringify({
        hasMetaDescription: !!result.metaDescription,
        metaDescriptionLength: result.metaDescription?.length || 0,
        hasFocusKeyphrase: !!result.focusKeyphrase,
        hasUrlSlug: !!result.urlSlug,
        hasOgDescription: !!result.ogDescription,
        hasTags: Array.isArray(result.tags),
        tagsCount: result.tags?.length || 0,
      }, null, 2));
      if (result.error) return Response.json({ error: result.error }, { status: 400 });

      // metaDescription 150자 truncate + excerpt 백워드 호환 alias
      if (typeof result.metaDescription === "string" && result.metaDescription.length > 150) {
        result.metaDescription = result.metaDescription.slice(0, 147) + "...";
      }
      if (!result.excerpt && result.metaDescription) result.excerpt = result.metaDescription;
      if (result.excerpt && result.excerpt.length > 150) {
        result.excerpt = result.excerpt.slice(0, 147) + "...";
      }
      if (!result.slug && result.urlSlug) result.slug = result.urlSlug;

      // 새 필드 기본값 보정 (Claude가 누락해도 UI/발행이 깨지지 않게)
      result.focusKeyphrase ??= "";
      result.ogDescription ??= result.metaDescription || "";
      result.suggestedCategories = Array.isArray(result.suggestedCategories) ? result.suggestedCategories : [];
      result.internalLinkKeywords = Array.isArray(result.internalLinkKeywords) ? result.internalLinkKeywords : [];
      result.factCheckWarnings = Array.isArray(result.factCheckWarnings) ? result.factCheckWarnings : [];
      result.copyrightRisks = Array.isArray(result.copyrightRisks) ? result.copyrightRisks : [];
      result.suggestedSources = Array.isArray(result.suggestedSources) ? result.suggestedSources : [];

      // 모든 블로그 글 하단에 AI 이미지 안내 추가 (중복 방지)
      if (result.content) {
        result.content = ensureAiImageNotice(result.content);
      }

      await useCredits(decoded.userId, credits, isKbuzz ? "Kbuzz 블로그 생성" : "AI 블로그 글 생성");
      console.log('=== Final Response to Client ===');
      console.log(JSON.stringify({
        metaDescription: result.metaDescription?.substring(0, 100),
        focusKeyphrase: result.focusKeyphrase,
        urlSlug: result.urlSlug,
        tagsCount: result.tags?.length,
      }, null, 2));
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
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      console.error("[generate/sns] JSON 파싱 실패:", responseText.slice(0, 500));
      return Response.json({ error: "AI 응답 처리 실패 (크레딧 미차감)" }, { status: 502 });
    }

    // 성공 시에만 크레딧 차감
    await useCredits(decoded.userId, credits, "AI SNS 콘텐츠 생성");
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[generate] 에러:", msg);
    const status = msg.includes("timeout") || msg.includes("504") ? 504 : 500;
    return Response.json({ error: `생성 실패 (크레딧 미차감): ${msg}` }, { status });
  }
}
