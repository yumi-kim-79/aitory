import { NextRequest, NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';
import { adminDb } from '@/lib/firebase-admin';
import { postToTwitter } from '@/lib/twitter';

export const maxDuration = 60;

const RSS_URL = 'https://groove0926.mycafe24.com/feed/';

interface RssItem {
  link: string;
  title: string;
  category: string;
  keyword: string;
}

async function fetchRssItems(): Promise<RssItem[]> {
  const res = await fetch(RSS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`RSS fetch 실패: ${res.status}`);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml);
  const items = parsed?.rss?.channel?.[0]?.item || [];

  return items.slice(0, 20).map((item: Record<string, string[]>) => {
    const cats = item.category || [];
    const category = cats[0] || '일반';
    return {
      link: (item.link?.[0] || '').trim(),
      title: (item.title?.[0] || '').trim(),
      category,
      keyword: cats[1] || category,
    };
  }).filter((i: RssItem) => i.link && i.title);
}

async function getPostedLinks(): Promise<Set<string>> {
  try {
    const snap = await adminDb.collection('aitory_rss_posted').get();
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
}

function linkToDocId(link: string): string {
  return link.replace(/[\/\.\:]/g, '_').slice(0, 200);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 주말(토/일) KST 스킵
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ success: false, message: '주말 스킵' });
  }

  try {
    console.log('[rss-twitter] RSS 수집 시작');
    const items = await fetchRssItems();
    const posted = await getPostedLinks();

    const unposted = items.filter((i) => !posted.has(linkToDocId(i.link)));
    console.log(`[rss-twitter] 전체 ${items.length}, 미포스팅 ${unposted.length}`);

    if (unposted.length === 0) {
      return NextResponse.json({ success: true, message: '신규 글 없음', posted: 0 });
    }

    const targets = unposted.slice(0, 3);
    const results: { title: string; success: boolean; tweetUrl?: string; error?: string }[] = [];

    for (const item of targets) {
      try {
        const { tweetUrl } = await Promise.race([
          postToTwitter({ title: item.title, kbuzzUrl: item.link, keyword: item.keyword, category: item.category }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
        ]);
        await adminDb.collection('aitory_rss_posted').doc(linkToDocId(item.link)).set({
          link: item.link, title: item.title, tweetUrl, postedAt: new Date(), source: 'rss-cron',
        });
        results.push({ title: item.title, success: true, tweetUrl });
        console.log(`[rss-twitter] ✅ ${item.title.slice(0, 30)}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        results.push({ title: item.title, success: false, error });
        console.error(`[rss-twitter] ❌ ${item.title.slice(0, 30)}:`, error);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    return NextResponse.json({ success: true, total: targets.length, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rss-twitter] 에러:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
