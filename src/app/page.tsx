"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import CandidateCards from "@/components/CandidateCards";
import ResultsTabs from "@/components/ResultsTabs";
import { CandidateCard, Offer, Reference } from "@/lib/types";
import type { NormalizeStats } from "@/app/api/normalize/route";

type Results = { kr: Offer[]; global: Offer[]; stats: NormalizeStats; warning: string | null };

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
  const { normalizedIds, stats, warning } = await postJson<{
    normalizedIds: string[];
    stats: NormalizeStats;
    warning: string | null;
  }>("/api/normalize", {
    referenceId: reference.id,
    rawOfferIds,
  });
  const built = await postJson<{ KR: Offer[]; GLOBAL: Offer[] }>("/api/build", {
    referenceId: reference.id,
    normalizedIds,
  });
  return { kr: built.KR, global: built.GLOBAL, stats, warning };
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
        setStage({ step: "results", ...(await runNormalizeAndBuild(res.reference, res.rawOfferIds)) });
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
      setStage({ step: "results", ...(await runNormalizeAndBuild(reference, rawOfferIds)) });
    } catch (e) {
      setStage({ step: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    // safe-area: 앱으로 설치해 전체 화면으로 열 때 노치·펀치홀·제스처 바에 내용이 가리지 않도록
    <main className="mx-auto max-w-2xl pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="mb-1 text-2xl font-bold">최저가 비교</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">단가(총비용 ÷ 총수량) 기준. 표기가가 아닙니다.</p>

      <SearchBar onSearch={handleSearch} disabled={stage.step === "loading"} />

      <div className="mt-8">
        {stage.step === "loading" && <p className="animate-pulse text-sm text-gray-400 dark:text-gray-500">{stage.label}</p>}

        {stage.step === "selecting" && (
          <CandidateCards
            candidates={stage.candidates}
            onSelect={(c) => handleSelect(stage.query, c, stage.rawOfferIds)}
          />
        )}

        {stage.step === "results" && (
          <>
            {stage.warning && (
              <p className="mb-3 break-keep border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{stage.warning}</p>
            )}
            <ResultsTabs kr={stage.kr} global={stage.global} />
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              분석: 규칙 {stage.stats.rules}건 · 재사용 {stage.stats.cached}건 · AI {stage.stats.llm}건
            </p>
          </>
        )}

        {stage.step === "error" && (
          <p className="break-keep border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{stage.message}</p>
        )}
      </div>
    </main>
  );
}
