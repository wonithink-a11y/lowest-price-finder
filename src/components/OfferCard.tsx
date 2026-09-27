import { Offer } from "@/lib/types";
import { StatusIcons } from "./StatusIcons";

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

// 판매처 한 줄 (두 줄 구성)
//   1줄: 순위 · 판매처 · 상태 아이콘 ········ 개당 단가
//   2줄:        구성 (30포 × 4 = 120포) ···· 총액
export default function OfferCard({ offer, rank }: { offer: Offer; rank: number }) {
  const top = rank === 1;
  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      title={offer.title}
      className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 border-t border-line px-[18px] py-3.5 transition first:border-t-0 hover:bg-surface-2 active:bg-surface-2"
    >
      <span className={`text-sm font-bold tabular-nums ${top ? "text-accent" : "text-faint"}`}>{rank}</span>

      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[15px] font-bold">{offer.mall}</span>
        <StatusIcons offer={offer} />
      </span>

      <span className={`whitespace-nowrap text-right text-lg font-bold tabular-nums ${top ? "text-price" : ""}`}>
        {won(offer.unit_price)}원
        <small className="ml-0.5 text-xs font-normal text-faint">/{offer.pack_unit ?? "개"}</small>
      </span>

      <span className="col-start-2 text-[13px] text-sub tabular-nums">{offer.variant}</span>
      <span className="col-start-3 whitespace-nowrap text-right text-xs text-faint tabular-nums">
        총 {won(offer.total_cost)}원
      </span>
    </a>
  );
}
