import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GRADE_ORDER = ["A+", "A", "A-", "B+", "B"];

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<
      { date: string; grade: string; hits: number; total: number; hit_rate: number; roi: number }[]
    >`
      SELECT date, grade, hits, total, hit_rate, roi
      FROM nba_picks_results_daily
      ORDER BY date DESC, grade ASC
      LIMIT 200
    `;

    // Grouper par date
    const byDate = new Map<string, Record<string, { hits: number; total: number; hit_rate: number; roi: number }>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.grade] = {
        hits: Number(row.hits),
        total: Number(row.total),
        hit_rate: Number(row.hit_rate),
        roi: Number(row.roi),
      };
    }

    // Totaux globaux par grade sur toutes les dates
    const globalGrade = new Map<string, { hits: number; total: number }>();
    for (const row of rows) {
      const g = globalGrade.get(row.grade) ?? { hits: 0, total: 0 };
      g.hits += Number(row.hits);
      g.total += Number(row.total);
      globalGrade.set(row.grade, g);
    }

    const globalByGrade = GRADE_ORDER
      .filter((g) => globalGrade.has(g))
      .map((grade) => {
        const { hits, total } = globalGrade.get(grade)!;
        return { grade, hits, total, hitRate: total > 0 ? Math.round((hits / total) * 100) : 0 };
      });

    const totalHits = [...globalGrade.values()].reduce((s, g) => s + g.hits, 0);
    const totalPicks = [...globalGrade.values()].reduce((s, g) => s + g.total, 0);

    const dates = [...byDate.entries()].map(([date, grades]) => {
      const dayHits = Object.values(grades).reduce((s, g) => s + g.hits, 0);
      const dayTotal = Object.values(grades).reduce((s, g) => s + g.total, 0);
      return {
        date,
        grades,
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
    });
  } catch (err) {
    console.error("[props/results/history]", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
