"use client";

import { useState } from "react";
import { Offer } from "@/lib/types";
import OfferCard from "./OfferCard";
import { StatusLegend } from "./StatusIcons";

export default function ResultsTabs({
  kr,
  global,
  referenceName,
}: {
  kr: Offer[];
  global: Offer[];
  referenceName: string;
}) {
  const [tab, setTab] = useState<"KR" | "GLOBAL">("KR");
  const list = tab === "KR" ? kr : global;
  // 명세 8장 4: 수집 시각 필수 노출 (실시간 가격이 아님)
  const collectedAt = (list[0] ?? kr[0] ?? global[0])?.collected_at;

  return (
    <>
      <div role="tablist" aria-label="판매 지역" className="grid grid-cols-2 gap-1 rounded-xl bg-chip p-1">
        <Segment active={tab === "KR"} onClick={() => setTab("KR")} label="국내" count={kr.length} />
        <Segment active={tab === "GLOBAL"} onClick={() => setTab("GLOBAL")} label="해외직구" count={global.length} />
      </div>

      <div className="flex items-baseline justify-between gap-2 px-1 text-xs text-faint">
        <span className="min-w-0 truncate text-[13px] font-medium text-sub">{referenceName}</span>
        <span className="shrink-0">단가 낮은 순</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
        {list.length === 0 ? (
          <p className="px-[18px] py-8 text-center text-sm text-faint">조건에 맞는 상품이 없습니다.</p>
        ) : (
          list.map((offer, i) => <OfferCard key={`${offer.source}-${offer.url}`} offer={offer} rank={i + 1} />)
        )}
      </div>

      <StatusLegend offers={list} />

      {collectedAt && (
        <p className="px-1 text-center text-xs text-faint">
          {new Date(collectedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}{" "}
          수집 · 참고가 기준
        </p>
      )}
    </>
  );
}

function Segment({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 rounded-[9px] transition ${
        active ? "bg-surface font-bold text-ink shadow-card" : "font-medium text-sub"
      }`}
    >
      {label}
      <small className="ml-1 font-medium text-faint tabular-nums">{count}</small>
    </button>
  );
}
