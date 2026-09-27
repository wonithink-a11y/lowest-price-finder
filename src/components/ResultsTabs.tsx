"use client";

import { useState } from "react";
import { Offer } from "@/lib/types";
import OfferCard from "./OfferCard";

export default function ResultsTabs({ kr, global }: { kr: Offer[]; global: Offer[] }) {
  const [tab, setTab] = useState<"KR" | "GLOBAL">("KR");
  const list = tab === "KR" ? kr : global;
  const latestCollectedAt = list.length > 0 ? list[0].collected_at : null;

  return (
    <div>
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        <TabButton active={tab === "KR"} onClick={() => setTab("KR")} label={`국내 Top${kr.length}`} />
        <TabButton active={tab === "GLOBAL"} onClick={() => setTab("GLOBAL")} label={`해외직구 Top${global.length}`} />
      </div>

      {latestCollectedAt && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {new Date(latestCollectedAt).toLocaleString("ko-KR")} 기준 수집 · 실시간 가격이 아닙니다.
        </p>
      )}

      <div className="mt-2">
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            {tab === "KR" ? "국내" : "해외직구"} 조건을 만족하는 상품이 없습니다.
          </p>
        ) : (
          list.map((offer, i) => <OfferCard key={`${offer.source}-${offer.url}`} offer={offer} rank={i + 1} />)
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      // min-h-11(44px): 모바일 권장 최소 터치 영역
      className={`min-h-11 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-b-2 border-teal-800 text-teal-800 dark:border-teal-400 dark:text-teal-400"
          : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
