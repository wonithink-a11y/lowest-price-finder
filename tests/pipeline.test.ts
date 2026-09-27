// 명세서 8장 함정 회귀 테스트. 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareStrength, toCfu } from "@/lib/pipeline/strength";
import { buildAndScore, BuildItem } from "@/lib/pipeline/build";
import { dedupeOffers } from "@/lib/pipeline/dedupe";
import { partitionAndRank } from "@/lib/pipeline/rank";
import { applyGate } from "@/lib/pipeline/gate";
import { RawOffer, Reference, Verdict } from "@/lib/types";

test("함정1: 500억 CFU = 50 Billion (≠ 500 Billion)", () => {
  assert.equal(toCfu(500, "억CFU"), toCfu(50, "Billion"));
  assert.notEqual(toCfu(500, "억CFU"), toCfu(500, "Billion"));
  assert.equal(toCfu(300, "억CFU"), toCfu(30, "Billion")); // LactoBif 300억 = 30 Billion
});

test("6.1 strength 비교 규칙", () => {
  const ref = { value: 500, unit: "억CFU" as const, type: "guaranteed" as const };
  assert.equal(compareStrength(ref, { value: 50, unit: "Billion", type: "guaranteed" }), "match");
  assert.equal(compareStrength(ref, { value: 500, unit: "Billion", type: "guaranteed" }), "exclude");
  assert.equal(compareStrength(ref, { value: 500, unit: "억CFU", type: "unknown" }), "review");
  assert.equal(compareStrength(ref, { value: 5000, unit: "억CFU", type: "input" }), "review");
});

test("6.4 게이트", () => {
  assert.deepEqual(applyGate(100, 0.9), { decision: "expose", needsReview: false });
  assert.deepEqual(applyGate(80, 0.5), { decision: "expose", needsReview: true });
  assert.deepEqual(applyGate(60, 0.6), { decision: "reject" });
});

const reference: Reference = {
  id: "ref1",
  brand: "CJ웰케어",
  product_name: "바이오코어 500억 유산균",
  strength_cfu: 500,
  strength_unit: "억CFU",
  strength_type: "guaranteed",
  category: "probiotics",
  aliases: [],
};

function item(id: string, title: string, price: number, v: Partial<Verdict>, mall = "몰A"): BuildItem {
  const raw: RawOffer = {
    source: "naver", mall, seller: mall, title, price, url: `https://x/${id}`,
    product_id: id, image: null, brand: null, shipping: null, raw: {},
  };
  const verdict: Verdict = {
    idx: 0, is_same_product: true, extraction_confidence: 0.95, country: "KR",
    brand: "CJ웰케어", product_name: "바이오코어 500억 유산균",
    strength_value: 500, strength_unit: "억CFU", strength_type: "guaranteed",
    units_per_pack: 30, pack_unit: "포", pack_count: 1, total_units: 30,
    overseas_signal: null, exclude_reason: null, ...v,
  };
  return { normalizedId: id, raw, verdict, collectedAt: new Date("2026-01-01T00:00:00Z") };
}

test("함정2: total_units 곱셈 재검증 + 감점, collected_at은 수집 시각", () => {
  const { exposed, normalizedIdOf } = buildAndScore(reference, [
    item("a", "30포", 19900, {}),
    // LLM이 60포 x 2박스를 total_units: 60으로 잘못 뱉은 경우
    item("b", "60포 x 2박스", 60000, { units_per_pack: 60, pack_count: 2, total_units: 60 }, "몰B"),
  ]);
  const b = exposed.find((o) => normalizedIdOf.get(o) === "b")!;
  assert.equal(b.total_units, 120); // 코드가 다시 곱한 값
  assert.equal(b.unit_price, (60000 + 3000) / 120); // 배송비 미확인 → 기본 3000원
  assert.ok(b.extraction_confidence <= 0.45 + 1e-9); // −0.50 감점
  assert.ok(b.flags.includes("배송비추정"));
  assert.equal(b.collected_at, "2026-01-01T00:00:00.000Z");
});

test("다른 함량/exclude_reason은 검토 큐로, 해외 키워드는 GLOBAL로", () => {
  const { exposed, rejected } = buildAndScore(reference, [
    item("a", "30포", 19900, {}),
    item("c", "500 Billion", 30000, { strength_value: 500, strength_unit: "Billion" }),
    item("d", "정기구독 첫회", 9900, { exclude_reason: "subscription_intro" }),
    item("e", "해외직구 30포", 15000, { country: "GLOBAL" }, "몰E"),
  ]);
  assert.deepEqual(
    rejected.map((r) => [r.normalizedId, r.reason]).sort(),
    [["c", "different_strength"], ["d", "subscription_intro"]]
  );
  const ranked = partitionAndRank(dedupeOffers(exposed));
  assert.equal(ranked.KR.length, 1);
  assert.equal(ranked.GLOBAL.length, 1);
  assert.equal(ranked.GLOBAL[0].customs_note, "통관 시 수량 제한이 적용될 수 있습니다.");
});
