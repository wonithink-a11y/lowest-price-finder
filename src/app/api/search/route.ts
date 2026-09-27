import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectAll } from "@/lib/collectAll";
import { groupCandidates } from "@/lib/llm/grouping";
import { RawOffer } from "@/lib/types";

// 서버리스 함수 실행 시간 상한 (LLM 호출 포함). Vercel Hobby 최대 60초.
export const maxDuration = 60;

const PRICE_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 9장: 가격 캐시 TTL 3시간
const REFERENCE_CACHE_TTL_DAYS = 30;

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });
  }

  // 가격 캐시: 같은 검색어로 3시간 이내 수집한 raw가 있으면 재사용 (API 호출 절약)
  const cutoff = new Date(Date.now() - PRICE_CACHE_TTL_MS);
  let rawRows = await prisma.offerRaw.findMany({
    where: { query, collectedAt: { gte: cutoff } },
  });

  let collectErrors: Record<string, string> = {};
  if (rawRows.length === 0) {
    const { offers, errors } = await collectAll(query);
    collectErrors = errors;
    if (offers.length > 0) {
      await prisma.$transaction(
        offers.map((o) =>
          prisma.offerRaw.create({
            data: { query, source: o.source, payload: JSON.stringify(o) },
          })
        )
      );
      rawRows = await prisma.offerRaw.findMany({ where: { query, collectedAt: { gte: cutoff } } });
    }
  }

  if (rawRows.length === 0) {
    return NextResponse.json(
      { error: "수집된 상품이 없습니다.", sourceErrors: collectErrors },
      { status: 404 }
    );
  }

  const rawOfferIds = rawRows.map((r) => r.id);
  const titles = rawRows.map((r) => (JSON.parse(r.payload) as RawOffer).title);

  // Reference 캐시 히트 확인: alias에 query가 들어있고 만료 전인 것.
  const candidates30d = await prisma.canonicalProduct.findMany({
    where: { expiresAt: { gte: new Date() } },
  });
  const cached = candidates30d.find((c) => (JSON.parse(c.aliases) as string[]).includes(query));

  if (cached) {
    return NextResponse.json({
      cached: true,
      reference: {
        id: cached.id,
        brand: cached.brand,
        product_name: cached.productName,
        strength_cfu: Number(cached.strengthCfu),
        strength_unit: cached.strengthUnit,
        strength_type: cached.strengthType,
        category: cached.category,
        aliases: JSON.parse(cached.aliases),
      },
      rawOfferIds,
      sourceErrors: collectErrors,
    });
  }

  let candidates;
  try {
    candidates = await groupCandidates(titles);
  } catch (e) {
    return NextResponse.json(
      { error: `후보 그룹핑 실패: ${e instanceof Error ? e.message : String(e)}`, sourceErrors: collectErrors },
      { status: 502 }
    );
  }
  return NextResponse.json({
    cached: false,
    candidates,
    rawOfferIds,
    referenceCacheTtlDays: REFERENCE_CACHE_TTL_DAYS,
    sourceErrors: collectErrors,
  });
}
