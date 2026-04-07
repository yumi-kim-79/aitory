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
// DALL-E 3 이미지 생성
// ────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, string> = {
  'K-연예/한류': 'Vibrant K-pop concert stage with dramatic lighting, colorful LED backdrop, modern Korean entertainment aesthetic, cinematic quality',
  'K-스포츠': 'Dynamic sports action scene with Korean flag elements, stadium atmosphere, dramatic lighting, motion blur effect',
  '경제/비즈니스': 'Modern financial district skyline, stock market data visualization, sleek corporate aesthetic, blue and gold color scheme',
  '사회/생활': 'Clean modern lifestyle photography style, warm natural lighting, Korean urban environment',
  'IT/과학': 'Futuristic technology visualization, glowing circuit patterns, blue purple gradient, AI neural network aesthetic',
};

const QUALITY_SUFFIX = 'no human faces, no text, no letters, professional blog thumbnail, highly detailed, 4K quality, professional photography, sharp focus, perfect composition, magazine cover quality';

async function generateImage(keyword: string, category: string): Promise<string | null> {
  try {
    const styleHint = CATEGORY_STYLES[category] || 'clean and modern professional blog thumbnail style';

    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Create a DALL-E 3 image prompt in English for a blog about "${keyword}".

Style reference: ${styleHint}

Requirements:
- Incorporate the specific topic "${keyword}" into the visual concept
- ${QUALITY_SUFFIX}
- Do NOT include any text, words, or letters in the image

Respond with only the English prompt, no other text.`,
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

  // 이미지 업로드
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
        // alt text
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

  // publish로 변경
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
    // pending 글 조회
    const snap = await adminDb
      .collection('aitory_published_keywords')
      .where('imageStatus', '==', 'pending')
      .get();

    console.log(`[auto-publish-image] pending ${snap.size}개 발견`);

    if (snap.size === 0) {
      return NextResponse.json({ success: true, message: 'pending 글 없음', results });
    }

    // 순차 처리 (DALL-E rate limit 방지)
    for (const doc of snap.docs) {
      const data = doc.data();
      const { keyword, category, postId } = data as { keyword: string; category: string; postId: number };

      console.log(`[auto-publish-image] 처리: ${keyword} (postId=${postId})`);

      try {
        // DALL-E 이미지 생성
        const imageUrl = await generateImage(keyword, category);

        // WP 이미지 업로드 + publish
        await uploadImageAndPublish(postId, imageUrl, keyword);

        // Firestore 상태 업데이트
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

        // 이미지 실패해도 publish는 시도
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
