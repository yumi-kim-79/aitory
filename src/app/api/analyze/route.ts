import { NextRequest } from "next/server";
export const maxDuration = 60;
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const client = new Anthropic();

const SYSTEM_PROMPT = `당신은 한국 법률 전문가이자 계약서 검토 AI입니다.
사용자가 제공하는 계약서 텍스트를 분석하여 아래 JSON 형식으로 응답하세요.
반드시 JSON 형식으로만 응답하세요.
JSON 외의 텍스트는 절대 포함하지 마세요.
응답은 반드시 { 로 시작해야 합니다.
마크다운 코드블록(백틱)으로 감싸지 마세요.

{
  "riskScore": 0~100 사이의 위험도 점수 (높을수록 위험),
  "summary": "계약서 전체 요약 (2~3문장)",
  "clauses": [
    {
      "text": "원문 조항 텍스트",
      "level": "danger" | "warning" | "safe",
      "reason": "해당 조항이 왜 위험/주의/안전한지 설명",
      "suggestion": "수정 제안 문구 (safe인 경우 빈 문자열)"
    }
  ]
}

분류 기준:
- danger: 불공정 조항, 과도한 책임 전가, 일방적 해지권, 과도한 위약금 등
- warning: 모호한 표현, 추가 확인 필요 조항, 불리할 수 있는 조건
- safe: 일반적이고 공정한 조항`;

// ── 파일 파싱 함수들 ──

async function parsePDF(buffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `aitory-${randomUUID()}.pdf`);
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

async function parseXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    lines.push(`[시트: ${sheetName}]`);
    lines.push(XLSX.utils.sheet_to_csv(sheet));
    lines.push("");
  }
  return lines.join("\n");
}

// ── 이미지 처리 ──

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const IMAGE_MEDIA_TYPES: Record<string, ImageMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// 여러 이미지를 한 번의 Vision API 호출로 OCR
async function extractTextFromImages(
  images: { buffer: Buffer; ext: string }[],
): Promise<string> {
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  for (const img of images) {
    const mediaType = IMAGE_MEDIA_TYPES[img.ext] || "image/jpeg";
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: img.buffer.toString("base64"),
      },
    });
  }

  content.push({
    type: "text",
    text:
      images.length === 1
        ? "이 이미지에서 텍스트를 추출해줘. 원문 그대로만 출력해줘. 설명 없이 텍스트만."
        : "위 이미지들은 계약서 페이지들입니다. 모든 이미지에서 텍스트를 순서대로 추출해줘. 원문 그대로만 출력해줘. 설명 없이 텍스트만.",
  });

  const ocrResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [{ role: "user", content }],
  });

  return ocrResponse.content[0].type === "text"
    ? ocrResponse.content[0].text
    : "";
}

// 비이미지 단일 파일 → 텍스트
async function parseDocFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "pdf":
      return parsePDF(buffer);
    case "docx":
      return parseDocx(buffer);
    case "xlsx":
    case "xls":
      return parseXlsx(buffer);
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
  }
}

// ── 유틸 ──

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

// ── API 핸들러 ──

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let contractText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const fileEntries = formData.getAll("files") as File[];
      const text = formData.get("text") as string | null;

      // 하위 호환
      const singleFile = formData.get("file") as File | null;
      if (singleFile && fileEntries.length === 0) {
        fileEntries.push(singleFile);
      }

      if (fileEntries.length > 0) {
        // 이미지 / 비이미지 분류
        const imageFiles: { buffer: Buffer; ext: string }[] = [];
        const docFiles: File[] = [];

        for (const f of fileEntries) {
          const ext = getExt(f.name);
          if (IMAGE_EXTENSIONS.has(ext)) {
            imageFiles.push({
              buffer: Buffer.from(await f.arrayBuffer()),
              ext,
            });
          } else {
            docFiles.push(f);
          }
        }

        const textParts: string[] = [];

        // 비이미지 파일 병렬 처리
        if (docFiles.length > 0) {
          const docResults = await Promise.all(
            docFiles.map((f) => parseDocFile(f)),
          );
          textParts.push(...docResults);
        }

        // 이미지는 한 번의 Vision API로 배치 OCR
        if (imageFiles.length > 0) {
          const ocrText = await extractTextFromImages(imageFiles);
          textParts.push(ocrText);
        }

        contractText = textParts.join("\n\n---\n\n");
      } else if (text) {
        contractText = text;
      }
    } else {
      const body = await request.json();
      contractText = body.text || "";
    }

    if (!contractText.trim() || contractText.trim().length < 5) {
      return Response.json(
        {
          error:
            "계약서 텍스트를 추출할 수 없습니다. 더 선명한 이미지를 사용하거나 텍스트를 직접 입력해주세요.",
        },
        { status: 400 },
      );
    }

    // 분석
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `다음 계약서를 분석해주세요:\n\n${contractText}`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = extractJSON(responseText);

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("JSON 파싱 실패. 원본 응답:", responseText.slice(0, 300));
      return Response.json(
        { error: "AI 응답을 처리할 수 없습니다. 다시 시도해주세요." },
        { status: 502 },
      );
    }

    return Response.json(analysis);
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("분석 오류:", errMsg);
    return Response.json(
      { error: `계약서 분석 중 오류가 발생했습니다: ${errMsg}` },
      { status: 500 },
    );
  }
}
