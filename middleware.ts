import { NextRequest, NextResponse } from "next/server";

// Cookie name must match AUTH_SESSION_COOKIE in lib/auth/session.ts
const SESSION_COOKIE = "betalyze_session";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/account", req.url);
    loginUrl.searchParams.set("mode", "login");
    loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/nba/:path*"],
};
