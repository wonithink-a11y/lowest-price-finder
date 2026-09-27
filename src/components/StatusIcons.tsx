import { Offer } from "@/lib/types";

// 상태를 문구 대신 작은 아이콘으로 표시한다. 뜻은 목록 아래 범례(StatusLegend)와 aria-label로 알린다.
type Key = "out" | "check" | "formula" | "ship" | "free" | "customs";

const ICONS: Record<Key, { label: string; className: string; path: JSX.Element }> = {
  out: {
    label: "이상치 의심",
    className: "bg-danger-soft text-danger",
    path: (
      <>
        <path d="M8 1.5L15 14H1z" fill="currentColor" />
        <path d="M8 6v3.6" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.8" r="1" fill="var(--surface)" />
      </>
    ),
  },
  check: {
    label: "확인 필요",
    className: "bg-chip text-sub",
    path: (
      <>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r=".9" fill="currentColor" />
      </>
    ),
  },
  // 명세 8장 5: 국내판과 함량이 다를 수 있음 (리포뮬레이션)
  formula: {
    label: "함량 다를 수 있음",
    className: "bg-warn-soft text-warn",
    path: <path d="M3 6h10M3 10h10M11 2.5L5 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  },
  ship: {
    label: "배송비 추정",
    className: "bg-warn-soft text-warn",
    path: (
      <>
        <path d="M1 3h8v7H1zM9 5.5h3.2L15 8.5V10H9z" fill="currentColor" />
        <circle cx="4" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </>
    ),
  },
  free: {
    label: "무료배송",
    className: "bg-good-soft text-good",
    path: <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  customs: {
    label: "통관 수량 제한 가능",
    className: "bg-accent-soft text-accent",
    path: (
      <>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </>
    ),
  },
};

const ORDER: Key[] = ["out", "check", "formula", "ship", "free", "customs"];

export function statusKeys(o: Offer): Key[] {
  const estimated = o.flags.includes("배송비추정");
  const keys: Key[] = [];
  if (o.flags.includes("이상치의심")) keys.push("out");
  if (o.needs_review || o.flags.includes("확인필요")) keys.push("check");
  if (o.formulation_differs) keys.push("formula");
  if (estimated) keys.push("ship");
  else if (o.shipping_fee === 0) keys.push("free");
  if (o.country === "GLOBAL") keys.push("customs");
  return ORDER.filter((k) => keys.includes(k));
}

function Icon({ k }: { k: Key }) {
  const icon = ICONS[k];
  return (
    <span
      role="img"
      aria-label={icon.label}
      title={icon.label}
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] ${icon.className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        {icon.path}
      </svg>
    </span>
  );
}

export function StatusIcons({ offer }: { offer: Offer }) {
  const keys = statusKeys(offer);
  if (keys.length === 0) return null;
  return (
    <span className="inline-flex shrink-0 gap-[3px]">
      {keys.map((k) => (
        <Icon key={k} k={k} />
      ))}
    </span>
  );
}

// 현재 목록에 나온 표시만 풀이한다
export function StatusLegend({ offers }: { offers: Offer[] }) {
  const used = new Set(offers.flatMap(statusKeys));
  const keys = ORDER.filter((k) => used.has(k));
  if (keys.length === 0) return null;
  return (
    <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 text-xs text-faint">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <Icon k={k} />
          {ICONS[k].label}
        </span>
      ))}
    </p>
  );
}
