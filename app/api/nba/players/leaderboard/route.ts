// app/api/nba/players/leaderboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readNbaOddsDailyCache } from "@/lib/supabase/nba-odds-cache";

const DEFAULT_TIMEZONE = "America/Toronto";
const DEFAULT_SEASON = process.env.APISPORTS_NBA_SEASON ?? "2025";
const MIN_GAMES = 5;
const TOP_N = 5;

function torontoTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sanitizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

type SgoEvent = {
  teams?: {
    home?: { names?: { short?: string } | null } | null;
    away?: { names?: { short?: string } | null } | null;
  } | null;
  status?: { cancelled?: boolean } | null;
};

async function getTodayTeamCodes(date: string): Promise<string[]> {
  const cache = await readNbaOddsDailyCache(date).catch(() => null);
  if (!cache || !Array.isArray(cache.events)) return [];
  const codes = new Set<string>();
  for (const raw of cache.events) {
    const event = raw as SgoEvent;
    if (event?.status?.cancelled) continue;
    const home = sanitizeCode(String(event?.teams?.home?.names?.short ?? "").trim().toUpperCase());
    const away = sanitizeCode(String(event?.teams?.away?.names?.short ?? "").trim().toUpperCase());
    if (home) codes.add(home);
    if (away) codes.add(away);
  }
  return Array.from(codes);
}

export type LeaderboardEntry = {
  playerId: number;
  playerName: string;
  teamCode: string;
  position: string | null;
  seasonAvg: number;
  last5Avg: number | null;
  gamesPlayed: number;
  trend: "up" | "down" | "flat";
};

export type PropHitRateLogs = {
  playerId: number;
  metric: string;
  logs: Array<{ date: string; value: number }>;
};

type RawLeaderRow = {
  player_id: string | number;
  full_name: string | null;
  team_code: string | null;
  position: string | null;
  games_played: string | number;
  season_avg: string | number | null;
  last5_avg: string | number | null;
};

type RawLogRow = {
  player_id: string | number;
  game_date: string | null;
  points: string | number | null;
  rebounds: string | number | null;
  assists: string | number | null;
};

async function getTopByMetric(
  teamCodes: string[],
  metric: "points" | "rebounds" | "assists",
  season: string,
): Promise<LeaderboardEntry[]> {
  if (teamCodes.length === 0) return [];
  const codesLiteral = teamCodes.map((c) => `'${sanitizeCode(c)}'`).join(", ");

  const rows = await prisma.$queryRawUnsafe<RawLeaderRow[]>(`
    WITH player_stats AS (
      SELECT
        l.player_id,
        l.team_code,
        COUNT(*)::int AS games_played,
        AVG(l.${metric}) AS season_avg
      FROM nba_player_game_logs l
      WHERE l.season = '${season}'
        AND (l.is_preseason IS NULL OR l.is_preseason = false)
        AND l.${metric} IS NOT NULL
        AND l.team_code = ANY(ARRAY[${codesLiteral}])
      GROUP BY l.player_id, l.team_code
      HAVING COUNT(*) >= ${MIN_GAMES}
    ),
    last5_stats AS (
      SELECT
        sub.player_id,
        AVG(sub.val) AS last5_avg
      FROM (
        SELECT
          l.player_id,
          l.${metric} AS val,
          ROW_NUMBER() OVER (PARTITION BY l.player_id ORDER BY l.date DESC) AS rn
        FROM nba_player_game_logs l
        WHERE l.season = '${season}'
          AND (l.is_preseason IS NULL OR l.is_preseason = false)
          AND l.${metric} IS NOT NULL
          AND l.team_code = ANY(ARRAY[${codesLiteral}])
      ) sub
      WHERE sub.rn <= 5
      GROUP BY sub.player_id
    )
    SELECT
      ps.player_id,
      p.full_name,
      ps.team_code,
      p.position,
      ps.games_played,
      ROUND(ps.season_avg::numeric, 1) AS season_avg,
      ROUND(l5.last5_avg::numeric, 1) AS last5_avg
    FROM player_stats ps
    LEFT JOIN nba_players p ON p.player_id = ps.player_id AND p.season = '${season}'
    LEFT JOIN last5_stats l5 ON l5.player_id = ps.player_id
    ORDER BY ps.season_avg DESC
    LIMIT ${TOP_N}
  `);

  return rows.map((row) => {
    const seasonAvg = Number(row.season_avg ?? 0);
    const last5Avg = row.last5_avg != null ? Number(row.last5_avg) : null;
    const trend: "up" | "down" | "flat" =
      last5Avg === null
        ? "flat"
        : last5Avg > seasonAvg * 1.05
        ? "up"
        : last5Avg < seasonAvg * 0.95
        ? "down"
        : "flat";
    return {
      playerId: Number(row.player_id),
      playerName: String(row.full_name ?? `Player ${row.player_id}`),
      teamCode: String(row.team_code ?? ""),
      position: row.position ? String(row.position) : null,
      seasonAvg,
      last5Avg,
      gamesPlayed: Number(row.games_played ?? 0),
      trend,
    };
  });
}

async function getRecentLogs(
  playerIds: number[],
  season: string,
  limit = 10,
): Promise<PropHitRateLogs[]> {
  if (playerIds.length === 0) return [];
  const idsLiteral = playerIds.map((id) => Number(id)).filter(Number.isFinite).join(", ");
  if (!idsLiteral) return [];

  const rows = await prisma.$queryRawUnsafe<RawLogRow[]>(`
    SELECT
      sub.player_id,
      sub.game_date,
      sub.points,
      sub.rebounds,
      sub.assists
    FROM (
      SELECT
        l.player_id,
        l.date::text AS game_date,
        l.points,
        l.rebounds,
        l.assists,
        ROW_NUMBER() OVER (PARTITION BY l.player_id ORDER BY l.date DESC) AS rn
      FROM nba_player_game_logs l
      WHERE l.season = '${season}'
        AND (l.is_preseason IS NULL OR l.is_preseason = false)
        AND l.player_id = ANY(ARRAY[${idsLiteral}])
    ) sub
    WHERE sub.rn <= ${limit}
    ORDER BY sub.player_id, sub.game_date DESC
  `);

  const byPlayer = new Map<number, Array<{ date: string; points: number | null; rebounds: number | null; assists: number | null }>>();
  for (const row of rows) {
    const pid = Number(row.player_id);
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid)!.push({
      date: String(row.game_date ?? ""),
      points: row.points != null ? Number(row.points) : null,
      rebounds: row.rebounds != null ? Number(row.rebounds) : null,
      assists: row.assists != null ? Number(row.assists) : null,
    });
  }

  return playerIds
    .filter((id) => byPlayer.has(id))
    .map((id) => {
      const logs = byPlayer.get(id)!;
      return {
        playerId: id,
        metric: "all",
        logs: logs.map((l) => ({
          date: l.date,
          value: 0, // placeholder; actual value accessed per metric on frontend
          points: l.points ?? 0,
          rebounds: l.rebounds ?? 0,
          assists: l.assists ?? 0,
        })) as Array<{ date: string; value: number }>,
      };
    });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? torontoTodayYmd();
    const rawSeason = searchParams.get("season") ?? DEFAULT_SEASON;
    const season = rawSeason.match(/(\d{4})/)?.[1] ?? rawSeason.replace(/[^0-9]/g, "");
    const playerIdsParam = searchParams.get("playerIds") ?? "";
    const playerIds = playerIdsParam
      ? playerIdsParam.split(",").map(Number).filter(Number.isFinite)
      : [];

    const teamCodes = await getTodayTeamCodes(date);

    const [topScorers, topRebounders, topAssistmen, recentLogs] = await Promise.all([
      getTopByMetric(teamCodes, "points", season),
      getTopByMetric(teamCodes, "rebounds", season),
      getTopByMetric(teamCodes, "assists", season),
      playerIds.length > 0 ? getRecentLogs(playerIds, season) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      ok: true,
      date,
      season,
      playingTeams: teamCodes,
      topScorers,
      topRebounders,
      topAssistmen,
      recentLogs,
    });
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
