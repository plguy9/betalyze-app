import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const METRIC_ORDER = ["PTS", "REB", "AST", "3PT", "PRA"];

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      { date: string; metric: string; hits: number; total: number; hit_rate: number; games: number }[]
    >`
      SELECT date, metric, hits, total, hit_rate, games
      FROM nba_picks_results_daily_metric
      WHERE metric IN ('PTS', 'REB', 'AST', '3PT', 'PRA')
      ORDER BY date DESC, metric ASC
      LIMIT 500
    `;

    // Globaux par marché
    const globalByMetric = new Map<string, { hits: number; total: number }>();
    for (const row of rows) {
      const m = globalByMetric.get(row.metric) ?? { hits: 0, total: 0 };
      m.hits += Number(row.hits);
      m.total += Number(row.total);
      globalByMetric.set(row.metric, m);
    }

    // Grouper par date
    const byDate = new Map<string, { metrics: Record<string, { hits: number; total: number; hit_rate: number }>; games: number }>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, { metrics: {}, games: Number(row.games) });
      byDate.get(row.date)!.metrics[row.metric] = {
        hits: Number(row.hits),
        total: Number(row.total),
        hit_rate: Number(row.hit_rate),
      };
    }

    return NextResponse.json({
      ok: true,
      globalByMetric: METRIC_ORDER
        .filter((m) => globalByMetric.has(m))
        .map((metric) => {
          const { hits, total } = globalByMetric.get(metric)!;
          return { metric, hits, total, hitRate: total > 0 ? Math.round((hits / total) * 100) : 0 };
        }),
      dates: [...byDate.entries()].map(([date, { metrics, games }]) => ({ date, games, metrics })),
    });
  } catch (err) {
    console.error("[props/results/history/metrics]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
