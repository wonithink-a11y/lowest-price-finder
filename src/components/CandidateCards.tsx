import { CandidateCard } from "@/lib/types";

export default function CandidateCards({
  candidates,
  onSelect,
}: {
  candidates: CandidateCard[];
  onSelect: (c: CandidateCard) => void;
}) {
  return (
    <section className="rounded-2xl bg-surface p-[18px] shadow-card">
      <h2 className="mb-3 text-base font-bold">비교할 상품을 골라주세요</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
        {candidates.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(c)}
            className="flex min-h-11 flex-col gap-0.5 rounded-[14px] border border-line bg-surface-2 p-4 text-left transition hover:border-accent active:border-accent"
          >
            <span className="text-xs text-faint">{c.brand}</span>
            <span className="text-[15px] font-bold">{c.product_name}</span>
            <span className="mt-1.5 text-sm font-bold text-accent tabular-nums">{c.strength_display}</span>
            <span className="text-xs text-sub">대표 구성 {c.representative_variant}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
