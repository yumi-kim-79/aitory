import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

interface Clause {
  text: string;
  level: "danger" | "warning" | "safe";
  reason: string;
  suggestion: string;
}

export async function POST(request: Request) {
  try {
    const { clauses } = (await request.json()) as { clauses: Clause[] };

    if (!clauses?.length) {
      return Response.json(
        { error: "조항 목록이 필요합니다." },
        { status: 400 },
      );
    }

    const clauseList = clauses
      .map(
        (c, i) =>
          `[조항 ${i + 1}] (${c.level === "danger" ? "위험" : c.level === "warning" ? "주의" : "안전"})\n원문: ${c.text}\n문제점: ${c.reason}`,
      )
      .join("\n\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 법률 전문가입니다. 계약서의 모든 조항을 검토하여 공정하게 수정해주세요.
반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "fullText": "수정된 계약서 전문 (각 조항을 줄바꿈으로 구분)",
  "changes": ["변경사항 1 요약", "변경사항 2 요약"],
  "fixedClauses": [
    {
      "original": "원문 조항 텍스트 (그대로)",
      "fixed": "수정된 조항 텍스트 (안전 조항은 원문 그대로)",
      "modified": true 또는 false
    }
  ]
}

안전한 조항은 원문 그대로 유지하고 modified를 false로 설정하세요.
위험/주의 조항만 공정하게 수정하고 modified를 true로 설정하세요.
fixedClauses 배열의 순서와 개수는 입력 조항과 동일해야 합니다.`,
      messages: [
        {
          role: "user",
          content: `다음 계약서의 모든 조항을 검토하고, 위험/주의 조항을 수정하여 공정한 계약서를 작성해주세요.\n\n${clauseList}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const result = JSON.parse(extractJSON(responseText));

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("전체 수정 오류:", msg);
    return Response.json(
      { error: `계약서 수정 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
