import Anthropic from "@anthropic-ai/sdk";

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
    const { senderName, clientName, clientEmail, total, docType } = await request.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `이메일 제목과 본문을 JSON으로 생성하세요. 응답은 반드시 { 로 시작. 코드블록 없이.
{"subject":"이메일 제목","body":"이메일 본문 (줄바꿈 포함)"}`,
      messages: [{
        role: "user",
        content: `${senderName}이 ${clientName}에게 보내는 ${docType || "견적서"} 발송 이메일을 작성해주세요. 금액: ${total?.toLocaleString() || 0}원. 정중하고 비즈니스 톤.`,
      }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try { result = JSON.parse(extractJSON(responseText)); } catch { result = { subject: `${docType || "견적서"} 발송 드립니다 - ${senderName}`, body: `안녕하세요, ${clientName}님.\n\n${docType || "견적서"}를 발송해 드립니다.\n금액: ${total?.toLocaleString() || 0}원\n\n검토 부탁드립니다.\n\n감사합니다.\n${senderName}` }; }

    // Gmail API 미연동 → mailto URI 생성
    const mailto = `mailto:${encodeURIComponent(clientEmail || "")}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(result.body)}`;

    return Response.json({ ...result, mailto, clientEmail });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
