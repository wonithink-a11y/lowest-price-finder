import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildAndScore, BuildItem } from "@/lib/pipeline/build";
import { dedupeOffers } from "@/lib/pipeline/dedupe";
import { partitionAndRank } from "@/lib/pipeline/rank";
import { RawOffer, Reference, Verdict } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { referenceId, normalizedIds } = (await req.json()) as { referenceId: string; normalizedIds: string[] };

  const canonical = await prisma.canonicalProduct.findUnique({ where: { id: referenceId } });
  if (!canonical) return NextResponse.json({ error: "Reference를 찾을 수 없습니다." }, { status: 404 });

  const reference: Reference = {
    id: canonical.id,
    brand: canonical.brand,
    product_name: canonical.productName,
    strength_cfu: Number(canonical.strengthCfu),
    strength_unit: canonical.strengthUnit as Reference["strength_unit"],
    strength_type: canonical.strengthType as Reference["strength_type"],
    category: canonical.category as Reference["category"],
    aliases: JSON.parse(canonical.aliases),
  };

  const normalizedRows = await prisma.offerNormalized.findMany({
    where: { id: { in: normalizedIds } },
    include: { raw: true },
  });

  const items: BuildItem[] = normalizedRows.map((n) => ({
    normalizedId: n.id,
    raw: JSON.parse(n.raw.payload) as RawOffer,
    verdict: JSON.parse(n.verdict) as Verdict,
    collectedAt: n.raw.collectedAt,
  }));

  const { exposed, rejected, normalizedIdOf } = buildAndScore(reference, items);
  const deduped = dedupeOffers(exposed);
  const partitioned = partitionAndRank(deduped);

  await prisma.$transaction([
    ...rejected.map((r) =>
      prisma.reviewQueue.create({ data: { normalizedId: r.normalizedId, reason: r.reason } })
    ),
    ...(["KR", "GLOBAL"] as const).flatMap((country) =>
      partitioned[country].map((offer, idx) => {
        return prisma.offerFinal.create({
          data: {
            normalizedId: normalizedIdOf.get(offer)!,
            country,
            rank: idx + 1,
            source: offer.source,
            mall: offer.mall,
            seller: offer.seller,
            title: offer.title,
            url: offer.url,
            image: offer.image,
            isParallelImport: offer.is_parallel_import,
            formulationDiffers: offer.formulation_differs,
            brand: offer.brand,
            productName: offer.product_name,
            strength: offer.strength,
            variant: offer.variant,
            totalUnits: offer.total_units,
            price: offer.price,
            shippingFee: offer.shipping_fee,
            totalCost: offer.total_cost,
            unitPrice: offer.unit_price,
            shippingDays: offer.shipping_days,
            customsNote: offer.customs_note,
            matchScore: offer.match_score,
            extractionConfidence: offer.extraction_confidence,
            needsReview: offer.needs_review,
            flags: JSON.stringify(offer.flags),
            collectedAt: new Date(offer.collected_at),
          },
        });
      })
    ),
  ]);

  return NextResponse.json({ KR: partitioned.KR, GLOBAL: partitioned.GLOBAL, rejectedCount: rejected.length });
}
