import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeOffers, PROMPT_VERSION } from "@/lib/llm/normalize";
import { NORMALIZE_MODEL } from "@/lib/llm/client";
import { extractByRules, RULES_MODEL, RULES_VERSION } from "@/lib/pipeline/ruleExtract";
import { RawOffer, Reference, Verdict } from "@/lib/types";

// 서버리스 함수 실행 시간 상한 (LLM 호출 포함). Vercel Hobby 최대 60초.
export const maxDuration = 60;

export interface NormalizeStats {
  cached: number; // 이전에 같은 Reference로 판정한 결과 재사용 (0원)
  rules: number; // 규칙으로 처리 (0원)
  llm: number; // LLM으로 처리 (과금)
  llmFailed: number; // LLM 실패로 제외된 건
}

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

  // 1) 캐시: 같은 raw × 같은 Reference × 현재 규칙/프롬프트 버전으로 이미 판정한 결과가 있으면 재사용.
  //    raw는 가격 캐시 TTL(3시간) 안에서만 재사용되므로, 이 캐시도 사실상 3시간 유효하다.
  const existing = await prisma.offerNormalized.findMany({
    where: {
      rawId: { in: rawRows.map((r) => r.id) },
      canonicalId: reference.id,
      OR: [
        { promptVersion: RULES_VERSION, model: RULES_MODEL },
        { promptVersion: PROMPT_VERSION, model: NORMALIZE_MODEL },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, rawId: true },
  });
  const cachedByRaw = new Map<string, string>();
  for (const e of existing) if (!cachedByRaw.has(e.rawId)) cachedByRaw.set(e.rawId, e.id);

  // 2) 규칙 → 3) 남은 것만 LLM
  const pending = rawRows.filter((r) => !cachedByRaw.has(r.id));
  const ruleResults: Array<{ rawId: string; verdict: Verdict }> = [];
  const forLlm: typeof pending = [];
  for (const row of pending) {
    const v = extractByRules(reference, JSON.parse(row.payload) as RawOffer);
    if (v) ruleResults.push({ rawId: row.id, verdict: { idx: ruleResults.length, ...v } });
    else forLlm.push(row);
  }

  let llmResults: Array<{ rawId: string; verdict: Verdict }> = [];
  let warning: string | null = null;
  if (forLlm.length > 0) {
    try {
      const verdicts = await normalizeOffers(reference, forLlm.map((r) => JSON.parse(r.payload) as RawOffer));
      llmResults = verdicts.map((v) => ({ rawId: forLlm[v.idx].id, verdict: v }));
    } catch (e) {
      // 규칙으로 처리한 결과는 살린다 (API 크레딧 소진 등에서도 부분 결과 제공)
      warning = `AI 분석 실패로 ${forLlm.length}건이 제외되었습니다: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Promise.all 병렬 insert는 서버리스 풀러의 작은 커넥션 한도를 고갈시키므로 단일 트랜잭션으로 묶는다.
  const created = await prisma.$transaction([
    ...ruleResults.map((r) =>
      prisma.offerNormalized.create({
        data: {
          rawId: r.rawId, canonicalId: reference.id,
          promptVersion: RULES_VERSION, model: RULES_MODEL, verdict: JSON.stringify(r.verdict),
        },
      })
    ),
    ...llmResults.map((r) =>
      prisma.offerNormalized.create({
        data: {
          rawId: r.rawId, canonicalId: reference.id,
          promptVersion: PROMPT_VERSION, model: NORMALIZE_MODEL, verdict: JSON.stringify(r.verdict),
        },
      })
    ),
  ]);

  const stats: NormalizeStats = {
    cached: cachedByRaw.size,
    rules: ruleResults.length,
    llm: llmResults.length,
    llmFailed: warning ? forLlm.length : forLlm.length - llmResults.length,
  };

  const normalizedIds = [...cachedByRaw.values(), ...created.map((c) => c.id)];
  if (normalizedIds.length === 0 && warning) {
    return NextResponse.json({ error: warning, stats }, { status: 502 });
  }
  return NextResponse.json({ normalizedIds, referenceId: reference.id, stats, warning });
}
