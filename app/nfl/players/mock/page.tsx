 "use client";

// Betalyze – NFL Player Page (V2)
// Live preview in canvas. Maquette seulement : pas d'API branchée.

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Shield,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";

// -------------------------------------------------------------------
// MOCK DATA
// -------------------------------------------------------------------
const player = {
  id: "josh-allen",
  name: "Josh Allen",
  team: "BUF",
  teamName: "Buffalo Bills",
  pos: "QB",
  number: "17",
  country: "USA",
  status: "Actif",
  season: "Saison 2025",
  bzScore: 99,
  avatar: "JA",
};

type GameLog = {
  id: string;
  week: number;
  date: string; // YYYY-MM-DD
  opp: string;
  oppName: string;
  homeAway: "vs" | "@";
  result: "W" | "L";
  score: string;
  passYds: number;
  passTD: number;
  ints: number;
  rushYds: number;
  rushTD: number;
  completions?: number;
  attempts?: number;
  passLong?: number;
  sacks?: number;
  rushAtt?: number;
  rushLong?: number;
};

const logsAll: GameLog[] = [
  {
    id: "w18",
    week: 18,
    date: "2025-01-04",
    opp: "MIA",
    oppName: "Miami Dolphins",
    homeAway: "vs",
    result: "W",
    score: "27-20",
    passYds: 268,
    passTD: 2,
    ints: 0,
    rushYds: 34,
    rushTD: 1,
    completions: 24,
    attempts: 34,
    passLong: 41,
    rushAtt: 14,
    rushLong: 20,
    sacks: 1,
  },
  {
    id: "w17",
    week: 17,
    date: "2024-12-28",
    opp: "NE",
    oppName: "New England Patriots",
    homeAway: "@",
    result: "W",
    score: "24-13",
    passYds: 241,
    passTD: 2,
    ints: 1,
    rushYds: 41,
    rushTD: 0,
    completions: 22,
    attempts: 33,
    passLong: 37,
    rushAtt: 9,
    rushLong: 18,
    sacks: 2,
  },
  {
    id: "w16",
    week: 16,
    date: "2024-12-21",
    opp: "NYJ",
    oppName: "New York Jets",
    homeAway: "vs",
    result: "L",
    score: "17-20",
    passYds: 214,
    passTD: 1,
    ints: 1,
    rushYds: 28,
    rushTD: 1,
    completions: 19,
    attempts: 32,
    passLong: 35,
    rushAtt: 7,
    rushLong: 16,
    sacks: 3,
  },
  {
    id: "w15",
    week: 15,
    date: "2024-12-14",
    opp: "KC",
    oppName: "Kansas City Chiefs",
    homeAway: "@",
    result: "W",
    score: "30-27",
    passYds: 289,
    passTD: 3,
    ints: 0,
    rushYds: 22,
    rushTD: 0,
    completions: 26,
    attempts: 38,
    passLong: 54,
    rushAtt: 6,
    rushLong: 22,
    sacks: 1,
  },
  {
    id: "w14",
    week: 14,
    date: "2024-12-07",
    opp: "DAL",
    oppName: "Dallas Cowboys",
    homeAway: "vs",
    result: "W",
    score: "28-16",
    passYds: 255,
    passTD: 2,
    ints: 0,
    rushYds: 18,
    rushTD: 0,
    completions: 21,
    attempts: 31,
    passLong: 42,
    rushAtt: 5,
    rushLong: 18,
    sacks: 2,
  },
  {
    id: "w13",
    week: 13,
    date: "2024-11-30",
    opp: "PHI",
    oppName: "Philadelphia Eagles",
    homeAway: "@",
    result: "L",
    score: "21-24",
    passYds: 197,
    passTD: 1,
    ints: 2,
    rushYds: 44,
    rushTD: 0,
    completions: 17,
    attempts: 30,
    passLong: 33,
    rushAtt: 8,
    rushLong: 21,
    sacks: 3,
  },
  {
    id: "w12",
    week: 12,
    date: "2024-11-20",
    opp: "HOU",
    oppName: "Houston Texans",
    homeAway: "@",
    result: "W",
    score: "23-20",
    passYds: 253,
    passTD: 2,
    ints: 0,
    rushYds: 26,
    rushTD: 0,
    completions: 23,
    attempts: 35,
    passLong: 46,
    rushAtt: 6,
    rushLong: 19,
    sacks: 2,
  },
  {
    id: "w11",
    week: 11,
    date: "2024-11-16",
    opp: "TB",
    oppName: "Tampa Bay Buccaneers",
    homeAway: "vs",
    result: "W",
    score: "31-24",
    passYds: 317,
    passTD: 3,
    ints: 0,
    rushYds: 12,
    rushTD: 0,
    completions: 28,
    attempts: 40,
    passLong: 47,
    rushAtt: 4,
    rushLong: 12,
    sacks: 1,
  },
  {
    id: "w10",
    week: 10,
    date: "2024-11-09",
    opp: "MIA",
    oppName: "Miami Dolphins",
    homeAway: "@",
    result: "W",
    score: "34-28",
    passYds: 306,
    passTD: 2,
    ints: 1,
    rushYds: 19,
    rushTD: 1,
    completions: 25,
    attempts: 36,
    passLong: 39,
  },
  {
    id: "w9",
    week: 9,
    date: "2024-11-02",
    opp: "KC",
    oppName: "Kansas City Chiefs",
    homeAway: "vs",
    result: "L",
    score: "20-24",
    passYds: 273,
    passTD: 2,
    ints: 0,
    rushYds: 7,
    rushTD: 0,
    completions: 24,
    attempts: 37,
    passLong: 38,
  },
];

const seasonOverview = {
  passYds: 3668,
  passTD: 25,
  ints: 10,
  rushYds: 579,
};

const matchup = {
  week: 18,
  opp: "MIA",
  label: "Week 18 vs MIA",
  dvpRank: 26,
  dvpOutOf: 32,
  passYdsAdj: "+8%",
  importance: "🔥 Must-win",
};

const props = {
  passYds: { line: 229.5, proj: 244.1 },
  passTD: { line: 1.5, proj: 1.9 },
  rushYds: { line: 32.5, proj: 34.0 },
  ints: { line: 0.5, proj: 0.6 },
  completions: { line: 22.5, proj: 23.6 },
  attempts: { line: 33.5, proj: 34.2 },
  passLong: { line: 38.5, proj: 41.0 },
};

const statsPassing = {
  "passing attempts": 460,
  completions: 319,
  "completion pct": 69.3,
  yards: 3668,
  "yards per pass avg": 8.0,
  "yards per game": 229.3,
  "longest pass": 54,
  "passing touchdowns": 25,
  interceptions: 10,
  sacks: 40,
  "sacked yards lost": 298,
  "quarterback rating": 102.2,
};

const statsRushing = {
  "rushing attempts": 112,
  yards: 579,
  "yards per rush avg": 5.2,
  "longest rush": 40,
  "over 20 yards": 5,
  "rushing touchdowns": 14,
  "yards per game": 36.2,
  fumbles: 6,
  "fumbles lost": 2,
  "rushing first downs": 46,
};

const FILTERS = ["All", "Home", "Away"] as const;
const RANGES = ["Last 5", "Last 10", "Season"] as const;
type OverviewRange = "Season" | "Last 5" | "Last 10";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatKey(k: string) {
  return k
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function edge(line: number, proj: number) {
  return proj - line;
}

function lean(line: number, proj: number) {
  const e = edge(line, proj);
  if (Math.abs(e) < 0.75) return { label: "Lean", tone: "neutral" as const };
  return e > 0
    ? { label: "Lean Over", tone: "pos" as const }
    : { label: "Lean Under", tone: "neg" as const };
}

function pctHit(values: number[], line: number) {
  if (!values.length) return 0;
  const hit = values.filter((v) => v >= line).length;
  return Math.round((hit / values.length) * 100);
}

function dateShort(iso: string) {
  const parts = iso.split("-");
  return `${parts[1]}/${parts[2]}`;
}

// -------------------------------------------------------------------
// Visualizer config
// -------------------------------------------------------------------
type MetricKey =
  | "passYds"
  | "passTD"
  | "completions"
  | "attempts"
  | "passLong"
  | "ints"
  | "rushYds";

const metricCfg: { key: MetricKey; label: string }[] = [
  { key: "passYds", label: "PY" },
  { key: "passTD", label: "TD" },
  { key: "completions", label: "CMP" },
  { key: "attempts", label: "PA" },
  { key: "passLong", label: "P LNG" },
  { key: "ints", label: "INT" },
  { key: "rushYds", label: "RY" },
];

function metricValue(g: GameLog, k: MetricKey) {
  if (k === "passYds") return g.passYds;
  if (k === "passTD") return g.passTD;
  if (k === "ints") return g.ints;
  if (k === "rushYds") return g.rushYds;
  if (k === "completions") return g.completions ?? 0;
  if (k === "attempts") return g.attempts ?? 0;
  if (k === "passLong") return g.passLong ?? 0;
  return 0;
}

function metricLine(k: MetricKey) {
  if (k === "passYds") return props.passYds.line;
  if (k === "passTD") return props.passTD.line;
  if (k === "ints") return props.ints.line;
  if (k === "rushYds") return props.rushYds.line;
  if (k === "completions") return props.completions.line;
  if (k === "attempts") return props.attempts.line;
  if (k === "passLong") return props.passLong.line;
  return 0;
}

function metricProj(k: MetricKey) {
  if (k === "passYds") return props.passYds.proj;
  if (k === "passTD") return props.passTD.proj;
  if (k === "ints") return props.ints.proj;
  if (k === "rushYds") return props.rushYds.proj;
  if (k === "completions") return props.completions.proj;
  if (k === "attempts") return props.attempts.proj;
  if (k === "passLong") return props.passLong.proj;
  return 0;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function BetalyzeNFLPlayerPageV2() {
  const [mode, setMode] = useState<"stats" | "props">("stats");

  // Visual (like your screenshot)
  const [metric, setMetric] = useState<MetricKey>("passYds");
  const [windowKey, setWindowKey] = useState<"L5" | "L10" | "L20" | "2025">(
    "L10"
  );

  // Game logs filters (façon ESPN)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [range, setRange] = useState<(typeof RANGES)[number]>("Last 5");
  const filteredLogs = useMemo(() => {
    let base = [...logsAll];
    if (filter === "Home") base = base.filter((g) => g.homeAway === "vs");
    if (filter === "Away") base = base.filter((g) => g.homeAway === "@");
    if (range === "Last 5") base = base.slice(0, 5);
    if (range === "Last 10") base = base.slice(0, 10);
    return base;
  }, [filter, range]);

  const [showMorePass, setShowMorePass] = useState(false);
  const [showMoreRush, setShowMoreRush] = useState(false);

  const lineForMetric = useMemo(() => metricLine(metric), [metric]);
  const projForMetric = useMemo(() => metricProj(metric), [metric]);

  const windowLogs = useMemo(() => {
    const sortedByRecent = [...logsAll].sort((a, b) => b.week - a.week);
    if (windowKey === "2025") return sortedByRecent;
    const n = windowKey === "L5" ? 5 : windowKey === "L10" ? 10 : 20;
    return sortedByRecent.slice(0, n);
  }, [windowKey]);

  const values = useMemo(() => {
    return windowLogs
      .slice()
      .reverse()
      .map((g) => ({ g, v: metricValue(g, metric) }));
  }, [windowLogs, metric]);

  const vMax = useMemo(() => {
    const max = Math.max(1, ...values.map((x) => x.v));
    return Math.ceil(max * 1.15);
  }, [values]);

  // Agrégats saison (pour cartes Aperçu)
  const seasonAgg = useMemo(() => {
    const totals = logsAll.reduce(
      (acc, g) => {
        acc.cmp += g.completions ?? 0;
        acc.att += g.attempts ?? 0;
        acc.passYds += g.passYds;
        acc.passTD += g.passTD;
        acc.ints += g.ints;
        acc.rushAtt += g.rushAtt ?? Math.max(1, Math.round(g.rushYds / 4));
        acc.rushYds += g.rushYds;
        return acc;
      },
      { cmp: 0, att: 0, passYds: 0, passTD: 0, ints: 0, rushAtt: 0, rushYds: 0 },
    );
    const cmpPct = totals.att ? (totals.cmp / totals.att) * 100 : 0;
    const ypa = totals.att ? totals.passYds / totals.att : 0;
    const rushAvg = totals.rushAtt ? totals.rushYds / totals.rushAtt : 0;
    // passer rating simplifié
    const pr =
      totals.att > 0
        ? Math.round(
            Math.max(
              0,
              Math.min(
                158.3,
                ((totals.cmp / totals.att - 0.3) * 5 +
                  ((totals.passYds / totals.att - 3) * 0.25) +
                  (totals.passTD / totals.att) * 20 +
                  2.375 -
                  (totals.ints / totals.att) * 25) *
                  100 /
                  6,
              ),
            ),
          )
        : 0;
    return { ...totals, cmpPct, ypa, rushAvg, passerRating: pr };
  }, []);

  const hitPct = useMemo(() => {
    return pctHit(values.map((x) => x.v), lineForMetric);
  }, [values, lineForMetric]);

  const matchupPct = useMemo(() => {
    const vsOpp = logsAll.filter((g) => g.opp === matchup.opp).slice(0, 3);
    const base = (vsOpp.length ? vsOpp : logsAll.slice(0, 5)).map((g) =>
      metricValue(g, metric)
    );
    return pctHit(base, lineForMetric);
  }, [metric, lineForMetric]);

  // Agrégats pour l'aperçu saison (moyennes/ratios)
  const computeAgg = (logs: GameLog[]) => {
    const totals = logs.reduce(
      (acc, g) => {
        const rAtt = g.rushAtt ?? Math.max(1, Math.round(g.rushYds / 4));
        acc.cmp += g.completions ?? 0;
        acc.att += g.attempts ?? 0;
        acc.passYds += g.passYds;
        acc.passTD += g.passTD;
        acc.ints += g.ints;
        acc.rushAtt += rAtt;
        acc.rushYds += g.rushYds;
        return acc;
      },
      { cmp: 0, att: 0, passYds: 0, passTD: 0, ints: 0, rushAtt: 0, rushYds: 0 },
    );
    const cmpPct = totals.att ? (totals.cmp / totals.att) * 100 : 0;
    const ypa = totals.att ? totals.passYds / totals.att : 0;
    const rushAvg = totals.rushAtt ? totals.rushYds / totals.rushAtt : 0;
    const games = Math.max(1, logs.length);
    const passerRating =
      totals.att > 0
        ? Math.round(
            Math.max(
              0,
              Math.min(
                158.3,
                ((totals.cmp / totals.att - 0.3) * 5 +
                  ((totals.passYds / totals.att - 3) * 0.25) +
                  (totals.passTD / totals.att) * 20 +
                  2.375 -
                  (totals.ints / totals.att) * 25) *
                  100 /
                  6,
              ),
            ),
          )
        : 0;
    return {
      totals,
      cmpPct,
      ypa,
      rushAvg,
      passerRating,
      perGame: {
        passYds: totals.passYds / games,
        passTD: totals.passTD / games,
        ints: totals.ints / games,
        rushYds: totals.rushYds / games,
      },
    };
  };

  const aggSeason = useMemo(() => computeAgg(logsAll), []);
  const aggL5 = useMemo(() => computeAgg(logsAll.slice(0, 5)), []);
  const aggL10 = useMemo(() => computeAgg(logsAll.slice(0, 10)), []);
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("Season");
  const currentAgg =
    overviewRange === "Last 5" ? aggL5 : overviewRange === "Last 10" ? aggL10 : aggSeason;

  const visualMetricLabel = metricCfg.find((m) => m.key === metric)?.label;

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 lg:px-0">
        {/* TOP BAR */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/5">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour NFL</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/60">
              <span className="text-[11px] font-semibold tracking-tight text-amber-200">
                BZ
              </span>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40 hover:brightness-110">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Betalyze Player</span>
            </button>
          </div>
        </header>

        {/* HERO */}
        <section
          id="overview"
          className="mt-4 rounded-3xl border border-amber-500/30 bg-[radial-gradient(circle_at_0_0,#f59e0b33,transparent_55%),radial-gradient(circle_at_100%_0,#f9731630,transparent_55%),#050309] p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400/30 to-orange-500/30 ring-1 ring-amber-400/70">
                <span className="text-sm font-semibold text-amber-200">
                  {player.avatar}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-slate-50">
                    {player.name}
                  </h1>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200 ring-1 ring-amber-400/40">
                    #{player.number}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 ring-1 ring-emerald-500/30">
                    {player.pos}
                  </span>
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200 ring-1 ring-sky-500/30">
                    {player.team}
                  </span>
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-white/10">
                    {player.country}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 ring-1 ring-emerald-500/30">
                    {player.status}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-300">
                  {player.teamName} · {player.season}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 px-4 py-3 ring-1 ring-amber-400/60">
                <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200">
                  Betalyze score
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-2xl font-semibold text-amber-300">
                    {player.bzScore}
                  </span>
                  <span className="text-[11px] text-amber-200/80">/ 100</span>
                </div>
              </div>

              <button className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-black/35 px-4 py-3 text-xs text-amber-200 hover:bg-amber-500/10">
                <span className="font-semibold">Ouvrir équipe</span>
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </button>
            </div>
          </div>

        </section>

        {/* SEASON OVERVIEW (placement haut, avant visual trend) */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#08050d]/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Aperçu saison (QB)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Vue d’ensemble des perfs clés.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/40 p-1 text-[11px] ring-1 ring-white/10">
              {(["Season", "Last 5", "Last 10"] as OverviewRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setOverviewRange(r)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (overviewRange === r
                      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/50"
                      : "text-slate-300 hover:bg-white/10")
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                k: "Pass Yds",
                v: Math.round(currentAgg.perGame.passYds).toLocaleString(),
                ring: "ring-amber-400/40",
                txt: "text-amber-200",
                hint: "Total yards à la passe sur la saison.",
              },
              {
                k: "Pass TD",
                v: Math.max(0, currentAgg.perGame.passTD).toFixed(1),
                ring: "ring-emerald-500/25",
                txt: "text-emerald-200",
                hint: "Touchdowns à la passe.",
              },
              {
                k: "INT",
                v: Math.max(0, currentAgg.perGame.ints).toFixed(1),
                ring: "ring-rose-500/25",
                txt: "text-rose-200",
                hint: "Interceptions lancées.",
              },
              {
                k: "Rush Yds",
                v: Math.round(currentAgg.perGame.rushYds).toString(),
                ring: "ring-sky-500/25",
                txt: "text-sky-200",
                hint: "Yards gagnés au sol.",
              },
              {
                k: "CMP%",
                v: `${currentAgg.cmpPct.toFixed(1)}%`,
                ring: "ring-white/15",
                txt: "text-slate-200",
                hint: "Pourcentage de passes complétées.",
                secondary: true,
              },
              {
                k: "Yds/Att",
                v: currentAgg.ypa.toFixed(1),
                ring: "ring-white/15",
                txt: "text-slate-200",
                hint: "Yards par tentative de passe.",
                secondary: true,
              },
              {
                k: "Passer RTG",
                v: currentAgg.passerRating ? currentAgg.passerRating.toString() : "—",
                ring: "ring-white/12",
                txt: "text-slate-100",
                hint: "Passer rating NFL (0 à 158.3).",
                secondary: true,
              },
              {
                k: "Rush Avg",
                v: currentAgg.rushAvg.toFixed(1),
                ring: "ring-white/12",
                txt: "text-slate-200",
                hint: "Yards par course.",
                secondary: true,
              },
            ].map((c) => (
              <div
                key={c.k}
                className={
                  "rounded-2xl " +
                  (c.secondary
                    ? "px-2.5 py-1.5 bg-black/8 ring-1 ring-white/8"
                    : "px-3 py-2 bg-black/40 ring-1 " + c.ring)
                }
              >
                <div
                  className={`flex items-center justify-between text-[10px] ${
                    c.secondary ? "text-slate-600" : "text-slate-500"
                  }`}
                >
                  <span>{c.k}</span>
                  <span
                    title={c.hint}
                    className="inline-flex h-4 w-4 cursor-default items-center justify-center rounded-full bg-white/5 text-[9px] text-amber-100/70 ring-1 ring-white/10"
                  >
                    ?
                  </span>
                </div>
                <p
                  className={
                    "mt-1 " +
                    (c.secondary
                      ? "text-[11px] font-semibold text-slate-200"
                      : "text-sm font-semibold " + c.txt)
                  }
                >
                  {c.v}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* MATCHUP */}
        <section
          id="matchup"
          className="mt-4 rounded-3xl border border-white/10 bg-[#050309] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Matchup & contexte
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Simple, clair, utile pour décider.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] text-amber-200 ring-1 ring-amber-400/40">
              {matchup.importance}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-white/10">
              <p className="text-[10px] text-slate-500">Prochain match</p>
              <p className="text-sm font-semibold text-slate-100">
                {matchup.label}
              </p>
            </div>

            <div className="rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-emerald-500/25">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500">Defense vs QB</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200 ring-1 ring-emerald-500/30">
                  <Shield className="h-3 w-3" />
                  DvP
                </span>
              </div>
              <p className="text-sm font-semibold text-emerald-200">
                {matchup.dvpRank}e / {matchup.dvpOutOf}
              </p>
            </div>

            <div className="rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-amber-400/25">
              <p className="text-[10px] text-slate-500">Pass Yds concédés</p>
              <p className="text-sm font-semibold text-amber-200">
                {matchup.passYdsAdj}
              </p>
            </div>
          </div>
        </section>

        {/* VISUAL TREND (more visual, in Betalyze theme) */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#050309] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Visual trend (props)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Like your screenshot: quick filters + chart + hover tooltip.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-2 py-1 ring-1 ring-white/10">
                  <SlidersHorizontal className="h-4 w-4 text-amber-200" />
                  <span className="text-[11px] text-slate-200">Metric</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {metricCfg.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMetric(m.key)}
                      className={
                        "rounded-full px-3 py-1 text-[11px] ring-1 transition " +
                        (metric === m.key
                          ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                          : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10")
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-flex items-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-2">
                {(["2025", "L5", "L10", "L20"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWindowKey(w)}
                    className={
                      "rounded-full px-3 py-1 text-[11px] ring-1 transition " +
                      (windowKey === w
                        ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                        : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10")
                    }
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b070f] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-50">
                  {player.name}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    {player.pos} | {player.team}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {matchup.label} · Line {lineForMetric}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                  2025 <span className="text-slate-500">·</span> {hitPct}%
                </div>
                <div className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                  H2H <span className="text-slate-500">·</span> {matchupPct}%
                </div>
                <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 ring-1 ring-emerald-500/25">
                  O 1.90
                </div>
                <div className="rounded-full bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200 ring-1 ring-rose-500/25">
                  U 1.88
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b070f] p-3">
            <div className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>{vMax}</span>
                <span>0</span>
              </div>

              <div className="relative h-64">
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-white/30"
                  style={{ top: `${100 - (lineForMetric / vMax) * 100}%` }}
                />

                <div className="absolute inset-0 flex items-end gap-2">
                  {values.map(({ g, v }) => {
                    const pct = clamp((v / vMax) * 100, 0, 100);
                    const isHit = v >= lineForMetric;
                    const tone = isHit
                      ? "bg-emerald-500/35 ring-emerald-500/30"
                      : "bg-rose-500/35 ring-rose-500/30";
                    return (
                      <div
                        key={g.id}
                        className="flex flex-1 flex-col items-center justify-end"
                      >
                        <div
                          className={
                            "group relative w-full min-w-[22px] rounded-lg ring-1 transition hover:brightness-110 " +
                            tone
                          }
                          style={{ height: `${pct}%` }}
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100">
                            <div className="font-semibold">
                              {v}{" "}
                              <span className="text-[10px] text-slate-400">
                                {visualMetricLabel}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {g.homeAway} {g.opp} · {dateShort(g.date)}
                            </div>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 h-2 rounded-b-lg bg-white/10" />
                        </div>

                        <div className="mt-2 text-center text-[10px] text-slate-500">
                          <div className="text-slate-300">{g.opp}</div>
                          <div>{dateShort(g.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Line: <span className="text-amber-200">{lineForMetric}</span>
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Proj: <span className="text-amber-200">{projForMetric}</span>
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 ring-1 ring-emerald-500/25">
                  Hit%: {hitPct}%
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Lean: <span className="text-slate-50">{lean(lineForMetric, projForMetric).label}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* GAME LOGS (détaillé façon ESPN) */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#050309] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Game logs (détaillé)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Colonnes Passing / Rushing inspirées de l&apos;exemple ESPN (mock data).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 ${
                    filter === f
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {f}
                </button>
              ))}
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full border px-3 py-1 ${
                    range === r
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b070f]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-[11px]">
                <thead className="bg-black/30 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Week</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Opp</th>
                    <th className="px-3 py-2">Res</th>
                    <th className="px-3 py-2">CMP</th>
                    <th className="px-3 py-2">ATT</th>
                    <th className="px-3 py-2">YDS</th>
                    <th className="px-3 py-2">CMP%</th>
                    <th className="px-3 py-2">AVG</th>
                    <th className="px-3 py-2">TD</th>
                    <th className="px-3 py-2">INT</th>
                    <th className="px-3 py-2">LNG</th>
                    <th className="px-3 py-2">SACK</th>
                    <th className="px-3 py-2">RTG</th>
                    <th className="px-3 py-2">CAR</th>
                    <th className="px-3 py-2">RYDS</th>
                    <th className="px-3 py-2">AVG</th>
                    <th className="px-3 py-2">RTD</th>
                    <th className="px-3 py-2">RLNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {filteredLogs.map((g) => {
                    const cmp = g.completions ?? 0;
                    const att = g.attempts ?? 0;
                    const cmpPct = att ? ((cmp / att) * 100).toFixed(1) : "—";
                    const avg = att ? (g.passYds / att).toFixed(1) : "—";
                    const rushAtt = g.rushAtt ?? Math.max(1, Math.round(g.rushYds / 4));
                    const rushAvg = rushAtt ? (g.rushYds / rushAtt).toFixed(1) : "—";
                    const sacks = g.sacks ?? 0;
                    const passerRating = att
                      ? Math.round(
                          Math.max(
                            0,
                            Math.min(
                              158.3,
                              ((cmp / att - 0.3) * 5 +
                                ((g.passYds / att - 3) * 0.25) +
                                (g.passTD / att) * 20 +
                                2.375 -
                                (g.ints / att) * 25) *
                                100 /
                                6,
                            ),
                          ),
                        )
                      : "—";
                    return (
                      <tr key={g.id} className="hover:bg-white/5">
                        <td className="px-3 py-2 text-slate-400">{g.week}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {new Date(g.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {g.homeAway} {g.opp}
                        </td>
                        <td
                          className={
                            "px-3 py-2 font-semibold " +
                            (g.result === "W" ? "text-emerald-300" : "text-red-300")
                          }
                        >
                          {g.result} ({g.score})
                        </td>
                        <td className="px-3 py-2">{cmp || "—"}</td>
                        <td className="px-3 py-2">{att || "—"}</td>
                        <td className="px-3 py-2">{g.passYds}</td>
                        <td className="px-3 py-2">{cmpPct}</td>
                        <td className="px-3 py-2">{avg}</td>
                        <td className="px-3 py-2">{g.passTD}</td>
                        <td className="px-3 py-2">{g.ints}</td>
                        <td className="px-3 py-2">{g.passLong ?? "—"}</td>
                        <td className="px-3 py-2">{sacks}</td>
                        <td className="px-3 py-2">{passerRating}</td>
                        <td className="px-3 py-2">{rushAtt}</td>
                        <td className="px-3 py-2">{g.rushYds}</td>
                        <td className="px-3 py-2">{rushAvg}</td>
                        <td className="px-3 py-2">{g.rushTD}</td>
                        <td className="px-3 py-2">{g.rushLong ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* DETAILS */}
        <section
          id="details"
          className="mt-4 rounded-3xl border border-white/10 bg-[#08050d]/90 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                {mode === "stats" ? "Stats détaillées" : "Mode Props"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "stats"
                  ? "On met l’essentiel en premier, le reste en Voir +."
                  : "Lignes + projection + edge + lean (maquette)."}
              </p>
            </div>

            <div className="inline-flex rounded-full bg-black/50 p-1 text-[10px] ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setMode("stats")}
                className={
                  "rounded-full px-2 py-0.5 " +
                  (mode === "stats"
                    ? "bg-amber-500/20 text-amber-200"
                    : "text-slate-400")
                }
              >
                Stats
              </button>
              <button
                type="button"
                onClick={() => setMode("props")}
                className={
                  "rounded-full px-2 py-0.5 " +
                  (mode === "props"
                    ? "bg-amber-500/20 text-amber-200"
                    : "text-slate-400")
                }
              >
                Props
              </button>
            </div>
          </div>

          {mode === "props" ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { key: "Pass Yds", ...props.passYds },
                { key: "Pass TD", ...props.passTD },
                { key: "CMP", ...props.completions },
                { key: "PA", ...props.attempts },
                { key: "P LNG", ...props.passLong },
                { key: "Rush Yds", ...props.rushYds },
                { key: "INT", ...props.ints },
              ].map((p) => {
                const e = edge(p.line, p.proj);
                const l = lean(p.line, p.proj);
                const edgeTone = e >= 0 ? "text-emerald-200" : "text-rose-200";
                const badge =
                  l.tone === "pos"
                    ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                    : l.tone === "neg"
                      ? "bg-rose-500/10 text-rose-200 ring-rose-500/30"
                      : "bg-white/5 text-slate-200 ring-white/10";
                return (
                  <div
                    key={p.key}
                    className="rounded-2xl border border-white/10 bg-[#0b070f] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-100">
                          {p.key}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Line / Proj / Edge
                        </p>
                      </div>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] ring-1 " + badge
                        }
                      >
                        {l.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-black/35 px-2 py-2 ring-1 ring-white/10">
                        <p className="text-[9px] text-slate-500">Line</p>
                        <p className="text-sm font-semibold text-slate-100">
                          {p.line}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/35 px-2 py-2 ring-1 ring-white/10">
                        <p className="text-[9px] text-slate-500">Proj</p>
                        <p className="text-sm font-semibold text-amber-200">
                          {p.proj}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/35 px-2 py-2 ring-1 ring-white/10">
                        <p className="text-[9px] text-slate-500">Edge</p>
                        <p className={`text-sm font-semibold ${edgeTone}`}>
                          {e >= 0 ? "+" : ""}
                          {e.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-[#050309] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      Passing
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Essentiel d’abord.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMorePass((v) => !v)}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate-200 hover:border-amber-400/60"
                  >
                    {showMorePass ? "Voir -" : "Voir +"}
                  </button>
                </div>

                <div className="mt-3 divide-y divide-white/5 rounded-2xl bg-black/25 ring-1 ring-white/10">
                  {Object.entries(statsPassing)
                    .slice(0, showMorePass ? 999 : 6)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-[11px] text-slate-300">
                          {formatKey(k)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-100">
                          {v}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#050309] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      Rushing
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Essentiel d’abord.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMoreRush((v) => !v)}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-slate-200 hover:border-amber-400/60"
                  >
                    {showMoreRush ? "Voir -" : "Voir +"}
                  </button>
                </div>

                <div className="mt-3 divide-y divide-white/5 rounded-2xl bg-black/25 ring-1 ring-white/10">
                  {Object.entries(statsRushing)
                    .slice(0, showMoreRush ? 999 : 6)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-[11px] text-slate-300">
                          {formatKey(k)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-100">
                          {v}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="h-6" />
      </div>
    </div>
  );
}
