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

interface ImageInput {
  name: string;
  ext: string;
  base64: string;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    console.log("[receipt] 영수증 분석 시작");

    // JSON body 우선, FormData fallback
    const contentType = request.headers.get("content-type") || "";
    let images: ImageInput[] = [];

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { images?: ImageInput[] };
      images = body.images || [];
      console.log(`[receipt] JSON 방식: ${images.length}개`);
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files") as File[];
      console.log(`[receipt] FormData 방식: ${files.length}개`);
      for (const f of files) {
        const buffer = Buffer.from(await f.arrayBuffer());
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        images.push({
          name: f.name,
          ext,
          base64: buffer.toString("base64"),
        });
      }
    }

    if (images.length === 0) {
      console.log("[receipt] 이미지 없음");
      return Response.json(
        { error: "영수증 이미지를 업로드해주세요." },
        { status: 400 },
      );
    }

    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    for (const img of images) {
      const mediaType = MEDIA_TYPES[img.ext] || "image/jpeg";
      console.log(`  - ${img.name} (base64: ${img.base64.length} chars, ${mediaType})`);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: img.base64,
        },
      });
    }

    content.push({
      type: "text",
      text: `이 이미지는 한국 영수증입니다. 영수증에 실제로 인쇄된 텍스트를 정확하게 읽어주세요.

[절대 하지 말 것]
- 메뉴명을 임의로 추측하거나 창작하지 마세요 (후라이드, 콜라 등 영수증에 없는 항목 추가 금지)
- 영수증에 없는 항목을 추가하지 마세요
- OCR 오인식을 임의로 수정하지 마세요 (원본 텍스트를 최대한 보존)
- 예상되는 일반적인 영수증 형태로 추측하지 마세요

[반드시 할 것]
- 영수증에 실제로 인쇄된 항목만 추출
- 가게명: 영수증 상단에 있는 실제 가맹점/가게명 그대로
- 금액 항목: 영수증에 표시된 실제 항목명과 금액 그대로
  (공급가액/금액, 부가세/부가가치세, 합계/총액 등)
- 날짜/시간: 영수증에 적힌 거래일시 그대로
- 결제 합계: 영수증에 표시된 최종 결제 금액
- 항목이 "공급가액 + 부가세" 구조면 그대로 추출 (다른 메뉴 항목을 만들지 말 것)
- 항목명이 불명확하면 "항목1", "항목2"로 표시
- 이미지가 불명확하여 읽을 수 없으면: {"error": "이미지가 불명확합니다"} 반환
- 영수증이 아닌 이미지면: {"error": "영수증을 찾을 수 없습니다"} 반환

[응답 형식]
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

정상 응답:
{
  "store_name": "실제 가맹점명",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "items": [
    {"name": "공급가액", "price": 6818},
    {"name": "부가세", "price": 682}
  ],
  "total": 7500,
  "category": "식비|교통|쇼핑|의료|여가|교육|주거|업무|기타",
  "payment_method": "카드|현금|기타"
}

[참고 예시]
영수증에 "공급가액 6,818" "부가세 682" "합계 7,500"만 적혀 있으면:
items는 [{"name":"공급가액","price":6818},{"name":"부가세","price":682}] 이어야 하고
"후라이드", "콜라" 같은 메뉴명을 만들어내면 안 됩니다.`,
    });

    console.log("[receipt] Claude Vision API 호출");
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0,
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
      console.error("[receipt] JSON 파싱 실패:", responseText.slice(0, 300));
      return Response.json(
        { error: "영수증을 인식할 수 없습니다. 더 선명한 이미지를 사용해주세요." },
        { status: 502 },
      );
    }

    // AI가 에러 객체를 반환한 경우
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[receipt] 에러:", msg);
    return Response.json(
      { error: `영수증 분석 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
