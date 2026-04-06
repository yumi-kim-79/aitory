export const maxDuration = 60;

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from "docx";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const s = data.sender || {};
    const c = data.client || {};
    const items = data.items || [];

    const children: Paragraph[] = [];

    // 제목
    children.push(
      new Paragraph({
        text: data.docType || "견적서",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),
    );

    // 날짜
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `작성일: ${new Date().toISOString().slice(0, 10)}`,
            color: "666666",
            size: 18,
          }),
          data.validUntil
            ? new TextRun({
                text: `    유효기간: ${data.validUntil}`,
                color: "666666",
                size: 18,
              })
            : new TextRun(""),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
      }),
    );

    // 발신/수신
    const infoLines = [
      `[발신] ${s.companyName || ""}${s.bizNumber ? ` (${s.bizNumber})` : ""}`,
      `${s.phone || ""} / ${s.email || ""}`,
      "",
      `[수신] ${c.clientName || ""}${c.contactPerson ? ` ${c.contactPerson}` : ""}`,
      `${c.phone || ""} / ${c.email || ""}`,
    ];
    for (const line of infoLines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 20 })],
          spacing: { after: 40 },
        }),
      );
    }

    // 인사말
    if (data.greeting) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: data.greeting, color: "444444", size: 20 })],
          spacing: { before: 200, after: 200 },
        }),
      );
    }

    // 테이블
    const headerRow = new TableRow({
      children: ["품목", "수량", "단가", "금액"].map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: 20 })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: "F0F0F0" },
          }),
      ),
    });

    const dataRows = items.map(
      (item: { name: string; quantity: number; unitPrice: number; amount: number }) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.name, size: 20 })] })],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(item.quantity), size: 20 })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${Number(item.unitPrice).toLocaleString()}원`, size: 20 }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${Number(item.amount).toLocaleString()}원`, size: 20 }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        }),
    );

    children.push(
      new Paragraph(""),
    );

    const table = new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    // 합계
    const totalLines = [
      `소계: ${Number(data.subtotal || 0).toLocaleString()}원`,
      `부가세: ${Number(data.tax || 0).toLocaleString()}원`,
      `합계: ${Number(data.total || 0).toLocaleString()}원`,
    ];

    const afterTableParas: Paragraph[] = [];
    for (const line of totalLines) {
      afterTableParas.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              bold: line.startsWith("합계"),
              size: line.startsWith("합계") ? 24 : 20,
            }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 40 },
        }),
      );
    }

    // 결제 안내 & 마무리
    if (data.paymentGuide) {
      afterTableParas.push(
        new Paragraph({
          children: [new TextRun({ text: data.paymentGuide, color: "444444", size: 20 })],
          spacing: { before: 200, after: 100 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
        }),
      );
    }
    if (data.closing) {
      afterTableParas.push(
        new Paragraph({
          children: [new TextRun({ text: data.closing, color: "444444", size: 20 })],
          spacing: { after: 200 },
        }),
      );
    }

    // 서명
    afterTableParas.push(
      new Paragraph({
        children: [
          new TextRun({ text: s.companyName || "", size: 22 }),
          new TextRun({ text: "  (인)", color: "1A4FCC", size: 22 }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 300 },
      }),
    );

    const doc = new Document({
      sections: [
        {
          children: [...children],
        },
        {
          children: [
            new Paragraph(""), // table needs its own section for some docx libs
          ],
        },
      ],
    });

    // Rebuild with table embedded
    const docFinal = new Document({
      sections: [
        {
          children: [...children, table, ...afterTableParas],
        },
      ],
    });

    const buffer = await Packer.toBuffer(docFinal);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="invoice.docx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
