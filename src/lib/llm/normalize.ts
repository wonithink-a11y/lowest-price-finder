import { getAnthropicClient, NORMALIZE_MODEL } from "./client";
import { Reference, Verdict, RawOffer } from "@/lib/types";

// 프롬프트 수정 시 반드시 올려서 offers_normalized.promptVersion에 기록한다.
// 이게 없으면 리플레이 A/B 비교로 개선 여부를 측정할 방법이 없다 (9장).
export const PROMPT_VERSION = "normalize-v1";

// ⚠️ price 필드를 절대 넣지 않는다. LLM 출력 스키마에서 숫자 계산 경로 자체를 차단한다 (3장 원칙 2).
const VERDICT_SCHEMA = {
  type: "object" as const,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          idx: { type: "integer" },
          is_same_product: { type: "boolean" },
          extraction_confidence: { type: "number", minimum: 0, maximum: 1 },
          country: { type: "string", enum: ["KR", "GLOBAL"] },
          brand: { type: ["string", "null"] },
          product_name: { type: ["string", "null"] },
          strength_value: { type: ["number", "null"] },
          strength_unit: { type: ["string", "null"], enum: ["억CFU", "Billion", "조CFU", "IU", "mg", null] },
          strength_type: { type: "string", enum: ["guaranteed", "input", "unknown"] },
          units_per_pack: { type: ["integer", "null"] },
          pack_unit: { type: ["string", "null"] },
          pack_count: { type: ["integer", "null"] },
          total_units: { type: ["integer", "null"] },
          overseas_signal: { type: ["string", "null"] },
          exclude_reason: {
            type: ["string", "null"],
            enum: [
              "different_product",
              "different_strength",
              "refill",
              "sample",
              "used",
              "refurbished",
              "subscription_intro",
              "quantity_unknown",
              null,
            ],
          },
        },
        required: [
          "idx",
          "is_same_product",
          "extraction_confidence",
          "country",
          "brand",
          "product_name",
          "strength_value",
          "strength_unit",
          "strength_type",
          "units_per_pack",
          "pack_unit",
          "pack_count",
          "total_units",
          "overseas_signal",
          "exclude_reason",
        ],
      },
    },
  },
  required: ["results"],
};

function buildPrompt(reference: Reference, offers: RawOffer[]): string {
  const list = offers.map((o, i) => `${i}. [${o.source}/${o.mall}] ${o.title}`).join("\n");
  return `기준 상품(Reference): ${reference.brand} ${reference.product_name} (${reference.strength_cfu} CFU, ${reference.strength_type})

아래 각 상품 제목을 기준 상품과 비교해 판정하라. 반드시 지켜야 할 규칙:
- 제목에 근거가 없는 항목은 절대 추측하지 말고 null로 두고, quantity_unknown 등 적절한 exclude_reason을 부여하라.
- strength_type 판정: 제목에 "보장균수"가 있으면 guaranteed, "투입균수"가 있으면 input, 표기가 없으면 unknown.
- 입력 순서(idx)를 그대로 유지하고 모든 항목에 대해 1:1로 결과를 내라. 항목을 누락하거나 합치지 마라.
- price/가격 관련 숫자는 절대 출력하지 마라. 이 스키마에는 가격 필드가 없다.

상품 목록:
${list}`;
}

// verdict 1건 ≈ 100~150 출력 토큰. 50건을 한 번에 보내면 출력이 잘려 tool_use JSON이 깨지고,
// 서버리스 함수 시간 제한에도 걸리기 쉽다 → 청크로 나눠 병렬 호출한다.
const CHUNK_SIZE = 20;

async function normalizeChunk(reference: Reference, offers: RawOffer[]): Promise<Verdict[]> {
  const anthropic = getAnthropicClient();

  const res = await anthropic.messages.create({
    model: NORMALIZE_MODEL,
    max_tokens: 8192,
    tools: [{ name: "emit", input_schema: VERDICT_SCHEMA }],
    tool_choice: { type: "tool", name: "emit" },
    messages: [{ role: "user", content: buildPrompt(reference, offers) }],
  });

  if (res.stop_reason === "max_tokens") throw new Error("정규화 LLM 출력이 max_tokens에서 잘렸습니다.");
  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("정규화 LLM이 tool_use를 반환하지 않았습니다.");
  const input = toolUse.input as { results: Verdict[] };
  // 범위 밖 idx·중복 idx는 버린다 (1:1 매칭이 깨진 결과로 엉뚱한 raw에 붙는 것 방지).
  const seen = new Set<number>();
  return input.results.filter((v) => {
    if (!Number.isInteger(v.idx) || v.idx < 0 || v.idx >= offers.length || seen.has(v.idx)) return false;
    seen.add(v.idx);
    return true;
  });
}

// 반환 Verdict.idx는 전체 offers 배열 기준 인덱스다.
export async function normalizeOffers(reference: Reference, offers: RawOffer[]): Promise<Verdict[]> {
  const chunks: RawOffer[][] = [];
  for (let i = 0; i < offers.length; i += CHUNK_SIZE) chunks.push(offers.slice(i, i + CHUNK_SIZE));

  const results = await Promise.all(chunks.map((c) => normalizeChunk(reference, c)));
  return results.flatMap((verdicts, ci) => verdicts.map((v) => ({ ...v, idx: v.idx + ci * CHUNK_SIZE })));
}
