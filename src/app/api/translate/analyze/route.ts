import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const client = new Anthropic();

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

async function parsePDF(buffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `aitory-tr-${randomUUID()}.pdf`);
  await writeFile(tmpPath, buffer);
  try {
    const parts = ["scripts", "parse-pdf.mjs"];
    const scriptPath = join(process.cwd(), ...parts);
    return await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        [scriptPath, tmpPath],
        { maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => (err ? reject(err) : resolve(stdout)),
      );
    });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const MEDIA_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp"> =
  { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function ocrImage(buffer: Buffer, ext: string): Promise<string> {
  const mediaType = MEDIA_TYPES[ext] || "image/jpeg";
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
          { type: "text", text: "이 이미지에서 텍스트를 추출해줘. 원문 그대로만 출력해줘. 설명 없이 텍스트만." },
        ],
      },
    ],
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return parsePDF(buffer);
  if (ext === "docx") return parseDocx(buffer);
  if (IMAGE_EXTS.has(ext)) return ocrImage(buffer, ext);
  throw new Error("지원하지 않는 파일 형식입니다.");
}

function buildSystemPrompt(
  sourceLang: string,
  outputOptions: string[],
): string {
  const optionFields: string[] = [];

  if (outputOptions.includes("전체 번역"))
    optionFields.push('"translated_text": "번역된 전체 텍스트"');
  else optionFields.push('"translated_text": ""');

  if (outputOptions.includes("핵심 요약"))
    optionFields.push(
      '"summary": "3~5줄 핵심 요약", "bullet_points": ["주요 포인트 3~5개"]',
    );
  else optionFields.push('"summary": "", "bullet_points": []');

  if (outputOptions.includes("주요 키워드 추출"))
    optionFields.push(
      '"keywords": [{"word": "키워드", "importance": "high|medium|low"}]',
    );
  else optionFields.push('"keywords": []');

  return `당신은 전문 번역가이자 문서 분석가입니다.
주어진 텍스트를 한국어로 번역하고 분석해주세요.
${sourceLang !== "자동감지" ? `원본 언어는 ${sourceLang}입니다.` : "원본 언어를 자동으로 감지하세요."}

반드시 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다. 마크다운 코드블록으로 감싸지 마세요.

{
  "detected_language": "감지된 원본 언어",
  ${optionFields.join(",\n  ")},
  "is_contract": true 또는 false (계약서/법률 문서 여부)
}

번역은 자연스럽고 정확한 한국어로 작성하세요.
계약서, 법률 문서, NDA 등이면 is_contract를 true로 설정하세요.`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;
    const sourceLang = (formData.get("sourceLang") as string) || "자동감지";
    const outputOptions = JSON.parse(
      (formData.get("outputOptions") as string) || "[]",
    ) as string[];

    let sourceText = "";

    if (file) {
      sourceText = await extractText(file);
    } else if (text) {
      sourceText = text;
    }

    if (!sourceText.trim() || sourceText.trim().length < 3) {
      return Response.json(
        { error: "번역할 텍스트를 입력해주세요." },
        { status: 400 },
      );
    }

    if (outputOptions.length === 0) {
      return Response.json(
        { error: "출력 옵션을 1개 이상 선택해주세요." },
        { status: 400 },
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: buildSystemPrompt(sourceLang, outputOptions),
      messages: [
        {
          role: "user",
          content: `다음 텍스트를 번역하고 분석해주세요:\n\n${sourceText}`,
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
    console.error("번역 오류:", msg);
    return Response.json(
      { error: `번역 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
