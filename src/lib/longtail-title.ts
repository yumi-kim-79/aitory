import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// CTR 패턴: 카테고리별 검증된 제목 템플릿
const CTR_PATTERNS: Record<string, string[]> = {
  'K-연예/한류': [
    '{keyword} 최신 소식: 팬들이 모르는 비하인드',
    '{keyword} 2026 활동 총정리 및 향후 전망',
    '{keyword} 논란과 반응 정리: 무슨 일이?',
  ],
  'K-스포츠': [
    '{keyword} 시즌 성적 분석: 숫자로 보는 활약',
    '{keyword}이 성공한 5가지 이유',
    '{keyword} vs 경쟁자: 비교 분석',
  ],
  '경제/비즈니스': [
    '{keyword} 투자 전략: 전문가 분석',
    '{keyword} 영향 분석: 당신의 지갑에 미치는 영향',
    '{keyword} 전망: 알아야 할 핵심 포인트 3가지',
  ],
  '사회/생활': [
    '{keyword} 변화: 당장 알아야 할 것들',
    '{keyword} 완벽 가이드: 꼭 확인해야 할 정보',
    '{keyword} 대처법: 전문가가 알려주는 방법',
  ],
  'IT/과학': [
    '{keyword} 기술 분석: 무엇이 달라졌나',
    '{keyword} 완벽 비교: 어떤 것을 선택할까',
    '{keyword}이 바꿀 미래: 전문가 전망',
  ],
};

export interface LongtailResult {
  titles: string[];
  faqs: { question: string; answer: string }[];
  summary: string;
}

/** 카테고리별 롱테일 제목 3안 + FAQ 3개 + 핵심요약 */
export async function generateLongtailContent(
  keyword: string,
  category: string,
  newsSummary: string,
): Promise<LongtailResult> {
  const patterns = CTR_PATTERNS[category] || CTR_PATTERNS['사회/생활'];
  const patternExamples = patterns.map((p) => p.replace('{keyword}', keyword)).join('\n  - ');

  const prompt = `키워드: "${keyword}"
카테고리: ${category}
뉴스 요약:
${newsSummary.slice(0, 500)}

아래 JSON만 반환 (다른 텍스트 없이):
{
  "titles": ["SEO 제목 1 (40~60자)", "SEO 제목 2 (40~60자)", "SEO 제목 3 (40~60자)"],
  "faqs": [
    {"question": "질문1", "answer": "답변1 (2~3문장)"},
    {"question": "질문2", "answer": "답변2 (2~3문장)"},
    {"question": "질문3", "answer": "답변3 (2~3문장)"}
  ],
  "summary": "핵심 요약 2~3문장 (150자 이내)"
}

titles 요건:
- CTR 높은 패턴 활용: ${patternExamples}
- 숫자/리스트형/질문형 제목 포함
- 각 제목이 서로 다른 검색의도 타겟

faqs 요건:
- 실제 검색될 법한 구체적 질문
- Google "People Also Ask" 스타일

summary 요건:
- AI 요약 박스용 핵심 내용
- 150자 이내`;

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 매치 실패');
    const parsed = JSON.parse(match[0]);
    return {
      titles: (parsed.titles || []).slice(0, 3),
      faqs: (parsed.faqs || []).slice(0, 3),
      summary: (parsed.summary || '').slice(0, 150),
    };
  } catch (e) {
    console.error('[longtail-title] 생성 실패:', e instanceof Error ? e.message : e);
    return {
      titles: [`${keyword} 최신 소식 총정리`, `${keyword} 분석: 핵심 포인트`, `${keyword} 전망과 영향`],
      faqs: [],
      summary: '',
    };
  }
}
