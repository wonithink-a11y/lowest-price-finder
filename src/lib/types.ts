// 명세서 4장 데이터 계약. 필드명·타입을 문서와 1:1로 맞춘다.

export type Source = "naver" | "coupang" | "aliexpress" | "cj_themarket";
export type Country = "KR" | "GLOBAL";
export type StrengthType = "guaranteed" | "input" | "unknown";
export type StrengthUnit = "억CFU" | "Billion" | "조CFU" | "IU" | "mg";
export type Category = "probiotics" | "vitamin" | "omega3" | "general";
export type ShippingOrigin = "api" | "table" | "default";

export type ExcludeReason =
  | "different_product"
  | "different_strength"
  | "refill"
  | "sample"
  | "used"
  | "refurbished"
  | "subscription_intro"
  | "quantity_unknown";

// 4.3 ShippingPolicy
export interface ShippingPolicy {
  base_fee: number;
  free_threshold: number | null;
  island_surcharge: number;
  is_bundled: boolean;
  estimated_days: number | null;
  origin: ShippingOrigin;
}

// 4.2 RawOffer — 수집기 출력, 가공 금지
export interface RawOffer {
  source: Source;
  mall: string;
  seller: string;
  title: string;
  price: number;
  url: string;
  product_id: string;
  image: string | null;
  brand: string | null;
  shipping: ShippingPolicy | null;
  raw: Record<string, unknown>;
}

// 4.1 Reference — 국가 중립 상품 정체성
export interface Reference {
  id: string;
  brand: string;
  product_name: string;
  // 4.1 원문의 "정규화된 정수"는 문자열이 아닌 파싱된 숫자라는 뜻으로 해석했다.
  // strength_unit 기준 원본 값(예: 500 + "억CFU")을 그대로 저장한다.
  // compareStrength가 CFU 변환을 양쪽 대칭으로 수행하므로, 여기서 미리 변환해두면
  // toCfu()가 두 번 적용되어 값이 어긋난다 — 반드시 원본 스케일로 저장할 것.
  strength_cfu: number;
  // ⚠️ 명세서 4.1 원문에는 없는 필드. IU/mg 단위 상품(vitamin/omega3)은 strength_cfu만으로
  // 6.1 비교 로직(단위 체계 확인)을 수행할 수 없어 추가했다. 최초 검증 대상(CJ웰케어 바이오코어)은
  // CFU 계열이라 명세서에서 생략된 것으로 보고, 다른 카테고리 지원을 위해 보강함.
  strength_unit: StrengthUnit;
  strength_type: StrengthType;
  category: Category;
  aliases: string[];
}

// 4.4 Verdict — LLM 출력 (price 필드 없음 — 절대 추가하지 말 것)
export interface Verdict {
  idx: number;
  is_same_product: boolean;
  extraction_confidence: number;
  country: Country;
  brand: string | null;
  product_name: string | null;
  strength_value: number | null;
  strength_unit: "억CFU" | "Billion" | "조CFU" | "IU" | "mg" | null;
  strength_type: StrengthType;
  units_per_pack: number | null;
  pack_unit: string | null;
  pack_count: number | null;
  total_units: number | null; // 코드가 재검증 (units_per_pack * pack_count)
  overseas_signal: string | null;
  exclude_reason: ExcludeReason | null;
}

// 4.5 Offer — 최종 노출
export interface Offer {
  source: Source;
  mall: string;
  seller: string;
  title: string;
  url: string;
  image: string | null;
  country: Country;
  is_parallel_import: boolean;
  formulation_differs: boolean;
  brand: string;
  product_name: string;
  strength: string;
  variant: string;
  total_units: number;
  price: number;
  shipping_fee: number;
  total_cost: number;
  unit_price: number;
  shipping_days: number | null;
  customs_note: string | null;
  match_score: number;
  extraction_confidence: number;
  needs_review: boolean;
  flags: string[];
  collected_at: string;
}

export interface CandidateCard {
  brand: string;
  product_name: string;
  strength_value: number | null;
  strength_unit: StrengthUnit | null;
  strength_type: StrengthType;
  category: Category;
  representative_variant: string;
  strength_display: string; // UI 카드용 표시 문자열, 예: "500억 CFU"
}
