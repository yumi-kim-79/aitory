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
