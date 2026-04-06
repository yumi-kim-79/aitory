import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const children: Paragraph[] = [];

    children.push(new Paragraph({ text: data.title || "회의록", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `날짜: ${data.date || ""} | 참석자: ${(data.attendees || []).join(", ")} | 유형: ${data.meetingType || ""}`, color: "666666", size: 18 })], spacing: { after: 300 } }));

    if (data.summary) {
      children.push(new Paragraph({ text: "회의 요약", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: data.summary, size: 22 })], spacing: { after: 100 } }));
      for (const b of data.bulletPoints || []) {
        children.push(new Paragraph({ children: [new TextRun({ text: `• ${b}`, size: 20 })], spacing: { after: 40 } }));
      }
    }

    if (data.decisions?.length) {
      children.push(new Paragraph({ text: "주요 결정 사항", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      data.decisions.forEach((d: string, i: number) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${d}`, size: 22 })], spacing: { after: 60 } }));
      });
    }

    if (data.actionItems?.length) {
      children.push(new Paragraph({ text: "액션 아이템", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      for (const a of data.actionItems) {
        children.push(new Paragraph({ children: [new TextRun({ text: `☐ ${a.task}`, bold: true, size: 22 }), new TextRun({ text: `  담당: ${a.assignee} | 기한: ${a.dueDate} | 우선순위: ${a.priority}`, color: "666666", size: 18 })], spacing: { after: 80 } }));
      }
    }

    if (data.fullMinutes) {
      children.push(new Paragraph({ text: "전체 회의록", heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      for (const line of data.fullMinutes.split("\n")) {
        children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 40 } }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="meeting_minutes.docx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
