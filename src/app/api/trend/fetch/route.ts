export const maxDuration = 30;

export async function GET() {
  try {
    const res = await fetch(
      "https://trends.google.com/trending/rss?geo=KR",
      { next: { revalidate: 1800 } },
    );
    const xml = await res.text();

    // XML에서 <item> 추출
    const items: { title: string; traffic: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const block = match[1];
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        || block.match(/<title>(.*?)<\/title>/)?.[1]
        || "";
      const traffic = block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] || "";
      if (title) items.push({ title: title.trim(), traffic });
    }

    return Response.json({
      keywords: items,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `트렌드 수집 실패: ${msg}` }, { status: 500 });
  }
}
