import Anthropic from "@anthropic-ai/sdk";
export const maxDuration = 60;

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const { clause, reason } = await request.json();

    if (!clause) {
      return Response.json(
        { error: "조항 텍스트가 필요합니다." },
        { status: 400 },
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `당신은 한국 법률 전문가입니다. 불공정하거나 위험한 계약 조항을 공정하게 수정해주세요.
반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "fixed": "수정된 조항 전문",
  "explanation": "어떤 부분을 왜 수정했는지 간단한 설명"
}`,
      messages: [
        {
          role: "user",
          content: `다음 조항을 공정하게 수정해주세요.\n\n원문: ${clause}\n문제점: ${reason || "불공정한 조항"}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const result = JSON.parse(extractJSON(responseText));

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("조항 수정 오류:", msg);
    return Response.json(
      { error: `조항 수정 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
