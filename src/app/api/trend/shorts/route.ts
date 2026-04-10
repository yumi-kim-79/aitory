import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 K-Culture 전문 YouTube Shorts 스크립트 작가입니다.
주어진 블로그 글 정보를 기반으로 10~20초 분량의 YouTube Shorts용 콘텐츠를 한국어로 생성하세요.
규칙:
- 스크립트 첫 3초에 강렬한 훅으로 시청자를 잡을 것
- 짧고 임팩트 있는 문장 사용
- 설명문은 궁금증을 유발하여 링크 클릭 유도
- 해시태그는 트렌드 키워드 중심 #Shorts 반드시 포함
- 전체적으로 Kbuzz 링크 유입이 목적임을 기억할 것`;

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (!userDoc || userDoc.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const { title, kbuzzUrl, keyword, category, metaDesc } = (await request.json()) as {
      title: string;
      kbuzzUrl: string;
      keyword?: string;
      category?: string;
      metaDesc?: string;
    };

    if (!title || !kbuzzUrl) {
      return Response.json({ error: "title, kbuzzUrl 필수" }, { status: 400 });
    }

    const userPrompt = `블로그 글 제목: ${title}
키워드: ${keyword || ""}
카테고리: ${category || ""}
요약: ${metaDesc || ""}
Kbuzz 링크: ${kbuzzUrl}

위 블로그 글을 기반으로 YouTube Shorts 콘텐츠를 아래 형식 그대로 생성하세요. 각 섹션 구분자를 정확히 출력하세요:

[SCRIPT]
0~3초: (훅 멘트)
3~15초: (핵심 내용 3줄)
15~20초: CTA - 자세한 내용은 링크에서 확인하세요 👇 ${kbuzzUrl}
[/SCRIPT]

[DESCRIPTION]
(YouTube 설명문 3~5줄 + 🔗 ${kbuzzUrl})
[/DESCRIPTION]

[HASHTAGS]
(한국어+영어 혼합 해시태그 20개, #Shorts 필수)
[/HASHTAGS]`;

    // Claude 스트리밍
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[shorts] 스트림 에러:", msg);
          controller.enqueue(encoder.encode(`\n[ERROR] ${msg}`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[shorts] 에러:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
