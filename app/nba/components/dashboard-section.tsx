"use client";
import { useState } from "react";
import { Card } from "./nba-ui";
import { formatDecimal, formatEdge, formatTodayLabel, formatOddsForDisplay, gradeTone, gradeSortRank, type OddsDisplayFormat } from "./nba-helpers";
import type { NbaJournalEntry, NbaTopProp } from "./nba-shared-types";
import { ResultsDrawer } from "./results-drawer";

type Props = {
  gamesCount: number;
  playableGamesCount: number;
  topProps: NbaTopProp[];
  topPropsLoading: boolean;
  topPropsError: string | null;
  topPropsGeneratedAt: string | null;
  journalEntries: NbaJournalEntry[];
  journalLoading: boolean;
  journalError: string | null;
  journalAuthRequired: boolean;
  onOpenPlayers: () => void;
  onOpenPlayer?: (playerId: number) => void;
  oddsFormat: OddsDisplayFormat;
};

function SkeletonLine({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} animate-pulse rounded-full bg-white/[0.07]`} />;
}

function FreshnessIndicator({ generatedAt }: { generatedAt: string | null }) {
  if (!generatedAt) return null;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const isStale = ageMs > 60 * 60 * 1000;
  const isOld = ageMs > 30 * 60 * 1000;
  const color = isStale ? "text-rose-400" : isOld ? "text-amber-400" : "text-emerald-400";
  const dot = isStale ? "bg-rose-500" : isOld ? "bg-amber-500" : "bg-emerald-500";
  const label = ageMin < 1 ? "À l'instant" : ageMin < 60 ? `il y a ${ageMin} min` : `il y a ${Math.floor(ageMin / 60)}h`;
  return (
    <span className={`flex items-center gap-1 text-[10px] ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function torontoDayKey(input: string | null | undefined) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseMetricFromProp(prop: string | null | undefined): string {
  const raw = String(prop ?? "").trim().toUpperCase();
  if (!raw) return "OTHER";
  const token = raw.split(/\s+/)[0] ?? "";
  if (token.includes("PRA")) return "PRA";
  if (token.includes("PTS") || token.includes("POINT")) return "PTS";
  if (token.includes("REB")) return "REB";
  if (token.includes("AST")) return "AST";
  if (token.includes("3")) return "3PT";
  if (token.includes("PR")) return "P+R";
  if (token.includes("PA")) return "P+A";
  if (token.includes("RA")) return "R+A";
  return token || "OTHER";
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function DashboardSection({
  gamesCount,
  playableGamesCount,
  topProps,
  topPropsLoading,
  topPropsError,
  topPropsGeneratedAt,
  journalEntries,
  journalLoading,
  journalError,
  journalAuthRequired,
  onOpenPlayers,
  onOpenPlayer,
  oddsFormat,
}: Props) {
  const [metricFilter, setMetricFilter] = useState<string | null>(null);

  // ── Seuil "bonne bet" : B et au-dessus ──
  const RECOMMENDED_GRADES = new Set(["S", "A", "B"]);
  const recommendedProps = topProps.filter((p) => RECOMMENDED_GRADES.has(String(p.grade ?? "")));

  // ── Computed data ──
  const avgEdgeVal = avg(recommendedProps.map((p) => Number(p.edge)).filter((n) => Number.isFinite(n)));
  const overCount = recommendedProps.filter((p) => p.side === "over").length;
  const underCount = recommendedProps.filter((p) => p.side === "under").length;

  const allMetrics = Array.from(new Set(topProps.map((p) => String(p.metric ?? "").trim().toUpperCase()).filter(Boolean))).sort();
  const filteredProps = metricFilter ? topProps.filter((p) => String(p.metric ?? "").trim().toUpperCase() === metricFilter) : topProps;
  const topEdges = [...filteredProps].sort((a, b) => Number(b.edge) - Number(a.edge)).slice(0, 5);

  // Grade distribution
  const gradeGroups = topProps.reduce<Record<string, number>>((acc, p) => {
    const g = String(p.grade ?? "").charAt(0).toUpperCase() || "?";
    acc[g] = (acc[g] ?? 0) + 1;
    return acc;
  }, {});
  const gradeOrder = ["S", "A", "B", "C", "F"];
  const gradeDist = gradeOrder
    .filter((g) => (gradeGroups[g] ?? 0) > 0)
    .map((g) => ({ grade: g, count: gradeGroups[g] ?? 0 }));

  // Journal data
  const closedEntries = journalEntries.filter((entry) => entry.result === "W" || entry.result === "L");

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = torontoDayKey(yesterday.toISOString());
  const yesterdaySettled = closedEntries.filter(
    (entry) => torontoDayKey(entry.eventDate ?? entry.createdAt) === yesterdayKey,
  );
  const yesterdayWins = yesterdaySettled.filter((entry) => entry.result === "W").length;
  const yesterdayLosses = yesterdaySettled.filter((entry) => entry.result === "L").length;
  const yesterdayWinRate =
    yesterdayWins + yesterdayLosses > 0 ? (yesterdayWins / (yesterdayWins + yesterdayLosses)) * 100 : 0;


  return (
    <div className="space-y-4">

      {/* ── Page title + actions (style Donezo) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-white/40">{formatTodayLabel(today)} · NBA</p>
        </div>
        <div className="flex items-center gap-2">
          <ResultsDrawer oddsFormat={oddsFormat} />
          <button
            type="button"
            onClick={onOpenPlayers}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-black transition hover:brightness-105"
            style={{ background: "linear-gradient(135deg,#ff8a00,#ffb14a)", boxShadow: "0 4px 16px rgba(255,138,0,.30)" }}
          >
            <span>⚡</span> Best Props
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {/* Card 1 — Matchs (accent) */}
        <div
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background: "radial-gradient(160% 120% at 110% -10%, rgba(255,138,0,.40) 0%, rgba(255,138,0,.08) 60%, transparent 100%), rgba(255,138,0,.06)",
            border: "1px solid rgba(255,138,0,.28)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/70">Matchs ce soir</p>
          {topPropsLoading ? (
            <SkeletonLine w="w-12" h="h-8 mt-2" />
          ) : (
            <p className="mt-1 text-4xl font-black text-white">{gamesCount}</p>
          )}
          <p className="mt-1 text-[11px] text-amber-300/60">
            {topPropsLoading ? "…" : `${playableGamesCount} en cours`}
          </p>
        </div>

        {/* Card 2 — Picks B+ */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Picks B+ ce soir</p>
          {topPropsLoading ? (
            <SkeletonLine w="w-12" h="h-8 mt-2" />
          ) : (
            <p className="mt-1 text-4xl font-black text-white">{recommendedProps.length}</p>
          )}
          <p className="mt-1 text-[11px] text-white/35">
            {topPropsLoading ? "…" : `O${overCount} · U${underCount}`}
          </p>
        </div>

        {/* Card 3 — Edge moyen */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Edge moyen</p>
          {topPropsLoading ? (
            <SkeletonLine w="w-16" h="h-8 mt-2" />
          ) : (
            <p className="mt-1 text-4xl font-black" style={{ color: avgEdgeVal > 0 ? "#6ee7b7" : "#f87171" }}>
              {formatEdge(avgEdgeVal)}
            </p>
          )}
          <div className="mt-1">
            <FreshnessIndicator generatedAt={topPropsGeneratedAt} />
          </div>
        </div>

        {/* Card 4 — Win Rate hier */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Win Rate hier</p>
          {journalLoading ? (
            <SkeletonLine w="w-14" h="h-8 mt-2" />
          ) : journalAuthRequired ? (
            <p className="mt-1 text-2xl font-black text-white/20">—</p>
          ) : (
            <p
              className="mt-1 text-4xl font-black"
              style={{
                color: yesterdayWinRate >= 55 ? "#6ee7b7" : yesterdayWinRate >= 45 ? "#fbbf24" : "#f87171",
              }}
            >
              {(yesterdayWins + yesterdayLosses) > 0 ? `${yesterdayWinRate.toFixed(0)}%` : "—"}
            </p>
          )}
          <p className="mt-1 text-[11px] text-white/35">
            {journalAuthRequired ? "Connecte-toi" : journalLoading ? "…" : `${yesterdayWins}W · ${yesterdayLosses}L`}
          </p>
        </div>
      </div>

    <Card>
      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">

        {/* ── Errors ── */}
        {(topPropsError || (journalError && !journalAuthRequired)) && (
          <div className="space-y-1">
            {topPropsError && <p className="text-[11px] text-rose-400">Props : {topPropsError}</p>}
            {journalError && !journalAuthRequired && <p className="text-[11px] text-rose-400">Journal : {journalError}</p>}
          </div>
        )}

        {/* ── 2. Top 3 Picks ── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-5 w-0.5 rounded-full" style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }} />
            <p className="text-[13px] font-bold text-white/80">Top 3 Picks du soir</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {topPropsLoading ? (
              [1,2,3].map((i) => (
                <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-md bg-white/10" />
                    <div className="h-3 w-24 rounded-full bg-white/10" />
                  </div>
                  <div className="h-2.5 w-16 rounded-full bg-white/8 mb-2" />
                  <div className="h-1.5 w-full rounded-full bg-white/8" />
                </div>
              ))
            ) : [...topProps]
                .sort((a, b) => {
                  const ga = gradeSortRank(b.grade) - gradeSortRank(a.grade);
                  if (ga !== 0) return ga;
                  return Number(b.finalScore ?? b.score ?? 0) - Number(a.finalScore ?? a.score ?? 0);
                })
                .slice(0, 3)
                .map((pick, idx) => {
                  const canClick = onOpenPlayer && pick.playerId;
                  const isTop = idx === 0;
                  const hitRate = Number(pick.hitRate ?? 0);
                  const bzScore = Number(pick.finalScore ?? pick.score ?? 0);
                  return (
                    <div
                      key={`top3-${pick.id}`}
                      onClick={() => canClick && onOpenPlayer!(pick.playerId!)}
                      className={`relative overflow-hidden rounded-2xl p-4 transition ${canClick ? "cursor-pointer hover:brightness-110" : ""}`}
                      style={isTop ? {
                        background: "radial-gradient(140% 120% at 110% -10%, rgba(255,138,0,.30) 0%, rgba(255,138,0,.06) 60%, transparent 100%), rgba(255,138,0,.05)",
                        border: "1px solid rgba(255,138,0,.25)",
                      } : {
                        background: "rgba(255,255,255,.03)",
                        border: "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      {/* Top badge */}
                      {isTop && (
                        <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-wider text-amber-400/60">#1</span>
                      )}

                      {/* Header: grade + player */}
                      <div className="flex items-start gap-2 mb-3">
                        <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black ring-1 ${gradeTone(pick.grade)}`}>
                          {pick.grade}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-bold text-white/90 leading-tight">{pick.player}</p>
                          <p className="text-[10px] text-white/35 mt-0.5">
                            {pick.teamCode ?? "—"}
                            {pick.opponentCode && <span className="text-white/20"> vs {pick.opponentCode}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Métrique + cote */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-[11px] font-semibold text-white/70">
                            {pick.metric} · {pick.side === "over"
                              ? <span className="text-emerald-400">Over</span>
                              : <span className="text-sky-400">Under</span>
                            }
                            {" "}{formatDecimal(pick.line, 1)}
                          </span>
                        </div>
                        {pick.odds && (
                          <span className="text-[11px] font-bold text-white/50 tabular-nums">
                            {formatOddsForDisplay(pick.odds, oddsFormat)}
                          </span>
                        )}
                      </div>

                      {/* BZ Score bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/25 uppercase tracking-wider">BZ Score</span>
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: isTop ? "#ffb14a" : "rgba(255,255,255,.5)" }}>{bzScore}</span>
                        </div>
                        <div className="h-1 rounded-full w-full" style={{ background: "rgba(255,255,255,.07)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, bzScore)}%`,
                              background: isTop ? "linear-gradient(to right, #ff8a00, #ffb14a)" : "rgba(255,255,255,.25)",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-white/20">Hit rate</span>
                          <span className="text-[9px] font-semibold" style={{ color: hitRate >= 65 ? "#4ade80" : hitRate >= 50 ? "#fbbf24" : "#fb7185" }}>
                            {hitRate > 0 ? `${hitRate.toFixed(0)}%` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* ── 3. Grade distribution ── */}
        {!topPropsLoading && gradeDist.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Grades</span>
            {gradeDist.map((g) => (
              <span
                key={g.grade}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${gradeTone(g.grade)}`}
              >
                {g.grade} <span className="font-normal opacity-60">{g.count}</span>
              </span>
            ))}
          </div>
        )}

        {/* ── 4. Value Board ── */}
        <div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Value Board</p>
              {metricFilter && (
                <button
                  type="button"
                  onClick={() => setMetricFilter(null)}
                  className="text-[10px] text-white/35 hover:text-white/70"
                >
                  ✕ {metricFilter}
                </button>
              )}
            </div>
            {/* Metric filter chips */}
            {!topPropsLoading && allMetrics.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {allMetrics.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetricFilter(metricFilter === m ? null : m)}
                    className={`rounded-full px-2 py-0.5 text-[10px] transition ${metricFilter === m ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40" : "border border-white/8 bg-white/[0.04] text-white/45 hover:border-white/15 hover:text-white/70"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 space-y-2">
              {topPropsLoading ? (
                [1,2,3,4,5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <SkeletonLine w="w-3" h="h-3" />
                    <div className="flex-1 space-y-1">
                      <SkeletonLine w="w-3/4" h="h-2.5" />
                      <SkeletonLine w="w-1/2" h="h-2" />
                    </div>
                    <SkeletonLine w="w-10" h="h-3" />
                  </div>
                ))
              ) : topEdges.length === 0 ? (
                <p className="text-[11px] text-white/35">{metricFilter ? `Aucun pick pour ${metricFilter}.` : "Aucune value disponible."}</p>
              ) : (
                topEdges.map((pick, i) => {
                  const canClick = onOpenPlayer && pick.playerId;
                  return (
                    <div
                      key={pick.id}
                      onClick={() => canClick && onOpenPlayer!(pick.playerId!)}
                      className={`flex items-center gap-2 rounded-xl px-1.5 py-1 transition ${canClick ? "cursor-pointer hover:bg-white/[0.04]" : ""}`}
                    >
                      <span className="w-4 shrink-0 text-center text-[10px] font-bold text-white/20">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] text-white/85">{pick.player}</p>
                        <p className="text-[10px] text-white/40">
                          {pick.metric} · {pick.side === "over" ? <span className="text-emerald-400/80">Over</span> : <span className="text-sky-400/80">Under</span>} {formatDecimal(pick.line, 1)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ${gradeTone(pick.grade)}`}>{pick.grade}</span>
                        <span className="text-[11px] font-bold text-emerald-300">{formatEdge(pick.edge)}</span>
                        {canClick && <span className="text-[10px] text-white/25">↗</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>


      </div>
    </Card>
    </div>
  );
}
