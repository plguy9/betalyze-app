"use client";

import { useEffect, useState } from "react";
import type { PropResultsPayload, GradeSummary, PropResult } from "@/app/api/nba/props/results/route";
import { gradeTone, formatOddsForDisplay, type OddsDisplayFormat } from "./nba-helpers";

type HistoryPayload = {
  ok: boolean;
  dates: {
    date: string;
    grades: Record<string, { hits: number; total: number; hit_rate: number; roi: number; over_hits: number; over_total: number; under_hits: number; under_total: number }>;
    games: number;
    totalHits: number;
    totalPicks: number;
    hitRate: number;
  }[];
  globalByGrade: { grade: string; hits: number; total: number; hitRate: number }[];
  totalHits: number;
  totalPicks: number;
  overallHitRate: number;
  daysTracked: number;
  overHitRate: number;
  underHitRate: number;
  overTotal: number;
  underTotal: number;
};

function hitRateColor(rate: number): string {
  if (rate >= 70) return "#22c55e";
  if (rate >= 55) return "#f59e0b";
  return "#f43f5e";
}

function GradeBar({ g }: { g: GradeSummary }) {
  const color = hitRateColor(g.hitRate);
  return (
    <div className="flex items-center gap-3">
      <span className={`w-8 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-black ring-1 ${gradeTone(g.grade)}`}>
        {g.grade}
      </span>
      <div className="relative flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.06)", height: 6 }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${g.hitRate}%`, background: color }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] font-semibold" style={{ color }}>
        {g.hits}/{g.total} <span className="font-normal text-white/40">({g.hitRate}%)</span>
      </span>
    </div>
  );
}

function ResultRow({ r, oddsFormat }: { r: PropResult; oddsFormat: OddsDisplayFormat }) {
  const isHit = r.result === "hit";
  const oddsLabel = r.odds ? formatOddsForDisplay(r.odds, oddsFormat) : null;
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
      style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
        style={{
          background: isHit ? "rgba(34,197,94,.15)" : "rgba(244,63,94,.12)",
          color: isHit ? "#4ade80" : "#fb7185",
        }}
      >
        {isHit ? "✓" : "✗"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-white/90">
          {r.player}
          {r.teamCode && <span className="ml-1.5 text-[10px] font-normal text-white/35">{r.teamCode}</span>}
        </p>
        <p className="text-[10px] text-white/35">
          {r.metric} · {r.side === "over" ? "Over" : "Under"} {r.line}
          {r.opponentCode && <span> · vs {r.opponentCode}</span>}
          {" · "}<span className="text-white/55">{r.actual}</span>
        </p>
      </div>
      {oddsLabel && (
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
          style={{
            background: isHit ? "rgba(34,197,94,.10)" : "rgba(255,255,255,.05)",
            color: isHit ? "#4ade80" : "rgba(255,255,255,.35)",
            border: `1px solid ${isHit ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.08)"}`,
          }}
        >
          {oddsLabel}
        </span>
      )}
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ring-1 ${gradeTone(r.grade)}`}>
        {r.grade}
      </span>
    </div>
  );
}

const GRADES = ["A+", "A", "A-", "B+", "B"];

function HistoryView() {
  const [hist, setHist] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nba/props/results/history")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setHist(json); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
      ))}
    </div>
  );

  if (!hist || hist.daysTracked === 0) return (
    <div className="rounded-xl border border-white/8 p-5 text-center">
      <p className="text-[13px] text-white/40">Aucun historique disponible</p>
      <p className="mt-1 text-[11px] text-white/20">Les données s'accumulent automatiquement chaque jour.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Global par grade */}
      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
          Global · {hist.daysTracked} soirs · {hist.totalPicks} picks
        </p>
        <div className="space-y-2.5">
          {hist.globalByGrade.map((g) => (
            <GradeBar key={g.grade} g={g} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center rounded-xl py-2.5" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[9px] uppercase tracking-wider text-white/30">Global</p>
            <p className="mt-0.5 text-[16px] font-black" style={{ color: hitRateColor(hist.overallHitRate) }}>{hist.overallHitRate}%</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl py-2.5" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[9px] uppercase tracking-wider text-white/30">Over</p>
            <p className="mt-0.5 text-[16px] font-black" style={{ color: hitRateColor(hist.overHitRate) }}>{hist.overHitRate}%</p>
            <p className="text-[9px] text-white/20">{hist.overTotal} picks</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl py-2.5" style={{ background: "rgba(255,255,255,.04)" }}>
            <p className="text-[9px] uppercase tracking-wider text-white/30">Under</p>
            <p className="mt-0.5 text-[16px] font-black" style={{ color: hitRateColor(hist.underHitRate) }}>{hist.underHitRate}%</p>
            <p className="text-[9px] text-white/20">{hist.underTotal} picks</p>
          </div>
        </div>
      </div>

      {/* Tableau par date */}
      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Par date</p>
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,.07)" }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)" }}>
                <th className="px-3 py-2 text-left font-medium text-white/30">Date</th>
                <th className="px-2 py-2 text-center font-medium text-white/30">Mtch</th>
                <th className="px-2 py-2 text-center font-medium text-white/30">Props</th>
                {GRADES.map((g) => (
                  <th key={g} className="px-2 py-2 text-center font-medium text-white/30">{g}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-white/30">%</th>
              </tr>
            </thead>
            <tbody>
              {hist.dates.map((row, i) => (
                <tr
                  key={row.date}
                  style={{ borderBottom: i < hist.dates.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none" }}
                >
                  <td className="px-3 py-2 text-white/50">{row.date.slice(5)}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-white/30">{row.games || "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-white/30">{row.totalPicks}</td>
                  {GRADES.map((g) => {
                    const gd = row.grades[g];
                    return (
                      <td key={g} className="px-2 py-2 text-center tabular-nums">
                        {gd ? (
                          <span style={{ color: hitRateColor(gd.hit_rate) }}>
                            {gd.hits}/{gd.total}
                          </span>
                        ) : (
                          <span className="text-white/15">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: hitRateColor(row.hitRate) }}>
                    {row.hitRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ResultsDrawer({ oddsFormat }: { oddsFormat: OddsDisplayFormat }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"today" | "history">("today");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PropResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charge le résumé au mount pour afficher le preview sur le bouton
  useEffect(() => {
    fetch("/api/nba/props/results")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json as PropResultsPayload);
        else setError(json.error ?? "Aucun résultat");
      })
      .catch(() => setError("Indisponible"))
      .finally(() => setLoading(false));
  }, []);

  const rateColor = data ? hitRateColor(data.overallHitRate) : "rgba(255,255,255,.25)";

  return (
    <>
      {/* ── Bouton preview ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] text-white/60 transition hover:border-white/20 hover:text-white/90"
      >
        <span className="text-white/50">↗</span>
        <span className="font-medium">BZ Picks · Perf.</span>
        {!loading && data && (
          <>
            <span className="h-3.5 w-px bg-white/10" />
            <span className="font-bold" style={{ color: rateColor }}>
              {data.overallHitRate}%
            </span>
          </>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden shadow-2xl transition-transform duration-300"
        style={{
          background: "#0d0d0f",
          border: "1px solid rgba(255,255,255,.08)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div className="border-b border-white/8 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 h-5 w-0.5 shrink-0 rounded-full"
                style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }}
              />
              <div>
                <h2 className="text-[15px] font-bold text-white">BZ Picks · Performance</h2>
                {view === "today" && data && (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {data.date} · {data.totalProps} picks grade B et +
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition hover:text-white"
            >
              ✕
            </button>
          </div>
          {/* Toggle hier / long terme */}
          <div className="mt-3 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,.04)" }}>
            {(["today", "history"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition"
                style={{
                  background: view === v ? "rgba(245,158,11,.15)" : "transparent",
                  color: view === v ? "#f59e0b" : "rgba(255,255,255,.35)",
                }}
              >
                {v === "today" ? "Performance hier" : "Long terme"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {view === "history" && <HistoryView />}
          {view === "today" && loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,.04)" }} />
              ))}
            </div>
          )}

          {view === "today" && error && !loading && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-4 text-center">
              <p className="text-[12px] text-rose-400">{error}</p>
              <p className="mt-1 text-[10px] text-white/30">Les logs doivent être synchronisés d'abord.</p>
            </div>
          )}

          {view === "today" && data && !loading && (
            <div className="space-y-5">
              {/* Overall */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-white/40">Taux global</p>
                    <p className="mt-0.5 text-[32px] font-black leading-none" style={{ color: rateColor }}>
                      {data.overallHitRate}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/40">Props gagnantes</p>
                    <p className="mt-0.5 text-[24px] font-bold text-white">
                      {data.totalHits}
                      <span className="text-[15px] text-white/30">/{data.totalProps}</span>
                    </p>
                  </div>
                </div>

                {/* Stats avancées */}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/6 pt-3">
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">ROI</p>
                    <p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: data.roi >= 0 ? "#4ade80" : "#fb7185" }}>
                      {data.roi >= 0 ? "+" : ""}{data.roi}%
                    </p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">Cote moy. hit</p>
                    <p className="mt-0.5 text-[15px] font-bold tabular-nums text-emerald-400">
                      {data.avgOddsHit ? data.avgOddsHit.toFixed(2) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-[9px] uppercase tracking-wider text-white/30">Streak</p>
                    <p className="mt-0.5 text-[15px] font-bold tabular-nums" style={{ color: data.streak?.type === "win" ? "#4ade80" : "#fb7185" }}>
                      {data.streak ? `${data.streak.type === "win" ? "🔥" : "❄️"} ${data.streak.count}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Meilleure cote hit */}
                {data.bestOddsHit && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)" }}>
                    <span className="text-[11px]">🏆</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-white/60">
                        {data.bestOddsHit.player} · {data.bestOddsHit.metric} {data.bestOddsHit.side === "over" ? "Over" : "Under"} {data.bestOddsHit.line}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-black text-emerald-400">
                      {formatOddsForDisplay(data.bestOddsHit.odds, oddsFormat)}
                    </span>
                  </div>
                )}
              </div>

              {/* By grade */}
              {data.byGrade.length > 0 && (
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Par grade</p>
                  <div className="space-y-2.5">
                    {data.byGrade.map((g) => <GradeBar key={g.grade} g={g} />)}
                  </div>
                </div>
              )}

              {/* Individual results */}
              {data.results.length > 0 && (
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
                    Détail · {data.results.length} picks
                  </p>
                  <div className="space-y-1.5">
                    {data.results.map((r, i) => (
                      <ResultRow key={`${r.playerId}-${r.metric}-${r.side}-${i}`} r={r} oddsFormat={oddsFormat} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
