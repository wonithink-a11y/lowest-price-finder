const PENALTY = {
  totalUnitsMismatch: 0.5, // units_per_pack × pack_count ≠ total_units — 가장 잦은 오류, 단가를 2배 틀리게 만든다
  strengthExtractionFailed: 0.3,
  outlierPrice: 0.25, // unit_price < median × 0.4
} as const;

export interface ConfidenceInput {
  llmConfidence: number;
  totalUnitsMismatch: boolean;
  strengthExtractionFailed: boolean;
  isPriceOutlier: boolean; // unit_price < median * 0.4 (6.6과 공유하는 판정)
}

export function computeExtractionConfidence(input: ConfidenceInput): number {
  let score = input.llmConfidence;
  if (input.totalUnitsMismatch) score -= PENALTY.totalUnitsMismatch;
  if (input.strengthExtractionFailed) score -= PENALTY.strengthExtractionFailed;
  if (input.isPriceOutlier) score -= PENALTY.outlierPrice;
  return Math.max(0, Math.min(1, score));
}

// units_per_pack × pack_count ≠ total_units 검증. total_units는 이 값으로 재계산해 사용한다(LLM 값을 신뢰하지 않음).
export function recomputeTotalUnits(unitsPerPack: number | null, packCount: number | null): number | null {
  if (unitsPerPack === null || packCount === null) return null;
  return unitsPerPack * packCount;
}
