# 최저가 비교 서비스 — 설계 명세서

> 이 문서는 새 대화창에서 개발을 이어가기 위한 인수인계 문서다.
> 구현 시작 전 반드시 3장(핵심 원칙)과 8장(함정)을 먼저 읽을 것.

- 문서 버전: v1.0
- 상태: 설계 확정 / 구현 미착수
- 첫 검증 대상: CJ웰케어 바이오코어 500억 유산균

---

## 1. 목적

사용자가 구매하려는 상품의 판매처별 가격을 수집·정규화하여
**국내 Top 5 / 해외직구 Top 5**를 분리 노출하고 구매 링크를 제공한다.

정렬 기준은 표기가가 아니라 **단가(unit_price = 총비용 ÷ 총수량)** 이다.
30포 19,900원과 60포 34,900원은 표기가로 비교하면 무의미하다.

---

## 2. 전체 파이프라인

```
검색어 입력
   ↓
[1] collect_all(병렬)  →  RawOffer[]
   ↓
[2] 후보 그룹핑(LLM)   →  Reference 후보 카드 3~5개
   ↓
[3] 사용자 선택        →  Reference 확정 (캐시 적재)
   ↓
[4] normalize(LLM)     →  Verdict[]   ※ 숫자 계산 없음
   ↓
[5] build(코드)        →  strength 정규화 / 배송비 / 총액 / 단가
   ↓
[6] score(코드)        →  match_score, extraction_confidence
   ↓
[7] deduplicate(코드)
   ↓
[8] flag_outliers(코드)
   ↓
[9] partition by country → KR Top5 / GLOBAL Top5
```

---

## 3. 핵심 원칙 (변경 금지)

1. **LLM은 의미를 판단하고, 숫자와 계산은 전부 코드가 담당한다.**
2. LLM 출력 스키마에 `price` 필드를 두지 않는다. 만질 경로 자체를 차단한다.
3. LLM 출력은 tool-use로 스키마를 강제한다. "JSON만 출력해" 프롬프트는 신뢰하지 않는다.
4. 원본 응답(`offers_raw`)은 영구 보존한다. 프롬프트 개선 시 리플레이 대상이다.
5. 추정값은 추정값이라고 표시한다 (`shipping.origin`, `flags`).
6. 이상치는 제거하지 않고 강등한다. 진짜 특가가 이 서비스의 존재 이유다.

---

## 4. 데이터 계약

### 4.1 Reference — 상품 정체성 (국가 중립)

사용자가 후보 카드에서 선택한 기준 상품. `canonical_products`에 캐싱.

```
id
brand              "CJ웰케어"
product_name       "바이오코어 500억 유산균"
strength_cfu       50_000_000_000      ← 정규화된 정수
strength_type      guaranteed | input | unknown
category           probiotics | vitamin | omega3 | general
aliases[]          ["바이오코어 500억", "CJ 바이오코어"]
```

**country를 두지 않는다.** 국내/해외 탭이 같은 Reference를 공유해야 비교가 성립한다.

### 4.2 RawOffer — 수집기 출력 (가공 금지)

```
source        naver | coupang | aliexpress | cj_themarket
mall          판매처 표기명
seller        판매자명 (없으면 mall과 동일)
title         원본 제목 (HTML 태그만 제거)
price         표기가 (int, 원)
url
product_id
image
brand         API 제공 시에만
shipping      ShippingPolicy | None   ← None = 미확인
raw           원본 dict 전체
```

### 4.3 ShippingPolicy

```
base_fee           3000
free_threshold     30000 | null
island_surcharge   3000
is_bundled         bool
estimated_days     2
origin             api | table | default
```

- `total_cost = price + fee_for(price)`
- `fee_for(price)`: `free_threshold`가 있고 `price >= free_threshold`면 0, 아니면 `base_fee`
- **도서산간은 총액에 넣지 않는다.** 배송지를 모르는 시점이므로 표기만 한다.
- `origin == "default"`면 UI에 "배송비 추정" 배지 필수.

### 4.4 Verdict — LLM 출력

```
idx                    입력 배열 인덱스 (1:1, 순서 유지)
is_same_product        bool
extraction_confidence  float 0~1
country                KR | GLOBAL
brand
product_name
strength_value         500
strength_unit          억CFU | Billion | 조CFU | IU | mg
strength_type          guaranteed | input | unknown
units_per_pack         30
pack_unit              포 | 정 | 캡슐 | g
pack_count             2
total_units            60          ← 코드가 재검증
overseas_signal        판단 근거 키워드 | null
exclude_reason         enum | null
```

`exclude_reason` enum (자유 텍스트 금지 — 집계·개선 불가):
```
different_product | different_strength | refill | sample
used | refurbished | subscription_intro | quantity_unknown
```

### 4.5 Offer — 최종 노출

```
source / mall / seller / title / url / image
country                KR | GLOBAL
is_parallel_import     bool
formulation_differs    bool        ← 국내판 함량 상이
brand / product_name
strength               "500억 CFU"      (표시용)
variant                "30포 x 2박스"   (표시용)
total_units            60
price / shipping_fee / total_cost / unit_price
shipping_days
customs_note           string | null
match_score            0~100  (결정론적, 사용자 노출)
extraction_confidence  0~1    (내부용)
needs_review           bool
flags[]                ["배송비추정", "이상치의심", ...]
```

---

## 5. LLM 사양

### 5.1 호출 ①: 후보 그룹핑

- 입력: RawOffer 제목 20~50개
- 출력: 대표 상품 3~5개 (brand / product_name / strength / 대표 variant)
- 목적: "락토핏" 같은 모호한 검색어에서 골드·코어·생유산균·키즈를 분리
- **Reference 캐시 히트 시 이 호출을 건너뛴다.** 인기 검색어의 반복 비용을 막는다.

### 5.2 호출 ②: 정규화·판정

tool-use로 스키마 강제:

```python
tools = [{
    "name": "emit",
    "input_schema": {
        "type": "object",
        "properties": {"results": {"type": "array", "items": VERDICT_SCHEMA}},
        "required": ["results"],
    },
}]
tool_choice = {"type": "tool", "name": "emit"}
```

프롬프트 필수 지시:
- 제목에 근거가 없으면 추측 금지, `null` + `exclude_reason: quantity_unknown`
- `strength_type` 판정: "보장균수" → guaranteed / "투입균수" → input / 미표기 → unknown
- 입력 항목과 1:1 대응, `idx` 유지

---

## 6. 코드 계산 규칙

### 6.1 strength 정규화 (⚠️ 최우선 검증 대상)

문자열 비교 금지. **CFU 정수로 환산 후 비교.**

```
억      × 1e8
Billion × 1e9
조      × 1e12
```

**500억 CFU = 50 Billion CFU다. 500 Billion이 아니다.**
(검증: LactoBif 300억 = LactoBif 30 Billion — 실제 제품명과 일치)

이 환산을 틀리면 10배 차이 나는 제품을 동일 상품으로 판정한다.

비교 로직:
```
ref.strength_type == cand.strength_type  and  값 일치   → 동일
어느 한쪽이 unknown                                     → REVIEW (제외 아님)
type 다르고 값 다름 (500 guaranteed vs 5000 input)      → REVIEW
type 같고 값 다름                                       → 제외 (different_strength)
```

### 6.2 match_score (결정론적, 0~100)

```
brand 일치            30
product_name 일치     25
strength 일치         25   (6.1 로직)
pack_unit 일치        10
country 일치          10
```
REVIEW 판정은 해당 항목 배점의 절반.

### 6.3 extraction_confidence (LLM 자기보고 + 감점)

```
final = llm_confidence − Σ penalty

units_per_pack × pack_count ≠ total_units   −0.50
strength_value 추출 실패                     −0.30
unit_price < median × 0.4                    −0.25
```

곱셈 검증이 가장 중요하다. `60정 x 2박스`를 `total_units: 60`으로 뱉는 오류가 실제로 가장 잦고, 단가를 2배 틀리게 만든다.

### 6.4 게이트

```
match_score ≥ 90  and  extraction_confidence ≥ 0.85   → 노출
match_score ≥ 75  or   extraction_confidence ≥ 0.70   → 노출 + "확인 필요" 배지
그 외                                                  → 제외 + 검토 큐 적재
```

### 6.5 중복 제거

```
1차 (동일 리스팅)  (source, mall, total_units, price)
2차 (동일 상품)    (mall, total_units) → 최저 total_cost만
크로스 플랫폼       제거하지 않음
```

**크로스 플랫폼 중복 제거를 하지 않는 이유:**
① 네이버 API는 `mallName` 문자열만 주므로 쿠팡 판매자 ID와 매칭할 키가 없다.
② 같은 셀러라도 채널별 쿠폰·가격이 다르다. 합치면 진짜 최저가를 숨긴다.

### 6.6 이상치

```
med = median(unit_price)
unit_price < med × 0.4  →  extraction_confidence −0.25, flag "이상치의심"
```
제거하지 않고 강등만 한다. 게이트가 판단한다.
용량 다름·리필·샘플·중고는 이상치 로직이 아니라 `exclude_reason`에서 처리한다. 계층이 다르다.

### 6.7 국가 판정 (2단계)

**1단계 — 키워드 룰(코드, 90% 커버):**
`해외직구, 해외배송, 병행수입, 직배송, 관부가세, Global, Overseas, US Warehouse`

**2단계 — LLM 보정:** 룰에 안 걸린 건만 `country` 판정.

전부 LLM에 맡기지 않는 이유는 비용과 결정론이다.

### 6.8 랭킹

```
partition by country
  KR      → unit_price ASC, shipping_days ASC
  GLOBAL  → unit_price ASC
각 Top 5
```

`customs_note`는 카테고리 룰 테이블 조회. 건강기능식품은 목록통관 배제 + 자가사용 수량 기준이 걸리므로 **단정하지 말 것.**
권장 문구: `"통관 시 수량 제한이 적용될 수 있습니다"`
금지 문구: `"관부가세 없음"`

---

## 7. 데이터 소스

| 소스 | 방식 | 우선순위 | 비고 |
|---|---|---|---|
| 네이버 쇼핑 | 공식 검색 API | 1 | 지마켓·옥션·11번가가 `mallName`으로 함께 집계됨 |
| 쿠팡 | 파트너스 API (HMAC-SHA256) | 2 | 제휴 승인 필요 |
| CJ더마켓 | Playwright 크롤링 | 3 | 공식몰 **기준가** 용도. 1일 1~2회 |
| 알리익스프레스 | Affiliate Open Platform | 4 | 신청 시 신분증 제출, 승인 2~3일 |

**G마켓·옥션 직접 연동 불가.** ESM Trading API는 판매자 전용이며 상품 등록/주문 관리용이다. 가격비교용 검색 API가 존재하지 않는다. → 네이버 API로 커버된다.

**보완 크롤링 후보(식품 카테고리):** 컬리, SSG.COM, 홈플러스.
네이버 가격비교에 전부 노출되지 않는 경우가 있다. robots.txt·약관 확인 필수.

---

## 8. 함정 (구현 전 필독)

1. **500억 ≠ 500 Billion.** 6.1 참조. 가장 치명적인 오류.
2. **`total_units` 곱셈 검증 없으면 단가가 2배 틀린다.**
3. **리스트 가격은 최저 옵션가.** 실제 결제가와 다르다. UI에 "최저가"가 아닌 **"참고가"** 표기 권장.
4. **`collected_at` 필수 노출.** 실시간이 아니다.
5. **국내판 리포뮬레이션.** 미국판 5000 IU가 국내판 1000 IU로 나오는 경우 → `formulation_differs` 플래그 + UI 경고. Reference를 나누지 말 것.
6. **정기구독 첫 회차 할인가는 제외.** 지속 가능한 가격이 아니다.
7. 건강기능식품 해외직구는 목록통관 배제 대상. 통관 문구를 단정하지 말 것.

---

## 9. DB 스키마

```
canonical_products   Reference 캐시
offers_raw           collected_at, query, source, payload(JSONB)
offers_normalized    raw_id FK, prompt_version, model, verdict(JSONB)
offers_final         normalized_id FK, 계산 결과, rank, country
review_queue         게이트 탈락 건
```

`prompt_version` 필수. 프롬프트 수정 후 `offers_raw`만 리플레이해 A/B 비교한다.
이게 없으면 개선 여부를 측정할 방법이 없다.

캐시 TTL: 가격 3시간, Reference 30일.

---

## 10. 구현 순서

1. **네이버 API 단독 + 정규화 LLM** — 실제 응답으로 프롬프트 튜닝, 정확도 측정
2. `match_score` / `extraction_confidence` / 게이트 — 검토 큐에 쌓이는 케이스 분석
3. 3계층 저장 + `prompt_version`
4. 국내/해외 분리 랭킹 + UI 탭
5. 쿠팡 파트너스 연동
6. CJ더마켓 기준가
7. 알리익스프레스

**1단계에서 정확도가 안 나오면 소스를 늘리지 말 것.** 소스가 늘수록 오판이 배수로 증가한다.

---

## 11. 미결정

- [ ] 후보 그룹핑 LLM 모델 선정 (Haiku로 충분한지 실측)
- [ ] `strength_type: unknown` 비율이 높을 경우의 폴백 전략
- [ ] 브랜드별 표기 화이트리스트 필요 여부 (LLM만으로 부족할 때)
- [ ] 제휴 링크 치환 시점 (수집 시 vs 노출 시)
- [ ] 검토 큐 수동 확인 UI 필요 여부

---

## 12. 다음 대화 시작 방법

이 문서를 첨부하고 다음과 같이 요청한다.

> 첨부한 명세서 기준으로 1단계(네이버 API + 정규화 LLM)를 구현해줘.
> 네이버 API 실제 응답 샘플은 여기 있어: [샘플 붙여넣기]
