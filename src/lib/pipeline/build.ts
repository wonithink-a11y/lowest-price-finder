import { Offer, RawOffer, Reference, Verdict } from "@/lib/types";
import { compareStrength } from "./strength";
import { computeShipping } from "./shipping";
import { computeMatchScore } from "./matchScore";
import { computeExtractionConfidence, recomputeTotalUnits } from "./confidence";
import { applyGate } from "./gate";
import { median, isPriceOutlier, OUTLIER_FLAG } from "./outliers";
import { detectCountryByKeyword } from "./country";
import { getCustomsNote } from "./rank";
import { formatStrength } from "./strength";

export interface BuildItem {
  normalizedId: string;
  raw: RawOffer;
  verdict: Verdict;
  collectedAt: Date; // offers_raw.collectedAt — 8장 4: 수집 시각 필수 노출
}

export interface RejectedItem {
  normalizedId: string;
  reason: string;
}

export interface BuildResult {
  exposed: Offer[];
  rejected: RejectedItem[];
  normalizedIdOf: Map<Offer, string>; // offers_final 저장 시 FK 역참조용 (URL 매칭은 중복 URL에서 깨짐)
}

interface Survivor {
  normalizedId: string;
  raw: RawOffer;
  verdict: Verdict;
  collectedAt: Date;
  totalUnits: number;
  totalUnitsMismatch: boolean;
  unitPrice: number;
  shippingFee: number;
  totalCost: number;
  shippingDays: number | null;
  needsShippingBadge: boolean;
}

export function buildAndScore(reference: Reference, items: BuildItem[]): BuildResult {
  const rejected: RejectedItem[] = [];
  const survivors: Survivor[] = [];

  // Step A: exclude_reason이 있거나 다른 상품으로 판정된 건은 즉시 검토 큐로.
  for (const item of items) {
    if (!item.verdict.is_same_product || item.verdict.exclude_reason) {
      rejected.push({ normalizedId: item.normalizedId, reason: item.verdict.exclude_reason ?? "different_product" });
      continue;
    }

    // Step B: total_units 재검증 (6.3) — LLM 값을 신뢰하지 않고 코드가 다시 곱한다.
    const recomputed = recomputeTotalUnits(item.verdict.units_per_pack, item.verdict.pack_count);
    const totalUnits = recomputed ?? item.verdict.total_units;
    if (!totalUnits || totalUnits <= 0) {
      rejected.push({ normalizedId: item.normalizedId, reason: "quantity_unknown" });
      continue;
    }
    const totalUnitsMismatch =
      recomputed !== null && item.verdict.total_units !== null && recomputed !== item.verdict.total_units;

    const shipping = computeShipping(item.raw.price, item.raw.shipping);
    const unitPrice = shipping.totalCost / totalUnits;

    survivors.push({
      normalizedId: item.normalizedId,
      raw: item.raw,
      verdict: item.verdict,
      collectedAt: item.collectedAt,
      totalUnits,
      totalUnitsMismatch,
      unitPrice,
      shippingFee: shipping.shippingFee,
      totalCost: shipping.totalCost,
      shippingDays: shipping.shippingDays,
      needsShippingBadge: shipping.needsShippingBadge,
    });
  }

  // 6.6: median은 이 배치(같은 Reference로 정규화된 건들) 전체 unit_price 기준.
  const med = median(survivors.map((s) => s.unitPrice));

  const exposed: Offer[] = [];
  const normalizedIdOf = new Map<Offer, string>();

  for (const s of survivors) {
    const strengthExtractionFailed = s.verdict.strength_value === null || s.verdict.strength_unit === null;
    const strengthComparison = strengthExtractionFailed
      ? "review"
      : compareStrength(
          { value: reference.strength_cfu, unit: reference.strength_unit, type: reference.strength_type },
          { value: s.verdict.strength_value!, unit: s.verdict.strength_unit!, type: s.verdict.strength_type }
        );

    if (strengthComparison === "exclude") {
      rejected.push({ normalizedId: s.normalizedId, reason: "different_strength" });
      continue;
    }

    const priceIsOutlier = med > 0 && isPriceOutlier(s.unitPrice, med);

    const extractionConfidence = computeExtractionConfidence({
      llmConfidence: s.verdict.extraction_confidence,
      totalUnitsMismatch: s.totalUnitsMismatch,
      strengthExtractionFailed,
      isPriceOutlier: priceIsOutlier,
    });

    // 6.7 국가 판정 2단계: 룰이 먼저 확정하면 LLM country와 무관하게 룰을 우선하고 "일치"로 취급.
    const ruleCountry = detectCountryByKeyword(s.raw.title, s.raw.source);
    const finalCountry = ruleCountry ?? s.verdict.country;
    const countryAgreement = ruleCountry === null ? true : ruleCountry === s.verdict.country;

    const matchScore = computeMatchScore({
      brandMatch: normalizeStr(s.verdict.brand) === normalizeStr(reference.brand),
      productNameMatch:
        normalizeStr(s.verdict.product_name) === normalizeStr(reference.product_name) ||
        reference.aliases.some((a) => normalizeStr(a) === normalizeStr(s.verdict.product_name)),
      strengthComparison,
      packUnitMatch: true, // pack_unit은 Reference에 저장되지 않아(4.1) 그룹 내 비교 대상이 없음 — 항상 만점 처리
      countryAgreement,
    });

    const gate = applyGate(matchScore, extractionConfidence);
    if (gate.decision === "reject") {
      rejected.push({ normalizedId: s.normalizedId, reason: "gate_rejected" });
      continue;
    }

    const flags: string[] = [];
    if (s.needsShippingBadge) flags.push("배송비추정");
    if (priceIsOutlier) flags.push(OUTLIER_FLAG);
    if (gate.needsReview) flags.push("확인필요");

    const isParallelImport =
      finalCountry === "GLOBAL" && (s.verdict.overseas_signal?.includes("병행수입") ?? false);
    const formulationDiffers = strengthComparison === "review" && !strengthExtractionFailed;

    const offer: Offer = {
      source: s.raw.source,
      mall: s.raw.mall,
      seller: s.raw.seller,
      title: s.raw.title,
      url: s.raw.url,
      image: s.raw.image,
      country: finalCountry,
      is_parallel_import: isParallelImport,
      formulation_differs: formulationDiffers,
      brand: s.verdict.brand ?? reference.brand,
      product_name: s.verdict.product_name ?? reference.product_name,
      strength:
        s.verdict.strength_value !== null && s.verdict.strength_unit !== null
          ? formatStrength(s.verdict.strength_value, s.verdict.strength_unit)
          : "확인 필요",
      variant: formatVariant(s.verdict.units_per_pack, s.verdict.pack_unit, s.verdict.pack_count, s.totalUnits),
      pack_unit: s.verdict.pack_unit,
      total_units: s.totalUnits,
      price: s.raw.price,
      shipping_fee: s.shippingFee,
      total_cost: s.totalCost,
      unit_price: Math.round(s.unitPrice * 100) / 100,
      shipping_days: s.shippingDays,
      customs_note: getCustomsNote(reference.category, finalCountry),
      match_score: matchScore,
      extraction_confidence: Math.round(extractionConfidence * 100) / 100,
      needs_review: gate.needsReview,
      flags,
      collected_at: s.collectedAt.toISOString(),
    };
    exposed.push(offer);
    normalizedIdOf.set(offer, s.normalizedId);
  }

  return { exposed, rejected, normalizedIdOf };
}

// 표시용 구성: "30포 × 1", "30포 × 4 = 120포" (총수량은 코드가 재계산한 값)
function formatVariant(upp: number | null, unit: string | null, count: number | null, total: number): string {
  const u = unit ?? "";
  const n = count ?? 1;
  const base = `${upp ?? "?"}${u} × ${n}`;
  return n > 1 ? `${base} = ${total}${u}` : base;
}

function normalizeStr(v: string | null): string {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, "");
}
