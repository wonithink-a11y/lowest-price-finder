import { getAnthropicClient, GROUPING_MODEL } from "./client";
import { CandidateCard } from "@/lib/types";

const CANDIDATE_SCHEMA = {
  type: "object" as const,
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          brand: { type: "string" },
          product_name: { type: "string" },
          strength_value: { type: ["number", "null"] },
          strength_unit: { type: ["string", "null"], enum: ["억CFU", "Billion", "조CFU", "IU", "mg", null] },
          strength_type: { type: "string", enum: ["guaranteed", "input", "unknown"] },
          category: { type: "string", enum: ["probiotics", "vitamin", "omega3", "general"] },
          representative_variant: { type: "string", description: "대표 구성, 예: '30포'" },
          strength_display: { type: "string", description: "표시용 문자열, 예: '500억 CFU'" },
        },
        required: [
          "brand",
          "product_name",
          "strength_value",
          "strength_unit",
          "strength_type",
          "category",
          "representative_variant",
          "strength_display",
        ],
      },
    },
  },
  required: ["candidates"],
};

// Reference 캐시 히트 시 이 호출을 건너뛴다 (인기 검색어 반복 비용 방지) — 호출부(route)에서 처리.
export async function groupCandidates(titles: string[]): Promise<CandidateCard[]> {
  const anthropic = getAnthropicClient();

  const res = await anthropic.messages.create({
    model: GROUPING_MODEL,
    max_tokens: 1024,
    tools: [{ name: "emit_candidates", input_schema: CANDIDATE_SCHEMA }],
    tool_choice: { type: "tool", name: "emit_candidates" },
    messages: [
      {
        role: "user",
        content:
          "다음은 한 검색어로 수집된 쇼핑몰 상품 제목 목록이다. " +
          "브랜드/상품명/함량이 실질적으로 다른 대표 상품 3~5개로 그룹핑하라. " +
          "예: '락토핏' 검색 시 골드/코어/생유산균/키즈는 서로 다른 대표 상품이다.\n\n" +
          titles.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("그룹핑 LLM이 tool_use를 반환하지 않았습니다.");
  const input = toolUse.input as { candidates: CandidateCard[] };
  return input.candidates;
}
