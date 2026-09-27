import { Offer } from "@/lib/types";

const FLAG_STYLE: Record<string, string> = {
  배송비추정: "bg-amber-100 text-amber-800",
  이상치의심: "bg-rose-100 text-rose-800",
  확인필요: "bg-gray-200 text-gray-700",
};

export default function OfferCard({ offer, rank }: { offer: Offer; rank: number }) {
  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 border-b border-gray-200 py-4 transition hover:bg-gray-50 sm:gap-4"
    >
      <div className="w-6 shrink-0 pt-1 text-center font-mono text-sm text-gray-400 sm:w-8">{rank}</div>

      {offer.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={offer.image} alt={offer.title} className="h-16 w-16 shrink-0 object-cover" />
      )}

      {/* 모바일: 상품 정보 → 가격을 세로로 쌓는다 (좁은 화면에서 가격 열이 상품명을 잘라먹지 않도록).
          sm 이상: 기존처럼 가격을 오른쪽 열에 둔다. */}
      <div className="min-w-0 flex-1 sm:flex sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <div className="truncate text-sm text-gray-500">
            {offer.mall} · {offer.brand}
          </div>
          <div className="line-clamp-2 break-keep font-medium">{offer.product_name}</div>
          <div className="mt-0.5 text-sm text-gray-500">
            {offer.strength} · {offer.variant}
          </div>

          {offer.flags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {offer.flags.map((f) => (
                <span key={f} className={`px-1.5 py-0.5 text-xs ${FLAG_STYLE[f] ?? "bg-gray-100 text-gray-600"}`}>
                  {f}
                </span>
              ))}
            </div>
          )}

          {offer.customs_note && <div className="mt-1 break-keep text-xs text-gray-500">{offer.customs_note}</div>}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2 font-mono sm:mt-0 sm:block sm:shrink-0 sm:text-right">
          <div className="text-lg font-bold text-teal-800">
            {Math.round(offer.unit_price).toLocaleString()}원<span className="text-xs text-gray-400">/개</span>
          </div>
          <div className="text-right text-xs text-gray-400">
            <div>
              참고가 {offer.price.toLocaleString()}원 + 배송 {offer.shipping_fee.toLocaleString()}원
            </div>
            <div>총 {offer.total_cost.toLocaleString()}원</div>
          </div>
        </div>
      </div>
    </a>
  );
}
