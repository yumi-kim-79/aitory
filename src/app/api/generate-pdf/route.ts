import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";

interface FixedClause {
  original: string;
  fixed: string;
  modified: boolean;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  width: number;
  height: number;
}

interface PageInfo {
  pageIndex: number;
  width: number;
  height: number;
  items: TextItem[];
}

let cachedFontBytes: Uint8Array | null = null;

async function getFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath = join(process.cwd(), "fonts", "NotoSansKR-Regular.ttf");
  cachedFontBytes = new Uint8Array(await readFile(fontPath));
  return cachedFontBytes;
}

async function extractTextPositions(pdfBuffer: Buffer): Promise<PageInfo[]> {
  const tmpPath = join(tmpdir(), `aitory-pos-${randomUUID()}.pdf`);
  await writeFile(tmpPath, pdfBuffer);
  try {
    const parts = ["scripts", "extract-text-positions.mjs"];
    const scriptPath = join(process.cwd(), ...parts);
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        [scriptPath, tmpPath],
        { maxBuffer: 50 * 1024 * 1024 },
        (err, out) => (err ? reject(err) : resolve(out)),
      );
    });
    return JSON.parse(stdout);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").trim();
}

function findClauseInPage(
  items: TextItem[],
  clauseText: string,
): { startIdx: number; endIdx: number } | null {
  const target = normalize(clauseText);
  if (!target) return null;

  // 연속된 아이템들을 합쳐가며 매칭
  for (let start = 0; start < items.length; start++) {
    let concat = "";
    for (let end = start; end < items.length; end++) {
      concat += normalize(items[end].str);
      if (concat.includes(target)) {
        return { startIdx: start, endIdx: end };
      }
      // 너무 길어지면 중단
      if (concat.length > target.length * 3) break;
    }
  }

  // 부분 매칭 (조항 텍스트의 앞 20자로 시도)
  const partial = target.slice(0, Math.min(20, target.length));
  for (let start = 0; start < items.length; start++) {
    let concat = "";
    for (let end = start; end < Math.min(start + 30, items.length); end++) {
      concat += normalize(items[end].str);
      if (concat.includes(partial)) {
        // 부분 매칭 성공 - endIdx를 더 확장
        const extEnd = Math.min(end + 10, items.length - 1);
        return { startIdx: start, endIdx: extEnd };
      }
    }
  }

  return null;
}

function getBoundingBox(items: TextItem[], start: number, end: number) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = start; i <= end; i++) {
    const item = items[i];
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const char of para) {
      const test = current + char;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const jsonData = formData.get("data") as string;
    const originalFile = formData.get("file") as File | null;
    const { fixedClauses, changes } = JSON.parse(jsonData) as {
      fixedClauses: FixedClause[];
      changes: string[];
    };

    if (!fixedClauses?.length) {
      return Response.json(
        { error: "수정된 조항 데이터가 필요합니다." },
        { status: 400 },
      );
    }

    const fontBytes = await getFontBytes();

    // 원본 PDF가 있으면 오버레이 방식, 없으면 새 PDF 생성
    if (originalFile) {
      const pdfBytes = await generateOverlayPdf(
        Buffer.from(await originalFile.arrayBuffer()),
        fixedClauses,
        changes,
        fontBytes,
      );
      return new Response(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="modified_contract.pdf"',
        },
      });
    }

    // 원본 PDF 없음 - 새로 생성
    const pdfBytes = await generateNewPdf(fixedClauses, changes, fontBytes);
    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="modified_contract.pdf"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("PDF 생성 오류:", msg);
    return Response.json(
      { error: `PDF 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}

// ── 원본 PDF 위에 수정 오버레이 ──
async function generateOverlayPdf(
  originalBuffer: Buffer,
  fixedClauses: FixedClause[],
  changes: string[],
  fontBytes: Uint8Array,
): Promise<Buffer> {
  // 1. 원본 텍스트 위치 추출
  const pageInfos = await extractTextPositions(originalBuffer);

  // 2. 원본 PDF 로드
  const pdfDoc = await PDFDocument.load(originalBuffer);
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const pages = pdfDoc.getPages();

  const blue = rgb(0.1, 0.3, 0.8);
  const white = rgb(1, 1, 1);
  const lightBlue = rgb(0.9, 0.94, 1);

  // 3. 수정된 조항 위치 찾아서 오버레이
  const modifiedClauses = fixedClauses.filter((c) => c.modified);

  for (const clause of modifiedClauses) {
    for (const pageInfo of pageInfos) {
      const match = findClauseInPage(pageInfo.items, clause.original);
      if (!match) continue;

      const page = pages[pageInfo.pageIndex];
      if (!page) continue;

      const box = getBoundingBox(
        pageInfo.items,
        match.startIdx,
        match.endIdx,
      );

      // 원본 텍스트의 폰트 크기 참고
      const origFontSize =
        pageInfo.items[match.startIdx]?.fontSize || 11;
      const overlayFontSize = Math.min(origFontSize, 11);
      const lineHeight = overlayFontSize * 1.6;

      // 수정 텍스트 줄바꿈
      const wrappedLines = wrapText(
        clause.fixed,
        font,
        overlayFontSize,
        box.width > 50 ? box.width : 400,
      );

      const blockHeight = Math.max(
        box.height + 4,
        wrappedLines.length * lineHeight + 4,
      );

      // 흰색 배경으로 원본 덮기
      page.drawRectangle({
        x: box.x - 2,
        y: box.y - 2,
        width: (box.width > 50 ? box.width : 400) + 4,
        height: blockHeight,
        color: white,
        borderWidth: 0,
      });

      // 하늘색 하이라이트
      page.drawRectangle({
        x: box.x - 2,
        y: box.y - 2,
        width: (box.width > 50 ? box.width : 400) + 4,
        height: blockHeight,
        color: lightBlue,
        borderWidth: 0.5,
        borderColor: blue,
      });

      // 수정된 텍스트 렌더링 (파란색)
      let textY = box.y + blockHeight - lineHeight;
      for (const line of wrappedLines) {
        page.drawText(line, {
          x: box.x,
          y: textY,
          font,
          size: overlayFontSize,
          color: blue,
        });
        textY -= lineHeight;
      }

      break; // 첫 번째 매칭 페이지에서만 오버레이
    }
  }

  // 4. 마지막에 수정 요약 페이지 추가
  appendSummaryPage(pdfDoc, font, fixedClauses, changes);

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}

// ── 수정 요약 페이지 추가 ──
function appendSummaryPage(
  pdfDoc: PDFDocument,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fixedClauses: FixedClause[],
  changes: string[],
) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = fontSize * 1.7;

  const black = rgb(0, 0, 0);
  const blue = rgb(0.1, 0.3, 0.8);
  const gray = rgb(0.4, 0.4, 0.4);
  const red = rgb(0.8, 0.1, 0.1);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // 제목
  const title = "[ 수정 사항 요약 ]";
  const tw = font.widthOfTextAtSize(title, 16);
  page.drawText(title, {
    x: (pageWidth - tw) / 2,
    font,
    size: 16,
    y,
    color: black,
  });
  y -= 40;

  // 변경사항 목록
  if (changes?.length) {
    for (const c of changes) {
      const lines = wrapText(`• ${c}`, font, fontSize, contentWidth);
      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: margin, font, size: fontSize, y, color: gray });
        y -= lineHeight;
      }
    }
    y -= lineHeight;
  }

  // 조항별 원문 → 수정문
  const modified = fixedClauses.filter((c) => c.modified);
  for (let i = 0; i < modified.length; i++) {
    const clause = modified[i];

    ensureSpace(lineHeight * 4);
    page.drawText(`수정 ${i + 1}`, {
      x: margin,
      font,
      size: fontSize + 1,
      y,
      color: black,
    });
    y -= lineHeight * 1.2;

    // 원문 (빨간 취소선 느낌)
    const origLines = wrapText(clause.original, font, fontSize, contentWidth - 20);
    for (const line of origLines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: margin + 10,
        font,
        size: fontSize,
        y,
        color: red,
      });
      // 취소선
      const w = font.widthOfTextAtSize(line, fontSize);
      page.drawLine({
        start: { x: margin + 10, y: y + fontSize * 0.35 },
        end: { x: margin + 10 + w, y: y + fontSize * 0.35 },
        thickness: 0.8,
        color: red,
      });
      y -= lineHeight;
    }

    page.drawText("→", { x: margin + 10, font, size: fontSize, y, color: gray });
    y -= lineHeight;

    // 수정문 (파란색)
    const fixedLines = wrapText(clause.fixed, font, fontSize, contentWidth - 20);
    for (const line of fixedLines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: margin + 10,
        font,
        size: fontSize,
        y,
        color: blue,
      });
      y -= lineHeight;
    }

    y -= lineHeight;
  }
}

// ── 원본 PDF 없이 새로 생성 (텍스트 입력 케이스) ──
async function generateNewPdf(
  fixedClauses: FixedClause[],
  changes: string[],
  fontBytes: Uint8Array,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const lineHeight = fontSize * 1.8;

  const black = rgb(0, 0, 0);
  const blue = rgb(0.1, 0.3, 0.8);
  const lightBlue = rgb(0.92, 0.95, 1);
  const gray = rgb(0.4, 0.4, 0.4);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const titleText = "수정된 계약서";
  const titleWidth = font.widthOfTextAtSize(titleText, 18);
  page.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    font,
    size: 18,
    y,
    color: black,
  });
  y -= 45;

  if (changes?.length) {
    page.drawText("[ 변경 사항 ]", {
      x: margin,
      font,
      size: 13,
      y,
      color: gray,
    });
    y -= lineHeight;
    for (const change of changes) {
      const lines = wrapText(`• ${change}`, font, fontSize - 1, contentWidth - 10);
      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: margin + 10,
          font,
          size: fontSize - 1,
          y,
          color: gray,
        });
        y -= lineHeight;
      }
    }
    y -= lineHeight * 0.5;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= lineHeight * 1.5;
  }

  for (const clause of fixedClauses) {
    const isModified = clause.modified;
    const color = isModified ? blue : black;
    const lines = wrapText(clause.fixed, font, fontSize, contentWidth - 20);
    const blockH = lines.length * lineHeight + lineHeight;
    ensureSpace(blockH);

    if (isModified) {
      page.drawRectangle({
        x: margin - 5,
        y: y - lines.length * lineHeight + fontSize * 0.3,
        width: contentWidth + 10,
        height: lines.length * lineHeight + lineHeight * 0.3,
        color: lightBlue,
        borderWidth: 0,
      });
      const label = "[수정됨]";
      const lw = font.widthOfTextAtSize(label, fontSize - 2);
      page.drawText(label, {
        x: pageWidth - margin - lw,
        font,
        size: fontSize - 2,
        y: y + fontSize * 0.3,
        color: blue,
      });
    }

    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin + 5, font, size: fontSize, y, color });
      y -= lineHeight;
    }
    y -= lineHeight * 0.5;
  }

  const resultBytes = await pdfDoc.save();
  return Buffer.from(resultBytes);
}
