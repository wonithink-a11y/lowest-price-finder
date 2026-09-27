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
      className="flex gap-4 border-b border-gray-200 py-4 transition hover:bg-gray-50"
    >
      <div className="w-8 shrink-0 pt-1 text-center font-mono text-sm text-gray-400">{rank}</div>

      {offer.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={offer.image} alt={offer.title} className="h-16 w-16 shrink-0 object-cover" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-gray-500">
          {offer.mall} · {offer.brand}
        </div>
        <div className="truncate font-medium">{offer.product_name}</div>
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

        {offer.customs_note && <div className="mt-1 text-xs text-gray-500">{offer.customs_note}</div>}
      </div>

      <div className="shrink-0 text-right font-mono">
        <div className="text-lg font-bold text-teal-800">
          {Math.round(offer.unit_price).toLocaleString()}원<span className="text-xs text-gray-400">/개</span>
        </div>
        <div className="text-xs text-gray-400">
          참고가 {offer.price.toLocaleString()}원 + 배송 {offer.shipping_fee.toLocaleString()}원
        </div>
        <div className="text-xs text-gray-400">총 {offer.total_cost.toLocaleString()}원</div>
      </div>
    </a>
  );
}
