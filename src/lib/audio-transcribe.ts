// 브라우저에서 오디오를 조각내어 전사하는 유틸 (외부 의존성 없음)
// 16kHz 모노로 디코딩 → 2분 조각(WAV) → /api/transcribe 순차 호출 → 합치기
// 조각이 작아 Vercel 4.5MB / Whisper 25MB 제한을 모두 우회하고, 1시간짜리도 처리 가능

const TARGET_SR = 16000;
const CHUNK_SEC = 120; // 2분 조각 (WAV ≈ 3.8MB)
const DIRECT_MAX = 4_000_000; // 4MB 이하는 조각 없이 바로 전송

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(o + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

async function decodeMono16k(file: File): Promise<Float32Array> {
  const arrayBuf = await file.arrayBuffer();
  const OAC: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OAC(1, 1, TARGET_SR);
  const audioBuf = await ctx.decodeAudioData(arrayBuf);
  const ch = audioBuf.numberOfChannels;
  const len = audioBuf.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = audioBuf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i] / ch;
  }
  return out;
}

async function sendChunk(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "음성 변환에 실패했습니다.");
  return data.text || "";
}

export type ProgressFn = (msg: string, pct: number) => void;

export async function transcribeAudio(file: File, onProgress?: ProgressFn): Promise<string> {
  if (file.size <= DIRECT_MAX) {
    onProgress?.("음성을 텍스트로 변환 중...", 40);
    const t = await sendChunk(file);
    onProgress?.("완료", 100);
    return t;
  }

  onProgress?.("오디오 분석 중...", 4);
  const samples = await decodeMono16k(file);
  const chunkLen = TARGET_SR * CHUNK_SEC;
  const total = Math.max(1, Math.ceil(samples.length / chunkLen));
  let out = "";
  for (let i = 0; i < total; i++) {
    const seg = samples.subarray(i * chunkLen, Math.min((i + 1) * chunkLen, samples.length));
    const wav = encodeWav(seg, TARGET_SR);
    onProgress?.(`변환 중 (${i + 1}/${total} 조각)`, Math.round(((i + 0.5) / total) * 100));
    const t = await sendChunk(new File([wav], `chunk${i}.wav`, { type: "audio/wav" }));
    out += (out ? "\n" : "") + t;
  }
  onProgress?.("완료", 100);
  return out;
}

export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      const d = a.duration || 0;
      URL.revokeObjectURL(a.src);
      resolve(isFinite(d) ? d : 0);
    };
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });
}

// 10분당 1크레딧 (최소 1)
export function audioCredits(durationSec: number): number {
  return Math.max(1, Math.ceil(durationSec / 60 / 10));
}

export const AUDIO_EXTS = ["mp3", "m4a", "wav", "mpeg", "mpga", "webm", "ogg", "flac", "aac", "mp4"];
export function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return AUDIO_EXTS.includes(ext);
}
