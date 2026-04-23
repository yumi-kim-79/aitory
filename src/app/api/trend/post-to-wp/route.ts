import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { postToTwitter } from "@/lib/twitter";

export const maxDuration = 60;

// ── WP 이미지 업로드 (DALL-E 제거로 비활성화 — 2026-04-23) ──
/*
async function uploadImageToWP(imageUrl: string, wpUrl: string, auth: string, alt: string): Promise<{ id: number; url: string } | null> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) return null;
    const imgBuffer = await imgRes.arrayBuffer();
    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="post-${Date.now()}.png"`,
      },
      body: Buffer.from(imgBuffer),
      signal: AbortSignal.timeout(20000),
    });
    if (!wpRes.ok) { console.error("[wp-img] 업로드 실패:", wpRes.status); return null; }
    const media = await wpRes.json();
    if (media.id && alt) {
      await fetch(`${wpUrl}/wp-json/wp/v2/media/${media.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({ alt_text: alt }),
      }).catch(() => {});
    }
    console.log("[wp-img] 업로드 성공:", media.id);
    return { id: media.id, url: media.source_url };
  } catch (e) {
    console.error("[wp-img] 에러:", e);
    return null;
  }
}
*/

// ── WP 태그/카테고리 헬퍼 ──

async function getOrCreateTag(
  name: string, wpUrl: string, auth: string,
): Promise<number | null> {
  try {
    const searchRes = await fetch(
      `${wpUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(8000) },
    );
    if (searchRes.ok) {
      const tags = await searchRes.json();
      const exact = tags.find((t: { name: string }) => t.name.toLowerCase() === name.toLowerCase());
      if (exact) return exact.id;
    }

    const createRes = await fetch(`${wpUrl}/wp-json/wp/v2/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(8000),
    });
    if (createRes.ok) {
      const tag = await createRes.json();
      return tag.id;
    }
  } catch {}
  return null;
}

async function getOrCreateCategory(
  name: string, wpUrl: string, auth: string,
): Promise<number | null> {
  try {
    const searchRes = await fetch(
      `${wpUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(8000) },
    );
    if (searchRes.ok) {
      const cats = await searchRes.json();
      const exact = cats.find((c: { name: string }) => c.name.toLowerCase() === name.toLowerCase());
      if (exact) return exact.id;
    }

    const createRes = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(8000),
    });
    if (createRes.ok) {
      const cat = await createRes.json();
      return cat.id;
    }
  } catch {}
  return null;
}

// ── 메인 ──

export async function POST(request: Request) {
  try {
    const decoded = await verifyToken(request);
    if (!decoded) return Response.json({ error: "인증 필요" }, { status: 401 });

    const userDoc = await getUserDoc(decoded.userId);
    if (userDoc?.role !== "admin") {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = (await request.json()) as {
      title: string;
      content: string;
      excerpt?: string;
      slug?: string;
      status: "draft" | "publish";
      tags?: string[];
      category?: string;
      imageUrl?: string;
      imageAlt?: string;
      keyword?: string;
      metaDescription?: string;
      focusKeyphrase?: string;
      urlSlug?: string;
      ogDescription?: string;
    };
    const { title, content, status, tags, category, imageUrl, imageAlt, keyword } = body;
    const metaDescription = body.metaDescription || body.excerpt || "";
    const excerpt = body.excerpt || body.metaDescription || "";
    const slug = body.urlSlug || body.slug;
    const focusKeyphrase = body.focusKeyphrase || "";
    const ogDescription = body.ogDescription || metaDescription;

    const wpUrl = process.env.WP_SITE_URL;
    const wpUser = process.env.WP_USERNAME;
    const wpPass = process.env.WP_APP_PASSWORD;

    if (!wpUrl || !wpUser || !wpPass) {
      return Response.json({ error: "WordPress 연동 설정 부족" }, { status: 500 });
    }

    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

    // 마크다운 잔여물 → HTML 변환
    let htmlContent = content
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      .replace(/<\/ul>\s*<ul>/g, "");

    if (!htmlContent.includes("<p>") && !htmlContent.includes("<h2>")) {
      htmlContent = htmlContent.split("\n\n").map((p) => `<p>${p.trim()}</p>`).join("\n");
    }

    // 태그 ID 수집
    const tagIds: number[] = [];
    if (tags?.length) {
      console.log("[wp] 태그 처리:", tags.length, "개");
      for (const tagName of tags.slice(0, 10)) {
        const id = await getOrCreateTag(tagName, wpUrl, auth);
        if (id) tagIds.push(id);
      }
      console.log("[wp] 태그 ID:", tagIds);
    }

    // 카테고리 ID
    const categoryIds: number[] = [];
    if (category) {
      const catId = await getOrCreateCategory(category, wpUrl, auth);
      if (catId) categoryIds.push(catId);
      console.log("[wp] 카테고리:", category, "→ ID:", catId);
    }

    const safeExcerpt = excerpt && excerpt.length > 150
      ? excerpt.slice(0, 147) + "..."
      : excerpt || "";
    const safeMetaDesc = metaDescription && metaDescription.length > 150
      ? metaDescription.slice(0, 147) + "..."
      : metaDescription || safeExcerpt;
    const safeOgDesc = ogDescription && ogDescription.length > 160
      ? ogDescription.slice(0, 157) + "..."
      : ogDescription || safeMetaDesc;

    // 이미지 업로드 + featured_media (DALL-E 제거로 비활성화 — 2026-04-23)
    // 이미지는 WP 관리자에서 수동 업로드하도록 변경.
    const featuredMediaId: number | undefined = undefined;
    /*
    if (imageUrl) {
      const media = await uploadImageToWP(imageUrl, wpUrl, auth, imageAlt || title);
      if (media) {
        featuredMediaId = media.id;
        htmlContent = htmlContent.replace(
          /<!-- 이미지:[^>]*-->/,
          `<!-- wp:image {"id":${media.id},"sizeSlug":"large"} -->\n<figure class="wp-block-image size-large"><img src="${media.url}" alt="${imageAlt || title}"/></figure>\n<!-- /wp:image -->`,
        );
      }
    }
    */
    void imageUrl; void imageAlt;

    console.log("[wp] 포스팅:", { title: title?.slice(0, 30), slug, status, tags: tagIds.length, cats: categoryIds.length, featuredMediaId });

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title,
        content: htmlContent,
        status: status || "draft",
        excerpt: safeExcerpt,
        meta: {
          _surerank_description: safeMetaDesc,
          _yoast_wpseo_title: title,
          _yoast_wpseo_metadesc: safeMetaDesc,
          _yoast_wpseo_focuskw: focusKeyphrase,
          _yoast_wpseo_opengraph_title: title,
          _yoast_wpseo_opengraph_description: safeOgDesc,
          rank_math_title: title,
          rank_math_description: safeMetaDesc,
          rank_math_focus_keyword: focusKeyphrase,
          rank_math_facebook_title: title,
          rank_math_facebook_description: safeOgDesc,
        },
        ...(slug ? { slug } : {}),
        ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
        ...(tagIds.length ? { tags: tagIds } : {}),
        ...(categoryIds.length ? { categories: categoryIds } : {}),
      }),
      signal: AbortSignal.timeout(25000),
    });

    const responseText = await wpRes.text();
    console.log("[wp] 응답:", wpRes.status, responseText.slice(0, 300));

    if (!wpRes.ok) {
      return Response.json({
        error: `WordPress 포스팅 실패 (${wpRes.status}): ${responseText.slice(0, 200)}`,
      }, { status: 502 });
    }

    let wpData;
    try { wpData = JSON.parse(responseText); }
    catch { return Response.json({ error: "WordPress 응답 파싱 실패" }, { status: 502 }); }

    // Firestore aitory_published_keywords에 발행 정보 저장 (draft/publish 모두)
    if (wpData.id) {
      try {
        const docId = `kbuzz_${wpData.id}`;
        await adminDb.collection("aitory_published_keywords").doc(docId).set({
          keyword: keyword || "",
          category: category || "",
          metaDesc: safeMetaDesc,
          focusKeyphrase,
          kbuzzUrl: wpData.link,
          kbuzzTitle: wpData.title?.rendered || title,
          kbuzzPostId: wpData.id,
          kbuzzPublishedAt: new Date(),
          kbuzzStatus: wpData.status === "publish" ? "published" : wpData.status,
          publishedAt: new Date(),
          source: "manual",
        }, { merge: true });
        console.log(`[wp] Firestore 저장 성공: ${docId}`);
      } catch (fsErr) {
        console.error("[wp] Firestore 저장 실패:", fsErr instanceof Error ? fsErr.message : fsErr);
      }
    }

    // X(트위터) 자동 포스팅 (실패해도 블로그 발행 유지)
    let tweetUrl: string | null = null;
    let tweetError: string | null = null;
    console.log("[wp] 트위터 포스팅 조건:", { wpStatus: wpData.status, hasLink: !!wpData.link, wpId: wpData.id });
    if (wpData.link && wpData.id) {
      const docId = `kbuzz_${wpData.id}`;
      // 중복 포스팅 방지: 이미 tweetUrl 있으면 스킵
      let skipTweet = false;
      try {
        const existDoc = await adminDb.collection("aitory_published_keywords").doc(docId).get();
        const existTweet = existDoc.data()?.tweetUrl;
        if (existTweet && typeof existTweet === "string" && existTweet.startsWith("http")) {
          console.log("[Twitter] 이미 포스팅됨, 스킵:", existTweet);
          tweetUrl = existTweet;
          skipTweet = true;
        }
      } catch {}
      if (!skipTweet) try {
        console.log("[Twitter] 포스팅 시도 시작:", title);
        const result = await Promise.race([
          postToTwitter({
            title: wpData.title?.rendered || title,
            kbuzzUrl: wpData.link,
            keyword: keyword || "",
            category: category || "",
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Twitter timeout 15초')), 15000)),
        ]);
        tweetUrl = result.tweetUrl;
        // Firestore tweetUrl 업데이트
        await adminDb.collection("aitory_published_keywords").doc(docId).set({
          tweetUrl, tweetError: null, tweetedAt: new Date(),
        }, { merge: true });
        console.log("[Twitter] 포스팅 완료:", tweetUrl);
      } catch (err) {
        tweetError = err instanceof Error ? err.message : String(err);
        console.error("[Twitter] 포스팅 실패:", tweetError);
        await adminDb.collection("aitory_published_keywords").doc(docId).set({
          tweetUrl: null, tweetError,
        }, { merge: true }).catch(() => {});
      }
    }

    return Response.json({
      ok: true,
      postId: wpData.id,
      postUrl: wpData.link,
      status: wpData.status,
      tweetUrl,
      tweetError,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[wp] 에러:", msg);
    return Response.json({ error: `포스팅 에러: ${msg}` }, { status: 500 });
  }
}
