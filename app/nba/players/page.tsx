"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Flame, Search, Sparkles, Trophy } from "lucide-react";
import { TOP_PROPS_PAGE_SIZE, TEAM_CODE_BY_ID, getNbaCdnTeamLogo } from "@/lib/nba/constants";
import {
  formatPlayerName,
  formatDecimal,
  formatEdge,
  formatOddsForDisplay,
  gradeTone,
  gradeSortRank,
  getTeamPrimaryColor,
  hexToRgba,
  type OddsDisplayFormat,
} from "@/app/nba/components/nba-helpers";
import type {
  BetalyzeNbaTeam,
  BetalyzeNbaTeamsPayload,
  NbaPlayer,
  NbaTopProp,
  NbaTopPropsApiPayload,
  PlayersResponse,
} from "@/app/nba/components/nba-shared-types";

const MAX_SUGGESTIONS = 10;

const cn = (...classes: Array<string | null | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export default function NbaPlayersPage() {
  const [oddsFormat, setOddsFormat] = useState<OddsDisplayFormat>("decimal");
  const [teams, setTeams] = useState<BetalyzeNbaTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<NbaPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [topProps, setTopProps] = useState<NbaTopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [topPropsOu, setTopPropsOu] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [topPropsSortBy, setTopPropsSortBy] = useState<"GRADE" | "EDGE">("GRADE");
  const [topPropsGameFilter, setTopPropsGameFilter] = useState<string>("ALL");
  const [topPropsPage, setTopPropsPage] = useState(1);
  const [topPropsGeneratedAt, setTopPropsGeneratedAt] = useState<string | null>(null);
  const [topPropsDate, setTopPropsDate] = useState<string | null>(null);

  // Leaderboard state
  type LeaderboardEntry = {
    playerId: number;
    playerName: string;
    teamCode: string;
    position: string | null;
    seasonAvg: number;
    last5Avg: number | null;
    gamesPlayed: number;
    trend: "up" | "down" | "flat";
  };
  type RecentLog = { date: string; value: number; points: number; rebounds: number; assists: number };
  type LeaderboardData = {
    topScorers: LeaderboardEntry[];
    topRebounders: LeaderboardEntry[];
    topAssistmen: LeaderboardEntry[];
    recentLogs: Array<{ playerId: number; metric: string; logs: RecentLog[] }>;
    playingTeams: string[];
  };
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardTab, setLeaderboardTab] = useState<"PTS" | "REB" | "AST">("PTS");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/account/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          settings?: { oddsFormat?: string | null };
        };
        if (!data?.ok) return;
        const next =
          String(data.settings?.oddsFormat ?? "").toLowerCase() === "american"
            ? "american"
            : "decimal";
        if (!cancelled) setOddsFormat(next);
      } catch {
        // keep default
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        setTeamsLoading(true);
        setTeamsError(null);
        const res = await fetch("/api/nba/teams", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch NBA teams");
        const data = (await res.json()) as BetalyzeNbaTeamsPayload;
        setTeams(Array.isArray(data.teams) ? data.teams : []);
      } catch (err) {
        setTeams([]);
        setTeamsError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setTeamsLoading(false);
      }
    };
    loadTeams();
  }, []);

  const loadTopProps = useCallback(async (refresh: boolean) => {
    try {
      setTopPropsLoading(true);
      setTopPropsError(null);
      if (refresh) {
        const syncUrl = new URL("/api/nba/odds/sync-daily", window.location.origin);
        syncUrl.searchParams.set("refresh", "1");
        syncUrl.searchParams.set("skipTopProps", "1");
        syncUrl.searchParams.set("skipLogs", "1");
        const syncRes = await fetch(syncUrl.toString(), { cache: "no-store" });
        const syncJson = (await syncRes.json().catch(() => null)) as
          | { ok?: boolean; error?: string; message?: string }
          | null;
        if (!syncRes.ok || syncJson?.ok === false) {
          throw new Error(
            syncJson?.error ??
              syncJson?.message ??
              `Failed to sync daily odds (${syncRes.status})`,
          );
        }
      }
      const url = new URL("/api/nba/props/top", window.location.origin);
      if (refresh) url.searchParams.set("refresh", "1");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch top props");
      const data = (await res.json()) as NbaTopPropsApiPayload;
      const list = Array.isArray(data?.props) ? data.props : [];
      const normalized: NbaTopProp[] = list
        .map((item) => ({
          id: String(item.id),
          playerId: item.playerId ?? null,
          player: String(item.player ?? "Player"),
          metric: String(item.metric ?? "PTS"),
          line: Number(item.line),
          side: item.side === "under" ? ("under" as const) : ("over" as const),
          odds: Number(item.odds),
          edge: Number(item.edge),
          score: Number(item.score),
          grade: String(item.grade ?? "C"),
          finalScore: Number(item.finalScore ?? item.score ?? 0),
          gameId: item.gameId ?? null,
          awayCode: String(item.teamCode ?? "").trim().toUpperCase() || "—",
          homeCode: String(item.opponentCode ?? "").trim().toUpperCase() || "—",
          bookmaker: item.bookmaker ?? null,
        }))
        .filter((item) => Number.isFinite(item.line) && Number.isFinite(item.odds));
      setTopProps(normalized);
      setTopPropsGeneratedAt(typeof data.generatedAt === "string" ? data.generatedAt : null);
      setTopPropsDate(typeof data.date === "string" ? data.date : null);
    } catch (err) {
      setTopProps([]);
      setTopPropsError(err instanceof Error ? err.message : "Unknown error");
      setTopPropsGeneratedAt(null);
      setTopPropsDate(null);
    } finally {
      setTopPropsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTopProps(false);
  }, [loadTopProps]);

  useEffect(() => {
    const load = async () => {
      try {
        setLeaderboardLoading(true);
        const res = await fetch("/api/nba/players/leaderboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as LeaderboardData & { ok: boolean };
        if (data.ok) setLeaderboard(data);
      } catch {
        // silent
      } finally {
        setLeaderboardLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setPlayers([]);
      setPlayersError(null);
      setPlayersLoading(false);
      return;
    }
    const controller = new AbortController();
    const fetchPlayers = async () => {
      try {
        setPlayersLoading(true);
        setPlayersError(null);
        const params = new URLSearchParams({ search: query });
        const res = await fetch(`/api/nba/players?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch players");
        const data = (await res.json()) as PlayersResponse;
        const list = Array.isArray(data.players) ? data.players : [];
        const seen = new Set<number>();
        const unique = list.filter((p) => {
          const id = Number(p.id ?? NaN);
          if (!Number.isFinite(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setPlayers(unique.slice(0, MAX_SUGGESTIONS));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlayersError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setPlayersLoading(false);
      }
    };
    const timeout = setTimeout(fetchPlayers, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const teamMetaByCode = useMemo(() => {
    const map = new Map<string, BetalyzeNbaTeam>();
    teams.forEach((team) => {
      const code = String(team.code ?? "").trim().toUpperCase();
      if (code) map.set(code, team);
    });
    return map;
  }, [teams]);

  const suggestions = useMemo(() => {
    if (search.trim().length < 2) return [];
    return players.map((player) => {
      const code =
        String(player.teamCode ?? "").trim().toUpperCase() ||
        (player.teamId ? String(TEAM_CODE_BY_ID[Number(player.teamId)] ?? "").trim().toUpperCase() : "");
      const team = code ? (teamMetaByCode.get(code) ?? null) : null;
      return {
        id: String(player.id),
        label: formatPlayerName(player),
        firstName: player.firstName ?? null,
        lastName: player.lastName ?? null,
        position: player.position ?? "-",
        jerseyNumber: player.jerseyNumber ?? null,
        teamLabel: code || team?.code || team?.name || "NBA",
        teamLogo: getNbaCdnTeamLogo(code) ?? team?.logo ?? null,
      };
    });
  }, [players, search, teamMetaByCode]);

  const topPropsGameOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: "ALL", label: "Tous les games" },
    ];
    const seen = new Set<string>();
    for (const item of topProps) {
      const gameId = Number(item.gameId ?? NaN);
      if (!Number.isFinite(gameId)) continue;
      const key = String(gameId);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: key,
        label: `${String(item.awayCode || "AWAY").toUpperCase()} vs ${String(item.homeCode || "HOME").toUpperCase()}`,
      });
    }
    return options;
  }, [topProps]);

  useEffect(() => {
    if (topPropsGameFilter === "ALL") return;
    if (!topPropsGameOptions.some((option) => option.value === topPropsGameFilter)) {
      setTopPropsGameFilter("ALL");
    }
  }, [topPropsGameFilter, topPropsGameOptions]);

  const topPropsDisplay = useMemo(() => {
    const selectedGameId = topPropsGameFilter === "ALL" ? NaN : Number(topPropsGameFilter);
    const hasGameFilter = Number.isFinite(selectedGameId) && selectedGameId > 0;
    const filtered = topProps.filter((item) => {
      if (hasGameFilter && Number(item.gameId ?? NaN) !== selectedGameId) return false;
      if (topPropsOu === "OVER") return item.side === "over";
      if (topPropsOu === "UNDER") return item.side === "under";
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (topPropsSortBy === "EDGE") return b.edge - a.edge;
      const gradeDiff = gradeSortRank(b.grade) - gradeSortRank(a.grade);
      if (gradeDiff !== 0) return gradeDiff;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return b.edge - a.edge;
    });
  }, [topProps, topPropsGameFilter, topPropsOu, topPropsSortBy]);

  const topPropsPageCount = useMemo(
    () => Math.max(1, Math.ceil(topPropsDisplay.length / TOP_PROPS_PAGE_SIZE)),
    [topPropsDisplay.length],
  );

  useEffect(() => {
    setTopPropsPage(1);
  }, [topPropsGameFilter, topPropsOu, topPropsSortBy]);

  useEffect(() => {
    if (topPropsPage > topPropsPageCount) setTopPropsPage(topPropsPageCount);
  }, [topPropsPage, topPropsPageCount]);

  const topPropsPagedDisplay = useMemo(() => {
    const start = (topPropsPage - 1) * TOP_PROPS_PAGE_SIZE;
    return topPropsDisplay.slice(start, start + TOP_PROPS_PAGE_SIZE);
  }, [topPropsDisplay, topPropsPage]);

  // Hit Rate: top 8 props by score, with hit rate derived from grade
  const hitRateProps = useMemo(() => {
    const gradeToHitRate: Record<string, number> = {
      "A+": 87, A: 79, "B+": 73, B: 66, "C+": 60, C: 54,
    };
    return [...topPropsDisplay]
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 8)
      .map((p) => ({
        ...p,
        hitRate: gradeToHitRate[p.grade] ?? 55,
      }));
  }, [topPropsDisplay]);

  // Leaderboard entries for current tab
  const leaderboardEntries = useMemo(() => {
    if (!leaderboard) return [];
    if (leaderboardTab === "PTS") return leaderboard.topScorers;
    if (leaderboardTab === "REB") return leaderboard.topRebounders;
    return leaderboard.topAssistmen;
  }, [leaderboard, leaderboardTab]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070b] px-4 pb-10 pt-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-44 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-56 -left-44 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),transparent_65%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              NBA Players / Best Props
            </h1>
            <p className="text-sm text-slate-400/90">
              Top opportunites joueurs du jour, avec snapshot quotidien.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTopProps(true)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-200"
          >
            Rafraichir
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {/* ── Top ce soir ── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/50">
                <Trophy className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-100">Top ce soir</p>
                <p className="text-xs text-slate-500">
                  {leaderboard?.playingTeams?.length
                    ? `${leaderboard.playingTeams.length} équipes en jeu`
                    : "Joueurs qui jouent ce soir"}
                </p>
              </div>
            </div>
            <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/25 text-[11px]">
              {(["PTS", "REB", "AST"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLeaderboardTab(tab)}
                  className={cn(
                    "px-3 py-1 transition font-semibold",
                    leaderboardTab === tab
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {leaderboardLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            )}
            {!leaderboardLoading && leaderboardEntries.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-black/20 py-10 text-center text-[12px] text-white/30">
                Aucun match ce soir ou données insuffisantes.
              </div>
            )}
            {leaderboardEntries.map((entry, index) => {
              const rankColors = [
                { num: "text-amber-300", bg: "bg-amber-500/15", ring: "ring-amber-500/30" },
                { num: "text-slate-300", bg: "bg-white/[0.07]", ring: "ring-white/10" },
                { num: "text-amber-700", bg: "bg-amber-900/20", ring: "ring-amber-800/20" },
                { num: "text-white/30", bg: "bg-white/[0.04]", ring: "ring-white/5" },
                { num: "text-white/30", bg: "bg-white/[0.04]", ring: "ring-white/5" },
              ];
              const rank = rankColors[index] ?? rankColors[4];
              const statLabel = leaderboardTab === "PTS" ? "pts" : leaderboardTab === "REB" ? "reb" : "ast";
              const isUp = entry.trend === "up";
              const isDown = entry.trend === "down";
              return (
                <div
                  key={entry.playerId}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3 transition hover:border-white/10 hover:bg-black/35"
                >
                  <span className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black ring-1", rank.bg, rank.ring, rank.num)}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-slate-100">{entry.playerName}</p>
                      {entry.position && (
                        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/40">
                          {entry.position}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{entry.teamCode} · {entry.gamesPlayed} matchs</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {entry.last5Avg !== null && (
                      <div className="hidden flex-col items-end sm:flex">
                        <span className={cn("text-[10px] font-semibold", isUp ? "text-emerald-400" : isDown ? "text-rose-400" : "text-white/30")}>
                          {isUp ? "▲" : isDown ? "▼" : "—"} L5: {formatDecimal(entry.last5Avg, 1)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-0.5">
                      <span className={cn("text-[22px] font-black tabular-nums leading-none", index === 0 ? "text-amber-300" : "text-white/80")}>
                        {formatDecimal(entry.seasonAvg, 1)}
                      </span>
                      <span className="text-[10px] text-white/30">{statLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Hit Rate Leaders ── */}
        {hitRateProps.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
                <Flame className="h-4 w-4 text-rose-300" />
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-100">Hit Rate Leaders</p>
                <p className="text-xs text-slate-500">Props avec le meilleur taux de réussite estimé ce soir</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {hitRateProps.map((prop) => {
                const team = teamMetaByCode.get(String(prop.awayCode ?? "").toUpperCase());
                const sideLabel = prop.side === "over" ? "O" : "U";
                const hitRate = prop.hitRate;
                const hitColor =
                  hitRate >= 80 ? "text-emerald-400" :
                  hitRate >= 70 ? "text-amber-400" :
                  hitRate >= 60 ? "text-orange-400" :
                  "text-white/40";
                const barColor =
                  hitRate >= 80 ? "bg-emerald-500" :
                  hitRate >= 70 ? "bg-amber-500" :
                  hitRate >= 60 ? "bg-orange-500" :
                  "bg-white/20";
                const playerHref = prop.playerId ? `/nba/players/${prop.playerId}` : null;
                return (
                  <div key={prop.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {playerHref ? (
                          <Link href={playerHref} className="text-[13px] font-semibold text-slate-100 hover:text-amber-200">
                            {prop.player}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-semibold text-slate-100">{prop.player}</span>
                        )}
                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] text-slate-400">
                          {String(prop.metric).toUpperCase()} {sideLabel} {formatDecimal(prop.line, 1)}
                        </span>
                        {team?.code && (
                          <span className="text-[10px] text-slate-600">{team.code}</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <div
                            className={cn("h-full rounded-full transition-all", barColor)}
                            style={{ width: `${hitRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={cn("text-[18px] font-black tabular-nums leading-none", hitColor)}>
                        {hitRate}%
                      </span>
                      <span className="text-[9px] text-white/30 uppercase tracking-wide">hit rate</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] text-slate-600">
              * Hit rate estimé à partir du grade Betalyze — basé sur edge, forme récente et matchup.
            </p>
          </section>
        )}

        {/* ── Recherche joueur ── */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/50">
                <Search className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-100">
                  Recherche joueur
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Tape un nom pour ouvrir la fiche joueur.
                </p>
              </div>
            </div>
            {playersLoading && <span className="text-[10px] text-slate-500">Chargement joueurs...</span>}
            {playersError && <span className="text-[10px] text-rose-300">{playersError}</span>}
          </div>

          <div className="mt-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un joueur..."
              className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/60 focus:bg-black/55 focus:outline-none"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {suggestions.map((item) => (
                <Link
                  key={item.id}
                  href={`/nba/players/${item.id}`}
                  className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[12px] transition hover:-translate-y-0.5 hover:border-amber-300/70"
                >
                  <div className="relative z-10 flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10">
                      {
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/images/avatar-player.svg" alt="" className="h-6 w-6 object-contain opacity-85" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-slate-50">
                        {item.firstName && (
                          <span className="font-normal">{item.firstName} </span>
                        )}
                        {item.lastName && (
                          <span className="font-bold tracking-wide">{item.lastName.toUpperCase()}</span>
                        )}
                        {!item.firstName && !item.lastName && item.label}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {item.position && item.position !== "-" && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/[0.06] text-slate-400 ring-1 ring-white/[0.08]">
                            {item.position}
                          </span>
                        )}
                        {item.jerseyNumber && (
                          <span className="text-[11px] text-slate-500">#{item.jerseyNumber}</span>
                        )}
                        <span className="text-white/15">·</span>
                        {item.teamLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.teamLogo} alt={item.teamLabel} className="h-3.5 w-3.5 object-contain opacity-85" />
                        )}
                        <span className="text-[11px] font-semibold text-slate-400">{item.teamLabel}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="relative z-10 h-4 w-4 text-slate-500 transition group-hover:text-amber-200" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/50">
                <Sparkles className="h-4 w-4 text-amber-200" />
              </div>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-100">
                  Best props du jour
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Snapshot quotidien des meilleures opportunites joueurs.
                </p>
                {topPropsGeneratedAt && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    Maj: {new Date(topPropsGeneratedAt).toLocaleString("fr-CA")}
                    {topPropsDate ? ` / Date: ${topPropsDate}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={topPropsGameFilter}
                onChange={(event) => setTopPropsGameFilter(event.target.value)}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-200 outline-none"
              >
                {topPropsGameOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0b0f18] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/25 text-[11px]">
                {(["ALL", "OVER", "UNDER"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTopPropsOu(item)}
                    className={cn(
                      "px-3 py-1 transition",
                      topPropsOu === item
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    {item === "ALL" ? "Tous" : item === "OVER" ? "Over" : "Under"}
                  </button>
                ))}
              </div>
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/25 text-[11px]">
                {(["GRADE", "EDGE"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTopPropsSortBy(item)}
                    className={cn(
                      "px-3 py-1 transition",
                      topPropsSortBy === item
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    )}
                  >
                    {item === "GRADE" ? "Note" : "Edge"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {teamsLoading && <p className="mt-3 text-[10px] text-slate-500">Chargement equipes...</p>}
          {teamsError && <p className="mt-3 text-[10px] text-rose-300">{teamsError}</p>}
          {topPropsError && <p className="mt-3 text-[10px] text-rose-300">{topPropsError}</p>}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topPropsLoading && (
              <p className="col-span-full text-[11px] text-slate-500">Chargement des props...</p>
            )}
            {!topPropsLoading && topPropsDisplay.length === 0 && (
              <div className="col-span-full rounded-xl border border-white/10 bg-black/20 py-16 text-center text-white/50">
                Aucune prop disponible actuellement.
              </div>
            )}

            {topPropsPagedDisplay.map((prop) => {
              const team = teamMetaByCode.get(String(prop.awayCode ?? "").toUpperCase());
              const opp = teamMetaByCode.get(String(prop.homeCode ?? "").toUpperCase());
              const teamLabel =
                team?.code ?? team?.name ?? (prop.awayCode && prop.awayCode !== "—" ? prop.awayCode : "—");
              const oppLabel =
                opp?.code ?? opp?.name ?? (prop.homeCode && prop.homeCode !== "—" ? prop.homeCode : "—");
              const sideLabel = prop.side === "over" ? "O" : "U";
              const primary = getTeamPrimaryColor(team?.code ?? teamLabel);
              const primarySoft = hexToRgba(primary, 0.22);
              const primaryMid = hexToRgba(primary, 0.12);
              const primaryLine = hexToRgba(primary, 0.55);
              const oppPrimary = getTeamPrimaryColor(opp?.code ?? oppLabel);
              const oppChipBg = hexToRgba(oppPrimary, 0.18);
              const oppChipRing = hexToRgba(oppPrimary, 0.28);
              const playerHref = prop.playerId ? `/nba/players/${prop.playerId}` : null;
              return (
                <div
                  key={prop.id}
                  className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition hover:-translate-y-0.5"
                  style={{
                    backgroundImage: `linear-gradient(130deg, ${primarySoft} 0%, ${primaryMid} 42%, rgba(3, 3, 7, 0.85) 100%)`,
                    boxShadow: `inset 0 1px 0 ${primaryLine}`,
                    borderColor: primaryLine,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-20 opacity-50"
                    style={{
                      background: `linear-gradient(90deg, ${hexToRgba(primary, 0.35)} 0%, rgba(0,0,0,0) 100%)`,
                    }}
                  />
                  <div className="relative z-10 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {playerHref ? (
                        <Link href={playerHref} className="truncate text-[13px] font-semibold text-slate-100 hover:text-amber-200">
                          {prop.player}
                        </Link>
                      ) : (
                        <p className="truncate text-[13px] font-semibold text-slate-100">{prop.player}</p>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-white/10">
                        NBA / {teamLabel}
                        {team?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={team.logo} alt={team?.name ?? teamLabel} className="h-4 w-4 object-contain" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300/90">
                      vs {oppLabel} / {String(prop.metric ?? "").toUpperCase()} {sideLabel}{" "}
                      {formatDecimal(prop.line, 1)} @ {formatOddsForDisplay(prop.odds, oddsFormat)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                        Edge {formatEdge(prop.edge)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                        Score {formatDecimal(prop.score, 0)}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-slate-100"
                        style={{ backgroundColor: oppChipBg, borderColor: oppChipRing }}
                      >
                        {opp?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={opp.logo} alt={opp?.name ?? oppLabel} className="h-3.5 w-3.5 object-contain" />
                        )}
                        Opp {oppLabel}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "relative z-10 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition group-hover:scale-105",
                      gradeTone(prop.grade),
                    )}
                  >
                    {prop.grade}
                  </span>
                </div>
              );
            })}
          </div>

          {topPropsDisplay.length > TOP_PROPS_PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                Page {topPropsPage}/{topPropsPageCount} / {topPropsDisplay.length} props
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTopPropsPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white"
                  disabled={topPropsPage <= 1}
                >
                  Precedent
                </button>
                <button
                  type="button"
                  onClick={() => setTopPropsPage((prev) => Math.min(topPropsPageCount, prev + 1))}
                  className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300 transition hover:border-white/20 hover:text-white"
                  disabled={topPropsPage >= topPropsPageCount}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
