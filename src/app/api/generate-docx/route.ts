import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} from "docx";
import AdmZip from "adm-zip";

interface FixedClause {
  original: string;
  fixed: string;
  modified: boolean;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 원본 docx의 document.xml에서 수정 대상 텍스트를 찾아 교체
function patchDocumentXml(
  xml: string,
  fixedClauses: FixedClause[],
): string {
  const modified = fixedClauses.filter((c) => c.modified);
  let result = xml;

  for (const clause of modified) {
    const original = clause.original.trim();
    const fixed = clause.fixed.trim();

    // XML 내 <w:t> 태그들에서 원본 텍스트를 찾기
    // docx는 텍스트를 여러 <w:r> 런으로 분할할 수 있으므로
    // 전체 텍스트를 추출해서 매칭 후 해당 영역을 교체
    const plainText = extractPlainText(result);
    const idx = plainText.indexOf(original);
    if (idx === -1) continue;

    // 원본 텍스트를 포함하는 <w:r> 런들을 찾아서 교체
    // 간단한 접근: 원본 텍스트가 <w:t> 안에 통째로 있는 경우 처리
    const escapedOriginal = escapeXml(original);

    // <w:t> 태그 내에서 원본 텍스트 찾기 (xml:space 속성 포함/미포함)
    const tRegex = new RegExp(
      `(<w:t[^>]*>)([^<]*${escapeRegex(escapedOriginal)}[^<]*)(</w:t>)`,
    );
    const match = result.match(tRegex);

    if (match) {
      // 원본 run의 property (<w:rPr>) 찾기
      const runStart = result.lastIndexOf("<w:r>", match.index!);
      const runStartAlt = result.lastIndexOf("<w:r ", match.index!);
      const actualRunStart = Math.max(runStart, runStartAlt);

      if (actualRunStart >= 0) {
        const runEnd = result.indexOf("</w:r>", match.index!) + 6;
        const originalRun = result.slice(actualRunStart, runEnd);

        // 취소선+빨간색 원본 + 파란색+밑줄 수정본
        const strikeRun =
          `<w:r><w:rPr><w:strike/><w:color w:val="FF0000"/></w:rPr>` +
          `<w:t xml:space="preserve">${escapedOriginal}</w:t></w:r>`;
        const fixedRun =
          `<w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr>` +
          `<w:t xml:space="preserve"> → ${escapeXml(fixed)}</w:t></w:r>`;

        result = result.slice(0, actualRunStart) + strikeRun + fixedRun + result.slice(runEnd);
      }
    } else {
      // 텍스트가 여러 런에 걸쳐 분할된 경우: 첫 번째 런 뒤에 수정 텍스트 삽입
      const partialMatch = findPartialTextRun(result, original);
      if (partialMatch) {
        const fixedRun =
          `<w:r><w:rPr><w:u w:val="single"/><w:color w:val="0000FF"/></w:rPr>` +
          `<w:t xml:space="preserve"> [수정됨] ${escapeXml(fixed)}</w:t></w:r>`;
        result =
          result.slice(0, partialMatch.insertAt) +
          fixedRun +
          result.slice(partialMatch.insertAt);
      }
    }
  }

  return result;
}

function extractPlainText(xml: string): string {
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  if (!matches) return "";
  return matches.map((m) => m.replace(/<[^>]+>/g, "")).join("");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPartialTextRun(
  xml: string,
  original: string,
): { insertAt: number } | null {
  // 원본 텍스트의 첫 10자로 부분 매칭
  const prefix = original.slice(0, Math.min(10, original.length));
  const escaped = escapeXml(prefix);
  const idx = xml.indexOf(escaped);
  if (idx === -1) return null;

  // 이 위치 이후 가장 가까운 </w:r> 찾기
  const runEnd = xml.indexOf("</w:r>", idx);
  if (runEnd === -1) return null;

  return { insertAt: runEnd + 6 };
}

// 원본 docx 파일을 수정
async function modifyOriginalDocx(
  originalBuffer: Buffer,
  fixedClauses: FixedClause[],
): Promise<Buffer> {
  const zip = new AdmZip(originalBuffer);
  const docEntry = zip.getEntry("word/document.xml");

  if (!docEntry) {
    throw new Error("word/document.xml을 찾을 수 없습니다.");
  }

  let xml = docEntry.getData().toString("utf-8");
  xml = patchDocumentXml(xml, fixedClauses);

  zip.updateFile("word/document.xml", Buffer.from(xml, "utf-8"));

  return zip.toBuffer();
}

// 새 docx 생성 (원본 없을 때)
async function generateNewDocx(
  fixedClauses: FixedClause[],
  changes: string[],
): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: "수정된 계약서",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    }),
  );

  if (changes?.length) {
    children.push(
      new Paragraph({
        text: "[ 변경 사항 ]",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );
    for (const change of changes) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${change}`, color: "666666" })],
          spacing: { after: 60 },
        }),
      );
    }
    children.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        spacing: { before: 200, after: 200 },
      }),
    );
  }

  for (const clause of fixedClauses) {
    if (clause.modified) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: clause.original,
              strike: true,
              color: "FF0000",
              size: 20,
            }),
          ],
          spacing: { before: 120, after: 40 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "[수정됨] ",
              bold: true,
              color: "0000FF",
              size: 20,
            }),
            new TextRun({
              text: clause.fixed,
              color: "0000FF",
              size: 22,
            }),
          ],
          shading: { fill: "EBF0FF" },
          spacing: { before: 40, after: 120 },
        }),
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: clause.fixed, size: 22 })],
          spacing: { before: 120, after: 120 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
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

    let buffer: Buffer;

    if (originalFile && originalFile.name.endsWith(".docx")) {
      // 원본 docx 수정
      const origBuffer = Buffer.from(await originalFile.arrayBuffer());
      buffer = await modifyOriginalDocx(origBuffer, fixedClauses);
    } else {
      // 새 docx 생성
      buffer = await generateNewDocx(fixedClauses, changes);
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="modified_contract.docx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("DOCX 생성 오류:", msg);
    return Response.json(
      { error: `DOCX 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
