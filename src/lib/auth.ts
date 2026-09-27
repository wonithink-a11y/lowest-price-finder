// 사이트 비밀번호(APP_PASSWORD) 쿠키 인증. middleware(Edge)와 API(Node) 양쪽에서 쓰므로 Web Crypto만 사용한다.
export const AUTH_COOKIE = "pf_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 180; // 180일: 폰에 설치한 앱에서 매번 다시 입력하지 않도록

// 쿠키에는 비밀번호 대신 해시를 저장한다. 비밀번호를 바꾸면 기존 쿠키는 자동으로 무효가 된다.
export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`price-finder:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// 길이가 같을 때 비교 시간이 내용과 무관하도록
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
