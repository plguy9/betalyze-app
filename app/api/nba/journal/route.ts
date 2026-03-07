import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/session";
import {
  createNbaBetJournalEntry,
  deleteNbaBetJournalEntry,
  listNbaBetJournalEntries,
  updateNbaBetJournalEntry,
  updateNbaBetJournalEntryResult,
  type BetJournalResult,
  type BetJournalSide,
  type BetJournalStakeMode,
  type BetJournalTone,
  type UpdateBetJournalInput,
} from "@/lib/nba/bet-journal-db";

function normalizeSide(value: string | null): BetJournalSide {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "over" || normalized === "o") return "over";
  if (normalized === "under" || normalized === "u") return "under";
  return "all";
}

function normalizeResult(value: string | null): BetJournalResult {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "W") return "W";
  if (normalized === "L") return "L";
  return "V";
}

function normalizeTone(value: string | null): BetJournalTone {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    normalized === "red" ||
    normalized === "blue" ||
    normalized === "green" ||
    normalized === "purple" ||
    normalized === "orange"
  ) {
    return normalized;
  }
  return "neutral";
}

function normalizeStakeMode(value: string | null): BetJournalStakeMode {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "cash") return "cash";
  return "pct";
}

function readNumeric(value: unknown): number | null {
  const parsed = Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour accéder au journal." },
      { status: 401 },
    );
  }
  const q = req.nextUrl.searchParams.get("q");
  const view = normalizeSide(req.nextUrl.searchParams.get("view"));
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? NaN);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 120;

  try {
    const entries = await listNbaBetJournalEntries({
      userId: session.user.id,
      q,
      view,
      limit,
    });
    return NextResponse.json({
      ok: true,
      count: entries.length,
      generatedAt: new Date().toISOString(),
      entries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Journal fetch failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour ajouter une entrée au journal." },
      { status: 401 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const player = String(body.player ?? "").trim();
  const prop = String(body.prop ?? "").trim();
  if (!player || !prop) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: player, prop" },
      { status: 400 },
    );
  }

  try {
    const created = await createNbaBetJournalEntry({
      userId: session.user.id,
      player,
      prop,
      team: body.team ? String(body.team) : null,
      opp: body.opp ? String(body.opp) : null,
      side: normalizeSide(body.side ? String(body.side) : null),
      odds: readNumeric(body.odds),
      tag: body.tag ? String(body.tag) : null,
      edgePct: readNumeric(body.edgePct),
      score: readNumeric(body.score),
      grade: body.grade ? String(body.grade) : null,
      result: normalizeResult(body.result ? String(body.result) : null),
      stakeMode: normalizeStakeMode(body.stakeMode ? String(body.stakeMode) : null),
      stakePct: readNumeric(body.stakePct),
      stakeCash: readNumeric(body.stakeCash),
      clv: readNumeric(body.clv),
      note: body.note ? String(body.note) : null,
      tone: normalizeTone(body.tone ? String(body.tone) : null),
      bookmaker: body.bookmaker ? String(body.bookmaker) : null,
      eventDate: body.eventDate ? String(body.eventDate) : null,
    });

    if (!created) {
      return NextResponse.json({ ok: false, error: "Failed to create entry" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, entry: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Create entry failed",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour modifier une entrée de ton journal." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }
  const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (hasField("result") && Object.keys(body).length <= 2) {
    const result = normalizeResult(body.result ? String(body.result) : null);
    try {
      const updated = await updateNbaBetJournalEntryResult({
        userId: session.user.id,
        id,
        result,
      });
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "Entrée introuvable ou non modifiable" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, entry: updated });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Update entry failed",
        },
        { status: 500 },
      );
    }
  }

  const payload: Partial<UpdateBetJournalInput> = {};
  if (hasField("league")) payload.league = body.league ? String(body.league) : null;
  if (hasField("player")) payload.player = body.player ? String(body.player) : null;
  if (hasField("prop")) payload.prop = body.prop ? String(body.prop) : null;
  if (hasField("team")) payload.team = body.team ? String(body.team) : null;
  if (hasField("opp")) payload.opp = body.opp ? String(body.opp) : null;
  if (hasField("side")) payload.side = normalizeSide(body.side ? String(body.side) : null);
  if (hasField("odds")) payload.odds = readNumeric(body.odds);
  if (hasField("tag")) payload.tag = body.tag ? String(body.tag) : null;
  if (hasField("edgePct")) payload.edgePct = readNumeric(body.edgePct);
  if (hasField("score")) payload.score = readNumeric(body.score);
  if (hasField("grade")) payload.grade = body.grade ? String(body.grade) : null;
  if (hasField("result")) payload.result = normalizeResult(body.result ? String(body.result) : null);
  if (hasField("stakeMode")) payload.stakeMode = normalizeStakeMode(body.stakeMode ? String(body.stakeMode) : null);
  if (hasField("stakePct")) payload.stakePct = readNumeric(body.stakePct);
  if (hasField("stakeCash")) payload.stakeCash = readNumeric(body.stakeCash);
  if (hasField("clv")) payload.clv = readNumeric(body.clv);
  if (hasField("note")) payload.note = body.note ? String(body.note) : null;
  if (hasField("tone")) payload.tone = normalizeTone(body.tone ? String(body.tone) : null);
  if (hasField("bookmaker")) payload.bookmaker = body.bookmaker ? String(body.bookmaker) : null;
  if (hasField("eventDate")) payload.eventDate = body.eventDate ? String(body.eventDate) : null;

  if (!Object.keys(payload).length) {
    return NextResponse.json(
      { ok: false, error: "Aucun champ à modifier" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateNbaBetJournalEntry({
      userId: session.user.id,
      id,
      ...payload,
    });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Entrée introuvable ou non modifiable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, entry: updated });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Update entry failed",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour supprimer une entrée de ton journal." },
      { status: 401 },
    );
  }

  let id = String(req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      id = String(body.id ?? "").trim();
    } catch {
      // no body
    }
  }

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const deleted = await deleteNbaBetJournalEntry({
      userId: session.user.id,
      id,
    });
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "Entrée introuvable ou non supprimable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Delete entry failed",
      },
      { status: 500 },
    );
  }
}
