// 규칙 정규화 회귀 테스트: 확실한 건 처리, 애매한 건 반드시 null(→ LLM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractByRules } from "@/lib/pipeline/ruleExtract";
import { RawOffer, Reference } from "@/lib/types";

const ref: Reference = {
  id: "r", brand: "CJ웰케어", product_name: "바이오코어 500억 유산균",
  strength_cfu: 500, strength_unit: "억CFU", strength_type: "guaranteed", category: "probiotics", aliases: [],
};

const offer = (title: string, extra: Partial<RawOffer> = {}): RawOffer => ({
  source: "naver", mall: "몰", seller: "몰", title, price: 20000, url: "u", product_id: "p",
  image: null, brand: null, shipping: null, raw: {}, ...extra,
});

const rule = (title: string, extra?: Partial<RawOffer>) => extractByRules(ref, offer(title, extra));

test("단순 구성: 30포 1박스", () => {
  const v = rule("CJ웰케어 바이오코어 500억 유산균 30포")!;
  assert.equal(v.total_units, 30);
  assert.equal(v.pack_count, 1);
  assert.equal(v.strength_value, 500);
  assert.equal(v.strength_unit, "억CFU");
  assert.equal(v.country, "KR");
  assert.equal(v.strength_type, "unknown");
});

test("함정2: 30포 x 2박스 → 60", () => {
  assert.equal(rule("CJ웰케어 바이오코어 500억 보장균수 유산균 30포 x 2박스")!.total_units, 60);
  assert.equal(rule("CJ웰케어 바이오코어 500억 유산균 30포 3개")!.total_units, 90);
  assert.equal(rule("CJ웰케어 바이오코어 500억 보장균수 30포 x 2박스")!.strength_type, "guaranteed");
});

test("섭취량·기간 표기는 수량으로 세지 않음", () => {
  assert.equal(rule("CJ웰케어 바이오코어 500억 유산균 1일 1포 30일분 30포 2박스")!.total_units, 60);
});

test("브랜드는 제목 또는 API brand 필드로 확인", () => {
  assert.equal(rule("바이오코어 500억 유산균 30포", { brand: "CJ웰케어" })!.brand, "CJ웰케어");
  assert.equal(rule("바이오코어 500억 유산균 30포"), null);
});

test("해외 키워드는 GLOBAL, 애매한 해외 신호는 LLM", () => {
  const v = rule("CJ웰케어 바이오코어 500억 유산균 30포 병행수입")!;
  assert.equal(v.country, "GLOBAL");
  assert.equal(v.overseas_signal, "병행수입");
  assert.equal(rule("CJ웰케어 바이오코어 500억 유산균 30포 수입"), null);
});

test("확실한 제외 사유", () => {
  assert.equal(rule("CJ웰케어 바이오코어 500억 리필 30포")!.exclude_reason, "refill");
  assert.equal(rule("[중고] CJ웰케어 바이오코어 500억 30포")!.exclude_reason, "used");
});

test("애매하면 전부 LLM으로 (null)", () => {
  const ambiguous = [
    "CJ웰케어 바이오코어 500억 유산균 30포+10포 증정",           // 증정 구성
    "CJ웰케어 바이오코어 500억 유산균 30포/60포 택1",             // 옵션
    "CJ웰케어 바이오코어 500억 유산균 2박스(60포)",               // 총량 괄호 표기
    "CJ웰케어 바이오코어 키즈 500억 유산균 30포",                 // 다른 라인업
    "CJ웰케어 바이오코어 골드 500억 30포",                        // 다른 라인업
    "CJ웰케어 바이오코어 500억 1000억 30포",                      // 함량 2개
    "CJ웰케어 바이오코어 유산균 30포",                            // 함량 없음
    "CJ웰케어 바이오코어 500억 유산균",                           // 수량 없음
    "CJ웰케어 바이오코어 500억 2g x 30포",                        // 단위 2개
    "CJ웰케어 바이오코어 500억 유산균 30포 정기배송",             // 정기구독 가능성
    "CJ웰케어 바이오코어 500억 30개입",                           // 개입 = 단위? 묶음?
    "CJ웰케어 락토핏 500억 30포",                                 // 상품명 불일치
  ];
  for (const t of ambiguous) assert.equal(rule(t), null, t);
});
