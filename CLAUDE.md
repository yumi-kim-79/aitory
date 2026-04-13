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

### Kbuzz/Shorts 호환 필드 통합 (2026-04 수정)
- 모든 자동/수동 발행 경로에서 aitory_published_keywords 문서에 kbuzz 필드 함께 저장
- 적용 writer: auto-publish, v3, republish-popular, post-to-wp
- 문서 ID: `kbuzz_<wpPostId>` (deterministic, set merge:true)
- 추가 필드: kbuzzUrl, kbuzzTitle, kbuzzPostId, kbuzzPublishedAt, kbuzzStatus='published'
- status 필드: 'draft' → 'published'
- 마이그레이션: scripts/update-kbuzz-status.mjs (기존 wpUrl 있는 문서 일괄 업데이트)

### X(트위터) 자동 포스팅 (2026-04 추가)
- 패키지: twitter-api-v2
- 유틸: src/lib/twitter.ts (postToTwitter 함수)
- API: POST /api/trend/post-to-twitter (관리자 인증, 중복 포스팅 방지)
- 환경변수: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
- 트윗 생성: 템플릿 방식 (카테고리별 이모지 + 제목 + URL + 해시태그), Claude API 미사용
- 트리거: post-to-wp 발행 성공 후 자동 호출, auto-publish 각 글 성공 후 자동 호출
- 타임아웃: Promise.race 15초 제한
- Firestore: tweetUrl, tweetError, tweetedAt 필드 업데이트
- 실패해도 블로그 발행 영향 없음 (graceful)
- 중복 포스팅 방지: tweetUrl 이미 URL값 있으면 스킵

### WordPress → X 자동 포스팅 웹훅 (2026-04 추가)
- API: POST /api/webhook/wordpress-publish
- 인증: WEBHOOK_SECRET 환경변수 (body.secret 검증)
- WordPress 플러그인: scripts/wordpress-webhook-plugin.php
- 동작: WordPress 발행(transition_post_status) → 웹훅 → postToTwitter() → X 자동 포스팅
- Firestore: kbuzz_${postId} 문서에 tweetUrl/tweetError/tweetedAt 업데이트
- 외부 발행 글(Aitory 외부): source='wordpress-webhook'으로 신규 문서 자동 생성
- 비동기: wp_remote_post blocking=false (WordPress 발행 속도 영향 없음)
- 중복 방지: tweetUrl 이미 있으면 스킵
- 타임아웃: 15초 Promise.race

### RSS → X 자동 포스팅 Cron (2026-04 추가)
- API: GET /api/cron/rss-twitter
- Cron: 매일 KST 09:00 (0 0 * * * UTC)
- RSS: https://groove0926.mycafe24.com/feed/
- Firestore: aitory_rss_posted 컬렉션 (link 기반 doc ID)
- 새 글 최대 3개/회 포스팅, 3초 딜레이
- 주말(토/일) KST 스킵
- 패키지: xml2js (RSS 파싱)

### 기존 글 X 일괄 포스팅 (2026-04 추가)
- API: POST /api/admin/bulk-tweet-existing (관리자 전용, 스트리밍)
- WP REST API로 발행 글 전체 조회 → aitory_rss_posted 미포스팅 필터 → 순차 트윗
- dryRun 모드로 대상 확인 가능
- 3초 딜레이 (rate limit), rate limit(429) 감지 시 자동 중단
- source: 'bulk'로 Firestore 저장
- /trend 페이지 관리자 섹션에 UI 버튼

### 기존 글 X 일괄 포스팅 UI 버그 수정 (2026-04)
- 문제: API 200 성공이지만 UI에서 이전 401 에러 계속 표시
- 원인: 대상 확인/실행 클릭 시 이전 결과 상태 미초기화
- 수정: 버튼 클릭 즉시 setBulkTweetLog 초기화, res.ok 체크 추가

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
