export const maxDuration = 30;

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export async function POST(request: Request) {
  try {
    const { title, content, excerpt, tags } = await request.json();

    const children: Paragraph[] = [];
    children.push(new Paragraph({ text: title || "블로그 글", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
    if (excerpt) children.push(new Paragraph({ children: [new TextRun({ text: excerpt, color: "666666", italics: true, size: 20 })], spacing: { after: 200 } }));

    for (const line of (content || "").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith("## ")) {
        children.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
      } else if (/^\[대표이미지:|^\[본문이미지:/.test(t)) {
        children.push(new Paragraph({ children: [new TextRun({ text: `📸 ${t}`, color: "B45309", size: 18 })], shading: { fill: "FFF7ED" }, spacing: { before: 100, after: 100 } }));
      } else if (t.startsWith("- ")) {
        children.push(new Paragraph({ children: [new TextRun({ text: t.slice(2), size: 22 })], spacing: { after: 40 }, bullet: { level: 0 } }));
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: t, size: 22 })], spacing: { after: 80 } }));
      }
    }

    if (tags?.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: `태그: ${tags.join(", ")}`, color: "6B7280", size: 18 })], spacing: { before: 200 } }));
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="blog-post.docx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
