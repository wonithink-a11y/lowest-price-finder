import { NextRequest, NextResponse } from "next/server";

// 선택형 접근 제한. APP_PASSWORD 환경변수가 설정되면 전체 사이트에 HTTP Basic 인증을 건다.
// 공개 URL에서 누구나 검색을 돌려 LLM 비용을 발생시키는 것을 막는 용도 (아이디는 아무 값이나 가능).
// 미설정 시 인증 없이 공개된다.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;
  // 가동 모니터링용 기본 헬스체크는 공개 (deep 점검은 비용이 들어 보호)
  if (pathname === "/api/health" && searchParams.get("deep") !== "1") return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }

  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="price-finder", charset="UTF-8"' },
  });
}

export const config = {
  // PWA 매니페스트·아이콘·서비스워커·정적 파일은 인증 없이 제공 (브라우저가 자격증명 없이 요청함)
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.json|sw.js|favicon.ico).*)"],
};
