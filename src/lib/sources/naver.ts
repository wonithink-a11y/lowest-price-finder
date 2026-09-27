import { RawOffer } from "@/lib/types";

const ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";

interface NaverItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
}

function stripTags(title: string): string {
  return title.replace(/<[^>]*>/g, "");
}

// 네이버 API는 배송비 정보를 주지 않는다 → shipping: null (미확인, 4.3에서 기본값 적용됨).
// 지마켓·옥션·11번가는 mallName으로 함께 집계되어 별도 연동이 필요 없다 (7장).
export async function fetchNaverOffers(query: string, display = 50): Promise<RawOffer[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`네이버 API 오류: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { items: NaverItem[] };

  return data.items.map((item) => ({
    source: "naver" as const,
    mall: item.mallName,
    seller: item.mallName,
    title: stripTags(item.title),
    price: parseInt(item.lprice, 10),
    url: item.link,
    product_id: item.productId,
    image: item.image || null,
    brand: item.brand || null,
    shipping: null,
    raw: item as unknown as Record<string, unknown>,
  }));
}
