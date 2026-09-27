"use client";

import { useState } from "react";

export default function SearchBar({ onSearch, disabled }: { onSearch: (q: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSearch(value.trim());
      }}
      className="flex items-center gap-2 rounded-[14px] border border-line bg-surface py-1 pl-3.5 pr-1 shadow-card focus-within:border-accent"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-faint">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {/* min-w-0: 좁은 화면(폴드 커버 280px 등)에서 검색 버튼이 밀려나지 않도록
          type=search + enterKeyHint: 모바일 키보드에 "검색" 키. text-base(16px): 아이폰 입력 시 자동 확대 방지 */}
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="상품명"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="상품명 검색"
        disabled={disabled}
        className="min-w-0 flex-1 appearance-none border-0 bg-transparent py-2.5 text-base outline-none placeholder:text-faint focus-visible:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="min-h-11 shrink-0 rounded-[10px] bg-accent px-[18px] font-bold text-on-accent transition disabled:opacity-50"
      >
        검색
      </button>
    </form>
  );
}
