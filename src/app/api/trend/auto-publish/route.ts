export const maxDuration = 300;

import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic();

const BLOCKED = /정치|선거|탄핵|대통령|정당|국회|여당|야당|민주당|국민의힘/;

function extractJSON(text: string): string {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) return f[1].trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  return text.trim();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: Request) {
  // Cron 인증
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { keyword: string; ok: boolean; postUrl?: string; error?: string }[] = [];
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://aitory.vercel.app";
  const wpUrl = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;

  if (!wpUrl || !wpUser || !wpPass) {
    return Response.json({ error: "WP 설정 부족" }, { status: 500 });
  }

  try {
    // 1. 트렌드 키워드 수집
    console.log("[auto] 트렌드 수집 시작");
    const trendRes = await fetch(`${baseUrl}/api/trend/fetch`);
    const trendData = await trendRes.json();
    const keywords: string[] = (trendData.keywords || [])
      .slice(0, 5)
      .map((k: { title: string }) => k.title)
      .filter((k: string) => !BLOCKED.test(k));

    console.log("[auto] 키워드:", keywords.slice(0, 3));

    // TOP 3만 처리
    for (const keyword of keywords.slice(0, 3)) {
      try {
        console.log(`[auto] === ${keyword} 시작 ===`);

        // 2. 뉴스 수집 (Google RSS, 무료)
        const newsRes = await fetch(`${baseUrl}/api/trend/news`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword }),
        });
        const newsData = await newsRes.json();
        const articles = newsData.articles || [];
        console.log(`[auto] 뉴스 ${articles.length}개`);

        // 3. 블로그 글 생성 (Claude)
        const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
        const newsTitles = articles.slice(0, 5).map((a: { title: string }, i: number) => `${i + 1}. ${a.title}`).join("\n");

        const blogMsg = await claude.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          messages: [{
            role: "user",
            content: `키워드: ${keyword}\n오늘: ${today}\n${newsTitles ? `뉴스:\n${newsTitles}\n` : ""}SEO 블로그 글 작성. JSON만 반환:\n{"title":"SEO제목40~60자","slug":"영문-슬러그","content":"HTML본문1500자+","excerpt":"메타설명150자이내","category":"IT/AI|K뷰티|K팝/한류|경제|글로벌|사회|인사이트","tags":["태그x7"]}\ncontent: <h2>4개+,각300자+,<p><strong><ul><li>,내부링크1,이미지위치2,전망/결론\n오늘 기준 최신 정보. 과거 연도 현재 시제 금지.`,
          }],
        });

        const blogText = blogMsg.content[0].type === "text" ? blogMsg.content[0].text : "";
        let blogPost;
        try { blogPost = JSON.parse(extractJSON(blogText)); }
        catch { results.push({ keyword, ok: false, error: "블로그 JSON 파싱 실패" }); continue; }

        if (blogPost.excerpt && blogPost.excerpt.length > 150) {
          blogPost.excerpt = blogPost.excerpt.slice(0, 147) + "...";
        }

        // Kbuzz 안내 문구 추가
        blogPost.content += '\n<p style="color:#888;font-size:0.85em;border-top:1px solid #eee;margin-top:30px;padding-top:15px;text-align:center;">※ 본문의 이미지는 기사의 내용을 바탕으로 AI로 재구성하였습니다.</p>';

        console.log(`[auto] 블로그 생성 완료: ${blogPost.title?.slice(0, 30)}`);

        // 4. DALL-E 3 이미지 생성
        let imageUrl: string | undefined;
        try {
          const imgRes = await fetch(`${baseUrl}/api/trend/generate-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword }),
          });
          const imgData = await imgRes.json();
          if (imgData.imageUrl) imageUrl = imgData.imageUrl;
          console.log(`[auto] 이미지 생성: ${imageUrl ? "성공" : "실패"}`);
        } catch {
          console.log("[auto] 이미지 생성 스킵");
        }

        // 5. WordPress 발행 (인증 우회 — 직접 WP API 호출)
        const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

        // 이미지 WP 업로드
        let featuredMediaId: number | undefined;
        if (imageUrl) {
          try {
            const dlRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
            if (dlRes.ok) {
              const imgBuf = await dlRes.arrayBuffer();
              const wpMediaRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
                method: "POST",
                headers: { Authorization: `Basic ${auth}`, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="auto-${Date.now()}.png"` },
                body: Buffer.from(imgBuf),
                signal: AbortSignal.timeout(20000),
              });
              if (wpMediaRes.ok) {
                const media = await wpMediaRes.json();
                featuredMediaId = media.id;
                // 본문 이미지 교체
                blogPost.content = blogPost.content.replace(
                  /<!-- 이미지:[^>]*-->/,
                  `<!-- wp:image {"id":${media.id}} --><figure class="wp-block-image"><img src="${media.source_url}" alt="${keyword}"/></figure><!-- /wp:image -->`,
                );
              }
            }
          } catch {}
        }

        // 태그/카테고리 ID
        const tagIds: number[] = [];
        if (blogPost.tags?.length) {
          for (const t of blogPost.tags.slice(0, 7)) {
            try {
              const sRes = await fetch(`${wpUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(t)}`, { headers: { Authorization: `Basic ${auth}` } });
              if (sRes.ok) { const tags = await sRes.json(); const exact = tags.find((x: { name: string }) => x.name.toLowerCase() === t.toLowerCase()); if (exact) { tagIds.push(exact.id); continue; } }
              const cRes = await fetch(`${wpUrl}/wp-json/wp/v2/tags`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` }, body: JSON.stringify({ name: t }) });
              if (cRes.ok) { const tag = await cRes.json(); tagIds.push(tag.id); }
            } catch {}
          }
        }

        let catId: number | undefined;
        if (blogPost.category) {
          try {
            const sRes = await fetch(`${wpUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(blogPost.category)}`, { headers: { Authorization: `Basic ${auth}` } });
            if (sRes.ok) { const cats = await sRes.json(); const exact = cats.find((c: { name: string }) => c.name.toLowerCase() === blogPost.category.toLowerCase()); if (exact) catId = exact.id; }
            if (!catId) { const cRes = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` }, body: JSON.stringify({ name: blogPost.category }) }); if (cRes.ok) { const cat = await cRes.json(); catId = cat.id; } }
          } catch {}
        }

        // 마크다운 → HTML
        let html = blogPost.content
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/^- (.+)$/gm, "<li>$1</li>");

        const wpPostRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
          body: JSON.stringify({
            title: blogPost.title, content: html, status: "publish",
            excerpt: blogPost.excerpt || "", ...(blogPost.slug ? { slug: blogPost.slug } : {}),
            ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
            ...(tagIds.length ? { tags: tagIds } : {}), ...(catId ? { categories: [catId] } : {}),
            meta: { _surerank_description: blogPost.excerpt || "" },
          }),
          signal: AbortSignal.timeout(25000),
        });

        if (wpPostRes.ok) {
          const wpData = await wpPostRes.json();
          results.push({ keyword, ok: true, postUrl: wpData.link });
          console.log(`[auto] ✅ 발행 완료: ${wpData.link}`);
        } else {
          const err = await wpPostRes.text();
          results.push({ keyword, ok: false, error: `WP ${wpPostRes.status}: ${err.slice(0, 100)}` });
        }

        await sleep(5000);
      } catch (e) {
        results.push({ keyword, ok: false, error: e instanceof Error ? e.message : "에러" });
      }
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "알 수 없는 오류" }, { status: 500 });
  }

  console.log("[auto] 완료:", JSON.stringify(results));
  return Response.json({ results, publishedAt: new Date().toISOString() });
}
