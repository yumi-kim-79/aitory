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

const DOC_PROMPTS: Record<string, string> = {
  내용증명:
    "일반 내용증명 우편 형식. 사실관계 기술 후 요구사항과 기한을 명시. '본 서면은 내용증명 우편으로 발송합니다' 문구 포함.",
  "계약해지 통보서":
    "계약해지 통보서 형식. 계약 특정(계약일, 계약 내용), 해지 사유, 해지 효력 발생일 명시.",
  "환불/손해배상 요청서":
    "환불 또는 손해배상 청구서 형식. 거래 내역, 문제 상황, 요청 금액, 미이행 시 법적 조치 가능성 명시.",
  "임금체불 내용증명":
    "임금체불 내용증명 형식. 근로기준법 제36조 위반 명시, 체불 기간/금액, 노동부 진정 및 형사고소 가능성 경고.",
  "부동산 계약 해지 통보":
    "부동산 임대차/매매 계약 해지 통보서. 계약 물건 특정, 해지 사유, 보증금 반환 요구, 민법 관련 조항 인용.",
};

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const { docType, sender, receiver, incident, demand, deadline } = input as {
      docType: string;
      sender: { name: string; address: string; phone: string };
      receiver: { name: string; address: string };
      incident: string;
      demand: string;
      deadline: string;
    };

    if (!docType || !sender?.name || !incident) {
      return Response.json({ error: "문서 종류, 발신인, 사건 개요는 필수입니다." }, { status: 400 });
    }

    const typeGuide = DOC_PROMPTS[docType] || "일반 법률 문서 형식으로 작성.";

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 법률 문서 작성 전문가입니다.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "title": "문서 제목",
  "content": "문서 전문 (줄바꿈 포함)",
  "warnings": ["주의사항 2~3개"]
}

문서 형식 가이드: ${typeGuide}

작성 원칙:
- 한국 법률 문서 표준 형식 준수
- 발신인/수신인 정보 정확히 포함
- 날짜(오늘: ${new Date().toISOString().slice(0, 10)}) 명시
- 요구사항과 기한 명확히 기술
- 정중하면서도 단호한 법률 문체 사용
- 관련 법률 조항 인용 (해당 시)`,
      messages: [
        {
          role: "user",
          content: `다음 정보로 "${docType}"을 작성해주세요.

발신인: ${sender.name}, ${sender.address}, ${sender.phone}
수신인: ${receiver.name}, ${receiver.address}
사건 개요: ${incident}
요구사항: ${demand}
처리 기한: ${deadline || "서면 수령 후 7일 이내"}`,
        },
      ],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    let result;
    try {
      result = JSON.parse(extractJSON(responseText));
    } catch {
      return Response.json({ error: "AI 응답을 처리할 수 없습니다." }, { status: 502 });
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `문서 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
