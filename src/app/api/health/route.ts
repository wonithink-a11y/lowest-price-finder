import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnthropicClient, GROUPING_MODEL, NORMALIZE_MODEL } from "@/lib/llm/client";
import { fetchNaverOffers } from "@/lib/sources/naver";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Check = "ok" | string;

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 300);
}

async function check(fn: () => Promise<unknown>): Promise<Check> {
  try {
    await fn();
    return "ok";
  } catch (e) {
    return errMsg(e);
  }
}

// 배포 직후 설정 점검용 (값은 노출하지 않음).
//   /api/health          env 존재 여부 + DB 연결 + 마이그레이션 적용 여부
//   /api/health?deep=1   위 항목 + 네이버 API 실호출(1건) + LLM 모델별 최소 호출(max_tokens 1, 비용 1원 미만)
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";

  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    NAVER_CLIENT_ID: !!process.env.NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET: !!process.env.NAVER_CLIENT_SECRET,
    COUPANG: !!(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY),
    ALIEXPRESS: !!(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET && process.env.ALIEXPRESS_TRACKING_ID),
    APP_PASSWORD: !!process.env.APP_PASSWORD,
  };

  const checks: Record<string, Check> = {
    db: await check(() => prisma.$queryRaw`SELECT 1`),
    // 테이블이 없으면 빌드 시 prisma migrate deploy가 실행되지 않은 것
    migrations: await check(() => prisma.canonicalProduct.count()),
  };

  if (deep) {
    const anthropicPing = (model: string) => () =>
      getAnthropicClient().messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] });
    const [naver, normalizeModel, groupingModel] = await Promise.all([
      check(async () => {
        const offers = await fetchNaverOffers("유산균", 1);
        if (offers.length === 0) throw new Error("네이버 응답 0건");
      }),
      check(anthropicPing(NORMALIZE_MODEL)),
      check(anthropicPing(GROUPING_MODEL)),
    ]);
    checks.naver = naver;
    checks[`llm:${NORMALIZE_MODEL}`] = normalizeModel;
    checks[`llm:${GROUPING_MODEL}`] = groupingModel;
  }

  const requiredEnv = env.DATABASE_URL && env.ANTHROPIC_API_KEY && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET;
  const ok = requiredEnv && Object.values(checks).every((c) => c === "ok");
  return NextResponse.json({ ok, deep, checks, env }, { status: ok ? 200 : 503 });
}
