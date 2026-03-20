import { NextRequest, NextResponse } from "next/server";
import {
  deleteAuthUserById,
  findAuthUserByEmail,
  findAuthUserById,
  revokeAllAuthSessionsForUser,
  updateAuthUserPassword,
  updateAuthUserProfile,
} from "@/lib/auth/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  AUTH_SESSION_COOKIE,
  clearAuthCookieOptions,
  getAuthUserFromRequest,
  normalizeAuthEmail,
} from "@/lib/auth/session";
import {
  adjustUserJournalBalance,
  getOrCreateUserSettings,
  updateUserSettings,
  type OddsFormat,
  type StakeMode,
} from "@/lib/account/user-settings-db";
import { deleteAllNbaBetJournalEntries } from "@/lib/nba/bet-journal-db";

type PatchBody = {
  displayName?: string | null;
  email?: string | null;
  defaultBookmaker?: string | null;
  oddsFormat?: OddsFormat | string | null;
  stakeMode?: StakeMode | string | null;
  stakePct?: number | null;
  stakeCash?: number | null;
  timezone?: string | null;
};

type ActionBody = {
  action?: string;
  direction?: "add" | "withdraw";
  amount?: number;
  currentPassword?: string;
  newPassword?: string;
  confirmText?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function asNumber(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return bad("Connecte-toi pour accéder aux settings.", 401);
  }

  const settings = await getOrCreateUserSettings(session.user.id);
  return NextResponse.json({
    ok: true,
    account: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      createdAt: session.user.createdAt,
      sessionExpiresAt: session.expiresAt ?? null,
    },
    settings,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return bad("Connecte-toi pour modifier les settings.", 401);
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return bad("Corps JSON invalide.");
  }

  const hasProfilePatch =
    Object.prototype.hasOwnProperty.call(body, "displayName") ||
    Object.prototype.hasOwnProperty.call(body, "email");
  const hasPrefsPatch =
    Object.prototype.hasOwnProperty.call(body, "defaultBookmaker") ||
    Object.prototype.hasOwnProperty.call(body, "oddsFormat") ||
    Object.prototype.hasOwnProperty.call(body, "stakeMode") ||
    Object.prototype.hasOwnProperty.call(body, "stakePct") ||
    Object.prototype.hasOwnProperty.call(body, "stakeCash") ||
    Object.prototype.hasOwnProperty.call(body, "timezone");

  if (!hasProfilePatch && !hasPrefsPatch) {
    return bad("Aucun champ à mettre à jour.");
  }

  let account = {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    createdAt: session.user.createdAt,
    sessionExpiresAt: session.expiresAt ?? null,
  };

  if (hasProfilePatch) {
    const nextDisplayNameRaw = String(body.displayName ?? "").trim();
    const nextDisplayName =
      body.displayName === undefined
        ? undefined
        : nextDisplayNameRaw.length
          ? nextDisplayNameRaw
          : null;

    const nextEmailRaw = String(body.email ?? "").trim();
    const nextEmail =
      body.email === undefined
        ? undefined
        : nextEmailRaw.length
          ? normalizeAuthEmail(nextEmailRaw)
          : null;

    if (nextEmail !== undefined) {
      if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return bad("Email invalide.");
      }
      const existing = await findAuthUserByEmail(nextEmail);
      if (existing && existing.id !== session.user.id) {
        return bad("Cet email est déjà utilisé.", 409);
      }
    }

    const updatedUser = await updateAuthUserProfile({
      userId: session.user.id,
      email: nextEmail,
      displayName: nextDisplayName,
    });
    if (!updatedUser) return bad("Impossible de mettre à jour le compte.", 500);
    account = {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      createdAt: updatedUser.createdAt,
      sessionExpiresAt: session.expiresAt ?? null,
    };
  }

  let settings = await getOrCreateUserSettings(session.user.id);
  if (hasPrefsPatch) {
    const stakePct = body.stakePct === undefined ? undefined : asNumber(body.stakePct);
    const stakeCash = body.stakeCash === undefined ? undefined : asNumber(body.stakeCash);
    if (stakePct !== undefined && (stakePct === null || stakePct < 0)) {
      return bad("Stake % invalide.");
    }
    if (stakeCash !== undefined && (stakeCash === null || stakeCash < 0)) {
      return bad("Stake $ invalide.");
    }

    settings = await updateUserSettings(session.user.id, {
      defaultBookmaker:
        body.defaultBookmaker === undefined
          ? undefined
          : String(body.defaultBookmaker ?? ""),
      oddsFormat:
        body.oddsFormat === undefined
          ? undefined
          : String(body.oddsFormat ?? "").toLowerCase() === "american"
            ? "american"
            : "decimal",
      stakeMode:
        body.stakeMode === undefined
          ? undefined
          : String(body.stakeMode ?? "").toLowerCase() === "cash"
            ? "cash"
            : "pct",
      stakePct: stakePct ?? undefined,
      stakeCash: stakeCash ?? undefined,
      timezone:
        body.timezone === undefined ? undefined : String(body.timezone ?? "").trim(),
    });
  }

  return NextResponse.json({ ok: true, account, settings });
}

export async function POST(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return bad("Connecte-toi pour modifier les settings.", 401);
  }

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return bad("Corps JSON invalide.");
  }

  const action = String(body.action ?? "").trim().toLowerCase();
  if (!action) return bad("Action manquante.");

  if (action === "balance.adjust") {
    const amount = asNumber(body.amount);
    const direction = body.direction === "withdraw" ? "withdraw" : "add";
    if (amount === null || amount <= 0) return bad("Montant invalide.");

    const adjusted = await adjustUserJournalBalance({
      userId: session.user.id,
      direction,
      amount,
    });
    if (!adjusted.ok) return bad(adjusted.error ?? "Impossible d'ajuster le solde.");
    return NextResponse.json({ ok: true, settings: adjusted.settings });
  }

  if (action === "password.change") {
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return bad("Mot de passe actuel et nouveau mot de passe requis.");
    }
    if (newPassword.length < 8) {
      return bad("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    }
    const user = await findAuthUserById(session.user.id);
    if (!user) return bad("Compte introuvable.", 404);
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return bad("Mot de passe actuel invalide.", 401);
    const nextHash = await hashPassword(newPassword);
    await updateAuthUserPassword(session.user.id, nextHash);
    return NextResponse.json({ ok: true });
  }

  if (action === "journal.reset") {
    const deleted = await deleteAllNbaBetJournalEntries({ userId: session.user.id });
    return NextResponse.json({ ok: true, deleted });
  }

  if (action === "account.delete") {
    const confirmText = String(body.confirmText ?? "").trim().toUpperCase();
    if (confirmText !== "DELETE") {
      return bad("Confirme avec DELETE.");
    }
    await deleteAllNbaBetJournalEntries({ userId: session.user.id });
    await revokeAllAuthSessionsForUser(session.user.id);
    await deleteAuthUserById(session.user.id);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_SESSION_COOKIE, "", clearAuthCookieOptions());
    return res;
  }

  return bad("Action non supportée.");
}

