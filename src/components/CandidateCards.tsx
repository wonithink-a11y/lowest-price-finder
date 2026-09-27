import { CandidateCard } from "@/lib/types";

export default function CandidateCards({
  candidates,
  onSelect,
}: {
  candidates: CandidateCard[];
  onSelect: (c: CandidateCard) => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">검색어와 일치하는 대표 상품이 여러 개 있습니다. 기준 상품을 선택하세요.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {candidates.map((c, i) => (
          <button
            key={i}
            onClick={() => onSelect(c)}
            className="rounded-none border border-gray-300 p-4 text-left transition hover:border-teal-800 hover:bg-teal-50 active:bg-teal-50 dark:border-gray-700 dark:hover:border-teal-400 dark:hover:bg-teal-950 dark:active:bg-teal-950"
          >
            <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{c.brand}</div>
            <div className="mt-1 text-base font-semibold">{c.product_name}</div>
            <div className="mt-2 flex items-baseline gap-1 font-mono">
              <span className="text-lg font-bold text-teal-800 dark:text-teal-400">{c.strength_display}</span>
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.representative_variant}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
