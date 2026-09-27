// 진짜 특가가 서비스의 존재 이유이므로 이상치는 제거하지 않고 flag + confidence 감점만 한다.
// 게이트(6.4)가 최종 노출 여부를 판단한다.
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function isPriceOutlier(unitPrice: number, medianUnitPrice: number): boolean {
  return unitPrice < medianUnitPrice * 0.4;
}

export const OUTLIER_FLAG = "이상치의심";
