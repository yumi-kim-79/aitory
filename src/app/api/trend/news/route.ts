export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    const { keyword } = (await request.json()) as { keyword: string };
    if (!keyword?.trim()) {
      return Response.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    // Google News RSS (무료, 빠름, AI 불필요)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const afterDate = sevenDaysAgo.toISOString().split("T")[0];
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}+after:${afterDate}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      return Response.json({ error: "뉴스 검색 실패" }, { status: 502 });
    }

    const xml = await res.text();
    const articles: { title: string; source: string; summary: string; url: string; publishedAt: string }[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && articles.length < 7) {
      const block = match[1];

      const title = (
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        block.match(/<title>(.*?)<\/title>/)?.[1] ||
        ""
      ).trim();

      const url = (
        block.match(/<link>(.*?)<\/link>/)?.[1] ||
        ""
      ).trim();

      const source = (
        block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ||
        block.match(/<source[^>]*url="[^"]*">(.*?)<\/source>/)?.[1] ||
        ""
      ).trim();

      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      let publishedAt = "";
      if (pubDate) {
        try {
          const parsed = new Date(pubDate);
          if (isNaN(parsed.getTime())) continue; // 날짜 파싱 실패 → 제외
          const currentYear = new Date().getFullYear();
          if (parsed.getFullYear() < currentYear - 1) continue; // 작년 이전 → 제외
          publishedAt = parsed.toISOString().slice(0, 10);
        } catch { continue; } // 파싱 에러 → 제외
      }

      // 7일 이내 필터링
      if (publishedAt) {
        const diff = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
        if (diff > 7) continue;
      } else {
        continue; // 날짜 없으면 제외
      }

      if (title) {
        articles.push({
          title,
          source,
          summary: "", // RSS에는 요약이 없으므로 빈값
          url,
          publishedAt,
        });
      }
    }

    // 최신순 정렬
    articles.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));

    return Response.json({ articles });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return Response.json({ error: `뉴스 검색 실패: ${msg}` }, { status: 500 });
  }
}
