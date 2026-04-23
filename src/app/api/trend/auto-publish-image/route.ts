// DALL-E 이미지 자동 생성 단계 제거 (2026-04-23)
// 2단계 자동화 비활성화. 이미지는 수동 업로드로 전환.
// vercel.json cron 엔트리도 함께 제거되었음. 원본 구현은 주석 처리하여 보존.

import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(
    { success: false, message: 'DALL-E 이미지 생성 2단계가 비활성화되었습니다. 이미지는 수동 업로드하세요.' },
    { status: 410 },
  );
}

/*
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase-admin';
import { ensureAiImageNotice } from '@/lib/seo-aeo';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ImageResult {
  keyword: string;
  postId: number;
  success: boolean;
  error?: string;
}

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

import { PHOTO_CATEGORY_STYLES, appendPhotoSuffix } from '@/lib/dalle-photo-prompt';

async function generateImage(
  keyword: string,
  category: string,
  title: string,
  contentPreview: string,
): Promise<string | null> {
  try {
    const styleHint = PHOTO_CATEGORY_STYLES[category] || 'editorial photography, modern Korean setting';

    const promptRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Create a photorealistic DALL-E 3 image prompt in English for a blog about "${title}" (category: ${category}).
Blog content excerpt: ${contentPreview}

Requirements:
- Real photograph style, NOT illustration or cartoon
- Visualize the core topic concretely
- Style reference: ${styleHint}

Respond with ONLY the English prompt, no other text. Keep it under 200 chars.`,
      }],
    });
    const basePrompt = promptRes.content[0].type === 'text' ? promptRes.content[0].text.trim() : keyword;
    const dallePrompt = appendPhotoSuffix(basePrompt, category);
    console.log(`[image] DALL-E 프롬프트: ${dallePrompt.slice(0, 200)}`);

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

async function uploadImageToDraft(postId: number, imageUrl: string | null, keyword: string): Promise<void> {
  if (!imageUrl) return;

  const wpBase = process.env.WP_SITE_URL;
  const wpUser = process.env.WP_USERNAME;
  const wpPass = process.env.WP_APP_PASSWORD;
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

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
  if (!media.id) throw new Error('WP 미디어 업로드 실패');

  await fetch(`${wpBase}/wp-json/wp/v2/media/${media.id}`, {
    method: 'POST', headers,
    body: JSON.stringify({ alt_text: keyword }),
  }).catch(() => {});
  console.log(`[image] WP 미디어 업로드 성공: mediaId=${media.id}`);

  const updateBody: Record<string, unknown> = { featured_media: media.id };

  const postRes = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, { headers });
  const post = await postRes.json();
  if (post.content?.rendered || post.content?.raw) {
    const currentContent = post.content.raw || post.content.rendered;
    updateBody.content = ensureAiImageNotice(currentContent);
  }

  const res = await fetch(`${wpBase}/wp-json/wp/v2/posts/${postId}`, {
    method: 'POST', headers,
    body: JSON.stringify(updateBody),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP 이미지 설정 실패: ${res.status} ${text.slice(0, 200)}`);
  }
  console.log(`[image] postId=${postId} 이미지 설정 완료 (draft 유지)`);
}

export async function GET_DISABLED(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-manual-trigger') === 'true';
  if (!isManual) {
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeek = kstNow.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dayName = dayOfWeek === 0 ? '일요일' : '토요일';
      console.log(`[auto-publish-image] 주말(${dayName}) 자동 스킵`);
      return NextResponse.json({
        success: false,
        message: '주말에는 자동 발행이 실행되지 않습니다.',
        day: dayName,
      }, { status: 200 });
    }
  } else {
    console.log('[auto-publish-image] 수동 트리거 - 주말 체크 우회');
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
        const postInfo = await fetchPostInfo(postId);
        const title = postInfo?.title || keyword;
        const contentPreview = postInfo?.contentPreview || keyword;

        const imageUrl = await generateImage(keyword, category, title, contentPreview);

        await uploadImageToDraft(postId, imageUrl, keyword);

        await doc.ref.update({
          imageStatus: 'done',
          status: 'draft_with_image',
          imageGeneratedAt: new Date(),
        });

        results.push({ keyword, postId, success: true });
        console.log(`[auto-publish-image] 성공: ${keyword} (검수 대기)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ keyword, postId, success: false, error: msg });
        console.error(`[auto-publish-image] 실패: ${keyword}`, msg);
        await doc.ref.update({ imageStatus: 'failed' }).catch(() => {});
      }

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
*/
