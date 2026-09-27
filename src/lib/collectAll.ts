import { RawOffer, Source } from "@/lib/types";
import { fetchNaverOffers } from "@/lib/sources/naver";
import { fetchCoupangOffers } from "@/lib/sources/coupang";
import { fetchAliexpressOffers } from "@/lib/sources/aliexpress";
import { fetchCjThemarketOffers } from "@/lib/sources/cjthemarket";

export interface CollectResult {
  offers: RawOffer[];
  errors: Partial<Record<Source, string>>; // 승인 대기 등으로 미설정된 소스는 에러로 기록하고 건너뜀
}

// 1단계에서 정확도가 안 나오면 소스를 늘리지 말 것 (10장) — 그래도 이 함수 자체는
// 소스별 실패를 격리해 항상 병렬로 전부 시도한다. 실제로 무엇을 쓸지는 호출부 판단.
export async function collectAll(query: string): Promise<CollectResult> {
  const [naver, coupang, aliexpress, cj] = await Promise.allSettled([
    fetchNaverOffers(query),
    fetchCoupangOffers(query),
    fetchAliexpressOffers(query),
    fetchCjThemarketOffers(query),
  ]);

  const offers: RawOffer[] = [];
  const errors: Partial<Record<Source, string>> = {};

  const collect = (result: PromiseSettledResult<RawOffer[]>, source: Source) => {
    if (result.status === "fulfilled") {
      offers.push(...result.value);
    } else {
      errors[source] = result.reason instanceof Error ? result.reason.message : String(result.reason);
    }
  };

  collect(naver, "naver");
  collect(coupang, "coupang");
  collect(aliexpress, "aliexpress");
  collect(cj, "cj_themarket");

  return { offers, errors };
}
