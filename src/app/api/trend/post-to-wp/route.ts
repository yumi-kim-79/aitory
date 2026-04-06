import { verifyToken } from "@/lib/middleware";
import { getUserDoc } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const maxDuration = 60;

// ── 이미지 검색 ──

async function getImageSearchQuery(keyword: string): Promise<string> {
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      temperature: 0,
      messages: [{ role: "user", content: `"${keyword}" 키워드와 관련된 영어 이미지 검색어를 1개만 출력해주세요. 한 단어~세 단어. 예시만 출력, 설명 없이.` }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : keyword;
    return text.replace(/['"]/g, "").slice(0, 50);
  } catch {
    return keyword;
  }
}

async function searchPexels(query: string): Promise<{ url: string; photographerUrl: string; photographer: string } | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;
    return { url: photo.src.large, photographerUrl: photo.photographer_url, photographer: photo.photographer };
  } catch { return null; }
}

async function searchUnsplash(query: string): Promise<{ url: string; photographerUrl: string; photographer: string } | null> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;
    return { url: photo.urls.regular, photographerUrl: photo.user.links.html, photographer: photo.user.name };
  } catch { return null; }
}

async function fetchImage(keyword: string) {
  const query = await getImageSearchQuery(keyword);
  console.log("[wp-img] 검색어:", query);

  // Unsplash 우선, Pexels fallback
  let img = await searchUnsplash(query);
  if (!img) img = await searchPexels(query);
  if (!img) img = await searchPexels(keyword); // 원본 키워드로 재시도
  return img;
}

// ── WordPress 미디어 업로드 ──

async function uploadMediaToWP(
  imageUrl: string,
  wpUrl: string,
  auth: string,
): Promise<number | null> {
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return null;
    const imgBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="featured-${Date.now()}.${ext}"`,
      },
      body: Buffer.from(imgBuffer),
      signal: AbortSignal.timeout(20000),
    });

    if (!wpRes.ok) {
      console.error("[wp-img] 미디어 업로드 실패:", wpRes.status);
      return null;
    }

    const media = await wpRes.json();
    console.log("[wp-img] 미디어 업로드 성공:", media.id, media.source_url);
    return media.id;
  } catch (e) {
    console.error("[wp-img] 미디어 업로드 에러:", e);
    return null;
  }
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

    const { title, content, excerpt, status, keyword } = (await request.json()) as {
      title: string;
      content: string;
      excerpt: string;
      status: "draft" | "publish";
      keyword?: string;
    };

    const wpUrl = process.env.WP_SITE_URL;
    const wpUser = process.env.WP_USERNAME;
    const wpPass = process.env.WP_APP_PASSWORD;

    if (!wpUrl || !wpUser || !wpPass) {
      return Response.json({ error: "WordPress 연동 설정 부족" }, { status: 500 });
    }

    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

    // 이미지 검색 + WP 업로드
    let featuredMediaId: number | null = null;
    let imageHtml = "";

    if (keyword) {
      const img = await fetchImage(keyword);
      if (img) {
        console.log("[wp-img] 이미지 발견:", img.url.slice(0, 60));
        featuredMediaId = await uploadMediaToWP(img.url, wpUrl, auth);

        // 본문 상단에 이미지 + 크레딧 삽입
        imageHtml = `<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="${img.url}" alt="${keyword}"/><figcaption>Photo by <a href="${img.photographerUrl}" target="_blank">${img.photographer}</a></figcaption></figure>
<!-- /wp:image -->\n\n`;
      }
    }

    // 본문에 이미지 삽입
    const finalContent = imageHtml + content;

    console.log("[wp] 포스팅:", { title: title?.slice(0, 30), featuredMediaId, hasImage: !!imageHtml });

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title,
        content: finalContent,
        status: status || "draft",
        excerpt: excerpt || "",
        ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
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

    return Response.json({
      ok: true,
      postId: wpData.id,
      postUrl: wpData.link,
      status: wpData.status,
      hasImage: !!featuredMediaId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[wp] 에러:", msg);
    return Response.json({ error: `포스팅 에러: ${msg}` }, { status: 500 });
  }
}
