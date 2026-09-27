"use client";

import { useState } from "react";

export default function SearchBar({ onSearch, disabled }: { onSearch: (q: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSearch(value.trim());
      }}
      className="flex gap-2"
    >
      {/* min-w-0: 입력창 기본 최소폭 때문에 좁은 화면(폴드 커버 280px 등)에서 검색 버튼이 밀려나던 문제 방지
          type=search + enterKeyHint: 모바일 키보드에 "검색" 키 표시. text-lg(18px): 아이폰 입력 시 자동 확대 방지(16px 이상) */}
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="상품명 (예: 바이오코어 500억)"
        disabled={disabled}
        className="min-w-0 flex-1 appearance-none rounded-none border-b-2 border-gray-900 bg-transparent px-1 py-3 text-lg outline-none placeholder:text-gray-400 disabled:opacity-50 dark:border-gray-200 dark:placeholder:text-gray-500"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="min-h-11 shrink-0 bg-teal-800 px-4 py-3 font-medium text-white transition hover:bg-teal-900 disabled:bg-gray-300 sm:px-5 dark:bg-teal-700 dark:hover:bg-teal-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
      >
        검색
      </button>
    </form>
  );
}
