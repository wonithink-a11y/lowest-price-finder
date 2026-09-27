import { ShippingPolicy } from "@/lib/types";

// 배송 정책 미확인(None) 시 사용할 기본값. origin="default"로 표시해 UI 배지를 강제한다.
const DEFAULT_POLICY: ShippingPolicy = {
  base_fee: 3000,
  free_threshold: null,
  island_surcharge: 3000,
  is_bundled: false,
  estimated_days: null,
  origin: "default",
};

export function resolvePolicy(policy: ShippingPolicy | null): ShippingPolicy {
  return policy ?? DEFAULT_POLICY;
}

// fee_for(price): free_threshold가 있고 price >= free_threshold면 0, 아니면 base_fee.
// 도서산간 추가비는 배송지를 모르는 시점이므로 총액에 넣지 않는다 (표기만).
export function feeFor(price: number, policy: ShippingPolicy): number {
  if (policy.free_threshold !== null && price >= policy.free_threshold) return 0;
  return policy.base_fee;
}

export interface ShippingResult {
  shippingFee: number;
  totalCost: number;
  needsShippingBadge: boolean; // origin === "default"
  shippingDays: number | null;
}

export function computeShipping(price: number, rawPolicy: ShippingPolicy | null): ShippingResult {
  const policy = resolvePolicy(rawPolicy);
  const shippingFee = feeFor(price, policy);
  return {
    shippingFee,
    totalCost: price + shippingFee,
    needsShippingBadge: policy.origin === "default",
    shippingDays: policy.estimated_days,
  };
}
