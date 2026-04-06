import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
export const maxDuration = 60;

interface PlatformResult {
  platform: string;
  menus: { name: string; price: string; description: string }[];
}

export async function POST(request: Request) {
  try {
    const { storeName, platforms } = (await request.json()) as {
      storeName: string;
      platforms: PlatformResult[];
    };

    if (!platforms?.length) {
      return Response.json({ error: "메뉴 데이터가 필요합니다." }, { status: 400 });
    }

    const children: Paragraph[] = [];

    children.push(
      new Paragraph({
        text: storeName || "메뉴판",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    for (const p of platforms) {
      children.push(
        new Paragraph({
          text: `[${p.platform}]`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }),
      );

      for (const m of p.menus) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: m.name, bold: true, size: 24 }),
              new TextRun({ text: `  ${m.price}`, color: "666666", size: 22 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: m.description, color: "444444", size: 20 })],
            spacing: { after: 200 },
          }),
        );
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="menu.docx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
