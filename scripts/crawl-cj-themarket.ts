// CJ더마켓 공식몰 크롤러. 실시간 API가 없어 Playwright로 크롤링한다 (7장).
// Next.js 서버리스 런타임과 분리된 별도 스크립트로 cron(1일 1~2회)에서 실행한다.
// 클라우드: .github/workflows/crawl-cj.yml (GitHub Actions)이 실행해 결과를 DB(CjThemarketCache)에 upsert.
// 로컬 실행: npm run crawl:cj -- "바이오코어 500억 유산균" "다른 검색어"
//
// ⚠️ 실행 전 CJ더마켓 robots.txt·이용약관을 확인할 것 (7장 필독).
// ⚠️ 아래 CSS 셀렉터는 실제 사이트 DOM을 확인하고 채워야 한다. 자리표시자 상태로는 동작하지 않는다.

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { RawOffer } from "../src/lib/types";
const SEARCH_URL = (q: string) => `https://www.cjthemarket.com/search?query=${encodeURIComponent(q)}`;

// TODO: 실제 CJ더마켓 검색 결과 페이지 DOM에 맞춰 셀렉터 수정.
const SELECTORS = {
  productCard: ".product-item", // placeholder
  title: ".product-name",
  price: ".product-price",
  link: "a",
  image: "img",
};

async function crawlQuery(query: string): Promise<RawOffer[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(SEARCH_URL(query), { waitUntil: "networkidle" });

  const cards = await page.$$(SELECTORS.productCard);
  const offers: RawOffer[] = [];

  for (const card of cards) {
    const title = (await card.$eval(SELECTORS.title, (el) => el.textContent?.trim() ?? "").catch(() => "")) as string;
    const priceText = (await card.$eval(SELECTORS.price, (el) => el.textContent ?? "").catch(() => "")) as string;
    const href = (await card.$eval(SELECTORS.link, (el) => el.getAttribute("href") ?? "").catch(() => "")) as string;
    const image = (await card.$eval(SELECTORS.image, (el) => el.getAttribute("src") ?? "").catch(() => null)) as
      | string
      | null;

    const price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);
    if (!title || Number.isNaN(price)) continue;

    offers.push({
      source: "cj_themarket",
      mall: "CJ더마켓",
      seller: "CJ더마켓",
      title,
      price,
      url: href.startsWith("http") ? href : `https://www.cjthemarket.com${href}`,
      product_id: href,
      image,
      brand: null,
      shipping: null,
      raw: { title, priceText, href },
    });
  }

  await browser.close();
  return offers;
}

async function main() {
  const queries = process.argv.slice(2);
  if (queries.length === 0) {
    console.error("사용법: npm run crawl:cj -- \"검색어1\" \"검색어2\"");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let total = 0;
  try {
    for (const query of queries) {
      const offers = await crawlQuery(query);
      // 0건이면 기존 캐시를 덮어쓰지 않는다 (셀렉터 깨짐 등으로 기준가가 사라지는 것 방지).
      if (offers.length === 0) {
        console.warn(`[${query}] 0건 — 셀렉터 확인 필요. 기존 캐시 유지.`);
        continue;
      }
      const data = { crawledAt: new Date(), offers: JSON.stringify(offers) };
      await prisma.cjThemarketCache.upsert({ where: { query }, create: { query, ...data }, update: data });
      total += offers.length;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`${queries.length}개 검색어, 총 ${total}건 DB 저장 완료`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
