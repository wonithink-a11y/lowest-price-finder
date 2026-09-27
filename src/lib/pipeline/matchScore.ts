import { StrengthComparison } from "./strength";

export interface MatchScoreInput {
  brandMatch: boolean;
  productNameMatch: boolean;
  strengthComparison: StrengthComparison; // 6.1 결과
  packUnitMatch: boolean;
  // Reference에는 country가 없다(4.1, 국가 중립). 여기서 "country 일치"는
  // 6.7의 1단계 키워드 룰 판정과 2단계 LLM 판정이 서로 일치하는지를 의미한다.
  // 키워드 룰만으로 확정된 경우(LLM 미호출)는 자동으로 일치 처리한다.
  countryAgreement: boolean;
}

const WEIGHTS = {
  brand: 30,
  productName: 25,
  strength: 25,
  packUnit: 10,
  country: 10,
} as const;

// REVIEW 판정은 해당 항목 배점의 절반.
function strengthScore(cmp: StrengthComparison): number {
  if (cmp === "match") return WEIGHTS.strength;
  if (cmp === "review") return WEIGHTS.strength / 2;
  return 0;
}

export function computeMatchScore(input: MatchScoreInput): number {
  let score = 0;
  score += input.brandMatch ? WEIGHTS.brand : 0;
  score += input.productNameMatch ? WEIGHTS.productName : 0;
  score += strengthScore(input.strengthComparison);
  score += input.packUnitMatch ? WEIGHTS.packUnit : 0;
  score += input.countryAgreement ? WEIGHTS.country : 0;
  return Math.round(score);
}
