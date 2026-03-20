"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Shield, SlidersHorizontal, Sparkles } from "lucide-react";

type OverviewRange = "Season" | "Last 5" | "Last 10";
type DvpWindow = "season" | "L10" | "L5";
type DvpPosition = "QB" | "RB" | "WR" | "TE";
type DvpContext = "all" | "home" | "away";
type DvpStatTotals = {
  passYds: number;
  passTD: number;
  ints: number;
  completions: number;
  attempts: number;
  rushYds: number;
  rushTD: number;
  rushAtt: number;
  rec: number;
  recYds: number;
  recTD: number;
  targets: number;
};
type DvpRow = {
  season: string;
  window: DvpWindow;
  context: DvpContext;
  teamId: number;
  position: DvpPosition;
  games: number;
  ffpPerGame: number;
  metrics: { perGame: DvpStatTotals };
  rank?: number | null;
};
type PlayerStatsResponse =
  | {
      ok: true;
      season: string;
      player: {
        id: number | null;
        name: string | null;
        image: string | null;
        position?: string | null;
        number?: string | number | null;
        team?: { id?: number; name?: string; logo?: string };
      };
      stats: Record<string, Record<string, any>>;
      rawGroups?: any[];
    }
  | {
      ok: false;
      season: string;
      player: { id: number | null };
      stats: Record<string, never>;
    };

const DEFAULT_SEASON = process.env.NEXT_PUBLIC_APISPORTS_NFL_SEASON ?? "2025";
const DEFAULT_COUNTRY = "USA";

function toNumber(val: any): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function pickStat(
  stats: Record<string, Record<string, any>>,
  group: string,
  keys: string[],
): number | string | null {
  const g = stats[group];
  if (!g) return null;
  for (const k of keys) {
    const found = Object.entries(g).find(
      ([label]) => label.toLowerCase() === k.toLowerCase(),
    );
    if (found) {
      const val = found[1];
      const num = toNumber(val);
      return num !== null ? num : val ?? null;
    }
  }
  return null;
}

function formatNumber(val: any): string {
  const num = toNumber(val);
  if (num === null) return "—";
  return Math.abs(num) >= 1000 && Number.isInteger(num) ? num.toLocaleString() : String(num);
}

function computeBzScore(stats: Record<string, Record<string, any>>): number {
  const passYds = toNumber(pickStat(stats, "Passing", ["yards", "passing yards"])) ?? 0;
  const passTd = toNumber(pickStat(stats, "Passing", ["passing touchdowns"])) ?? 0;
  const ints = toNumber(pickStat(stats, "Passing", ["interceptions"])) ?? 0;
  const rushYds = toNumber(pickStat(stats, "Rushing", ["yards", "rushing yards"])) ?? 0;
  const rushTd = toNumber(pickStat(stats, "Rushing", ["rushing touchdowns"])) ?? 0;
  const base = 60;
  const score =
    base +
    passTd * 1.2 +
    rushTd * 1.3 +
    (passYds / 1000) * 2 +
    (rushYds / 500) * 1 -
    ints * 0.8;
  return Math.max(40, Math.min(99, Math.round(score)));
}

function buildSeasonAgg(stats: Record<string, Record<string, any>>) {
  const passYds = toNumber(pickStat(stats, "Passing", ["yards", "passing yards"])) ?? 0;
  const passTD = toNumber(pickStat(stats, "Passing", ["passing touchdowns", "touchdowns"])) ?? 0;
  const ints = toNumber(pickStat(stats, "Passing", ["interceptions"])) ?? 0;
  const rushYds = toNumber(pickStat(stats, "Rushing", ["yards", "rushing yards"])) ?? 0;
  const rushTD = toNumber(pickStat(stats, "Rushing", ["rushing touchdowns", "touchdowns"])) ?? 0;
  const cmp = toNumber(pickStat(stats, "Passing", ["completions"])) ?? 0;
  const att = toNumber(pickStat(stats, "Passing", ["passing attempts", "attempts"])) ?? 0;
  const passLong = toNumber(pickStat(stats, "Passing", ["longest pass", "longest"])) ?? null;
  const sacks = toNumber(pickStat(stats, "Passing", ["sacks"])) ?? null;
  const rushAtt =
    toNumber(
      pickStat(stats, "Rushing", ["rushing attempts", "rush attempts", "attempts"]),
    ) ?? 0;
  const rushAvg =
    toNumber(
      pickStat(stats, "Rushing", ["yards per rush avg", "rushing average", "average"]),
    ) ?? (rushAtt ? rushYds / rushAtt : null);
  const rec =
    toNumber(pickStat(stats, "Receiving", ["receptions", "total receptions"])) ?? null;
  const targets =
    toNumber(pickStat(stats, "Receiving", ["receiving targets", "targets"])) ?? null;
  const recYds =
    toNumber(pickStat(stats, "Receiving", ["receiving yards", "yards"])) ?? null;
  const recAvg =
    toNumber(
      pickStat(stats, "Receiving", ["yards per reception avg", "receiving average", "average"]),
    ) ?? (rec && recYds ? recYds / rec : null);
  const recTD =
    toNumber(
      pickStat(stats, "Receiving", [
        "receiving touchdowns",
        "receiving touch downs",
        "receiving td",
        "touchdowns",
      ]),
    ) ?? null;
  const recLng =
    toNumber(pickStat(stats, "Receiving", ["longest reception", "longest"])) ?? null;
  const yac =
    toNumber(pickStat(stats, "Receiving", ["yards after catch", "yac"])) ?? null;
  const fumbles =
    toNumber(pickStat(stats, "Rushing", ["fumbles"])) ??
    toNumber(pickStat(stats, "Receiving", ["fumbles"])) ??
    null;
  const fumblesLost =
    toNumber(pickStat(stats, "Rushing", ["fumbles lost"])) ??
    toNumber(pickStat(stats, "Receiving", ["fumbles lost"])) ??
    null;

  const cmpPct = att ? (cmp / att) * 100 : null;
  const ypa = att ? passYds / att : null;
  const passerRating =
    att > 0
      ? Math.round(
          Math.max(
            0,
            Math.min(
              158.3,
              ((cmp / att - 0.3) * 5 +
                ((passYds / att - 3) * 0.25) +
                (passTD / att) * 20 +
                2.375 -
                (ints / att) * 25) *
                100 /
                6,
            ),
          ),
        )
      : null;

  return {
    passYds,
    passTD,
    ints,
    rushYds,
    rushTD,
    cmp,
    att,
    cmpPct,
    ypa,
    rushAvg,
    passerRating,
    passLong,
    sacks,
    rushAtt,
    rec,
    targets,
    recYds,
    recAvg,
    recTD,
    recLng,
    yac,
    fumbles,
    fumblesLost,
  };
}

function buildSeasonAvgFromStats(
  stats: Record<string, Record<string, any>>,
  totals: ReturnType<typeof buildSeasonAgg>,
) {
  const passYdsPerGame =
    toNumber(pickStat(stats, "Passing", ["yards per game", "passing yards per game"])) ??
    null;
  const rushYdsPerGame =
    toNumber(pickStat(stats, "Rushing", ["yards per game", "rushing yards per game"])) ??
    null;
  const recYdsPerGame =
    toNumber(
      pickStat(stats, "Receiving", ["yards per game", "receiving yards per game"]),
    ) ?? null;

  const estimates = [
    passYdsPerGame && totals.passYds ? totals.passYds / passYdsPerGame : null,
    rushYdsPerGame && totals.rushYds ? totals.rushYds / rushYdsPerGame : null,
    recYdsPerGame && totals.recYds ? totals.recYds / recYdsPerGame : null,
  ].filter((v): v is number => Number.isFinite(v ?? NaN) && v > 0);

  if (!estimates.length) return null;
  const sorted = [...estimates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const games =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  if (!Number.isFinite(games) || games <= 0) return null;

  const per = (val: number | null | undefined) =>
    Number.isFinite(val ?? NaN) ? (val as number) / games : null;

  return {
    ...totals,
    passYds: per(totals.passYds) ?? totals.passYds,
    passTD: per(totals.passTD) ?? totals.passTD,
    ints: per(totals.ints) ?? totals.ints,
    rushYds: per(totals.rushYds) ?? totals.rushYds,
    rushTD: per(totals.rushTD) ?? totals.rushTD,
    cmp: per(totals.cmp) ?? totals.cmp,
    att: per(totals.att) ?? totals.att,
    rushAtt: per(totals.rushAtt) ?? totals.rushAtt,
    rec: per(totals.rec ?? null) ?? totals.rec,
    targets: per(totals.targets ?? null) ?? totals.targets,
    recYds: per(totals.recYds ?? null) ?? totals.recYds,
    recTD: per(totals.recTD ?? null) ?? totals.recTD,
    yac: per(totals.yac ?? null) ?? totals.yac,
    fumbles: per(totals.fumbles ?? null) ?? totals.fumbles,
    fumblesLost: per(totals.fumblesLost ?? null) ?? totals.fumblesLost,
  };
}

type StatTone = "amber" | "emerald" | "rose" | "sky" | "violet";

function StatCard({
  label,
  value,
  hint,
  secondary,
  tone = "amber",
}: {
  label: string;
  value: any;
  hint?: string;
  secondary?: boolean;
  tone?: StatTone;
}) {
  const toneStyles: Record<StatTone, { ring: string; label: string; value: string }> = {
    amber: {
      ring: "ring-amber-400/40",
      label: "text-amber-200",
      value: "text-amber-100",
    },
    emerald: {
      ring: "ring-emerald-400/40",
      label: "text-emerald-200",
      value: "text-emerald-100",
    },
    rose: {
      ring: "ring-rose-400/40",
      label: "text-rose-200",
      value: "text-rose-100",
    },
    sky: {
      ring: "ring-sky-400/40",
      label: "text-sky-200",
      value: "text-sky-100",
    },
    violet: {
      ring: "ring-violet-400/40",
      label: "text-violet-200",
      value: "text-violet-100",
    },
  };
  const toneStyle = toneStyles[tone];
  const toneHex: Record<StatTone, string> = {
    amber: "#F59E0B",
    emerald: "#10B981",
    rose: "#FB7185",
    sky: "#38BDF8",
    violet: "#A78BFA",
  };
  const glow = hexToRgba(toneHex[tone], 0.2);
  const glowSoft = hexToRgba(toneHex[tone], 0.08);
  return (
    <div
      className={
        "rounded-2xl " +
        (secondary
          ? "px-2.5 py-1.5 bg-black/20 ring-1 ring-white/8"
          : `px-3 py-3 bg-black/35 ring-1 ${toneStyle.ring} min-h-[88px]`)
      }
      style={
        secondary
          ? {
              backgroundImage: `linear-gradient(135deg, ${glowSoft}, rgba(3,3,7,0.25))`,
            }
          : {
              backgroundImage: `linear-gradient(135deg, ${glow}, rgba(3,3,7,0.2))`,
            }
      }
    >
      <div className={`flex items-center ${secondary ? "justify-between" : "flex-col"}`}>
        <div
          className={`relative flex w-full items-center ${
            secondary ? "justify-start text-[10px] gap-2" : "justify-center text-[10px]"
          } ${secondary ? "text-slate-600" : toneStyle.label}`}
        >
          <span className="uppercase tracking-[0.28em]">{label}</span>
          {hint && secondary && (
            <span
              title={hint}
              className="inline-flex h-5 w-5 cursor-default items-center justify-center rounded-full bg-white/5 text-[9px] text-amber-100/70 ring-1 ring-white/10"
            >
              ?
            </span>
          )}
          {hint && !secondary && (
            <span
              title={hint}
              className="absolute right-0 top-0 inline-flex h-5 w-5 cursor-default items-center justify-center rounded-full bg-white/5 text-[9px] text-amber-100/70 ring-1 ring-white/10"
            >
              ?
            </span>
          )}
        </div>
        <div className={secondary ? "" : "mt-4"}>
          <p
            className={
              secondary
                ? "text-base font-semibold text-slate-200"
                : `text-2xl font-semibold ${toneStyle.value}`
            }
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

const TEAM_PRIMARY_BY_NAME: Record<string, string> = {
  "arizona cardinals": "#97233F",
  "atlanta falcons": "#A71930",
  "baltimore ravens": "#241773",
  "buffalo bills": "#00338D",
  "carolina panthers": "#0085CA",
  "chicago bears": "#0B162A",
  "cincinnati bengals": "#FB4F14",
  "cleveland browns": "#311D00",
  "dallas cowboys": "#041E42",
  "denver broncos": "#002244",
  "detroit lions": "#0076B6",
  "green bay packers": "#203731",
  "houston texans": "#03202F",
  "indianapolis colts": "#002C5F",
  "jacksonville jaguars": "#006778",
  "kansas city chiefs": "#E31837",
  "las vegas raiders": "#000000",
  "los angeles chargers": "#0080C6",
  "los angeles rams": "#003594",
  "miami dolphins": "#008E97",
  "minnesota vikings": "#4F2683",
  "new england patriots": "#002244",
  "new orleans saints": "#D3BC8D",
  "new york giants": "#0B2265",
  "new york jets": "#125740",
  "philadelphia eagles": "#004C54",
  "pittsburgh steelers": "#FFB612",
  "san francisco 49ers": "#AA0000",
  "seattle seahawks": "#002244",
  "tampa bay buccaneers": "#D50A0A",
  "tennessee titans": "#0C2340",
  "washington commanders": "#5A1414",
};

const TEAM_ABBR_BY_NAME: Record<string, string> = {
  "arizona cardinals": "ARI",
  "atlanta falcons": "ATL",
  "baltimore ravens": "BAL",
  "buffalo bills": "BUF",
  "carolina panthers": "CAR",
  "chicago bears": "CHI",
  "cincinnati bengals": "CIN",
  "cleveland browns": "CLE",
  "dallas cowboys": "DAL",
  "denver broncos": "DEN",
  "detroit lions": "DET",
  "green bay packers": "GB",
  "houston texans": "HOU",
  "indianapolis colts": "IND",
  "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC",
  "las vegas raiders": "LV",
  "los angeles chargers": "LAC",
  "los angeles rams": "LAR",
  "miami dolphins": "MIA",
  "minnesota vikings": "MIN",
  "new england patriots": "NE",
  "new orleans saints": "NO",
  "new york giants": "NYG",
  "new york jets": "NYJ",
  "philadelphia eagles": "PHI",
  "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF",
  "seattle seahawks": "SEA",
  "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN",
  "washington commanders": "WAS",
};

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getTeamPrimaryColor(teamName: string | null | undefined) {
  if (!teamName) return "#F59E0B";
  const key = teamName.toLowerCase();
  return TEAM_PRIMARY_BY_NAME[key] ?? "#F59E0B";
}

function getTeamAbbr(teamName: string | null | undefined) {
  if (!teamName) return "—";
  const trimmed = teamName.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  const key = trimmed.toLowerCase();
  return TEAM_ABBR_BY_NAME[key] ?? trimmed.split(" ").slice(-1)[0]?.slice(0, 3).toUpperCase();
}

type GameLogRow = {
  week: number;
  date: string;
  stageType?: "regular" | "playoffs";
  stageLabel?: string | null;
  homeAway: "vs" | "@";
  opp: string;
  result: string;
  dnp?: boolean;
  cmp: number;
  att: number;
  yds: number;
  avg: number;
  td: number;
  ints: number;
  lng: number;
  sack: number;
  rtg: number;
  car: number;
  rushYds: number;
  rushAvg: number;
  rushTd: number;
  rushLng: number;
  rec: number;
  tgts: number;
  recYds: number;
  recAvg: number | null;
  recTd: number;
  recLng: number;
  fum: number;
  lst: number;
  ff: number;
  kb: number;
};

type NextGame = {
  id: number | null;
  timestamp: number | null;
  date: string | null;
  time: string | null;
  timezone: string | null;
  stage: string | null;
  week: string | null;
  venue: { name?: string | null; city?: string | null } | null;
  status: { short?: string | null; long?: string | null } | null;
  teams: {
    home?: { id?: number; name?: string | null; logo?: string | null };
    away?: { id?: number; name?: string | null; logo?: string | null };
  } | null;
};

type MetricKey =
  | "passYds"
  | "passTD"
  | "completions"
  | "attempts"
  | "passLong"
  | "ints"
  | "rushYds"
  | "rushTD"
  | "rushAtt"
  | "rushLng"
  | "rec"
  | "tgts"
  | "recYds"
  | "recTD"
  | "recLng";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pctHit(values: number[], line: number) {
  if (!values.length) return 0;
  const hit = values.filter((v) => v >= line).length;
  return Math.round((hit / values.length) * 100);
}

function dateShort(raw: string) {
  if (!raw) return "—";
  if (!raw.includes("-")) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function altLineForGame(base: number, g: GameLogRow) {
  if (!Number.isFinite(base) || base <= 0) return base;
  const seed = `${g.opp ?? ""}-${g.date ?? ""}-${g.week ?? ""}`;
  const hash = hashString(seed);
  const offsetPct = ((hash % 13) - 6) / 100;
  return Math.round(base * (1 + offsetPct) * 10) / 10;
}

function lean(line: number, proj: number) {
  const edge = proj - line;
  if (Math.abs(edge) < 0.75) return { label: "Lean", tone: "neutral" as const };
  return edge > 0
    ? { label: "Lean Over", tone: "pos" as const }
    : { label: "Lean Under", tone: "neg" as const };
}

type GradeTone = "emerald" | "sky" | "amber" | "rose";

function gradeFromScore(score: number) {
  if (score >= 90) return { label: "A+", tone: "emerald" as const };
  if (score >= 85) return { label: "A", tone: "emerald" as const };
  if (score >= 80) return { label: "A-", tone: "emerald" as const };
  if (score >= 75) return { label: "B+", tone: "sky" as const };
  if (score >= 70) return { label: "B", tone: "sky" as const };
  if (score >= 65) return { label: "B-", tone: "sky" as const };
  if (score >= 60) return { label: "C+", tone: "amber" as const };
  if (score >= 55) return { label: "C", tone: "amber" as const };
  if (score >= 50) return { label: "C-", tone: "amber" as const };
  if (score >= 40) return { label: "D", tone: "rose" as const };
  return { label: "F", tone: "rose" as const };
}

type DvpMetricInfo = { key: keyof DvpStatTotals; label: string; proxy?: boolean };

function dvpMetricInfoForTrend(metric: MetricKey): DvpMetricInfo | null {
  if (metric === "passYds") return { key: "passYds", label: "Pass Yds" };
  if (metric === "passTD") return { key: "passTD", label: "Pass TD" };
  if (metric === "completions") return { key: "completions", label: "Cmp" };
  if (metric === "attempts") return { key: "attempts", label: "Att" };
  if (metric === "passLong") return { key: "passYds", label: "Pass Yds", proxy: true };
  if (metric === "ints") return { key: "ints", label: "INT" };
  if (metric === "rushYds") return { key: "rushYds", label: "Rush Yds" };
  if (metric === "rushTD") return { key: "rushTD", label: "Rush TD" };
  if (metric === "rushAtt") return { key: "rushAtt", label: "Rush Att" };
  if (metric === "rushLng") return { key: "rushYds", label: "Rush Yds", proxy: true };
  if (metric === "rec") return { key: "rec", label: "Rec" };
  if (metric === "tgts") return { key: "targets", label: "Targets" };
  if (metric === "recYds") return { key: "recYds", label: "Rec Yds" };
  if (metric === "recTD") return { key: "recTD", label: "Rec TD" };
  if (metric === "recLng") return { key: "recYds", label: "Rec Yds", proxy: true };
  return null;
}

function resolveDvpValue(
  perGame: DvpStatTotals,
  key:
    | keyof DvpStatTotals
    | "passPct"
    | "passYpa"
    | "rushYpc"
    | "recYpr"
    | "recYpt",
) {
  const calcRatio = (num: number, den: number) => {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  };
  if (key === "passPct") {
    const pct = calcRatio(perGame.completions, perGame.attempts);
    return pct === null ? null : pct * 100;
  }
  if (key === "passYpa") {
    return calcRatio(perGame.passYds, perGame.attempts);
  }
  if (key === "rushYpc") {
    return calcRatio(perGame.rushYds, perGame.rushAtt);
  }
  if (key === "recYpr") {
    return calcRatio(perGame.recYds, perGame.rec);
  }
  if (key === "recYpt") {
    return calcRatio(perGame.recYds, perGame.targets);
  }
  return perGame[key as keyof DvpStatTotals];
}

function rankFromDvpRows(
  rows: DvpRow[],
  teamId: number,
  key:
    | keyof DvpStatTotals
    | "passPct"
    | "passYpa"
    | "rushYpc"
    | "recYpr"
    | "recYpt",
) {
  const items = rows.map((row, idx) => {
    const perGame = row.metrics?.perGame ?? ({} as DvpStatTotals);
    const value = resolveDvpValue(perGame, key);
    return { row, idx, value };
  });
  items.sort((a, b) => {
    const av = Number.isFinite(a.value ?? NaN) ? Number(a.value) : null;
    const bv = Number.isFinite(b.value ?? NaN) ? Number(b.value) : null;
    if (av === null && bv === null) return a.idx - b.idx;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av === bv) return a.idx - b.idx;
    return av - bv;
  });
  const idx = items.findIndex((item) => item.row.teamId === teamId);
  return idx >= 0 ? idx + 1 : null;
}

function buildLogAgg(rows: GameLogRow[]) {
  let games = 0;
  const totals = {
    passYds: 0,
    passTD: 0,
    ints: 0,
    rushYds: 0,
    rushTD: 0,
    cmp: 0,
    att: 0,
    rushAtt: 0,
    rec: 0,
    targets: 0,
    recYds: 0,
    recTD: 0,
    passLong: 0,
    recLng: 0,
    rushLng: 0,
    sacks: 0,
    fumbles: 0,
    fumblesLost: 0,
    rtgSum: 0,
    rtgCount: 0,
  };

  for (const row of rows) {
    if (row.dnp) continue;
    games += 1;
    totals.passYds += Number(row.yds ?? 0);
    totals.passTD += Number(row.td ?? 0);
    totals.ints += Number(row.ints ?? 0);
    totals.rushYds += Number(row.rushYds ?? 0);
    totals.rushTD += Number(row.rushTd ?? 0);
    totals.cmp += Number(row.cmp ?? 0);
    totals.att += Number(row.att ?? 0);
    totals.rushAtt += Number(row.car ?? 0);
    totals.rec += Number(row.rec ?? 0);
    totals.targets += Number(row.tgts ?? 0);
    totals.recYds += Number(row.recYds ?? 0);
    totals.recTD += Number(row.recTd ?? 0);
    totals.passLong = Math.max(totals.passLong, Number(row.lng ?? 0));
    totals.recLng = Math.max(totals.recLng, Number(row.recLng ?? 0));
    totals.rushLng = Math.max(totals.rushLng, Number(row.rushLng ?? 0));
    totals.sacks += Number(row.sack ?? 0);
    totals.fumbles += Number(row.fum ?? 0);
    totals.fumblesLost += Number(row.lst ?? 0);
    const rating = Number(row.rtg);
    if (Number.isFinite(rating)) {
      totals.rtgSum += rating;
      totals.rtgCount += 1;
    }
  }

  if (!games) return null;

  const cmpPct = totals.att ? (totals.cmp / totals.att) * 100 : null;
  const ypa = totals.att ? totals.passYds / totals.att : null;
  const rushAvg = totals.rushAtt ? totals.rushYds / totals.rushAtt : null;
  const recAvg = totals.rec ? totals.recYds / totals.rec : null;
  const passerRating = totals.rtgCount ? totals.rtgSum / totals.rtgCount : null;

  return {
    passYds: totals.passYds / games,
    passTD: totals.passTD / games,
    ints: totals.ints / games,
    rushYds: totals.rushYds / games,
    rushTD: totals.rushTD / games,
    cmp: totals.cmp,
    att: totals.att,
    cmpPct,
    ypa,
    rushAvg,
    passerRating,
    passLong: totals.passLong,
    sacks: totals.sacks,
    rushAtt: totals.rushAtt,
    rec: totals.rec / games,
    targets: totals.targets / games,
    recYds: totals.recYds / games,
    recAvg,
    recTD: totals.recTD / games,
    recLng: totals.recLng,
    yac: null,
    fumbles: totals.fumbles / games,
    fumblesLost: totals.fumblesLost / games,
  };
}

function buildLogTotals(rows: GameLogRow[]) {
  let games = 0;
  const totals = {
    passYds: 0,
    passTD: 0,
    ints: 0,
    rushYds: 0,
    rushTD: 0,
    cmp: 0,
    att: 0,
    rushAtt: 0,
    rec: 0,
    targets: 0,
    recYds: 0,
    recTD: 0,
    passLong: 0,
    recLng: 0,
    rushLng: 0,
    sacks: 0,
    fumbles: 0,
    fumblesLost: 0,
    rtgSum: 0,
    rtgCount: 0,
  };

  for (const row of rows) {
    if (row.dnp) continue;
    games += 1;
    totals.passYds += Number(row.yds ?? 0);
    totals.passTD += Number(row.td ?? 0);
    totals.ints += Number(row.ints ?? 0);
    totals.rushYds += Number(row.rushYds ?? 0);
    totals.rushTD += Number(row.rushTd ?? 0);
    totals.cmp += Number(row.cmp ?? 0);
    totals.att += Number(row.att ?? 0);
    totals.rushAtt += Number(row.car ?? 0);
    totals.rec += Number(row.rec ?? 0);
    totals.targets += Number(row.tgts ?? 0);
    totals.recYds += Number(row.recYds ?? 0);
    totals.recTD += Number(row.recTd ?? 0);
    totals.passLong = Math.max(totals.passLong, Number(row.lng ?? 0));
    totals.recLng = Math.max(totals.recLng, Number(row.recLng ?? 0));
    totals.rushLng = Math.max(totals.rushLng, Number(row.rushLng ?? 0));
    totals.sacks += Number(row.sack ?? 0);
    totals.fumbles += Number(row.fum ?? 0);
    totals.fumblesLost += Number(row.lst ?? 0);
    const rating = Number(row.rtg);
    if (Number.isFinite(rating)) {
      totals.rtgSum += rating;
      totals.rtgCount += 1;
    }
  }

  if (!games) return null;

  const cmpPct = totals.att ? (totals.cmp / totals.att) * 100 : null;
  const ypa = totals.att ? totals.passYds / totals.att : null;
  const rushAvg = totals.rushAtt ? totals.rushYds / totals.rushAtt : null;
  const recAvg = totals.rec ? totals.recYds / totals.rec : null;
  const passerRating = totals.rtgCount ? totals.rtgSum / totals.rtgCount : null;

  return {
    passYds: totals.passYds,
    passTD: totals.passTD,
    ints: totals.ints,
    rushYds: totals.rushYds,
    rushTD: totals.rushTD,
    cmp: totals.cmp,
    att: totals.att,
    cmpPct,
    ypa,
    rushAvg,
    passerRating,
    passLong: totals.passLong,
    sacks: totals.sacks,
    rushAtt: totals.rushAtt,
    rec: totals.rec,
    targets: totals.targets,
    recYds: totals.recYds,
    recAvg,
    recTD: totals.recTD,
    recLng: totals.recLng,
    yac: null,
    fumbles: totals.fumbles,
    fumblesLost: totals.fumblesLost,
  };
}

function metricValue(g: GameLogRow, k: MetricKey) {
  if (k === "passYds") return Number(g.yds ?? 0);
  if (k === "passTD") return Number(g.td ?? 0);
  if (k === "ints") return Number(g.ints ?? 0);
  if (k === "completions") return Number(g.cmp ?? 0);
  if (k === "attempts") return Number(g.att ?? 0);
  if (k === "passLong") return Number(g.lng ?? 0);
  if (k === "rushYds") return Number(g.rushYds ?? 0);
  if (k === "rushTD") return Number(g.rushTd ?? 0);
  if (k === "rushAtt") return Number(g.car ?? 0);
  if (k === "rushLng") return Number(g.rushLng ?? 0);
  if (k === "rec") return Number(g.rec ?? 0);
  if (k === "tgts") return Number(g.tgts ?? 0);
  if (k === "recYds") return Number(g.recYds ?? 0);
  if (k === "recTD") return Number(g.recTd ?? 0);
  if (k === "recLng") return Number(g.recLng ?? 0);
  return 0;
}

function marketForMetric(metric: MetricKey) {
  if (metric === "passYds") return "player_pass_yds";
  if (metric === "passTD") return "player_pass_tds";
  if (metric === "completions") return "player_pass_completions";
  if (metric === "attempts") return "player_pass_attempts";
  if (metric === "passLong") return "player_pass_longest_completion";
  if (metric === "ints") return "player_pass_interceptions";
  if (metric === "rushYds") return "player_rush_yds";
  if (metric === "rushAtt") return "player_rush_attempts";
  if (metric === "rushLng") return "player_rush_longest";
  if (metric === "rec") return "player_receptions";
  if (metric === "recYds") return "player_reception_yds";
  if (metric === "recLng") return "player_reception_longest";
  return null;
}

export default function PlayerPage() {
  return <Suspense><PlayerPageInner /></Suspense>;
}

function PlayerPageInner() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlayerStatsResponse | null>(null);
  const [logFilter, setLogFilter] = useState<"All" | "Home" | "Away">("All");
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllPlayoffLogs, setShowAllPlayoffLogs] = useState(false);
  const [logs, setLogs] = useState<GameLogRow[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("Season");
  const [metric, setMetric] = useState<MetricKey>("passYds");
  const [windowKey, setWindowKey] = useState<"L3" | "L5" | "L10" | "2025">("L10");
  const [nextGame, setNextGame] = useState<NextGame | null>(null);
  const [nextGameLoading, setNextGameLoading] = useState(false);
  const [dvpRow, setDvpRow] = useState<DvpRow | null>(null);
  const [dvpTotalTeams, setDvpTotalTeams] = useState<number | null>(null);
  const [dvpLoading, setDvpLoading] = useState(false);
  const [dvpLeagueAvg, setDvpLeagueAvg] = useState<DvpStatTotals | null>(null);
  const [dvpRowsForPosition, setDvpRowsForPosition] = useState<DvpRow[]>([]);
  const [radarHover, setRadarHover] = useState<{
    label: string;
    hint?: string;
    value: number;
    leagueAvg: number;
    x: number;
    y: number;
    size: number;
  } | null>(null);
  const [oddsLine, setOddsLine] = useState<number | null>(null);
  const [oddsPrices, setOddsPrices] = useState<{ over?: number; under?: number } | null>(
    null,
  );
  const [oddsLoading, setOddsLoading] = useState(false);
  const oddsFormat: "decimal" = "decimal";
  const oddsCacheRef = useRef(
    new Map<string, { line: number | null; prices?: { over?: number; under?: number } }>(),
  );
  const [useAvatarImage, setUseAvatarImage] = useState(false);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const [enrichedPlayer, setEnrichedPlayer] = useState<{
    position?: string | null;
    number?: string | number | null;
    age?: number | null;
    height?: string | null;
    weight?: string | null;
    college?: string | null;
    experience?: number | null;
    group?: string | null;
  }>({});

  const playerId = useMemo(() => {
    if (!params) return null;
    const raw = params.id;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }, [params]);

  const season = searchParams?.get("season") ?? DEFAULT_SEASON;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!playerId) {
        setError("ID manquant dans l'URL.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setData(null);
      setLogs(null);
      setLogsLoading(false);
      setNextGame(null);
      setNextGameLoading(false);
      setDvpRow(null);
      setDvpTotalTeams(null);
      setDvpLoading(false);
      setDvpLeagueAvg(null);
      setDvpRowsForPosition([]);
      setOddsLine(null);
      setOddsPrices(null);
      setOddsLoading(false);
      setEnrichedPlayer({});
      setUseAvatarImage(false);
      try {
        const res = await fetch(
          `/api/nfl/players/${playerId}/statistics?season=${encodeURIComponent(season)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setError(`Impossible de charger les statistiques (status ${res.status}).`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as PlayerStatsResponse;
        setData(json);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setError("Erreur réseau/serveur lors du chargement.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [playerId, season]);

  // Enrichir poste/numéro via l'endpoint joueurs si absent
  useEffect(() => {
    const controller = new AbortController();
    const fetchRosterInfo = async () => {
      if (!data || !("ok" in data) || !data.ok) return;
      const teamId = (data.player?.team as any)?.id;
      if (!teamId) return;
      try {
        const res = await fetch(
          `/api/nfl/players?team=${teamId}&season=${encodeURIComponent(season)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        const match = (json?.players ?? []).find(
          (p: any) => Number(p?.id) === Number(playerId),
        );
        if (match) {
          setEnrichedPlayer({
            position: match.position ?? data.player?.position ?? null,
            number: match.number ?? data.player?.number ?? null,
            age: match.age ?? null,
            height: match.height ?? null,
            weight: match.weight ?? null,
            college: match.college ?? null,
            experience: match.experience ?? null,
            group: match.group ?? null,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
      }
    };
    fetchRosterInfo();
    return () => controller.abort();
  }, [data, playerId, season]);

  const playerKey = playerId ? String(playerId) : "";
  const dataOk = Boolean(data && "ok" in data && data.ok === true);
  const dataPlayerKey =
    dataOk && (data as any).player?.id !== null && (data as any).player?.id !== undefined
      ? String((data as any).player.id)
      : "";
  const hasData = dataOk && playerKey !== "" && dataPlayerKey === playerKey;
  const isStaleData =
    dataOk && playerKey !== "" && dataPlayerKey !== "" && dataPlayerKey !== playerKey;
  const showLoadingState = loading || isStaleData || (!data && !error);
  const stats = hasData ? (data as any).stats : {};
  const playerBase = hasData ? (data as any).player : null;
  const playerBaseAny = playerBase as any;
  const player = playerBase
    ? {
        ...playerBase,
        position: playerBase.position ?? enrichedPlayer.position ?? null,
        number: playerBase.number ?? enrichedPlayer.number ?? null,
        age: playerBaseAny?.age ?? enrichedPlayer.age ?? null,
        height: playerBaseAny?.height ?? enrichedPlayer.height ?? null,
        weight: playerBaseAny?.weight ?? enrichedPlayer.weight ?? null,
        college: playerBaseAny?.college ?? enrichedPlayer.college ?? null,
        experience: playerBaseAny?.experience ?? enrichedPlayer.experience ?? null,
        group: playerBaseAny?.group ?? enrichedPlayer.group ?? null,
      }
    : null;
  const playerImage = player?.image ?? null;
  const avatarSrc = "/images/avatar-player.svg";
  const placeholderTokens = [
    "image-not-available",
    "not-available",
    "no-image",
    "no_photo",
    "nophoto",
    "placeholder",
    "default",
  ];
  const looksLikePlaceholder = (src: string) => {
    const normalized = src.toLowerCase();
    if (normalized.includes(avatarSrc)) return false;
    if (/\/players\/0([.?/]|$)/.test(normalized)) return true;
    return placeholderTokens.some((token) => normalized.includes(token));
  };
  const evaluatePlayerImg = (img: HTMLImageElement | null) => {
    if (!img) return;
    const src = img.currentSrc || img.src;
    if (!src) return;
    if (looksLikePlaceholder(src)) {
      setUseAvatarImage(true);
    }
  };
  const handlePlayerImgError = () => {
    if (!useAvatarImage) setUseAvatarImage(true);
  };
  const handlePlayerImgLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (useAvatarImage) return;
    evaluatePlayerImg(event.currentTarget);
  };

  useEffect(() => {
    if (!playerImage) {
      setUseAvatarImage(true);
      return;
    }
    setUseAvatarImage(looksLikePlaceholder(playerImage));
    if (!looksLikePlaceholder(playerImage)) {
      evaluatePlayerImg(playerImgRef.current);
    }
  }, [playerImage]);
  const teamIdForLogs = useMemo(() => {
    const baseTeamId = player?.team?.id ?? (player as any)?.teamId ?? null;
    return baseTeamId ? Number(baseTeamId) : null;
  }, [player?.team?.id, (player as any)?.teamId]);
  const jerseyNumber = player?.number ?? "-";
  const displayPosition = player?.position ?? "—";
  const country = DEFAULT_COUNTRY;
  const position = (player?.position ?? "").toUpperCase();
  const nameParts = (player?.name ?? "Player").split(" ").filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || firstName;
  const htWt =
    player?.height || player?.weight
      ? `${player?.height ?? "—"} / ${player?.weight ?? "—"}`
      : "—";
  const ageLabel = player?.age !== null && player?.age !== undefined ? String(player.age) : "—";
  const collegeLabel = player?.college ?? "—";
  const expLabel =
    player?.experience !== null && player?.experience !== undefined
      ? player.experience === 0
        ? "Rookie"
        : `${player.experience} yr${player.experience > 1 ? "s" : ""}`
      : "—";
  const groupLabel = player?.group ?? "—";
  const teamName = player?.team?.name ?? "NFL";
  const teamLogo = player?.team?.logo ?? null;
  const teamPrimary = getTeamPrimaryColor(teamName);
  const teamPrimarySoft = hexToRgba(teamPrimary, 0.2);
  const teamPrimaryGlow = hexToRgba(teamPrimary, 0.35);
  const teamPrimaryLine = hexToRgba(teamPrimary, 0.6);

  const agg = hasData ? buildSeasonAgg(stats) : null;
  const bzScore = hasData ? computeBzScore(stats) : null;
  const seasonLabel = `${season} Regular Season${player?.team?.name ? ` (${player.team.name})` : ""}`;
  const playoffsLabel = `${season} Playoffs${player?.team?.name ? ` (${player.team.name})` : ""}`;
  const nextGameIsHome = nextGame?.teams?.home?.id === teamIdForLogs;
  const nextGameOpp = nextGameIsHome
    ? nextGame?.teams?.away?.name
    : nextGame?.teams?.home?.name;
  const nextGameOppId = nextGameIsHome
    ? nextGame?.teams?.away?.id
    : nextGame?.teams?.home?.id;
  const nextGameOppLogo = nextGameIsHome
    ? nextGame?.teams?.away?.logo
    : nextGame?.teams?.home?.logo;
  const oppPrimary = getTeamPrimaryColor(nextGameOpp ?? null);
  const oppPrimarySoft = hexToRgba(oppPrimary, 0.16);
  const oppPrimaryRing = hexToRgba(oppPrimary, 0.45);
  const dvpContext: DvpContext = "all";
  const nextGameHomeAway = nextGame ? (nextGameIsHome ? "vs" : "@") : "";
  const nextGameDate = nextGame?.timestamp ? new Date(nextGame.timestamp * 1000) : null;
  const nextGameDateLabel = nextGameDate
    ? nextGameDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "—";
  const nextGameTimeLabel = nextGameDate
    ? nextGameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const baseColumns = [
    { key: "date", label: "DATE", full: "Date" },
    { key: "opp", label: "OPP", full: "Opponent" },
    { key: "res", label: "RES", full: "Result" },
  ];
  const passingColumns = [
    { key: "cmp", label: "CMP", full: "Completions" },
    { key: "att", label: "ATT", full: "Attempts" },
    { key: "passYds", label: "YDS", full: "Passing yards" },
    { key: "cmpPct", label: "CMP%", full: "Completion %" },
    { key: "passAvg", label: "AVG", full: "Yards per attempt" },
    { key: "passTd", label: "TD", full: "Passing TD" },
    { key: "passInt", label: "INT", full: "Interceptions" },
    { key: "passLng", label: "LNG", full: "Longest pass" },
    { key: "passSack", label: "SACK", full: "Sacks taken" },
    { key: "passRtg", label: "RTG", full: "Passer rating" },
  ];
  const rushingColumns = [
    { key: "rushCar", label: "CAR", full: "Rush attempts" },
    { key: "rushYds", label: "YDS", full: "Rushing yards" },
    { key: "rushAvg", label: "AVG", full: "Yards per rush" },
    { key: "rushTd", label: "TD", full: "Rushing TD" },
    { key: "rushLng", label: "LNG", full: "Longest rush" },
  ];
  const receivingColumns = [
    { key: "rec", label: "REC", full: "Receptions" },
    { key: "tgts", label: "TGTS", full: "Targets" },
    { key: "recYds", label: "YDS", full: "Receiving yards" },
    { key: "recAvg", label: "AVG", full: "Yards per reception" },
    { key: "recTd", label: "TD", full: "Receiving TD" },
    { key: "recLng", label: "LNG", full: "Longest reception" },
  ];
  const fumblesColumns = [
    { key: "fum", label: "FUM", full: "Fumbles" },
    { key: "lst", label: "LST", full: "Fumbles lost" },
    { key: "ff", label: "FF", full: "Forced fumbles" },
    { key: "kb", label: "KB", full: "Kicks blocked" },
  ];
  const baseColWidths = ["12%", "12%", "12%"];
  const statColWidth = "4.25%";
  const isRB = position.includes("RB") || position.includes("FB");
  const isWR = position.includes("WR");
  const isTE = position.includes("TE");
  const isQB = position.includes("QB");
  const dvpPosition: DvpPosition | null = isQB
    ? "QB"
    : isRB
      ? "RB"
      : isTE
        ? "TE"
        : isWR
      ? "WR"
      : null;
  const dvpPositionTone =
    dvpPosition === "QB"
      ? { ring: "ring-sky-500/35", text: "text-sky-200", hex: "#38BDF8" }
      : dvpPosition === "RB"
        ? { ring: "ring-amber-500/35", text: "text-amber-200", hex: "#F59E0B" }
        : dvpPosition
          ? { ring: "ring-violet-500/35", text: "text-violet-200", hex: "#A78BFA" }
          : { ring: "ring-white/10", text: "text-slate-200", hex: "#94A3B8" };
  const metricCfg = useMemo(() => {
    if (isQB) {
      return [
        { key: "passYds", label: "PY" },
        { key: "passTD", label: "TD" },
        { key: "completions", label: "CMP" },
        { key: "attempts", label: "PA" },
        { key: "passLong", label: "P LNG" },
        { key: "ints", label: "INT" },
        { key: "rushYds", label: "RY" },
      ] as const;
    }
    if (isRB) {
      return [
        { key: "rushYds", label: "RY" },
        { key: "rushTD", label: "RTD" },
        { key: "rushAtt", label: "R ATT" },
        { key: "rushLng", label: "R LNG" },
        { key: "rec", label: "REC" },
        { key: "recYds", label: "REC YDS" },
        { key: "recTD", label: "REC TD" },
      ] as const;
    }
    if (isWR || isTE) {
      return [
        { key: "rec", label: "REC" },
        { key: "tgts", label: "TGTS" },
        { key: "recYds", label: "REC YDS" },
        { key: "recTD", label: "REC TD" },
        { key: "recLng", label: "R LNG" },
      ] as const;
    }
    return [
      { key: "passYds", label: "PY" },
      { key: "passTD", label: "TD" },
      { key: "rushYds", label: "RY" },
    ] as const;
  }, [isQB, isRB, isWR, isTE]);
  useEffect(() => {
    if (!metricCfg.length) return;
    if (!metricCfg.some((m) => m.key === metric)) {
      setMetric(metricCfg[0].key);
    }
  }, [metricCfg, metric]);
  const statGroups = isRB
    ? [
        { label: "Rushing", columns: rushingColumns },
        { label: "Receiving", columns: receivingColumns },
        { label: "Fumbles", columns: fumblesColumns },
      ]
    : isWR || isTE
      ? [
          { label: "Receiving", columns: receivingColumns },
          { label: "Rushing", columns: rushingColumns },
          { label: "Fumbles", columns: fumblesColumns },
        ]
      : isQB
        ? [
            { label: "Passing", columns: passingColumns },
            { label: "Rushing", columns: rushingColumns },
          ]
        : [
            { label: "Passing", columns: passingColumns },
            { label: "Rushing", columns: rushingColumns },
          ];
  const statColumns = statGroups.flatMap((group, groupIndex) =>
    group.columns.map((col, colIndex) => ({
      ...col,
      id: `${group.label}-${col.key}`,
      groupIndex,
      isGroupStart: colIndex === 0,
    })),
  );
  const playerFacts = [
    { label: "HT/WT", value: htWt },
    { label: "AGE", value: ageLabel },
    { label: "COLLEGE", value: collegeLabel },
    { label: "EXP", value: expLabel },
    { label: "GROUP", value: groupLabel },
  ];
  const tableLogs: GameLogRow[] = Array.isArray(logs) ? logs : [];
  const sortedLogs = useMemo(() => {
    return [...tableLogs].sort((a, b) => {
      const da = Date.parse(String(a.date ?? "")) || 0;
      const db = Date.parse(String(b.date ?? "")) || 0;
      if (da && db) return db - da;
      return (b.week ?? 0) - (a.week ?? 0);
    });
  }, [tableLogs]);
  const regularLogs = useMemo(
    () => sortedLogs.filter((g) => g.stageType !== "playoffs"),
    [sortedLogs],
  );
  const playoffLogs = useMemo(
    () => sortedLogs.filter((g) => g.stageType === "playoffs"),
    [sortedLogs],
  );
  const overviewIsSeason = overviewRange === "Season";
  const dvpWindow: DvpWindow = "L10";
  const overviewRows = useMemo(() => {
    if (overviewIsSeason) return [];
    const count = overviewRange === "Last 5" ? 5 : 10;
    return regularLogs.filter((g) => !g.dnp).slice(0, count);
  }, [overviewIsSeason, overviewRange, regularLogs]);
  const seasonAggFromLogs = useMemo(() => {
    if (!regularLogs.length) return null;
    return buildLogTotals(regularLogs);
  }, [regularLogs]);
  const seasonGamesCount = useMemo(() => {
    return regularLogs.filter((g) => !g.dnp).length;
  }, [regularLogs]);
  const seasonAvgFromLogs = useMemo(() => {
    if (!regularLogs.length) return null;
    return buildLogAgg(regularLogs);
  }, [regularLogs]);
  const seasonAvgFromStats = useMemo(() => {
    if (!agg || !stats) return null;
    return buildSeasonAvgFromStats(stats, agg);
  }, [agg, stats]);
  const seasonAvgYac =
    agg?.yac !== null && agg?.yac !== undefined && seasonGamesCount
      ? agg.yac / seasonGamesCount
      : null;
  const overviewAgg = overviewIsSeason
    ? seasonAvgFromLogs
      ? { ...seasonAvgFromLogs, yac: seasonAvgFromLogs.yac ?? seasonAvgYac ?? null }
      : seasonAvgFromStats ?? agg
    : buildLogAgg(overviewRows);
  const totalsAgg = seasonAggFromLogs ?? agg;
  const miniStats = isRB
    ? [
        { label: "RUSH YDS", value: totalsAgg ? formatNumber(totalsAgg.rushYds) : "—" },
        { label: "REC YDS", value: totalsAgg ? formatNumber(totalsAgg.recYds) : "—" },
        {
          label: "TD",
          value: totalsAgg
            ? formatNumber((totalsAgg.rushTD ?? 0) + (totalsAgg.recTD ?? 0))
            : "—",
        },
      ]
    : isWR || isTE
      ? [
          { label: "REC", value: totalsAgg ? formatNumber(totalsAgg.rec) : "—" },
          { label: "YDS", value: totalsAgg ? formatNumber(totalsAgg.recYds) : "—" },
          { label: "TD", value: totalsAgg ? formatNumber(totalsAgg.recTD) : "—" },
        ]
      : [
          { label: "YDS", value: totalsAgg ? formatNumber(totalsAgg.passYds) : "—" },
          { label: "TD", value: totalsAgg ? formatNumber(totalsAgg.passTD) : "—" },
          { label: "INT", value: totalsAgg ? formatNumber(totalsAgg.ints) : "—" },
        ];
  const formatPrimaryAverage = (val: any) => {
    const num = toNumber(val);
    if (num === null) return "—";
    return num.toLocaleString("fr-CA", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };
  const formatPrimaryYards = formatPrimaryAverage;
  const formatPrimaryCount = formatPrimaryAverage;
  const dvpPerGame = dvpRow?.metrics?.perGame;
  const dvpTier =
    dvpRow && Number.isFinite(dvpRow.rank ?? NaN)
      ? dvpRow.rank! <= 5
        ? { label: "Elite", ring: "ring-emerald-500/40", text: "text-emerald-200", hex: "#10B981", fill: "bg-emerald-500/60" }
        : dvpRow.rank! <= 12
          ? { label: "Solide", ring: "ring-sky-500/40", text: "text-sky-200", hex: "#38BDF8", fill: "bg-sky-500/60" }
          : dvpRow.rank! <= 20
            ? { label: "Moyenne", ring: "ring-amber-500/40", text: "text-amber-200", hex: "#F59E0B", fill: "bg-amber-500/60" }
            : { label: "Faible", ring: "ring-rose-500/40", text: "text-rose-200", hex: "#FB7185", fill: "bg-rose-500/60" }
      : { label: "—", ring: "ring-white/10", text: "text-slate-200", hex: "#94A3B8", fill: "bg-white/10" };
  const dvpStrengthPct =
    dvpRow && dvpTotalTeams && Number.isFinite(dvpRow.rank ?? NaN)
      ? Math.round(((dvpTotalTeams - dvpRow.rank! + 1) / dvpTotalTeams) * 100)
      : null;
  const dvpRadarConfig = useMemo(() => {
    if (!dvpPerGame || !dvpPosition || !dvpLeagueAvg) return null;
    if (dvpPosition === "QB") {
      return [
        {
          label: "PY",
          value: dvpPerGame.passYds ?? 0,
          leagueAvg: dvpLeagueAvg.passYds ?? 1,
          hint: "Pass Yds",
        },
        {
          label: "PTD",
          value: dvpPerGame.passTD ?? 0,
          leagueAvg: dvpLeagueAvg.passTD ?? 1,
          hint: "Pass TD",
        },
        {
          label: "INT",
          value: dvpPerGame.ints ?? 0,
          leagueAvg: dvpLeagueAvg.ints ?? 1,
          hint: "INT",
        },
      ];
    }
    if (dvpPosition === "RB") {
      return [
        {
          label: "RY",
          value: dvpPerGame.rushYds ?? 0,
          leagueAvg: dvpLeagueAvg.rushYds ?? 1,
          hint: "Rush Yds",
        },
        {
          label: "RTD",
          value: dvpPerGame.rushTD ?? 0,
          leagueAvg: dvpLeagueAvg.rushTD ?? 1,
          hint: "Rush TD",
        },
        {
          label: "REC",
          value: dvpPerGame.rec ?? 0,
          leagueAvg: dvpLeagueAvg.rec ?? 1,
          hint: "Rec",
        },
      ];
    }
    return [
      {
        label: "REC",
        value: dvpPerGame.rec ?? 0,
        leagueAvg: dvpLeagueAvg.rec ?? 1,
        hint: "Rec",
      },
      {
        label: "RYD",
        value: dvpPerGame.recYds ?? 0,
        leagueAvg: dvpLeagueAvg.recYds ?? 1,
        hint: "Rec Yds",
      },
      {
        label: "TD",
        value: dvpPerGame.recTD ?? 0,
        leagueAvg: dvpLeagueAvg.recTD ?? 1,
        hint: "Rec TD",
      },
    ];
  }, [dvpPerGame, dvpPosition, dvpLeagueAvg]);
  const dvpRadar = useMemo(() => {
    if (!dvpRadarConfig) return null;
    const size = 84;
    const center = 42;
    const radius = 28;
    const points = dvpRadarConfig.map((m, idx) => {
      const angle = -Math.PI / 2 + (idx * (2 * Math.PI)) / dvpRadarConfig.length;
      const ratio =
        m.leagueAvg && Number.isFinite(m.leagueAvg) ? m.value / m.leagueAvg : 0;
      const value = clamp(ratio, 0.5, 1.5) / 1.5;
      const r = radius * value;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        angle,
        label: m.label,
        hint: m.hint,
        value: m.value,
        leagueAvg: m.leagueAvg,
      };
    });
    const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
    return { size, center, radius, points, polygon };
  }, [dvpRadarConfig]);
  const dvpRadarNote = dvpLeagueAvg ? "Profil vs moyenne ligue" : "Profil DvP";
  const dvpRankValue = dvpLoading
    ? "Chargement..."
    : dvpRow && Number.isFinite(dvpRow.rank ?? NaN)
      ? `Rang ${dvpRow.rank}${dvpTotalTeams ? `/${dvpTotalTeams}` : ""}`
      : "N/A";
  const dvpBtpValue = dvpLoading
    ? "—"
    : dvpRow
      ? formatPrimaryAverage(dvpRow.ffpPerGame)
      : "N/A";
  const dvpInsights = useMemo(() => {
    if (!dvpPerGame || !dvpLeagueAvg || !dvpPosition || !dvpRow) return null;
    const teamId = dvpRow.teamId;
    const pool =
      dvpPosition === "QB"
        ? [
            { key: "passYds", label: "Pass Yds" },
            { key: "completions", label: "Cmp" },
            { key: "attempts", label: "Att" },
            { key: "passTD", label: "Pass TD" },
            { key: "rushYds", label: "Rush Yds" },
            { key: "rushTD", label: "Rush TD" },
          ]
        : dvpPosition === "RB"
          ? [
              { key: "rushYds", label: "Rush Yds" },
              { key: "rushTD", label: "Rush TD" },
              { key: "rec", label: "Rec" },
              { key: "recYds", label: "Rec Yds" },
            ]
          : [
              { key: "rec", label: "Rec" },
              { key: "recYds", label: "Rec Yds" },
              { key: "recTD", label: "Rec TD" },
              { key: "targets", label: "Targets" },
            ];
    const rankForMetric = (key: string) => {
      if (!dvpRowsForPosition.length) return null;
      return rankFromDvpRows(dvpRowsForPosition, teamId, key as any);
    };
    const items = pool
      .map((m) => {
        const value = (dvpPerGame as any)[m.key];
        const base = (dvpLeagueAvg as any)[m.key];
        if (!Number.isFinite(value ?? NaN) || !Number.isFinite(base ?? NaN) || base === 0) {
          return null;
        }
        const delta = (Number(value) - Number(base)) / Number(base);
        return {
          ...m,
          delta,
          value: Number(value),
          leagueAvg: Number(base),
          rank: rankForMetric(m.key),
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      label: string;
      delta: number;
      value: number;
      rank: number | null;
      leagueAvg: number;
    }>;
    if (!items.length) return null;
    const threshold = 0.07;
    const positives = [...items].filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta);
    const negatives = [...items].filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta);
    let strengths = negatives.filter((item) => item.delta <= -threshold).slice(0, 2);
    if (strengths.length === 0 && negatives.length) {
      strengths = negatives.slice(0, 1);
    }
    const strengthKeys = new Set(strengths.map((item) => item.key));
    let weaknesses = positives
      .filter((item) => item.delta >= threshold)
      .slice(0, 2)
      .filter((item) => !strengthKeys.has(item.key));
    if (weaknesses.length === 0) {
      weaknesses = positives.filter((item) => !strengthKeys.has(item.key)).slice(0, 1);
    }
    const dedupe = (list: typeof items) => {
      const seen = new Set<string>();
      return list.filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      });
    };
    return {
      weaknesses: dedupe(weaknesses).slice(0, 2),
      strengths: dedupe(strengths).slice(0, 2),
    };
  }, [dvpPerGame, dvpLeagueAvg, dvpPosition, dvpRow, dvpRowsForPosition]);
  const formatTrendValue = (val: number) =>
    val.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const formatOddsPrice = (val?: number | null) => {
    if (!Number.isFinite(val ?? NaN)) return "—";
    if (oddsFormat === "decimal") {
      return Number(val).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return val! > 0 ? `+${val}` : `${val}`;
  };
  const avg = (values: number[]) =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  const round1 = (val: number) => Math.round(val * 10) / 10;
  const trendLogsAll = useMemo(() => sortedLogs.filter((g) => !g.dnp), [sortedLogs]);
  const trendBarWidth = useMemo(() => {
    const total = Math.max(1, trendLogsAll.length);
    const gapPx = 8; // gap-2
    return `calc((100% - ${(total - 1) * gapPx}px) / ${total})`;
  }, [trendLogsAll.length]);
  const metricValuesAll = useMemo(
    () =>
      trendLogsAll
        .map((g) => metricValue(g, metric))
        .filter((v) => Number.isFinite(v)),
    [trendLogsAll, metric],
  );
  const logLineForMetric = useMemo(() => {
    if (!metricValuesAll.length) return 0;
    return round1(avg(metricValuesAll));
  }, [metricValuesAll]);
  const lineForMetric = useMemo(() => {
    if (Number.isFinite(oddsLine ?? NaN)) return oddsLine as number;
    return logLineForMetric;
  }, [oddsLine, logLineForMetric]);
  const hasOddsLine = Number.isFinite(oddsLine ?? NaN);
  const projForMetric = useMemo(() => {
    const base = trendLogsAll
      .slice(0, 5)
      .map((g) => metricValue(g, metric))
      .filter((v) => Number.isFinite(v));
    if (!base.length) return lineForMetric;
    return round1(avg(base));
  }, [trendLogsAll, metric, lineForMetric]);
  const windowLogs = useMemo(() => {
    if (windowKey === "2025") return trendLogsAll;
    const n = windowKey === "L3" ? 3 : windowKey === "L5" ? 5 : 10;
    return trendLogsAll.slice(0, n);
  }, [trendLogsAll, windowKey]);
  const values = useMemo(() => {
    return windowLogs
      .slice()
      .reverse()
      .map((g) => ({ g, v: metricValue(g, metric) }));
  }, [windowLogs, metric]);
  const vMax = useMemo(() => {
    const max = Math.max(1, lineForMetric, ...values.map((x) => x.v));
    return Math.ceil(max * 1.15);
  }, [values, lineForMetric]);
  const visualMetricLabel = metricCfg.find((m) => m.key === metric)?.label ?? "";
  const hitPct = useMemo(() => pctHit(values.map((x) => x.v), lineForMetric), [
    values,
    lineForMetric,
  ]);
  const trendOpp = nextGameOpp ?? trendLogsAll[0]?.opp ?? null;
  const trendOppLabel = trendOpp ? getTeamAbbr(trendOpp) : null;
  const matchupPct = useMemo(() => {
    if (!trendOpp) return 0;
    const vsOpp = trendLogsAll.filter((g) => g.opp === trendOpp).slice(0, 3);
    const base = (vsOpp.length ? vsOpp : trendLogsAll.slice(0, 5)).map((g) =>
      metricValue(g, metric),
    );
    return pctHit(base, lineForMetric);
  }, [trendOpp, trendLogsAll, metric, lineForMetric]);
  const noteLogs = useMemo(() => trendLogsAll.slice(0, 10), [trendLogsAll]);
  const noteAvg = useMemo(() => {
    const base = noteLogs.map((g) => metricValue(g, metric)).filter((v) => Number.isFinite(v));
    if (!base.length) return null;
    return round1(avg(base));
  }, [noteLogs, metric]);
  const noteHitPct = useMemo(
    () => pctHit(noteLogs.map((g) => metricValue(g, metric)), lineForMetric),
    [noteLogs, metric, lineForMetric],
  );
  const dvpMetricInfo = useMemo(() => dvpMetricInfoForTrend(metric), [metric]);
  const dvpMetricRank = useMemo(() => {
    if (!dvpMetricInfo || !dvpRow || !dvpRowsForPosition.length) return null;
    return rankFromDvpRows(dvpRowsForPosition, dvpRow.teamId, dvpMetricInfo.key);
  }, [dvpMetricInfo, dvpRow, dvpRowsForPosition]);
  const dvpMetricDelta = useMemo(() => {
    if (!dvpMetricInfo || !dvpRow || !dvpLeagueAvg) return null;
    const oppVal = (dvpRow.metrics?.perGame as any)?.[dvpMetricInfo.key];
    const leagueVal = (dvpLeagueAvg as any)?.[dvpMetricInfo.key];
    if (!Number.isFinite(oppVal ?? NaN) || !Number.isFinite(leagueVal ?? NaN) || !leagueVal) {
      return null;
    }
    return (Number(oppVal) - Number(leagueVal)) / Number(leagueVal);
  }, [dvpMetricInfo, dvpRow, dvpLeagueAvg]);
  const dvpMetricFlag = useMemo(() => {
    if (dvpMetricDelta === null) return null;
    if (dvpMetricDelta >= 0.07) return "weakness";
    if (dvpMetricDelta <= -0.07) return "strength";
    return "neutral";
  }, [dvpMetricDelta]);
  const trendNote = useMemo(() => {
    if (!Number.isFinite(noteAvg ?? NaN) || !Number.isFinite(lineForMetric ?? NaN)) return null;
    const line = Number(lineForMetric);
    const lineEdge =
      line > 0 ? clamp(((noteAvg - line) / line) * 40, -20, 20) : 0;
    const hitEdge = clamp(((noteHitPct / 100) - 0.5) * 40, -20, 20);
    const rankEdge =
      dvpMetricRank && dvpTotalTeams
        ? clamp(
            ((dvpMetricRank - (dvpTotalTeams + 1) / 2) / ((dvpTotalTeams - 1) / 2)) * 20,
            -20,
            20,
          )
        : 0;
    const strengthEdge =
      dvpMetricFlag === "weakness" ? 8 : dvpMetricFlag === "strength" ? -8 : 0;
    const rawScore = 50 + lineEdge + hitEdge + rankEdge + strengthEdge;
    const score = Math.round(clamp(rawScore, 0, 100));
    const grade = gradeFromScore(score);
    const lineDeltaPct =
      line > 0 ? Math.round(((noteAvg - line) / line) * 100) : null;
    return {
      score,
      grade,
      lineDeltaPct,
    };
  }, [noteAvg, lineForMetric, noteHitPct, dvpMetricRank, dvpTotalTeams, dvpMetricFlag]);
  const gradeToneStyles: Record<GradeTone, string> = {
    emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40",
    sky: "bg-sky-500/15 text-sky-200 ring-sky-400/40",
    amber: "bg-amber-500/15 text-amber-200 ring-amber-400/40",
    rose: "bg-rose-500/15 text-rose-200 ring-rose-400/40",
  };
  const gradeToneHex: Record<GradeTone, string> = {
    emerald: "#10B981",
    sky: "#38BDF8",
    amber: "#F59E0B",
    rose: "#FB7185",
  };
  const windowLabel = "L10";
  const dvpMetricLabel = dvpMetricInfo
    ? `${dvpMetricInfo.label}${dvpMetricInfo.proxy ? " ≈" : ""}`
    : null;
  const logsUnavailableReason =
    Array.isArray(logs) && regularLogs.length === 0
      ? "Aucun game log disponible pour la regular season."
      : null;

  // Charger les game logs via l'API (après calcul du player)
  useEffect(() => {
    const controller = new AbortController();
    const fetchLogs = async () => {
      if (!playerId) return;
      const teamId = teamIdForLogs;
      if (!teamId) return;
      setLogsLoading(true);
      try {
        const url = `/api/nfl/players/${playerId}/logs?season=${encodeURIComponent(
          season,
        )}&team=${teamId}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) {
          setLogs(null);
          return;
        }
        const json = await res.json();
        const rows: GameLogRow[] = Array.isArray(json?.logs)
          ? json.logs.map((g: any) => ({
              week: g.week ?? 0,
              date: g.date ?? "",
              stageType: g.stageType === "playoffs" ? "playoffs" : "regular",
              stageLabel: g.stageLabel ?? null,
              homeAway: g.homeAway === "vs" ? "vs" : "@",
              opp: g.opp ?? "OPP",
              result: g.result ?? "—",
              dnp: Boolean(g.dnp),
              cmp: g.cmp ?? 0,
              att: g.att ?? 0,
              yds: g.yds ?? 0,
              avg: g.avg ?? (g.att ? g.yds / g.att : 0),
              td: g.td ?? 0,
              ints: g.ints ?? 0,
              lng: g.lng ?? 0,
              sack: g.sack ?? 0,
              rtg: g.rtg ?? 0,
              car: g.car ?? 0,
              rushYds: g.rushYds ?? 0,
              rushAvg: g.rushAvg ?? (g.car ? g.rushYds / g.car : 0),
              rushTd: g.rushTd ?? 0,
              rushLng: g.rushLng ?? 0,
              rec: g.rec ?? 0,
              tgts: g.tgts ?? 0,
              recYds: g.recYds ?? 0,
              recAvg: g.recAvg ?? (g.rec ? g.recYds / g.rec : null),
              recTd: g.recTd ?? 0,
              recLng: g.recLng ?? 0,
              fum: g.fum ?? 0,
              lst: g.lst ?? 0,
              ff: g.ff ?? 0,
              kb: g.kb ?? 0,
            }))
          : [];
        setLogs(rows);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLogs(null);
      } finally {
        setLogsLoading(false);
      }
    };
    fetchLogs();
    return () => controller.abort();
  }, [playerId, season, teamIdForLogs]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchNextGame = async () => {
      if (!teamIdForLogs) {
        setNextGame(null);
        return;
      }
      setNextGameLoading(true);
      try {
        const url = `/api/nfl/games?team=${teamIdForLogs}&season=${encodeURIComponent(
          season,
        )}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) {
          setNextGame(null);
          return;
        }
        const json = await res.json();
        const games: any[] = Array.isArray(json?.response) ? json.response : [];
        const now = Math.floor(Date.now() / 1000);
        const futureGames = games
          .filter((g) => {
            const ts = Number(g?.game?.date?.timestamp ?? 0);
            if (!ts) return false;
            const status = String(g?.game?.status?.short ?? "");
            if (status === "FT" || status === "CANC") return false;
            return ts >= now;
          })
          .sort(
            (a, b) =>
              Number(a?.game?.date?.timestamp ?? 0) -
              Number(b?.game?.date?.timestamp ?? 0),
          );
        const picked = futureGames[0] ?? null;
        if (!picked) {
          setNextGame(null);
          return;
        }
        setNextGame({
          id: picked?.game?.id ?? null,
          timestamp: picked?.game?.date?.timestamp ?? null,
          date: picked?.game?.date?.date ?? null,
          time: picked?.game?.date?.time ?? null,
          timezone: picked?.game?.date?.timezone ?? null,
          stage: picked?.game?.stage ?? null,
          week: picked?.game?.week ?? null,
          venue: picked?.game?.venue ?? null,
          status: picked?.game?.status ?? null,
          teams: picked?.teams ?? null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setNextGame(null);
      } finally {
        setNextGameLoading(false);
      }
    };
    fetchNextGame();
    return () => controller.abort();
  }, [season, teamIdForLogs]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDvp = async () => {
      if (!dvpPosition || !nextGameOppId) {
        setDvpRow(null);
        setDvpTotalTeams(null);
        setDvpLoading(false);
        return;
      }
      setDvpLoading(true);
      try {
        const url = new URL("/api/nfl/defense/dvp", window.location.origin);
        url.searchParams.set("season", season);
        url.searchParams.set("window", dvpWindow);
        url.searchParams.set("position", dvpPosition);
        url.searchParams.set("context", dvpContext);
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          setDvpRow(null);
          setDvpTotalTeams(null);
          return;
        }
        const json = await res.json();
        const rows: DvpRow[] = Array.isArray(json?.rows) ? json.rows : [];
        const match = rows.find((row) => Number(row.teamId) === Number(nextGameOppId));
        if (rows.length) {
          const totals: DvpStatTotals = {
            passYds: 0,
            passTD: 0,
            ints: 0,
            completions: 0,
            attempts: 0,
            rushYds: 0,
            rushTD: 0,
            rushAtt: 0,
            rec: 0,
            recYds: 0,
            recTD: 0,
            targets: 0,
          };
          let totalGames = 0;
          rows.forEach((row) => {
            const per = row.metrics?.perGame;
            if (!per) return;
            const games = Number(row.games) || 0;
            const weight = games > 0 ? games : 1;
            totalGames += weight;
            totals.passYds += (per.passYds ?? 0) * weight;
            totals.passTD += (per.passTD ?? 0) * weight;
            totals.ints += (per.ints ?? 0) * weight;
            totals.completions += (per.completions ?? 0) * weight;
            totals.attempts += (per.attempts ?? 0) * weight;
            totals.rushYds += (per.rushYds ?? 0) * weight;
            totals.rushTD += (per.rushTD ?? 0) * weight;
            totals.rushAtt += (per.rushAtt ?? 0) * weight;
            totals.rec += (per.rec ?? 0) * weight;
            totals.recYds += (per.recYds ?? 0) * weight;
            totals.recTD += (per.recTD ?? 0) * weight;
            totals.targets += (per.targets ?? 0) * weight;
          });
          const avg = totalGames
            ? {
                passYds: totals.passYds / totalGames,
                passTD: totals.passTD / totalGames,
                ints: totals.ints / totalGames,
                completions: totals.completions / totalGames,
                attempts: totals.attempts / totalGames,
                rushYds: totals.rushYds / totalGames,
                rushTD: totals.rushTD / totalGames,
                rushAtt: totals.rushAtt / totalGames,
                rec: totals.rec / totalGames,
                recYds: totals.recYds / totalGames,
                recTD: totals.recTD / totalGames,
                targets: totals.targets / totalGames,
              }
            : null;
          setDvpLeagueAvg(avg);
        } else {
          setDvpLeagueAvg(null);
        }
        setDvpRowsForPosition(rows);
        setDvpTotalTeams(rows.length || null);
        setDvpRow(match ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setDvpRow(null);
        setDvpTotalTeams(null);
        setDvpLeagueAvg(null);
        setDvpRowsForPosition([]);
      } finally {
        if (!controller.signal.aborted) setDvpLoading(false);
      }
    };
    fetchDvp();
    return () => controller.abort();
  }, [season, dvpWindow, dvpPosition, dvpContext, nextGameOppId]);

  const oddsMarketKey = useMemo(() => marketForMetric(metric), [metric]);
  const nextGameHome = nextGame?.teams?.home?.name ?? null;
  const nextGameAway = nextGame?.teams?.away?.name ?? null;

  const renderLogsTable = (
    rows: GameLogRow[],
    showAll: boolean,
    setShowAll: (value: boolean | ((prev: boolean) => boolean)) => void,
    label: string,
  ) => {
    const filteredRows = rows.filter((g) => {
      if (logFilter === "All") return true;
      return logFilter === "Home" ? g.homeAway === "vs" : g.homeAway === "@";
    });
    const visibleRows = filteredRows.slice(showAll ? undefined : 0, showAll ? undefined : 5);
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b070f]">
        <div className="overflow-x-hidden">
          <table className="w-full table-fixed text-left text-[10px] tabular-nums">
            <colgroup>
              {baseColumns.map((col, idx) => (
                <col key={col.key} style={{ width: baseColWidths[idx] ?? "12%" }} />
              ))}
              {statColumns.map((col) => (
                <col key={col.id} style={{ width: statColWidth }} />
              ))}
            </colgroup>
            <thead className="bg-black/30 uppercase tracking-[0.18em] text-slate-400">
              <tr className="text-[9px]">
                <th
                  colSpan={baseColumns.length}
                  className="px-2 py-2 text-left font-semibold text-slate-300"
                >
                  {label}
                </th>
                {statGroups.map((group, groupIndex) => (
                  <th
                    key={group.label}
                    colSpan={group.columns.length}
                    className={`px-2 py-2 text-center font-semibold text-slate-300 ${
                      groupIndex > 0 ? "border-l border-white/10" : ""
                    }`}
                  >
                    {group.label}
                  </th>
                ))}
              </tr>
              <tr className="text-[9px]">
                {baseColumns.map((col) => (
                  <th
                    key={col.key}
                    className="relative cursor-default px-2 py-1 group"
                    title={col.full}
                  >
                    <span>{col.label}</span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                      {col.full}
                    </span>
                  </th>
                ))}
                {statColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`relative cursor-default px-1.5 py-1 group ${
                      col.isGroupStart && col.groupIndex > 0 ? "border-l border-white/10" : ""
                    }`}
                    title={col.full}
                  >
                    <span>{col.label}</span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                      {col.full}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-200">
              {visibleRows.map((g) => {
                const isDnp = Boolean(g.dnp);
                const valueOrDash = (val: any) =>
                  val === null || val === undefined || val === "" ? "—" : val;
                const cmpPct = isDnp ? "—" : g.att ? ((g.cmp / g.att) * 100).toFixed(1) : "—";
                const avg = isDnp ? "—" : Number.isFinite(g.avg) ? g.avg.toFixed(1) : "—";
                const rAvg = isDnp ? "—" : Number.isFinite(g.rushAvg) ? g.rushAvg.toFixed(1) : "—";
                const recAvg = isDnp
                  ? "—"
                  : Number.isFinite(g.recAvg)
                    ? g.recAvg.toFixed(1)
                    : g.rec
                      ? (g.recYds / g.rec).toFixed(1)
                      : "—";
                const rtg = isDnp ? "—" : Number.isFinite(g.rtg) ? g.rtg.toFixed(1) : "—";
                const dateValue =
                  typeof g.date === "string" ? g.date : g.date ? String(g.date) : "";
                const parsedDate =
                  dateValue && !dateValue.includes(" ")
                    ? new Date(dateValue).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : dateValue;
                const oppLabel = g.opp ?? "OPP";
                const statValues: Record<string, string | number> = {
                  cmp: isDnp ? "—" : valueOrDash(g.cmp),
                  att: isDnp ? "—" : valueOrDash(g.att),
                  passYds: isDnp ? "—" : valueOrDash(g.yds),
                  cmpPct,
                  passAvg: avg,
                  passTd: isDnp ? "—" : valueOrDash(g.td),
                  passInt: isDnp ? "—" : valueOrDash(g.ints),
                  passLng: isDnp ? "—" : valueOrDash(g.lng),
                  passSack: isDnp ? "—" : valueOrDash(g.sack),
                  passRtg: rtg,
                  rushCar: isDnp ? "—" : valueOrDash(g.car),
                  rushYds: isDnp ? "—" : valueOrDash(g.rushYds),
                  rushAvg: rAvg,
                  rushTd: isDnp ? "—" : valueOrDash(g.rushTd),
                  rushLng: isDnp ? "—" : valueOrDash(g.rushLng),
                  rec: isDnp ? "—" : valueOrDash(g.rec),
                  tgts: isDnp ? "—" : valueOrDash(g.tgts),
                  recYds: isDnp ? "—" : valueOrDash(g.recYds),
                  recAvg,
                  recTd: isDnp ? "—" : valueOrDash(g.recTd),
                  recLng: isDnp ? "—" : valueOrDash(g.recLng),
                  fum: isDnp ? "—" : valueOrDash(g.fum),
                  lst: isDnp ? "—" : valueOrDash(g.lst),
                  ff: isDnp ? "—" : valueOrDash(g.ff),
                  kb: isDnp ? "—" : valueOrDash(g.kb),
                };
                const weekLabel = (() => {
                  if (typeof g.week === "number" && Number.isFinite(g.week)) return `W${g.week}`;
                  if (typeof g.week === "string") {
                    const match = g.week.match(/\d+/);
                    return match ? `W${match[0]}` : g.week;
                  }
                  return "—";
                })();
                const resultClass = isDnp
                  ? "text-slate-400"
                  : g.result?.startsWith("W")
                    ? "text-emerald-300"
                    : "text-rose-300";
                return (
                  <tr key={`${label}-${g.week}-${dateValue}-${g.opp}`} className="hover:bg-white/5">
                    <td className="px-2 py-1 text-slate-300">
                      <div className="leading-tight">
                        <div>{parsedDate || "—"}</div>
                        <div className="text-[9px] text-slate-500">{weekLabel}</div>
                      </div>
                    </td>
                    <td
                      className="px-2 py-1 text-slate-300 truncate"
                      title={`${g.homeAway} ${oppLabel}`}
                    >
                      {g.homeAway} {oppLabel}
                    </td>
                    <td className={`px-2 py-1 font-semibold ${resultClass}`}>
                      <span>{g.result ?? "—"}</span>
                      {isDnp && <span className="ml-2 text-[10px] text-slate-500">DNP</span>}
                    </td>
                    {statColumns.map((col) => (
                      <td
                        key={`${label}-${g.week}-${col.id}`}
                        className={`px-1.5 py-1 ${
                          col.isGroupStart && col.groupIndex > 0
                            ? "border-l border-white/10"
                            : ""
                        }`}
                      >
                        {statValues[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filteredRows.length > 5 && (
                <tr className="bg-black/20">
                  <td colSpan={baseColumns.length + statColumns.length} className="px-2 py-3 text-center">
                    <button
                      onClick={() => setShowAll((prev) => !prev)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] text-amber-100 transition hover:border-amber-400/40"
                    >
                      {showAll ? "Afficher moins" : "Afficher plus"}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchOdds = async () => {
      if (!nextGameHome || !nextGameAway || !player?.name || !oddsMarketKey) {
        setOddsLine(null);
        setOddsPrices(null);
        return;
      }

      const cacheKey = `${nextGameHome}::${nextGameAway}::${oddsMarketKey}::${player.name}::${oddsFormat}`;
      const cached = oddsCacheRef.current.get(cacheKey);
      if (cached) {
        setOddsLine(cached.line);
        setOddsPrices(cached.prices ?? null);
        return;
      }

      setOddsLoading(true);
      try {
        const oddsUrl = `/api/nfl/odds?home=${encodeURIComponent(
          nextGameHome,
        )}&away=${encodeURIComponent(nextGameAway)}&markets=${encodeURIComponent(
          oddsMarketKey,
        )}&regions=us&bookmakers=draftkings&oddsFormat=${oddsFormat}&player=${encodeURIComponent(
          player.name,
        )}`;
        const res = await fetch(oddsUrl, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) {
          setOddsLine(null);
          setOddsPrices(null);
          return;
        }
        const json = await res.json();
        const payload = json?.data;
        const bookmakers = payload?.bookmakers ?? [];
        let line: number | null = null;
        let over: number | undefined;
        let under: number | undefined;
        for (const book of bookmakers) {
          for (const market of book?.markets ?? []) {
            if (market?.key !== oddsMarketKey) continue;
            for (const outcome of market?.outcomes ?? []) {
              const point = Number(outcome?.point);
              if (Number.isFinite(point) && line === null) {
                line = point;
              }
              const name = String(outcome?.name ?? "").toLowerCase();
              if (name.includes("over") && Number.isFinite(outcome?.price)) {
                over = outcome.price;
              }
              if (name.includes("under") && Number.isFinite(outcome?.price)) {
                under = outcome.price;
              }
            }
          }
        }
        setOddsLine(line);
        const prices = over || under ? { over, under } : null;
        setOddsPrices(prices);
        oddsCacheRef.current.set(cacheKey, { line, prices: prices ?? undefined });
      } catch (err) {
        if (controller.signal.aborted) return;
        setOddsLine(null);
        setOddsPrices(null);
      } finally {
        setOddsLoading(false);
      }
    };
    fetchOdds();
    return () => controller.abort();
  }, [nextGameHome, nextGameAway, oddsMarketKey, player?.name, oddsFormat]);

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 lg:px-0">
        {/* TOP BAR */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/nfl"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour NFL</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/60">
              <span className="text-[11px] font-semibold tracking-tight text-amber-200">
                BZ
              </span>
            </div>
            <button className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-[12px] font-semibold text-black shadow-lg shadow-orange-600/30 transition hover:brightness-105">
              ★ Betalyze Player
            </button>
          </div>
        </header>

        {showLoadingState || !hasData ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b090f] p-6 text-center text-sm text-slate-400">
            {showLoadingState
              ? "Chargement des statistiques..."
              : error ?? "Statistiques indisponibles."}
          </div>
        ) : (
          <>
        {/* HERO + SCORE */}
        <section
          className="mt-4 rounded-3xl border border-white/10 bg-[#0b090f] p-3 shadow-lg shadow-black/30"
          style={{ backgroundColor: hexToRgba(teamPrimary, 0.08) }}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 px-4 pt-4 pb-0"
              style={{
                backgroundImage: `linear-gradient(120deg, ${teamPrimarySoft} 0%, rgba(11, 9, 15, 0.96) 55%, rgba(9, 8, 12, 0.98) 100%)`,
                boxShadow: `inset 0 1px 0 ${teamPrimaryLine}`,
              }}
            >
              <div
                className="absolute -left-28 top-0 h-full w-60 -skew-x-12"
                style={{
                  background: `linear-gradient(180deg, ${teamPrimaryGlow} 0%, rgba(0,0,0,0) 100%)`,
                }}
              />
              <div
                className="absolute -right-10 top-10 h-40 w-40 rounded-full blur-2xl"
                style={{ backgroundColor: teamPrimarySoft }}
              />
              {teamLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogo}
                  alt={teamName}
                  className="absolute right-5 top-5 h-16 w-16 opacity-20"
                />
              )}
              <div className="relative z-10 min-h-[150px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={playerImgRef}
                  src={useAvatarImage || !playerImage ? avatarSrc : playerImage}
                  alt={
                    useAvatarImage || !playerImage
                      ? "Player avatar"
                      : player?.name ?? "Player"
                  }
                  className={
                    useAvatarImage || !playerImage
                      ? "absolute bottom-0 left-1 h-36 w-32 object-contain opacity-90"
                      : "absolute bottom-0 left-1 h-36 w-32 object-cover object-top drop-shadow-[0_16px_26px_rgba(0,0,0,0.45)]"
                  }
                  style={
                    useAvatarImage || !playerImage
                      ? undefined
                      : {
                          WebkitMaskImage:
                            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                          maskImage:
                            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                        }
                  }
                  onError={handlePlayerImgError}
                  onLoad={handlePlayerImgLoad}
                />
                <div className="space-y-2 pb-3 pl-0 sm:pl-36">
                  <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">
                    Fiche joueur
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <p className="text-xs uppercase text-slate-400">{firstName}</p>
                      <p className="text-2xl font-semibold text-slate-50">{lastName}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {teamName} · Saison {season}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {teamLogo ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-slate-100 ring-1 ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={teamLogo}
                          alt={teamName}
                          className="h-4 w-4"
                        />
                        <span>{teamName}</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-slate-100 ring-1 ring-white/10">
                        {teamName}
                      </span>
                    )}
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      #{jerseyNumber}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      {displayPosition}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      {country}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-100 ring-1 ring-emerald-500/30">
                      Actif
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
                    {playerFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 ring-1 ring-white/10"
                      >
                        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
                          {fact.label}
                        </span>
                        <span className="font-semibold text-slate-100">{fact.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-black/30 p-3 ring-1 ring-amber-400/20">
              <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 opacity-70" />
              <div className="flex items-start justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Betalyze Score
                </p>
                <span className="text-[11px] text-slate-500">Saison {season}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-amber-100">
                    {bzScore !== null ? bzScore : "—"}
                    <span className="text-lg text-slate-500"> / 100</span>
                  </p>
                  <p className="text-xs text-slate-400">Score maison basé sur les stats.</p>
                </div>
              </div>
              <p className="mt-2 text-[9px] uppercase tracking-[0.3em] text-slate-500">
                Totaux saison
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {miniStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px]"
                  >
                    <p className="text-slate-400">{stat.label}</p>
                    <p className="font-semibold text-slate-100">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* APERÇU SAISON */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#08050d]/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                {isRB
                  ? "Aperçu saison (RB)"
                  : isWR
                    ? "Aperçu saison (WR)"
                    : isTE
                      ? "Aperçu saison (TE)"
                      : isQB
                        ? "Aperçu saison (QB)"
                        : "Aperçu saison"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Moyennes par match (totaux + ratios).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.3em] text-slate-500">
                Moyenne / match
              </span>
              <div className="inline-flex items-center gap-2 rounded-full bg-black/40 p-1 text-[11px] ring-1 ring-white/10">
              {(["Season", "Last 5", "Last 10"] as OverviewRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setOverviewRange(r)}
                  className={`rounded-full px-3 py-1 transition ${
                    overviewRange === r
                      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/50"
                      : "text-slate-400 hover:text-amber-100"
                  }`}
                >
                  {r}
                </button>
              ))}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(isRB
                ? [
                    {
                      k: "Rush Yds",
                      v: overviewAgg ? formatPrimaryYards(overviewAgg.rushYds) : "—",
                      hint: "Yards au sol par match.",
                      tone: "amber",
                    },
                    {
                      k: "Rush TD",
                      v: overviewAgg ? formatPrimaryCount(overviewAgg.rushTD) : "—",
                      hint: "Touchdowns au sol par match.",
                      tone: "emerald",
                    },
                    {
                      k: "REC",
                      v: overviewAgg ? formatPrimaryCount(overviewAgg.rec) : "—",
                      hint: "Réceptions par match.",
                      tone: "sky",
                    },
                    {
                      k: "Rec Yds",
                      v: overviewAgg ? formatPrimaryYards(overviewAgg.recYds) : "—",
                      hint: "Yards à la réception par match.",
                      tone: "violet",
                    },
                    {
                      k: "Rush Avg",
                      v:
                        overviewAgg?.rushAvg !== null && overviewAgg?.rushAvg !== undefined
                          ? overviewAgg?.rushAvg?.toFixed(1)
                          : "—",
                      hint: "Yards par course.",
                      secondary: true,
                    },
                    {
                      k: "Rec Avg",
                      v:
                        overviewAgg?.recAvg !== null && overviewAgg?.recAvg !== undefined
                          ? overviewAgg?.recAvg?.toFixed(1)
                          : "—",
                      hint: "Yards par réception.",
                      secondary: true,
                    },
                    {
                      k: "Targets",
                      v: overviewAgg ? formatPrimaryCount(overviewAgg.targets) : "—",
                      hint: "Cibles par match.",
                      secondary: true,
                    },
                    {
                      k: "Fumbles",
                      v: overviewAgg ? formatPrimaryCount(overviewAgg.fumbles) : "—",
                      hint: "Fumbles par match.",
                      secondary: true,
                    },
                  ]
                : isWR || isTE
                  ? [
                      {
                        k: "REC",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.rec) : "—",
                        hint: "Réceptions par match.",
                        tone: "amber",
                      },
                      {
                        k: "Rec Yds",
                        v: overviewAgg ? formatPrimaryYards(overviewAgg.recYds) : "—",
                        hint: "Yards à la réception par match.",
                        tone: "sky",
                      },
                      {
                        k: "Rec TD",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.recTD) : "—",
                        hint: "Touchdowns à la réception par match.",
                        tone: "emerald",
                      },
                      {
                        k: "Targets",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.targets) : "—",
                        hint: "Cibles par match.",
                        tone: "violet",
                      },
                      {
                        k: "Rec Avg",
                        v:
                          overviewAgg?.recAvg !== null && overviewAgg?.recAvg !== undefined
                            ? overviewAgg?.recAvg?.toFixed(1)
                            : "—",
                        hint: "Yards par réception.",
                        secondary: true,
                      },
                      {
                        k: "Long Rec",
                        v: overviewAgg ? formatNumber(overviewAgg.recLng) : "—",
                        hint: "Plus longue réception.",
                        secondary: true,
                      },
                      {
                        k: "YAC",
                        v:
                          overviewIsSeason && overviewAgg?.yac !== null && overviewAgg?.yac !== undefined
                            ? toNumber(overviewAgg.yac)?.toFixed(1) ?? "—"
                            : "—",
                        hint: "Yards after catch par match.",
                        secondary: true,
                      },
                      {
                        k: "Fumbles",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.fumbles) : "—",
                        hint: "Fumbles par match.",
                        secondary: true,
                      },
                    ]
                  : [
                      {
                        k: "Pass Yds",
                        v: overviewAgg ? formatPrimaryYards(overviewAgg.passYds) : "—",
                        hint: "Yards à la passe par match.",
                        tone: "amber",
                      },
                      {
                        k: "Pass TD",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.passTD) : "—",
                        hint: "Touchdowns à la passe par match.",
                        tone: "emerald",
                      },
                      {
                        k: "INT",
                        v: overviewAgg ? formatPrimaryCount(overviewAgg.ints) : "—",
                        hint: "Interceptions par match.",
                        tone: "rose",
                      },
                      {
                        k: "Rush Yds",
                        v: overviewAgg ? formatPrimaryYards(overviewAgg.rushYds) : "—",
                        hint: "Yards au sol par match.",
                        tone: "sky",
                      },
                      {
                        k: "CMP%",
                        v:
                          overviewAgg?.cmpPct !== null
                            ? `${overviewAgg?.cmpPct?.toFixed(1)}%`
                            : "—",
                        hint: "Pourcentage de passes complétées.",
                        secondary: true,
                      },
                      {
                        k: "Yds/Att",
                        v: overviewAgg?.ypa !== null ? overviewAgg?.ypa?.toFixed(1) : "—",
                        hint: "Yards par tentative de passe.",
                        secondary: true,
                      },
                      {
                        k: "Passer RTG",
                        v:
                          overviewAgg?.passerRating !== null &&
                          overviewAgg?.passerRating !== undefined
                            ? overviewAgg?.passerRating?.toFixed(1)
                            : "—",
                        hint: "Passer rating NFL (0 à 158.3).",
                        secondary: true,
                      },
                      {
                        k: "Rush Avg",
                        v: overviewAgg?.rushAvg !== null ? overviewAgg?.rushAvg?.toFixed(1) : "—",
                        hint: "Yards par course.",
                        secondary: true,
                      },
                    ])
              .map((c) => (
                <StatCard
                  key={c.k}
                  label={c.k}
                  value={c.v}
                  hint={c.hint}
                  secondary={c.secondary}
                  tone={c.tone}
                />
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
                DvP disponible, autres données matchup à venir.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] text-amber-200 ring-1 ring-amber-400/40">
              à venir
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div
              className="rounded-2xl bg-black/35 px-3 py-2 border"
              style={{
                borderColor: oppPrimaryRing,
                background: `linear-gradient(135deg, ${oppPrimarySoft}, rgba(3, 3, 7, 0.15))`,
              }}
            >
              <p className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: oppPrimary }}
                />
                Prochain match
              </p>
              {nextGameLoading ? (
                <p className="text-sm font-semibold text-slate-400">Chargement…</p>
              ) : nextGame ? (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    {nextGameOppLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={nextGameOppLogo} alt="" className="h-6 w-6" />
                    )}
                    <p
                      className="text-sm font-semibold text-slate-100"
                      style={{ textShadow: `0 0 12px ${hexToRgba(oppPrimary, 0.35)}` }}
                    >
                      {nextGameHomeAway} {nextGameOpp ?? "—"}
                    </p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-white/10">
                      {nextGame?.week ?? nextGame?.stage ?? "NFL"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {nextGameDateLabel}
                    {nextGameTimeLabel ? ` · ${nextGameTimeLabel}` : ""}
                  </p>
                  {nextGame?.venue?.name && (
                    <p className="text-[10px] text-slate-500">
                      {nextGame.venue.name}
                      {nextGame.venue.city ? ` · ${nextGame.venue.city}` : ""}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-100">Aucun match à venir</p>
              )}
            </div>

            <div
              className={`rounded-2xl bg-black/35 px-3 py-2 ring-1 ${dvpTier.ring}`}
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(
                  dvpTier.hex,
                  0.16,
                )}, rgba(3, 3, 7, 0.2))`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-500">
                    Defense {getTeamAbbr(nextGameOpp ?? "")} vs {dvpPosition ?? "—"}
                  </p>
                  <span
                    className={`rounded-full bg-black/40 px-2 py-0.5 text-[9px] ${dvpTier.text} ring-1 ${dvpTier.ring}`}
                  >
                    {dvpTier.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/nfl?section=defense"
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-amber-200 ring-1 ring-amber-400/30 hover:bg-white/10"
                  >
                    Voir DvP
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] ${dvpTier.text} ring-1 ${dvpTier.ring}`}
                  >
                    <Shield className="h-3 w-3" />
                    DvP
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-base font-semibold ${dvpTier.text}`}>
                      {dvpRankValue}
                    </p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
                      {dvpStrengthPct !== null ? `Top ${dvpStrengthPct}%` : "—"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">BTP/G {dvpBtpValue}</p>
                </div>
                <div className="ml-auto">
                  {dvpRadar ? (
                    <div
                      className="relative"
                      style={{ width: dvpRadar.size, height: dvpRadar.size }}
                    >
                      <svg
                        width={dvpRadar.size}
                        height={dvpRadar.size}
                        viewBox={`0 0 ${dvpRadar.size} ${dvpRadar.size}`}
                        className="overflow-visible rounded-full bg-black/40 ring-1 ring-white/10"
                      >
                      {[0.33, 0.66, 1].map((step) => (
                        <circle
                          key={step}
                          cx={dvpRadar.center}
                          cy={dvpRadar.center}
                          r={dvpRadar.radius * step}
                          stroke="rgba(148, 163, 184, 0.2)"
                          strokeWidth="1"
                          fill="none"
                        />
                      ))}
                      {dvpRadar.points.map((pt, idx) => (
                        <line
                          key={pt.label}
                          x1={dvpRadar.center}
                          y1={dvpRadar.center}
                          x2={pt.x}
                          y2={pt.y}
                          stroke="rgba(148, 163, 184, 0.3)"
                          strokeWidth="1"
                        />
                      ))}
                      <polygon
                        points={dvpRadar.polygon}
                        fill={hexToRgba("#38BDF8", 0.28)}
                        stroke="#38BDF8"
                        strokeWidth="2.6"
                        style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.6))" }}
                      />
                      {dvpRadar.points.map((pt) => (
                        <circle
                          key={`${pt.label}-dot`}
                          cx={pt.x}
                          cy={pt.y}
                          r="3.3"
                          fill="#38BDF8"
                          onMouseEnter={() =>
                            setRadarHover({
                              label: pt.label,
                              hint: pt.hint,
                              value: pt.value,
                              leagueAvg: pt.leagueAvg,
                              x: pt.x,
                              y: pt.y,
                              size: dvpRadar.size,
                            })
                          }
                          onMouseLeave={() => setRadarHover(null)}
                        />
                      ))}
                      {dvpRadar.points.map((pt) => {
                        const labelRadius = dvpRadar.radius + 6;
                        const lx = dvpRadar.center + labelRadius * Math.cos(pt.angle);
                        const ly = dvpRadar.center + labelRadius * Math.sin(pt.angle);
                        const anchor =
                          Math.abs(Math.cos(pt.angle)) < 0.25
                            ? "middle"
                            : Math.cos(pt.angle) > 0
                              ? "start"
                              : "end";
                        const dy = Math.sin(pt.angle) > 0.25 ? 4 : Math.sin(pt.angle) < -0.25 ? -2 : 1;
                        return (
                          <text
                            key={`${pt.label}-label`}
                            x={lx}
                            y={ly}
                            textAnchor={anchor}
                            dominantBaseline="middle"
                            fontSize="8"
                            fill="rgba(226, 232, 240, 0.7)"
                            dy={dy}
                          >
                            {pt.label}
                          </text>
                        );
                      })}
                    </svg>
                      {radarHover && radarHover.size === dvpRadar.size && (
                        <div
                          className="pointer-events-none absolute z-10 translate-x-3 -translate-y-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-slate-100 ring-1 ring-white/10"
                          style={{
                            left: `${(radarHover.x / radarHover.size) * 100}%`,
                            top: `${(radarHover.y / radarHover.size) * 100}%`,
                          }}
                        >
                          <div className="font-semibold text-amber-100">
                            {radarHover.hint ?? radarHover.label}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-slate-300">
                            <span>Def {formatPrimaryAverage(radarHover.value)}/m</span>
                            <span className="text-slate-600">•</span>
                            <span>Ligue {formatPrimaryAverage(radarHover.leagueAvg)}/m</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-black/40 text-[10px] text-slate-500 ring-1 ring-white/10">
                      —
                    </div>
                  )}
                  <p className="mt-1 text-center text-[9px] text-slate-500">
                    {dvpRadarNote}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-violet-500/30"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba("#A78BFA", 0.14)}, rgba(3, 3, 7, 0.2))`,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500">
                  {getTeamAbbr(nextGameOpp ?? "")} · Meilleur / moins bon contre
                </p>
                <span className="text-[9px] text-slate-400">vs ligue</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-[9px] text-rose-200">Moins bon contre</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {dvpInsights?.weaknesses?.length ? (
                      dvpInsights.weaknesses.map((item) => (
                        <div
                          key={`weak-${item.key}`}
                          className="rounded-xl bg-white/5 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className="text-rose-200">
                              {item.rank ? `#${item.rank}` : "—"}
                              {dvpTotalTeams ? `/${dvpTotalTeams}` : ""}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                            <span>Def {formatPrimaryAverage(item.value)}/m</span>
                            <span>Ligue {formatPrimaryAverage(item.leagueAvg)}/m</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-500 ring-1 ring-white/10">
                        —
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-200">Meilleur contre</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {dvpInsights?.strengths?.length ? (
                      dvpInsights.strengths.map((item) => (
                        <div
                          key={`strong-${item.key}`}
                          className="rounded-xl bg-white/5 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className="text-emerald-200">
                              {item.rank ? `#${item.rank}` : "—"}
                              {dvpTotalTeams ? `/${dvpTotalTeams}` : ""}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                            <span>Def {formatPrimaryAverage(item.value)}/m</span>
                            <span>Ligue {formatPrimaryAverage(item.leagueAvg)}/m</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-500 ring-1 ring-white/10">
                        —
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VISUAL TREND (props) */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#050309] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Visual trend (props)
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tendance récente par match avec filtres rapides.
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
                {(["2025", "L10", "L5", "L3"] as const).map((w) => (
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between">
              <div className="min-w-0 flex flex-col">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-50">
                  {player?.name ?? "Player"}
                  <span className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-slate-400">
                    {displayPosition} | {teamName}
                    <span className="inline-flex items-center gap-1">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 ring-1 ring-emerald-500/25">
                        O {oddsLoading ? "…" : formatOddsPrice(oddsPrices?.over ?? null)}
                      </span>
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200 ring-1 ring-rose-500/25">
                        U {oddsLoading ? "…" : formatOddsPrice(oddsPrices?.under ?? null)}
                      </span>
                    </span>
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {trendOppLabel
                    ? `${nextGameHomeAway ? `${nextGameHomeAway} ` : ""}${trendOppLabel}`
                    : "—"}{" "}
                  · Line{" "}
                  {Number.isFinite(lineForMetric)
                    ? formatTrendValue(lineForMetric)
                    : "—"}
                </p>
                {trendNote && (
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[11px]">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      {windowLabel} vs line{" "}
                      <span
                        className={
                          trendNote.lineDeltaPct !== null && trendNote.lineDeltaPct >= 0
                            ? "text-emerald-200"
                            : "text-rose-200"
                        }
                      >
                        {trendNote.lineDeltaPct !== null
                          ? `${trendNote.lineDeltaPct >= 0 ? "+" : ""}${trendNote.lineDeltaPct}%`
                          : "—"}
                      </span>
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      DvP {dvpMetricLabel ?? "—"}{" "}
                      <span className="text-amber-200">
                        {dvpMetricRank && dvpTotalTeams
                          ? `#${dvpMetricRank}/${dvpTotalTeams}`
                          : "—"}
                      </span>
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      {dvpMetricFlag === "weakness"
                        ? "Faiblesse def"
                        : dvpMetricFlag === "strength"
                          ? "Force def"
                          : "Profil neutre"}
                      {dvpMetricLabel ? `: ${dvpMetricLabel}` : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-3">
                <div className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                  2025 <span className="text-slate-500">·</span> {hitPct}%
                </div>
                <div className="flex flex-col items-center gap-2">
                  {trendNote && (
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-[26px] font-semibold ring-1 ${gradeToneStyles[trendNote.grade.tone]}`}
                    >
                      {trendNote.grade.label}
                    </div>
                  )}
                  <div className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
                    H2H <span className="text-slate-500">·</span> {matchupPct}%
                  </div>
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

                <div className="absolute inset-0 flex items-stretch justify-center gap-2">
                  {values.map(({ g, v }) => {
                    const oppShort = getTeamAbbr(g.opp ?? "");
                    const pct = clamp((v / vMax) * 100, 0, 100);
                    const altLine = hasOddsLine
                      ? lineForMetric
                      : altLineForGame(lineForMetric, g);
                    const linePct = clamp((altLine / vMax) * 100, 0, 100);
                    const isHit = v >= altLine;
                    return (
                      <div
                        key={`${g.week}-${g.opp}-${g.date}`}
                        className="flex h-full flex-none flex-col items-center justify-end"
                        style={{ width: trendBarWidth }}
                      >
                        <div
                          className="group relative w-full min-w-[22px] overflow-hidden rounded-lg ring-1 ring-white/10 bg-white/5 transition hover:brightness-110"
                          style={{ height: `${pct}%` }}
                        >
                          <div
                            className={`absolute inset-0 ${
                              isHit ? "bg-emerald-500/80" : "bg-rose-500/80"
                            }`}
                          />
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100">
                            <div className="font-semibold">
                              {formatTrendValue(v)}{" "}
                              <span className="text-[10px] text-slate-400">
                                {visualMetricLabel}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {g.homeAway} {oppShort} · {dateShort(String(g.date ?? ""))}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Line {formatTrendValue(altLine)}
                            </div>
                          </div>
                          {pct >= 16 && (
                            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white/90 drop-shadow">
                              {formatTrendValue(v)}
                            </div>
                          )}
                        </div>

                        <div className="mt-2 text-center text-[10px] text-slate-500">
                          <div className="text-slate-300">{oppShort}</div>
                          <div>{dateShort(String(g.date ?? ""))}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Line: <span className="text-amber-200">{formatTrendValue(lineForMetric)}</span>
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Proj: <span className="text-amber-200">{formatTrendValue(projForMetric)}</span>
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 ring-1 ring-emerald-500/25">
                  Hit%: {hitPct}%
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                  Lean:{" "}
                  <span className="text-slate-50">
                    {lean(lineForMetric, projForMetric).label}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* GAME LOGS */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#050309] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Game logs (Season + Playoffs)
              </p>
              {logsUnavailableReason && (
                <p className="text-xs text-amber-300">{logsUnavailableReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {logsLoading && <span className="text-amber-200">Chargement…</span>}
              <Sparkles className="h-4 w-4 text-amber-300" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {(["All", "Home", "Away"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`rounded-full border px-3 py-1 transition ${
                  logFilter === f
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                    : "border-white/10 bg-white/5 hover:border-amber-400/40"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {playoffLogs.length > 0 && (
            renderLogsTable(playoffLogs, showAllPlayoffLogs, setShowAllPlayoffLogs, playoffsLabel)
          )}
          {renderLogsTable(regularLogs, showAllLogs, setShowAllLogs, seasonLabel)}
        </section>
          </>
        )}
      </div>
    </div>
  );
}
