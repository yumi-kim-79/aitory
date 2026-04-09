import crypto from 'crypto';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));

  const signable = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signable);
  const signature = base64url(sign.sign(sa.private_key));
  const jwt = `${signable}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth 실패 (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

let _tokenCache: { token: string; exp: number } | null = null;

function getServiceAccount(): ServiceAccount | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

export async function requestIndexing(url: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const sa = getServiceAccount();
  if (!sa) {
    console.log('[google-indexing] GOOGLE_SERVICE_ACCOUNT_JSON 미설정 → 스킵');
    return { success: false, error: 'service account 미설정' };
  }

  try {
    // 토큰 캐시 (50분 유효)
    if (!_tokenCache || Date.now() / 1000 > _tokenCache.exp - 600) {
      const token = await getAccessToken(sa);
      _tokenCache = { token, exp: Math.floor(Date.now() / 1000) + 3600 };
    }

    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_tokenCache.token}`,
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
      signal: AbortSignal.timeout(10000),
    });

    const status = res.status;
    if (res.ok) {
      console.log(`[google-indexing] 성공: ${url} (${status})`);
      return { success: true, status };
    }
    const text = await res.text();
    console.error(`[google-indexing] 실패: ${url} (${status}): ${text.slice(0, 200)}`);
    return { success: false, status, error: text.slice(0, 200) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[google-indexing] 에러:', msg);
    return { success: false, error: msg };
  }
}

export async function requestIndexingBatch(urls: string[]): Promise<{ url: string; success: boolean; error?: string }[]> {
  const results: { url: string; success: boolean; error?: string }[] = [];
  for (const url of urls) {
    const r = await requestIndexing(url);
    results.push({ url, success: r.success, error: r.error });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return results;
}
