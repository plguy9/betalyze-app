import { NextRequest, NextResponse } from "next/server";
import { revokeAuthSessionByTokenHash } from "@/lib/auth/db";
import {
  AUTH_SESSION_COOKIE,
  clearAuthCookieOptions,
  hashSessionToken,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (token) {
    await revokeAuthSessionByTokenHash(hashSessionToken(token));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_SESSION_COOKIE, "", clearAuthCookieOptions());
  return res;
}
