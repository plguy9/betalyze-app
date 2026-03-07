import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LEAGUE_ID =
  process.env.APISPORTS_BASKETBALL_LEAGUE_ID ??
  process.env.APISPORTS_NBA_LEAGUE_ID ??
  "12";
const NBA_LEAGUE_ID_NUM = Number(LEAGUE_ID);
const NBA_REGULAR_START_BY_SEASON: Record<string, string> = {
  "2024": "2024-10-22",
  "2024-2025": "2024-10-22",
  "2025": "2025-10-21",
  "2025-2026": "2025-10-21",
};
const QUERY_TIMEZONE = "America/Toronto";

const CACHE_TTL_MS = 5 * 60 * 1000;
type CachedTopPropsPayload = {
  generatedAt: string;
  date: string;
  season: string;
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
    home?: { id?: number | null; name?: string | null };
    away?: { id?: number | null; name?: string | null };
  } | null;
};

type OddsProp = {
  name: string;
  metric: string;
  line: number;
  odd: string | null;
  overOdd?: string | null;
  underOdd?: string | null;
  teamCode?: string | null;
  opponentCode?: string | null;
  bookmakerName?: string | null;
};

type OddsPayload = {
  ok: boolean;
  game: number | null;
  playerProps?: OddsProp[];
};

type PlayerRow = {
  player_id: number;
  full_name: string;
  team_id: number | null;
  team_code: string | null;
  position: string | null;
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
};

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

function minLineForMetric(metric: MetricKey): number {
  if (metric === "PTS") return 8;
  if (metric === "REB") return 3;
  if (metric === "AST") return 3;
  if (metric === "3PT") return 1;
  if (metric === "PRA") return 14;
  if (metric === "P+A") return 10;
  if (metric === "P+R") return 11;
  return 6; // R+A
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

function baseGradeFromScore(score: number) {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

function gradeFromSignals(params: {
  score: number;
  hitPct: number;
  edgePct: number;
  sampleSize: number;
  cv: number;
}) {
  const { score, hitPct, edgePct, sampleSize, cv } = params;

  // Hard gates: A+ and A should represent the highest-confidence picks.
  if (hitPct >= 72 && edgePct >= 8 && sampleSize >= 8 && cv <= 0.28 && score >= 86) return "A+";
  if (hitPct >= 67 && edgePct >= 5.5 && sampleSize >= 7 && cv <= 0.33 && score >= 80) return "A";
  if (hitPct >= 62 && edgePct >= 3.5 && sampleSize >= 6 && cv <= 0.38 && score >= 74) return "A-";

  // Reliability caps prevent inflated grades when hit-rate / edge are weak.
  let cappedScore = score;
  if (hitPct < 52) cappedScore = Math.min(cappedScore, 62); // C+
  else if (hitPct < 56) cappedScore = Math.min(cappedScore, 69); // B-
  else if (edgePct < 0) cappedScore = Math.min(cappedScore, 72); // B
  if (sampleSize < 6) cappedScore = Math.min(cappedScore, 72); // B

  return baseGradeFromScore(cappedScore);
}

function torontoTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  const explicitDate = req.nextUrl.searchParams.get("date");
  const selectedGameIdRaw = Number(req.nextUrl.searchParams.get("gameId") ?? NaN);
  const selectedGameId =
    Number.isFinite(selectedGameIdRaw) && selectedGameIdRaw > 0
      ? Math.trunc(selectedGameIdRaw)
      : null;
  let date = explicitDate || torontoTodayYmd();
  const cacheKey = `nba-props-top:${date}:${selectedGameId ?? "all"}:${QUERY_TIMEZONE}`;
  const origin = req.nextUrl.origin;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (!refresh && cached && cached.expiresAt > now) {
    return NextResponse.json({ ok: true, cached: true, ...cached.payload });
  }

  try {
    const loadGamesForDate = async (targetDate: string) => {
      const seasonForDate = inferSeasonFromDate(targetDate);
      const gamesUrl = new URL("/api/nba/games", origin);
      gamesUrl.searchParams.set("date", targetDate);
      gamesUrl.searchParams.set("league", LEAGUE_ID);
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
        if (
          Number.isFinite(leagueId) &&
          String(leagueId) !== String(LEAGUE_ID)
        ) {
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
        const oddsRes = await fetch(`${origin}/api/nba/odds?${params.toString()}`, {
          cache: "no-store",
        });
        if (!oddsRes.ok) return null;
        const odds = (await oddsRes.json()) as OddsPayload;
        if (!odds.ok || !Array.isArray(odds.playerProps) || !odds.playerProps.length) return null;

        const homeCode = TEAM_CODE_BY_ID[Number(g.teams?.home?.id ?? 0)] ?? null;
        const awayCode = TEAM_CODE_BY_ID[Number(g.teams?.away?.id ?? 0)] ?? null;
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
      return NextResponse.json({
        ok: true,
        cached: false,
        generatedAt: new Date().toISOString(),
        date,
        season,
        events: games.length,
        propsAnalyzed: 0,
        props: [],
      });
    }

    const aliases = seasonAliases(season);
    const players = await prisma.$queryRaw<PlayerRow[]>(
      Prisma.sql`
        select player_id, full_name, team_id, team_code, position
        from nba_players
        where season in (${Prisma.join(aliases.map((a) => Prisma.sql`${a}`))})
      `,
    );
    const playerByName = new Map<string, PlayerRow>();
    for (const p of players) {
      const key = normalizeText(p.full_name);
      if (!key || playerByName.has(key)) continue;
      playerByName.set(key, p);
    }

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
        const hit = playerByName.get(normalizeText(prop.name));
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
            free_throws_attempted
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
        const metric = metricFromRaw(prop.metric);
        if (!metric) continue;
        const trendMetric = trendMetricFromMetric(metric);
        if (!trendMetric) continue;
        const line = Number(prop.line);
        if (!Number.isFinite(line) || line < minLineForMetric(metric)) continue;

        // Best Props Nightly: OVER ONLY (pas de sélection under ici).
        const overOdd = parseOdd(prop.overOdd ?? null);
        if (overOdd === null) continue;
        if (overOdd < 1.15 || overOdd > 4) continue;

        const playerInfo = playerByName.get(normalizeText(prop.name));
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
        if (logs.length < 5) continue;

        const values = logs
          .map((row) => valueFromLog(row, metric))
          .filter((v): v is number => Number.isFinite(v ?? NaN))
          .slice(0, 10);
        if (values.length < 5) continue;

        const mean = avg(values);
        const sd = stdDev(values);
        const cv = mean > 0 ? sd / mean : 1;

        const overHit = pctHit(values, line, "over");
        const impliedOver = 1 / overOdd;
        const edgeOver = Number((overHit / 100 - impliedOver).toFixed(4));
        const side = "over" as const;
        const odd = overOdd;
        const edge = edgeOver;
        propsAnalyzed += 1;
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

        const noteHitPct = pctHit(values, line, "over");
        const lineEdge = line > 0 ? clamp(((mean - line) / line) * 40, -20, 20) : 0;
        const hitEdge = clamp(((noteHitPct / 100) - 0.5) * 40, -20, 20);

        const dvpPosition = normalizeNbaDvpPosition(playerInfo.position);
        const dvpTotalTeams = dvpPosition ? (dvpTotalTeamsByPos.get(dvpPosition) ?? 0) : 0;
        const dvpMetricRank =
          dvpPosition && Number.isFinite(Number(opponentTeamId ?? NaN))
            ? (dvpMetricRankByPosMetricTeam.get(
                `${dvpPosition}:${trendMetric}:${Number(opponentTeamId)}`,
              ) ?? null)
            : null;
        const rankEdge =
          dvpMetricRank && dvpTotalTeams > 1
            ? clamp(
                ((dvpMetricRank - (dvpTotalTeams + 1) / 2) / ((dvpTotalTeams - 1) / 2)) * 20,
                -20,
                20,
              )
            : 0;

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
        const strengthEdge =
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
        const matchupPct = pctHit(matchupBase, line, "over");
        const h2hEdge = clamp(((matchupPct / 100) - 0.5) * 20, -6, 6);

        const consistencyEdge = clamp((0.35 - cv) * 20, -6, 6);
        const sampleEdge = values.length < 5 ? clamp((values.length - 5) * 2, -6, 0) : 0;

        const edgePct = edge * 100;
        const edgeSignal = clamp(edgePct * 1.6, -18, 18);
        const lowHitPenalty = noteHitPct < 58 ? -((58 - noteHitPct) * 1.25) : 0;

        const score = Math.round(
          clamp(
            40 +
              lineEdge * 0.75 +
              hitEdge * 1.1 +
              rankEdge * 0.55 +
              strengthEdge * 0.65 +
              h2hEdge * 0.7 +
              consistencyEdge +
              sampleEdge +
              edgeSignal +
              lowHitPenalty,
            0,
            100,
          ),
        );

        const grade = gradeFromSignals({
          score,
          hitPct: noteHitPct,
          edgePct,
          sampleSize: values.length,
          cv,
        });

        const pick: TopProp = {
          id: `${pack.gameId}-${i}`,
          playerId: playerInfo.player_id,
          player: prop.name,
          teamCode,
          opponentCode,
          metric,
          side,
          line,
          odds: odd,
          edge: Number(edgePct.toFixed(1)),
          score,
          grade,
          finalScore: score,
          gameId: pack.gameId,
          bookmaker: prop.bookmakerName ?? null,
        };

        const gameKey = Number(pack.gameId ?? NaN);
        if (!Number.isFinite(gameKey)) continue;
        const list = picksByGame.get(gameKey) ?? [];
        list.push(pick);
        picksByGame.set(gameKey, list);
      }
    }

    const sortProps = (a: TopProp, b: TopProp) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return b.edge - a.edge;
    };
    const dedupeByPlayerMetric = (picks: TopProp[]) => {
      const best = new Map<string, TopProp>();
      for (const pick of picks) {
        const key = `${normalizeText(pick.player)}::${String(pick.metric).toUpperCase()}`;
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
    const enforceGradeCapsPerGame = (picks: TopProp[]) => {
      let aPlusCount = 0;
      return picks.map((pick) => {
        if (pick.grade !== "A+") return pick;
        if (aPlusCount === 0) {
          aPlusCount += 1;
          return pick;
        }
        return { ...pick, grade: "A" };
      });
    };

    const props =
      selectedGameId !== null
        ? enforceGradeCapsPerGame(
            dedupeByPlayerMetric([...(picksByGame.get(selectedGameId) ?? [])])
              .sort(sortProps)
              .slice(0, 10),
          )
        : Array.from(picksByGame.entries())
            .sort((a, b) => a[0] - b[0])
            .flatMap(([, picks]) =>
              enforceGradeCapsPerGame(
                dedupeByPlayerMetric([...picks]).sort(sortProps).slice(0, 10),
              ),
            );

    const payload = {
      generatedAt: new Date().toISOString(),
      date,
      season,
      gameId: selectedGameId,
      events: games.length,
      propsAnalyzed,
      props,
    };
    memoryCache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    });
    return NextResponse.json({ ok: true, cached: false, ...payload });
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
