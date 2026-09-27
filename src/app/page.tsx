"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import CandidateCards from "@/components/CandidateCards";
import ResultsTabs from "@/components/ResultsTabs";
import { CandidateCard, Offer, Reference } from "@/lib/types";
import type { NormalizeStats } from "@/app/api/normalize/route";

// stats(규칙/재사용/AI 처리 건수)는 화면에 표시하지 않지만 API 응답과 개발자 콘솔에는 남긴다.
type Results = { kr: Offer[]; global: Offer[]; warning: string | null; referenceName: string };

type Stage =
  | { step: "idle" }
  | { step: "loading"; label: string }
  | { step: "selecting"; query: string; candidates: CandidateCard[]; rawOfferIds: string[] }
  | ({ step: "results" } & Results)
  | { step: "error"; message: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // 모바일에서 흔한 경우: 지하철·엘리베이터 등 연결 끊김 ("Failed to fetch" 대신 안내)
    throw new Error("인터넷 연결을 확인한 뒤 다시 검색해 주세요.");
  }
  if (res.status === 401) {
    // 사이트 비밀번호 쿠키 만료 → 로그인 화면으로
    window.location.href = "/login";
    throw new Error("로그인이 필요합니다.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `${url} 요청 실패 (${res.status})`);
  }
  return res.json();
}

async function runNormalizeAndBuild(reference: Reference, rawOfferIds: string[]): Promise<Results> {
  const { normalizedIds, stats, warning, warningDetail } = await postJson<{
    normalizedIds: string[];
    stats: NormalizeStats;
    warning: string | null;
    warningDetail: string | null;
  }>("/api/normalize", {
    referenceId: reference.id,
    rawOfferIds,
  });
  console.info("[price-finder] 분석 건수", stats);
  if (warningDetail) console.warn("[price-finder] AI 분석 실패 원인:", warningDetail);
  const built = await postJson<{ KR: Offer[]; GLOBAL: Offer[] }>("/api/build", {
    referenceId: reference.id,
    normalizedIds,
  });
  return { kr: built.KR, global: built.GLOBAL, warning, referenceName: `${reference.brand} ${reference.product_name}` };
}

export default function Home() {
  const [stage, setStage] = useState<Stage>({ step: "idle" });

  const handleSearch = async (query: string) => {
    setStage({ step: "loading", label: "가격 모으는 중..." });
    try {
      const res = await postJson<
        | { cached: true; reference: Reference; rawOfferIds: string[] }
        | { cached: false; candidates: CandidateCard[]; rawOfferIds: string[] }
      >("/api/search", { query });

      if (res.cached) {
        setStage({ step: "loading", label: "구성 분석 중..." });
        setStage({ step: "results", ...(await runNormalizeAndBuild(res.reference, res.rawOfferIds)) });
      } else {
        setStage({ step: "selecting", query, candidates: res.candidates, rawOfferIds: res.rawOfferIds });
      }
    } catch (e) {
      setStage({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSelect = async (query: string, chosen: CandidateCard, rawOfferIds: string[]) => {
    setStage({ step: "loading", label: "구성 분석 중..." });
    try {
      const { reference } = await postJson<{ reference: Reference }>("/api/select", { query, chosen });
      setStage({ step: "results", ...(await runNormalizeAndBuild(reference, rawOfferIds)) });
    } catch (e) {
      setStage({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    // safe-area: 앱으로 설치해 전체 화면으로 열 때 노치·펀치홀·제스처 바에 내용이 가리지 않도록
    <div className="mx-auto max-w-xl pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <header className="sticky top-0 z-10 bg-bg pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="sr-only">최저가 비교</h1>
        <SearchBar onSearch={handleSearch} disabled={stage.step === "loading"} />
      </header>

      <main className="mt-3 flex flex-col gap-3" aria-live="polite">
        {stage.step === "idle" && (
          <p className="px-1 text-sm text-sub">상품명을 검색하면 판매처별 개당 단가를 비교합니다.</p>
        )}

        {stage.step === "loading" && <Loading label={stage.label} />}

        {stage.step === "selecting" && (
          <CandidateCards
            candidates={stage.candidates}
            onSelect={(c) => handleSelect(stage.query, c, stage.rawOfferIds)}
          />
        )}

        {stage.step === "results" && (
          <>
            {stage.warning && (
              <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn">{stage.warning}</p>
            )}
            <ResultsTabs kr={stage.kr} global={stage.global} referenceName={stage.referenceName} />
          </>
        )}

        {stage.step === "error" && (
          <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">{stage.message}</p>
        )}
      </main>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  const bar = "animate-pulse rounded-md bg-chip motion-reduce:animate-none";
  return (
    <section aria-busy="true" className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-card">
      <p className="text-[13px] text-sub">{label}</p>
      <div className={`h-3.5 w-2/5 ${bar}`} />
      <div className={`h-7 w-[45%] ${bar}`} />
      <div className={`h-3.5 w-4/5 ${bar}`} />
    </section>
  );
}
