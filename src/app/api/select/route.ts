import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CandidateCard } from "@/lib/types";

// 서버리스 함수 실행 시간 상한 (LLM 호출 포함). Vercel Hobby 최대 60초.
export const maxDuration = 60;

const REFERENCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const { query, chosen } = (await req.json()) as { query: string; chosen: CandidateCard };
  if (!query?.trim() || !chosen) {
    return NextResponse.json({ error: "query와 chosen이 필요합니다." }, { status: 400 });
  }

  const canonical = await prisma.canonicalProduct.create({
    data: {
      brand: chosen.brand,
      productName: chosen.product_name,
      strengthCfu: String(chosen.strength_value ?? 0),
      strengthUnit: chosen.strength_unit ?? "억CFU",
      strengthType: chosen.strength_type,
      category: chosen.category,
      aliases: JSON.stringify([query]),
      expiresAt: new Date(Date.now() + REFERENCE_TTL_MS),
    },
  });

  return NextResponse.json({
    reference: {
      id: canonical.id,
      brand: canonical.brand,
      product_name: canonical.productName,
      strength_cfu: Number(canonical.strengthCfu),
      strength_unit: canonical.strengthUnit,
      strength_type: canonical.strengthType,
      category: canonical.category,
      aliases: [query],
    },
  });
}
