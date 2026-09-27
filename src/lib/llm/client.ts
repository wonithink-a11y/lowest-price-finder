import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// 환경변수로 교체 가능 — 코드 배포 없이 모델 A/B (offers_normalized.model에 기록됨).
export const NORMALIZE_MODEL = process.env.NORMALIZE_MODEL || "claude-sonnet-4-6";
export const GROUPING_MODEL = process.env.GROUPING_MODEL || "claude-haiku-4-5"; // 11장 미결정 항목: 후보 그룹핑은 저비용 모델로 충분한지 실측 필요
