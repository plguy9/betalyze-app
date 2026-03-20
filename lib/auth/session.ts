import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  findActiveSessionWithUser,
  type AuthUserPublic,
} from "@/lib/auth/db";

export const AUTH_SESSION_COOKIE = "betalyze_session";
export const AUTH_SESSION_TTL_DAYS = 30;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiryDate(): Date {
  return new Date(Date.now() + AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function authCookieOptions(expiresAt: Date, persistent = true) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(persistent ? { expires: expiresAt } : {}),
  };
}

export function clearAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function extractClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp?.trim() || null;
}

export async function getAuthUserFromRequest(
  req: NextRequest,
): Promise<{ user: AuthUserPublic; expiresAt: string | null } | null> {
  const token = req.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  return findActiveSessionWithUser(tokenHash);
}
