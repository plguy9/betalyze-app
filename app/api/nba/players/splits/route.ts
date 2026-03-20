import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_SEASON = process.env.APISPORTS_NBA_SEASON ?? "2025";
const MIN_GAMES = 15;
const TOP_N = 30;

const METRIC_COLUMN: Record<string, string> = {
  pts: "points",
  reb: "rebounds",
  ast: "assists",
  "3pt": "three_points_made",
};

export type PlayerSplitRow = {
  playerId: number;
  playerName: string;
  teamCode: string;
  position: string | null;
  totalGames: number;
  // Home / Away
  homeGames: number;
  homeAvg: number | null;
  awayGames: number;
  awayAvg: number | null;
  homeDiff: number | null; // homeAvg - awayAvg
  // Win / Loss
  winGames: number;
  winAvg: number | null;
  lossGames: number;
  lossAvg: number | null;
  winDiff: number | null; // winAvg - lossAvg
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawMetric = searchParams.get("metric") ?? "pts";
    const col = METRIC_COLUMN[rawMetric] ?? "points";
    const rawSeason = searchParams.get("season") ?? DEFAULT_SEASON;
    const season = rawSeason.match(/(\d{4})/)?.[1] ?? rawSeason.replace(/[^0-9]/g, "");
    const top = Math.min(Number(searchParams.get("top") ?? TOP_N), 50);
    const minGames = Number(searchParams.get("minGames") ?? MIN_GAMES);

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      WITH latest_team AS (
        SELECT DISTINCT ON (player_id) player_id, team_code
        FROM nba_player_game_logs
        WHERE season = '${season}'
          AND team_code IS NOT NULL
        ORDER BY player_id, date DESC
      )
      SELECT
        l.player_id,
        p.full_name,
        lt.team_code,
        p.position,
        COUNT(*)::int AS total_games,
        COUNT(*) FILTER (WHERE l.home_away = 'home')::int AS home_games,
        ROUND(AVG(l.${col}) FILTER (WHERE l.home_away = 'home')::numeric, 1) AS home_avg,
        COUNT(*) FILTER (WHERE l.home_away = 'away')::int AS away_games,
        ROUND(AVG(l.${col}) FILTER (WHERE l.home_away = 'away')::numeric, 1) AS away_avg,
        COUNT(*) FILTER (WHERE l.result = 'W')::int AS win_games,
        ROUND(AVG(l.${col}) FILTER (WHERE l.result = 'W')::numeric, 1) AS win_avg,
        COUNT(*) FILTER (WHERE l.result = 'L')::int AS loss_games,
        ROUND(AVG(l.${col}) FILTER (WHERE l.result = 'L')::numeric, 1) AS loss_avg
      FROM nba_player_game_logs l
      LEFT JOIN latest_team lt ON lt.player_id = l.player_id
      LEFT JOIN nba_players p
        ON p.player_id = l.player_id AND p.season = '${season}'
      WHERE l.season = '${season}'
        AND (l.is_preseason IS NULL OR l.is_preseason = false)
        AND l.${col} IS NOT NULL
        AND l.home_away IN ('home', 'away')
      GROUP BY l.player_id, p.full_name, lt.team_code, p.position
      HAVING
        COUNT(*) >= ${minGames}
        AND COUNT(*) FILTER (WHERE l.home_away = 'home') >= 5
        AND COUNT(*) FILTER (WHERE l.home_away = 'away') >= 5
      ORDER BY
        ABS(
          COALESCE(AVG(l.${col}) FILTER (WHERE l.home_away = 'home'), 0) -
          COALESCE(AVG(l.${col}) FILTER (WHERE l.home_away = 'away'), 0)
        ) DESC NULLS LAST
      LIMIT ${top}
    `);

    const splits: PlayerSplitRow[] = rows.map((row) => {
      const homeAvg = row.home_avg != null ? Number(row.home_avg) : null;
      const awayAvg = row.away_avg != null ? Number(row.away_avg) : null;
      const winAvg  = row.win_avg  != null ? Number(row.win_avg)  : null;
      const lossAvg = row.loss_avg != null ? Number(row.loss_avg) : null;
      return {
        playerId:   Number(row.player_id),
        playerName: String(row.full_name ?? `Player ${row.player_id}`),
        teamCode:   String(row.team_code ?? ""),
        position:   row.position ? String(row.position) : null,
        totalGames: Number(row.total_games ?? 0),
        homeGames:  Number(row.home_games ?? 0),
        homeAvg,
        awayGames:  Number(row.away_games ?? 0),
        awayAvg,
        homeDiff:
          homeAvg != null && awayAvg != null
            ? Math.round((homeAvg - awayAvg) * 10) / 10
            : null,
        winGames:   Number(row.win_games ?? 0),
        winAvg,
        lossGames:  Number(row.loss_games ?? 0),
        lossAvg,
        winDiff:
          winAvg != null && lossAvg != null
            ? Math.round((winAvg - lossAvg) * 10) / 10
            : null,
      };
    });

    return NextResponse.json({ ok: true, season, metric: rawMetric, splits });
  } catch (err) {
    console.error("[splits] error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
