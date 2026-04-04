import * as XLSX from "xlsx";

interface PlatformData {
  platform: string;
  product_name: string;
  intro: string;
  description: string;
  tags: string[];
  bullets: string[];
}

export async function POST(request: Request) {
  try {
    const { platforms } = (await request.json()) as {
      platforms: PlatformData[];
    };

    if (!platforms?.length) {
      return Response.json(
        { error: "결과 데이터가 필요합니다." },
        { status: 400 },
      );
    }

    const wb = XLSX.utils.book_new();

    for (const p of platforms) {
      const rows = [
        ["항목", "내용"],
        ["상품명", p.product_name],
        ["소개글", p.intro],
        ["상세설명", p.description],
        ["검색 태그", p.tags.join(", ")],
        ["특징", p.bullets.join("\n")],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 60 }];

      const sheetName = p.platform.slice(0, 31); // Excel 시트명 31자 제한
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="product_listing.xlsx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json(
      { error: `엑셀 생성 중 오류가 발생했습니다: ${msg}` },
      { status: 500 },
    );
  }
}
