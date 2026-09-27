"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import CandidateCards from "@/components/CandidateCards";
import ResultsTabs from "@/components/ResultsTabs";
import { CandidateCard, Offer, Reference } from "@/lib/types";

type Stage =
  | { step: "idle" }
  | { step: "loading"; label: string }
  | { step: "selecting"; query: string; candidates: CandidateCard[]; rawOfferIds: string[] }
  | { step: "results"; kr: Offer[]; global: Offer[] }
  | { step: "error"; message: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `${url} 요청 실패 (${res.status})`);
  }
  return res.json();
}

async function runNormalizeAndBuild(reference: Reference, rawOfferIds: string[]): Promise<{ kr: Offer[]; global: Offer[] }> {
  const { normalizedIds } = await postJson<{ normalizedIds: string[] }>("/api/normalize", {
    referenceId: reference.id,
    rawOfferIds,
  });
  const built = await postJson<{ KR: Offer[]; GLOBAL: Offer[] }>("/api/build", {
    referenceId: reference.id,
    normalizedIds,
  });
  return { kr: built.KR, global: built.GLOBAL };
}

export default function Home() {
  const [stage, setStage] = useState<Stage>({ step: "idle" });

  const handleSearch = async (query: string) => {
    setStage({ step: "loading", label: "판매처 수집 중..." });
    try {
      const res = await postJson<
        | { cached: true; reference: Reference; rawOfferIds: string[] }
        | { cached: false; candidates: CandidateCard[]; rawOfferIds: string[] }
      >("/api/search", { query });

      if (res.cached) {
        setStage({ step: "loading", label: "상품 정보 정규화 중..." });
        const { kr, global } = await runNormalizeAndBuild(res.reference, res.rawOfferIds);
        setStage({ step: "results", kr, global });
      } else {
        setStage({ step: "selecting", query, candidates: res.candidates, rawOfferIds: res.rawOfferIds });
      }
    } catch (e) {
      setStage({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSelect = async (query: string, chosen: CandidateCard, rawOfferIds: string[]) => {
    setStage({ step: "loading", label: "기준 상품 확정 중..." });
    try {
      const { reference } = await postJson<{ reference: Reference }>("/api/select", { query, chosen });
      setStage({ step: "loading", label: "상품 정보 정규화 중..." });
      const { kr, global } = await runNormalizeAndBuild(reference, rawOfferIds);
      setStage({ step: "results", kr, global });
    } catch (e) {
      setStage({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">최저가 비교</h1>
      <p className="mb-6 text-sm text-gray-500">단가(총비용 ÷ 총수량) 기준. 표기가가 아닙니다.</p>

      <SearchBar onSearch={handleSearch} disabled={stage.step === "loading"} />

      <div className="mt-8">
        {stage.step === "loading" && <p className="animate-pulse text-sm text-gray-400">{stage.label}</p>}

        {stage.step === "selecting" && (
          <CandidateCards
            candidates={stage.candidates}
            onSelect={(c) => handleSelect(stage.query, c, stage.rawOfferIds)}
          />
        )}

        {stage.step === "results" && <ResultsTabs kr={stage.kr} global={stage.global} />}

        {stage.step === "error" && (
          <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{stage.message}</p>
        )}
      </div>
    </main>
  );
}
