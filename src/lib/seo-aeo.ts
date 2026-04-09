// ────────────────────────────────────────────
// SEO/AEO 유틸리티
// ────────────────────────────────────────────

/** SEO+AEO 적용 여부를 표시하는 마커 (WP가 절대 strip 하지 않는 HTML 주석) */
export const SEO_AEO_MARKER = '<!-- kbuzz-seo-aeo-applied -->';

/** AI 요약 박스 (AEO - Answer Engine Optimization) */
export function buildSummaryBox(summary: string): string {
  return `${SEO_AEO_MARKER}
<div class="kbuzz-summary" style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
<strong style="display:block;margin-bottom:8px;color:#1e40af;">📌 핵심 요약</strong>
<p style="margin:0;color:#334155;line-height:1.7;">${summary}</p>
</div>`;
}

/** FAQ HTML + Schema.org JSON-LD */
export function buildFaqSection(faqs: { question: string; answer: string }[]): { html: string; jsonLd: string } {
  if (faqs.length === 0) return { html: '', jsonLd: '' };

  const html = `<h2>자주 묻는 질문 (FAQ)</h2>
<div class="kbuzz-faq" itemscope itemtype="https://schema.org/FAQPage">
${faqs.map((faq) => `<div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" style="margin-bottom:16px;padding:12px 16px;background:#fafafa;border-radius:8px;">
<h3 itemprop="name" style="margin:0 0 8px;color:#1e293b;font-size:1em;">❓ ${faq.question}</h3>
<div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
<p itemprop="text" style="margin:0;color:#475569;line-height:1.6;">${faq.answer}</p>
</div>
</div>`).join('\n')}
</div>`;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  });

  return { html, jsonLd };
}

/** Article JSON-LD (Google Discover / Rich Results) */
export function buildArticleJsonLd(params: {
  title: string;
  url: string;
  description: string;
  datePublished: string;
  author?: string;
  imageUrl?: string;
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: params.title.slice(0, 110),
    description: params.description.slice(0, 150),
    url: params.url,
    datePublished: params.datePublished,
    dateModified: params.datePublished,
    author: {
      '@type': 'Organization',
      name: params.author || 'Kbuzz',
      url: 'https://kbuzz.co.kr',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Kbuzz',
      url: 'https://kbuzz.co.kr',
    },
    ...(params.imageUrl ? { image: [params.imageUrl] } : {}),
  });
}

/** 메타 설명 150자 강제 */
export function safeExcerpt(text: string, max = 150): string {
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + '...';
}

/** WP 본문에 JSON-LD 스크립트 삽입 */
export function appendJsonLd(content: string, ...jsonLds: string[]): string {
  const scripts = jsonLds
    .filter(Boolean)
    .map((ld) => `<!-- wp:html --><script type="application/ld+json">${ld}</script><!-- /wp:html -->`)
    .join('\n');
  return scripts ? `${content}\n${scripts}` : content;
}
