import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false, user: null });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt,
  });
}
