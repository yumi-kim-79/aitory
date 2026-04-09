// ────────────────────────────────────────────
// DALL-E 사진 느낌 프롬프트 유틸
// ────────────────────────────────────────────

/** 카테고리별 사진 스타일 (실제 사진 느낌) */
export const PHOTO_CATEGORY_STYLES: Record<string, string> = {
  'K-연예/한류': 'concert stage, idol performance, Korean entertainment, dramatic stage lighting, cinematic atmosphere',
  'K-스포츠': 'sports action shot, Korean athlete, stadium atmosphere, motion blur, dynamic moment',
  '경제/비즈니스': 'Korean business district, Seoul skyline, office environment, modern corporate setting',
  '사회/생활': 'everyday Korean life, street photography, natural candid, warm sunlight',
  'IT/과학': 'tech workspace, developer environment, futuristic Korean tech, modern devices',
};

/** 사진 품질 지시어 (모든 프롬프트 끝에 추가) */
export const PHOTO_QUALITY_SUFFIX =
  'photorealistic, shot on Canon EOS R5, 85mm lens, natural lighting, ultra detailed, 4K, professional photography, real photo, no illustration, no cartoon, no painting, no human faces, no text, no letters';

/** 카테고리별 스타일 + 품질 지시어 결합 */
export function getPhotoStyleSuffix(category: string): string {
  const style = PHOTO_CATEGORY_STYLES[category] || 'editorial photography, modern Korean setting';
  return `${style}, ${PHOTO_QUALITY_SUFFIX}`;
}

/** Claude가 생성한 base 프롬프트에 사진 품질 suffix를 강제 추가 */
export function appendPhotoSuffix(basePrompt: string, category: string): string {
  return `${basePrompt}. ${getPhotoStyleSuffix(category)}`;
}
