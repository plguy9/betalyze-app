// app/api/nba/players/[id]/summary/route.ts
// Data-source boundary:
// - This route is for NBA stats/logs/player facts (API-Sports + DB cache).
// - Do not source bookmaker odds from this route.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type {
  NbaPlayer,
  NbaPlayerAveragesWindow,
  NbaPlayerSummary,
  NbaTrend,
} from "@/lib/models/nba";
import { prisma } from "@/lib/prisma";
import {
  readNbaPlayerByIdFromDb,
} from "@/lib/nba/players-db";

const API_BASE =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
// Saison par défaut (fallback si non fourni par le front)
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ?? "2025";
const RAW_LEAGUE_ID =
  process.env.APISPORTS_NBA_LEAGUE_ID ?? "standard";
const GAMES_LEAGUE = (() => {
  const raw = String(RAW_LEAGUE_ID).trim().toLowerCase();
  if (!raw || raw === "nba" || raw === "12") return "standard";
  return raw;
})();
const NBA_LEAGUE_ID = Number.isFinite(Number(RAW_LEAGUE_ID))
  ? Number(RAW_LEAGUE_ID)
  : 12;
const MEMORY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes pour limiter les requêtes API
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
const NBA_REGULAR_START_BY_SEASON: Record<string, string> = {
  "2024": "2024-10-22",
  "2024-2025": "2024-10-22",
  "2025": "2025-10-21",
  "2025-2026": "2025-10-21",
};
const NBA_TEAM_CODE_BY_NAME: Record<string, string> = {
  "atlanta hawks": "ATL",
  "boston celtics": "BOS",
  "brooklyn nets": "BKN",
  "charlotte hornets": "CHA",
  "chicago bulls": "CHI",
  "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL",
  "denver nuggets": "DEN",
  "detroit pistons": "DET",
  "golden state warriors": "GSW",
  "houston rockets": "HOU",
  "indiana pacers": "IND",
  "los angeles clippers": "LAC",
  "la clippers": "LAC",
  "los angeles lakers": "LAL",
  "la lakers": "LAL",
  "memphis grizzlies": "MEM",
  "miami heat": "MIA",
  "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN",
  "new orleans pelicans": "NOP",
  "new york knicks": "NYK",
  "oklahoma city thunder": "OKC",
  "orlando magic": "ORL",
  "philadelphia 76ers": "PHI",
  "philly 76ers": "PHI",
  "phoenix suns": "PHX",
  "portland trail blazers": "POR",
  "sacramento kings": "SAC",
  "san antonio spurs": "SAS",
  "toronto raptors": "TOR",
  "utah jazz": "UTA",
  "washington wizards": "WAS",
};
const NBA_TEAM_CODE_BY_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  138: "DAL",
  139: "DEN",
  140: "DET",
  141: "GSW",
  142: "HOU",
  143: "IND",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  147: "MIA",
  148: "MIL",
  149: "MIN",
  150: "NOP",
  151: "NYK",
  152: "OKC",
  153: "ORL",
  154: "PHI",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  159: "TOR",
  160: "UTA",
  161: "WAS",
};

const resolveRegularSeasonStart = (seasonInput: string): number | null => {
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
};

// IDs des équipes NBA (API-Sports basketball)
const NBA_TEAM_IDS = new Set<number>([
  132, 133, 134, 135, 136, 137, 140, 143, 147, 148, 151, 153, 154, 159, 161, // East
  138, 139, 141, 142, 144, 145, 146, 149, 150, 152, 155, 156, 157, 158, 160, // West
]);

// Petit cache mémoire pour réduire les hits API quand on consulte souvent les mêmes joueurs
const memoryCache = new Map<
  string,
  { ts: number; payload: Record<string, unknown> }
>();

const toStr = (val: any): string | null => {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return null;
};

type ApiPlayerStatsGame = {
  game: { id: number; date: string };
  team: { id: number; name: string; code: string };
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  minutes: number | null;
  fieldGoalsMade?: number | null;
  fieldGoalsAttempted?: number | null;
  fieldGoalPct?: number | null;
  threePointsMade?: number | null;
  threePointsAttempted?: number | null;
  threePointPct?: number | null;
  freeThrowsMade?: number | null;
  freeThrowsAttempted?: number | null;
  freeThrowPct?: number | null;
  // autres champs ignorés
};

type ApiPlayersStatisticsResponse = {
  response: Array<{
    player: { id: number; firstname?: string; lastname?: string; name?: string };
    team: { id: number; name: string; code: string };
    statistics?: Array<{
      game: { id: number; date: string };
      team: { id: number; name: string; code: string };
      points?: number | null;
      rebounds?: number | null;
      assists?: number | null;
      minutes?: number | null;
    }>;
  }>;
};

function parseMinutes(min: any): number | null {
  if (min === null || min === undefined) return null;
  if (typeof min === "number") return min;
  if (typeof min === "string") {
    const parts = min.split(":");
    if (parts.length === 2) {
      const [m, s] = parts.map(Number);
      if (Number.isFinite(m) && Number.isFinite(s)) {
        return m + s / 60;
      }
    }
    const num = Number(min);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

const toNumberSafe = (val: any): number | null => {
  let num: number | null = null;
  if (typeof val === "number") {
    num = val;
  } else if (typeof val === "string") {
    num = Number(val);
  } else if (val && typeof val === "object") {
    const maybeDecimal = val as { toNumber?: () => number; toString?: () => string };
    if (typeof maybeDecimal.toNumber === "function") {
      num = maybeDecimal.toNumber();
    } else if (typeof maybeDecimal.toString === "function") {
      num = Number(maybeDecimal.toString());
    }
  }
  return Number.isFinite(num) ? num : null;
};

const toDateStringSafe = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === "string") {
    const ts = Date.parse(val);
    if (Number.isFinite(ts)) return new Date(ts).toISOString();
    return val;
  }
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "number") {
    const d = new Date(val);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (val && typeof val === "object" && typeof val.toString === "function") {
    const s = String(val.toString());
    return s ? s : null;
  }
  return null;
};

const normalizeTextToken = (val: string) =>
  val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTeamCodeSafe = (val: any): string | null => {
  const raw = toStr(val);
  if (!raw) return null;
  const compact = raw.trim().toUpperCase();
  if (/^[A-Z]{2,4}$/.test(compact)) return compact;
  const byName = NBA_TEAM_CODE_BY_NAME[normalizeTextToken(raw)];
  return byName ?? null;
};
const teamCodeFromTeamId = (teamId: any): string | null => {
  const id = toNumberSafe(teamId);
  if (!id) return null;
  return NBA_TEAM_CODE_BY_ID[id] ?? null;
};

const pctFrom = (
  made: number | null,
  attempts: number | null,
  direct: number | null,
): number | null => {
  if (direct !== null && direct !== undefined) return direct;
  if (made === null || made === undefined) return null;
  if (attempts === null || attempts === undefined || attempts <= 0) return null;
  return Number(((made / attempts) * 100).toFixed(1));
};

const pickScore = (source: any, keys: string[]): number | null => {
  const direct = toNumberSafe(source);
  if (direct !== null) return direct;
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const candidate = toNumberSafe((source as any)[key]);
    if (candidate !== null) return candidate;
  }
  return null;
};

const normalizeGameDate = (value: any): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidates = [
      value.start,
      value.date,
      value.datetime,
      value.full,
      value.utc,
      value.original,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c) return c;
    }
  }
  return null;
};

type ApiGameResponse = { response?: any[]; results?: number; errors?: any };

type ExtractedGameInfo = {
  date: string | null;
  home: { id: number | null; name: string | null; code: string | null };
  away: { id: number | null; name: string | null; code: string | null };
  homeScore: number | null;
  awayScore: number | null;
  leagueId: number | null;
  statusShort: string | null;
  isPreseason: boolean | null;
};

type CachedGameLogRow = {
  player_id: number;
  season: string;
  game_id: number;
  date: string | null;
  team_id: number | null;
  team_code: string | null;
  team_name: string | null;
  opponent_team_id: number | null;
  opponent_team_code: string | null;
  opponent_team_name: string | null;
  home_away: string | null;
  result: string | null;
  score: string | null;
  score_home: number | null;
  score_away: number | null;
  points: number | string | null;
  rebounds: number | string | null;
  assists: number | string | null;
  minutes: number | string | null;
  field_goals_made: number | string | null;
  field_goals_attempted: number | string | null;
  field_goal_pct: number | string | null;
  three_points_made: number | string | null;
  three_points_attempted: number | string | null;
  three_point_pct: number | string | null;
  free_throws_made: number | string | null;
  free_throws_attempted: number | string | null;
  free_throw_pct: number | string | null;
  is_preseason: boolean | null;
  league_id: number | null;
  status_short: string | null;
};

let logsTableInit: Promise<void> | null = null;

async function ensureLogsTable() {
  if (logsTableInit) return logsTableInit;
  logsTableInit = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        create table if not exists nba_player_game_logs (
          id bigint generated by default as identity primary key,
          player_id integer not null,
          season text not null,
          game_id integer not null,
          date timestamptz,
          team_id integer,
          team_code text,
          team_name text,
          opponent_team_id integer,
          opponent_team_code text,
          opponent_team_name text,
          home_away text,
          result text,
          score text,
          score_home integer,
          score_away integer,
          points numeric,
          rebounds numeric,
          assists numeric,
          minutes numeric,
          field_goals_made numeric,
          field_goals_attempted numeric,
          field_goal_pct numeric,
          three_points_made numeric,
          three_points_attempted numeric,
          three_point_pct numeric,
          free_throws_made numeric,
          free_throws_attempted numeric,
          free_throw_pct numeric,
          is_preseason boolean,
          league_id integer,
          status_short text,
          created_at timestamptz default now(),
          updated_at timestamptz default now(),
          unique (player_id, season, game_id)
        );
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists nba_player_game_logs_player_season_idx
        on nba_player_game_logs (player_id, season, date desc);
      `);
    } catch {
      // ignore setup failures
    }
  })();
  return logsTableInit;
}

function mapGameInfo(raw: any): ExtractedGameInfo {
  const includesPreseason = (val: string | null) =>
    Boolean(val && /pre[\s-]*season/i.test(val));

  const teams = raw?.teams ?? {};
  const scores = raw?.scores ?? {};

  const homeTeam =
    teams.home ?? teams.localteam ?? teams.local ?? teams.homeTeam ?? null;
  const awayTeam =
    teams.away ??
    teams.visitors ??
    teams.visitorteam ??
    teams.visitor ??
    teams.awayTeam ??
    null;

  const homeScore =
    pickScore(scores.home, ["total", "points", "score", "fulltime"]) ??
    pickScore(scores.localteam, ["score", "points", "total"]) ??
    null;
  const awayScore =
    pickScore(scores.away, ["total", "points", "score", "fulltime"]) ??
    pickScore(scores.visitors, ["points", "total", "score", "fulltime"]) ??
    pickScore(scores.visitorteam, ["score", "points", "total"]) ??
    null;
  const leagueStage =
    toStr(raw?.league?.stage) ??
    toStr(raw?.league?.type) ??
    toStr(raw?.league?.name) ??
    null;
  const gameStage =
    toStr(raw?.game?.stage) ??
    toStr(raw?.game?.type) ??
    toStr(raw?.game?.round) ??
    null;
  const isPreseason = includesPreseason(leagueStage) || includesPreseason(gameStage);

  const rawStatusShort = raw?.status?.short;
  const statusShort =
    typeof rawStatusShort === "number"
      ? rawStatusShort === 3
        ? "FT"
        : rawStatusShort === 2
          ? "LIVE"
          : rawStatusShort === 1
            ? "NS"
            : String(rawStatusShort)
      : rawStatusShort ?? null;

  return {
    date: normalizeGameDate(raw?.date),
    home: {
      id: homeTeam?.id ?? null,
      name: homeTeam?.name ?? null,
      code: homeTeam?.code ?? null,
    },
    away: {
      id: awayTeam?.id ?? null,
      name: awayTeam?.name ?? null,
      code: awayTeam?.code ?? null,
    },
    homeScore,
    awayScore,
    leagueId: raw?.league?.id ?? null,
    statusShort,
    isPreseason: isPreseason || null,
  };
}

async function hydrateCachedRowsDates(
  rows: CachedGameLogRow[],
  seasonForSummary: string,
): Promise<CachedGameLogRow[]> {
  if (!rows.length) return rows;
  const parseable = (value: any) => {
    const str = toDateStringSafe(value);
    return Boolean(str && Number.isFinite(Date.parse(str)));
  };
  const normalizedRows = rows.map((row) => {
    const normalizedDate = toDateStringSafe(row.date);
    return normalizedDate && normalizedDate !== row.date
      ? { ...row, date: normalizedDate }
      : row;
  });
  const needsDate = normalizedRows.filter(
    (row) => !parseable(row.date) && Number.isFinite(row.game_id),
  );
  if (!needsDate.length) return normalizedRows;
  const dateByGameId = new Map<number, string>();
  const missingGameIds = Array.from(
    new Set(
      needsDate
        .map((row) => Number(row.game_id))
        .filter((gid) => Number.isFinite(gid)),
    ),
  );
  if (missingGameIds.length) {
    try {
      type DateByGameRow = { game_id: number; date: string | null };
      const localRows = await prisma.$queryRaw<DateByGameRow[]>(
        Prisma.sql`
          select distinct on (game_id) game_id, date::text as date
          from nba_player_game_logs
          where game_id in (${Prisma.join(missingGameIds)})
            and date is not null
          order by game_id, updated_at desc
        `,
      );
      for (const row of localRows) {
        const gid = Number(row.game_id);
        const date = toDateStringSafe(row.date);
        if (Number.isFinite(gid) && date && Number.isFinite(Date.parse(date))) {
          dateByGameId.set(gid, date);
        }
      }
    } catch {
      // ignore local hydration errors
    }
  }

  let hydratedRows = normalizedRows.map((row) => {
    if (parseable(row.date)) return row;
    const hydrated = dateByGameId.get(Number(row.game_id));
    return hydrated ? { ...row, date: hydrated } : row;
  });

  const remaining = hydratedRows.filter(
    (row) => !parseable(row.date) && Number.isFinite(row.game_id),
  );
  if (!remaining.length || !API_KEY) return hydratedRows;
  // Avoid long blocking calls when many rows are missing dates (API quota/latency).
  if (remaining.length > 8) return hydratedRows;

  for (const row of remaining) {
    const gid = Number(row.game_id);
    if (!Number.isFinite(gid) || dateByGameId.has(gid)) continue;
    try {
      const tryUrls = [
        (() => {
          const url = new URL("/games", API_BASE);
          url.searchParams.set("id", String(gid));
          return url.toString();
        })(),
        (() => {
          const url = new URL("/games", API_BASE);
          url.searchParams.set("id", String(gid));
          url.searchParams.set("season", seasonForSummary);
          return url.toString();
        })(),
        (() => {
          const url = new URL("/games", API_BASE);
          url.searchParams.set("id", String(gid));
          url.searchParams.set("season", seasonForSummary);
          url.searchParams.set("league", GAMES_LEAGUE);
          return url.toString();
        })(),
      ];

      for (const u of tryUrls) {
        const res = await fetch(u, {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
          signal: AbortSignal.timeout(1200),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as ApiGameResponse;
        const info = data.response?.[0];
        if (!info) continue;
        const mapped = mapGameInfo(info);
        if (mapped.date && Number.isFinite(Date.parse(mapped.date))) {
          dateByGameId.set(gid, mapped.date);
          break;
        }
      }
    } catch {
      // ignore per-game failures
    }
  }

  if (!dateByGameId.size) return hydratedRows;
  hydratedRows = hydratedRows.map((row) => {
    if (parseable(row.date)) return row;
    const hydrated = dateByGameId.get(Number(row.game_id));
    return hydrated ? { ...row, date: hydrated } : row;
  });
  return hydratedRows;
}

const hasMissingMatchMeta = (row: CachedGameLogRow) => {
  const hasOpponent =
    row.opponent_team_id !== null ||
    Boolean(toStr(row.opponent_team_code)) ||
    Boolean(toStr(row.opponent_team_name));
  const hasDate = Number.isFinite(Date.parse(toDateStringSafe(row.date) ?? ""));
  const hasScore = row.score !== null || (row.score_home !== null && row.score_away !== null);
  const hasResult = row.result !== null && row.result !== "NA";
  const hasHomeAway = row.home_away !== null && row.home_away !== "unknown";
  return !hasDate || !hasOpponent || !hasScore || !hasResult || !hasHomeAway;
};

async function hydrateCachedRowsFromTeamSchedules(
  rows: CachedGameLogRow[],
  seasonForSummary: string,
): Promise<CachedGameLogRow[]> {
  if (!rows.length || !API_KEY) return rows;
  const targetRows = rows.filter(hasMissingMatchMeta);
  if (!targetRows.length) return rows;

  const teamIds = Array.from(
    new Set(
      rows
        .map((r) => toNumberSafe(r.team_id))
        .filter((id): id is number => id !== null && Number.isFinite(id) && id > 0),
    ),
  );
  if (!teamIds.length) return rows;

  const gameInfoById = new Map<number, ExtractedGameInfo>();
  const seasonYear = seasonForSummary.match(/(\d{4})/)?.[1] ?? null;
  const seasonCandidates = Array.from(
    new Set([seasonForSummary, seasonYear].filter(Boolean)),
  ) as string[];

  for (const teamId of teamIds) {
    for (const seasonCandidate of seasonCandidates) {
      try {
        const scheduleUrl = new URL("/games", API_BASE);
        scheduleUrl.searchParams.set("season", seasonCandidate);
        scheduleUrl.searchParams.set("team", String(teamId));
        const res = await fetch(scheduleUrl.toString(), {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        if (!res.ok) continue;
        const data = (await res.json().catch(() => null)) as ApiGameResponse | null;
        const games = Array.isArray(data?.response) ? data.response : [];
        for (const game of games) {
          const gid = toNumberSafe((game as { id?: unknown })?.id);
          if (!gid) continue;
          const mapped = mapGameInfo(game);
          gameInfoById.set(gid, mapped);
        }
        if (games.length > 0) break;
      } catch {
        // ignore team schedule hydration failures
      }
    }
  }
  if (!gameInfoById.size) return rows;

  const hydrateRow = (row: CachedGameLogRow): CachedGameLogRow => {
    const gid = toNumberSafe(row.game_id);
    if (!gid) return row;
    const info = gameInfoById.get(gid);
    if (!info) return row;

    const teamId = toNumberSafe(row.team_id);
    const teamCode =
      toTeamCodeSafe(row.team_code) ??
      teamCodeFromTeamId(teamId) ??
      toTeamCodeSafe(row.team_name) ??
      null;
    let homeAway = (row.home_away as "home" | "away" | "unknown" | null) ?? "unknown";
    if (homeAway === "unknown") {
      if (teamId && info.home.id && teamId === info.home.id) {
        homeAway = "home";
      } else if (teamId && info.away.id && teamId === info.away.id) {
        homeAway = "away";
      } else if (teamCode && toTeamCodeSafe(info.home.code) === teamCode) {
        homeAway = "home";
      } else if (teamCode && toTeamCodeSafe(info.away.code) === teamCode) {
        homeAway = "away";
      }
    }

    const currentOpponentCode = toTeamCodeSafe(row.opponent_team_code);
    const currentOpponentName = toStr(row.opponent_team_name);
    const currentOpponentId = toNumberSafe(row.opponent_team_id);
    const hasOpponent =
      currentOpponentId !== null ||
      currentOpponentCode !== null ||
      currentOpponentName !== null;

    let opponentId = currentOpponentId;
    let opponentName = currentOpponentName;
    let opponentCode = currentOpponentCode;

    if (!hasOpponent) {
      if (homeAway === "home") {
        opponentId = toNumberSafe(info.away.id);
        opponentName = toStr(info.away.name);
        opponentCode = toTeamCodeSafe(info.away.code) ?? teamCodeFromTeamId(opponentId);
      } else if (homeAway === "away") {
        opponentId = toNumberSafe(info.home.id);
        opponentName = toStr(info.home.name);
        opponentCode = toTeamCodeSafe(info.home.code) ?? teamCodeFromTeamId(opponentId);
      } else if (teamId && info.home.id && teamId !== info.home.id) {
        opponentId = toNumberSafe(info.home.id);
        opponentName = toStr(info.home.name);
        opponentCode = toTeamCodeSafe(info.home.code) ?? teamCodeFromTeamId(opponentId);
      } else if (teamId && info.away.id && teamId !== info.away.id) {
        opponentId = toNumberSafe(info.away.id);
        opponentName = toStr(info.away.name);
        opponentCode = toTeamCodeSafe(info.away.code) ?? teamCodeFromTeamId(opponentId);
      }
    }

    const scoreHome = row.score_home ?? info.homeScore ?? null;
    const scoreAway = row.score_away ?? info.awayScore ?? null;
    const score =
      row.score ??
      (scoreHome !== null && scoreAway !== null ? `${scoreHome}-${scoreAway}` : null);
    let result = row.result ?? null;
    if (
      (!result || result === "NA") &&
      scoreHome !== null &&
      scoreAway !== null &&
      (homeAway === "home" || homeAway === "away")
    ) {
      const won =
        (homeAway === "home" && scoreHome > scoreAway) ||
        (homeAway === "away" && scoreAway > scoreHome);
      result = won ? "W" : "L";
    }

    const dateValue = toDateStringSafe(row.date) ?? info.date ?? null;

    return {
      ...row,
      date: dateValue,
      opponent_team_id: opponentId ?? row.opponent_team_id,
      opponent_team_name: opponentName ?? row.opponent_team_name,
      opponent_team_code: opponentCode ?? row.opponent_team_code,
      home_away: homeAway ?? row.home_away,
      score_home: scoreHome,
      score_away: scoreAway,
      score,
      result: result ?? row.result,
      status_short: row.status_short ?? info.statusShort ?? null,
      league_id: row.league_id ?? info.leagueId ?? null,
      is_preseason: row.is_preseason ?? info.isPreseason ?? null,
    };
  };

  return rows.map(hydrateRow);
}

function buildAverages(
  games: ApiPlayerStatsGame[] | undefined,
  limit: number,
): NbaPlayerAveragesWindow | null {
  if (!games || games.length === 0) return null;
  const slice = games.slice(0, limit);
  const sampleSize = slice.length;
  const sum = { points: 0, rebounds: 0, assists: 0, minutes: 0 };
  const vals = { points: [] as number[], minutes: [] as number[] };

  for (const g of slice) {
    const p = toNumberSafe(g.points);
    const r = toNumberSafe(g.rebounds);
    const a = toNumberSafe(g.assists);
    const m = parseMinutes(g.minutes);

    if (p !== null) {
      sum.points += p;
      vals.points.push(p);
    }
    if (r !== null) sum.rebounds += r;
    if (a !== null) sum.assists += a;
    if (m !== null) {
      sum.minutes += m;
      vals.minutes.push(m);
    }
  }

  const avg = (total: number, count: number) =>
    count > 0 ? Number((total / count).toFixed(2)) : null;

  const points = vals.points.length ? avg(sum.points, vals.points.length) : null;
  const rebounds = sum.rebounds ? avg(sum.rebounds, sampleSize) : null;
  const assists = sum.assists ? avg(sum.assists, sampleSize) : null;
  const minutes = vals.minutes.length
    ? avg(sum.minutes, vals.minutes.length)
    : null;

  const stddev = (arr: number[]) => {
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
    return Number(Math.sqrt(variance).toFixed(2));
  };

  return {
    sampleSize,
    points,
    rebounds,
    assists,
    minutes,
    fieldGoalsAttempted: null,
    threePointsAttempted: null,
    turnovers: null,
    pointsStdDev: stddev(vals.points),
    minutesStdDev: stddev(vals.minutes),
  };
}

function buildSummaryFromCached(
  playerId: string,
  season: string,
  rows: CachedGameLogRow[],
): NbaPlayerSummary {
  const regularSeasonStart = resolveRegularSeasonStart(season);
  const sortedRows = [...rows].sort((a, b) => {
    const da = Date.parse(toDateStringSafe(a.date) ?? "");
    const db = Date.parse(toDateStringSafe(b.date) ?? "");
    const hasDa = Number.isFinite(da);
    const hasDb = Number.isFinite(db);
    if (hasDa && hasDb) return db - da;
    if (hasDa && !hasDb) return -1;
    if (!hasDa && hasDb) return 1;
    return (Number(b.game_id) || 0) - (Number(a.game_id) || 0);
  });

  const filteredRows = sortedRows.filter((r) => {
    if (r.is_preseason) return false;
    if (r.league_id && Number(r.league_id) !== NBA_LEAGUE_ID) return false;
    if (r.status_short && !FINISHED_STATUSES.has(r.status_short)) return false;
    if (regularSeasonStart && r.date) {
      const ts = Date.parse(toDateStringSafe(r.date) ?? "");
      if (Number.isFinite(ts) && ts < regularSeasonStart) return false;
    }
    const minutes = toNumberSafe(r.minutes);
    if (minutes !== null && minutes > 0) return true;
    const hasCounting = [r.points, r.rebounds, r.assists]
      .map((v) => toNumberSafe(v))
      .some((v) => v !== null && v > 0);
    const hasAttempts = [r.field_goals_attempted, r.three_points_attempted, r.free_throws_attempted]
      .map((v) => toNumberSafe(v))
      .some((v) => v !== null && v > 0);
    return hasCounting || hasAttempts;
  });
  const rowsForStats = filteredRows.length ? filteredRows : sortedRows;

  const averagesSource: ApiPlayerStatsGame[] = rowsForStats.map((r) => ({
    game: { id: r.game_id, date: toDateStringSafe(r.date) ?? "" },
    team: {
      id: Number(toNumberSafe(r.team_id) ?? 0),
      name: r.team_name ?? "",
      code: toTeamCodeSafe(r.team_code) ?? "",
    },
    points: toNumberSafe(r.points),
    rebounds: toNumberSafe(r.rebounds),
    assists: toNumberSafe(r.assists),
    minutes: toNumberSafe(r.minutes),
    fieldGoalsMade: toNumberSafe(r.field_goals_made),
    fieldGoalsAttempted: toNumberSafe(r.field_goals_attempted),
    fieldGoalPct: toNumberSafe(r.field_goal_pct),
    threePointsMade: toNumberSafe(r.three_points_made),
    threePointsAttempted: toNumberSafe(r.three_points_attempted),
    threePointPct: toNumberSafe(r.three_point_pct),
    freeThrowsMade: toNumberSafe(r.free_throws_made),
    freeThrowsAttempted: toNumberSafe(r.free_throws_attempted),
    freeThrowPct: toNumberSafe(r.free_throw_pct),
  }));

  const last5 = buildAverages(averagesSource, 5);
  const last10 = buildAverages(averagesSource, 10);
  const seasonAvg = buildAverages(averagesSource, averagesSource.length);
  const dataQuality =
    (last5?.sampleSize ?? 0) >= 3 ? "high" : (last5?.sampleSize ?? 0) >= 1 ? "medium" : "low";

  const teamId =
    toNumberSafe(rowsForStats[0]?.team_id) ??
    toNumberSafe(sortedRows[0]?.team_id) ??
    null;
  const teamName = rowsForStats[0]?.team_name ?? sortedRows[0]?.team_name ?? null;
  const teamCode =
    toTeamCodeSafe(rowsForStats[0]?.team_code) ??
    toTeamCodeSafe(sortedRows[0]?.team_code) ??
    teamCodeFromTeamId(teamId);

  return {
    player: {
      id: Number(playerId),
      fullName: "",
      firstName: null,
      lastName: null,
      teamId,
      teamName,
      teamCode,
      position: null,
      jerseyNumber: null,
      height: null,
      weight: null,
      nationality: null,
      birthDate: null,
      isActive: true,
    },
    last5,
    last10,
    season,
    // @ts-expect-error extension front
    seasonAvg,
    pointsTrend: computeTrend(last5),
    dataQuality,
    // @ts-expect-error ajout custom pour le front (log minimal)
    games: rowsForStats.map((r) => ({
      gameId: r.game_id,
      date: toDateStringSafe(r.date) ?? "",
      teamId: r.team_id ?? null,
      teamName: r.team_name ?? null,
      teamCode:
        toTeamCodeSafe(r.team_code) ??
        teamCodeFromTeamId(r.team_id) ??
        toStr(r.team_code),
      opponentTeamId: r.opponent_team_id ?? null,
      opponentTeamName:
        toStr(r.opponent_team_name) ??
        toStr(r.opponent_team_code) ??
        null,
      opponentTeamCode:
        toTeamCodeSafe(r.opponent_team_code) ??
        toTeamCodeSafe(r.opponent_team_name) ??
        toStr(r.opponent_team_code),
      homeAway: (r.home_away as "home" | "away" | "unknown") ?? "unknown",
      result: (r.result as "W" | "L" | "NA") ?? "NA",
      score: r.score ?? null,
      scoreHome: r.score_home ?? null,
      scoreAway: r.score_away ?? null,
      points: toNumberSafe(r.points),
      rebounds: toNumberSafe(r.rebounds),
      assists: toNumberSafe(r.assists),
      minutes: toNumberSafe(r.minutes),
      fieldGoalsMade: toNumberSafe(r.field_goals_made),
      fieldGoalsAttempted: toNumberSafe(r.field_goals_attempted),
      fieldGoalPct: toNumberSafe(r.field_goal_pct),
      threePointsMade: toNumberSafe(r.three_points_made),
      threePointsAttempted: toNumberSafe(r.three_points_attempted),
      threePointPct: toNumberSafe(r.three_point_pct),
      freeThrowsMade: toNumberSafe(r.free_throws_made),
      freeThrowsAttempted: toNumberSafe(r.free_throws_attempted),
      freeThrowPct: toNumberSafe(r.free_throw_pct),
      isPreseason: r.is_preseason ?? false,
      leagueId: r.league_id ?? null,
      statusShort: r.status_short ?? null,
    })),
  };
}

function computeTrend(last5: NbaPlayerAveragesWindow | null): NbaTrend {
  if (!last5 || !last5.points || last5.pointsStdDev === null) return "unknown";
  const volatility = last5.pointsStdDev ?? 0;
  const avg = last5.points;
  if (avg > 20 && volatility < 5) return "up";
  if (avg > 10 && volatility < 8) return "flat";
  return "down";
}

async function fetchCachedLogs(
  playerId: string,
  seasons: string[],
): Promise<{ season: string; rows: CachedGameLogRow[] } | null> {
  await ensureLogsTable();
  const candidates: Array<{
    season: string;
    rows: CachedGameLogRow[];
    bestTs: number;
    order: number;
  }> = [];
  const toTs = (raw: unknown) => {
    const parsed = Date.parse(String(raw ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  for (const season of seasons) {
    try {
      const rows = await prisma.$queryRaw<CachedGameLogRow[]>`
        select *
        from nba_player_game_logs
        where player_id = ${Number(playerId)} and season = ${season}
        order by date desc nulls last, game_id desc
      `;
      if (rows.length) {
        let bestTs = 0;
        for (const row of rows) {
          const ts = toTs(row.date);
          if (ts > bestTs) bestTs = ts;
        }
        candidates.push({
          season,
          rows,
          bestTs,
          order: candidates.length,
        });
      }
    } catch {
      // ignore read errors
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (b.bestTs !== a.bestTs) return b.bestTs - a.bestTs;
    return a.order - b.order;
  });
  return { season: candidates[0].season, rows: candidates[0].rows };
}

function latestGameTsFromPayload(payload: unknown): number {
  const maybePayload = payload as {
    summary?: { games?: Array<{ date?: string | null }> };
  };
  const games = Array.isArray(maybePayload?.summary?.games)
    ? maybePayload.summary.games
    : [];
  let bestTs = 0;
  for (const game of games) {
    const parsed = Date.parse(String(game?.date ?? ""));
    if (Number.isFinite(parsed) && parsed > bestTs) bestTs = parsed;
  }
  return bestTs;
}

async function fetchLatestCachedLogTs(
  playerId: string,
  seasons: string[],
): Promise<number> {
  await ensureLogsTable();
  const uniqueSeasons = Array.from(new Set(seasons.filter(Boolean)));
  if (!uniqueSeasons.length) return 0;
  try {
    const rows = await prisma.$queryRaw<Array<{ max_date: string | Date | null }>>(
      Prisma.sql`
        select max(date) as max_date
        from nba_player_game_logs
        where player_id = ${Number(playerId)}
          and season in (${Prisma.join(uniqueSeasons)})
      `,
    );
    const raw = rows[0]?.max_date ?? null;
    const ts = Date.parse(String(raw ?? ""));
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

export async function GET(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  let lastResponse: any = null;
  let lastUrl: string | null = null;

  if (!API_BASE || !API_KEY) {
    return NextResponse.json(
      { error: "Missing API config" },
      { status: 500 },
    );
  }

  if (API_BASE.includes("basketball")) {
    return NextResponse.json(
      {
        error:
          "APISPORTS_NBA_URL must point to NBA v2 (v2.nba.api-sports.io). Basketball v1 fallback is disabled.",
      },
      { status: 500 },
    );
  }

  const { searchParams, pathname } = new URL(req.url);
  const resolvedParams = await Promise.resolve(context.params);

  function extractId(): string | null {
    if (resolvedParams?.id) return String(resolvedParams.id);
    const fromQuery = searchParams.get("id");
    if (fromQuery) return fromQuery;
    const match = pathname.match(/\/players\/([^/]+)\/summary/);
    return match ? match[1] : null;
  }

  const playerId = extractId();
  if (!playerId) {
    return NextResponse.json(
      { error: "Missing player id" },
      { status: 400 },
    );
  }

  const seasonInput = searchParams.get("season") ?? DEFAULT_SEASON;
  const seasonYear = seasonInput.match(/(\d{4})/)?.[1] ?? seasonInput;
  const seasonForSummary = seasonInput;
  const regularSeasonStart = resolveRegularSeasonStart(seasonForSummary);
  const forceRefresh = searchParams.get("refresh") === "1";
  let seasonUsed = seasonForSummary;
  const seasonSpan =
    seasonYear && /^\d{4}$/.test(seasonYear)
      ? `${seasonYear}-${Number(seasonYear) + 1}`
      : null;
  const seasonsToTry = Array.from(
    new Set([
      seasonSpan,
      seasonInput, // ex: 2025-2026
      seasonYear, // ex: 2025
      Number(seasonYear) ? String(Number(seasonYear) - 1) : null,
      "2024",
      "2023",
    ]),
  ).filter(Boolean) as string[];

  // Cache mémoire (clé = playerId + season)
  const cacheKey = `${playerId}-${seasonForSummary}-v2`;
  const cached = memoryCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.ts < MEMORY_CACHE_TTL_MS) {
    const cachedGames = Array.isArray((cached.payload as any)?.summary?.games)
      ? ((cached.payload as any).summary.games as Array<{ date?: unknown }>)
      : [];
    const hasMissingDates = cachedGames.some((game) => {
      if (typeof game?.date !== "string" || !game.date) return true;
      return !Number.isFinite(Date.parse(game.date));
    });
    const hasMissingShooting = cachedGames.some((game) => {
      const g = game as {
        fieldGoalsMade?: unknown;
        fieldGoalsAttempted?: unknown;
        threePointsMade?: unknown;
        threePointsAttempted?: unknown;
        freeThrowsMade?: unknown;
        freeThrowsAttempted?: unknown;
      };
      const hasFg = toNumberSafe(g.fieldGoalsMade) !== null && toNumberSafe(g.fieldGoalsAttempted) !== null;
      const hasTp = toNumberSafe(g.threePointsMade) !== null && toNumberSafe(g.threePointsAttempted) !== null;
      const hasFt = toNumberSafe(g.freeThrowsMade) !== null && toNumberSafe(g.freeThrowsAttempted) !== null;
      return !hasFg || !hasTp || !hasFt;
    });
    const cachedLatestTs = latestGameTsFromPayload(cached.payload);
    let hasFresherDbLogs = false;
    if (cachedLatestTs > 0) {
      const latestDbTs = await fetchLatestCachedLogTs(playerId, seasonsToTry);
      hasFresherDbLogs = latestDbTs > cachedLatestTs;
    }
    if (!hasMissingDates && !hasMissingShooting && !hasFresherDbLogs) {
      return NextResponse.json(cached.payload);
    }
  }

  if (!forceRefresh) {
    const cachedLogs = await fetchCachedLogs(playerId, seasonsToTry);
    if (cachedLogs && cachedLogs.rows.length > 0) {
      let hydratedRows = await hydrateCachedRowsDates(
        cachedLogs.rows,
        cachedLogs.season,
      );
      hydratedRows = await hydrateCachedRowsFromTeamSchedules(
        hydratedRows,
        cachedLogs.season,
      );
      const summary = buildSummaryFromCached(
        playerId,
        cachedLogs.season,
        hydratedRows,
      );
      const payload = {
        ok: true,
        summary,
        debug: { lastResponse, lastUrl, cached: true, source: "db-fast-path" },
      };
      memoryCache.set(cacheKey, { ts: Date.now(), payload });
      return NextResponse.json(payload);
    }
  }

  try {
    let parsedResponse: ApiPlayersStatisticsResponse | null = null;
    const attempts: Array<{ url: string; results?: number; errors?: any }> = [];

    for (const s of seasonsToTry) {
      const urls = [
        (() => {
          const url = new URL("/players/statistics", API_BASE);
          url.searchParams.set("id", playerId);
          url.searchParams.set("season", s);
          return url;
        })(),
        (() => {
          const url = new URL("/players/statistics", API_BASE);
          url.searchParams.set("player", playerId);
          url.searchParams.set("season", s);
          return url;
        })(),
      ];

      for (const url of urls) {
        lastUrl = url.toString();
        attempts.push({ url: lastUrl, results: undefined, errors: undefined });
        let res: Response;
        try {
          res = await fetch(lastUrl, {
            headers: { "x-apisports-key": API_KEY },
            cache: "no-store",
          });
        } catch (err) {
          attempts[attempts.length - 1].errors = { message: String(err) };
          continue;
        }
        const textBody = await res.text().catch(() => "");
        lastResponse = textBody;

        if (!res.ok) {
          continue;
        }

        try {
          const data = JSON.parse(textBody) as ApiPlayersStatisticsResponse;
          attempts[attempts.length - 1].results = (data as any)?.results;
          attempts[attempts.length - 1].errors = (data as any)?.errors;
          lastResponse = data;
          if (Array.isArray(data.response) && data.response.length > 0) {
            parsedResponse = data;
            seasonUsed = s;
            break;
          }
        } catch {
          continue;
        }
      }
      if (parsedResponse) break;
    }

    const gamesApi = [...(parsedResponse?.response ?? [])];
    // Trier par date décroissante pour avoir les matchs les plus récents en haut
    const parseDate = (val: any) => {
      if (!val) return 0;
      const d = new Date(val).getTime();
      return Number.isFinite(d) ? d : 0;
    };
    gamesApi.sort((a: any, b: any) => parseDate(b?.game?.date) - parseDate(a?.game?.date));

    if (!gamesApi || gamesApi.length === 0) {
      const cachedLogs = await fetchCachedLogs(playerId, seasonsToTry);
      if (cachedLogs && cachedLogs.rows.length > 0) {
        let hydratedRows = await hydrateCachedRowsDates(
          cachedLogs.rows,
          cachedLogs.season,
        );
        hydratedRows = await hydrateCachedRowsFromTeamSchedules(
          hydratedRows,
          cachedLogs.season,
        );
        const summary = buildSummaryFromCached(
          playerId,
          cachedLogs.season,
          hydratedRows,
        );
        return NextResponse.json({
          ok: true,
          summary,
          debug: { lastResponse, lastUrl, cached: true },
        });
      }
      return NextResponse.json(
        {
          ok: true,
          summary: {
            player: {
              id: Number(playerId),
              fullName: "",
              firstName: null,
              lastName: null,
              teamId: null,
              teamName: null,
              teamCode: null,
              position: null,
              jerseyNumber: null,
              height: null,
              weight: null,
              nationality: null,
              birthDate: null,
              isActive: true,
            } as NbaPlayer,
            last5: null,
            last10: null,
            season: seasonForSummary,
            pointsTrend: "unknown",
            dataQuality: "low",
            games: [],
            debug: { lastResponse, lastUrl },
          },
        },
        { status: 200 },
      );
    }
    // Avec /games/statistics/players, l'entrée représente un match, on construit un tableau
    const gamesRaw: ApiPlayerStatsGame[] = gamesApi.map((s: any) => {
      const stat =
        Array.isArray(s.statistics) && s.statistics.length > 0
          ? s.statistics[0]
          : s;

      const team = stat.team ?? s.team ?? stat.teams?.team ?? stat.teams ?? null;

      const points =
        stat.points?.total ??
        stat.points?.points ??
        stat.points ??
        null;

      const rebounds =
        stat.rebounds?.total ??
        stat.rebounds?.totals ??
        stat.rebounds ??
        stat.totReb ??
        stat.reb ??
        null;

      const assists =
        stat.assists?.total ??
        stat.assists ??
        stat.totAst ??
        stat.ast ??
        null;

      const minutes =
        stat.min ??
        stat.minutes ??
        stat.time?.played ??
        stat.time ??
        s.minutes ??
        null;

      const fieldGoals =
        stat.field_goals ?? stat.fieldGoals ?? stat.fg ?? stat.fieldGoalsStats ?? null;
      const fieldGoalsMade = toNumberSafe(
        fieldGoals?.total ??
          fieldGoals?.made ??
          fieldGoals?.m ??
          fieldGoals?.fgm ??
          stat.fgm ??
          stat.fieldGoalsMade,
      );
      const fieldGoalsAttempted = toNumberSafe(
        fieldGoals?.attempts ??
          fieldGoals?.att ??
          fieldGoals?.a ??
          fieldGoals?.fga ??
          stat.fga ??
          stat.fieldGoalsAttempted,
      );
      const fieldGoalPct = pctFrom(
        fieldGoalsMade,
        fieldGoalsAttempted,
        toNumberSafe(
          fieldGoals?.percentage ??
            fieldGoals?.pct ??
            fieldGoals?.fgPct ??
            stat.fgp ??
            stat.fieldGoalsPct,
        ),
      );

      const threePoints =
        stat.threepoint_goals ?? stat.threePoints ?? stat.threePointGoals ?? stat.tp ?? null;
      const threePointsMade = toNumberSafe(
        threePoints?.total ??
          threePoints?.made ??
          threePoints?.m ??
          threePoints?.tpm ??
          stat.tpm ??
          stat.threePointsMade,
      );
      const threePointsAttempted = toNumberSafe(
        threePoints?.attempts ??
          threePoints?.att ??
          threePoints?.a ??
          threePoints?.tpa ??
          stat.tpa ??
          stat.threePointsAttempted,
      );
      const threePointPct = pctFrom(
        threePointsMade,
        threePointsAttempted,
        toNumberSafe(
          threePoints?.percentage ??
            threePoints?.pct ??
            threePoints?.tpPct ??
            stat.tpp ??
            stat.threePointsPct,
        ),
      );

      const freeThrows =
        stat.freethrows_goals ?? stat.freeThrows ?? stat.freethrows ?? stat.ft ?? null;
      const freeThrowsMade = toNumberSafe(
        freeThrows?.total ??
          freeThrows?.made ??
          freeThrows?.m ??
          freeThrows?.ftm ??
          stat.ftm ??
          stat.freeThrowsMade,
      );
      const freeThrowsAttempted = toNumberSafe(
        freeThrows?.attempts ??
          freeThrows?.att ??
          freeThrows?.a ??
          freeThrows?.fta ??
          stat.fta ??
          stat.freeThrowsAttempted,
      );
      const freeThrowPct = pctFrom(
        freeThrowsMade,
        freeThrowsAttempted,
        toNumberSafe(
          freeThrows?.percentage ??
            freeThrows?.pct ??
            freeThrows?.ftPct ??
            stat.ftp ??
            stat.freeThrowsPct,
        ),
      );

      return {
        game: stat.game ?? s.game,
        team,
        points,
        rebounds,
        assists,
        minutes,
        fieldGoalsMade,
        fieldGoalsAttempted,
        fieldGoalPct,
        threePointsMade,
        threePointsAttempted,
        threePointPct,
        freeThrowsMade,
        freeThrowsAttempted,
        freeThrowPct,
      };
    });

    // On tri les games par date décroissante pour le game log
    const games = gamesRaw
      .map((g) => ({
        ...g,
        game: {
          ...g.game,
          date:
            normalizeGameDate(g.game?.date) ??
            (g.game?.date ? String(g.game.date) : ""),
        },
      }))
      .sort((a, b) => {
        const da = new Date(a.game.date).getTime() || 0;
        const db = new Date(b.game.date).getTime() || 0;
        return db - da;
      });

    const cachedLogs = await fetchCachedLogs(playerId, [seasonUsed]);
    const cachedRows = cachedLogs?.rows ?? [];
    const cachedByGameId = new Map<number, CachedGameLogRow>();
    cachedRows.forEach((row) => {
      if (row?.game_id) cachedByGameId.set(row.game_id, row);
    });

    // Fetch game details to identify opponent (home/away)
    const isValidDateValue = (value: unknown) => {
      if (typeof value !== "string") return false;
      return Number.isFinite(Date.parse(value));
    };

    const uniqueGameIds = Array.from(
      new Set(games.map((g) => g.game.id).filter(Boolean)),
    ).filter((gid) => {
      const cachedRow = cachedByGameId.get(gid);
      if (!cachedRow) return true;
      const missingOpponent =
        !cachedRow.opponent_team_id && !cachedRow.opponent_team_code;
      const missingScore =
        !cachedRow.score &&
        cachedRow.score_home === null &&
        cachedRow.score_away === null;
      const missingMeta =
        cachedRow.league_id === null ||
        cachedRow.status_short === null ||
        cachedRow.is_preseason === null;
      const sourceGame = games.find((game) => game.game.id === gid);
      const missingDate =
        !isValidDateValue(cachedRow.date) &&
        !isValidDateValue(sourceGame?.game?.date);
      return missingOpponent || missingScore || missingMeta || missingDate;
    });

    const gameInfoCache = new Map<
      number,
      {
        date?: string | null;
        homeId?: number;
        homeName?: string;
        homeCode?: string;
        awayId?: number;
        awayName?: string;
        awayCode?: string;
        homeScore?: number | null;
        awayScore?: number | null;
        leagueId?: number | null;
        statusShort?: string | null;
        isPreseason?: boolean | null;
      }
    >();

    const mergeGameInfo = (
      gid: number,
      incoming: {
        date?: string | null;
        homeId?: number;
        homeName?: string;
        homeCode?: string;
        awayId?: number;
        awayName?: string;
        awayCode?: string;
        homeScore?: number | null;
        awayScore?: number | null;
        leagueId?: number | null;
        statusShort?: string | null;
        isPreseason?: boolean | null;
      },
    ) => {
      const prev = gameInfoCache.get(gid) ?? {};
      gameInfoCache.set(gid, {
        date: incoming.date ?? prev.date ?? null,
        homeId: incoming.homeId ?? prev.homeId,
        homeName: incoming.homeName ?? prev.homeName,
        homeCode: incoming.homeCode ?? prev.homeCode,
        awayId: incoming.awayId ?? prev.awayId,
        awayName: incoming.awayName ?? prev.awayName,
        awayCode: incoming.awayCode ?? prev.awayCode,
        homeScore: incoming.homeScore ?? prev.homeScore ?? null,
        awayScore: incoming.awayScore ?? prev.awayScore ?? null,
        leagueId: incoming.leagueId ?? prev.leagueId ?? null,
        statusShort: incoming.statusShort ?? prev.statusShort ?? null,
        isPreseason: incoming.isPreseason ?? prev.isPreseason ?? null,
      });
    };

    const teamIdsForSchedule = Array.from(
      new Set(
        games
          .map((g) => toNumberSafe(g?.team?.id))
          .filter((id): id is number => id !== null && Number.isFinite(id) && id > 0),
      ),
    );

    for (const teamId of teamIdsForSchedule) {
      try {
        const scheduleUrl = new URL("/games", API_BASE);
        scheduleUrl.searchParams.set("season", seasonUsed);
        scheduleUrl.searchParams.set("team", String(teamId));
        const scheduleRes = await fetch(scheduleUrl.toString(), {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        if (!scheduleRes.ok) continue;
        const scheduleData = (await scheduleRes.json()) as ApiGameResponse;
        const gamesForTeam = Array.isArray(scheduleData.response)
          ? scheduleData.response
          : [];
        for (const rawGame of gamesForTeam) {
          const gid = toNumberSafe(rawGame?.id ?? rawGame?.game?.id);
          if (!gid) continue;
          const mapped = mapGameInfo(rawGame);
          mergeGameInfo(gid, {
            date: mapped.date,
            homeId: mapped.home.id ?? undefined,
            homeName: mapped.home.name ?? undefined,
            homeCode: mapped.home.code ?? undefined,
            awayId: mapped.away.id ?? undefined,
            awayName: mapped.away.name ?? undefined,
            awayCode: mapped.away.code ?? undefined,
            homeScore: mapped.homeScore,
            awayScore: mapped.awayScore,
            leagueId: mapped.leagueId,
            statusShort: mapped.statusShort,
            isPreseason: mapped.isPreseason ?? null,
          });
        }
      } catch {
        // ignore schedule prefetch failures
      }
    }

    for (const gid of uniqueGameIds) {
      try {
        // On tente plusieurs URLs pour maximiser les chances d'avoir l'info.
        // Ordre : par id seul (souvent suffisant), puis id + season complète, puis id + season + league.
        const tryUrls = [
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            return url.toString();
          })(),
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            url.searchParams.set("season", seasonForSummary);
            return url.toString();
          })(),
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            url.searchParams.set("season", seasonForSummary);
            url.searchParams.set("league", GAMES_LEAGUE);
            return url.toString();
          })(),
        ];

        for (const u of tryUrls) {
          const res = await fetch(u, {
            headers: { "x-apisports-key": API_KEY },
            cache: "no-store",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as ApiGameResponse;
          const info = data.response?.[0];
          if (info) {
            const mapped = mapGameInfo(info);
            mergeGameInfo(gid, {
              date: mapped.date,
              homeId: mapped.home.id ?? undefined,
              homeName: mapped.home.name ?? undefined,
              homeCode: mapped.home.code ?? undefined,
              awayId: mapped.away.id ?? undefined,
              awayName: mapped.away.name ?? undefined,
              awayCode: mapped.away.code ?? undefined,
              homeScore: mapped.homeScore,
              awayScore: mapped.awayScore,
              leagueId: mapped.leagueId,
              statusShort: mapped.statusShort,
              isPreseason: mapped.isPreseason ?? null,
            });
            break;
          }
        }
      } catch {
        // ignore individual errors
      }
    }

    const player: NbaPlayer = {
      id: gamesApi[0]?.player?.id ?? Number(playerId),
      fullName:
        gamesApi[0]?.player?.name ??
        [gamesApi[0]?.player?.firstname, gamesApi[0]?.player?.lastname]
          .filter(Boolean)
          .join(" "),
      firstName: gamesApi[0]?.player?.firstname ?? null,
      lastName: gamesApi[0]?.player?.lastname ?? null,
      teamId: gamesRaw[0]?.team?.id ?? null,
      teamName: gamesRaw[0]?.team?.name ?? null,
      teamCode: gamesRaw[0]?.team?.code ?? null,
      position: null,
      jerseyNumber: null,
      height: null,
      weight: null,
      nationality: null,
      birthDate: null,
      isActive: true,
    };

    const playerProfile = await readNbaPlayerByIdFromDb(
      seasonForSummary,
      Number(playerId),
    ).catch(() => null);
    if (playerProfile) {
      const jerseyFromProfileRaw = playerProfile.jerseyNumber;
      const jerseyFromProfile =
        jerseyFromProfileRaw !== null && jerseyFromProfileRaw !== undefined
          ? Number(jerseyFromProfileRaw)
          : null;
      player.fullName = player.fullName || playerProfile.fullName || player.fullName;
      player.firstName = player.firstName ?? playerProfile.firstName ?? null;
      player.lastName = player.lastName ?? playerProfile.lastName ?? null;
      player.teamId = player.teamId ?? playerProfile.teamId ?? null;
      player.teamName = player.teamName ?? playerProfile.teamName ?? null;
      player.teamCode = player.teamCode ?? playerProfile.teamCode ?? null;
      player.position = player.position ?? playerProfile.position ?? null;
      player.jerseyNumber =
        player.jerseyNumber ??
        (Number.isFinite(jerseyFromProfile) ? jerseyFromProfile : null);
      player.height = player.height ?? playerProfile.height ?? null;
      player.weight = player.weight ?? playerProfile.weight ?? null;
      player.nationality = player.nationality ?? playerProfile.nationality ?? null;
      player.birthDate = player.birthDate ?? playerProfile.birthDate ?? null;
      player.isActive =
        typeof player.isActive === "boolean"
          ? player.isActive
          : (playerProfile.isActive ?? true);
    }

    const last5 = buildAverages(games, 5);
    const last10 = buildAverages(games, 10);
    const seasonAvg = buildAverages(games, games.length);
    const dataQuality =
      (last5?.sampleSize ?? 0) >= 3 ? "high" : (last5?.sampleSize ?? 0) >= 1 ? "medium" : "low";

    const finishedStatuses = FINISHED_STATUSES;

    const mappedGames = games.map((g) => {
      const info = gameInfoCache.get(g.game.id);
      const cachedRow = cachedByGameId.get(g.game.id);
      const teamId = g.team?.id ?? cachedRow?.team_id ?? null;

      const isSameTeam = (a: any, b: any) =>
        toStr(a) !== null && toStr(b) !== null && toStr(a) === toStr(b);

      let homeAway: "home" | "away" | "unknown" =
        (cachedRow?.home_away as "home" | "away" | "unknown") ?? "unknown";
      if (homeAway === "unknown") {
        if (info?.homeId && teamId && isSameTeam(info.homeId, teamId)) {
          homeAway = "home";
        } else if (info?.awayId && teamId && isSameTeam(info.awayId, teamId)) {
          homeAway = "away";
        }
      }

      let opponent = { id: null, name: null, code: null as string | null };
      if (cachedRow) {
        opponent = {
          id: cachedRow.opponent_team_id ?? null,
          name: cachedRow.opponent_team_name ?? null,
          code: cachedRow.opponent_team_code ?? null,
        };
      }
      const hasOpponentInfo =
        opponent.id !== null || Boolean(opponent.name) || Boolean(opponent.code);
      if (info && !hasOpponentInfo) {
        if (homeAway === "home") {
          opponent = {
            id: info.awayId ?? null,
            name: info.awayName ?? null,
            code: info.awayCode ?? null,
          };
        } else if (homeAway === "away") {
          opponent = {
            id: info.homeId ?? null,
            name: info.homeName ?? null,
            code: info.homeCode ?? null,
          };
        } else if (info.homeId && !isSameTeam(info.homeId, teamId)) {
          opponent = {
            id: info.homeId ?? null,
            name: info.homeName ?? null,
            code: info.homeCode ?? null,
          };
        } else if (info.awayId && !isSameTeam(info.awayId, teamId)) {
          opponent = {
            id: info.awayId ?? null,
            name: info.awayName ?? null,
            code: info.awayCode ?? null,
          };
        }
      }
      if (homeAway === "unknown" && info) {
        if (info.homeId && teamId && isSameTeam(info.homeId, teamId)) {
          homeAway = "home";
        } else if (info.awayId && teamId && isSameTeam(info.awayId, teamId)) {
          homeAway = "away";
        } else if (info.homeCode && teamId === null && g.team?.code) {
          if (isSameTeam(info.homeCode, g.team.code)) homeAway = "home";
        } else if (info.awayCode && teamId === null && g.team?.code) {
          if (isSameTeam(info.awayCode, g.team.code)) homeAway = "away";
        }
      }

      if (!hasOpponentInfo && info && (homeAway === "home" || homeAway === "away")) {
        if (homeAway === "home") {
          opponent = {
            id: info.awayId ?? null,
            name: info.awayName ?? null,
            code: info.awayCode ?? null,
          };
        } else {
          opponent = {
            id: info.homeId ?? null,
            name: info.homeName ?? null,
            code: info.homeCode ?? null,
          };
        }
      } else if (!hasOpponentInfo && info) {
        if (info.homeId && !isSameTeam(info.homeId, teamId)) {
          opponent = {
            id: info.homeId ?? null,
            name: info.homeName ?? null,
            code: info.homeCode ?? null,
          };
        } else if (info.awayId && !isSameTeam(info.awayId, teamId)) {
          opponent = {
            id: info.awayId ?? null,
            name: info.awayName ?? null,
            code: info.awayCode ?? null,
          };
        }
      }

      const homeScore = cachedRow?.score_home ?? info?.homeScore ?? null;
      const awayScore = cachedRow?.score_away ?? info?.awayScore ?? null;
      let result: "W" | "L" | "NA" =
        (cachedRow?.result as "W" | "L" | "NA") ?? "NA";
      if (
        result === "NA" &&
        homeScore !== null &&
        awayScore !== null &&
        (homeAway === "home" || homeAway === "away")
      ) {
        const weWon =
          (homeAway === "home" && homeScore > awayScore) ||
          (homeAway === "away" && awayScore > homeScore);
        result = weWon ? "W" : "L";
      }

      const teamName = toStr(g.team?.name) ?? cachedRow?.team_name ?? null;
      const teamCode =
        toTeamCodeSafe(g.team?.code) ??
        toTeamCodeSafe(cachedRow?.team_code) ??
        teamCodeFromTeamId(teamId) ??
        toStr(g.team?.code) ??
        toStr(cachedRow?.team_code);

      const opponentNameRaw = opponent.name;
      const opponentName =
        toStr(opponentNameRaw) ??
        toStr(opponent.code) ??
        (typeof opponent.id === "number" ? `Team ${opponent.id}` : null);
      const opponentCode =
        toTeamCodeSafe(opponent.code) ??
        toTeamCodeSafe(opponentNameRaw) ??
        teamCodeFromTeamId(opponent.id) ??
        toStr(opponent.code) ??
        toStr(opponentNameRaw);

      const leagueId = cachedRow?.league_id ?? info?.leagueId ?? null;
      const statusShort = cachedRow?.status_short ?? info?.statusShort ?? null;
      const isPreseason =
        cachedRow?.is_preseason ??
        info?.isPreseason ??
        (leagueId && Number(leagueId) !== NBA_LEAGUE_ID) ??
        null;

      return {
        gameId: g.game.id,
        date: info?.date ?? g.game.date ?? cachedRow?.date ?? "",
        teamId: g.team?.id ?? cachedRow?.team_id ?? null,
        teamName,
        teamCode,
        opponentTeamId: opponent.id ?? null,
        opponentTeamName: opponentName,
        opponentTeamCode: opponentCode,
        homeAway,
        result,
        score:
          cachedRow?.score ??
          (homeScore !== null && awayScore !== null
            ? `${homeScore}-${awayScore}`
            : null),
        scoreHome: homeScore,
        scoreAway: awayScore,
        points: g.points ?? null,
        rebounds: g.rebounds ?? null,
        assists: g.assists ?? null,
        minutes: parseMinutes(g.minutes),
        fieldGoalsMade: g.fieldGoalsMade ?? null,
        fieldGoalsAttempted: g.fieldGoalsAttempted ?? null,
        fieldGoalPct: g.fieldGoalPct ?? null,
        threePointsMade: g.threePointsMade ?? null,
        threePointsAttempted: g.threePointsAttempted ?? null,
        threePointPct: g.threePointPct ?? null,
        freeThrowsMade: g.freeThrowsMade ?? null,
        freeThrowsAttempted: g.freeThrowsAttempted ?? null,
        freeThrowPct: g.freeThrowPct ?? null,
        isPreseason,
        leagueId,
        statusShort,
      };
    });

    const countStats = (gm: (typeof mappedGames)[number]) => {
      let score = 0;
      if (Number.isFinite(gm.points ?? NaN)) score += 1;
      if (Number.isFinite(gm.rebounds ?? NaN)) score += 1;
      if (Number.isFinite(gm.assists ?? NaN)) score += 1;
      if (Number.isFinite(gm.minutes ?? NaN)) score += 1;
      if (Number.isFinite(gm.fieldGoalsAttempted ?? NaN)) score += 1;
      if (Number.isFinite(gm.threePointsAttempted ?? NaN)) score += 1;
      if (Number.isFinite(gm.freeThrowsAttempted ?? NaN)) score += 1;
      return score;
    };

    const dedupedGamesMap = new Map<number, (typeof mappedGames)[number]>();
    for (const gm of mappedGames) {
      const prev = dedupedGamesMap.get(gm.gameId);
      if (!prev) {
        dedupedGamesMap.set(gm.gameId, gm);
        continue;
      }
      if (countStats(gm) > countStats(prev)) {
        dedupedGamesMap.set(gm.gameId, gm);
      }
    }
    const dedupedGames = Array.from(dedupedGamesMap.values());

    const regularGames = dedupedGames.filter((gm) => {
      if (gm.isPreseason) return false;
      if (gm.leagueId && Number(gm.leagueId) !== NBA_LEAGUE_ID) return false;
      if (gm.statusShort && !finishedStatuses.has(gm.statusShort)) return false;
      if (regularSeasonStart && gm.date) {
        const ts = Date.parse(gm.date);
        if (Number.isFinite(ts) && ts < regularSeasonStart) return false;
      }
      return true;
    });

    const playedGames = regularGames
      .filter((gm) => {
        const minutes = typeof gm.minutes === "number" ? gm.minutes : null;
        if (minutes !== null && minutes > 0) return true;
        const hasCounting = [gm.points, gm.rebounds, gm.assists].some(
          (v) => typeof v === "number" && v > 0,
        );
        const hasAttempts = [
          gm.fieldGoalsAttempted,
          gm.threePointsAttempted,
          gm.freeThrowsAttempted,
        ].some((v) => typeof v === "number" && v > 0);
        return hasCounting || hasAttempts;
      });
    const sortedPlayedGames = [...playedGames].sort((a, b) => {
      const ta = Date.parse(a.date || "");
      const tb = Date.parse(b.date || "");
      const ka = Number.isFinite(ta) ? ta : a.gameId ?? 0;
      const kb = Number.isFinite(tb) ? tb : b.gameId ?? 0;
      return kb - ka;
    });
    const latestTeamGame = sortedPlayedGames.find((gm) => {
      const teamId = Number(gm.teamId ?? NaN);
      const teamCode = String(gm.teamCode ?? "").trim();
      return (Number.isFinite(teamId) && teamId > 0) || Boolean(teamCode);
    });
    const effectiveTeamId =
      latestTeamGame?.teamId ??
      player.teamId ??
      null;
    const effectiveTeamCode =
      latestTeamGame?.teamCode ??
      player.teamCode ??
      null;
    const effectiveTeamName =
      latestTeamGame?.teamName ??
      player.teamName ??
      null;

    // Calcul des moyennes sur le set final
    const averagesSource = playedGames.map((gm) => ({
      game: { id: gm.gameId, date: gm.date },
      team: { id: gm.teamId ?? 0, name: gm.teamName ?? "", code: gm.teamCode ?? "" },
      points: gm.points,
      rebounds: gm.rebounds,
      assists: gm.assists,
      minutes: gm.minutes,
    }));
    const avgLast5 = buildAverages(averagesSource, 5);
    const avgLast10 = buildAverages(averagesSource, 10);
    const avgSeason = buildAverages(averagesSource, averagesSource.length);

    const summary: NbaPlayerSummary = {
      player: {
        ...player,
        id: player.id ?? Number(playerId),
        teamId: effectiveTeamId,
        teamCode: effectiveTeamCode,
        teamName: effectiveTeamName,
      },
      last5: avgLast5 ?? last5,
      last10: avgLast10 ?? last10,
      season: seasonForSummary,
      // @ts-expect-error extension front
      seasonAvg: avgSeason ?? seasonAvg,
      pointsTrend: computeTrend(avgLast5 ?? last5),
      dataQuality,
      // @ts-expect-error ajout custom pour le front (log minimal)
      games: sortedPlayedGames
        .map((gm) => ({ ...gm, leagueId: undefined }))
        .sort((a, b) => {
          const ta = Date.parse(a.date || "");
          const tb = Date.parse(b.date || "");
          const ka = Number.isFinite(ta) ? ta : a.gameId ?? 0;
          const kb = Number.isFinite(tb) ? tb : b.gameId ?? 0;
          return kb - ka;
        }),
    };

    if (playedGames.length > 0) {
      await ensureLogsTable();
      const now = new Date().toISOString();
      const rows = playedGames.map((gm) => {
        const dateValue =
          gm.date && !Number.isNaN(Date.parse(gm.date))
            ? new Date(gm.date).toISOString()
            : null;
        return {
          player_id: Number(playerId),
          season: seasonUsed,
          game_id: gm.gameId,
          date: dateValue,
          team_id: gm.teamId ?? null,
          team_code: gm.teamCode ?? null,
          team_name: gm.teamName ?? null,
          opponent_team_id: gm.opponentTeamId ?? null,
          opponent_team_code: gm.opponentTeamCode ?? null,
          opponent_team_name: gm.opponentTeamName ?? null,
          home_away: gm.homeAway ?? null,
          result: gm.result ?? null,
          score: gm.score ?? null,
          score_home: gm.scoreHome ?? null,
          score_away: gm.scoreAway ?? null,
          points: gm.points ?? null,
          rebounds: gm.rebounds ?? null,
          assists: gm.assists ?? null,
          minutes: gm.minutes ?? null,
          field_goals_made: gm.fieldGoalsMade ?? null,
          field_goals_attempted: gm.fieldGoalsAttempted ?? null,
          field_goal_pct: gm.fieldGoalPct ?? null,
          three_points_made: gm.threePointsMade ?? null,
          three_points_attempted: gm.threePointsAttempted ?? null,
          three_point_pct: gm.threePointPct ?? null,
          free_throws_made: gm.freeThrowsMade ?? null,
          free_throws_attempted: gm.freeThrowsAttempted ?? null,
          free_throw_pct: gm.freeThrowPct ?? null,
          is_preseason: gm.isPreseason ?? null,
          league_id: gm.leagueId ?? null,
          status_short: gm.statusShort ?? null,
          updated_at: now,
        };
      });
      try {
        const queries = rows.map((row) => prisma.$executeRaw`
          insert into nba_player_game_logs (
            player_id,
            season,
            game_id,
            date,
            team_id,
            team_code,
            team_name,
            opponent_team_id,
            opponent_team_code,
            opponent_team_name,
            home_away,
            result,
            score,
            score_home,
            score_away,
            points,
            rebounds,
            assists,
            minutes,
            field_goals_made,
            field_goals_attempted,
            field_goal_pct,
            three_points_made,
            three_points_attempted,
            three_point_pct,
            free_throws_made,
            free_throws_attempted,
            free_throw_pct,
            is_preseason,
            league_id,
            status_short,
            updated_at
          ) values (
            ${row.player_id},
            ${row.season},
            ${row.game_id},
            cast(${row.date} as timestamptz),
            ${row.team_id},
            ${row.team_code},
            ${row.team_name},
            ${row.opponent_team_id},
            ${row.opponent_team_code},
            ${row.opponent_team_name},
            ${row.home_away},
            ${row.result},
            ${row.score},
            ${row.score_home},
            ${row.score_away},
            ${row.points},
            ${row.rebounds},
            ${row.assists},
            ${row.minutes},
            ${row.field_goals_made},
            ${row.field_goals_attempted},
            ${row.field_goal_pct},
            ${row.three_points_made},
            ${row.three_points_attempted},
            ${row.three_point_pct},
            ${row.free_throws_made},
            ${row.free_throws_attempted},
            ${row.free_throw_pct},
            ${row.is_preseason},
            ${row.league_id},
            ${row.status_short},
            cast(${row.updated_at} as timestamptz)
          )
          on conflict (player_id, season, game_id)
          do update set
            date = coalesce(excluded.date, nba_player_game_logs.date),
            team_id = coalesce(excluded.team_id, nba_player_game_logs.team_id),
            team_code = coalesce(excluded.team_code, nba_player_game_logs.team_code),
            team_name = coalesce(excluded.team_name, nba_player_game_logs.team_name),
            opponent_team_id = coalesce(excluded.opponent_team_id, nba_player_game_logs.opponent_team_id),
            opponent_team_code = coalesce(excluded.opponent_team_code, nba_player_game_logs.opponent_team_code),
            opponent_team_name = coalesce(excluded.opponent_team_name, nba_player_game_logs.opponent_team_name),
            home_away = coalesce(excluded.home_away, nba_player_game_logs.home_away),
            result = coalesce(excluded.result, nba_player_game_logs.result),
            score = coalesce(excluded.score, nba_player_game_logs.score),
            score_home = coalesce(excluded.score_home, nba_player_game_logs.score_home),
            score_away = coalesce(excluded.score_away, nba_player_game_logs.score_away),
            points = coalesce(excluded.points, nba_player_game_logs.points),
            rebounds = coalesce(excluded.rebounds, nba_player_game_logs.rebounds),
            assists = coalesce(excluded.assists, nba_player_game_logs.assists),
            minutes = coalesce(excluded.minutes, nba_player_game_logs.minutes),
            field_goals_made = coalesce(excluded.field_goals_made, nba_player_game_logs.field_goals_made),
            field_goals_attempted = coalesce(excluded.field_goals_attempted, nba_player_game_logs.field_goals_attempted),
            field_goal_pct = coalesce(excluded.field_goal_pct, nba_player_game_logs.field_goal_pct),
            three_points_made = coalesce(excluded.three_points_made, nba_player_game_logs.three_points_made),
            three_points_attempted = coalesce(excluded.three_points_attempted, nba_player_game_logs.three_points_attempted),
            three_point_pct = coalesce(excluded.three_point_pct, nba_player_game_logs.three_point_pct),
            free_throws_made = coalesce(excluded.free_throws_made, nba_player_game_logs.free_throws_made),
            free_throws_attempted = coalesce(excluded.free_throws_attempted, nba_player_game_logs.free_throws_attempted),
            free_throw_pct = coalesce(excluded.free_throw_pct, nba_player_game_logs.free_throw_pct),
            is_preseason = coalesce(excluded.is_preseason, nba_player_game_logs.is_preseason),
            league_id = coalesce(excluded.league_id, nba_player_game_logs.league_id),
            status_short = coalesce(excluded.status_short, nba_player_game_logs.status_short),
            updated_at = excluded.updated_at
        `);
        await prisma.$transaction(queries);
      } catch {
        // ignore cache failures
      }
    }

    const payload = {
      ok: true,
      summary,
      debug: { lastUrl, lastResponse },
    };
    // Toujours rafraîchir le cache mémoire avec le payload final.
    // Ainsi, un appel refresh=1 aligne immédiatement les appels suivants sans refresh.
    memoryCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("Unexpected error in /api/nba/players/[id]/summary:", err);
    return NextResponse.json(
      { error: "Unexpected server error", debug: { lastUrl, lastResponse, message: String(err?.message ?? err) } },
      { status: 500 },
    );
  }
}
