import crypto from "crypto";
import { RawOffer, ShippingPolicy } from "@/lib/types";

const HOST = "api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";

interface CoupangProduct {
  productId: number;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
  isFreeShipping: boolean;
}

// 쿠팡 파트너스 서명 규격: HMAC-SHA256(secretKey, datetime + method + path + query)
// Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...
function sign(method: string, pathWithQuery: string, accessKey: string, secretKey: string): { authorization: string; datetime: string } {
  const datetime = new Date()
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 15) + "Z"; // yyMMddTHHmmssZ 형태로 맞춤 (쿠팡 규격)
  const message = datetime + method + pathWithQuery;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  return { authorization, datetime };
}

function toShippingPolicy(product: CoupangProduct): ShippingPolicy | null {
  // 무료배송 여부만 확정적으로 제공됨. 유료배송 실제 금액은 API가 주지 않아 미확인으로 둔다(4.3 origin="default"로 폴백).
  if (product.isFreeShipping) {
    return {
      base_fee: 0,
      free_threshold: 0,
      island_surcharge: 3000,
      is_bundled: false,
      estimated_days: product.isRocket ? 1 : null,
      origin: "api",
    };
  }
  return null;
}

export async function fetchCoupangOffers(query: string, limit = 30): Promise<RawOffer[]> {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error(
      "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 미설정. 쿠팡 파트너스 제휴 승인 완료 후 발급받은 키를 넣으세요 (7장 참고)."
    );
  }

  const queryString = `keyword=${encodeURIComponent(query)}&limit=${limit}`;
  const pathWithQuery = `${PATH}?${queryString}`;
  const { authorization } = sign("GET", pathWithQuery, accessKey, secretKey);

  const res = await fetch(`https://${HOST}${pathWithQuery}`, {
    headers: { Authorization: authorization },
  });

  if (!res.ok) {
    throw new Error(`쿠팡 API 오류: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { data: { productData: CoupangProduct[] } };

  return data.data.productData.map((p) => ({
    source: "coupang" as const,
    mall: "쿠팡",
    seller: "쿠팡",
    title: p.productName,
    price: p.productPrice,
    url: p.productUrl,
    product_id: String(p.productId),
    image: p.productImage || null,
    brand: null,
    shipping: toShippingPolicy(p),
    raw: p as unknown as Record<string, unknown>,
  }));
}
