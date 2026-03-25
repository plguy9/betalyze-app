import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  readNbaTopPropsDailyCache,
  writeNbaTopPropsDailyCache,
} from "@/lib/supabase/nba-top-props-cache";

const RAW_LEAGUE_ID =
  process.env.APISPORTS_NBA_LEAGUE_ID ?? "standard";
const NORMALIZED_GAMES_LEAGUE = (() => {
  const value = String(RAW_LEAGUE_ID).trim().toLowerCase();
  if (!value || value === "nba" || value === "12") return "standard";
  return value;
})();
const NBA_LEAGUE_ID_NUM = Number.isFinite(Number(RAW_LEAGUE_ID))
  ? Number(RAW_LEAGUE_ID)
  : 12;
const NBA_REGULAR_START_BY_SEASON: Record<string, string> = {
  "2024": "2024-10-22",
  "2024-2025": "2024-10-22",
  "2025": "2025-10-21",
  "2025-2026": "2025-10-21",
};
const QUERY_TIMEZONE = "America/Toronto";
const MAX_PROP_LOG_AGE_DAYS = 14;

const CACHE_TTL_MS = 5 * 60 * 1000;
type CachedTopPropsPayload = {
  generatedAt: string;
  date: string;
  season: string;
  mode?: "default" | "alternates_best";
  gameId: number | null;
  events: number;
  propsAnalyzed: number;
  props: TopProp[];
};
const memoryCache = new Map<
  string,
  { expiresAt: number; payload: CachedTopPropsPayload }
>();

const FINISHED_STATUSES = new Set([
  "FT",
  "AOT",
  "AET",
  "AWD",
  "WO",
  "ABD",
  "CAN",
  "PEN",
  "POST",
  "3",
]);

const SLATE_GAME_STATUSES = new Set([
  "NS",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "HT",
  "OT",
  "LIVE",
  "1Q",
  "2Q",
  "3Q",
  "4Q",
]);

function isPlayableSlateStatus(statusRaw: string | null | undefined) {
  const status = String(statusRaw ?? "")
    .trim()
    .toUpperCase();
  if (!status) return false;
  if (FINISHED_STATUSES.has(status)) return false;
  return SLATE_GAME_STATUSES.has(status);
}

const TEAM_CODE_BY_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  140: "DET",
  143: "IND",
  147: "MIA",
  148: "MIL",
  151: "NYK",
  153: "ORL",
  154: "PHI",
  159: "TOR",
  161: "WAS",
  138: "DAL",
  139: "DEN",
  141: "GSW",
  142: "HOU",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  149: "MIN",
  150: "NOP",
  152: "OKC",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  160: "UTA",
};
const TEAM_ID_BY_CODE: Record<string, number> = Object.entries(TEAM_CODE_BY_ID).reduce(
  (acc, [id, code]) => {
    acc[String(code).toUpperCase()] = Number(id);
    return acc;
  },
  {} as Record<string, number>,
);

type ApiGame = {
  id?: number | null;
  date?: string | null;
  status?: { short?: string | null } | null;
  league?: { id?: number | null } | null;
  teams?: {
    home?: { id?: number | null; name?: string | null; code?: string | null };
    away?: { id?: number | null; name?: string | null; code?: string | null };
  } | null;
};

type OddsProp = {
  name: string;
  metric: string;
  line: number;
  odd: string | null;
  overOdd?: string | null;
  underOdd?: string | null;
  isAlternate?: boolean | null;
  teamCode?: string | null;
  opponentCode?: string | null;
  bookmakerName?: string | null;
};

type OddsPayload = {
  ok: boolean;
  game: number | null;
  playerProps?: OddsProp[];
  availableBookmakers?: Array<{ key?: string | null; name?: string | null }>;
};

type PlayerRow = {
  player_id: number;
  full_name: string;
  team_id: number | null;
  team_code: string | null;
  position: string | null;
  updated_at?: string | null;
};

type PlayerLogFreshnessRow = {
  player_id: number;
  last_date: string | null;
  games: number;
};

type LogRow = {
  player_id: number;
  game_id: number | null;
  date: string | null;
  league_id: number | null;
  status_short: string | null;
  is_preseason: boolean | null;
  team_id: number | null;
  team_code: string | null;
  opponent_team_code: string | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_points_made: number | null;
  minutes: number | null;
  field_goals_attempted: number | null;
  three_points_attempted: number | null;
  free_throws_attempted: number | null;
  home_away: string | null;
  result: string | null;
};

type MetricKey = "PTS" | "REB" | "AST" | "3PT" | "PRA" | "P+A" | "P+R" | "R+A";
type TrendMetricKey = "pts" | "reb" | "ast" | "tp" | "pra";
type DvpPosition = "G" | "F" | "C";
type DvpStatTotals = {
  points?: number | null;
  rebounds?: number | null;
  assists?: number | null;
  minutes?: number | null;
  threePointsMade?: number | null;
  fieldGoalsMade?: number | null;
  fieldGoalsAttempted?: number | null;
  freeThrowsMade?: number | null;
  freeThrowsAttempted?: number | null;
};
type DvpRow = {
  teamId: number;
  teamAbbr?: string | null;
  position: DvpPosition;
  games: number;
  btpPerGame: number;
  rank?: number | null;
  metrics?: {
    perGame?: DvpStatTotals | null;
  } | null;
};

type TopProp = {
  id: string;
  playerId: number | null;
  player: string;
  teamCode: string | null;
  opponentCode: string | null;
  metric: MetricKey;
  side: "over" | "under";
  line: number;
  odds: number;
  edge: number;
  score: number;
  grade: string;
  finalScore: number;
  gameId: number | null;
  bookmaker: string | null;
  hitRate?: number;
  hitRateL5?: number;
  hitRateL10?: number;
  hitRateL20?: number;
  seasonHitRate?: number;
  impliedProbability?: number;
  modelEdge?: number;
  dvpScore?: number;
  dvpRank?: number | null;
  dvpTotalTeams?: number | null;
  dvpValue?: number | null;
  dvpMetricFlag?: "weakness" | "strength" | "neutral" | null;
  dvpPosition?: string | null;
  consistencyScore?: number;
  recommendationTag?: "SAFE" | "BALANCED" | "AGGRESSIVE" | "LONGSHOT";
  restDaysEdge?: number;
  splitEdge?: number;
};

function parseCachedPayload(raw: unknown): CachedTopPropsPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  if (typeof payload.generatedAt !== "string") return null;
  if (typeof payload.date !== "string") return null;
  if (typeof payload.season !== "string") return null;
  const events = Number(payload.events);
  const propsAnalyzed = Number(payload.propsAnalyzed);
  if (!Number.isFinite(events) || !Number.isFinite(propsAnalyzed)) return null;
  const props = Array.isArray(payload.props) ? (payload.props as TopProp[]) : null;
  if (!props) return null;
  const rawGameId = payload.gameId;
  const gameId =
    rawGameId === null || rawGameId === undefined
      ? null
      : Number.isFinite(Number(rawGameId))
        ? Math.trunc(Number(rawGameId))
        : null;
  return {
    generatedAt: payload.generatedAt,
    date: payload.date,
    season: payload.season,
    mode:
      payload.mode === "alternates_best" || payload.mode === "default"
        ? payload.mode
        : "default",
    gameId,
    events: Math.trunc(events),
    propsAnalyzed: Math.trunc(propsAnalyzed),
    props,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOdd(value: string | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

function decimalToAmericanOdds(decimal: number): number | null {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

function weightedAverage(
  items: Array<{ value: number; weight: number; enabled?: boolean }>,
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const item of items) {
    if (!Number.isFinite(item.value) || !Number.isFinite(item.weight) || item.weight <= 0) continue;
    if (item.enabled === false) continue;
    weighted += item.value * item.weight;
    totalWeight += item.weight;
  }
  if (totalWeight <= 0) return 0;
  return weighted / totalWeight;
}

function dvpScoreFromRank(rank: number | null): number {
  if (!rank || !Number.isFinite(rank)) return 0;
  if (rank <= 5) return -10;
  if (rank <= 10) return -5;
  if (rank <= 20) return 0;
  if (rank <= 25) return 5;
  return 10;
}

function consistencyScoreFromCv(cv: number): number {
  if (!Number.isFinite(cv)) return 0;
  if (cv <= 0.18) return 10;
  if (cv <= 0.28) return 5;
  if (cv <= 0.38) return 0;
  if (cv <= 0.5) return -5;
  return -10;
}

function recommendationTagFromSignals(
  hitRate: number,
  americanOdds: number | null,
): "SAFE" | "BALANCED" | "AGGRESSIVE" | "LONGSHOT" {
  if (
    Number.isFinite(hitRate) &&
    hitRate > 70 &&
    americanOdds !== null &&
    americanOdds >= -300 &&
    americanOdds <= -150
  ) {
    return "SAFE";
  }
  if (
    Number.isFinite(hitRate) &&
    hitRate >= 55 &&
    hitRate <= 70 &&
    americanOdds !== null &&
    americanOdds >= -150 &&
    americanOdds <= 120
  ) {
    return "BALANCED";
  }
  if (
    Number.isFinite(hitRate) &&
    hitRate >= 45 &&
    hitRate < 55 &&
    americanOdds !== null &&
    americanOdds > 120
  ) {
    return "AGGRESSIVE";
  }
  if (
    Number.isFinite(hitRate) &&
    hitRate < 45 &&
    americanOdds !== null &&
    americanOdds > 200
  ) {
    return "LONGSHOT";
  }

  // Fallback classification keeps tags deterministic when a line sits between rule buckets.
  if (hitRate >= 70) return "SAFE";
  if (hitRate >= 55) return "BALANCED";
  if (hitRate >= 45) return "AGGRESSIVE";
  return "LONGSHOT";
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Rest days edge (courbe de récupération NBA) ──────────────────────────────
// daysSinceLast = nombre de jours entre le dernier match joué et le match ce soir
function computeRestDaysEdge(lastGameDateStr: string | null, slateDateStr: string): number {
  if (!lastGameDateStr || !slateDateStr) return 0;
  const last = Date.parse(lastGameDateStr.slice(0, 10));
  const slate = Date.parse(slateDateStr.slice(0, 10));
  if (!Number.isFinite(last) || !Number.isFinite(slate)) return 0;
  const days = Math.round((slate - last) / 86_400_000);
  if (days <= 0) return 0;
  if (days === 1) return -5;  // B2B
  if (days === 2) return -2;  // 1 jour de repos
  if (days === 3) return 0;   // 2 jours — neutre
  if (days === 4) return 2;   // pic de fraîcheur
  if (days === 5) return 1;   // encore frais
  if (days <= 7) return 0;    // 5–6 jours — neutre
  if (days <= 12) return -2;  // rythme perturbé
  return -4;                  // longue absence
}

// ── Split edge (home vs away) ────────────────────────────────────────────────
// Évalue si le contexte de ce soir (dom/ext) est favorable pour ce joueur
function computeSplitEdge(
  logs: Array<{ home_away: string | null; [key: string]: unknown }>,
  valueExtractor: (row: { [key: string]: unknown }) => number | null,
  isHome: boolean,
  line: number,
): number {
  if (line <= 0) return 0;
  const homeVals = logs
    .filter((r) => String(r.home_away ?? "").toLowerCase() === "home")
    .map(valueExtractor)
    .filter((v): v is number => Number.isFinite(v ?? NaN));
  const awayVals = logs
    .filter((r) => String(r.home_away ?? "").toLowerCase() === "away")
    .map(valueExtractor)
    .filter((v): v is number => Number.isFinite(v ?? NaN));
  if (homeVals.length < 5 || awayVals.length < 5) return 0;
  const homeAvg = avg(homeVals);
  const awayAvg = avg(awayVals);
  // diff positif = joueur meilleur dans le contexte de ce soir
  const splitDiff = isHome ? homeAvg - awayAvg : awayAvg - homeAvg;
  return clamp((splitDiff / line) * 15, -6, 6);
}

function pctHit(values: number[], line: number, side: "over" | "under") {
  if (!values.length) return 0;
  const hits =
    side === "over"
      ? values.filter((v) => v >= line).length
      : values.filter((v) => v < line).length;
  return Math.round((hits / values.length) * 100);
}

function inferSeasonFromDate(dateIso: string): string {
  const ts = Date.parse(dateIso);
  const d = Number.isFinite(ts) ? new Date(ts) : new Date();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function seasonAliases(season: string): string[] {
  const year = season.match(/(\d{4})/)?.[1];
  return Array.from(new Set([season, year].filter(Boolean) as string[]));
}

function metricFromRaw(raw: string | null | undefined): MetricKey | null {
  const key = String(raw ?? "").toUpperCase().trim();
  if (!key) return null;
  if (key === "POINTS" || key === "PTS") return "PTS";
  if (key === "REBOUNDS" || key === "REB") return "REB";
  if (key === "ASSISTS" || key === "AST") return "AST";
  if (key === "3PM" || key === "3PT" || key === "THREES") return "3PT";
  if (key === "PRA") return "PRA";
  if (key === "P+A") return "P+A";
  if (key === "P+R") return "P+R";
  if (key === "R+A") return "R+A";
  return null;
}

function trendMetricFromMetric(metric: MetricKey): TrendMetricKey | null {
  if (metric === "PTS") return "pts";
  if (metric === "REB") return "reb";
  if (metric === "AST") return "ast";
  if (metric === "3PT") return "tp";
  if (metric === "PRA") return "pra";
  return null;
}

function normalizeNbaDvpPosition(raw: string | null | undefined): DvpPosition | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return null;
  const tokens = value
    .replace(/[^A-Z0-9/-]/g, " ")
    .split(/[\s/-]+/)
    .filter(Boolean);
  for (const token of tokens) {
    if (token === "C" || token === "CENTER") return "C";
    if (token === "F" || token === "SF" || token === "PF" || token === "FORWARD") return "F";
    if (token === "G" || token === "PG" || token === "SG" || token === "GUARD") return "G";
  }
  if (value.includes("CENTER")) return "C";
  if (value.includes("FORWARD")) return "F";
  if (value.includes("GUARD")) return "G";
  return null;
}

function metricValueForTrendTotals(
  metric: TrendMetricKey,
  totals: DvpStatTotals | null | undefined,
): number | null {
  if (!totals) return null;
  if (metric === "pts") {
    const n = Number(totals.points ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  if (metric === "reb") {
    const n = Number(totals.rebounds ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  if (metric === "ast") {
    const n = Number(totals.assists ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  if (metric === "tp") {
    const n = Number(totals.threePointsMade ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  const p = Number(totals.points ?? NaN);
  const r = Number(totals.rebounds ?? NaN);
  const a = Number(totals.assists ?? NaN);
  if (!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(a)) return null;
  return p + r + a;
}

function valueFromLog(row: LogRow, metric: MetricKey): number | null {
  const p = Number(row.points ?? NaN);
  const r = Number(row.rebounds ?? NaN);
  const a = Number(row.assists ?? NaN);
  const t = Number(row.three_points_made ?? NaN);
  if (metric === "PTS") return Number.isFinite(p) ? p : null;
  if (metric === "REB") return Number.isFinite(r) ? r : null;
  if (metric === "AST") return Number.isFinite(a) ? a : null;
  if (metric === "3PT") return Number.isFinite(t) ? t : null;
  if (metric === "PRA" && Number.isFinite(p) && Number.isFinite(r) && Number.isFinite(a)) return p + r + a;
  if (metric === "P+A" && Number.isFinite(p) && Number.isFinite(a)) return p + a;
  if (metric === "P+R" && Number.isFinite(p) && Number.isFinite(r)) return p + r;
  if (metric === "R+A" && Number.isFinite(r) && Number.isFinite(a)) return r + a;
  return null;
}

function resolveRegularSeasonStart(seasonInput: string): number | null {
  const normalized = seasonInput.trim();
  const explicit = NBA_REGULAR_START_BY_SEASON[normalized];
  if (explicit) {
    const ts = Date.parse(explicit);
    return Number.isFinite(ts) ? ts : null;
  }
  const yearMatch = normalized.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[1]);
  if (!Number.isFinite(year)) return null;
  const fallback = `${year}-10-20`;
  const ts = Date.parse(fallback);
  return Number.isFinite(ts) ? ts : null;
}

function sortTrendLogs(rows: LogRow[]): LogRow[] {
  return [...rows].sort((a, b) => {
    const da = Date.parse(a.date ?? "");
    const db = Date.parse(b.date ?? "");
    const ka = Number.isFinite(da) ? da : Number(a.game_id ?? 0);
    const kb = Number.isFinite(db) ? db : Number(b.game_id ?? 0);
    return kb - ka;
  });
}

function isUsableTrendLog(row: LogRow): boolean {
  const minutes = Number(row.minutes ?? NaN);
  if (Number.isFinite(minutes) && minutes > 0) return true;
  const hasCounting = [row.points, row.rebounds, row.assists].some((v) =>
    Number.isFinite(Number(v ?? NaN)) && Number(v ?? 0) > 0,
  );
  if (hasCounting) return true;
  const hasAttempts = [
    row.field_goals_attempted,
    row.three_points_attempted,
    row.free_throws_attempted,
  ].some((v) => Number.isFinite(Number(v ?? NaN)) && Number(v ?? 0) > 0);
  return hasAttempts;
}

function dedupeLogsByGame(rows: LogRow[]): LogRow[] {
  const byGame = new Map<number, LogRow>();
  for (const row of rows) {
    const gid = Number(row.game_id ?? NaN);
    if (!Number.isFinite(gid)) continue;
    const existing = byGame.get(gid);
    if (!existing) {
      byGame.set(gid, row);
      continue;
    }
    const existingHasDate = Boolean(existing.date && Number.isFinite(Date.parse(existing.date)));
    const rowHasDate = Boolean(row.date && Number.isFinite(Date.parse(row.date)));
    if (!existingHasDate && rowHasDate) {
      byGame.set(gid, row);
      continue;
    }
    const existingFilled = [
      existing.points,
      existing.rebounds,
      existing.assists,
      existing.minutes,
      existing.field_goals_attempted,
      existing.three_points_attempted,
      existing.free_throws_attempted,
    ].filter((v) => Number.isFinite(Number(v ?? NaN))).length;
    const rowFilled = [
      row.points,
      row.rebounds,
      row.assists,
      row.minutes,
      row.field_goals_attempted,
      row.three_points_attempted,
      row.free_throws_attempted,
    ].filter((v) => Number.isFinite(Number(v ?? NaN))).length;
    if (rowFilled > existingFilled) byGame.set(gid, row);
  }
  return sortTrendLogs(Array.from(byGame.values()));
}

function gradeFromScore(score: number): string {
  if (score >= 96) return "S";
  if (score >= 84) return "A";
  if (score >= 70) return "B";
  if (score >= 54) return "C";
  return "F";
}

function torontoTodayYmd() {
  // Before 6am Toronto time, still use yesterday's date (NBA games are evening events)
  const now = new Date();
  const torontoHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hour12: false }).format(now)
  );
  const effectiveDate = torontoHour < 6 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(effectiveDate);
}

function addDaysYmd(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(base)) return ymd;
  const next = new Date(base + days * 24 * 60 * 60 * 1000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const modeRaw = String(req.nextUrl.searchParams.get("mode") ?? "")
    .trim()
    .toLowerCase();
  const mode = modeRaw === "alternates" || modeRaw === "alternates_best"
    ? "alternates_best"
    : "default";
  const alternatesBestMode = mode === "alternates_best";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? NaN);
  const alternatesLimit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.trunc(limitRaw), 300) : 140;
  const explicitDate = req.nextUrl.searchParams.get("date");
  const selectedGameIdRaw = Number(req.nextUrl.searchParams.get("gameId") ?? NaN);
  const selectedGameId =
    Number.isFinite(selectedGameIdRaw) && selectedGameIdRaw > 0
      ? Math.trunc(selectedGameIdRaw)
      : null;
  let date = explicitDate || torontoTodayYmd();
  const cacheKey = `nba-props-top:${date}:${selectedGameId ?? "all"}:${QUERY_TIMEZONE}:${mode}`;
  const origin = req.nextUrl.origin;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (!refresh && cached && cached.expiresAt > now) {
    return NextResponse.json({ ok: true, cached: true, mode, ...cached.payload });
  }
  if (!refresh && !alternatesBestMode) {
    const dbCached = await readNbaTopPropsDailyCache({
      dateKey: date,
      gameId: selectedGameId,
      timezone: QUERY_TIMEZONE,
    });
    const parsed = parseCachedPayload(dbCached?.payload ?? null);
    if (parsed) {
      memoryCache.set(cacheKey, {
        expiresAt: now + CACHE_TTL_MS,
        payload: parsed,
      });
      return NextResponse.json({ ok: true, cached: true, mode, ...parsed });
    }
  }

  try {
    const loadGamesForDate = async (targetDate: string) => {
      const seasonForDate = inferSeasonFromDate(targetDate);
      const gamesUrl = new URL("/api/nba/games", origin);
      gamesUrl.searchParams.set("date", targetDate);
      gamesUrl.searchParams.set("league", NORMALIZED_GAMES_LEAGUE);
      gamesUrl.searchParams.set("season", seasonForDate);
      gamesUrl.searchParams.set("timezone", QUERY_TIMEZONE);
      const gamesRes = await fetch(gamesUrl.toString(), {
        cache: "no-store",
      });
      if (!gamesRes.ok) {
        const txt = await gamesRes.text().catch(() => "");
        return { ok: false as const, status: gamesRes.status, body: txt };
      }
      const gamesJson = (await gamesRes.json()) as { response?: ApiGame[] };
      const gamesForLeague = (gamesJson.response ?? []).filter((g) => {
        const id = Number(g.id ?? NaN);
        if (!Number.isFinite(id)) return false;
        const leagueId = Number(g.league?.id ?? NaN);
        if (Number.isFinite(leagueId) && leagueId !== NBA_LEAGUE_ID_NUM) {
          return false;
        }
        return true;
      });
      const activeGames = gamesForLeague.filter((g) =>
        isPlayableSlateStatus(g.status?.short ?? null),
      );
      return {
        ok: true as const,
        seasonForDate,
        gamesForLeague,
        activeGames,
      };
    };

    const first = await loadGamesForDate(date);
    if (!first.ok) {
      return NextResponse.json(
        {
          error: "Upstream games error",
          status: first.status,
          body: first.body,
        },
        { status: 502 },
      );
    }

    let season = first.seasonForDate;
    let games = first.activeGames;
    if (!explicitDate && games.length === 0) {
      const tomorrow = addDaysYmd(date, 1);
      const second = await loadGamesForDate(tomorrow);
      if (second.ok && second.activeGames.length > 0) {
        date = tomorrow;
        season = second.seasonForDate;
        games = second.activeGames;
      }
    }
    if (selectedGameId !== null) {
      games = games.filter((g) => Number(g.id ?? NaN) === selectedGameId);
    }

    const oddsEntries = await Promise.all(
      games.map(async (g) => {
        const gameId = Number(g.id ?? NaN);
        const homeName = String(g.teams?.home?.name ?? "").trim();
        const awayName = String(g.teams?.away?.name ?? "").trim();
        if (!Number.isFinite(gameId) || !homeName || !awayName) return null;

        const params = new URLSearchParams({
          game: String(gameId),
          home: homeName,
          away: awayName,
        });
        // Top opportunities must consume the daily odds cache only.
        // This endpoint should never trigger upstream odds API usage.
        params.set("cacheOnly", "1");
        const oddsRes = await fetch(`${origin}/api/nba/odds?${params.toString()}`, {
          cache: "no-store",
        });
        if (!oddsRes.ok) return null;
        let odds = (await oddsRes.json()) as OddsPayload;
        if (!odds.ok || !Array.isArray(odds.playerProps) || !odds.playerProps.length) return null;

        if (!alternatesBestMode) {
          const countMainProps = (payload: OddsPayload) =>
            (Array.isArray(payload.playerProps) ? payload.playerProps : []).filter(
              (prop) => prop.isAlternate !== true,
            ).length;
          let best = odds;
          let bestMainCount = countMainProps(odds);
          const candidates = Array.isArray(odds.availableBookmakers)
            ? odds.availableBookmakers
                .map((book) => String(book.key ?? "").trim().toLowerCase())
                .filter(Boolean)
            : [];
          // If auto-selected book is mostly alternates, probe available books and keep
          // the one with the highest number of main lines.
          if (bestMainCount < 10 && candidates.length > 0) {
            for (const bookmakerKey of candidates) {
              const retryParams = new URLSearchParams(params);
              retryParams.set("bookmaker", bookmakerKey);
              const retryRes = await fetch(`${origin}/api/nba/odds?${retryParams.toString()}`, {
                cache: "no-store",
              });
              if (!retryRes.ok) continue;
              const retryOdds = (await retryRes.json()) as OddsPayload;
              if (!retryOdds.ok || !Array.isArray(retryOdds.playerProps) || !retryOdds.playerProps.length) continue;
              const retryMainCount = countMainProps(retryOdds);
              if (retryMainCount > bestMainCount) {
                best = retryOdds;
                bestMainCount = retryMainCount;
              }
              if (bestMainCount >= 30) break;
            }
            odds = best;
          }
        }

        const homeCode =
          String(g.teams?.home?.code ?? "").trim().toUpperCase() ||
          TEAM_CODE_BY_ID[Number(g.teams?.home?.id ?? 0)] ||
          null;
        const awayCode =
          String(g.teams?.away?.code ?? "").trim().toUpperCase() ||
          TEAM_CODE_BY_ID[Number(g.teams?.away?.id ?? 0)] ||
          null;
        const homeTeamId = Number(g.teams?.home?.id ?? NaN);
        const awayTeamId = Number(g.teams?.away?.id ?? NaN);
        return {
          game: g,
          gameId,
          homeCode,
          awayCode,
          homeTeamId: Number.isFinite(homeTeamId) ? homeTeamId : null,
          awayTeamId: Number.isFinite(awayTeamId) ? awayTeamId : null,
          props: odds.playerProps,
        };
      }),
    );

    const slateProps = oddsEntries.filter(Boolean) as Array<{
      game: ApiGame;
      gameId: number;
      homeCode: string | null;
      awayCode: string | null;
      homeTeamId: number | null;
      awayTeamId: number | null;
      props: OddsProp[];
    }>;
    if (!slateProps.length) {
      const payload: CachedTopPropsPayload = {
        generatedAt: new Date().toISOString(),
        date,
        season,
        mode,
        gameId: selectedGameId,
        events: games.length,
        propsAnalyzed: 0,
        props: [],
      };
      memoryCache.set(cacheKey, {
        expiresAt: now + CACHE_TTL_MS,
        payload,
      });
      if (!alternatesBestMode) {
        await writeNbaTopPropsDailyCache({
          dateKey: date,
          gameId: selectedGameId,
          timezone: QUERY_TIMEZONE,
          season,
          generatedAt: payload.generatedAt,
          payload,
          source: "computed",
        });
      }
      return NextResponse.json({
        ok: true,
        cached: false,
        mode,
        ...payload,
      });
    }

    const aliases = seasonAliases(season);
    const players = await prisma.$queryRaw<PlayerRow[]>(
      Prisma.sql`
        select player_id, full_name, team_id, team_code, position, updated_at::text as updated_at
        from nba_players
        where season in (${Prisma.join(aliases.map((a) => Prisma.sql`${a}`))})
        order by
          full_name asc,
          case
            when team_code is null or btrim(team_code) = '' then 1
            else 0
          end asc,
          updated_at desc nulls last
      `,
    );
    const playerCandidatesByName = new Map<string, PlayerRow[]>();
    for (const p of players) {
      const key = normalizeText(p.full_name);
      if (!key) continue;
      const list = playerCandidatesByName.get(key) ?? [];
      list.push(p);
      playerCandidatesByName.set(key, list);
    }

    const allCandidateIds = Array.from(
      new Set(
        players
          .map((p) => Number(p.player_id ?? NaN))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    const playerFreshnessById = new Map<number, { lastTs: number | null; games: number }>();
    if (allCandidateIds.length) {
      const freshnessRows = await prisma.$queryRaw<PlayerLogFreshnessRow[]>(
        Prisma.sql`
          select
            player_id,
            max(date)::text as last_date,
            count(*)::int as games
          from nba_player_game_logs
          where player_id in (${Prisma.join(allCandidateIds.map((id) => Prisma.sql`${id}`))})
            and season in (${Prisma.join(aliases.map((a) => Prisma.sql`${a}`))})
            and coalesce(is_preseason, false) = false
            and (status_short is null or status_short in (${Prisma.join(Array.from(FINISHED_STATUSES).map((s) => Prisma.sql`${s}`))}))
          group by player_id
        `,
      );
      for (const row of freshnessRows) {
        const id = Number(row.player_id ?? NaN);
        if (!Number.isFinite(id) || id <= 0) continue;
        const ts = Date.parse(String(row.last_date ?? ""));
        playerFreshnessById.set(id, {
          lastTs: Number.isFinite(ts) ? ts : null,
          games: Number(row.games ?? 0) || 0,
        });
      }
    }

    const slateDateTs = Date.parse(`${date}T12:00:00Z`);
    const referenceTs = Number.isFinite(slateDateTs) ? slateDateTs : Date.now();
    const resolvePlayerKey = (gameId: number, playerName: string) =>
      `${gameId}:${normalizeText(playerName)}`;
    const resolvedPlayerByPropKey = new Map<string, PlayerRow>();
    const resolvePlayerForProp = (
      playerName: string,
      pack: {
        gameId: number;
        homeCode: string | null;
        awayCode: string | null;
      },
      prop: OddsProp,
    ): PlayerRow | null => {
      const key = normalizeText(playerName);
      const candidates = playerCandidatesByName.get(key) ?? [];
      if (!candidates.length) return null;

      const gameCodes = new Set(
        [pack.homeCode, pack.awayCode]
          .filter(Boolean)
          .map((code) => String(code).toUpperCase()),
      );
      const propTeamCode = String(prop.teamCode ?? "")
        .trim()
        .toUpperCase();
      const propOppCode = String(prop.opponentCode ?? "")
        .trim()
        .toUpperCase();
      if (propTeamCode) gameCodes.add(propTeamCode);
      if (propOppCode) gameCodes.add(propOppCode);

      const ranked = [...candidates].sort((a, b) => {
        const rowTeamCode = (row: PlayerRow) => {
          const byCode = String(row.team_code ?? "")
            .trim()
            .toUpperCase();
          if (byCode) return byCode;
          const byLegacyId = Number(row.team_id ?? NaN);
          if (Number.isFinite(byLegacyId)) {
            const mapped = TEAM_CODE_BY_ID[byLegacyId];
            if (mapped) return mapped;
          }
          return null;
        };

        const aTeam = rowTeamCode(a);
        const bTeam = rowTeamCode(b);
        const aTeamMatch = aTeam ? gameCodes.has(aTeam) : false;
        const bTeamMatch = bTeam ? gameCodes.has(bTeam) : false;
        if (aTeamMatch !== bTeamMatch) return aTeamMatch ? -1 : 1;

        const aFresh = playerFreshnessById.get(Number(a.player_id ?? NaN)) ?? null;
        const bFresh = playerFreshnessById.get(Number(b.player_id ?? NaN)) ?? null;
        const aAgeDays =
          aFresh?.lastTs !== null && aFresh?.lastTs !== undefined
            ? Math.floor((referenceTs - aFresh.lastTs) / (24 * 60 * 60 * 1000))
            : null;
        const bAgeDays =
          bFresh?.lastTs !== null && bFresh?.lastTs !== undefined
            ? Math.floor((referenceTs - bFresh.lastTs) / (24 * 60 * 60 * 1000))
            : null;
        const aRecent = aAgeDays !== null && aAgeDays <= MAX_PROP_LOG_AGE_DAYS;
        const bRecent = bAgeDays !== null && bAgeDays <= MAX_PROP_LOG_AGE_DAYS;
        if (aRecent !== bRecent) return aRecent ? -1 : 1;

        const aLast = aFresh?.lastTs ?? 0;
        const bLast = bFresh?.lastTs ?? 0;
        if (aLast !== bLast) return bLast - aLast;

        const aGames = Number(aFresh?.games ?? 0);
        const bGames = Number(bFresh?.games ?? 0);
        if (aGames !== bGames) return bGames - aGames;

        const aUpdated = Date.parse(String(a.updated_at ?? ""));
        const bUpdated = Date.parse(String(b.updated_at ?? ""));
        const aUpdatedTs = Number.isFinite(aUpdated) ? aUpdated : 0;
        const bUpdatedTs = Number.isFinite(bUpdated) ? bUpdated : 0;
        return bUpdatedTs - aUpdatedTs;
      });

      return ranked[0] ?? null;
    };

    const dvpRowsByPos = new Map<DvpPosition, DvpRow[]>();
    const dvpLeagueAvgByPos = new Map<DvpPosition, DvpStatTotals>();
    const dvpMetricRankByPosMetricTeam = new Map<string, number>();
    const dvpTotalTeamsByPos = new Map<DvpPosition, number>();
    const dvpPositionKeys: DvpPosition[] = ["G", "F", "C"];
    await Promise.all(
      dvpPositionKeys.map(async (position) => {
        try {
          const dvpUrl = new URL("/api/nba/defense/dvp", origin);
          dvpUrl.searchParams.set("season", season);
          dvpUrl.searchParams.set("window", "L10");
          dvpUrl.searchParams.set("context", "all");
          dvpUrl.searchParams.set("position", position);
          const dvpRes = await fetch(dvpUrl.toString(), { cache: "no-store" });
          if (!dvpRes.ok) return;
          const dvpJson = (await dvpRes.json()) as { rows?: DvpRow[] };
          const rows = (Array.isArray(dvpJson.rows) ? dvpJson.rows : []).filter((row) =>
            Number.isFinite(Number(row.teamId ?? NaN)),
          );
          dvpRowsByPos.set(position, rows);
          dvpTotalTeamsByPos.set(position, rows.length);

          let totalGames = 0;
          const totals: Required<DvpStatTotals> = {
            points: 0,
            rebounds: 0,
            assists: 0,
            minutes: 0,
            threePointsMade: 0,
            fieldGoalsMade: 0,
            fieldGoalsAttempted: 0,
            freeThrowsMade: 0,
            freeThrowsAttempted: 0,
          };
          for (const row of rows) {
            const per = row.metrics?.perGame;
            if (!per) continue;
            const games = Number(row.games ?? 0);
            const weight = games > 0 ? games : 1;
            totalGames += weight;
            totals.points += Number(per.points ?? 0) * weight;
            totals.rebounds += Number(per.rebounds ?? 0) * weight;
            totals.assists += Number(per.assists ?? 0) * weight;
            totals.minutes += Number(per.minutes ?? 0) * weight;
            totals.threePointsMade += Number(per.threePointsMade ?? 0) * weight;
            totals.fieldGoalsMade += Number(per.fieldGoalsMade ?? 0) * weight;
            totals.fieldGoalsAttempted += Number(per.fieldGoalsAttempted ?? 0) * weight;
            totals.freeThrowsMade += Number(per.freeThrowsMade ?? 0) * weight;
            totals.freeThrowsAttempted += Number(per.freeThrowsAttempted ?? 0) * weight;
          }
          if (totalGames > 0) {
            dvpLeagueAvgByPos.set(position, {
              points: totals.points / totalGames,
              rebounds: totals.rebounds / totalGames,
              assists: totals.assists / totalGames,
              minutes: totals.minutes / totalGames,
              threePointsMade: totals.threePointsMade / totalGames,
              fieldGoalsMade: totals.fieldGoalsMade / totalGames,
              fieldGoalsAttempted: totals.fieldGoalsAttempted / totalGames,
              freeThrowsMade: totals.freeThrowsMade / totalGames,
              freeThrowsAttempted: totals.freeThrowsAttempted / totalGames,
            });
          }

          const trendMetrics: TrendMetricKey[] = ["pts", "reb", "ast", "tp", "pra"];
          for (const metricKey of trendMetrics) {
            const ranked = rows
              .map((row) => {
                const value = metricValueForTrendTotals(metricKey, row.metrics?.perGame);
                const teamId = Number(row.teamId ?? NaN);
                return { teamId, value };
              })
              .filter(
                (entry) =>
                  Number.isFinite(Number(entry.teamId ?? NaN)) &&
                  Number.isFinite(entry.value ?? NaN),
              )
              .sort((a, b) => Number(a.value) - Number(b.value));
            ranked.forEach((entry, idx) => {
              dvpMetricRankByPosMetricTeam.set(
                `${position}:${metricKey}:${entry.teamId}`,
                idx + 1,
              );
            });
          }
        } catch {
          // keep scoring alive even if DvP is temporarily unavailable
        }
      }),
    );

    const playerIds = new Set<number>();
    for (const pack of slateProps) {
      for (const prop of pack.props) {
        const resolutionKey = resolvePlayerKey(pack.gameId, prop.name);
        const cached = resolvedPlayerByPropKey.get(resolutionKey);
        const hit =
          cached ??
          resolvePlayerForProp(prop.name, {
            gameId: pack.gameId,
            homeCode: pack.homeCode,
            awayCode: pack.awayCode,
          }, prop);
        if (hit) resolvedPlayerByPropKey.set(resolutionKey, hit);
        if (hit?.player_id) playerIds.add(hit.player_id);
      }
    }

    let logsByPlayer = new Map<number, LogRow[]>();
    if (playerIds.size) {
      const ids = Array.from(playerIds.values());
      const logs = await prisma.$queryRaw<LogRow[]>(
        Prisma.sql`
          select
            player_id,
            game_id,
            date::text,
            league_id,
            status_short,
            is_preseason,
            team_id,
            team_code,
            opponent_team_code,
            points,
            rebounds,
            assists,
            three_points_made,
            minutes,
            field_goals_attempted,
            three_points_attempted,
            free_throws_attempted,
            home_away::text,
            result::text
          from nba_player_game_logs
          where player_id in (${Prisma.join(ids.map((id) => Prisma.sql`${id}`))})
            and season in (${Prisma.join(aliases.map((a) => Prisma.sql`${a}`))})
          order by player_id asc, date desc nulls last, game_id desc
        `,
      );
      logsByPlayer = logs.reduce((map, row) => {
        const list = map.get(row.player_id) ?? [];
        list.push(row);
        map.set(row.player_id, list);
        return map;
      }, new Map<number, LogRow[]>());
    }

    const picksByGame = new Map<number, TopProp[]>();
    let propsAnalyzed = 0;

    for (const pack of slateProps) {
      for (let i = 0; i < pack.props.length; i += 1) {
        const prop = pack.props[i];
        if (alternatesBestMode && prop.isAlternate !== true) continue;
        if (!alternatesBestMode && prop.isAlternate === true) continue;
        const metric = metricFromRaw(prop.metric);
        if (!metric) continue;
        const trendMetric = trendMetricFromMetric(metric);
        if (!trendMetric) continue;
        const line = Number(prop.line);
        if (!Number.isFinite(line) || line <= 0) continue;

        const resolutionKey = resolvePlayerKey(pack.gameId, prop.name);
        const playerInfo =
          resolvedPlayerByPropKey.get(resolutionKey) ??
          resolvePlayerForProp(
            prop.name,
            {
              gameId: pack.gameId,
              homeCode: pack.homeCode,
              awayCode: pack.awayCode,
            },
            prop,
          );
        if (playerInfo) resolvedPlayerByPropKey.set(resolutionKey, playerInfo);
        if (!playerInfo?.player_id) continue;

        const orderedLogs = sortTrendLogs(logsByPlayer.get(playerInfo.player_id) ?? []);
        const regularSeasonStart = resolveRegularSeasonStart(season);
        const finishedStatuses = FINISHED_STATUSES;
        const regularLogs = orderedLogs.filter((row) => {
          if (row.is_preseason) return false;
          if (
            Number.isFinite(NBA_LEAGUE_ID_NUM) &&
            Number.isFinite(Number(row.league_id ?? NaN)) &&
            Number(row.league_id) !== NBA_LEAGUE_ID_NUM
          ) {
            return false;
          }
          if (row.status_short && !finishedStatuses.has(String(row.status_short).toUpperCase())) {
            return false;
          }
          if (regularSeasonStart && row.date) {
            const ts = Date.parse(row.date);
            if (Number.isFinite(ts) && ts < regularSeasonStart) return false;
          }
          return true;
        });
        const dedupedRegularLogs = dedupeLogsByGame(regularLogs);
        const usableLogs = dedupedRegularLogs.filter(isUsableTrendLog);
        const logs = (usableLogs.length ? usableLogs : dedupedRegularLogs).slice(0, 20);
        if (!logs.length) continue;

        const seasonValues = dedupedRegularLogs
          .map((row) => valueFromLog(row, metric))
          .filter((v): v is number => Number.isFinite(v ?? NaN));
        const recentValues = logs
          .map((row) => valueFromLog(row, metric))
          .filter((v): v is number => Number.isFinite(v ?? NaN));
        const values = recentValues.slice(0, 10);
        if (!values.length || !seasonValues.length) continue;

        const valuesL5 = seasonValues.slice(0, 5);
        const valuesL10 = seasonValues.slice(0, 10);
        const valuesL20 = seasonValues.slice(0, 20);
        const mean = avg(values);
        const sd = stdDev(values);
        const cv = mean > 0 ? sd / mean : 1;
        const lineEdgeBase = line > 0 ? clamp(((mean - line) / line) * 30, -14, 14) : 0;
        const awayCode = pack.awayCode;
        const homeCode = pack.homeCode;
        const gameCodes = new Set(
          [homeCode, awayCode].filter(Boolean).map((code) => String(code).toUpperCase()),
        );
        const latestLogTeamCodeFromId = orderedLogs
          .map((row) => {
            const teamId = Number(row.team_id ?? NaN);
            if (!Number.isFinite(teamId)) return null;
            return TEAM_CODE_BY_ID[teamId] ? String(TEAM_CODE_BY_ID[teamId]).toUpperCase() : null;
          })
          .find((code) => Boolean(code) && gameCodes.has(String(code))) ?? null;
        const latestLogTeamCode = orderedLogs
          .map((row) =>
            String(row.team_code ?? "")
              .trim()
              .toUpperCase(),
          )
          .find((code) => Boolean(code) && gameCodes.has(code)) ?? null;
        const playerTeamId = Number(playerInfo.team_id ?? NaN);
        const playerTeamCodeFromId =
          Number.isFinite(playerTeamId) && TEAM_CODE_BY_ID[playerTeamId]
            ? String(TEAM_CODE_BY_ID[playerTeamId]).toUpperCase()
            : null;
        const playerTeamCodeFromProfile = playerInfo.team_code
          ? String(playerInfo.team_code).toUpperCase()
          : null;
        const canonicalTeamCode =
          [
            playerTeamCodeFromProfile,
            playerTeamCodeFromId,
            latestLogTeamCodeFromId,
            latestLogTeamCode,
          ].find(
            (code) => Boolean(code) && gameCodes.has(String(code)),
          ) ?? null;
        let teamCode: string | null = null;
        let opponentCode: string | null = null;
        const propTeamCode = String(prop.teamCode ?? "")
          .trim()
          .toUpperCase();
        const propOpponentCode = String(prop.opponentCode ?? "")
          .trim()
          .toUpperCase();
        if (
          propTeamCode &&
          propOpponentCode &&
          propTeamCode !== propOpponentCode &&
          gameCodes.has(propTeamCode) &&
          gameCodes.has(propOpponentCode)
        ) {
          teamCode = propTeamCode;
          opponentCode = propOpponentCode;
        }

        if (
          (!teamCode || !opponentCode) &&
          Number.isFinite(playerTeamId) &&
          pack.homeTeamId !== null &&
          pack.awayTeamId !== null
        ) {
          if (playerTeamId === pack.homeTeamId) {
            teamCode = homeCode;
            opponentCode = awayCode;
          } else if (playerTeamId === pack.awayTeamId) {
            teamCode = awayCode;
            opponentCode = homeCode;
          }
        }
        if (!teamCode || !opponentCode) {
          const teamCodeFromPlayer = playerInfo.team_code
            ? String(playerInfo.team_code).toUpperCase()
            : null;
          if (
            teamCodeFromPlayer &&
            awayCode &&
            homeCode &&
            (teamCodeFromPlayer === awayCode || teamCodeFromPlayer === homeCode)
          ) {
            teamCode = teamCodeFromPlayer;
            opponentCode =
              teamCodeFromPlayer === awayCode ? homeCode : awayCode;
          }
        }
        if ((!teamCode || !opponentCode) && canonicalTeamCode) {
          teamCode = canonicalTeamCode;
          opponentCode = canonicalTeamCode === awayCode ? homeCode : awayCode;
        }
        if (!teamCode || !opponentCode) {
          // Last fallback uses game teams only and guarantees non-self opponent.
          teamCode = awayCode ?? homeCode ?? null;
          opponentCode = homeCode ?? awayCode ?? null;
        }
        if (teamCode && opponentCode && teamCode === opponentCode) {
          opponentCode =
            teamCode === awayCode ? homeCode : awayCode ?? opponentCode;
        }
        let opponentTeamId: number | null = null;
        if (opponentCode && homeCode && awayCode) {
          if (String(opponentCode).toUpperCase() === String(homeCode).toUpperCase()) {
            opponentTeamId = pack.homeTeamId;
          } else if (String(opponentCode).toUpperCase() === String(awayCode).toUpperCase()) {
            opponentTeamId = pack.awayTeamId;
          }
        }
        if (
          opponentTeamId === null &&
          opponentCode &&
          Number.isFinite(Number(TEAM_ID_BY_CODE[String(opponentCode).toUpperCase()] ?? NaN))
        ) {
          opponentTeamId = TEAM_ID_BY_CODE[String(opponentCode).toUpperCase()];
        }

        const dvpPosition = normalizeNbaDvpPosition(playerInfo.position);
        const dvpTotalTeams = dvpPosition ? (dvpTotalTeamsByPos.get(dvpPosition) ?? 0) : 0;
        const dvpMetricRank =
          dvpPosition && Number.isFinite(Number(opponentTeamId ?? NaN))
            ? (dvpMetricRankByPosMetricTeam.get(
                `${dvpPosition}:${trendMetric}:${Number(opponentTeamId)}`,
              ) ?? null)
            : null;
        const dvpScoreBase = dvpScoreFromRank(dvpMetricRank);
        // Même courbe en paliers que dvpScoreFromRank, scalée à ±20 pour le rawScore
        const rankEdgeBase = dvpScoreBase * 2;

        const dvpRow =
          dvpPosition && Number.isFinite(Number(opponentTeamId ?? NaN))
            ? (dvpRowsByPos
                .get(dvpPosition)
                ?.find(
                  (row) =>
                    Number(row.teamId) === Number(opponentTeamId),
                ) ?? null)
            : null;
        const dvpValue = metricValueForTrendTotals(trendMetric, dvpRow?.metrics?.perGame);
        const dvpLeagueValue = metricValueForTrendTotals(
          trendMetric,
          dvpPosition ? (dvpLeagueAvgByPos.get(dvpPosition) ?? null) : null,
        );
        const dvpMetricDelta =
          dvpValue !== null && dvpLeagueValue !== null && dvpLeagueValue !== 0
            ? (dvpValue - dvpLeagueValue) / dvpLeagueValue
            : null;
        const dvpMetricFlag =
          dvpMetricDelta === null
            ? null
            : dvpMetricDelta >= 0.07
              ? "weakness"
              : dvpMetricDelta <= -0.07
                ? "strength"
                : "neutral";
        const strengthEdgeBase =
          dvpMetricFlag === "weakness" ? 8 : dvpMetricFlag === "strength" ? -8 : 0;

        const h2hValues = opponentCode
          ? logs
              .filter(
                (row) =>
                  String(row.opponent_team_code ?? "")
                    .trim()
                    .toUpperCase() === String(opponentCode).toUpperCase(),
              )
              .map((row) => valueFromLog(row, metric))
              .filter((v): v is number => Number.isFinite(v ?? NaN))
              .slice(0, 3)
          : [];
        const matchupBase = (h2hValues.length ? h2hValues : values.slice(0, 5)).filter((v) =>
          Number.isFinite(v),
        );
        const consistencyEdge = clamp((0.35 - cv) * 20, -6, 6);
        const consistencyScore = consistencyScoreFromCv(cv);
        const sampleEdge = values.length < 5 ? clamp((values.length - 5) * 2, -6, 0) : 0;

        // ── Nouveaux signaux ─────────────────────────────────────────────────
        const isHomeTonight = Boolean(teamCode && homeCode && teamCode === homeCode);
        const restDaysEdgeVal = computeRestDaysEdge(logs[0]?.date ?? null, date);
        const splitEdgeVal = computeSplitEdge(
          dedupedRegularLogs,
          (row) => valueFromLog(row as LogRow, metric),
          isHomeTonight,
          line,
        );
        const gameKey = Number(pack.gameId ?? NaN);
        if (!Number.isFinite(gameKey)) continue;
        const buildPickForSide = (side: "over" | "under", odd: number | null): TopProp | null => {
          if (odd === null) return null;
          if (odd < 1.15 || odd > 4) return null;

          const sideMultiplier = side === "over" ? 1 : -1;
          const hitRateL5 = valuesL5.length ? pctHit(valuesL5, line, side) : 0;
          const hitRateL10 = valuesL10.length ? pctHit(valuesL10, line, side) : 0;
          const hitRateL20 = valuesL20.length ? pctHit(valuesL20, line, side) : 0;
          const seasonHitRate = pctHit(seasonValues, line, side);
          const weightedHitRate = weightedAverage([
            { value: hitRateL10, weight: 0.5, enabled: valuesL10.length > 0 },
            { value: hitRateL20, weight: 0.3, enabled: valuesL20.length > 0 },
            { value: seasonHitRate, weight: 0.2, enabled: seasonValues.length > 0 },
          ]);
          const noteHitPct = pctHit(values, line, side);
          const implied = 1 / odd;
          const edge = Number((noteHitPct / 100 - implied).toFixed(4));
          const impliedProbabilityPct = implied * 100;
          const modelEdgePct = weightedHitRate - impliedProbabilityPct;
          const americanOdds = decimalToAmericanOdds(odd);
          const lineEdge = lineEdgeBase * sideMultiplier;
          const hitEdge = clamp(((noteHitPct / 100) - 0.5) * 28, -14, 14);
          const rankEdge = rankEdgeBase * sideMultiplier;
          const strengthEdge = strengthEdgeBase * sideMultiplier;
          const matchupPct = pctHit(matchupBase, line, side);
          const h2hEdge = clamp(((matchupPct / 100) - 0.5) * 20, -6, 6);
          const recommendationTag = recommendationTagFromSignals(weightedHitRate, americanOdds);
          const edgePct = edge * 100;
          const rawScore =
            50 +
            lineEdge +
            hitEdge +
            rankEdge +
            strengthEdge +
            h2hEdge +
            consistencyEdge +
            sampleEdge +
            restDaysEdgeVal * sideMultiplier +
            splitEdgeVal * sideMultiplier;
          const score = Math.round(clamp(rawScore, 0, 100));
          const grade = gradeFromScore(score);

          propsAnalyzed += 1;
          return {
            id: `${pack.gameId}-${i}-${side}`,
            playerId: playerInfo.player_id,
            player: prop.name,
            teamCode,
            opponentCode,
            metric,
            side,
            line,
            odds: odd,
            edge: Number(modelEdgePct.toFixed(1)),
            hitRate: Number(weightedHitRate.toFixed(1)),
            hitRateL5: Number(hitRateL5.toFixed(1)),
            hitRateL10: Number(hitRateL10.toFixed(1)),
            hitRateL20: Number(hitRateL20.toFixed(1)),
            seasonHitRate: Number(seasonHitRate.toFixed(1)),
            impliedProbability: Number(impliedProbabilityPct.toFixed(1)),
            modelEdge: Number(modelEdgePct.toFixed(1)),
            dvpScore: dvpScoreBase * sideMultiplier,
            dvpRank: dvpMetricRank ?? null,
            dvpTotalTeams: dvpTotalTeams || null,
            dvpValue: dvpValue !== null ? Number(dvpValue.toFixed(1)) : null,
            dvpMetricFlag: dvpMetricFlag ?? null,
            dvpPosition: dvpPosition ?? null,
            consistencyScore,
            recommendationTag,
            restDaysEdge: Number(restDaysEdgeVal.toFixed(1)),
            splitEdge: Number(splitEdgeVal.toFixed(1)),
            score,
            grade,
            finalScore: score,
            gameId: pack.gameId,
            bookmaker: prop.bookmakerName ?? null,
          };
        };

        const picksForProp = [
          buildPickForSide("over", parseOdd(prop.overOdd ?? null)),
          buildPickForSide("under", parseOdd(prop.underOdd ?? null)),
        ].filter((pick): pick is TopProp => Boolean(pick));
        if (!picksForProp.length) continue;
        const list = picksByGame.get(gameKey) ?? [];
        list.push(...picksForProp);
        picksByGame.set(gameKey, list);
      }
    }

    const sortProps = (a: TopProp, b: TopProp) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return b.edge - a.edge;
    };
    const sortAlternates = sortProps;
    const dedupeByPlayerMetric = (picks: TopProp[]) => {
      const best = new Map<string, TopProp>();
      for (const pick of picks) {
        const key =
          `${normalizeText(pick.player)}::${String(pick.metric).toUpperCase()}::${pick.side}::${pick.line}`;
        const existing = best.get(key);
        if (
          !existing ||
          pick.finalScore > existing.finalScore ||
          (pick.finalScore === existing.finalScore && pick.edge > existing.edge)
        ) {
          best.set(key, pick);
        }
      }
      return Array.from(best.values());
    };
    const pickBestAlternatesByPlayerMetric = (picks: TopProp[], maxPerGroup = 3) => {
      const groups = new Map<string, TopProp[]>();
      for (const pick of picks) {
        const key = `${normalizeText(pick.player)}::${String(pick.metric).toUpperCase()}`;
        const list = groups.get(key) ?? [];
        list.push(pick);
        groups.set(key, list);
      }

      const output: TopProp[] = [];
      for (const group of groups.values()) {
        const sorted = [...group].sort(sortAlternates);
        const selected: TopProp[] = [];
        const seenTags = new Set<string>();
        for (const pick of sorted) {
          if (selected.length >= maxPerGroup) break;
          const tag = pick.recommendationTag ?? "";
          if (tag && seenTags.has(tag)) continue;
          selected.push(pick);
          if (tag) seenTags.add(tag);
        }
        for (const pick of sorted) {
          if (selected.length >= maxPerGroup) break;
          const already = selected.some(
            (item) => item.side === pick.side && Number(item.line) === Number(pick.line),
          );
          if (already) continue;
          selected.push(pick);
        }
        output.push(...selected);
      }
      return output;
    };
    const props =
      alternatesBestMode
        ? (
            selectedGameId !== null
              ? pickBestAlternatesByPlayerMetric(
                  [...(picksByGame.get(selectedGameId) ?? [])],
                  3,
                )
              : Array.from(picksByGame.entries())
                  .sort((a, b) => a[0] - b[0])
                  .flatMap(([, picks]) =>
                    pickBestAlternatesByPlayerMetric([...picks], 3),
                  )
          )
            .sort(sortAlternates)
            .slice(0, alternatesLimit)
        : selectedGameId !== null
          ? dedupeByPlayerMetric([...(picksByGame.get(selectedGameId) ?? [])]).sort(sortProps)
          : Array.from(picksByGame.entries())
              .sort((a, b) => a[0] - b[0])
              .flatMap(([, picks]) =>
                dedupeByPlayerMetric([...picks]).sort(sortProps),
              );

    const payload: CachedTopPropsPayload = {
      generatedAt: new Date().toISOString(),
      date,
      season,
      mode,
      gameId: selectedGameId,
      events: games.length,
      propsAnalyzed,
      props,
    };
    memoryCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    });
    if (!alternatesBestMode) {
      await writeNbaTopPropsDailyCache({
        dateKey: date,
        gameId: selectedGameId,
        timezone: QUERY_TIMEZONE,
        season,
        generatedAt: payload.generatedAt,
        payload,
        source: "computed",
      });
    }
    return NextResponse.json({ ok: true, cached: false, mode, ...payload });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Unexpected error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
