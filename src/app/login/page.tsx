"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "로그인에 실패했습니다.");
      }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "인터넷 연결을 확인해 주세요.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(4rem,env(safe-area-inset-top))]">
      <h1 className="mb-1 text-2xl font-bold">최저가 비교</h1>
      <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">비밀번호를 입력하세요. 이 기기에서는 180일 동안 유지됩니다.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="min-w-0 appearance-none rounded-none border-b-2 border-gray-900 bg-transparent px-1 py-3 text-lg outline-none placeholder:text-gray-400 dark:border-gray-200 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="min-h-11 bg-teal-800 px-5 py-3 font-medium text-white transition hover:bg-teal-900 disabled:bg-gray-300 dark:bg-teal-700 dark:hover:bg-teal-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
        >
          {busy ? "확인 중..." : "들어가기"}
        </button>
        {error && <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      </form>
    </main>
  );
}
