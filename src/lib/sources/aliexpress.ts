import crypto from "crypto";
import { RawOffer } from "@/lib/types";

const ENDPOINT = "https://api-sg.aliexpress.com/sync";
const METHOD = "aliexpress.affiliate.product.query";

interface AliProduct {
  product_id: number;
  product_title: string;
  target_sale_price: string; // 대상 통화 환산가 (target_currency로 지정)
  product_main_image_url: string;
  product_detail_url: string;
}

// AliExpress Top API 서명 규격 (MD5): 파라미터를 key 기준 정렬 후
// secret + k1v1k2v2... + secret 을 대문자 MD5.
function sign(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHash("md5").update(appSecret + sorted + appSecret).digest("hex").toUpperCase();
}

export async function fetchAliexpressOffers(query: string, pageSize = 30): Promise<RawOffer[]> {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID;
  if (!appKey || !appSecret || !trackingId) {
    throw new Error(
      "ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / ALIEXPRESS_TRACKING_ID 미설정. " +
        "Affiliate Open Platform 승인(신분증 제출, 2~3일 소요) 완료 후 발급받은 값을 넣으세요 (7장 참고)."
    );
  }

  const params: Record<string, string> = {
    app_key: appKey,
    method: METHOD,
    timestamp: String(Date.now()),
    format: "json",
    v: "2.0",
    sign_method: "md5",
    keywords: query,
    page_size: String(pageSize),
    target_currency: "KRW",
    target_language: "KO",
    tracking_id: trackingId,
  };
  params.sign = sign(params, appSecret);

  const url = `${ENDPOINT}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`알리익스프레스 API 오류: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    aliexpress_affiliate_product_query_response: {
      resp_result: { result: { products: { product: AliProduct[] } } };
    };
  };
  const products =
    data.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];

  return products.map((p) => ({
    source: "aliexpress" as const,
    mall: "AliExpress",
    seller: "AliExpress",
    title: p.product_title,
    price: Math.round(parseFloat(p.target_sale_price)),
    url: p.product_detail_url,
    product_id: String(p.product_id),
    image: p.product_main_image_url || null,
    brand: null,
    shipping: null, // 배송비는 별도 상세 조회 필요 — 미확인으로 두고 4.3 기본값 적용
    raw: p as unknown as Record<string, unknown>,
  }));
}
