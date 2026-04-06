import Anthropic from "@anthropic-ai/sdk";
export const maxDuration = 60;

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const { text, title, date, attendees, meetingType, outputOptions } =
      await request.json();

    if (!text?.trim()) {
      return Response.json(
        { error: "회의 내용을 입력해주세요." },
        { status: 400 },
      );
    }

    const opts = (outputOptions || []) as string[];
    const optFields: string[] = [];
    if (opts.includes("회의 요약"))
      optFields.push(
        '"summary": "3~5줄 핵심 요약", "bullet_points": ["주요 논의 포인트 3~5개"]',
      );
    else optFields.push('"summary": "", "bullet_points": []');
    if (opts.includes("주요 결정 사항"))
      optFields.push('"decisions": ["결정사항 목록"]');
    else optFields.push('"decisions": []');
    if (opts.includes("액션 아이템"))
      optFields.push(
        '"action_items": [{"task":"업무","assignee":"담당자","due_date":"YYYY-MM-DD","priority":"high|medium|low"}]',
      );
    else optFields.push('"action_items": []');
    if (opts.includes("다음 회의 안건 제안"))
      optFields.push('"next_agenda": ["안건"]');
    else optFields.push('"next_agenda": []');
    if (opts.includes("전체 회의록"))
      optFields.push('"full_minutes": "정형화된 전체 회의록 텍스트"');
    else optFields.push('"full_minutes": ""');

    const systemPrompt = `당신은 비서/PM 역할의 회의록 작성 전문가입니다.
회의 내용을 분석하여 전문적인 회의록을 작성해주세요.

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  ${optFields.join(",\n  ")}
}

회의 정보:
- 제목: ${title || "미정"}
- 날짜: ${date || "미정"}
- 참석자: ${attendees?.join(", ") || "미정"}
- 유형: ${meetingType || "기타"}

액션 아이템의 담당자는 참석자 목록에서 적절히 배정하세요.
기한은 회의일 기준 1~2주 이내로 설정하세요.
전체 회의록은 정형화된 비즈니스 포맷으로 작성하세요.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `다음 회의 내용으로 회의록을 작성해주세요:\n\n${text}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = extractJSON(responseText);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.error("JSON 파싱 실패:", responseText.slice(0, 300));
      return Response.json(
        { error: "AI 응답을 처리할 수 없습니다. 다시 시도해주세요." },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("회의록 생성 오류:", msg);
    return Response.json(
      { error: `회의록 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
