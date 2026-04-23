// DALL-E 이미지 자동 생성 단계 제거 (2026-04-23)
// 이미지는 수동 업로드로 전환되었음. 원본 구현은 주석 처리하여 보존.
// 다시 활성화하려면 아래 주석을 해제하세요.

export const maxDuration = 60;

export async function POST() {
  return Response.json(
    { error: "DALL-E 이미지 생성은 비활성화되었습니다. 이미지는 수동 업로드하세요." },
    { status: 410 },
  );
}

/*
import Anthropic from "@anthropic-ai/sdk";
import { appendPhotoSuffix } from "@/lib/dalle-photo-prompt";

const claude = new Anthropic();

async function keywordToPrompt(keyword: string, category: string): Promise<string> {
  try {
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      temperature: 0,
      messages: [{ role: "user", content: `Create a photorealistic DALL-E 3 image prompt in English for "${keyword}". Real photograph style (NOT illustration/cartoon), news article header. Respond with ONLY the prompt, under 150 chars.` }],
    });
    const base = msg.content[0].type === "text" ? msg.content[0].text.trim() : keyword;
    return appendPhotoSuffix(base, category);
  } catch {
    return appendPhotoSuffix(`News article header about ${keyword}`, category);
  }
}

export async function POST_DISABLED(request: Request) {
  try {
    const body = (await request.json()) as { keyword: string; category?: string };
    const { keyword } = body;
    const category = body.category || '사회/생활';
    if (!keyword?.trim()) return Response.json({ error: "키워드 필요" }, { status: 400 });

    const prompt = await keywordToPrompt(keyword, category);
    console.log("[dalle] 프롬프트:", prompt.slice(0, 200));

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return Response.json({ error: "OpenAI API 키 미설정" }, { status: 500 });

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        style: "natural",
      }),
      signal: AbortSignal.timeout(50000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[dalle] 에러:", res.status, err.slice(0, 200));
      return Response.json({ error: `이미지 생성 실패 (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return Response.json({ error: "이미지 URL 없음" }, { status: 502 });

    console.log("[dalle] 이미지 생성 완료");
    return Response.json({ imageUrl, prompt });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
*/
