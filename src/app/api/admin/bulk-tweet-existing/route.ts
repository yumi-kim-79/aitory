import { verifyToken } from '@/lib/middleware';
import { getUserDoc } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { postToTwitter } from '@/lib/twitter';
import { parseStringPromise } from 'xml2js';

export const maxDuration = 300;

const RSS_BASE = 'https://groove0926.mycafe24.com/feed/';

interface RssPost {
  title: string;
  link: string;
  category: string;
  keyword: string;
}

function linkToDocId(link: string): string {
  return link.replace(/[\/\.\:]/g, '_').slice(0, 200);
}

async function fetchAllRssPosts(): Promise<RssPost[]> {
  const all: RssPost[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const url = page === 1 ? RSS_BASE : `${RSS_BASE}?paged=${page}`;
      console.log(`[bulk-tweet] RSS 페이지 ${page} 조회: ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { console.log(`[bulk-tweet] RSS 페이지 ${page}: ${res.status}`); break; }
      const xml = await res.text();
      const parsed = await parseStringPromise(xml);
      const items = parsed?.rss?.channel?.[0]?.item;
      if (!items || items.length === 0) break;

      for (const item of items) {
        const title = (item.title?.[0] || '').trim();
        const link = (item.link?.[0] || '').trim();
        if (!title || !link) continue;
        const cats = item.category || [];
        const category = typeof cats[0] === 'string' ? cats[0] : (cats[0]?._ || '일반');
        all.push({ title, link, category, keyword: category });
      }

      if (items.length < 10) break; // RSS 기본 10개, 적으면 마지막 페이지
    } catch (e) {
      console.error(`[bulk-tweet] RSS 페이지 ${page} 에러:`, e instanceof Error ? e.message : e);
      break;
    }
  }
  console.log(`[bulk-tweet] RSS 전체 ${all.length}개 수집`);
  return all;
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

    const [posts, posted] = await Promise.all([fetchAllRssPosts(), getPostedLinks()]);
    const targets = posts.filter((p) => !posted.has(linkToDocId(p.link)));
    console.log(`[bulk-tweet] 전체 ${posts.length}, 미포스팅 ${targets.length}`);

    if (dryRun) {
      return Response.json({
        success: true,
        dryRun: true,
        total: posts.length,
        pending: targets.length,
        alreadyPosted: posts.length - targets.length,
        sample: targets.slice(0, 5).map((p) => ({ title: p.title, link: p.link })),
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
          const docId = linkToDocId(p.link);

          // 재중복 체크
          try {
            const doc = await adminDb.collection('aitory_rss_posted').doc(docId).get();
            if (doc.exists) { send(`⏭️ (${i + 1}/${targets.length}) 스킵 - ${p.title.slice(0, 40)}`); skipped++; continue; }
          } catch {}

          try {
            const { tweetUrl } = await Promise.race([
              postToTwitter({ title: p.title, kbuzzUrl: p.link, keyword: p.keyword, category: p.category }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
            ]);
            await adminDb.collection('aitory_rss_posted').doc(docId).set({
              link: p.link, title: p.title, tweetUrl, postedAt: new Date(), source: 'bulk',
            });
            succeeded++;
            send(`✅ (${i + 1}/${targets.length}) ${p.title.slice(0, 40)} → ${tweetUrl}`);
          } catch (e) {
            failed++;
            const error = e instanceof Error ? e.message : String(e);
            send(`❌ (${i + 1}/${targets.length}) ${p.title.slice(0, 40)} → ${error}`);
            if (error.includes('429') || error.includes('rate')) {
              send(`\n⚠️ Twitter rate limit 감지. 중단합니다.`);
              break;
            }
          }

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
