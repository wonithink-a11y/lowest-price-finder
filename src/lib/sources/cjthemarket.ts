import { prisma } from "@/lib/db";
import { RawOffer } from "@/lib/types";

// CJ더마켓은 실시간 API가 없다 (Playwright 크롤링, 1일 1~2회 — 7장).
// 이 함수는 scripts/crawl-cj-themarket.ts(GitHub Actions)가 DB에 미리 채워둔 캐시를 읽기만 한다.
// 서버리스 런타임은 파일시스템에 쓸 수 없으므로 파일 캐시 대신 DB(CjThemarketCache)를 사용한다.
// 공식몰 "기준가" 용도이므로 캐시가 없어도 파이프라인 전체를 막지 않고 빈 배열을 반환한다.
export async function fetchCjThemarketOffers(query: string): Promise<RawOffer[]> {
  try {
    const entry = await prisma.cjThemarketCache.findUnique({ where: { query } });
    return entry ? (JSON.parse(entry.offers) as RawOffer[]) : [];
  } catch {
    return []; // 캐시 없음 = 아직 크롤링 안 됨. 에러로 전체 파이프라인을 막지 않는다.
  }
}
