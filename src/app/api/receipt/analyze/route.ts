import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

export async function POST(request: Request) {
  try {
    console.log("[receipt] 영수증 분석 시작");
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      console.log("[receipt] 파일 없음");
      return Response.json(
        { error: "영수증 이미지를 업로드해주세요." },
        { status: 400 },
      );
    }

    console.log(`[receipt] 이미지 수신: ${files.length}개`);
    for (const f of files) {
      console.log(`  - ${f.name} (${f.size} bytes, ${f.type})`);
    }

    // 모든 이미지를 content 배열에 담아 1회 호출
    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const mediaType = MEDIA_TYPES[ext] || "image/jpeg";
      const buffer = Buffer.from(await file.arrayBuffer());
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: buffer.toString("base64"),
        },
      });
    }

    content.push({
      type: "text",
      text: `이 영수증 이미지를 분석해주세요.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "store_name": "가게명",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "items": [
    {"name": "품목명", "price": 금액(숫자)}
  ],
  "total": 합계금액(숫자),
  "category": "식비|교통|쇼핑|의료|여가|교육|주거|업무|기타",
  "payment_method": "카드|현금|기타"
}

날짜를 인식할 수 없으면 오늘 날짜, 시간을 인식할 수 없으면 빈 문자열로 설정하세요.
카테고리는 가게 업종에 맞게 자동 분류하세요.`,
    });

    console.log("[receipt] Claude Vision API 호출");
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });
    console.log("[receipt] 분석 완료");

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = extractJSON(responseText);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.error("JSON 파싱 실패:", responseText.slice(0, 300));
      return Response.json(
        { error: "영수증을 인식할 수 없습니다. 더 선명한 이미지를 사용해주세요." },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("영수증 분석 오류:", msg);
    return Response.json(
      { error: `영수증 분석 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
