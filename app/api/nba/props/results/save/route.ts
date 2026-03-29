import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readNbaTopPropsDailyCache } from "@/lib/supabase/nba-top-props-cache";

const QUERY_TIMEZONE = "America/Toronto";
const GRADE_ORDER = ["S", "A", "B", "C"];
const RECOMMENDED_GRADES = new Set(["S", "A", "B"]);

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
      ? n(log.points) + n(log.rebounds) + n(log.assists) : null;
  if (metric === "P+A")
    return log.points !== null || log.assists !== null
      ? n(log.points) + n(log.assists) : null;
  if (metric === "P+R")
    return log.points !== null || log.rebounds !== null
      ? n(log.points) + n(log.rebounds) : null;
  if (metric === "R+A")
    return log.rebounds !== null || log.assists !== null
      ? n(log.rebounds) + n(log.assists) : null;
  return null;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const secretParam = req.nextUrl.searchParams.get("secret") ?? "";
    if (auth !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    // Support multiple dates: ?dates=2026-03-13,2026-03-18 or single ?date=2026-03-22
    const datesParam = searchParams.get("dates");
    const dates = datesParam
      ? datesParam.split(",").map((d) => d.trim()).filter(Boolean)
      : [searchParams.get("date") ?? getYesterdayToronto()];

    const saved: { date: string; grades: number; skipped?: boolean }[] = [];

    for (const date of dates) {
      const cached = await readNbaTopPropsDailyCache({
        dateKey: date,
        timezone: QUERY_TIMEZONE,
      });

      if (!cached?.payload?.props || !Array.isArray(cached.payload.props)) {
        saved.push({ date, grades: 0, skipped: true });
        continue;
      }

      type CachedProp = {
        playerId: number | null;
        player: string;
        metric: string;
        line: number;
        side: "over" | "under";
        odds: number | null;
        grade: string;
        score: number;
      };

      const allProps = cached.payload.props as CachedProp[];
      // Dedup: 1 prop per player (best score), same logic as display
      const seenPlayers = new Set<string>();
      const props = [...allProps]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .filter((p) => {
          const key = String(p.player ?? "").toLowerCase().trim();
          if (!key || seenPlayers.has(key)) return false;
          seenPlayers.add(key);
          return true;
        });

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
            SELECT player_id, points, rebounds, assists, three_points_made
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

      // Nombre de matchs pour cette date
      const gamesResult = await prisma.$queryRaw<{ games: bigint }[]>(
        Prisma.sql`
          SELECT count(distinct game_id) as games
          FROM nba_player_game_logs
          WHERE (date AT TIME ZONE 'America/Toronto')::date = ${date}::date
            AND (is_preseason IS NULL OR is_preseason = false)
        `,
      );
      const gamesCount = Number(gamesResult[0]?.games ?? 0);

      // Calcul résultats par grade + over/under + marché
      const gradeMap = new Map<string, { hits: number; total: number; roiSum: number; overHits: number; overTotal: number; underHits: number; underTotal: number }>();
      const metricMap = new Map<string, { hits: number; total: number }>();

      for (const prop of props) {
        if (!prop.playerId || !Number.isFinite(prop.playerId)) continue;
        if (!RECOMMENDED_GRADES.has(String(prop.grade ?? ""))) continue;
        const log = logsMap.get(prop.playerId);
        if (!log) continue;
        const actual = statFromLog(log, prop.metric);
        if (actual === null) continue;

        const isHit =
          prop.side === "over" ? actual >= prop.line : actual < prop.line;

        const g = gradeMap.get(prop.grade) ?? { hits: 0, total: 0, roiSum: 0, overHits: 0, overTotal: 0, underHits: 0, underTotal: 0 };
        g.total++;
        if (isHit) {
          g.hits++;
          g.roiSum += prop.odds && Number.isFinite(prop.odds) ? prop.odds - 1 : 0.9;
        } else {
          g.roiSum -= 1;
        }
        if (prop.side === "over") {
          g.overTotal++;
          if (isHit) g.overHits++;
        } else {
          g.underTotal++;
          if (isHit) g.underHits++;
        }
        gradeMap.set(prop.grade, g);

        // Par marché
        const m = metricMap.get(prop.metric) ?? { hits: 0, total: 0 };
        m.total++;
        if (isHit) m.hits++;
        metricMap.set(prop.metric, m);
      }

      // Upsert dans la table
      let savedGrades = 0;
      for (const grade of GRADE_ORDER) {
        const g = gradeMap.get(grade);
        if (!g || g.total === 0) continue;
        const hitRate = Math.round((g.hits / g.total) * 100);
        const roi = Math.round((g.roiSum / g.total) * 100);

        await prisma.$executeRaw`
          INSERT INTO nba_picks_results_daily (date, grade, hits, total, hit_rate, roi, over_hits, over_total, under_hits, under_total, games, updated_at)
          VALUES (${date}, ${grade}, ${g.hits}, ${g.total}, ${hitRate}, ${roi}, ${g.overHits}, ${g.overTotal}, ${g.underHits}, ${g.underTotal}, ${gamesCount}, now())
          ON CONFLICT (date, grade) DO UPDATE SET
            hits = EXCLUDED.hits,
            total = EXCLUDED.total,
            hit_rate = EXCLUDED.hit_rate,
            roi = EXCLUDED.roi,
            over_hits = EXCLUDED.over_hits,
            over_total = EXCLUDED.over_total,
            under_hits = EXCLUDED.under_hits,
            under_total = EXCLUDED.under_total,
            games = EXCLUDED.games,
            updated_at = now()
        `;
        savedGrades++;
      }

      // Upsert par marché
      for (const [metric, m] of metricMap) {
        if (m.total === 0) continue;
        const hitRate = Math.round((m.hits / m.total) * 100);
        await prisma.$executeRaw`
          INSERT INTO nba_picks_results_daily_metric (date, metric, hits, total, hit_rate, games, updated_at)
          VALUES (${date}, ${metric}, ${m.hits}, ${m.total}, ${hitRate}, ${gamesCount}, now())
          ON CONFLICT (date, metric) DO UPDATE SET
            hits = EXCLUDED.hits,
            total = EXCLUDED.total,
            hit_rate = EXCLUDED.hit_rate,
            games = EXCLUDED.games,
            updated_at = now()
        `;
      }

      saved.push({ date, grades: savedGrades });
    }

    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    console.error("[props/results/save]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
