import { Offer } from "@/lib/types";

// 1차: 동일 리스팅 (source, mall, total_units, price) — 완전 동일 건 제거
// 2차: 동일 상품 (mall, total_units) — 같은 몰 내 최저 total_cost만 남김
// 크로스 플랫폼(다른 mall)은 절대 합치지 않는다: mallName만으로는 판매자 매칭 불가하고,
// 같은 셀러라도 채널별 쿠폰가가 달라 합치면 진짜 최저가를 숨기게 된다.
export function dedupeOffers(offers: Offer[]): Offer[] {
  const stage1 = new Map<string, Offer>();
  for (const o of offers) {
    const key = `${o.source}|${o.mall}|${o.total_units}|${o.price}`;
    if (!stage1.has(key)) stage1.set(key, o);
  }

  const stage2 = new Map<string, Offer>();
  for (const o of stage1.values()) {
    const key = `${o.mall}|${o.total_units}`;
    const existing = stage2.get(key);
    if (!existing || o.total_cost < existing.total_cost) {
      stage2.set(key, o);
    }
  }

  return [...stage2.values()];
}
