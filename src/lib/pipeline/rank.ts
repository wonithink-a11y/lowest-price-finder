import { Category, Country, Offer } from "@/lib/types";

const TOP_N = 5;

export function partitionAndRank(offers: Offer[]): Record<Country, Offer[]> {
  const kr = offers
    .filter((o) => o.country === "KR")
    .sort((a, b) => a.unit_price - b.unit_price || (a.shipping_days ?? 99) - (b.shipping_days ?? 99))
    .slice(0, TOP_N);

  const global = offers
    .filter((o) => o.country === "GLOBAL")
    .sort((a, b) => a.unit_price - b.unit_price)
    .slice(0, TOP_N);

  return { KR: kr, GLOBAL: global };
}

// 건강기능식품(probiotics/vitamin/omega3)은 목록통관 배제 + 자가사용 수량 기준이 걸리므로
// "관부가세 없음" 같은 단정 문구는 절대 쓰지 않는다. 권장 문구만 노출한다.
const CUSTOMS_NOTE_BY_CATEGORY: Record<Category, string | null> = {
  probiotics: "통관 시 수량 제한이 적용될 수 있습니다.",
  vitamin: "통관 시 수량 제한이 적용될 수 있습니다.",
  omega3: "통관 시 수량 제한이 적용될 수 있습니다.",
  general: null,
};

export function getCustomsNote(category: Category, country: Country): string | null {
  if (country !== "GLOBAL") return null;
  return CUSTOMS_NOTE_BY_CATEGORY[category];
}
