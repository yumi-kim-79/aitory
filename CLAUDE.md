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

### 자동 발행 주말 스킵 (2026-04 추가)
- 토요일(6) / 일요일(0) KST 기준 자동 발행 스킵
- 적용 API: /api/trend/auto-publish, /api/trend/auto-publish-image
- Cron은 유지, API 내부에서 early return 처리
- vercel.json 변경 없음
- 응답: { success: false, message: '주말에는 자동 발행이 실행되지 않습니다.', day: '토요일'|'일요일' } (status 200)

### 주말 스킵 우회 - 수동 트리거 (2026-04 수정)
- Cron(GET)만 주말 스킵, 수동(trigger-publish POST)은 우회
- 수동 호출은 trigger-publish/trigger-publish-image가 내부 fetch 시 헤더 추가:
  - `x-manual-trigger: true`
- auto-publish/auto-publish-image GET 핸들러에서 위 헤더 감지 시 주말 체크 skip
- 평일/주말 모두 관리자 수동 발행 항상 가능
- 동작 매트릭스:
  | 호출 경로  | 평일 | 주말 |
  |-----------|------|------|
  | Cron 자동 | 발행 | 스킵 |
  | 수동 버튼 | 발행 | 발행 |
