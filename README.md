# 최저가 비교 (Price Finder)

`docs/price-finder-spec.md` 명세서 기반 구현. 검색 → 후보 그룹핑(LLM) → 사용자 선택 → 정규화(LLM) → 계산/스코어링(코드) → 국내·해외 Top5.

**클라우드 구성:** Vercel(Next.js 서버리스) + 관리형 Postgres(Neon 권장) + GitHub Actions(CJ더마켓 크롤러).

---

## 1. 클라우드 배포 (Vercel + Neon)

### 1-1. DB 만들기 (Neon, 무료 플랜 가능)
1. https://neon.tech 에서 프로젝트 생성 (Region: `AWS Asia Pacific (Seoul)` 또는 Singapore 권장)
2. Connection string 두 개를 복사
   - **Pooled** (호스트에 `-pooler` 포함) → `DATABASE_URL` 뒤에 `?sslmode=require&pgbouncer=true&connect_timeout=15`
   - **Direct** → `DIRECT_URL` 뒤에 `?sslmode=require`

> Vercel 대시보드의 Storage → Neon 연동을 써도 됩니다. 그 경우 생성된 변수명(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`)을 위 두 이름으로 맞춰주세요.

### 1-2. Vercel 프로젝트
1. https://vercel.com/new → 이 GitHub 저장소 Import (Framework: Next.js 자동 인식)
2. **Environment Variables** 등록

| 이름 | 필수 | 비고 |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled URL |
| `DIRECT_URL` | ✅ | Neon direct URL (마이그레이션용) |
| `ANTHROPIC_API_KEY` | ✅ | |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | ✅ | developers.naver.com → 검색 API |
| `COUPANG_ACCESS_KEY` / `COUPANG_SECRET_KEY` | | 승인 후. 없으면 해당 소스만 건너뜀 |
| `ALIEXPRESS_APP_KEY` / `ALIEXPRESS_APP_SECRET` / `ALIEXPRESS_TRACKING_ID` | | 승인 후 |
| `NORMALIZE_MODEL` / `GROUPING_MODEL` | | 모델 교체 시에만 |

3. Deploy. 빌드 시 `vercel-build` 스크립트가 `prisma migrate deploy`로 테이블을 자동 생성합니다.
4. 확인: `https://<배포주소>/api/health` → `{"ok":true,"db":"ok",...}`
   - `ok:false`면 `env`에서 `false`인 항목, 또는 `db` 에러 메시지를 확인하세요.

### 1-3. 네이버 API 설정 주의
네이버 개발자센터 애플리케이션의 **서비스 환경 → WEB 설정**에 Vercel 도메인(`https://<배포주소>`)을 추가하세요. (서버 호출이라 필수는 아니지만, 누락 시 거부되는 사례가 있음)

### 1-4. 함수 실행 시간
API 라우트마다 `maxDuration = 60`(초)을 지정했습니다. 정규화 LLM 호출은 20건씩 청크로 나눠 병렬 호출하므로 보통 이 안에 끝납니다.

---

## 2. CJ더마켓 크롤러 (GitHub Actions, 선택)

서버리스에서는 Playwright/파일쓰기가 불가하므로 크롤러는 GitHub Actions에서 돌고 결과를 DB(`CjThemarketCache`)에 저장합니다. 앱은 DB를 읽기만 합니다.

1. 실행 전 CJ더마켓 robots.txt·이용약관 확인 (명세 7장)
2. `scripts/crawl-cj-themarket.ts`의 CSS 셀렉터를 실제 DOM에 맞게 수정 (**현재 자리표시자**)
3. GitHub 저장소 → Settings → Secrets and variables → Actions
   - Secret `DATABASE_URL`: Neon **direct** URL
   - Variable `CJ_QUERIES`: 검색어 (줄바꿈 구분)
   - Variable `CJ_CRAWL_ENABLED`: `true` (셀렉터 확정 후. 이 값이 없으면 스케줄 실행은 건너뜀)
4. Actions 탭 → `crawl-cj-themarket` → Run workflow 로 수동 테스트

스케줄: 매일 KST 09:17, 21:17. 크롤링 결과가 0건이면 기존 캐시를 덮어쓰지 않습니다.

---

## 3. 로컬 개발

```bash
npm install
cp .env.example .env        # API 키 채우기
npm run db:up               # docker로 Postgres 실행
npx prisma migrate deploy
npm run dev                 # http://localhost:3000
npm test                    # 파이프라인 회귀 테스트 (500억≠500 Billion 등)
```

스키마 변경 시: `npx prisma migrate dev --name <이름>` → 생성된 `prisma/migrations/*` 커밋 → 배포 시 자동 적용.

---

## 4. 알려진 설계 이탈

- `Reference.strength_unit`: 명세 4.1에 없는 필드. IU/mg 단위 상품 비교를 위해 추가 (CFU 계열 검증 대상엔 영향 없음).
- `CjThemarketCache` 테이블: 명세 9장에 없음. 서버리스 환경에서 파일 캐시를 대체.

## 5. 미결정 항목 (명세 11장)

- 후보 그룹핑 모델: Haiku 지정, 실측 필요 (`GROUPING_MODEL`로 교체 가능)
- `strength_type: unknown` 비율 높을 때 폴백 전략 없음
- 브랜드 화이트리스트 미구현
- 제휴 링크 치환 미구현 (원본 URL 노출)
- 검토 큐(review_queue) 수동 확인 UI 없음 — DB에만 적재
