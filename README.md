# Aitory - AI 업무 자동화 플랫폼

## 서비스 개요
AI가 당신의 업무를 대신하는 플랫폼

## Claude Code 기본 컨텍스트 (새 세션 시작 시 이 파일 먼저 읽기)

### 프로젝트
- 서비스명: Aitory - AI 업무 자동화 플랫폼
- 스택: Next.js App Router + TailwindCSS + Firebase Auth + Firestore + Claude API (claude-sonnet-4-20250514)
- 패키지: @anthropic-ai/sdk, firebase, firebase-admin, pdf-lib, docx, xlsx, pdf-parse, mammoth, sharp

### 배포
- 플랫폼: Vercel
- 배포 명령어: `npx vercel --prod` (반드시 이 명령어 사용, git push만으로는 자동 배포 안 될 수 있음)
- 배포 순서:
  1. `git add . && git commit -m "메시지"`
  2. `git push origin main`
  3. `npx vercel --prod`
  4. 배포 완료 확인

### Firebase 구조
- 인증: Firebase Auth (이메일/비밀번호 + 구글 소셜 로그인, signInWithPopup 방식)
- Auth 상태관리: src/contexts/AuthContext.tsx (AuthProvider + useAuth) — 앱 전체 단일 인스턴스
- layout.tsx에 `<AuthProvider>` 래핑되어 있음
- DB: Firestore, 컬렉션 접두사 aitory_ 필수 (마이클라우드 기존 데이터 보호)
  - aitory_users, aitory_usage_logs, aitory_receipts, aitory_invoices, aitory_meetings, aitory_business_cards

### 주요 라우트
/ | /contract | /review | /sns | /realestate | /store | /receipt | /receipt/history
/translate | /invoice | /invoice/history | /business-card | /business-card/scan
/meeting | /meeting/history | /resume | /auth/signin | /auth/signup | /pricing | /mypage

### Claude Code 작업 방식 (새 세션에서 반드시 준수)
- 새 채팅 시작 시 항상 README.md를 먼저 읽고 컨텍스트 파악
- 작업 요청 형식:
  ```
  README.md 읽고 이어서 작업해줘.

  ## 문제
  (문제 설명)

  ## 해결
  (수정할 파일 경로 및 변경 내용)

  ## 작업 완료 후 필수 순서
  1. README.md 변경 이력 업데이트
     | 날짜 | 변경 내용 |
  2. git add . && git commit -m "커밋메시지"
  3. git push origin main
  4. npx vercel --prod
  ```
- README.md 변경이력은 교체가 아닌 **업데이트(추가)** 방식으로
- 코드 수정 → README 변경이력 업데이트 → 커밋/배포 순서 반드시 준수
- 배포 명령어는 반드시 `npx vercel --prod` 사용 (git push 자동배포 불안정)

### 개발 원칙 및 주의사항
- Firestore 컬렉션은 반드시 aitory_ 접두사 사용
- useAuth import 경로: @/contexts/AuthContext (hooks/useAuth 아님)
- 파일 업로드 최대 5개, PDF/Word/Excel/이미지 혼합 지원
- 크레딧 시스템: free/starter/pro 플랜별 제한
- localStorage는 Firestore(aitory_ 컬렉션) 마이그레이션 예정
- Firebase 배포 시: sharp 0.33.5 고정, .npmrc legacy-peer-deps, NEXT_BUNDLER=webpack
- Hydration 에러 방지: 동적 컴포넌트는 dynamic(ssr:false) 또는 suppressHydrationWarning
- 새 기능 추가 후 반드시 README.md 변경 이력 업데이트

## 기술 스택
- Frontend: Next.js + TailwindCSS
- AI: Claude API
- PDF파싱: pdf-parse
- Word파싱: mammoth
- Excel파싱: xlsx
- Backend: Firebase (Auth + Firestore + Hosting)
- 인증: Firebase Auth (이메일/비밀번호 + 구글 소셜)
- 패키지: @anthropic-ai/sdk, firebase, firebase-admin, pdf-lib, docx, xlsx

## Firestore 컬렉션 구조
| 컬렉션 | 용도 | 비고 |
|--------|------|------|
| `aitory_users` | 사용자 정보, 플랜, 크레딧 | 마이클라우드 users와 분리 |
| `aitory_usage_logs` | 크레딧 사용 이력 | |
| `aitory_receipts` | 영수증/가계부 데이터 | 현재 localStorage |
| `aitory_invoices` | 견적서/인보이스 이력 | 현재 localStorage |
| `aitory_meetings` | 회의록 이력 | 현재 localStorage |
| `aitory_business_cards` | 명함/거래처 데이터 | 현재 localStorage |

> 마이클라우드 기존 컬렉션 (`albums`, `media`, `users`)은 건드리지 않음

## 기능
- PDF / Word(.docx) / Excel(.xlsx, .xls) / 이미지(JPG, PNG, WEBP) 파일 업로드
- 여러 파일 동시 업로드 지원 (최대 5개, 혼합 형식 가능)
- 이미지 배치 OCR (여러 장 1회 Vision API 호출)
- 텍스트 직접 입력
- 위험도 점수 (0~100)
- 위험/주의/안전 조항 분류 및 색상 구분
- 수정 제안 문구 제공

## 라우팅 구조
| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | 메인 홈페이지 (서비스 선택) | 사용 가능 |
| `/contract` | 계약서 검토기 | 사용 가능 |
| `/review` | 리뷰 분석 마케팅 문구 | 사용 가능 |
| `/sns` | SNS 콘텐츠 재가공 | 사용 가능 |
| `/realestate` | 부동산 공고문 생성 | 사용 가능 |
| `/store` | 스마트스토어 상품등록 | 사용 가능 |
| `/receipt` | AI 영수증/가계부 | 사용 가능 |
| `/receipt/history` | 지출 내역 조회 | 사용 가능 |
| `/translate` | AI 번역 + 문서 요약 | 사용 가능 |
| `/invoice` | AI 견적서/인보이스 | 사용 가능 |
| `/invoice/history` | 견적서 이력 조회 | 사용 가능 |
| `/business-card` | AI 명함 스캐너 + CRM | 사용 가능 |
| `/business-card/scan` | 명함 스캔 | 사용 가능 |
| `/meeting` | AI 회의록 자동 생성 | 사용 가능 |
| `/meeting/history` | 회의록 이력 조회 | 사용 가능 |
| `/auth/signup` | 회원가입 | 사용 가능 |
| `/auth/signin` | 로그인 | 사용 가능 |
| `/pricing` | 요금제 | 사용 가능 |
| `/mypage` | 마이페이지 | 사용 가능 |

## 화면 구성
- 플랫폼 메인 홈페이지 (서비스 카드 선택)
- 계약서: 업로드/입력 → 로딩 → 결과 페이지
- 리뷰 분석: 리뷰 입력 → 로딩 → 키워드/문구 결과 페이지
- SNS 재가공: 텍스트 입력 → 플랫폼/톤 선택 → 로딩 → 플랫폼별 콘텐츠 결과
- 부동산 공고문: 조건 입력 → 플랫폼 선택 → 로딩 → 플랫폼별 공고문 결과
- 스마트스토어: 상품 정보 입력/엑셀 → 플랫폼별 탭 결과 → 엑셀 다운로드
- 영수증/가계부: 영수증 업로드/직접 입력 → OCR 분석 → 저장 → 지출 내역/통계
- 번역/요약: 파일/텍스트 입력 → 언어 감지 → 번역+요약+키워드 → 계약서 연동
- 견적서: 발신/수신/항목 입력 → AI 문구 생성 → 미리보기 → PDF/Word 다운로드 → 이력
- 명함 스캐너: 명함 업로드 → Vision OCR → 편집/태그 → 저장 → 거래처 목록/검색/CSV/vCard
- 회의록: 텍스트/파일 입력 → 회의정보 → 요약/결정/액션아이템/전체록 → Word/Excel 다운로드

## 개발 진행 상황
- [x] 프로젝트 세팅
- [x] PDF 파싱 구현
- [x] Claude API 연동
- [x] 프론트 메인 페이지
- [x] 프론트 결과 페이지
- [x] 디자인 완성
- [ ] 테스트 및 버그 수정

## 변경 이력
| 날짜 | 내용 |
|------|------|
| 2026-04-03 | 프로젝트 시작 |
| 2026-04-03 | 프로젝트 세팅, 레이아웃/메타데이터 구성 |
| 2026-04-03 | API 라우트 구현 (PDF 파싱 + Claude API 연동) |
| 2026-04-03 | 메인 페이지 (PDF 업로드/텍스트 입력) 구현 |
| 2026-04-03 | 결과 페이지 (위험도 점수, 조항 분류, 수정 제안) 구현 |
| 2026-04-03 | 로딩 화면 구현 및 디자인 완성 |
| 2026-04-03 | API 500 에러 수정 (PDF worker 로드 실패, JSON 파싱 오류) |
| 2026-04-03 | PDF 업로드 드래그 앤 드롭 기능 추가 |
| 2026-04-03 | PDF 파싱 worker 오류 수정 (별도 프로세스로 분리) |
| 2026-04-03 | 조항별 AI 수정 기능 추가 (/api/fix-clause) |
| 2026-04-03 | 계약서 전체 자동 수정 기능 추가 (/api/fix-all) |
| 2026-04-03 | 크레딧 표시, 텍스트 복사 버튼, 수정 계약서 다운로드 기능 추가 |
| 2026-04-03 | PDF 다운로드 기능 개선 - pdf-lib로 수정 계약서 PDF 생성, 수정 조항 파란색 하이라이트 |
| 2026-04-03 | 개별 조항 복사 버튼 추가, PDF 다운로드 원본 보존 오버레이 방식으로 개선 |
| 2026-04-03 | 업로드 형식 확장 - Word(.docx), Excel(.xlsx) 지원 추가, 파일 형식별 아이콘 표시 |
| 2026-04-03 | 다운로드 버튼 Word/Excel로 교체, /api/generate-docx, /api/generate-xlsx 추가 |
| 2026-04-03 | 구버전 Excel(.xls) 업로드 지원 추가 |
| 2026-04-03 | Hydration 에러 수정 - 업로드 영역 IIFE를 조건부 렌더링으로 리팩토링 |
| 2026-04-03 | Word/Excel 다운로드 재설계 - 원본 파일 양식 유지, adm-zip/exceljs 적용 |
| 2026-04-04 | 이미지 업로드 지원 추가 - Claude Vision API OCR, JPG/PNG/WEBP/HEIC 지원 |
| 2026-04-04 | 이미지 분석 JSON 파싱 오류 수정 - OCR+분석 1회 호출로 통합 |
| 2026-04-04 | Hydration 에러 수정 - accept의 image/* 와일드카드를 명시적 확장자로 교체 |
| 2026-04-04 | Hydration 에러 근본 수정 - 3개 컴포넌트 최상위 div에 suppressHydrationWarning 추가 |
| 2026-04-04 | Hydration+이미지 분석 동시 수정 - input에 suppressHydrationWarning, OCR→분석 2단계 분리 |
| 2026-04-04 | Hydration 완전 해결(FileUploadArea 분리+dynamic ssr:false), JSON 파싱 강화({} 추출) |
| 2026-04-04 | 이미지 분석 500 에러 수정 - JSON 파싱 실패 시 502 반환, OCR 빈 결과 처리 |
| 2026-04-04 | HEIC→JPEG 자동 변환(sharp), 여러 파일 동시 업로드+병렬 파싱 지원 |
| 2026-04-04 | HEIC 업로드 차단+안내, 이미지 배치 OCR(API 비용 절감), 파일 5개 제한+크레딧 표시 |
| 2026-04-04 | 플랫폼 메인 홈페이지 추가, 계약서 검토기를 /contract로 이동, 5개 서비스 카드 UI |
| 2026-04-04 | 이용 안내 박스, 요금제별 파일 제한(free/starter/pro), 플랜 토글 UI 추가 |
| 2026-04-04 | 리뷰 분석 마케팅 문구 생성기 개발 (/review, /api/review/analyze) |
| 2026-04-04 | SNS 콘텐츠 재가공기 개발 (/sns, /api/sns/analyze) - 6개 플랫폼, 4개 톤 지원 |
| 2026-04-04 | 부동산 임대 공고문 생성기 개발 (/realestate, /api/realestate/generate) - 4개 플랫폼 |
| 2026-04-04 | 부동산 입주가능일 즉시입주/날짜선택 토글로 변경 |
| 2026-04-04 | 스마트스토어 상품등록 자동화 개발 - 4개 플랫폼, 엑셀 업로드/다운로드, 샘플양식 |
| 2026-04-04 | AI 영수증/가계부 개발 - Vision OCR, localStorage 저장, 지출 내역/통계/CSV 다운로드 |
| 2026-04-04 | AI 번역+문서 요약기 개발 - 8개 언어, 파일/텍스트 입력, 번역+요약+키워드+계약서 연동 |
| 2026-04-04 | AI 견적서/인보이스 개발 - 4종 문서, PDF/Word 다운로드, 이력 관리, AI 문구 생성 |
| 2026-04-04 | AI 명함 스캐너+CRM 개발 - Vision OCR, 거래처 관리, 검색/태그/vCard/CSV 내보내기 |
| 2026-04-04 | AI 회의록 자동 생성 개발 - 요약/결정/액션아이템/전체록, Word/Excel 다운로드, 이력 |
| 2026-04-04 | 회원가입/로그인/요금제/마이페이지 구축 - Prisma+SQLite, 세션인증, 크레딧, 헤더, PWA |
| 2026-04-04 | Prisma 에러 수정 - postinstall/build 스크립트에 prisma generate 추가 |
| 2026-04-04 | Firebase 완전 마이그레이션 - Prisma 제거, Firebase Auth+Firestore+Hosting, 구글 소셜 로그인 |
| 2026-04-04 | Firestore 컬렉션 aitory_ 접두사 분리 - 마이클라우드 기존 데이터 보호 |
| 2026-04-04 | Firebase 배포 에러 수정 - sharp 0.33.5 다운그레이드, .npmrc legacy-peer-deps, CI 수정 |
| 2026-04-04 | 배포 에러 2차 수정 - lightningcss 호환성, CI 워크플로우 빌드+환경변수 추가 |
| 2026-04-04 | 배포 에러 3차 수정 - NEXT_BUNDLER=webpack으로 Turbopack 우회, lightningcss 옵션 의존성 |
| 2026-04-04 | 배포 에러 근본 수정 - CI에서 Linux 바이너리 강제 설치 (tailwindcss/oxide + lightningcss) |
| 2026-04-04 | Firebase deploy --force 옵션 추가 |
| 2026-04-04 | 워크플로우 복구 - 잘못된 target/deployOpts 제거, 기본 액션으로 복원 |
| 2026-04-04 | 로그인 후 리다이렉트 수정 - /api/auth/me에서 유저 문서 자동 생성, router.refresh 추가 |
| 2026-04-04 | 구글 로그인 401 수정 - PRIVATE_KEY 줄바꿈 처리 강화, register API 에러 핸들링 개선 |
| 2026-04-04 | 구글 로그인 후 홈 리다이렉트 시 로그인 상태 미반영 버그 수정 - useAuth 독립 인스턴스 문제, AuthContext로 전환하여 앱 전체 단일 user 상태 공유, layout.tsx에 AuthProvider 래핑, signInWithGoogle 즉시 setUser 반영, router.refresh() 제거 |
| 2026-04-04 | 구글 로그인 COOP 헤더 차단 수정(same-origin-allow-popups), /api/auth/register 401 수정(PRIVATE_KEY \n 처리, Admin SDK 중복 초기화 방지), register 실패해도 로그인 유지 |
| 2026-04-04 | COOP+COEP 헤더 추가(vercel.json), signInWithPopup→signInWithRedirect 전환, Admin SDK 디버깅 로그 추가, PRIVATE_KEY 쌍따옴표 제거 처리 |
| 2026-04-04 | register API 호출 제거(/api/auth/me에서 유저 자동 생성으로 통합), AuthContext 단순화, 구글 displayName 자동 저장 |
| 2026-04-04 | Vercel 자동 배포 확인 - GitHub 연동 정상, .github/workflows 이미 삭제, vercel.json 헤더만 설정 |
| 2026-04-04 | getRedirectResult 처리 순서 수정 - onAuthStateChanged 전에 await 실행, refreshUser 실패 시 Firebase user fallback 추가 |
| 2026-04-04 | 배포 프로세스 확립 - npx vercel --prod 명령어로 직접 배포, git push 자동 배포 불안정 |
| 2026-04-04 | 구글 로그인 성공 확인, 로그인 후 홈(/) 자동 이동 추가 |
| 2026-04-04 | signInWithRedirect → signInWithPopup 재전환(Firebase Hosting 없이 redirect 불가), authDomain을 aitory.vercel.app으로 변경 |
| 2026-04-04 | AI 이력서/자기소개서 생성기 개발 (/resume) - 기본정보/학력/경력/스킬 입력, Claude API 생성, 기존 이력서 개선 기능 |
| 2026-04-04 | 메인 홈페이지 개편 - 카테고리별 서비스 분류(4개 카테고리), 실시간 검색, 준비중 서비스 5개 추가 |
| 2026-04-04 | AI 내용증명/법률 문서 생성기 개발 (/legal) - 5종 문서, 발신/수신인 입력, 3단계 UI, 주의사항 표시 |
| 2026-04-04 | AI 법률 문서 + 상담 통합 (/legal) - 상담 탭 추가(7개 유형), 법적 근거/대응 단계/추천 문서, 면책조항 |
| 2026-04-04 | AI 근로계약서 생성기 개발 (/labor) - 고용주/근로자/근무조건 입력, 근로기준법 준수, 면책조항 |
| 2026-04-04 | AI 쇼핑몰 CS 답변 생성기 개발 (/cs) - 6개 플랫폼, 6개 문의유형, 3개 톤, 답변팁, 재생성 |
| 2026-04-04 | AI 식당 메뉴판 생성기 개발 (/menu) - 4개 플랫폼, 4개 분위기, 메뉴 추가/삭제, 플랫폼별 탭 결과 |
| 2026-04-04 | 견적서 Gmail 자동 발송 기능 추가 (/invoice 확장) - AI 이메일 제목/본문 생성, mailto fallback |
| 2026-04-04 | AI 부동산 계약서 체크리스트 개발 (/realestate/check) - 매매/전세/월세, 위험도 점수, 체크항목 |
| 2026-04-04 | AI 민원서류 작성기 개발 (/petition) - 5종 민원, 공공기관 표준 양식, 3단계 UI |
| 2026-04-05 | 전체 API pdf-lib 한글 에러 일괄 수정 - PDF 생성 API 제거(/api/generate-pdf, /api/invoice/download-pdf), Word(.docx) 다운로드로 통일 |
| 2026-04-05 | /menu pdf-lib 한글 에러 근본 수정 - API에서 PDF 완전 제거, /api/menu/download-docx 추가, Word 다운로드로 전환 |
| 2026-04-05 | menu btoa 한글 에러 근본 원인 수정 - Vercel ANTHROPIC_API_KEY 환경변수에 한글(유니코드 50668='여') 섞여 Anthropic SDK Authorization 헤더 ByteString 변환 실패, printf로 재등록 |
| 2026-04-05 | /receipt 영수증 업로드 버그 수정 - 파일 크기 4MB 제한, HEIC 차단 및 안내, 에러 메시지 구체화, API 디버그 로그 |
| 2026-04-05 | /receipt 영수증 업로드 실제 원인 수정 - FormData→JSON(base64) 전환, 삭제 버튼 stopPropagation, 브라우저 콘솔 로깅 |
| 2026-04-05 | 영수증 분석 항목명 OCR 오인식 교정, 표준 용어로 변환 (불기시→부가세, 탈계→합계 등) |
| 2026-04-05 | 영수증 OCR 정확도 대폭 개선 - 프롬프트 강화(항목 임의 추가 금지), temperature 0, 이미지 불명확/비영수증 에러 처리 |
| 2026-04-05 | 영수증 OCR 불확실 시 재촬영 안내 문구 추가 - 가게명 경고, 촬영 가이드, 재촬영 버튼 |
| 2026-04-05 | 영수증 가게명 OCR 정확도 개선 - 가맹점 레이블 지시, store_name_confidence 필드 추가, 인식 불확실 배지 |
| 2026-04-05 | 영수증 분석 결과 인라인 편집 기능 추가 - 가게명/날짜/시간/항목/금액 직접 수정, 합계 자동 재계산, 항목 추가/삭제, 수정 필드 파란색 표시 |
| 2026-04-06 | 실시간 트렌드 뉴스 수집기 개발 (/trend) - Google Trends RSS, Claude web_search 뉴스 수집, AI 요약 + SNS 콘텐츠 생성 |
| 2026-04-06 | 트렌드 + Kbuzz 자동 포스팅 (/trend) - 관리자 전용 WP 포스팅(role:admin), AuthContext role 필드, 3탭 구조 |
| 2026-04-06 | aitory_users 자동 생성 버그 수정(에러 로깅 추가), 관리자 계정 설정 스크립트(scripts/set-admin.mjs) |
| 2026-04-06 | 구글 로그인 cancelled-popup-request 에러 수정 - useRef 중복 호출 방지, 버튼 로딩 상태 추가 |
| 2026-04-06 | authDomain 원복 - aitory.vercel.app → mycloud-5ce96.firebaseapp.com (/__/auth/iframe 404 수정) |
| 2026-04-06 | 크레딧 0 / Kbuzz 탭 미표시 수정 - Vercel Firebase Admin 환경변수 printf 재등록, aitory_users 확인 스크립트 |
| 2026-04-06 | WordPress 포스팅 502 수정 - tags 제거(ID 미스매치), 타임아웃 25초, 상세 에러 로깅+표시 |
| 2026-04-06 | Kbuzz 포스팅 이미지 자동 삽입 - Unsplash/Pexels 검색, WP Media 업로드, 대표이미지+본문 이미지+크레딧 |
| 2026-04-06 | Kbuzz 블로그 품질 개선 - 애드센스 기준(800자+, 소제목3+), 이미지 위치 표시, 정치 주제 필터링, Pexels 제거 |
| 2026-04-06 | 트렌드 키워드 클릭 시 관련 뉴스 표시 복원 - Kbuzz 탭에서도 뉴스 표시되도록 조건 수정 |
| 2026-04-06 | 전체 API 504 타임아웃 수정 - 31개 route에 maxDuration=60 일괄 추가, blog max_tokens 4096→2000 |
| 2026-04-06 | 트렌드 크레딧 차감 정비 + 일반 사용자용 AI 블로그 글 생성 서비스 추가, 4탭 구조, Word 다운로드 |
| 2026-04-06 | 블로그 생성 스트리밍 방식 전환 - 504 타임아웃 근본 해결, 실시간 타이핑 효과, JSON 스트림 파싱 |
| 2026-04-06 | 블로그 생성 504 근본 해결 - system 프롬프트 제거→user 인라인, max_tokens 1500, SNS max_tokens 1000 |
| 2026-04-06 | 블로그 생성 클라이언트 직접 호출로 504 완전 해결 - dangerouslyAllowBrowser, deduct-credits API 분리 |
| 2026-04-06 | 블로그 생성 서버 방식 복원 - 클라이언트 호출 롤백, ANTHROPIC_API_KEY 재등록, NEXT_PUBLIC 키 삭제 |
| 2026-04-06 | 뉴스 cite태그 제거, 날짜표시(오늘/어제/N일전), 검색량 증감 UI(🔥/▲), 블로그 글 1500자+ 풍부하게 |
| 2026-04-06 | SEO 완전 개선 - HTML 형식(h2/p/strong), 1500자+, 메타설명 150자, 내부링크, WP 마크다운→HTML 변환 |
| 2026-04-06 | WordPress 태그/카테고리 자동 생성 및 발행 - search→create→ID 수집, 포스팅에 포함 |
| 2026-04-06 | 긴급수정 - 실패시 크레딧 미차감(성공후차감), 뉴스검색 Google RSS 전환(무료/1~2초), 504 해결 |
| 2026-04-06 | 메타설명 150자 강제 truncate - generate/post-to-wp 양쪽에서 excerpt 150자 초과 시 자동 절단 |
| 2026-04-06 | generate API 400 에러 수정 - mode 정규화(kbuzz/blog→blog, 기본sns), 미지원 mode fallback |
| 2026-04-06 | AI 블로그 글 탭 Kbuzz 발행/에러/결과 표시 관리자 전용 확인 및 보강 |
| 2026-04-06 | generate API 502 에러 수정 - JSON 파싱 실패 로깅 강화, 에러에 "크레딧 미차감" 명시 |
| 2026-04-06 | Kbuzz 버튼 isAdmin 조건 전수 검증 완료 - 6곳 모두 정상 적용 확인, 현재 계정이 admin이라 정상 표시 |
| 2026-04-06 | Kbuzz AI 이미지 안내문구 추가, 뉴스 날짜 필터링 강화(after: 파라미터, 작년 이전 제외, 최신순 정렬) |
| 2026-04-06 | SureRank SEO description 수정 - excerpt 150자 + _surerank_description 메타 필드 전송 |
| 2026-04-07 | 완전 자동화 - DALL-E 3 이미지 자동 생성, WP 미디어 업로드/대표이미지, Cron Job(09:00/15:00 KST), 관리자 자동화 대시보드 |
| 2026-04-07 | 자동발행 카테고리 분산 - 트렌드 TOP 15 수집 후 Claude가 카테고리 분류(연예/문화, 경제/비즈니스, 사회/생활, IT/과학, 스포츠), 카테고리별 1개씩 발행으로 주제 편중 방지 |
| 2026-04-07 | openai 패키지 추가, DALL-E imgRes.data optional chaining 타입 에러 수정 |
| 2026-04-07 | README.md에 Claude Code 작업 방식 섹션 추가 - 새 세션 시작 시 작업 형식/순서 명문화 |
| 2026-04-07 | 자동발행 탭 안내 텍스트 업데이트 - TOP 15 수집, 카테고리별 1개씩 선정 안내 반영 |
| 2026-04-07 | 자동발행 버튼 401 에러 수정 - trigger-publish 프록시 API 생성, Firebase ID 토큰 인증으로 변경 |
| 2026-04-07 | trigger-publish 500 에러 수정 - 내부 fetch 절대경로(VERCEL_PROJECT_PRODUCTION_URL), CRON_SECRET 검증, 에러 로깅 강화 |
| 2026-04-07 | 자동발행 버튼 에러 디버깅 강화 - idToken 실패/fetch 실패 시 화면에 에러 표시, 각 단계 콘솔 로깅 |
| 2026-04-07 | 트렌드 키워드 수집 실패 디버깅 - RSS 파싱 로그 강화, fallback URL 추가, plain title 파싱 추가 |
| 2026-04-07 | auto-publish 트렌드 수집 방식 변경 - 직접 RSS fetch 대신 기존 /api/trend/fetch API 내부 호출로 교체 |
| 2026-04-07 | auto-publish WP_URL→WP_SITE_URL 환경변수명 수정, 블로그 JSON 파싱을 extractJSON 방식으로 개선 |
| 2026-04-07 | trigger-publish 타임아웃 수정 - fire and forget 방식으로 변경, 즉시 응답 반환 |
| 2026-04-07 | 자동발행 개선 - 중복발행 방지(5분 쿨다운), K-콘텐츠 5할 비율 조정, 이미지 생성 로깅 강화 |
| 2026-04-07 | 자동발행 전략 개편 - K콘텐츠 별도 RSS 수집, 트렌드 우선+RSS 보완, Firestore 중복방지(7일) |
| 2026-04-07 | 자동발행 2단계 분리 - 1단계 draft 저장(글만), 2단계 DALL-E 이미지 생성 후 publish, Cron 5분 간격 |
| 2026-04-07 | trigger-publish fire-and-forget → 직접 await 방식으로 변경, maxDuration 300, 실제 결과 반환 |
| 2026-04-07 | 블로그 생성 JSON 파싱 실패 수정 - max_tokens 2500, 잘린 JSON 복구 로직, 프롬프트 800자+ 축소 |
| 2026-04-07 | SEO description 150자 강제(excerpt+_surerank+_yoast), 블로그 내용 1500자+로 복원 |
| 2026-04-07 | DALL-E 이미지 품질 개선 - 카테고리별 스타일 프롬프트, quality hd, 상세 품질 지시어 추가 |
| 2026-04-07 | 블로그 내부 링크 자동 삽입 - 같은 카테고리 최근 글 3개 조회 후 본문+관련글 섹션 추가 |
| 2026-04-07 | WP 슬러그 자동 생성 - 영문 50자 이내, 소문자/하이픈, SureRank URL 경고 해결 |
| 2026-04-07 | DALL-E 프롬프트 개선 - 카테고리 기반→블로그 제목+본문 기반, 이미지-내용 일치도 향상 |
| 2026-04-07 | 자동발행 시스템 점검 - 배치 내 중복방지, 2단계 버튼 결과표시 개선 |
| 2026-04-07 | 2단계 자동 publish 제거 - 이미지만 설정 후 draft 유지, 관리자 수동 발행으로 변경 |
| 2026-04-08 | cron 스케줄 변경 - 하루 1회 KST 07:00(UTC 22:00) 자동발행으로 단순화 |
| 2026-04-08 | 자동발행 10개로 증가(K-연예3+K-스포츠2+경제2+사회2+IT1), 병렬처리 최적화, 개별 60초 타임아웃 |
| 2026-04-08 | vercel.json 잔여 cron 제거 확인 - KST 07:00/07:05 2개만 유지, 재배포로 동기화 |
| 2026-04-08 | 1단계 고도화 - 뉴스 10개×1000자 수집, 블로그 2000자+, 소제목 4개+, max_tokens 3500 |
| 2026-04-08 | 1단계 X 자동 트윗 추가 - DALL-E 1024 이미지 첨부, 280자 자동 truncate, 트윗 실패해도 진행 |
| 2026-04-08 | 타임아웃 수정 - 뉴스 1000자→300자, max_tokens 3500→2500, 타임아웃 90초, 마크다운 변환 |
