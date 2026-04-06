import * as XLSX from "xlsx";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { actionItems, title, date } = await request.json();
    const wb = XLSX.utils.book_new();
    const rows = (actionItems || []).map(
      (a: { task: string; assignee: string; dueDate: string; priority: string; done?: boolean }, i: number) => ({
        번호: i + 1,
        업무: a.task,
        담당자: a.assignee,
        기한: a.dueDate,
        우선순위: a.priority === "high" ? "높음" : a.priority === "medium" ? "중간" : "낮음",
        완료: a.done ? "O" : "",
      }),
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(wb, ws, `${(title || "회의").slice(0, 28)}`);

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="action_items_${date || "meeting"}.xlsx"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: msg }, { status: 500 });
  }
}
