import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSession,
  createAuthUser,
  findAuthUserByEmail,
  touchAuthUserLastLogin,
} from "@/lib/auth/db";
import { hashPassword } from "@/lib/auth/password";
import {
  AUTH_SESSION_COOKIE,
  authCookieOptions,
  extractClientIp,
  generateSessionToken,
  hashSessionToken,
  normalizeAuthEmail,
  sessionExpiryDate,
} from "@/lib/auth/session";

type RegisterBody = {
  email?: string;
  password?: string;
  displayName?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = String(body.email ?? "");
  const password = String(body.password ?? "");
  const displayNameRaw = String(body.displayName ?? "").trim();
  const email = normalizeAuthEmail(emailRaw);
  const displayName = displayNameRaw.length ? displayNameRaw : null;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caracteres" },
      { status: 400 },
    );
  }

  const exists = await findAuthUserByEmail(email);
  if (exists) {
    return NextResponse.json(
      { error: "Ce compte existe deja" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await createAuthUser({ email, displayName, passwordHash });

  const sessionToken = generateSessionToken();
  const expiresAt = sessionExpiryDate();
  await createAuthSession({
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ip: extractClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  await touchAuthUserLastLogin(user.id);

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(AUTH_SESSION_COOKIE, sessionToken, authCookieOptions(expiresAt));
  return res;
}
