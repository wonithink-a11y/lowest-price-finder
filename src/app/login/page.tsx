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
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card">
        <h1 className="text-lg font-bold">최저가 비교</h1>
        <p className="-mt-1 text-sm text-sub">비밀번호를 입력하세요. 이 기기에서는 180일 동안 유지됩니다.</p>
        <input
          type="password"
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          className="min-w-0 appearance-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-base outline-none placeholder:text-faint focus:border-accent focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="min-h-12 rounded-xl bg-accent px-5 font-bold text-on-accent transition disabled:opacity-50"
        >
          {busy ? "확인 중..." : "들어가기"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </main>
  );
}
