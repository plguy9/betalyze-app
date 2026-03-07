import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nbaSeasonAliases, normalizeNbaSeasonLabel } from "@/lib/nba/players-db";

type PositionKey = "G" | "F" | "C";
type WindowKey = "season" | "L10" | "L5";
type ContextKey = "all" | "home" | "away";
type GameContext = "home" | "away" | "unknown";

type StatTotals = {
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  threePointsMade: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

type PositionTotals = Record<PositionKey, StatTotals>;

type DefenseGameEntry = {
  date: number;
  context: GameContext;
  positions: PositionTotals;
};

type TeamMeta = {
  name: string | null;
  abbr: string | null;
};

type DvpComputedRow = {
  season: string;
  window: WindowKey;
  context: ContextKey;
  teamId: number;
  teamName: string | null;
  teamAbbr: string | null;
  position: PositionKey;
  games: number;
  btpTotal: number;
  btpPerGame: number;
  metrics: { totals: StatTotals; perGame: StatTotals };
};

type DvpLogRow = {
  game_id: number | string | null;
  date: Date | string | null;
  offense_home_away: string | null;
  defense_team_id: number | string | null;
  defense_team_name: string | null;
  defense_team_code: string | null;
  points: number | string | null;
  rebounds: number | string | null;
  assists: number | string | null;
  minutes: number | string | null;
  three_points_made: number | string | null;
  field_goals_made: number | string | null;
  field_goals_attempted: number | string | null;
  free_throws_made: number | string | null;
  free_throws_attempted: number | string | null;
  player_position: string | null;
};

const DEFAULT_SEASON = normalizeNbaSeasonLabel(
  process.env.APISPORTS_BASKETBALL_SEASON ??
    process.env.APISPORTS_NBA_SEASON ??
    "2025-2026",
);
const DEFAULT_LEAGUE_ID = Number(
  process.env.APISPORTS_BASKETBALL_LEAGUE_ID ??
    process.env.APISPORTS_NBA_LEAGUE_ID ??
    "12",
);

const FINISHED_STATUSES = ["FT", "AOT", "AET"];
const POSITIONS: PositionKey[] = ["G", "F", "C"];
const WINDOWS: WindowKey[] = ["season", "L10", "L5"];
const CONTEXTS: ContextKey[] = ["all", "home", "away"];
const NBA_TEAM_ID_SET = new Set<number>([
  132, 133, 134, 135, 136, 137, 140, 143, 147, 148, 151, 153, 154, 159, 161,
  138, 139, 141, 142, 144, 145, 146, 149, 150, 152, 155, 156, 157, 158, 160,
]);

const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { ts: number; payload: unknown }>();

function normalizeWindow(raw?: string | null): WindowKey {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "L10" || value === "LAST10") return "L10";
  if (value === "L5" || value === "LAST5") return "L5";
  return "season";
}

function normalizeContext(raw?: string | null): ContextKey {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "home") return "home";
  if (value === "away") return "away";
  return "all";
}

function normalizePosition(raw?: string | null): PositionKey | null {
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

  const compact = value.replace(/\s+/g, "");
  if (compact.includes("CENTER")) return "C";
  if (compact.includes("FORWARD")) return "F";
  if (compact.includes("GUARD")) return "G";
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Prisma.Decimal) {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  if (value && typeof value === "object") {
    const obj = value as { toNumber?: () => number; valueOf?: () => unknown };
    if (typeof obj.toNumber === "function") {
      const n = obj.toNumber();
      if (Number.isFinite(n)) return n;
    }
    if (typeof obj.valueOf === "function") {
      const n = Number(obj.valueOf());
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : 0;
  }
  return 0;
}

function initTotals(): StatTotals {
  return {
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
}

function initPositionTotals(): PositionTotals {
  return {
    G: initTotals(),
    F: initTotals(),
    C: initTotals(),
  };
}

function resolveDefenseContext(offenseHomeAway: string | null): GameContext {
  if (offenseHomeAway === "home") return "away";
  if (offenseHomeAway === "away") return "home";
  return "unknown";
}

function calcBtp(totals: StatTotals): number {
  return totals.points + totals.rebounds + totals.assists;
}

function perGameStats(totals: StatTotals, games: number): StatTotals {
  if (!games) return initTotals();
  const div = (v: number) => Number((v / games).toFixed(3));
  return {
    points: div(totals.points),
    rebounds: div(totals.rebounds),
    assists: div(totals.assists),
    minutes: div(totals.minutes),
    threePointsMade: div(totals.threePointsMade),
    fieldGoalsMade: div(totals.fieldGoalsMade),
    fieldGoalsAttempted: div(totals.fieldGoalsAttempted),
    freeThrowsMade: div(totals.freeThrowsMade),
    freeThrowsAttempted: div(totals.freeThrowsAttempted),
  };
}

function sliceWindow(games: DefenseGameEntry[], window: WindowKey, context: ContextKey) {
  const filtered = context === "all" ? games : games.filter((g) => g.context === context);
  if (window === "season") return filtered;
  return filtered.slice(0, window === "L10" ? 10 : 5);
}

function sumTotals(games: DefenseGameEntry[], position: PositionKey) {
  const totals = initTotals();
  for (const game of games) {
    const stats = game.positions[position];
    totals.points += stats.points;
    totals.rebounds += stats.rebounds;
    totals.assists += stats.assists;
    totals.minutes += stats.minutes;
    totals.threePointsMade += stats.threePointsMade;
    totals.fieldGoalsMade += stats.fieldGoalsMade;
    totals.fieldGoalsAttempted += stats.fieldGoalsAttempted;
    totals.freeThrowsMade += stats.freeThrowsMade;
    totals.freeThrowsAttempted += stats.freeThrowsAttempted;
  }
  return totals;
}

function addRanks(rows: DvpComputedRow[]) {
  const sorted = [...rows].sort((a, b) => a.btpPerGame - b.btpPerGame);
  const rankByTeam = new Map<number, number>();
  sorted.forEach((row, idx) => rankByTeam.set(row.teamId, idx + 1));
  return rows.map((row) => ({ ...row, rank: rankByTeam.get(row.teamId) ?? null }));
}

async function fetchLogs(season: string, leagueId: number) {
  const seasonAliases = nbaSeasonAliases(season);
  if (!seasonAliases.length) return [];

  const rows = await prisma.$queryRaw<DvpLogRow[]>(Prisma.sql`
    select
      l.game_id,
      l.date,
      l.home_away as offense_home_away,
      l.opponent_team_id as defense_team_id,
      l.opponent_team_name as defense_team_name,
      l.opponent_team_code as defense_team_code,
      l.points,
      l.rebounds,
      l.assists,
      l.minutes,
      l.three_points_made,
      l.field_goals_made,
      l.field_goals_attempted,
      l.free_throws_made,
      l.free_throws_attempted,
      np.position as player_position
    from nba_player_game_logs l
    left join lateral (
      select p.position
      from nba_players p
      where p.player_id = l.player_id
        and p.season in (${Prisma.join(seasonAliases)})
      order by p.updated_at desc nulls last
      limit 1
    ) np on true
    where l.season in (${Prisma.join(seasonAliases)})
      and l.opponent_team_id is not null
      and coalesce(l.is_preseason, false) = false
      and (l.league_id is null or l.league_id = ${leagueId})
      and (l.status_short is null or l.status_short in (${Prisma.join(FINISHED_STATUSES)}))
    order by l.date desc nulls last
  `);

  return rows;
}

function buildDefenseGames(rows: DvpLogRow[]) {
  const teamMeta = new Map<number, TeamMeta>();
  const byTeam = new Map<number, Map<number, DefenseGameEntry>>();

  for (const row of rows) {
    const defenseTeamId = Number(row.defense_team_id);
    if (!Number.isFinite(defenseTeamId) || defenseTeamId <= 0) continue;
    if (!NBA_TEAM_ID_SET.has(defenseTeamId)) continue;

    const position = normalizePosition(row.player_position);
    if (!position) continue;

    teamMeta.set(defenseTeamId, {
      name: row.defense_team_name ?? null,
      abbr: row.defense_team_code ?? null,
    });

    const gameId = Number(row.game_id);
    if (!Number.isFinite(gameId) || gameId <= 0) continue;

    const teamGames = byTeam.get(defenseTeamId) ?? new Map<number, DefenseGameEntry>();
    let game = teamGames.get(gameId);
    if (!game) {
      game = {
        date: toTimestamp(row.date),
        context: resolveDefenseContext(row.offense_home_away),
        positions: initPositionTotals(),
      };
      teamGames.set(gameId, game);
      byTeam.set(defenseTeamId, teamGames);
    }

    const target = game.positions[position];
    target.points += toNumber(row.points);
    target.rebounds += toNumber(row.rebounds);
    target.assists += toNumber(row.assists);
    target.minutes += toNumber(row.minutes);
    target.threePointsMade += toNumber(row.three_points_made);
    target.fieldGoalsMade += toNumber(row.field_goals_made);
    target.fieldGoalsAttempted += toNumber(row.field_goals_attempted);
    target.freeThrowsMade += toNumber(row.free_throws_made);
    target.freeThrowsAttempted += toNumber(row.free_throws_attempted);
  }

  const asList = new Map<number, DefenseGameEntry[]>();
  for (const [teamId, gameMap] of byTeam.entries()) {
    const games = Array.from(gameMap.values()).sort((a, b) => b.date - a.date);
    asList.set(teamId, games);
  }

  return { defenseGames: asList, teamMeta };
}

async function computeRows(
  season: string,
  window: WindowKey,
  context: ContextKey,
  position: PositionKey | null,
) {
  const rows = await fetchLogs(season, DEFAULT_LEAGUE_ID);
  const { defenseGames, teamMeta } = buildDefenseGames(rows);

  const selectedPositions = position ? [position] : POSITIONS;
  const result: DvpComputedRow[] = [];

  for (const [teamId, games] of defenseGames.entries()) {
    const windowGames = sliceWindow(games, window, context);
    if (!windowGames.length) continue;

    for (const pos of selectedPositions) {
      const totals = sumTotals(windowGames, pos);
      const gamesCount = windowGames.length;
      const btpTotal = Number(calcBtp(totals).toFixed(3));
      const btpPerGame = Number((btpTotal / gamesCount).toFixed(3));
      const perGame = perGameStats(totals, gamesCount);
      const meta = teamMeta.get(teamId) ?? { name: null, abbr: null };

      result.push({
        season,
        window,
        context,
        teamId,
        teamName: meta.name,
        teamAbbr: meta.abbr,
        position: pos,
        games: gamesCount,
        btpTotal,
        btpPerGame,
        metrics: { totals, perGame },
      });
    }
  }

  return addRanks(result);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const season = normalizeNbaSeasonLabel(params.get("season") ?? DEFAULT_SEASON);
  const window = normalizeWindow(params.get("window"));
  const context = normalizeContext(params.get("context"));
  const position = normalizePosition(params.get("position"));
  const refresh = params.get("refresh") === "1";

  const cacheKey = `${season}::${window}::${context}::${position ?? "all"}`;
  const cached = responseCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const rows = await computeRows(season, window, context, position);
    const payload = {
      ok: true,
      season,
      window,
      context,
      position,
      refreshed: refresh,
      positions: POSITIONS,
      windows: WINDOWS,
      contexts: CONTEXTS,
      rows,
    };
    responseCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
