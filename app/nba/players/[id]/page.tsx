// app/nba/players/[id]/page.tsx
"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import playersData from "@/data/nba-players-nba-v2-2025.json";

type NbaPlayer = {
  id?: number | string;
  fullName?: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId?: number | string | null;
  teamName?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
  nationality?: string | null;
  isActive?: boolean;
};

type PlayerSummaryPayload = {
  ok: boolean;
  summary?: {
    last5: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
    } | null;
    last10: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
    } | null;
    seasonAvg?: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
    } | null;
    pointsTrend: "up" | "flat" | "down" | "unknown";
    dataQuality: "low" | "medium" | "high";
    games?: Array<{
      gameId: number;
      date: string;
      teamCode: string | null;
      opponentTeamName: string | null;
      opponentTeamCode: string | null;
      homeAway?: "home" | "away" | "unknown";
      result?: "W" | "L" | "NA";
      score?: string | null;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
      isPreseason?: boolean;
    }>;
  };
};

type PlayersApiPayload = {
  players?: NbaPlayer[];
  response?: NbaPlayer[];
  player?: NbaPlayer | null;
};

const rawPlayers: any = playersData;
const localPlayers: NbaPlayer[] = Array.isArray(rawPlayers)
  ? rawPlayers
  : Array.isArray(rawPlayers.players)
  ? rawPlayers.players
  : Array.isArray(rawPlayers.response)
  ? rawPlayers.response
  : [];

const localById = (() => {
  const m = new Map<string, NbaPlayer>();
  for (const p of localPlayers) {
    const ids = [
      p.id,
      (p as any).playerId,
      (p as any).player_id,
      (p as any).player?.id,
    ]
      .filter((v) => v !== undefined && v !== null)
      .map((v) => String(v));
    ids.forEach((id) => {
      if (!m.has(id)) m.set(id, p);
    });
  }
  return m;
})();

function findLocalPlayer(id: string | null): NbaPlayer | null {
  if (!id) return null;
  const direct = id.trim();
  const num = Number.isFinite(Number(id)) ? String(Number(id)) : null;
  return localById.get(direct) ?? (num ? localById.get(num) ?? null : null);
}

function formatName(p: NbaPlayer): string {
  const fromParts = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  if (p.fullName) return p.fullName;
  return `Player #${p.id}`;
}

function safeNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(digits);
}

function formatDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : String(value);
  const ts = Date.parse(text);
  if (Number.isNaN(ts)) return text.split("T")[0] || text;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatGameDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const raw = typeof value === "string" ? value : String(value);
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(ts);
}

function monthLabel(value: string | number | null | undefined): string {
  const raw = typeof value === "string" ? value : value ? String(value) : "";
  const ts = raw ? Date.parse(raw) : NaN;
  if (!Number.isNaN(ts)) {
    return new Intl.DateTimeFormat("en-US", { month: "long" }).format(ts);
  }
  return "Recent";
}

function formatHomeAwayLabel(homeAway?: string | null): string {
  if (homeAway === "home") return "vs";
  if (homeAway === "away") return "@";
  return "—";
}

function computeScoreFromGames(games: PlayerSummaryPayload["summary"]["games"]) {
  if (!games || games.length === 0) return 72;
  const last5 = games.slice(0, 5);
  const avgLast5 =
    last5.reduce((sum, g) => sum + (g.points ?? 0), 0) / last5.length;
  const avgAll =
    games.reduce((sum, g) => sum + (g.points ?? 0), 0) / games.length;
  const base = 72;
  const delta = avgLast5 - avgAll;
  return Math.round(Math.max(40, Math.min(99, base + delta * 2)));
}

export default function PlayerPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<NbaPlayer | null>(null);
  const [summary, setSummary] = useState<PlayerSummaryPayload["summary"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<"last5" | "last10" | "season">(
    "last5",
  );
  const [filter, setFilter] = useState<"all" | "home" | "away">("all");
  const [showAllGames, setShowAllGames] = useState(false);

  const resolvedId = useMemo(() => {
    const rawId = params?.id;
    if (Array.isArray(rawId)) return rawId[0] ?? null;
    return rawId ?? null;
  }, [params]);

  const seasonParam = searchParams?.get("season");
  const defaultSeason = process.env.NEXT_PUBLIC_APISPORTS_BASKETBALL_SEASON ?? "2025";
  const season = seasonParam || defaultSeason;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!resolvedId) {
        setError("ID manquant");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      let found: NbaPlayer | null = null;
      try {
        const res = await fetch(`/api/nba/players?id=${resolvedId}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as PlayersApiPayload;
          const arr = Array.isArray(data.players)
            ? data.players
            : Array.isArray(data.response)
            ? data.response
            : data.player
            ? [data.player]
            : [];
          found = arr[0] ?? null;
        }
      } catch {
        // ignore
      }
      if (!found) {
        found = findLocalPlayer(resolvedId);
      }
      if (!found) {
        setError("Joueur introuvable");
        setLoading(false);
        return;
      }
      setPlayer(found);

      try {
        const res = await fetch(
          `/api/nba/players/${resolvedId}/summary?season=${encodeURIComponent(
            season,
          )}&refresh=1`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (res.ok) {
          const data = (await res.json()) as PlayerSummaryPayload;
          setSummary(data.summary ?? undefined);
        } else {
          setSummary(undefined);
        }
      } catch {
        setSummary(undefined);
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, [resolvedId, season]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050308] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Chargement…</p>
      </main>
    );
  }

  if (!player || error) {
    return (
      <main className="min-h-screen bg-[#050308] text-slate-100 flex items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-400">{error ?? "Joueur introuvable"}</p>
          <Link
            href="/nba"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-100"
          >
            ← Retour NBA
          </Link>
        </div>
      </main>
    );
  }

  const displayName = formatName(player);
  const windowStats =
    summaryMode === "last5"
      ? summary?.last5
      : summaryMode === "last10"
      ? summary?.last10
      : summary?.seasonAvg ?? null;
  const betalyzeWindowStats =
    summary?.last5 ?? summary?.last10 ?? summary?.seasonAvg ?? null;
  const betalyzeBaseLabel = summary?.last5
    ? "Based on last 5"
    : summary?.last10
    ? "Based on last 10"
    : "Based on season";

  const gamesRaw = summary?.games ?? [];
  const filteredGames = gamesRaw.filter((g) => {
    if (filter === "home") return g.homeAway === "home";
    if (filter === "away") return g.homeAway === "away";
    return true;
  });
  const displayGames = filteredGames.map((g) => {
    const opponent =
      typeof g.opponentTeamName === "string"
        ? g.opponentTeamName
        : typeof g.opponentTeamCode === "string"
        ? g.opponentTeamCode
        : typeof g.opponentTeamId === "number"
        ? `Team ${g.opponentTeamId}`
        : "—";
    const result =
      typeof g.result === "string" && g.result.length > 0 ? g.result : null;
    const score =
      typeof g.score === "string" && g.score.length > 0 ? g.score : null;
    const status =
      result && result !== "NA"
        ? result
        : g.statusShort && g.statusShort !== "FT"
        ? g.statusShort
        : "";
    const scoreText = status ? `${status}${score ? ` ${score}` : ""}` : score ?? "—";
    const rawDate = g.date ?? null;
    return {
      ...g,
      opponentSafe: opponent,
      resultSafe: result ?? g.statusShort ?? "NA",
      scoreSafe: scoreText,
      dateSafe: rawDate ? formatGameDate(String(rawDate)) : "—",
      rawDate,
      monthLabel: monthLabel(rawDate),
      homeAwayLabel: formatHomeAwayLabel(g.homeAway),
    };
  });
  const visibleGames = showAllGames ? displayGames : displayGames.slice(0, 12);
  const betalyzeScore = computeScoreFromGames(gamesRaw);
  type GameRow = (typeof displayGames)[number];
  const groupedGames = visibleGames.reduce<Map<string, GameRow[]>>(
    (acc, game) => {
      const key = game.monthLabel || "Recent";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(game);
      return acc;
    },
    new Map<string, GameRow[]>(),
  );
  const groupedEntries = Array.from(groupedGames.entries());

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-8 pt-5 lg:px-0">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/nba"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b090f] px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm hover:border-white/25 hover:bg-[#110f17]"
          >
            ← Retour NBA
          </Link>
          <div className="flex flex-col items-end gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/60">
              <span className="text-[11px] font-semibold tracking-tight text-amber-200">
                BZ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40">
                ★ Betalyze Player
              </span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-white/8 bg-[radial-gradient(circle_at_0_0,#f9731624,transparent_55%),radial-gradient(circle_at_100%_0,#fb923c24,transparent_55%),#050309] p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-5 lg:p-6">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f0a12] text-lg font-semibold text-amber-400 ring-1 ring-white/10 md:h-20 md:w-20 md:text-2xl">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
                Player overview
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300/90">
                <span className="font-medium">{player.position ?? "—"}</span>
                {player.jerseyNumber && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-500" />
                    <span className="text-slate-400">#{player.jerseyNumber}</span>
                  </>
                )}
                {player.nationality && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-500" />
                    <span className="text-slate-400">{player.nationality}</span>
                  </>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
                {player.teamName && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b090f]/80 px-3 py-1 text-[11px] text-slate-100">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[10px] text-slate-200">
                      {player.teamName
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 3)}
                    </span>
                    <span className="truncate max-w-[120px] md:max-w-[180px]">
                      {player.teamName}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-[#08050d]/90 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                <span className="text-amber-400">◎</span>
                <span>Betalyze score</span>
              </div>
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-slate-400">
                {betalyzeBaseLabel}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-amber-200">
                    {betalyzeScore}
                  </span>
                  <span className="pb-1 text-xs text-slate-400">/ 100</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Score maison basé sur le log récent.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-200">
                <div className="rounded-xl bg-black/60 px-2 py-1.5 ring-1 ring-white/10">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    PTS
                  </p>
                  <p className="mt-0.5 font-medium">{safeNum(betalyzeWindowStats?.points)}</p>
                </div>
                <div className="rounded-xl bg-black/60 px-2 py-1.5 ring-1 ring-white/10">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    REB
                  </p>
                  <p className="mt-0.5 font-medium">
                    {safeNum(betalyzeWindowStats?.rebounds)}
                  </p>
                </div>
                <div className="rounded-xl bg-black/60 px-2 py-1.5 ring-1 ring-white/10">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    AST
                  </p>
                  <p className="mt-0.5 font-medium">{safeNum(betalyzeWindowStats?.assists)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-white/10 border-t-amber-500/40 bg-[radial-gradient(circle_at_0_0,#f9731620,transparent_55%),#050309] p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  {summaryMode === "last5"
                    ? "Last 5 overview"
                    : summaryMode === "last10"
                    ? "Last 10 overview"
                    : "Season overview"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Vue d&apos;ensemble de ses dernières performances.
                </p>
              </div>
              <div className="inline-flex gap-1 rounded-full bg-black/50 p-1 text-[10px]">
                <button
                  onClick={() => setSummaryMode("last5")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "last5"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  Last 5
                </button>
                <button
                  onClick={() => setSummaryMode("last10")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "last10"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  Last 10
                </button>
                <button
                  onClick={() => setSummaryMode("season")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "season"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  Season
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 px-3 py-2.5 ring-1 ring-amber-400/60">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">
                  Points
                </p>
                <p className="mt-1 text-base font-semibold text-amber-200">
                  {safeNum(windowStats?.points)}
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 px-3 py-2.5 ring-1 ring-amber-400/60">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">
                  Rebonds
                </p>
                <p className="mt-1 text-base font-semibold text-amber-200">
                  {safeNum(windowStats?.rebounds)}
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 px-3 py-2.5 ring-1 ring-amber-400/60">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">
                  Passes
                </p>
                <p className="mt-1 text-base font-semibold text-amber-200">
                  {safeNum(windowStats?.assists)}
                </p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 px-3 py-2.5 ring-1 ring-amber-400/60">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">
                  Minutes
                </p>
                <p className="mt-1 text-base font-semibold text-amber-200">
                  {safeNum(windowStats?.minutes)}
                </p>
              </div>
            </div>

          </div>

        <div className="flex flex-col rounded-3xl border border-white/10 border-t-amber-500/40 bg-[#08050d]/90 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Game log
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Derniers matchs ({filteredGames.length}).
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="inline-flex gap-1 rounded-full bg-black/50 p-1">
                <button
                  onClick={() => setFilter("all")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (filter === "all"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("home")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (filter === "home"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  Home
                </button>
                <button
                  onClick={() => setFilter("away")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (filter === "away"
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  Away
                </button>
              </div>
              <div className="inline-flex gap-1 rounded-full bg-black/50 p-1">
                <button
                  onClick={() => setSummaryMode("last5")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "last5"
                      ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                      : "text-slate-400")
                  }
                >
                  Last 5
                </button>
                <button
                  onClick={() => setSummaryMode("last10")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "last10"
                      ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                      : "text-slate-400")
                  }
                >
                  Last 10
                </button>
                <button
                  onClick={() => setSummaryMode("season")}
                  className={
                    "rounded-full px-2 py-0.5 " +
                    (summaryMode === "season"
                      ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                      : "text-slate-400")
                  }
                >
                  Season
                </button>
              </div>
            </div>
          </div>

          <div className="px-2.5 py-3 sm:px-4">
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-1 text-xs text-slate-200">
                <thead>
                  <tr className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Opp</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-right">PTS</th>
                    <th className="px-3 py-2 text-right">REB</th>
                    <th className="px-3 py-2 text-right">AST</th>
                    <th className="px-3 py-2 text-right">MIN</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedEntries.map(([label, rows]) => (
                    <Fragment key={label}>
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 pb-1 pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500"
                        >
                          {label}
                        </td>
                      </tr>
                      {rows.map((g) => {
                        const isWin = g.resultSafe === "W";
                        return (
                          <tr
                            key={`${g.gameId}-${g.rawDate ?? g.dateSafe}-${g.opponentSafe ?? ""}`}
                            className="rounded-xl bg-[#0b070f] align-middle shadow-[0_0_0_1px_rgba(24,24,27,1)]"
                          >
                            <td className="rounded-l-xl px-3 py-2 text-xs text-slate-200">
                              {g.dateSafe}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-[0.6rem] font-semibold text-slate-100">
                                  {(g.opponentSafe ?? "—").toString().slice(0, 3).toUpperCase()}
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[0.75rem] text-slate-100">
                                    {g.opponentSafe ?? "—"}
                                  </span>
                                  <span className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                                    {g.homeAwayLabel}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
                                    isWin
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : "bg-rose-500/15 text-rose-300"
                                  }`}
                                >
                                  {g.resultSafe ?? "NA"}
                                </span>
                                <span className="text-[0.7rem] text-slate-400">
                                  {g.scoreSafe ?? "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-semibold text-amber-300">
                              {safeNum(g.points)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-200">
                              {safeNum(g.rebounds)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-200">
                              {safeNum(g.assists)}
                            </td>
                            <td className="rounded-r-xl px-3 py-2 text-right text-xs text-slate-200">
                              {safeNum(g.minutes)}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredGames.length > 12 && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllGames((v) => !v)}
                  className="text-[11px] font-medium text-amber-300 hover:text-amber-200"
                >
                  {showAllGames ? "Voir moins de matchs" : "Voir plus de matchs"}
                </button>
              </div>
            )}
          </div>
        </div>
        </section>
      </div>
    </div>
  );
}
