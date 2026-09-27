import { StrengthType, StrengthUnit } from "@/lib/types";

// ⚠️ 6.1 최우선 검증 대상. 500억 CFU = 50 Billion CFU다. 500 Billion이 아니다.
// 검증: LactoBif 300억 = LactoBif 30 Billion (실제 제품명과 일치해야 함)
const CFU_MULTIPLIER: Record<string, number> = {
  "억CFU": 1e8,
  Billion: 1e9,
  조CFU: 1e12,
};

function isCfuUnit(unit: StrengthUnit): boolean {
  return unit === "억CFU" || unit === "Billion" || unit === "조CFU";
}

// CFU 계열 단위만 정수로 환산 가능. IU/mg는 문자열 비교 금지 원칙에 따라 변환하지 않고 원값 그대로 비교.
export function toCfu(value: number, unit: StrengthUnit): number | null {
  if (!isCfuUnit(unit)) return null;
  return value * CFU_MULTIPLIER[unit];
}

export type StrengthComparison = "match" | "review" | "exclude";

export interface StrengthInput {
  value: number;
  unit: StrengthUnit;
  type: StrengthType;
}

// 6.1 비교 로직:
// - 어느 한쪽이 unknown                                  → review (제외 아님)
// - type 같고 CFU 환산값(또는 동일 단위 원값) 일치         → match
// - type 같고 값 다름                                     → exclude (different_strength)
// - type 다름 (예: 500 guaranteed vs 5000 input)          → review
// - 단위 체계 자체가 달라 비교 불가 (CFU vs IU 등)         → exclude
export function compareStrength(ref: StrengthInput, cand: StrengthInput): StrengthComparison {
  if (ref.type === "unknown" || cand.type === "unknown") return "review";

  let valuesEqual: boolean;
  if (isCfuUnit(ref.unit) && isCfuUnit(cand.unit)) {
    const refCfu = toCfu(ref.value, ref.unit);
    const candCfu = toCfu(cand.value, cand.unit);
    valuesEqual = refCfu === candCfu;
  } else if (ref.unit === cand.unit) {
    valuesEqual = ref.value === cand.value;
  } else {
    return "exclude"; // 단위 체계 불일치는 비교 불가 → 다른 상품 취급
  }

  if (ref.type === cand.type) {
    return valuesEqual ? "match" : "exclude";
  }
  return "review";
}

// Offer.strength 표시용 문자열 (예: "500억 CFU", "300조 CFU", "500 Billion CFU", "1000 IU")
export function formatStrength(value: number, unit: StrengthUnit): string {
  switch (unit) {
    case "억CFU":
      return `${value}억 CFU`;
    case "조CFU":
      return `${value}조 CFU`;
    case "Billion":
      return `${value} Billion CFU`;
    default:
      return `${value} ${unit}`;
  }
}
