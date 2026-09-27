import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 배포 직후 설정 점검용: 필수 env 존재 여부와 DB 연결만 확인한다 (값은 노출하지 않음).
export async function GET() {
  const env = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    NAVER_CLIENT_ID: !!process.env.NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET: !!process.env.NAVER_CLIENT_SECRET,
    COUPANG: !!(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY),
    ALIEXPRESS: !!(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET && process.env.ALIEXPRESS_TRACKING_ID),
  };

  let db: "ok" | string = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    db = e instanceof Error ? e.message.split("\n")[0] : String(e);
  }

  const ok = db === "ok" && env.ANTHROPIC_API_KEY && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET;
  return NextResponse.json({ ok, db, env }, { status: ok ? 200 : 503 });
}
