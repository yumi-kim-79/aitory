import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type MT = "image/jpeg" | "image/png" | "image/webp";
const MEDIA: Record<string, MT> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      return Response.json({ error: "명함 이미지를 업로드해주세요." }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const mediaType = MEDIA[ext] || "image/jpeg";
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: `이 명함 이미지에서 연락처 정보를 추출해주세요.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다.

{
  "name": "이름",
  "company": "회사명",
  "title": "직책",
  "department": "부서",
  "phones": ["전화번호"],
  "emails": ["이메일"],
  "address": "주소",
  "website": "웹사이트",
  "sns": {}
}

인식할 수 없는 필드는 빈 문자열 또는 빈 배열로 설정하세요.`,
              },
            ],
          },
        ],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      try {
        const parsed = JSON.parse(extractJSON(responseText));
        parsed._imageData = `data:${mediaType};base64,${base64}`;
        results.push(parsed);
      } catch {
        results.push({
          name: "", company: "", title: "", department: "",
          phones: [], emails: [], address: "", website: "", sns: {},
          _imageData: `data:${mediaType};base64,${base64}`,
          _error: "명함을 인식할 수 없습니다.",
        });
      }
    }

    return Response.json({ cards: results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("명함 스캔 오류:", msg);
    return Response.json({ error: `명함 스캔 중 오류가 발생했습니다: ${msg}` }, { status: 500 });
  }
}
