import * as XLSX from "xlsx";
export const maxDuration = 60;
import ExcelJS from "exceljs";

interface FixedClause {
  original: string;
  fixed: string;
  modified: boolean;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// 원본 xlsx에서 수정 대상 셀을 찾아서 교체
async function modifyOriginalXlsx(
  originalBuffer: Buffer,
  fixedClauses: FixedClause[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(originalBuffer) as never);

  const modified = fixedClauses.filter((c) => c.modified);

  for (const sheet of workbook.worksheets) {
    // 뒤에서부터 처리해야 행 삽입 시 인덱스가 밀리지 않음
    const insertions: { row: number; original: string; fixed: string }[] = [];

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const cellText = normalize(String(cell.value || ""));
        if (!cellText) return;

        for (const clause of modified) {
          const target = normalize(clause.original);
          if (cellText.includes(target) || target.includes(cellText.slice(0, 20))) {
            // 원본 셀: 빨간색 + 취소선
            cell.font = {
              ...cell.font,
              color: { argb: "FFFF0000" },
              strike: true,
            };

            insertions.push({
              row: rowNumber,
              original: clause.original,
              fixed: clause.fixed,
            });
          }
        }
      });
    });

    // 뒤에서부터 행 삽입 (인덱스 밀림 방지)
    insertions.sort((a, b) => b.row - a.row);
    for (const ins of insertions) {
      const newRowNum = ins.row + 1;
      sheet.insertRow(newRowNum, []);
      const newRow = sheet.getRow(newRowNum);
      const origRow = sheet.getRow(ins.row);

      // 원본 행의 첫 번째 셀과 같은 열에 수정 텍스트 삽입
      let targetCol = 1;
      origRow.eachCell((cell, colNumber) => {
        const val = normalize(String(cell.value || ""));
        if (val && normalize(ins.original).includes(val.slice(0, 10))) {
          targetCol = colNumber;
        }
      });

      const newCell = newRow.getCell(targetCol);
      newCell.value = `[수정됨] ${ins.fixed}`;
      newCell.font = {
        color: { argb: "FF0000FF" },
        underline: true,
      };
      newCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEBF0FF" },
      };
      newRow.commit();
    }
  }

  const resultBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(resultBuffer);
}

// 새 xlsx 생성 (원본 없을 때)
function generateNewXlsx(
  fixedClauses: FixedClause[],
  changes: string[],
): Buffer {
  const wb = XLSX.utils.book_new();

  const clauseRows = fixedClauses.map((c, i) => ({
    "조항 번호": i + 1,
    상태: c.modified ? "수정됨" : "원본 유지",
    "원문 조항": c.original,
    "수정된 조항": c.modified ? c.fixed : "",
  }));
  const ws1 = XLSX.utils.json_to_sheet(clauseRows);
  ws1["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 50 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws1, "수정된 계약서");

  if (changes?.length) {
    const changeRows = changes.map((c, i) => ({
      번호: i + 1,
      "변경 사항": c,
    }));
    const ws2 = XLSX.utils.json_to_sheet(changeRows);
    ws2["!cols"] = [{ wch: 8 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, "변경 사항");
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
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

    const ext = originalFile?.name.split(".").pop()?.toLowerCase();
    if (originalFile && (ext === "xlsx" || ext === "xls")) {
      const origBuffer = Buffer.from(await originalFile.arrayBuffer());
      buffer = await modifyOriginalXlsx(origBuffer, fixedClauses);
    } else {
      buffer = generateNewXlsx(fixedClauses, changes);
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="modified_contract.xlsx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("XLSX 생성 오류:", msg);
    return Response.json(
      { error: `XLSX 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
