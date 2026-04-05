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
      text: `이 영수증 이미지를 분석해주세요.
반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "store_name": "가게명",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "items": [
    {"name": "품목명 (표준 한국어)", "price": 금액(숫자)}
  ],
  "total": 합계금액(숫자),
  "category": "식비|교통|쇼핑|의료|여가|교육|주거|업무|기타",
  "payment_method": "카드|현금|기타"
}

중요 규칙 — OCR 오인식 교정:
1) 항목명은 반드시 알기 쉬운 표준 한국어로 변환하세요. OCR 오인식된 글자는 문맥으로 추론해서 올바른 단어로 수정하세요.
2) 영수증 금액 관련 용어는 아래 표준으로 통일하세요:
   - "부가세", "부가가치세", "세금", "불기시" 등 → "부가세"
   - "합계", "총계", "총액", "결제금액", "탈계" 등 → "합계"
   - "공급가액", "원가", "금액" 등 → "공급가액"
   - "수량" 관련 → "수량"
   - "단가" 관련 → "단가"
   - "할인", "할인액" 등 → "할인"
   - "봉사료", "서비스료" 등 → "봉사료"
3) 가게명도 OCR 오인식 교정하세요. 예: "김대준의 탈닭집" → 문맥상 "김태준의 탕탕집" 같은 올바른 이름으로 추론.
4) 실제 판매 품목(메뉴명/상품명)은 변환하지 말고 영수증의 원본 이름을 그대로 쓰되, 명백한 OCR 오인식만 교정하세요.
5) 날짜를 인식할 수 없으면 오늘 날짜, 시간을 인식할 수 없으면 빈 문자열로 설정하세요.
6) 카테고리는 가게 업종에 맞게 자동 분류하세요.`,
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
      console.error("[receipt] JSON 파싱 실패:", responseText.slice(0, 300));
      return Response.json(
        { error: "영수증을 인식할 수 없습니다. 더 선명한 이미지를 사용해주세요." },
        { status: 502 },
      );
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
