import { Country, Source } from "@/lib/types";

// 1단계 키워드 룰 (코드, 커버리지 90%). 여기 안 걸린 건만 2단계 LLM 판정으로 넘긴다.
const GLOBAL_KEYWORDS = [
  "해외직구",
  "해외배송",
  "병행수입",
  "직배송",
  "관부가세",
  "global",
  "overseas",
  "us warehouse",
];

// 소스 자체가 해외 채널이면 키워드 확인 없이 확정한다.
const SOURCE_IMPLIES_GLOBAL: Source[] = ["aliexpress"];

// 제목에 걸린 첫 해외 키워드 (없으면 null). overseas_signal 근거로 쓴다.
export function matchGlobalKeyword(title: string): string | null {
  const lower = title.toLowerCase();
  return GLOBAL_KEYWORDS.find((kw) => lower.includes(kw)) ?? null;
}

// null 반환 시 2단계 LLM 판정 필요.
export function detectCountryByKeyword(title: string, source: Source): Country | null {
  if (SOURCE_IMPLIES_GLOBAL.includes(source)) return "GLOBAL";
  return matchGlobalKeyword(title) ? "GLOBAL" : null;
}
