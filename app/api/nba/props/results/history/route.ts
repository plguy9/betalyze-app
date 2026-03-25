import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GRADE_ORDER = ["S", "A", "B"];

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      { date: string; grade: string; hits: number; total: number; hit_rate: number; roi: number; over_hits: number; over_total: number; under_hits: number; under_total: number; games: number }[]
    >`
      SELECT date, grade, hits, total, hit_rate, roi, over_hits, over_total, under_hits, under_total, games
      FROM nba_picks_results_daily
      ORDER BY date DESC, grade ASC
      LIMIT 200
    `;

    // Grouper par date
    const byDate = new Map<string, { grades: Record<string, { hits: number; total: number; hit_rate: number; roi: number; over_hits: number; over_total: number; under_hits: number; under_total: number }>; games: number }>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, { grades: {}, games: Number(row.games) });
      byDate.get(row.date)!.grades[row.grade] = {
        hits: Number(row.hits),
        total: Number(row.total),
        hit_rate: Number(row.hit_rate),
        roi: Number(row.roi),
        over_hits: Number(row.over_hits),
        over_total: Number(row.over_total),
        under_hits: Number(row.under_hits),
        under_total: Number(row.under_total),
      };
    }

    // Totaux globaux par grade + over/under global
    const globalGrade = new Map<string, { hits: number; total: number }>();
    let globalOverHits = 0, globalOverTotal = 0, globalUnderHits = 0, globalUnderTotal = 0;
    for (const row of rows) {
      const g = globalGrade.get(row.grade) ?? { hits: 0, total: 0 };
      g.hits += Number(row.hits);
      g.total += Number(row.total);
      globalGrade.set(row.grade, g);
      globalOverHits += Number(row.over_hits);
      globalOverTotal += Number(row.over_total);
      globalUnderHits += Number(row.under_hits);
      globalUnderTotal += Number(row.under_total);
    }

    const globalByGrade = GRADE_ORDER
      .filter((g) => globalGrade.has(g))
      .map((grade) => {
        const { hits, total } = globalGrade.get(grade)!;
        return { grade, hits, total, hitRate: total > 0 ? Math.round((hits / total) * 100) : 0 };
      });

    const totalHits = [...globalGrade.values()].reduce((s, g) => s + g.hits, 0);
    const totalPicks = [...globalGrade.values()].reduce((s, g) => s + g.total, 0);

    const dates = [...byDate.entries()].map(([date, { grades, games }]) => {
      const dayHits = Object.values(grades).reduce((s, g) => s + g.hits, 0);
      const dayTotal = Object.values(grades).reduce((s, g) => s + g.total, 0);
      return {
        date,
        grades,
        games,
        totalHits: dayHits,
        totalPicks: dayTotal,
        hitRate: dayTotal > 0 ? Math.round((dayHits / dayTotal) * 100) : 0,
      };
    });

    return NextResponse.json({
      ok: true,
      dates,
      globalByGrade,
      totalHits,
      totalPicks,
      overallHitRate: totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : 0,
      daysTracked: dates.length,
      overHitRate: globalOverTotal > 0 ? Math.round((globalOverHits / globalOverTotal) * 100) : 0,
      underHitRate: globalUnderTotal > 0 ? Math.round((globalUnderHits / globalUnderTotal) * 100) : 0,
      overTotal: globalOverTotal,
      underTotal: globalUnderTotal,
    });
  } catch (err) {
    console.error("[props/results/history]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
