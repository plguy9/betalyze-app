"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlayerSplitRow } from "@/app/api/nba/players/splits/route";
import { Card, TabGroup } from "./nba-ui";

type MetricKey = "pts" | "reb" | "ast" | "3pt";
type ModeKey   = "home-away" | "win-loss";
type PosFilter = "ALL" | "G" | "F" | "C";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "3pt", label: "3PT" },
];

const PAGE_SIZE = 10;

function fmt(v: number | null) {
  if (v == null) return "—";
  return v.toFixed(1);
}


export function SplitsSection() {
  const [splits, setSplits]   = useState<PlayerSplitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [metric, setMetric]   = useState<MetricKey>("pts");
  const [mode, setMode]       = useState<ModeKey>("home-away");
  const [pos, setPos]         = useState<PosFilter>("ALL");
  const [page, setPage]       = useState(1);
  const [fetched, setFetched] = useState<MetricKey | null>(null);

  useEffect(() => {
    if (fetched === metric) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/nba/players/splits?metric=${metric}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erreur serveur");
        const data = (await res.json()) as { ok: boolean; splits?: PlayerSplitRow[] };
        if (!data.ok) throw new Error("Données indisponibles");
        setSplits(Array.isArray(data.splits) ? data.splits : []);
        setFetched(metric);
        setPage(1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [metric, fetched]);

  // Reset page on filter/mode change
  useEffect(() => { setPage(1); }, [mode, pos]);

  const sorted = useMemo(() => {
    const filtered = pos === "ALL"
      ? splits
      : splits.filter((r) => r.position?.toUpperCase().startsWith(pos));
    return [...filtered].sort((a, b) => {
      const da = Math.abs(mode === "home-away" ? (a.homeDiff ?? 0) : (a.winDiff ?? 0));
      const db = Math.abs(mode === "home-away" ? (b.homeDiff ?? 0) : (b.winDiff ?? 0));
      return db - da;
    });
  }, [splits, mode, pos]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const maxAvg = useMemo(() => {
    let m = 1;
    for (const r of paged) {
      const a = mode === "home-away" ? r.homeAvg : r.winAvg;
      const b = mode === "home-away" ? r.awayAvg : r.lossAvg;
      if (a != null && a > m) m = a;
      if (b != null && b > m) m = b;
    }
    return m;
  }, [paged, mode]);

  const labelA = mode === "home-away" ? "DOM" : "VIC";
  const labelB = mode === "home-away" ? "EXT" : "DEF";

  return (
    <Card>
      <div className="p-4 sm:p-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 h-5 w-0.5 flex-shrink-0 rounded-full"
              style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }}
            />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Splits</h2>
              <p className="mt-0.5 text-[12px] text-white/35">
                Classés par plus grand écart · saison régulière NBA
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TabGroup
              value={metric}
              onChange={(v) => { setMetric(v as MetricKey); setFetched(null); }}
              options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
            <TabGroup
              value={mode}
              onChange={(v) => setMode(v as ModeKey)}
              options={[
                { value: "home-away", label: "Dom / Ext" },
                { value: "win-loss",  label: "V / D" },
              ]}
            />
            <TabGroup
              value={pos}
              onChange={(v) => setPos(v as PosFilter)}
              options={[
                { value: "ALL", label: "Tous" },
                { value: "G",   label: "G" },
                { value: "F",   label: "F" },
                { value: "C",   label: "C" },
              ]}
            />
          </div>
        </div>

        {error && <p className="mt-4 text-[11px] text-rose-400">{error}</p>}

        {/* Table */}
        {(loading || paged.length > 0) && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                  <th className="w-8 px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Joueur</th>
                  <th className="px-3 py-2 text-left" style={{ minWidth: 160 }}>{labelA} vs {labelB}</th>
                  <th className="px-3 py-2 text-center">Écart</th>
                  <th className="px-3 py-2 text-center">MJ</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-3 py-2.5"><div className="h-2.5 w-4 animate-pulse rounded-full bg-white/[0.05]" /></td>
                        <td className="px-3 py-2.5">
                          <div className="mb-1 h-2.5 w-28 animate-pulse rounded-full bg-white/[0.07]" />
                          <div className="h-2 w-16 animate-pulse rounded-full bg-white/[0.04]" />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="mb-1.5 h-2 w-full animate-pulse rounded-full bg-white/[0.05]" />
                          <div className="h-2 w-4/5 animate-pulse rounded-full bg-white/[0.04]" />
                        </td>
                        <td className="px-3 py-2.5"><div className="mx-auto h-6 w-10 animate-pulse rounded-md bg-white/[0.05]" /></td>
                        <td className="px-3 py-2.5"><div className="mx-auto h-2.5 w-6 animate-pulse rounded-full bg-white/[0.04]" /></td>
                      </tr>
                    ))
                  : paged.map((row, idx) => {
                      const avgA   = mode === "home-away" ? row.homeAvg  : row.winAvg;
                      const avgB   = mode === "home-away" ? row.awayAvg  : row.lossAvg;
                      const diff   = mode === "home-away" ? row.homeDiff : row.winDiff;
                      const gamesA = mode === "home-away" ? row.homeGames : row.winGames;
                      const gamesB = mode === "home-away" ? row.awayGames : row.lossGames;
                      const diffPos = (diff ?? 0) > 0;
                      const barA   = avgA != null ? Math.round((avgA / maxAvg) * 100) : 0;
                      const barB   = avgB != null ? Math.round((avgB / maxAvg) * 100) : 0;
                      const rank   = (page - 1) * PAGE_SIZE + idx + 1;

                      return (
                        <tr key={row.playerId} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                          {/* Rank */}
                          <td className="px-3 py-2.5 text-[10px] font-bold text-white/20">{rank}</td>

                          {/* Player */}
                          <td className="px-3 py-2.5">
                            <Link href={`/nba/players/${row.playerId}`} className="group">
                              <p className="text-[12px] font-semibold text-white/85 transition group-hover:text-white">
                                {row.playerName}
                              </p>
                              <p className="text-[10px] text-white/30">
                                {row.teamCode}{row.position ? ` · ${row.position}` : ""}
                              </p>
                            </Link>
                          </td>

                          {/* Bars */}
                          <td className="px-3 py-2.5" style={{ minWidth: 160 }}>
                            {/* Bar A */}
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="w-5 flex-shrink-0 text-[8px] font-bold"
                                style={{ color: diffPos ? "#34d399" : "rgba(255,255,255,.30)" }}>
                                {labelA}
                              </span>
                              <div className="flex-1 overflow-hidden rounded-full" style={{ height: 4, background: "rgba(255,255,255,.06)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${barA}%`,
                                  background: diffPos ? "rgba(52,211,153,.55)" : "rgba(255,255,255,.15)",
                                }} />
                              </div>
                              <span className="w-8 flex-shrink-0 text-right text-[10px] font-bold tabular-nums"
                                style={{ color: diffPos ? "#34d399" : "rgba(255,255,255,.55)" }}>
                                {fmt(avgA)}
                              </span>
                              <span className="w-5 flex-shrink-0 text-[8px] text-white/20">{gamesA}G</span>
                            </div>
                            {/* Bar B */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 flex-shrink-0 text-[8px] font-bold"
                                style={{ color: diffPos ? "rgba(255,255,255,.30)" : "#f87171" }}>
                                {labelB}
                              </span>
                              <div className="flex-1 overflow-hidden rounded-full" style={{ height: 4, background: "rgba(255,255,255,.06)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${barB}%`,
                                  background: diffPos ? "rgba(255,255,255,.15)" : "rgba(248,113,113,.55)",
                                }} />
                              </div>
                              <span className="w-8 flex-shrink-0 text-right text-[10px] font-bold tabular-nums"
                                style={{ color: diffPos ? "rgba(255,255,255,.55)" : "#f87171" }}>
                                {fmt(avgB)}
                              </span>
                              <span className="w-5 flex-shrink-0 text-[8px] text-white/20">{gamesB}G</span>
                            </div>
                          </td>

                          {/* Diff */}
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className="inline-block rounded-md px-1.5 py-0.5 text-[13px] font-black tabular-nums leading-none"
                              style={{
                                color: diffPos ? "#34d399" : "#f87171",
                                background: diffPos ? "rgba(52,211,153,.10)" : "rgba(248,113,113,.10)",
                                border: `1px solid ${diffPos ? "rgba(52,211,153,.22)" : "rgba(248,113,113,.22)"}`,
                              }}
                            >
                              {diffPos ? "+" : ""}{fmt(diff)}
                            </span>
                            <p className="mt-0.5 text-[8px] text-white/25">{diffPos ? labelA : labelB}</p>
                          </td>

                          {/* Total games */}
                          <td className="px-3 py-2.5 text-center text-[10px] tabular-nums text-white/30">
                            {row.totalGames}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && sorted.length === 0 && !error && (
          <div
            className="mt-4 rounded-xl py-12 text-center text-[11px]"
            style={{ background: "rgba(0,0,0,.15)", color: "rgba(255,255,255,.20)" }}
          >
            Données insuffisantes — sync les game logs pour générer les splits.
          </div>
        )}

        {/* Pagination + footer */}
        {!loading && pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[10px] text-white/25 tabular-nums">
              {sorted.length} joueurs · page {page} / {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
              >‹</button>
              <span
                className="min-w-[44px] rounded-lg px-2.5 py-1 text-center text-[11px] font-semibold tabular-nums"
                style={{ background: "rgba(255,138,0,.12)", color: "#ffb14a", border: "1px solid rgba(255,138,0,.20)" }}
              >
                {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
              >›</button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,.15)" }}>
            * Classés par plus grand écart · min. 15 matchs · saison régulière
          </p>

          {/* Splits tooltip */}
          <div className="group/sp relative cursor-help">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/35 transition group-hover/sp:border-indigo-500/25 group-hover/sp:text-indigo-400/70">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500/50" />
              C'est quoi les Splits ?
            </span>
            <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-white/10 bg-[#0d0d0f] p-3.5 opacity-0 shadow-2xl transition-opacity duration-150 group-hover/sp:opacity-100">
              <p className="mb-1.5 text-[12px] font-semibold text-white/90">Splits — L'edge caché</p>
              <p className="text-[11px] leading-relaxed text-white/50">
                Les books fixent leurs lignes sur la <span className="text-white/70 font-medium">moyenne saison globale</span>. Si un joueur performe significativement mieux à domicile qu'en déplacement, cette différence est rarement reflétée dans la cote — c'est ton avantage.
              </p>
              <div className="mt-2.5 flex gap-2">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">+3 DOM</span>
                <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-semibold text-indigo-400">Prochain match à dom.</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-400">= Valeur</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
}
