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
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="상품명을 입력하세요 (예: 바이오코어 500억 유산균)"
        disabled={disabled}
        className="flex-1 rounded-none border-b-2 border-gray-900 bg-transparent px-1 py-3 text-lg outline-none placeholder:text-gray-400 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="shrink-0 bg-teal-800 px-5 py-3 font-medium text-white transition hover:bg-teal-900 disabled:bg-gray-300"
      >
        검색
      </button>
    </form>
  );
}
