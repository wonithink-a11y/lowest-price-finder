# Vercel 배포 체크리스트

순서대로 따라 하면 됩니다. 각 단계에 **완료 확인** 기준이 있습니다.
Vercel에 들어가기 전(0~3단계)은 Vercel 없이 미리 끝낼 수 있습니다.

---

## 0단계. 준비물 한눈에 보기

| # | 항목 | 어디서 | 소요 | 비용 |
|---|---|---|---|---|
| 1 | Anthropic API 키 | console.anthropic.com | 5분 | 선불 크레딧 충전 필요 |
| 2 | 네이버 검색 API 키 | developers.naver.com | 5분 | 무료 (일 25,000회) |
| 3 | Postgres DB 주소 2개 | neon.tech | 5분 | 무료 플랜 가능 |
| 4 | 사이트 비밀번호 (선택) | 직접 정하기 | — | — |
| 5 | GitHub `main` 병합 | GitHub | 2분 | — |

메모장에 아래 틀을 만들어 두고 값을 채워가세요. 마지막에 Vercel에 **통째로 붙여넣기**할 수 있습니다.

```
DATABASE_URL=
DIRECT_URL=
ANTHROPIC_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
APP_PASSWORD=
```

> ⚠️ 이 메모는 비밀번호와 같습니다. GitHub, 채팅, 스크린샷에 올리지 마세요.

---

## 1단계. Anthropic API 키

1. https://console.anthropic.com 로그인
2. **Settings → Billing**: 크레딧 충전 (최소 $5). 잔액이 0이면 키가 있어도 호출이 실패합니다.
3. **Settings → Limits**: 월 사용 한도(Spend limit)를 설정합니다. 예: $10. 예상 밖 비용을 막는 안전장치입니다.
4. **Settings → API Keys → Create Key**: 이름은 `price-finder`
5. `sk-ant-...`로 시작하는 값을 `ANTHROPIC_API_KEY=` 뒤에 붙여넣기 (한 번만 보여주므로 바로 복사)

**완료 확인:** 메모에 `ANTHROPIC_API_KEY=sk-ant-api03-...` 한 줄이 생김

> **검색 1회 비용 (추정)**
> - 후보 그룹핑(Haiku): 약 7원. 같은 검색어는 30일 동안 생략됩니다.
> - 상품명 분석: 규칙으로 확실히 풀리는 건은 0원이고, 애매한 건만 Sonnet으로 분석합니다(건당 약 3원).
>   규칙이 몇 %를 처리하는지는 실제 네이버 응답으로 측정해야 합니다. 결과 화면 하단의 "분석: 규칙 N건 · 재사용 N건 · AI N건"으로 확인할 수 있습니다.
> - 3시간 안에 같은 검색어를 다시 검색하면 이전 분석 결과를 재사용해 0원입니다.
> - AI 호출이 실패해도(크레딧 소진 등) 규칙으로 처리한 결과는 그대로 표시됩니다.

---

## 2단계. 네이버 검색 API 키

1. https://developers.naver.com/apps/#/register 에서 로그인 후 **애플리케이션 등록**
2. 입력값
   - 애플리케이션 이름: `최저가비교` (자유)
   - **사용 API: `검색`** 선택 ← 가장 흔한 실수. 다른 API만 고르면 401이 납니다.
   - 비로그인 오픈 API 서비스 환경: **WEB 설정** → 웹 서비스 URL `http://localhost:3000`
     (Vercel 주소는 배포 후 6단계에서 추가)
3. 등록 → **Client ID**, **Client Secret**을 메모에 붙여넣기

**완료 확인:** `NAVER_CLIENT_ID=`, `NAVER_CLIENT_SECRET=` 두 줄이 채워짐

---

## 3단계. DB (Neon Postgres)

1. https://console.neon.tech 가입 (GitHub 계정으로 가능) → **New Project**
   - Name: `price-finder` / Postgres version: 16 / Region: **AWS Asia Pacific** 중 선택 (Singapore 등)
2. 프로젝트 대시보드 → **Connect** 버튼
3. **Connection pooling 켜기(ON)** 상태에서 주소 복사 → `DATABASE_URL=`
   - 주소 끝에 `&pgbouncer=true&connect_timeout=15` 를 **직접 추가**
   - 예: `postgresql://user:pw@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15`
   - 호스트에 `-pooler`가 들어 있어야 맞습니다.
4. **Connection pooling 끄기(OFF)** 상태에서 주소 복사 → `DIRECT_URL=` (그대로)
   - 예: `postgresql://user:pw@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   - 호스트에 `-pooler`가 **없어야** 합니다.

**완료 확인:** 두 주소가 `-pooler` 유무만 다르고 나머지는 같음

> 테이블은 만들 필요 없습니다. Vercel 빌드가 자동으로 생성합니다.

---

## 4단계. 사이트 비밀번호 (권장)

`APP_PASSWORD=` 뒤에 원하는 비밀번호를 적습니다.
- 설정하면 사이트 접속 시 브라우저가 아이디/비밀번호 창을 띄웁니다. **아이디는 아무거나**, 비밀번호만 맞으면 됩니다.
- 비워두면 URL을 아는 누구나 검색할 수 있고, 검색할 때마다 LLM 비용이 나갑니다.

---

## 5단계. GitHub `main`에 병합

Vercel은 `main` 브랜치를 운영 배포합니다. 현재 코드는 `claude/exciting-mendel-5xvvf4` 브랜치에 있습니다.

1. GitHub 저장소 → **Pull requests** → 이 브랜치의 PR 열기 (없으면 **New pull request**: base `main` ← compare `claude/exciting-mendel-5xvvf4`)
2. PR 하단의 **ci** 체크가 초록불인지 확인
   - ci는 타입검사·테스트·DB 마이그레이션·빌드·서버 기동을 Vercel과 같은 방식으로 검증합니다
3. **Merge pull request**

**완료 확인:** 저장소 첫 화면(`main`)에 `README.md`, `DEPLOY.md`, `src/`가 보임

---

## 6단계. Vercel 배포

1. https://vercel.com/new → **Continue with GitHub** → `lowest-price-finder` 옆 **Import**
2. 설정 화면
   - Framework Preset: **Next.js** (자동)
   - Root Directory: `./` (그대로)
   - Build and Output Settings: **아무것도 바꾸지 말 것**
     (Build Command를 직접 입력하면 DB 테이블 자동 생성 단계가 빠집니다)
3. **Environment Variables** 펼치기 → 메모 내용 전체를 복사해 첫 칸에 **붙여넣기**하면 여러 줄이 한 번에 등록됨
4. **Deploy** (2~3분)
5. 배포가 끝나면 도메인(예: `lowest-price-finder-xxx.vercel.app`)을 복사
   → 네이버 개발자센터 → 내 애플리케이션 → **API 설정 → WEB 설정**에 `https://<도메인>` 추가

**완료 확인:** Vercel 화면에 "Congratulations" + 사이트 미리보기

---

## 7단계. 배포 후 점검 (이 순서대로)

| 순서 | 주소 | 정상 결과 |
|---|---|---|
| ① | `https://<도메인>/api/health` | `"db":"ok"`, `"migrations":"ok"`, `"ok":true` |
| ② | `https://<도메인>/api/health?deep=1` | 위 항목 + `"naver":"ok"`, `"llm:claude-sonnet-4-6":"ok"`, `"llm:claude-haiku-4-5":"ok"` |
| ③ | `https://<도메인>/` 에서 `바이오코어 500억 유산균` 검색 | 후보 카드 → 하나 선택 → 국내/해외직구 탭에 결과 |

- ②는 네이버 1건 검색 + LLM 최소 호출로 **키가 실제로 동작하는지** 확인합니다 (비용 1원 미만).
- `APP_PASSWORD`를 설정했다면 ②와 ③에서 비밀번호 창이 뜹니다.
- `ok:false`면 `ok`가 아닌 항목의 메시지를 아래 표에서 찾으세요.

---

## 문제 해결

### 빌드 실패 (Vercel → Deployments → 실패한 배포 → Build Logs)

| 로그 메시지 | 원인 | 해결 |
|---|---|---|
| `P1001: Can't reach database server` | DB 주소 오류 | `DIRECT_URL` 재확인 (pooler 없는 주소, `sslmode=require` 포함) |
| `Environment variable not found: DIRECT_URL` | 변수 누락 | Settings → Environment Variables에 추가 후 **Redeploy** |
| `P3009` / `migrate found failed migrations` | 이전 마이그레이션 중단 | Neon에서 DB를 새로 만들고 주소 교체 |

> 환경변수를 바꾼 뒤에는 반드시 **Deployments → 최신 배포 ⋯ → Redeploy**를 해야 반영됩니다.

### `/api/health` 항목별

| 항목 | 메시지 예 | 원인 / 해결 |
|---|---|---|
| `db` | `Can't reach database server` | `DATABASE_URL` 오류 |
| `db` | `prepared statement "s0" already exists` | `DATABASE_URL` 끝에 `&pgbouncer=true` 누락 |
| `migrations` | `table ... does not exist` | 빌드 명령을 직접 입력해 migrate가 빠짐 → Settings → Build Command 비우고 Redeploy |
| `naver` | `401 ... Authentication failed` / `024` | ID/Secret 오타, 또는 사용 API에 `검색`이 없음 |
| `naver` | `429` | 일일 한도 초과 (다음 날 초기화) |
| `llm:*` | `401 ... authentication_error` | `ANTHROPIC_API_KEY` 오타 |
| `llm:*` | `400 ... credit balance is too low` | Anthropic 크레딧 충전 |
| `llm:*` | `404 ... not_found_error` (model) | 모델명 오류 → `NORMALIZE_MODEL` / `GROUPING_MODEL` 환경변수로 교체 |

### 화면에서

| 증상 | 원인 / 해결 |
|---|---|
| 검색 후 `FUNCTION_INVOCATION_TIMEOUT` / 504 | 60초 초과. 다시 시도 (두 번째부터는 수집 결과 캐시 사용) |
| "수집된 상품이 없습니다" + `naver: ...` | ②의 `naver` 항목과 같은 원인 |
| 배포 후에도 옛 화면 | 새로고침 두 번 (서비스워커 갱신) |
| 비밀번호 창이 계속 뜸 | `APP_PASSWORD` 값 확인. 아이디는 아무거나 입력 |

---

## 참고

- 운영 중 모델 교체: Vercel 환경변수 `NORMALIZE_MODEL` / `GROUPING_MODEL` 추가 → Redeploy (코드 수정 불필요)
- Preview 배포(PR마다 생성)도 같은 DB에 마이그레이션합니다. 분리하려면 환경변수를 Production/Preview로 나눠 다른 DB 주소를 지정하세요.
- 쿠팡·알리익스프레스 키는 승인 후 환경변수만 추가하면 자동으로 켜집니다.
- CJ더마켓 크롤러 설정은 `README.md` 3장.
