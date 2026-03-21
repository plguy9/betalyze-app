import { NextRequest, NextResponse } from "next/server";
import {
  countActiveSessionsForUser,
  createAuthSession,
  findAuthUserByEmail,
  revokeAllAuthSessionsForUser,
  touchAuthUserLastLogin,
} from "@/lib/auth/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  AUTH_SESSION_COOKIE,
  authCookieOptions,
  extractClientIp,
  generateSessionToken,
  hashSessionToken,
  normalizeAuthEmail,
  sessionExpiryDate,
} from "@/lib/auth/session";

type LoginBody = {
  email?: string;
  password?: string;
  rememberMe?: boolean;
  forceNewSession?: boolean;
};

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = normalizeAuthEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const rememberMe = body.rememberMe !== false;
  const forceNewSession = body.forceNewSession === true;
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email et mot de passe obligatoires" },
      { status: 400 },
    );
  }

  const user = await findAuthUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "Identifiants invalides" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Identifiants invalides" },
      { status: 401 },
    );
  }

  // Vérifier s'il existe déjà une session active sur un autre appareil
  if (!forceNewSession) {
    const activeCount = await countActiveSessionsForUser(user.id);
    if (activeCount > 0) {
      return NextResponse.json({ multiSession: true, sessionCount: activeCount }, { status: 200 });
    }
  } else {
    await revokeAllAuthSessionsForUser(user.id);
  }

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

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
  });
  res.cookies.set(AUTH_SESSION_COOKIE, sessionToken, authCookieOptions(expiresAt, rememberMe));
  return res;
}
