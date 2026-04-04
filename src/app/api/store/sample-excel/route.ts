import * as XLSX from "xlsx";

export async function GET() {
  const wb = XLSX.utils.book_new();
  const data = [
    ["상품명", "카테고리", "특징/스펙", "가격", "타겟고객"],
    [
      "여성 니트 가디건",
      "의류",
      "울 혼방, 프리사이즈, 5색상, 국내제작",
      "29900",
      "20대여성",
    ],
    [
      "무선 블루투스 이어폰",
      "전자기기",
      "노이즈캔슬링, 30시간 재생, IPX5 방수",
      "39900",
      "전체",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "상품목록");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="aitory_product_sample.xlsx"',
    },
  });
}
