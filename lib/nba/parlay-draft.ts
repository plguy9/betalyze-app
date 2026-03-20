import type { ParlayLegV1 } from "@/types/parlay";

export const NBA_PARLAY_DRAFT_STORAGE_KEY = "betalyze_nba_parlay_draft_v1";
const MAX_PARLAY_LEGS = 10;

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parlayLegIdentityKey(leg: {
  gameId: number | null;
  player: string;
  market: string;
  side: string;
  line: number;
}): string {
  return [
    leg.gameId ?? "na",
    normalizeToken(leg.player),
    normalizeToken(leg.market),
    normalizeToken(leg.side),
    Number(leg.line),
  ].join("::");
}

function normalizeLeg(raw: unknown): ParlayLegV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const player = String(rec.player ?? "").trim();
  const market = String(rec.market ?? "").trim();
  const side = String(rec.side ?? "").trim().toLowerCase();
  const line = Number(rec.line ?? NaN);
  const oddsDecimal = Number(rec.oddsDecimal ?? NaN);
  if (!player || !market) return null;
  if (side !== "over" && side !== "under") return null;
  if (!Number.isFinite(line) || !Number.isFinite(oddsDecimal) || oddsDecimal <= 1) return null;

  return {
    legId: String(rec.legId ?? "").trim() || `${parlayLegIdentityKey({
      gameId: Number.isFinite(Number(rec.gameId ?? NaN)) ? Number(rec.gameId) : null,
      player,
      market,
      side,
      line,
    })}:${Date.now()}`,
    sport: "NBA",
    gameId: Number.isFinite(Number(rec.gameId ?? NaN)) ? Math.trunc(Number(rec.gameId)) : null,
    eventDate: rec.eventDate ? String(rec.eventDate) : null,
    playerId: Number.isFinite(Number(rec.playerId ?? NaN)) ? Math.trunc(Number(rec.playerId)) : null,
    player,
    market,
    side,
    line,
    oddsDecimal,
    oddsAmerican: Number.isFinite(Number(rec.oddsAmerican ?? NaN))
      ? Math.trunc(Number(rec.oddsAmerican))
      : null,
    teamCode: rec.teamCode ? String(rec.teamCode) : null,
    opponentCode: rec.opponentCode ? String(rec.opponentCode) : null,
    bookmakerKey: rec.bookmakerKey ? String(rec.bookmakerKey) : null,
    bookmakerName: rec.bookmakerName ? String(rec.bookmakerName) : null,
    source: rec.source ? String(rec.source) as ParlayLegV1["source"] : "manual",
  };
}

export function readParlayDraftLegs(): ParlayLegV1[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NBA_PARLAY_DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeLeg(item)).filter((item): item is ParlayLegV1 => Boolean(item));
  } catch {
    return [];
  }
}

export function writeParlayDraftLegs(legs: ParlayLegV1[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NBA_PARLAY_DRAFT_STORAGE_KEY,
      JSON.stringify(legs.slice(0, MAX_PARLAY_LEGS)),
    );
  } catch {
    // ignore storage errors
  }
}

export function clearParlayDraftLegs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NBA_PARLAY_DRAFT_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function upsertParlayDraftLeg(leg: ParlayLegV1): {
  added: boolean;
  legs: ParlayLegV1[];
} {
  const current = readParlayDraftLegs();
  const key = parlayLegIdentityKey(leg);
  const has = current.some((item) => parlayLegIdentityKey(item) === key);
  if (has) return { added: false, legs: current };
  if (current.length >= MAX_PARLAY_LEGS) return { added: false, legs: current };
  const next = [...current, leg];
  writeParlayDraftLegs(next);
  return { added: true, legs: next };
}
