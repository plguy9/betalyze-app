import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNbaTopPropsDailyCache } from "@/lib/supabase/nba-top-props-cache";

const QUERY_TIMEZONE = "America/Toronto";

function getYesterdayToronto(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: QUERY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = fmt.format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return [
    prev.getFullYear(),
    String(prev.getMonth() + 1).padStart(2, "0"),
    String(prev.getDate()).padStart(2, "0"),
  ].join("-");
}

type LogRow = {
  player_id: number;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_points_made: number | null;
};

function n(v: number | null): number { return Number(v ?? 0); }

function statFromLog(log: LogRow, metric: string): number | null {
  if (metric === "PTS") return log.points !== null ? n(log.points) : null;
  if (metric === "REB") return log.rebounds !== null ? n(log.rebounds) : null;
  if (metric === "AST") return log.assists !== null ? n(log.assists) : null;
  if (metric === "3PT") return log.three_points_made !== null ? n(log.three_points_made) : null;
  if (metric === "PRA")
    return log.points !== null || log.rebounds !== null || log.assists !== null
      ? n(log.points) + n(log.rebounds) + n(log.assists)
      : null;
  if (metric === "P+A")
    return log.points !== null || log.assists !== null
      ? n(log.points) + n(log.assists)
      : null;
  if (metric === "P+R")
    return log.points !== null || log.rebounds !== null
      ? n(log.points) + n(log.rebounds)
      : null;
  if (metric === "R+A")
    return log.rebounds !== null || log.assists !== null
      ? n(log.rebounds) + n(log.assists)
      : null;
  return null;
}

export type PropResult = {
  player: string;
  playerId: number | null;
  teamCode: string | null;
  opponentCode: string | null;
  metric: string;
  line: number;
  side: "over" | "under";
  odds: number | null;
  grade: string;
  score: number;
  actual: number | null;
  result: "hit" | "miss";
};

export type GradeSummary = {
  grade: string;
  hits: number;
  total: number;
  hitRate: number;
};

export type PropResultsPayload = {
  ok: boolean;
  date: string;
  results: PropResult[];
  byGrade: GradeSummary[];
  totalHits: number;
  totalProps: number;
  overallHitRate: number;
  roi: number;
  avgOddsHit: number | null;
  avgOddsMiss: number | null;
  bestOddsHit: { player: string; odds: number; metric: string; line: number; side: string } | null;
  streak: { type: "win" | "loss"; count: number } | null;
};

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
const RECOMMENDED_GRADES = new Set(["A+", "A", "A-", "B+", "B"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? getYesterdayToronto();

    const cached = await readNbaTopPropsDailyCache({
      dateKey: date,
      timezone: QUERY_TIMEZONE,
    });

    if (!cached?.payload?.props || !Array.isArray(cached.payload.props)) {
      return NextResponse.json(
        { ok: false, error: `Aucune prop cachée pour le ${date}`, date, hint: "Vérifier que /api/nba/props/top a été appelé ce jour-là" },
        { status: 404 },
      );
    }

    type CachedProp = {
      playerId: number | null;
      player: string;
      teamCode: string | null;
      opponentCode: string | null;
      metric: string;
      line: number;
      side: "over" | "under";
      odds: number | null;
      grade: string;
      score: number;
    };

    const props = cached.payload.props as CachedProp[];

    const playerIds = [
      ...new Set(
        props
          .map((p) => p.playerId)
          .filter((id): id is number => id !== null && Number.isFinite(id)),
      ),
    ];

    const logsMap = new Map<number, LogRow>();
    if (playerIds.length) {
      const logs = await prisma.$queryRaw<LogRow[]>(
        Prisma.sql`
          SELECT
            player_id,
            points,
            rebounds,
            assists,
            three_points_made
          FROM nba_player_game_logs
          WHERE player_id IN (${Prisma.join(playerIds.map((id) => Prisma.sql`${id}`))})
            AND (date AT TIME ZONE 'America/Toronto')::date = ${date}::date
            AND (is_preseason IS NULL OR is_preseason = false)
        `,
      );
      for (const log of logs) {
        logsMap.set(Number(log.player_id), log);
      }
    }

    const results: PropResult[] = [];

    for (const prop of props) {
      if (!prop.playerId || !Number.isFinite(prop.playerId)) continue;
      if (!RECOMMENDED_GRADES.has(String(prop.grade ?? ""))) continue; // sous B — exclu
      const log = logsMap.get(prop.playerId);
      if (!log) continue; // DNP — exclu

      const actual = statFromLog(log, prop.metric);
      if (actual === null) continue; // stat indisponible — exclu

      const result: "hit" | "miss" =
        prop.side === "over" ? (actual >= prop.line ? "hit" : "miss") : (actual < prop.line ? "hit" : "miss");

      results.push({
        player: prop.player,
        playerId: prop.playerId,
        teamCode: prop.teamCode ?? null,
        opponentCode: prop.opponentCode ?? null,
        metric: prop.metric,
        line: prop.line,
        side: prop.side,
        odds: prop.odds ?? null,
        grade: prop.grade,
        score: prop.score ?? 0,
        actual,
        result,
      });
    }

    // Résumé par grade
    const gradeMap = new Map<string, { hits: number; total: number }>();
    for (const r of results) {
      const g = gradeMap.get(r.grade) ?? { hits: 0, total: 0 };
      g.total++;
      if (r.result === "hit") g.hits++;
      gradeMap.set(r.grade, g);
    }

    const byGrade: GradeSummary[] = GRADE_ORDER.filter((g) => gradeMap.has(g)).map((grade) => {
      const { hits, total } = gradeMap.get(grade)!;
      return { grade, hits, total, hitRate: total > 0 ? Math.round((hits / total) * 100) : 0 };
    });

    const totalHits = results.filter((r) => r.result === "hit").length;
    const totalProps = results.length;
    const overallHitRate = totalProps > 0 ? Math.round((totalHits / totalProps) * 100) : 0;

    // ROI à mise plate (1 unité par pick)
    const roiSum = results.reduce((acc, r) => {
      if (r.odds && Number.isFinite(r.odds)) {
        return acc + (r.result === "hit" ? r.odds - 1 : -1);
      }
      return acc + (r.result === "hit" ? 0.9 : -1); // fallback sans cote
    }, 0);
    const roi = totalProps > 0 ? Math.round((roiSum / totalProps) * 100) : 0;

    // Cote moyenne hit vs miss
    const hitsWithOdds = results.filter((r) => r.result === "hit" && r.odds !== null);
    const missesWithOdds = results.filter((r) => r.result === "miss" && r.odds !== null);
    const avgOddsHit = hitsWithOdds.length
      ? Math.round((hitsWithOdds.reduce((s, r) => s + r.odds!, 0) / hitsWithOdds.length) * 100) / 100
      : null;
    const avgOddsMiss = missesWithOdds.length
      ? Math.round((missesWithOdds.reduce((s, r) => s + r.odds!, 0) / missesWithOdds.length) * 100) / 100
      : null;

    // Plus grosse cote hit
    const bestOddsHit = hitsWithOdds.reduce<PropResultsPayload["bestOddsHit"]>((best, r) => {
      if (!best || r.odds! > best.odds) {
        return { player: r.player, odds: r.odds!, metric: r.metric, line: r.line, side: r.side };
      }
      return best;
    }, null);

    // Streak actuel (ordre grade A+ → B)
    const sortedForStreak = [...results].sort((a, b) => {
      const gi = (g: string) => GRADE_ORDER.indexOf(g);
      return gi(a.grade) - gi(b.grade);
    });
    let streak: PropResultsPayload["streak"] = null;
    if (sortedForStreak.length) {
      const lastType = sortedForStreak[sortedForStreak.length - 1].result === "hit" ? "win" : "loss";
      let count = 0;
      for (let i = sortedForStreak.length - 1; i >= 0; i--) {
        const t = sortedForStreak[i].result === "hit" ? "win" : "loss";
        if (t !== lastType) break;
        count++;
      }
      streak = { type: lastType, count };
    }

    return NextResponse.json({
      ok: true,
      date,
      results: results.sort((a, b) => {
        const gi = (g: string) => GRADE_ORDER.indexOf(g);
        if (gi(a.grade) !== gi(b.grade)) return gi(a.grade) - gi(b.grade);
        return b.score - a.score;
      }),
      byGrade,
      totalHits,
      totalProps,
      overallHitRate,
      roi,
      avgOddsHit,
      avgOddsMiss,
      bestOddsHit,
      streak,
    } satisfies PropResultsPayload);
  } catch (err) {
    console.error("[props/results]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
