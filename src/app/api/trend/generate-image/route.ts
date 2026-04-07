export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

async function keywordToPrompt(keyword: string): Promise<string> {
  try {
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      temperature: 0,
      messages: [{ role: "user", content: `"${keyword}" 키워드와 관련된 DALL-E 3 이미지 생성 프롬프트를 영어로 작성해주세요. 사실적이고 뉴스 기사 대표이미지에 적합한 스타일. 사람 얼굴은 포함하지 마세요. 프롬프트만 출력, 설명 없이.` }],
    });
    return msg.content[0].type === "text" ? msg.content[0].text.trim() : keyword;
  } catch {
    return `Professional news article header image about ${keyword}, modern, no faces, editorial style`;
  }
}

export async function POST(request: Request) {
  try {
    const { keyword } = (await request.json()) as { keyword: string };
    if (!keyword?.trim()) return Response.json({ error: "키워드 필요" }, { status: 400 });

    const prompt = await keywordToPrompt(keyword);
    console.log("[dalle] 프롬프트:", prompt.slice(0, 100));

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
