import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, safeEqual } from "@/lib/auth";

// 선택형 접근 제한. APP_PASSWORD 환경변수가 설정되면 로그인 화면(/login)에서 비밀번호를 한 번 입력하고,
// 이후 180일 동안 쿠키로 유지된다. 공개 URL에서 누구나 검색을 돌려 LLM 비용을 발생시키는 것을 막는 용도.
// (브라우저 기본 인증 팝업은 홈 화면에 설치한 앱, 특히 아이폰에서 불안정해서 쓰지 않는다)
// 미설정 시 인증 없이 공개된다.
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  // 가동 모니터링용 기본 헬스체크는 공개 (deep 점검은 비용이 들어 보호)
  if (pathname === "/api/health" && searchParams.get("deep") !== "1") return NextResponse.next();

  const expected = await authToken(password);
  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (safeEqual(cookie, expected)) return NextResponse.next();

  // curl 등 스크립트용: Authorization: Basic (아이디 아무거나, 비밀번호 = APP_PASSWORD)
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      // 잘못된 base64 → 인증 실패로 처리
    }
    if (safeEqual(decoded.slice(decoded.indexOf(":") + 1), password)) return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // PWA 매니페스트·아이콘·서비스워커·정적 파일은 인증 없이 제공 (브라우저가 쿠키 없이 요청할 수 있음)
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.json|sw.js|favicon.ico).*)"],
};
