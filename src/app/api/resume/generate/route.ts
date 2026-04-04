import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

interface CareerEntry {
  company: string;
  position: string;
  period: string;
  description: string;
}

interface ResumeInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  school: string;
  major: string;
  gradYear: string;
  careers: CareerEntry[];
  skills: string;
  targetJob: string;
  keywords: string;
  existingText: string;
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ResumeInput;

    if (!input.name?.trim() && !input.existingText?.trim()) {
      return Response.json({ error: "이름 또는 기존 이력서를 입력해주세요." }, { status: 400 });
    }

    const isImprove = !!input.existingText?.trim();

    const userContent = isImprove
      ? `아래 기존 이력서를 개선해주세요. 지원 직무: ${input.targetJob || "미정"}\n키워드: ${input.keywords || ""}\n\n기존 이력서:\n${input.existingText}`
      : `다음 정보로 이력서와 자기소개서를 작성해주세요.

이름: ${input.name}
이메일: ${input.email}
전화번호: ${input.phone}
주소: ${input.address}
학교: ${input.school}
전공: ${input.major}
졸업연도: ${input.gradYear}
경력:
${input.careers.filter((c) => c.company).map((c) => `- ${c.company} / ${c.position} / ${c.period}\n  ${c.description}`).join("\n")}
스킬/자격증: ${input.skills}
지원 직무: ${input.targetJob}
키워드: ${input.keywords}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `당신은 한국 취업 시장 전문 이력서/자기소개서 작성 전문가입니다.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "resume": {
    "name": "이름",
    "email": "이메일",
    "phone": "전화번호",
    "address": "주소",
    "summary": "한줄 프로필 요약",
    "education": "학력 정보",
    "careers": [
      {"company": "회사명", "position": "직책", "period": "기간", "description": "개선된 업무 설명 (성과 중심)"}
    ],
    "skills": "스킬/자격증 (정리된 형태)"
  },
  "coverLetter": "자기소개서 전문 (800~1200자, 단락 구분)",
  "summary": "이력서 한줄 요약"
}

이력서는 지원 직무에 맞게 키워드를 자연스럽게 포함하세요.
경력 설명은 성과 중심으로 개선하세요.
자기소개서는 도입-본론-결론 구조로 작성하세요.`,
      messages: [{ role: "user", content: userContent }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = extractJSON(responseText);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return Response.json({ error: "AI 응답을 처리할 수 없습니다. 다시 시도해주세요." }, { status: 502 });
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `이력서 생성 중 오류: ${msg}` }, { status: 500 });
  }
}
