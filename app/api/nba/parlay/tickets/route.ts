import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/session";
import {
  createNbaParlayTicket,
  listNbaParlayTickets,
  updateNbaParlayTicketStatus,
} from "@/lib/nba/parlay-db";
import type { ParlayLegSide, ParlayLegV1, ParlayTicketStatus } from "@/types/parlay";

const MIN_LEGS = 2;
const MAX_LEGS = 10;

function toNumber(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function toInt(value: unknown): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.trunc(n);
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSide(value: unknown): ParlayLegSide | null {
  const side = String(value ?? "")
    .trim()
    .toLowerCase();
  if (side === "over") return "over";
  if (side === "under") return "under";
  return null;
}

function americanToDecimal(value: number): number | null {
  if (!Number.isFinite(value) || value === 0) return null;
  if (value > 0) return 1 + value / 100;
  return 1 + 100 / Math.abs(value);
}

function decimalToAmerican(value: number): number | null {
  if (!Number.isFinite(value) || value <= 1) return null;
  if (value >= 2) return Math.round((value - 1) * 100);
  return Math.round(-100 / (value - 1));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function duplicateKey(leg: ParlayLegV1): string {
  return [
    leg.gameId ?? "na",
    normalizeToken(leg.player),
    normalizeToken(leg.market),
    leg.side,
    leg.line.toString(),
  ].join("::");
}

function contradictionKey(leg: ParlayLegV1): string {
  return [
    leg.gameId ?? "na",
    normalizeToken(leg.player),
    normalizeToken(leg.market),
    leg.line.toString(),
  ].join("::");
}

function normalizeLeg(raw: unknown): ParlayLegV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const side = normalizeSide(rec.side);
  const player = normalizeText(rec.player);
  const market = normalizeText(rec.market);
  const line = toNumber(rec.line);
  if (!side || !player || !market || !Number.isFinite(line ?? NaN)) return null;

  const oddsDecimalRaw = toNumber(rec.oddsDecimal);
  const oddsAmericanRaw = toNumber(rec.oddsAmerican);
  const oddsDecimal =
    oddsDecimalRaw !== null && oddsDecimalRaw > 1
      ? oddsDecimalRaw
      : oddsAmericanRaw !== null
        ? americanToDecimal(oddsAmericanRaw)
        : null;
  if (oddsDecimal === null || oddsDecimal <= 1) return null;

  const gameId = toInt(rec.gameId);
  const legId =
    normalizeText(rec.legId) ||
    [
      "nba",
      gameId ?? "na",
      normalizeToken(player).replace(/\s+/g, "-") || "player",
      normalizeToken(market).replace(/\s+/g, "-") || "market",
      side,
      line,
    ].join(":");

  return {
    legId,
    sport: "NBA",
    gameId,
    eventDate: normalizeText(rec.eventDate) || null,
    playerId: toInt(rec.playerId),
    player,
    market,
    side,
    line: Number(line),
    oddsDecimal: round(oddsDecimal, 4),
    oddsAmerican:
      oddsAmericanRaw !== null
        ? Math.trunc(oddsAmericanRaw)
        : decimalToAmerican(oddsDecimal),
    teamCode: normalizeText(rec.teamCode) || null,
    opponentCode: normalizeText(rec.opponentCode) || null,
    bookmakerKey: normalizeText(rec.bookmakerKey) || null,
    bookmakerName: normalizeText(rec.bookmakerName) || null,
    source: (normalizeText(rec.source) as ParlayLegV1["source"]) || "manual",
  };
}

export async function GET(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour consulter tes tickets parlay." },
      { status: 401 },
    );
  }
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? NaN);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.trunc(limitRaw)) : 40;

  try {
    const tickets = await listNbaParlayTickets({
      userId: session.user.id,
      limit,
    });
    return NextResponse.json({
      ok: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Parlay tickets fetch failed",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const ticketId = String(body.ticketId ?? "").trim();
  const rawStatus = String(body.status ?? "").toLowerCase().trim();

  if (!ticketId) {
    return NextResponse.json({ ok: false, error: "ticketId requis." }, { status: 400 });
  }

  const validStatuses: ParlayTicketStatus[] = ["open", "won", "lost", "void"];
  if (!validStatuses.includes(rawStatus as ParlayTicketStatus)) {
    return NextResponse.json({ ok: false, error: "Statut invalide." }, { status: 400 });
  }

  const updated = await updateNbaParlayTicketStatus({
    ticketId,
    userId: session.user.id,
    status: rawStatus as ParlayTicketStatus,
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Ticket non trouvé ou non autorisé." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await getAuthUserFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Connecte-toi pour sauvegarder un parlay." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawLegs = Array.isArray(body.legs) ? body.legs : [];
  const legs = rawLegs.map((raw) => normalizeLeg(raw)).filter((leg): leg is ParlayLegV1 => Boolean(leg));
  if (legs.length !== rawLegs.length) {
    return NextResponse.json(
      { ok: false, error: "Un ou plusieurs legs sont invalides." },
      { status: 400 },
    );
  }
  if (legs.length < MIN_LEGS) {
    return NextResponse.json(
      { ok: false, error: `Minimum ${MIN_LEGS} legs requis.` },
      { status: 400 },
    );
  }
  if (legs.length > MAX_LEGS) {
    return NextResponse.json(
      { ok: false, error: `Maximum ${MAX_LEGS} legs autorises.` },
      { status: 400 },
    );
  }

  const duplicateSeen = new Set<string>();
  for (const leg of legs) {
    const key = duplicateKey(leg);
    if (duplicateSeen.has(key)) {
      return NextResponse.json(
        { ok: false, error: "Doublon detecte dans les legs." },
        { status: 400 },
      );
    }
    duplicateSeen.add(key);
  }

  const contradiction = new Map<string, { over: number; under: number }>();
  for (const leg of legs) {
    const key = contradictionKey(leg);
    const item = contradiction.get(key) ?? { over: 0, under: 0 };
    item[leg.side] += 1;
    contradiction.set(key, item);
  }
  for (const item of contradiction.values()) {
    if (item.over > 0 && item.under > 0) {
      return NextResponse.json(
        { ok: false, error: "Legs contradictoires detectes (over/under meme line)." },
        { status: 400 },
      );
    }
  }

  const stakeRaw = toNumber(body.stake);
  const stake = stakeRaw !== null && stakeRaw >= 0 ? round(stakeRaw, 2) : null;
  const combinedDecimal = round(
    legs.reduce((acc, leg) => acc * leg.oddsDecimal, 1),
    4,
  );
  const combinedAmerican = decimalToAmerican(combinedDecimal);
  const payout = stake !== null ? round(stake * combinedDecimal, 2) : null;
  const profit = payout !== null && stake !== null ? round(payout - stake, 2) : null;
  const bookmakers = Array.from(
    new Set(
      legs
        .map((leg) => leg.bookmakerName ?? leg.bookmakerKey ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  try {
    const created = await createNbaParlayTicket({
      userId: session.user.id,
      league: "NBA",
      bookmaker: bookmakers.length === 1 ? bookmakers[0] : null,
      legs,
      combinedDecimal,
      combinedAmerican,
      stake,
      payout,
      profit,
      status: "open",
      note: normalizeText(body.note) || null,
    });

    if (!created) {
      return NextResponse.json(
        { ok: false, error: "Impossible de sauvegarder le parlay." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ticket: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Parlay save failed",
      },
      { status: 500 },
    );
  }
}
