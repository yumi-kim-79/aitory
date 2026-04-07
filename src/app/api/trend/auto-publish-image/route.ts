import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ImageResult {
  keyword: string;
  postId: number;
  success: boolean;
  error?: string;
}

// ────────────────────────────────────────────
// WP 포스트 제목+본문 조회
// ────────────────────────────────────────────
async function fetchPostInfo(postId: number): Promise<{ title: string; contentPreview: string } | null> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpBase || !wpUser || !wpPass) return null;

  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  try {
    const res = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const post = await res.json();
    const title = (post.title?.rendered || '').replace(/<[^>]+>/g, '');
    const rawContent = (post.content?.raw || post.content?.rendered || '').replace(/<[^>]+>/g, '');
    return { title, contentPreview: rawContent.slice(0, 500) };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────
// DALL-E 3 이미지 생성 (본문 내용 기반)
// ────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, string> = {
  'K-연예/한류': 'K-pop concert stage, dramatic LED lighting, colorful backdrop, cinematic Korean entertainment aesthetic',
  'K-스포츠': 'Dynamic sports action scene, Korean flag elements, stadium atmosphere, dramatic lighting, motion blur',
  '경제/비즈니스': 'Modern financial district skyline, stock market data visualization, blue and gold corporate aesthetic',
  '사회/생활': 'Clean modern lifestyle photography, warm natural lighting, Korean urban environment',
  'IT/과학': 'Futuristic technology visualization, glowing circuit patterns, blue purple gradient, AI neural network',
};

async function generateImage(
  keyword: string,
  category: string,
  title: string,
  contentPreview: string,
): Promise<string | null> {
  try {
    const styleHint = CATEGORY_STYLES[category] || 'clean and modern professional blog thumbnail';

    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `다음 블로그 글의 내용을 완벽하게 표현하는 DALL-E 3 이미지 프롬프트를 영어로 작성해줘.

블로그 제목: ${title}
카테고리: ${category}
본문 요약: ${contentPreview}

요구사항:
- 블로그 핵심 주제를 시각적으로 표현
- 사람 얼굴 없음, 텍스트/글자 없음
- 16:9 비율 블로그 썸네일
- 4K 퀄리티, 선명한 포커스, 매거진 커버 수준
- 스타일 참고: ${styleHint}

영어 프롬프트만 반환, 다른 텍스트 없이.`,
      }],
    });
    const dallePrompt = promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : keyword;
    console.log(`[image] DALL-E 프롬프트: ${dallePrompt.slice(0, 150)}`);

    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1792x1024',
      quality: 'hd',
      style: 'natural',
      n: 1,
    });
    return imgRes.data?.[0]?.url ?? null;
  } catch (e) {
    console.error('[image] DALL-E 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ────────────────────────────────────────────
// WP 이미지 업로드 + featured_media + publish
// ────────────────────────────────────────────
async function uploadImageAndPublish(postId: number, imageUrl: string | null, keyword: string): Promise<void> {
  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

  const updateBody: Record<string, unknown> = { status: 'publish' };

  if (imageUrl) {
    try {
      const imgFetch = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      const imgBuffer = await imgFetch.arrayBuffer();
      const mediaRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(keyword)}-thumbnail.png"`,
        },
        body: imgBuffer,
        signal: AbortSignal.timeout(30000),
      });
      const media = await mediaRes.json();
      if (media.id) {
        updateBody.featured_media = media.id;
        await fetch(`${wpBase}/wp-json/wp/v2/media/${media.id}`, {
          method: 'POST', headers,
          body: JSON.stringify({ alt_text: keyword }),
        }).catch(() => {});
        console.log(`[image] WP 미디어 업로드 성공: mediaId=${media.id}`);

        // 본문에 AI 이미지 안내 추가
        const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, { headers });
        const post = await postRes.json();
        if (post.content?.rendered || post.content?.raw) {
          const currentContent = post.content.raw || post.content.rendered;
          updateBody.content = currentContent +
            '\n<p style="color:#888;font-size:0.85em;border-top:1px solid #eee;margin-top:30px;padding-top:15px;text-align:center;">※ 본문의 이미지는 기사의 내용을 바탕으로 AI로 재구성하였습니다.</p>';
        }
      }
    } catch (e) {
      console.error('[image] WP 이미지 업로드 실패:', e instanceof Error ? e.message : e);
    }
  }

  const res = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
    method: 'POST', headers,
    body: JSON.stringify(updateBody),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP publish 실패: ${res.status} ${text.slice(0, 200)}`);
  }
  console.log(`[image] postId=${postId} publish 완료`);
}

// ────────────────────────────────────────────
// Cron 핸들러 (2단계: 이미지 생성 → publish)
// ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: ImageResult[] = [];

  try {
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('imageStatus', '==', 'pending')
      .get();

    console.log(`[auto-publish-image] pending ${snap.size}개 발견`);

    if (snap.size === 0) {
      return NextResponse.json({ success: true, message: 'pending 글 없음', results });
    }

    for (const doc of snap.docs) {
      const data = doc.data();
      const { keyword, category, postId } = data as { keyword: string; category: string; postId: number };

      console.log(`[auto-publish-image] 처리: ${keyword} (postId=${postId})`);

      try {
        // WP에서 제목+본문 조회
        const postInfo = await fetchPostInfo(postId);
        const title = postInfo?.title || keyword;
        const contentPreview = postInfo?.contentPreview || keyword;

        // DALL-E 이미지 생성 (본문 내용 기반)
        const imageUrl = await generateImage(keyword, category, title, contentPreview);

        // WP 이미지 업로드 + publish
        await uploadImageAndPublish(postId, imageUrl, keyword);

        await doc.ref.update({
          imageStatus: 'done',
          status: 'published',
          imageGeneratedAt: new Date(),
        });

        results.push({ keyword, postId, success: true });
        console.log(`[auto-publish-image] 성공: ${keyword}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ keyword, postId, success: false, error: msg });
        console.error(`[auto-publish-image] 실패: ${keyword}`, msg);

        try {
          await uploadImageAndPublish(postId, null, keyword);
          await doc.ref.update({ imageStatus: 'failed', status: 'published' });
        } catch {
          await doc.ref.update({ imageStatus: 'failed' });
        }
      }

      // 10초 간격 (DALL-E rate limit)
      await new Promise((r) => setTimeout(r, 10000));
    }

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auto-publish-image] 치명적 오류:', msg);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
