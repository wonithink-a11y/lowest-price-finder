import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeOffers, PROMPT_VERSION } from "@/lib/llm/normalize";
import { NORMALIZE_MODEL } from "@/lib/llm/client";
import { RawOffer, Reference } from "@/lib/types";

// 서버리스 함수 실행 시간 상한 (LLM 호출 포함). Vercel Hobby 최대 60초.
export const maxDuration = 60;

export async function POST(req: Request) {
  const { referenceId, rawOfferIds } = (await req.json()) as { referenceId: string; rawOfferIds: string[] };

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

  const rawRows = await prisma.offerRaw.findMany({ where: { id: { in: rawOfferIds } } });
  const raws = rawRows.map((r) => JSON.parse(r.payload) as RawOffer);

  let verdicts;
  try {
    verdicts = await normalizeOffers(reference, raws);
  } catch (e) {
    return NextResponse.json({ error: `정규화 실패: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  // idx로 원본 rawId와 1:1 매칭 (5.1 프롬프트 필수 지시: 입력 순서 유지. 범위 밖 idx는 normalizeOffers가 걸러냄)
  // Promise.all 병렬 insert는 서버리스 풀러의 작은 커넥션 한도를 고갈시키므로 단일 트랜잭션으로 묶는다.
  const created = await prisma.$transaction(
    verdicts.map((v) => {
      const rawRow = rawRows[v.idx];
      return prisma.offerNormalized.create({
        data: {
          rawId: rawRow.id,
          canonicalId: reference.id,
          promptVersion: PROMPT_VERSION,
          model: NORMALIZE_MODEL,
          verdict: JSON.stringify(v),
        },
      });
    })
  );

  return NextResponse.json({ normalizedIds: created.map((c) => c.id), referenceId: reference.id });
}
