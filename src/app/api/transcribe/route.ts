import OpenAI, { toFile } from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 오디오 파일 → 한국어 텍스트 (Whisper)
export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "음성 변환 기능이 설정되지 않았습니다(OPENAI_API_KEY)." }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "오디오 파일이 필요합니다." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return Response.json({ error: "25MB 이하의 오디오 파일만 변환할 수 있습니다." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const uploadable = await toFile(buf, file.name || "audio.m4a");

    const tr = await openai.audio.transcriptions.create({
      file: uploadable,
      model: "whisper-1",
      language: "ko",
    });

    return Response.json({ text: tr.text || "" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("음성 변환 오류:", msg);
    return Response.json({ error: `음성 변환 중 오류: ${msg}` }, { status: 500 });
  }
}
