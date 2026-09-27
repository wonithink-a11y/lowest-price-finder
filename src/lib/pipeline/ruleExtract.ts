import { RawOffer, Reference, StrengthUnit, Verdict } from "@/lib/types";
import { matchGlobalKeyword } from "./country";

// 정규화 1단계: 규칙(코드)으로 Verdict를 만든다. 확실한 건만 처리하고, 조금이라도 애매하면
// null을 반환해 2단계 LLM으로 넘긴다 (명세 6.7 국가 판정의 "룰 → LLM 보정" 구조를 정규화 전체로 확장).
// 원칙: 틀린 값을 내느니 LLM에 넘긴다. 이 함수의 오판은 LLM 오판보다 발견이 어렵다.
//
// 규칙을 바꾸면 RULES_VERSION을 올린다 → offers_normalized.promptVersion에 기록되어 캐시가 무효화되고,
// LLM 결과와 리플레이 비교가 가능하다 (명세 9장).
export const RULES_VERSION = "rules-v1";
export const RULES_MODEL = "rules";

const RULE_CONFIDENCE = 0.9;

// 제목만으로 판단이 확실한 제외 사유. 나머지 사유(different_product, subscription_intro 등)는 LLM 몫.
const HARD_EXCLUDES: Array<[RegExp, Verdict["exclude_reason"]]> = [
  [/중고/, "used"],
  [/리퍼/, "refurbished"],
  [/리필/, "refill"],
  [/샘플|체험분|sample/i, "sample"],
];

// 구성·가격 해석이 애매해지는 표현 → LLM
const AMBIGUOUS =
  /\+|증정|사은품|택\s*\d|택일|골라|옵션|선택|모음|~|정기|구독|\d+\s*개입|\d+\s*[x×*]\s*\d+\s*[x×*]|균일가/i;

// 해외 판매 가능성이 있지만 명세 6.7 키워드 룰에는 없는 신호 → LLM이 판정
const OVERSEAS_HINTS = /직구|해외|수입|아이허브|iherb|amazon|아마존|쿠팡\s*글로벌/i;

// 상품명에서 "정체성"이 아닌 일반명사. 제목 일치 검사에서 제외한다.
const GENERIC_WORDS = ["유산균", "프로바이오틱스", "probiotics", "영양제", "건강기능식품", "비타민", "오메가3", "오메가"];

// 다른 라인업을 뜻하는 단어. Reference 이름에 없는데 제목에 있으면 다른 상품일 수 있다 → LLM.
const VARIANT_WORDS = [
  "키즈", "kids", "주니어", "베이비", "baby", "골드", "gold", "플러스", "plus", "프리미엄", "premium",
  "우먼", "women", "woman", "맨즈", "men", "시니어", "임산부", "다이어트", "슬림", "맥스", "max", "라이트", "미니", "포르테",
];

const STRENGTH_RE = /(\d+(?:\.\d+)?)\s*(억|조|billion)/gi;
const IU_MG_RE = /(\d+(?:\.\d+)?)\s*(iu|mg)(?![a-z])/gi;
// 1회 섭취량·기간 표기는 구성 수량이 아니므로 먼저 지운다 (예: "1일 1포", "30일분", "2개월분")
const DOSAGE_RE = /1\s*일\s*\d+\s*(포|정|캡슐|캡|알|회)|\d+\s*(일|개월)\s*분?/g;
const UNIT_RE = /(\d+(?:\.\d+)?)\s*(포|정|캡슐|캡|알|스틱|ml|g)(?![a-z0-9])/gi;
const PACK_RE = /[x×*]\s*(\d+)\s*(?:박스|개|세트|통|팩|병|box|ea)?|(\d+)\s*(?:박스|개(?!월)|세트|통|팩|box|ea)(?![a-z])/gi;

function compact(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/.,·()[\]{}]/g, "");
}

function stripGeneric(s: string): string {
  return GENERIC_WORDS.reduce((acc, w) => acc.split(w).join(""), s);
}

function isStrengthToken(tok: string): boolean {
  return /^\d+(\.\d+)?(억|조|billion|iu|mg)?(cfu)?$/i.test(tok);
}

function insideParens(text: string, index: number): boolean {
  const before = text.slice(0, index);
  return before.lastIndexOf("(") > before.lastIndexOf(")");
}

function parseStrength(title: string): { value: number; unit: StrengthUnit } | "ambiguous" | null {
  const found = new Map<string, { value: number; unit: StrengthUnit }>();
  for (const m of title.matchAll(STRENGTH_RE)) {
    const u = m[2].toLowerCase();
    const unit: StrengthUnit = u === "억" ? "억CFU" : u === "조" ? "조CFU" : "Billion";
    found.set(`${m[1]}${unit}`, { value: Number(m[1]), unit });
  }
  for (const m of title.matchAll(IU_MG_RE)) {
    const unit: StrengthUnit = m[2].toLowerCase() === "iu" ? "IU" : "mg";
    found.set(`${m[1]}${unit}`, { value: Number(m[1]), unit });
  }
  if (found.size > 1) return "ambiguous";
  return found.size === 1 ? [...found.values()][0] : null;
}

function parseQuantity(title: string): { unitsPerPack: number; packUnit: string; packCount: number } | null {
  const text = title.replace(DOSAGE_RE, " ");

  const units = [...text.matchAll(UNIT_RE)];
  const distinctUnits = new Set(units.map((m) => `${m[1]}${m[2].toLowerCase()}`));
  if (distinctUnits.size !== 1) return null; // 없음 또는 여러 개 (예: "2g x 30포", "30포 60포")
  const unitMatch = units[0];
  const unitsPerPack = Number(unitMatch[1]);
  if (!Number.isInteger(unitsPerPack) || unitsPerPack <= 0) return null;

  const packs = [...text.matchAll(PACK_RE)];
  const distinctPacks = new Set(packs.map((m) => Number(m[1] ?? m[2])));
  if (distinctPacks.size > 1) return null;
  const packCount = packs.length > 0 ? Number(packs[0][1] ?? packs[0][2]) : 1;
  if (!Number.isInteger(packCount) || packCount <= 0 || packCount > 50) return null;

  if (packCount > 1) {
    // "2박스(60포)"처럼 수량이 앞에 오거나 괄호 안 숫자가 총량일 수 있는 표기 → LLM
    if (packs[0].index! < unitMatch.index!) return null;
    if (insideParens(text, unitMatch.index!)) return null;
  }

  const rawUnit = unitMatch[2].toLowerCase();
  const packUnit = rawUnit === "캡" ? "캡슐" : rawUnit;
  return { unitsPerPack, packUnit, packCount };
}

// idx는 호출부가 채운다. null이면 LLM으로 넘길 것.
export function extractByRules(reference: Reference, offer: RawOffer): Omit<Verdict, "idx"> | null {
  const title = offer.title;

  for (const [re, reason] of HARD_EXCLUDES) {
    if (re.test(title)) {
      return {
        is_same_product: true, extraction_confidence: RULE_CONFIDENCE, country: "KR",
        brand: null, product_name: null, strength_value: null, strength_unit: null, strength_type: "unknown",
        units_per_pack: null, pack_unit: null, pack_count: null, total_units: null,
        overseas_signal: null, exclude_reason: reason,
      };
    }
  }
  if (AMBIGUOUS.test(title)) return null;

  // --- 상품 정체성: 브랜드 + 상품명 핵심 토큰이 모두 제목에 있어야 한다
  const titleC = compact(title);
  const brandC = compact(reference.brand);
  const brandHit = titleC.includes(brandC) || (offer.brand !== null && compact(offer.brand) === brandC);
  if (!brandHit) return null;

  const coreTokens = reference.product_name
    .split(/\s+/)
    .map(compact)
    .map(stripGeneric)
    .filter((t) => t.length > 0 && !isStrengthToken(t) && t !== brandC);
  if (coreTokens.length === 0 || !coreTokens.every((t) => titleC.includes(t))) return null;

  const refC = compact(reference.product_name);
  const titleNoGeneric = stripGeneric(titleC);
  if (VARIANT_WORDS.some((w) => titleNoGeneric.includes(w) && !refC.includes(w))) return null;

  // --- 함량
  const strength = parseStrength(title);
  if (strength === "ambiguous" || strength === null) return null;
  const strengthType = /보장\s*균수/.test(title) ? "guaranteed" : /투입\s*균수/.test(title) ? "input" : "unknown";

  // --- 수량 (명세 8장 함정 2: 곱셈은 build에서 다시 검증됨)
  const qty = parseQuantity(title);
  if (!qty) return null;

  // --- 국가: 명세 6.7 키워드면 GLOBAL, 해외 가능성 신호가 있으면 LLM, 아니면 KR
  const keyword = matchGlobalKeyword(title);
  let country: Verdict["country"] = "KR";
  if (keyword || offer.source === "aliexpress") {
    country = "GLOBAL";
  } else if (OVERSEAS_HINTS.test(title) || OVERSEAS_HINTS.test(offer.mall)) {
    return null;
  } else {
    const letters = title.replace(/[^a-zA-Z가-힣]/g, "");
    const latin = letters.replace(/[가-힣]/g, "").length;
    if (letters.length > 0 && latin / letters.length > 0.5) return null; // 영문 위주 제목 = 해외 판매 가능성
  }

  return {
    is_same_product: true,
    extraction_confidence: RULE_CONFIDENCE,
    country,
    brand: reference.brand,
    product_name: reference.product_name,
    strength_value: strength.value,
    strength_unit: strength.unit,
    strength_type: strengthType,
    units_per_pack: qty.unitsPerPack,
    pack_unit: qty.packUnit,
    pack_count: qty.packCount,
    total_units: qty.unitsPerPack * qty.packCount,
    overseas_signal: keyword,
    exclude_reason: null,
  };
}
