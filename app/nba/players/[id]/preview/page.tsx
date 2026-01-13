// app/nba/players/[id]/preview/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function PlayerPreviewPage() {
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

  const gamesRaw = summary?.games ?? [];
  const filteredGames = gamesRaw.filter((g) => {
    if (filter === "home") return g.homeAway === "home";
    if (filter === "away") return g.homeAway === "away";
    return true;
  });
  const visibleGames = showAllGames ? filteredGames : filteredGames.slice(0, 3);
  const betalyzeScore = computeScoreFromGames(gamesRaw);

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
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40 hover:brightness-110"
              >
                ★ Betalyze Player
              </button>
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
                Based on last 5
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
                  <p className="mt-0.5 font-medium">{safeNum(windowStats?.points)}</p>
                </div>
                <div className="rounded-xl bg-black/60 px-2 py-1.5 ring-1 ring-white/10">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    REB
                  </p>
                  <p className="mt-0.5 font-medium">
                    {safeNum(windowStats?.rebounds)}
                  </p>
                </div>
                <div className="rounded-xl bg-black/60 px-2 py-1.5 ring-1 ring-white/10">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    AST
                  </p>
                  <p className="mt-0.5 font-medium">{safeNum(windowStats?.assists)}</p>
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

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/50 px-3 py-3 text-xs text-slate-300">
              {summary?.pointsTrend
                ? `Trend: ${summary.pointsTrend}`
                : "Trend: n/a"}
              <p className="mt-1 text-[11px] text-slate-500">
                Petit résumé texte basé sur les moyennes récentes.
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-3xl border border-white/10 border-t-amber-500/40 bg-[#08050d]/90">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Game log
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Derniers matchs ({filteredGames.length}).
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
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
              </div>
            </div>

            <div className="space-y-2 px-3 py-3 text-xs sm:px-4">
              {visibleGames.map((g) => (
                <div
                  key={`${g.gameId}-${g.date}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#0b070f] px-3 py-2.5 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-100">
                      {g.date ? new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {g.homeAway === "home" ? "HOME" : g.homeAway === "away" ? "AWAY" : "N/A"} · vs{" "}
                      {g.opponentTeamCode || g.opponentTeamName || "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {g.result && g.result !== "NA" ? `${g.result} ${g.score ?? ""}` : g.score ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-100 sm:gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500">PTS</span>
                      <span className="font-semibold">{safeNum(g.points)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500">REB</span>
                      <span className="font-semibold">{safeNum(g.rebounds)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500">AST</span>
                      <span className="font-semibold">{safeNum(g.assists)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500">MIN</span>
                      <span className="font-semibold">{safeNum(g.minutes)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredGames.length > 3 && (
                <div className="pt-1 text-center">
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
