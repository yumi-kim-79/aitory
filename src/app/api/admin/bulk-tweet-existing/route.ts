import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { postToTwitter } from '@/lib/twitter';

export const maxDuration = 300;

const WP_BASE = 'https://groove0926.mycafe24.com';

interface WpPost {
  id: number;
  title: { rendered: string };
  link: string;
  categories: number[];
  tags: number[];
}

function linkToDocId(link: string): string {
  return link.replace(/[\/\.\:]/g, '_').slice(0, 200);
}

async function fetchAllWpPosts(): Promise<WpPost[]> {
  const all: WpPost[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const res = await fetch(
        `${WP_BASE}/wp-json/wp/v2/posts?status=publish&per_page=100&page=${page}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) break;
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;
      all.push(...(posts as WpPost[]));
      if (posts.length < 100) break;
    } catch {
      break;
    }
  }
  return all;
}

async function fetchCategoryMap(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const res = await fetch(`${WP_BASE}/wp-json/wp/v2/categories?per_page=100`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const cats = await res.json();
      for (const c of cats as { id: number; name: string }[]) map.set(c.id, c.name);
    }
  } catch {}
  return map;
}

async function getPostedLinks(): Promise<Set<string>> {
  try {
    const snap = await adminDb.collection('aitory_rss_posted').get();
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}

export async function POST(request: Request) {
  const decoded = await verifyToken(request);
  if (!decoded) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const userDoc = await getUserDoc(decoded.userId);
  if (!userDoc || userDoc.role !== 'admin') return Response.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const dryRun = !!(body as { dryRun?: boolean }).dryRun;

  try {
    console.log(`[bulk-tweet] 시작 (dryRun=${dryRun})`);

    const [posts, catMap, posted] = await Promise.all([
      fetchAllWpPosts(),
      fetchCategoryMap(),
      getPostedLinks(),
    ]);

    const targets = posts.filter((p) => !posted.has(linkToDocId(p.link)));
    console.log(`[bulk-tweet] 전체 ${posts.length}, 미포스팅 ${targets.length}`);

    if (dryRun) {
      return Response.json({
        success: true,
        dryRun: true,
        total: posts.length,
        pending: targets.length,
        alreadyPosted: posts.length - targets.length,
        sample: targets.slice(0, 5).map((p) => ({ id: p.id, title: p.title.rendered.replace(/<[^>]+>/g, '') })),
      });
    }

    // 스트리밍 응답
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let succeeded = 0;
        let failed = 0;
        let skipped = 0;

        const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'));
        send(`📤 총 ${targets.length}개 포스팅 시작\n`);

        for (let i = 0; i < targets.length; i++) {
          const p = targets[i];
          const title = p.title.rendered.replace(/<[^>]+>/g, '').trim();
          const catName = p.categories?.[0] ? (catMap.get(p.categories[0]) || '일반') : '일반';
          const keyword = catName;
          const docId = linkToDocId(p.link);

          // 다시 한번 중복 체크
          try {
            const doc = await adminDb.collection('aitory_rss_posted').doc(docId).get();
            if (doc.exists) { send(`⏭️ (${i + 1}/${targets.length}) 스킵 - ${title.slice(0, 40)}`); skipped++; continue; }
          } catch {}

          try {
            const { tweetUrl } = await Promise.race([
              postToTwitter({ title, kbuzzUrl: p.link, keyword, category: catName }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
            ]);
            await adminDb.collection('aitory_rss_posted').doc(docId).set({
              link: p.link, title, tweetUrl, postedAt: new Date(), source: 'bulk',
            });
            succeeded++;
            send(`✅ (${i + 1}/${targets.length}) ${title.slice(0, 40)} → ${tweetUrl}`);
          } catch (e) {
            failed++;
            const error = e instanceof Error ? e.message : String(e);
            send(`❌ (${i + 1}/${targets.length}) ${title.slice(0, 40)} → ${error}`);

            // rate limit 감지 시 중단
            if (error.includes('429') || error.includes('rate')) {
              send(`\n⚠️ Twitter rate limit 감지. 중단합니다.`);
              break;
            }
          }

          // 3초 딜레이
          await new Promise((r) => setTimeout(r, 3000));
        }

        send(`\n📊 완료: 성공 ${succeeded} / 실패 ${failed} / 스킵 ${skipped}`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
