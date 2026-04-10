@AGENTS.md

### Shorts 콘텐츠 생성 기능 (2026-04 추가)
- 위치: /trend 페이지 하단 (관리자 전용)
- Firestore: aitory_published_keywords 컬렉션
  - 발행 완료 시 kbuzzUrl, kbuzzTitle, kbuzzPostId, kbuzzPublishedAt, kbuzzStatus 필드 추가 저장
  - 문서 ID: `kbuzz_<wpPostId>` (deterministic, set merge:true)
- API:
  - POST /api/trend/shorts (관리자 인증 필수, Claude 스트리밍)
  - GET /api/trend/published-list (관리자 인증, 최신 20개)
- 컴포넌트: src/components/trend/ShortsGenerator.tsx
- 생성 내용: 스크립트 / 설명문 / 해시태그 (Claude API 스트리밍)
- UI: 발행된 글 카드 그리드 → "🎬 Shorts 생성" 버튼 → 3개 탭 (📝 스크립트 / 📄 설명문 / #️⃣ 해시태그) → 탭별 복사 버튼
