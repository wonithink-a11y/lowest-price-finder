# 최저가 비교 서비스 — 인수인계 문서 (2차)

> 새 대화창에서 개발을 이어가기 위한 문서다. 설계 원칙은 `docs/price-finder-spec.md`(1차 명세서)가 기준이고,
> 이 문서는 **그 이후 실제로 구현·변경·검증한 내용**과 **남은 일**을 정리한다.

- 작성일: 2026-09-27
- 상태: 구현 완료 / 로컬·CI 검증 완료 / **실서비스 배포 전** (실제 네이버·Claude API 호출 미검증)
- 저장소: https://github.com/wonithink-a11y/lowest-price-finder
- 작업 브랜치: `claude/exciting-mendel-5xvvf4` (**아직 `main`에 병합 안 됨, PR 미생성**)
- 화면 미리보기(샘플 데이터): https://claude.ai/artifact/UphpDXQf3YwPhw1HFv2pv6

---

## 1. 다음 대화 시작 방법

이 문서와 `docs/price-finder-spec.md`를 첨부하고 예를 들어 이렇게 요청한다.

> 인수인계 문서 기준으로 이어서 작업해줘. 저장소는 wonithink-a11y/lowest-price-finder,
> 브랜치는 claude/exciting-mendel-5xvvf4. 이번에 할 일: [아래 9장에서 선택]

배포를 마친 뒤라면 `/api/health?deep=1` 결과와 실제 검색 화면 캡처를 함께 주면 가장 빠르다.

---

## 2. 한눈에 보는 현재 상태

| 영역 | 상태 | 비고 |
|---|---|---|
| 파이프라인 (수집→그룹핑→선택→정규화→계산→랭킹) | ✅ 구현 | 명세 2장 그대로 |
| 정규화 비용 절감 (규칙 우선 + AI 보조 + 결과 재사용) | ✅ 구현 | 5장 |
| 클라우드 배포 구성 (Vercel + Neon Postgres) | ✅ 준비 | `vercel build` 로컬 재현 성공 |
| Docker 배포 (Cloud Run·Render·Railway·Fly) | ✅ 준비 | 이미지 빌드·기동 검증 |
| 모바일 호환 (PWA 설치, 다크 모드, 280~800px) | ✅ 구현 | 기기 에뮬레이션 검증 |
| 새 디자인 (간결형, 아이콘 상태 표시) | ✅ 적용 | 미리보기와 동일 |
| 사이트 비밀번호 (APP_PASSWORD, 쿠키 180일) | ✅ 구현 | |
| CI (GitHub Actions) | ✅ 초록불 | push마다 자동 |
| **실제 배포** | ❌ 미완 | 사용자 작업 필요 (8장) |
| **실제 네이버·Claude API로 검색** | ❌ 미검증 | 작업 환경 네트워크 차단 + 키 없음 |
| 쿠팡·알리 연동 | ⏸ 코드만 | 제휴 승인 후 키만 넣으면 동작 |
| CJ더마켓 크롤러 | ⏸ 코드만 | CSS 셀렉터가 자리표시자 |

---

## 3. 구성과 흐름

```
[휴대폰/브라우저]  Next.js 14 (App Router) PWA
      │
      ├─ /api/search     네이버 수집(+쿠팡·알리·CJ캐시) → 가격 캐시 3h → 후보 그룹핑(Haiku) 또는 Reference 캐시 히트
      ├─ /api/select     사용자가 고른 후보를 Reference로 저장 (30일)
      ├─ /api/normalize  재사용 → 규칙 → 남은 것만 LLM(Sonnet) → offers_normalized 저장
      ├─ /api/build      단가·점수·게이트·중복제거·이상치 → 국내/해외 Top5 (코드만)
      ├─ /api/health     설정 점검 (?deep=1: 네이버·LLM 실호출)
      └─ /api/login      사이트 비밀번호 → 쿠키
      │
[Neon Postgres]  Prisma 5 — canonical_products / offers_raw / offers_normalized / offers_final / review_queue / CjThemarketCache
[GitHub Actions] ci.yml (검증) · crawl-cj.yml (CJ더마켓 크롤링 → DB)
```

- 호스팅: Vercel (서울 리전 `icn1` 고정, 함수 최대 60초, Node 22)
- DB 마이그레이션: Vercel 빌드 시 `vercel-build` 스크립트가 `prisma migrate deploy` 실행
- LLM: Anthropic SDK, tool-use로 스키마 강제 (명세 3장 원칙 유지)

---

## 4. 1차 명세 이후 결정·변경 사항

### 4.1 인프라
| 결정 | 이유 |
|---|---|
| SQLite → **PostgreSQL** (`DATABASE_URL` pooled + `DIRECT_URL` direct) | 서버리스는 파일 DB가 유지되지 않음 |
| CJ더마켓 캐시: JSON 파일 → **DB 테이블 `CjThemarketCache`** | 서버리스는 파일 쓰기 불가. 크롤러는 GitHub Actions에서 실행 |
| Prisma `binaryTargets`에 rhel·debian 추가 | 어느 기기에서 빌드해도 Vercel/Docker 엔진 포함 |
| `.gitignore` 교체 | 원래 Python용이라 `lib/`를 무시 → `src/lib` 전체가 커밋에서 빠질 뻔함 |
| API 라우트 `maxDuration = 60` | Vercel 함수 시간 제한 |

### 4.2 정규화 (비용 절감) — `src/lib/pipeline/ruleExtract.ts`, `src/app/api/normalize/route.ts`
1. **재사용:** 같은 raw × 같은 Reference × 같은 규칙/프롬프트 버전 결과가 있으면 그대로 사용 (raw 가격 캐시가 3시간이므로 사실상 3시간)
2. **규칙:** 브랜드·상품명 핵심어·함량 1개·수량이 확실한 제목만 코드로 처리
3. **LLM:** 나머지만 20건씩 청크로 병렬 호출 (50건 한 번에 보내면 `max_tokens`에서 잘리던 문제 해결)
4. LLM이 실패해도 규칙 결과는 표시하고 "AI 분석 실패로 N건 제외" 경고

규칙이 반드시 LLM으로 넘기는 경우: 증정·`+`·택1·옵션·정기배송·구독·`N개입`·`2박스(60포)`처럼 총량 괄호 표기, 다른 라인업 단어(키즈·골드·플러스 등), 함량 2개 이상/없음, 단위 2개 이상, `수입`·`아이허브`·영문 위주 제목.
원칙: **틀린 값을 내느니 LLM에 넘긴다.**

버전 관리: 규칙을 바꾸면 `RULES_VERSION`(현재 `rules-v1`), 프롬프트를 바꾸면 `PROMPT_VERSION`(현재 `normalize-v1`)을 올린다. 캐시가 무효화되고 `offers_normalized.promptVersion`으로 리플레이 비교가 가능하다 (명세 9장).
규칙 판정은 `model = "rules"`로 저장된다.

### 4.3 버그 수정 (원래 zip 코드 대비)
- `collected_at`이 항상 "지금"으로 찍힘 → `offers_raw.collectedAt` 사용 (명세 8장 4)
- `offers_final` FK를 URL로 역매핑 → 같은 URL이 둘이면 unique 제약 위반 → 객체 기준 매핑
- LLM 응답의 범위 밖·중복 `idx` 방어
- normalize insert를 `Promise.all` → 단일 트랜잭션 (서버리스 풀러 커넥션 고갈 방지)
- 서비스워커가 `/`를 캐시 우선으로 잡아 재배포 후 옛 화면 → 네트워크 우선

### 4.4 모바일·보안
- PWA: maskable 아이콘, 아이폰 홈 화면 메타·아이콘, safe-area 여백, light/dark theme-color
- 다크 모드 자체 제공 (삼성 인터넷의 강제 색 반전 방지)
- 폴드 커버 280px에서 검색 버튼이 밀려나던 문제 수정 (`min-w-0`)
- 모든 터치 영역 44px 이상
- **사이트 비밀번호:** `APP_PASSWORD` 설정 시 `/login`에서 한 번 입력 → httpOnly 쿠키 180일. 브라우저 기본 인증 팝업은 설치형 앱(특히 아이폰)에서 불안정해서 폐기. curl용 Basic 인증은 유지

### 4.5 디자인 (최종)
- 참고: 토스(카드·큰 숫자), 다나와/네이버 가격비교(판매처 한 줄 나열), 쿠팡(단위가격 "542원/포")
- 색은 CSS 변수(`src/app/globals.css`) → Tailwind 색으로 매핑 (`tailwind.config.ts`). 다크 모드는 변수 값만 바뀜
- 화면: 상단 고정 검색창 → 국내/해외직구 전환 → 상품명 한 줄 → 판매처 목록 → 아이콘 범례 → "수집 시각 · 참고가 기준"
- 판매처 한 칸 = 두 줄 (판매처·아이콘·단가 / 구성·총액)
- 상태 아이콘 (`src/components/StatusIcons.tsx`): 이상치 의심, 확인 필요, 함량 다를 수 있음(명세 8장 5), 배송비 추정, 무료배송, 통관 수량 제한 가능
- 글꼴: IBM Plex Sans KR (구글 폰트 `<link>`, 실패 시 시스템 글꼴)
- 규칙/재사용/AI 처리 건수는 화면에서 뺐고 브라우저 콘솔에 출력

### 4.6 명세 대비 의도적 이탈 (기록 필수)
| 항목 | 명세 | 현재 | 이유 |
|---|---|---|---|
| `Reference.strength_unit` | 없음 (4.1) | 추가 | IU/mg 상품 비교 |
| `Offer.pack_unit` | 없음 (4.5) | 추가 | "542원/포" 표시 |
| `Offer.variant` 형식 | "30포 x 2박스" | "30포 × 4 = 120포" | 총수량을 바로 보이게 |
| `CjThemarketCache` 테이블 | 없음 (9장) | 추가 | 서버리스 파일 캐시 대체 |

---

## 5. 비용 구조

| 항목 | 비용 |
|---|---|
| 네이버 쇼핑 API | 무료 (일 25,000회) |
| 후보 그룹핑 (Haiku) | 검색어당 약 7원, 같은 검색어는 30일 생략 |
| 정규화 (Sonnet) | 규칙으로 못 푼 건만, 건당 약 3원 (추정) |
| 재검색 (3시간 이내) | 0원 (결과 재사용) |
| Vercel / Neon | 개인 사용량은 무료 플랜 |

- 규칙 처리 이전 추정: 검색 1회 약 180원. **규칙 도입 후 실제 절감률은 미측정** (실제 네이버 응답 필요)
- Claude 구독(Pro/Max)과 API 요금은 별개. console.anthropic.com 선불 크레딧에서 차감
- `APP_PASSWORD` 미설정 시 누구나 검색 가능 → 비용 남용 위험

---

## 6. 파일 지도

| 경로 | 역할 |
|---|---|
| `docs/price-finder-spec.md` | 1차 설계 명세 (원칙·데이터 계약·함정) |
| `docs/HANDOVER.md` | 이 문서 |
| `DEPLOY.md` | Vercel 배포 체크리스트 (키 발급 → DB → 병합 → 배포 → 점검 → 휴대폰 설치 → 문제 해결) |
| `README.md` | 개요, Docker 배포, CJ 크롤러, 로컬 개발 |
| `src/lib/pipeline/*` | 코드 계산 전부 (strength·shipping·matchScore·confidence·gate·dedupe·outliers·rank·country·build·ruleExtract) |
| `src/lib/llm/*` | 그룹핑·정규화 LLM 호출, 모델 설정 |
| `src/lib/sources/*` | 네이버·쿠팡·알리·CJ(DB 캐시 읽기) |
| `src/app/api/*` | search·select·normalize·build·health·login |
| `src/components/*` | SearchBar·CandidateCards·ResultsTabs·OfferCard·StatusIcons |
| `src/middleware.ts`, `src/lib/auth.ts` | 사이트 비밀번호 |
| `prisma/schema.prisma`, `prisma/migrations/` | DB 스키마·마이그레이션 |
| `scripts/crawl-cj-themarket.ts` | CJ더마켓 크롤러 (셀렉터 미완) |
| `tests/pipeline.test.ts`, `tests/ruleExtract.test.ts` | 회귀 테스트 12개 (`npm test`) |
| `.github/workflows/ci.yml` | 타입검사·테스트·마이그레이션·빌드·기동 점검 |
| `.github/workflows/crawl-cj.yml` | CJ 크롤러 스케줄 (`CJ_CRAWL_ENABLED=true`일 때만) |
| `Dockerfile`, `vercel.json`, `docker-compose.yml` | 배포·로컬 DB |

---

## 7. 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled URL + `&pgbouncer=true&connect_timeout=15` |
| `DIRECT_URL` | ✅ | Neon direct URL (마이그레이션용) |
| `ANTHROPIC_API_KEY` | ✅ | |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | ✅ | 사용 API에 `검색` 포함 |
| `APP_PASSWORD` | 권장 | 사이트 비밀번호 |
| `NORMALIZE_MODEL` / `GROUPING_MODEL` | | 기본 `claude-sonnet-4-6` / `claude-haiku-4-5` |
| `COUPANG_*`, `ALIEXPRESS_*` | | 승인 후 |

GitHub Actions(CJ 크롤러): secret `DATABASE_URL`, variables `CJ_QUERIES`, `CJ_CRAWL_ENABLED`

---

## 8. 검증 현황

### 한 것
- 단위 테스트 12개: 500억≠500 Billion, `30포 x 2박스` 곱셈 재검증, 게이트, 제외 사유, 국내/해외 분리, 규칙 추출 12종 함정 → 모두 통과
- 로컬 Postgres로 E2E: 마이그레이션, 규칙 처리, 결과 재사용, LLM 실패 시 부분 결과, 재빌드 시 unique 충돌 없음
- `vercel build` 로컬 재현: 함수 5개 각 약 35MB, `maxDuration` 60, rhel 엔진 포함
- Docker 이미지 빌드·기동·마이그레이션·API 동작
- 기기 에뮬레이션: 280/360/384(S25+)/390/412/673/800px + 다크 모드 + 큰 글꼴 + 로그인 흐름 — 가로 넘침 0, 검색 버튼 탭 가능, 44px 미만 터치 영역 0
- GitHub Actions CI 초록불 (마지막 커밋 `44efad8`)

### 못 한 것 (다음 담당자 확인 필요)
- **실제 네이버 API 응답으로 검색** (작업 환경 네트워크 정책이 `openapi.naver.com` 차단)
- **실제 Claude API 호출** (키 없음) → 그룹핑·정규화 프롬프트 품질 미확인
- **규칙 처리 비율·실제 비용** 미측정
- **실제 Vercel 배포** (작업 환경에서 `api.vercel.com`·`console.neon.tech` 차단)
- **아이폰 Safari 실기기** (크롬 계열로만 에뮬레이션)
- 갤럭시 S25+ 실기기 설치·동작

---

## 9. 남은 일 (우선순위 순)

### 사용자 작업 (배포)
1. `DEPLOY.md` 1~4단계: Anthropic 키(월 한도 설정), 네이버 키, Neon 주소 2개, `APP_PASSWORD`
2. 작업 브랜치 → `main` 병합 (PR 생성 후 CI 초록불 확인 → Merge)
3. Vercel Import → 환경변수 붙여넣기 → Deploy
4. `/api/health` → `/api/health?deep=1` → "바이오코어 500억 유산균" 실제 검색
5. 갤럭시 S25+에서 홈 화면 설치 (`DEPLOY.md` 8단계)

> 대안: 작업 환경 Network access에서 `api.vercel.com`, `console.neon.tech`, `openapi.naver.com`을 허용하고 키를 환경 secret으로 주면 Claude가 직접 배포·검증 가능

### 개발 작업 (배포 후)
1. **실데이터로 규칙 튜닝** (명세 10장 1단계의 핵심): 네이버 응답을 모아 규칙 처리 비율·오판 측정 → 자주 LLM으로 넘어가는 표기에 규칙 추가 → `RULES_VERSION` 올림
2. **"확인 필요" 과다 가능성 대응**: 제목에 "보장균수"가 없으면 `strength_type = unknown` → 명세 6.1상 REVIEW → 대부분 "확인 필요" 배지. 명세 11장 미결정 항목("unknown 비율 높을 때 폴백")을 실측 후 정책 결정
3. 프롬프트 튜닝 (`PROMPT_VERSION` 올리며 `offers_raw` 리플레이 비교)
4. CJ더마켓 크롤러 셀렉터 채우기 (robots.txt·약관 확인 후) → `CJ_CRAWL_ENABLED=true`
5. 쿠팡 파트너스 → 알리익스프레스 연동 (키만 넣으면 소스 활성화. 명세 10장: 1단계 정확도 확보 전 소스 확대 금지)
6. 기기별 화면 점검을 CI에 추가 (지금은 수동 스크립트로 1회 실행)
7. 검토 큐(`review_queue`) 확인 화면, 제휴 링크 치환, 분석 건수(비용) 표시 화면 — 명세 11장 미결정

---

## 10. 주의사항 (함정)

1. **`vercel-build`가 DB 마이그레이션을 실행** → DB에 접속 못 하면 빌드 실패(P1001). Preview 배포도 같은 DB에 마이그레이션함
2. **Neon pooled URL에 `pgbouncer=true` 빠지면** `prepared statement "s0" already exists` 오류
3. Vercel 설정의 Build Command를 직접 입력하면 마이그레이션 단계가 빠진다 → 비워둘 것
4. 환경변수 변경 후에는 **Redeploy** 필요
5. `APP_PASSWORD`를 바꾸면 모든 기기에서 다시 로그인. 아이폰 설치 앱은 Safari와 쿠키를 공유하지 않아 앱에서 한 번 더 입력
6. `Dockerfile`의 `apt-get install openssl` 줄을 지우면 Prisma가 `libssl`을 못 찾아 DB 연결 실패
7. 규칙·프롬프트 수정 시 버전 상수를 올리지 않으면 **이전 판정 캐시가 그대로 재사용**됨
8. 명세 3장 원칙 유지: LLM 스키마에 가격 필드 금지, 숫자 계산은 코드만, 이상치는 제거하지 않고 강등
9. 해외직구 문구는 단정 금지 ("관부가세 없음" 금지, "통관 시 수량 제한이 적용될 수 있습니다"만)

---

## 11. 커밋 이력 (작업 브랜치)

| 커밋 | 내용 |
|---|---|
| `7bb49ad` | zip 코드 반입 + 클라우드 구성 (Postgres, CJ 캐시 DB화, 청크 정규화, 버그 수정) |
| `6aed6d2` | Vercel/Docker 배포 검증 (Prisma 엔진, Node 22, 서울 리전, Dockerfile) |
| `6597729` | CI, deep 헬스체크, 사이트 비밀번호, DEPLOY.md |
| `fee14a3` | 규칙 우선 정규화 + LLM 보조 + 결과 재사용 |
| `667a159` | 모바일에서 가격을 상품 정보 아래로 |
| `01c3892` | 기기 호환 (폴드·S25+·아이폰·태블릿, 다크 모드, PWA, 쿠키 로그인) |
| `44efad8` | 새 간결형 디자인 적용 (아이콘 상태 표시, 두 줄 목록) |
