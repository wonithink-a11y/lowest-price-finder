export type GateResult =
  | { decision: "expose"; needsReview: false }
  | { decision: "expose"; needsReview: true } // "확인 필요" 배지
  | { decision: "reject" }; // offers_final 미노출, review_queue 적재

// match_score ≥ 90 and extraction_confidence ≥ 0.85   → 노출
// match_score ≥ 75 or  extraction_confidence ≥ 0.70   → 노출 + "확인 필요" 배지
// 그 외                                                → 제외 + 검토 큐 적재
export function applyGate(matchScore: number, extractionConfidence: number): GateResult {
  if (matchScore >= 90 && extractionConfidence >= 0.85) {
    return { decision: "expose", needsReview: false };
  }
  if (matchScore >= 75 || extractionConfidence >= 0.7) {
    return { decision: "expose", needsReview: true };
  }
  return { decision: "reject" };
}
