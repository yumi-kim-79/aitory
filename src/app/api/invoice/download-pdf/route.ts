import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import { join } from "path";

let cachedFont: Uint8Array | null = null;
async function getFontBytes(): Promise<Uint8Array> {
  if (cachedFont) return cachedFont;
  cachedFont = new Uint8Array(
    await readFile(join(process.cwd(), "fonts", "NotoSansKR-Regular.ttf")),
  );
  return cachedFont;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const fontBytes = await getFontBytes();

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const m = 50;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const blue = rgb(0.1, 0.3, 0.8);
    let y = height - m;

    const draw = (text: string, x: number, yy: number, size: number, color = black) => {
      page.drawText(text, { x, y: yy, font, size, color });
    };

    // 제목
    const title = data.docType || "견적서";
    const tw = font.widthOfTextAtSize(title, 24);
    draw(title, (width - tw) / 2, y, 24);
    y -= 40;

    // 날짜
    draw(`작성일: ${new Date().toISOString().slice(0, 10)}`, width - m - 150, y, 9, gray);
    if (data.validUntil) draw(`유효기간: ${data.validUntil}`, width - m - 150, y - 14, 9, gray);
    y -= 10;

    // 발신/수신
    draw("발신", m, y, 11, blue);
    draw("수신", width / 2 + 10, y, 11, blue);
    y -= 18;
    const s = data.sender || {};
    const c = data.client || {};
    const sLines = [s.companyName, s.bizNumber ? `사업자: ${s.bizNumber}` : "", s.phone, s.email, s.address].filter(Boolean);
    const cLines = [c.clientName, c.contactPerson ? `담당: ${c.contactPerson}` : "", c.phone, c.email, c.address].filter(Boolean);
    const maxLines = Math.max(sLines.length, cLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (sLines[i]) draw(sLines[i], m, y, 9);
      if (cLines[i]) draw(cLines[i], width / 2 + 10, y, 9);
      y -= 14;
    }
    y -= 10;

    // 인사말
    if (data.greeting) {
      draw(data.greeting.slice(0, 80), m, y, 9, gray);
      if (data.greeting.length > 80) { y -= 14; draw(data.greeting.slice(80, 160), m, y, 9, gray); }
      y -= 20;
    }

    // 테이블 헤더
    const cols = [m, m + 220, m + 290, m + 370, m + 440];
    const headers = ["품목", "수량", "단가", "금액"];
    page.drawRectangle({ x: m, y: y - 4, width: width - m * 2, height: 20, color: rgb(0.95, 0.95, 0.95) });
    headers.forEach((h, i) => draw(h, cols[i], y, 9));
    y -= 22;

    // 항목
    const items = data.items || [];
    for (const item of items) {
      draw(String(item.name || "").slice(0, 30), cols[0], y, 9);
      draw(String(item.quantity || 0), cols[1], y, 9);
      draw(`${Number(item.unitPrice || 0).toLocaleString()}`, cols[2], y, 9);
      draw(`${Number(item.amount || 0).toLocaleString()}`, cols[3], y, 9);
      y -= 16;
    }

    // 합계
    y -= 6;
    page.drawLine({ start: { x: m, y: y + 10 }, end: { x: width - m, y: y + 10 }, thickness: 0.5, color: gray });
    draw(`소계: ${Number(data.subtotal || 0).toLocaleString()}원`, cols[3] - 40, y, 9);
    y -= 16;
    draw(`부가세: ${Number(data.tax || 0).toLocaleString()}원`, cols[3] - 40, y, 9);
    y -= 16;
    draw(`합계: ${Number(data.total || 0).toLocaleString()}원`, cols[3] - 40, y, 12);
    y -= 30;

    // 결제 안내 & 마무리
    if (data.paymentGuide) { draw(data.paymentGuide.slice(0, 90), m, y, 9, gray); y -= 20; }
    if (data.closing) { draw(data.closing.slice(0, 90), m, y, 9, gray); y -= 20; }

    // 서명
    y -= 10;
    draw(s.companyName || "", width - m - 150, y, 10);
    y -= 14;
    draw("(인)", width - m - 30, y, 10, blue);

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice.pdf"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
