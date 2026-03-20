import { NextRequest, NextResponse } from "next/server";
import type {
  ParlayLegSide,
  ParlayLegV1,
  ParlayQuoteRequestV1,
  ParlayQuoteResponseV1,
  ParlayQuoteWarningV1,
} from "@/types/parlay";

const MIN_LEGS = 2;
const MAX_LEGS = 10;

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function normalizeSide(value: unknown): ParlayLegSide | null {
  const side = String(value ?? "")
    .trim()
    .toLowerCase();
  if (side === "over") return "over";
  if (side === "under") return "under";
  return null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function buildLegId(leg: {
  gameId: number | null;
  player: string;
  market: string;
  side: ParlayLegSide;
  line: number;
  bookmakerKey: string | null;
}) {
  const gamePart = leg.gameId !== null ? String(leg.gameId) : "na";
  const playerPart = normalizeToken(leg.player).replace(/\s+/g, "-") || "player";
  const marketPart = normalizeToken(leg.market).replace(/\s+/g, "-") || "market";
  const bookPart = normalizeToken(leg.bookmakerKey ?? "").replace(/\s+/g, "-") || "book";
  return `nba:${gamePart}:${playerPart}:${marketPart}:${leg.side}:${leg.line}:${bookPart}`;
}

function normalizeLeg(raw: unknown, idx: number): ParlayLegV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const side = normalizeSide(rec.side);
  const player = normalizeText(rec.player);
  const market = normalizeText(rec.market);
  const line = toFiniteNumber(rec.line);
  const gameId = toFiniteNumber(rec.gameId);
  const oddsDecimalRaw = toFiniteNumber(rec.oddsDecimal);
  const oddsAmericanRaw = toFiniteNumber(rec.oddsAmerican);

  const oddsDecimal =
    oddsDecimalRaw && oddsDecimalRaw > 1
      ? oddsDecimalRaw
      : oddsAmericanRaw
        ? americanToDecimal(oddsAmericanRaw)
        : null;

  if (!side || !player || !market || !Number.isFinite(line ?? NaN) || !oddsDecimal) return null;

  const bookmakerKey = normalizeText(rec.bookmakerKey) || null;
  const parsed: ParlayLegV1 = {
    legId:
      normalizeText(rec.legId) ||
      buildLegId({
        gameId: gameId !== null ? Math.trunc(gameId) : null,
        player,
        market,
        side,
        line: Number(line),
        bookmakerKey,
      }),
    sport: "NBA",
    gameId: gameId !== null ? Math.trunc(gameId) : null,
    eventDate: normalizeText(rec.eventDate) || null,
    playerId:
      toFiniteNumber(rec.playerId) !== null
        ? Math.trunc(Number(rec.playerId))
        : null,
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
    bookmakerKey,
    bookmakerName: normalizeText(rec.bookmakerName) || null,
    source: (normalizeText(rec.source) as ParlayLegV1["source"]) || "manual",
  };

  // Keep leg deterministic in payload order when generated from scratch.
  if (!normalizeText(rec.legId)) {
    parsed.legId = `${parsed.legId}:${idx + 1}`;
  }

  return parsed;
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

export async function POST(req: NextRequest) {
  let body: ParlayQuoteRequestV1 | Record<string, unknown>;
  try {
    body = (await req.json()) as ParlayQuoteRequestV1;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const rawLegs = Array.isArray((body as Record<string, unknown>).legs)
    ? ((body as Record<string, unknown>).legs as unknown[])
    : [];
  const stakeRaw = toFiniteNumber((body as Record<string, unknown>).stake);
  const stake = stakeRaw !== null && stakeRaw >= 0 ? round(stakeRaw, 2) : null;

  const warnings: ParlayQuoteWarningV1[] = [];
  const legs: ParlayLegV1[] = rawLegs
    .map((raw, idx) => normalizeLeg(raw, idx))
    .filter((leg): leg is ParlayLegV1 => Boolean(leg));

  if (legs.length < MIN_LEGS) {
    warnings.push({
      code: "MIN_LEGS",
      message: `Minimum ${MIN_LEGS} legs requis.`,
      legIds: legs.map((leg) => leg.legId),
    });
  }
  if (legs.length > MAX_LEGS) {
    warnings.push({
      code: "MAX_LEGS",
      message: `Maximum ${MAX_LEGS} legs autorises.`,
      legIds: legs.slice(MAX_LEGS).map((leg) => leg.legId),
    });
  }
  if (rawLegs.length !== legs.length) {
    warnings.push({
      code: "INVALID_LEG",
      message: "Un ou plusieurs legs sont invalides.",
      legIds: [],
    });
  }
  if (
    stakeRaw !== null &&
    (!Number.isFinite(stakeRaw) || stakeRaw < 0)
  ) {
    warnings.push({
      code: "INVALID_STAKE",
      message: "Stake invalide.",
      legIds: [],
    });
  }

  const duplicateMap = new Map<string, string[]>();
  for (const leg of legs) {
    const key = duplicateKey(leg);
    const list = duplicateMap.get(key) ?? [];
    list.push(leg.legId);
    duplicateMap.set(key, list);
  }
  for (const legIds of duplicateMap.values()) {
    if (legIds.length > 1) {
      warnings.push({
        code: "DUPLICATE_LEG",
        message: "Leg duplique detecte.",
        legIds,
      });
    }
  }

  const contradictionMap = new Map<string, { over: string[]; under: string[] }>();
  for (const leg of legs) {
    const key = contradictionKey(leg);
    const existing = contradictionMap.get(key) ?? { over: [], under: [] };
    existing[leg.side].push(leg.legId);
    contradictionMap.set(key, existing);
  }
  for (const item of contradictionMap.values()) {
    if (item.over.length && item.under.length) {
      warnings.push({
        code: "CONTRADICTORY_LEG",
        message: "Legs contradictoires detectes (over + under meme line).",
        legIds: [...item.over, ...item.under],
      });
    }
  }

  for (const leg of legs) {
    if (!Number.isFinite(leg.oddsDecimal) || leg.oddsDecimal <= 1) {
      warnings.push({
        code: "INVALID_ODDS",
        message: "Odds invalides detectees.",
        legIds: [leg.legId],
      });
    }
  }

  const hasBlockingWarnings = warnings.length > 0;
  const response: ParlayQuoteResponseV1 = {
    ok: !hasBlockingWarnings,
    combinedDecimal: null,
    combinedAmerican: null,
    impliedProbability: null,
    stake,
    payout: null,
    profit: null,
    warnings,
  };

  if (hasBlockingWarnings) {
    return NextResponse.json(response, { status: 200 });
  }

  const combinedDecimal = round(
    legs.reduce((acc, leg) => acc * leg.oddsDecimal, 1),
    4,
  );
  const combinedAmerican = decimalToAmerican(combinedDecimal);
  const impliedProbability = round(1 / combinedDecimal, 6);
  const payout =
    stake !== null ? round(stake * combinedDecimal, 2) : null;
  const profit =
    payout !== null && stake !== null ? round(payout - stake, 2) : null;

  response.combinedDecimal = combinedDecimal;
  response.combinedAmerican = combinedAmerican;
  response.impliedProbability = impliedProbability;
  response.payout = payout;
  response.profit = profit;

  return NextResponse.json(response, { status: 200 });
}
