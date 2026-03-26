"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
import { NbaHeader } from "@/app/nba/components/nba-header";
import { MobileBottomNav } from "@/app/nba/components/mobile-bottom-nav";
import {
  DEFAULT_DVP_SEASON,
  TOP_PROPS_PAGE_SIZE,
  TEAM_CODE_BY_ID,
  getNbaCdnTeamLogo,
} from "@/lib/nba/constants";
import { DashboardSection } from "@/app/nba/components/dashboard-section";
import { ResultsDrawer } from "@/app/nba/components/results-drawer";
import { BestPropsSection } from "@/app/nba/components/best-props-section";
import { GamesSlateSection } from "@/app/nba/components/games-slate-section";
import { DvpSection } from "@/app/nba/components/dvp-section";
import { TeamsSection } from "@/app/nba/components/teams-section";
import { SplitsSection } from "@/app/nba/components/splits-section";
import {
  parlayLegIdentityKey,
  readParlayDraftLegs,
  upsertParlayDraftLeg,
} from "@/lib/nba/parlay-draft";
import {
  isPlayableSlateStatus,
  formatPlayerName,
  formatDecimal,
  formatTodayLabel,
  torontoYmd,
  inferSeasonForDate,
  formatTeamCode,
  normalizeDvpPositionParam,
  buildGameCard,
  gradeSortRank,
  compareStandingsForRank,
  formatFormStreak,
  safeRatio,
  type OddsDisplayFormat,
} from "@/app/nba/components/nba-helpers";
import type {
  BetalyzeNbaTeam,
  BetalyzeNbaTeamsPayload,
  NbaStandingConference,
  NbaStandingDisplayRow,
  NbaStandingsPayload,
  NbaPlayer,
  PlayersResponse,
  ApiGame,
  GamesApiPayload,
  OddsApiPayload,
  NbaTopProp,
  NbaTopPropsApiPayload,
  NbaJournalApiPayload,
  NbaJournalEntry,
  NbaDvpWindow,
  NbaDvpPosition,
  NbaDvpSortKey,
  NbaDvpRow,
  NbaDvpResponse,
} from "@/app/nba/components/nba-shared-types";
import type { ParlayLegV1 } from "@/types/parlay";

function decimalToAmericanOdds(value: number): number | null {
  if (!Number.isFinite(value) || value <= 1) return null;
  if (value >= 2) return Math.round((value - 1) * 100);
  return Math.round(-100 / (value - 1));
}

export default function NbaPage() {
  return <Suspense><NbaPageInner /></Suspense>;
}

function NbaPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.toString() ?? "";
  const [oddsFormat, setOddsFormat] = useState<OddsDisplayFormat>("decimal");

  // --- Teams & Standings ---
  const [teamsPayload, setTeamsPayload] = useState<BetalyzeNbaTeamsPayload | null>(null);
  const [standingsPayload, setStandingsPayload] = useState<NbaStandingsPayload | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [standingsFilter, setStandingsFilter] = useState<"league" | "east" | "west">("league");

  // --- Players search ---
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<NbaPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  // --- Navigation ---
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSection, setActiveSection] = useState<"dashboard" | "equipes" | "players" | "defense">("dashboard");

  // --- Games & Odds ---
  const [games, setGames] = useState<ApiGame[]>([]);
  const [gamesDate, setGamesDate] = useState<string | null>(null);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [oddsByGameId, setOddsByGameId] = useState<Record<number, OddsApiPayload>>({});
  const [oddsRefreshKey] = useState(0);

  // --- Top Props ---
  const [topProps, setTopProps] = useState<NbaTopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [topPropsLoaded, setTopPropsLoaded] = useState(false);
  const [topPropsGeneratedAt, setTopPropsGeneratedAt] = useState<string | null>(null);
  const [topPropsActionMessage, setTopPropsActionMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const topPropsActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [journalAddingId, setJournalAddingId] = useState<string | null>(null);
  const [journalAddedId, setJournalAddedId] = useState<string | null>(null);
  const [parlayAddedId, setParlayAddedId] = useState<string | null>(null);
  const [parlayDraftKeys, setParlayDraftKeys] = useState<string[]>([]);
  const parlayAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [topPropsOu, setTopPropsOu] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [topPropsSortBy, setTopPropsSortBy] = useState<"GRADE" | "EDGE">("GRADE");
  const [topPropsGameFilter, setTopPropsGameFilter] = useState<string>("ALL");
  const [topPropsPage, setTopPropsPage] = useState(1);
  const skipTopPropsPageResetOnce = useRef(true);
  const isApplyingUrlStateRef = useRef(false);

  // --- Journal (dashboard portfolio/post-mortem) ---
  const [journalEntries, setJournalEntries] = useState<NbaJournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalAuthRequired, setJournalAuthRequired] = useState(false);

  // --- DvP ---
  const [dvpWindow, setDvpWindow] = useState<NbaDvpWindow>("L10");
  const [dvpPosition, setDvpPosition] = useState<NbaDvpPosition>("G");
  const [dvpRows, setDvpRows] = useState<NbaDvpRow[]>([]);
  const [dvpLoading, setDvpLoading] = useState(false);
  const [dvpError, setDvpError] = useState<string | null>(null);
  const [dvpSortKey, setDvpSortKey] = useState<NbaDvpSortKey>("btp");
  const [dvpSortDir, setDvpSortDir] = useState<"asc" | "desc">("asc");
  const [dvpRefreshKey, setDvpRefreshKey] = useState(0);

  // --- URL sync ---
  useEffect(() => {
    const params = new URLSearchParams(searchQuery);
    isApplyingUrlStateRef.current = true;

    const section = String(params.get("section") ?? "").toLowerCase();
    const nextSection =
      section === "defense"
        ? "defense"
        : section === "equipes"
          ? "equipes"
          : section === "players"
            ? "players"
            : "dashboard";
    setActiveSection((prev) => (prev === nextSection ? prev : nextSection));

    const urlPos = normalizeDvpPositionParam(params.get("dvpPosition"));
    const nextPos: NbaDvpPosition = urlPos ?? "G";
    setDvpPosition((prev) => (prev === nextPos ? prev : nextPos));

    const pageRaw = Number(params.get("tpPage") ?? NaN);
    if (Number.isFinite(pageRaw) && pageRaw > 1) {
      const page = Math.max(1, Math.floor(pageRaw));
      setTopPropsPage((prev) => (prev === page ? prev : page));
    } else {
      setTopPropsPage((prev) => (prev === 1 ? prev : 1));
    }

    const timer = window.setTimeout(() => {
      isApplyingUrlStateRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (isApplyingUrlStateRef.current) return;
    const params = new URLSearchParams(searchQuery);

    if (activeSection === "dashboard") params.delete("section");
    else params.set("section", activeSection);

    if (dvpPosition === "G") params.delete("dvpPosition");
    else params.set("dvpPosition", dvpPosition);

    if (topPropsPage <= 1) params.delete("tpPage");
    else params.set("tpPage", String(topPropsPage));

    const nextQuery = params.toString();
    const currentQuery = searchQuery;
    if (nextQuery === currentQuery) return;

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [activeSection, dvpPosition, topPropsPage, pathname, router, searchQuery]);

  useEffect(() => {
    return () => {
      if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
      if (parlayAddedTimer.current) clearTimeout(parlayAddedTimer.current);
    };
  }, []);

  const topPropParlayKey = useCallback((prop: NbaTopProp) => {
    const gameId =
      Number.isFinite(Number(prop.gameId ?? NaN)) && Number(prop.gameId) > 0
        ? Number(prop.gameId)
        : null;
    return parlayLegIdentityKey({
      gameId,
      player: String(prop.player ?? ""),
      market: String(prop.metric ?? ""),
      side: prop.side,
      line: Number(prop.line),
    });
  }, []);

  const syncParlayDraftKeys = useCallback(() => {
    const keys = readParlayDraftLegs().map((leg) => parlayLegIdentityKey(leg));
    setParlayDraftKeys(Array.from(new Set(keys)));
  }, []);

  useEffect(() => {
    syncParlayDraftKeys();
    const onFocus = () => syncParlayDraftKeys();
    const onStorage = () => syncParlayDraftKeys();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncParlayDraftKeys]);

  const isTopPropInParlay = useCallback(
    (prop: NbaTopProp) => parlayDraftKeys.includes(topPropParlayKey(prop)),
    [parlayDraftKeys, topPropParlayKey],
  );

  // --- Load teams ---
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/nba/teams");
        if (!res.ok) throw new Error("Failed to fetch NBA teams");
        const data: BetalyzeNbaTeamsPayload = await res.json();
        setTeamsPayload(data);
      } catch (err) {
        console.error("Failed to load NBA teams", err);
      }
    };
    load();
  }, []);

  // --- Load user settings (odds format) ---
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
        // keep default format
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Load standings ---
  useEffect(() => {
    const load = async () => {
      try {
        setStandingsLoading(true);
        setStandingsError(null);
        const fetchStandings = async (refresh: boolean) => {
          const url = refresh ? "/api/nba/standings?refresh=1" : "/api/nba/standings";
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error("Failed to fetch NBA standings");
          return (await res.json()) as NbaStandingsPayload;
        };
        const hasExtendedMetrics = (payload: NbaStandingsPayload) => {
          const rows = Array.isArray(payload?.standings) ? payload.standings : [];
          return rows.some((row) =>
            Number.isFinite(Number(row.reboundsPerGame ?? NaN)) ||
            Number.isFinite(Number(row.assistsPerGame ?? NaN)) ||
            Number.isFinite(Number(row.threesMadePerGame ?? NaN)) ||
            Number.isFinite(Number(row.fgPct ?? NaN)) ||
            Number.isFinite(Number(row.ftPct ?? NaN)),
          );
        };

        let data = await fetchStandings(false);
        if (!hasExtendedMetrics(data)) {
          data = await fetchStandings(true);
        }
        setStandingsPayload(data);
      } catch (err) {
        setStandingsError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setStandingsLoading(false);
      }
    };
    load();
  }, []);

  // --- Load games ---
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setGamesLoading(true);
        setGamesError(null);
        const fetchByDate = async (dateParam: string): Promise<ApiGame[]> => {
          const inferredSeason = inferSeasonForDate(dateParam);
          const params = new URLSearchParams({ date: dateParam, league: "12", timezone: "America/Toronto" });
          if (inferredSeason) params.set("season", inferredSeason);
          const res = await fetch(`/api/nba/games?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to fetch NBA games");
          const data = (await res.json()) as GamesApiPayload;
          const raw = Array.isArray(data.response) ? data.response : [];
          return raw.filter((g) => g.league?.id === 12 || !g.league);
        };

        const todayDate = torontoYmd(0);
        const tomorrowDate = torontoYmd(1);
        const todayGames = await fetchByDate(todayDate);
        if (todayGames.length > 0) {
          setGames(todayGames); setGamesDate(todayDate); return;
        }
        const tomorrowGames = await fetchByDate(tomorrowDate);
        if (tomorrowGames.length > 0) {
          setGames(tomorrowGames); setGamesDate(tomorrowDate); return;
        }
        setGames([]); setGamesDate(todayDate);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGamesError(err instanceof Error ? err.message : "Unknown error");
        setGames([]); setGamesDate(null);
      } finally {
        setGamesLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  // --- Load odds ---
  useEffect(() => {
    if (!games.length) return;
    const controller = new AbortController();
    const load = async () => {
      const gameMap = new Map<number, { id: number; homeName: string; awayName: string }>();
      games.forEach((g) => {
        const id = Number(g.id ?? NaN);
        if (!Number.isFinite(id) || gameMap.has(id)) return;
        gameMap.set(id, {
          id,
          homeName: String(g.teams?.home?.name ?? "").trim(),
          awayName: String(g.teams?.away?.name ?? "").trim(),
        });
      });
      const targets = Array.from(gameMap.values());
      if (!targets.length) return;
      const entries = await Promise.all(
        targets.map(async (target) => {
          try {
            const params = new URLSearchParams({ game: String(target.id) });
            if (target.homeName) params.set("home", target.homeName);
            if (target.awayName) params.set("away", target.awayName);
            params.set("cacheOnly", "1");
            if (oddsRefreshKey > 0) params.set("refresh", "1");
            const res = await fetch(`/api/nba/odds?${params.toString()}`, {
              signal: controller.signal, cache: "no-store",
            });
            if (!res.ok) return null;
            const data = (await res.json()) as OddsApiPayload;
            return data.ok ? data : null;
          } catch { return null; }
        }),
      );
      const next: Record<number, OddsApiPayload> = {};
      for (const entry of entries) { if (entry?.game) next[entry.game] = entry; }
      setOddsByGameId(next);
    };
    load();
    return () => controller.abort();
  }, [games, oddsRefreshKey]);

  // --- Load DvP ---
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setDvpLoading(true);
        setDvpError(null);
        const fetchDvpRows = async (forceRefresh: boolean) => {
          const params = new URLSearchParams({
            season: DEFAULT_DVP_SEASON,
            window: dvpWindow,
            position: dvpPosition,
            context: "all",
          });
          if (dvpRefreshKey > 0 || forceRefresh) params.set("refresh", "1");
          const res = await fetch(`/api/nba/defense/dvp?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error("Failed to fetch NBA DvP");
          const data = (await res.json()) as NbaDvpResponse;
          return Array.isArray(data.rows) ? data.rows : [];
        };

        let rows = await fetchDvpRows(false);
        if (rows.length === 0 && dvpRefreshKey === 0) {
          rows = await fetchDvpRows(true);
        }
        setDvpRows(rows);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDvpRows([]);
        setDvpError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!controller.signal.aborted) setDvpLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [dvpWindow, dvpPosition, dvpRefreshKey]);

  // --- Player autosuggest ---
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setPlayers([]); setPlayersError(null); setPlayersLoading(false); return;
    }
    const controller = new AbortController();
    const doFetch = async () => {
      try {
        setPlayersLoading(true); setPlayersError(null);
        const params = new URLSearchParams({ search: query });
        const res = await fetch(`/api/nba/players?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch players");
        const data: PlayersResponse = await res.json();
        const seen = new Set<number>();
        const unique = data.players.filter((p) => {
          const id = Number(p.id);
          if (!Number.isFinite(id) || seen.has(id)) return false;
          seen.add(id); return true;
        });
        setPlayers(unique.slice(0, 15));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlayersError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setPlayersLoading(false);
      }
    };
    const timeout = setTimeout(doFetch, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [search]);

  // --- Computed values ---
  const hasPlayableGames = useMemo(
    () => games.some((g) => isPlayableSlateStatus(g.status?.short ?? null)),
    [games],
  );

  const gameCards = useMemo(
    () =>
      games
        .map((g) => buildGameCard(g, g.id ? oddsByGameId[g.id] ?? null : null))
        .filter((g): g is NonNullable<typeof g> => Boolean(g)),
    [games, oddsByGameId],
  );
  const playableGameCards = useMemo(
    () => gameCards.filter((g) => isPlayableSlateStatus(g.statusShort)),
    [gameCards],
  );
  const gameTimeById = useMemo(() => {
    const map = new Map<number, string>();
    for (const g of gameCards) {
      const id = Number(g.id ?? NaN);
      if (!Number.isFinite(id)) continue;
      const time = String(g.time ?? "").trim();
      if (!time) continue;
      map.set(id, time);
    }
    return map;
  }, [gameCards]);
  const todayMeta = useMemo(() => ({
    dateLabel: gamesDate
      ? formatTodayLabel(new Date(`${gamesDate}T12:00:00`))
      : formatTodayLabel(new Date()),
    gamesCount: gameCards.length,
  }), [gameCards.length, gamesDate]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    const teamMatches = teamsPayload?.teams.filter((t) => {
      const full = (t.fullName ?? "").toLowerCase();
      const name = (t.name ?? "").toLowerCase();
      const code = (t.code ?? "").toLowerCase();
      return full.includes(q) || name.includes(q) || (code && code.includes(q));
    }) ?? [];
    const teamById = new Map(teamsPayload?.teams.map((t) => [t.id, t]) ?? []);
    const teamByCode = new Map(
      (teamsPayload?.teams ?? [])
        .map((t) => [String(t.code ?? "").trim().toUpperCase(), t] as const)
        .filter(([code]) => Boolean(code)),
    );
    const playerItems = players.map((p) => {
      // Priorité : teamCode vient directement du DB, fallback sur la constante locale
      const code = p.teamCode ?? (p.teamId ? TEAM_CODE_BY_ID[p.teamId] ?? null : null);
      const teamLogoFromCode = code ? getNbaCdnTeamLogo(code) : null;
      const teamLogoFromPayloadByCode = code ? (teamByCode.get(String(code).toUpperCase())?.logo ?? null) : null;
      const teamLogoFromPayloadById = p.teamId ? (teamById.get(p.teamId)?.logo ?? null) : null;
      return {
        type: "player" as const, id: p.id,
        label: formatPlayerName(p),
        firstName: p.firstName ?? null,
        lastName: p.lastName ?? null,
        position: p.position ?? null,
        jerseyNumber: p.jerseyNumber ?? null,
        meta: `${p.position ?? "Position inconnue"}${p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""}`,
        href: `/nba/players/${p.id}`,
        teamCode: code,
        teamLogo: teamLogoFromCode ?? teamLogoFromPayloadByCode ?? teamLogoFromPayloadById,
      };
    });
    const teamItems = teamMatches.map((t) => ({
      type: "team" as const, id: t.id, label: t.fullName,
      meta: `${t.conference} Conf`, href: `/nba/teams/${t.id}/preview`, logo: t.logo,
      teamCode: t.code ?? null,
      teamLogo: t.logo,
    }));
    return [...playerItems, ...teamItems];
  }, [players, search, teamsPayload]);

  // --- Top Props ---
  const loadTopProps = useCallback(async (refresh: boolean) => {
    try {
      setTopPropsLoading(true); setTopPropsError(null);
      let syncedEventsCount: number | null = null;
      if (refresh) {
        const syncUrl = new URL("/api/nba/odds/sync-daily", window.location.origin);
        syncUrl.searchParams.set("refresh", "1");
        syncUrl.searchParams.set("skipTopProps", "1");
        syncUrl.searchParams.set("skipLogs", "1");
        const syncRes = await fetch(syncUrl.toString(), { cache: "no-store" });
        const syncJson = (await syncRes.json().catch(() => null)) as
          | { ok?: boolean; events?: number; error?: string; message?: string }
          | null;
        if (!syncRes.ok || syncJson?.ok === false) {
          throw new Error(
            syncJson?.error ??
              syncJson?.message ??
              `Failed to sync daily odds (${syncRes.status})`,
          );
        }
        const parsedEvents = Number(syncJson?.events ?? NaN);
        syncedEventsCount = Number.isFinite(parsedEvents) ? parsedEvents : null;
      }
      const url = new URL("/api/nba/props/top", window.location.origin);
      if (refresh) url.searchParams.set("refresh", "1");
      if (gamesDate) url.searchParams.set("date", gamesDate);
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
      setTopPropsLoaded(true);
      if (refresh) {
        if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
        const details =
          syncedEventsCount !== null
            ? `${normalized.length} props mises a jour (${syncedEventsCount} matchs sync).`
            : `${normalized.length} props mises a jour.`;
        setTopPropsActionMessage({ text: details, error: false });
        topPropsActionTimer.current = setTimeout(() => {
          setTopPropsActionMessage(null);
        }, 3500);
      }
    } catch (err) {
      setTopProps([]);
      setTopPropsGeneratedAt(null);
      setTopPropsLoaded(true);
      const message = err instanceof Error ? err.message : "Unknown error";
      setTopPropsError(message);
      if (refresh) {
        if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
        setTopPropsActionMessage({ text: message, error: true });
        topPropsActionTimer.current = setTimeout(() => {
          setTopPropsActionMessage(null);
        }, 3500);
      }
    } finally {
      setTopPropsLoading(false);
    }
  }, [gamesDate]);

  const addTopPropToJournal = useCallback(
    async (prop: NbaTopProp, teamLabel: string, oppLabel: string) => {
      if (journalAddingId) return;
      setJournalAddingId(prop.id);
      setTopPropsActionMessage(null);
      try {
        const propLabel = `${prop.metric} ${prop.side === "over" ? "O" : "U"} ${formatDecimal(prop.line, 1)}`;
        const payload = {
          league: "NBA",
          player: prop.player,
          team: teamLabel,
          opp: oppLabel,
          prop: propLabel,
          side: prop.side,
          odds: Number.isFinite(Number(prop.odds)) ? Number(prop.odds) : null,
          tag: oppLabel ? `Opp ${oppLabel}` : null,
          edgePct: Number.isFinite(Number(prop.edge)) ? Number(prop.edge) : null,
          score: Number.isFinite(Number(prop.score)) ? Number(prop.score) : null,
          grade: prop.grade ?? null,
          result: "V",
          stakePct: 0.5,
          tone: prop.side === "over" ? "green" : "red",
          bookmaker: prop.bookmaker ?? null,
          eventDate: gamesDate ?? null,
          note: "Ajoute depuis Top opportunites NBA",
        };

        const res = await fetch("/api/nba/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Impossible d'ajouter la prop au journal");
        }

        setJournalAddedId(prop.id);
        setTopPropsActionMessage({ text: "Prop ajoutee au Bet Journal.", error: false });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Impossible d'ajouter la prop au journal";
        setTopPropsActionMessage({ text: message, error: true });
      } finally {
        setJournalAddingId(null);
        if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
        topPropsActionTimer.current = setTimeout(() => {
          setTopPropsActionMessage(null);
          setJournalAddedId(null);
        }, 2500);
      }
    },
    [gamesDate, journalAddingId],
  );

  const addTopPropToParlay = useCallback(
    (prop: NbaTopProp) => {
      const odds = Number(prop.odds ?? NaN);
      const line = Number(prop.line ?? NaN);
      if (!Number.isFinite(odds) || odds <= 1 || !Number.isFinite(line)) {
        setTopPropsActionMessage({ text: "Odds/line invalide pour ce leg.", error: true });
        return;
      }
      const gameId =
        Number.isFinite(Number(prop.gameId ?? NaN)) && Number(prop.gameId) > 0
          ? Number(prop.gameId)
          : null;
      const leg: ParlayLegV1 = {
        legId: [
          "nba",
          gameId ?? "na",
          String(prop.player ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          String(prop.metric ?? "").toLowerCase().replace(/[^a-z0-9+]+/g, "-"),
          prop.side,
          line,
          String(prop.bookmaker ?? "book").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ].join(":"),
        sport: "NBA",
        gameId,
        eventDate: gamesDate ?? null,
        playerId:
          Number.isFinite(Number(prop.playerId ?? NaN)) && Number(prop.playerId) > 0
            ? Number(prop.playerId)
            : null,
        player: String(prop.player ?? "Player"),
        market: String(prop.metric ?? "PTS").toUpperCase(),
        side: prop.side === "under" ? "under" : "over",
        line,
        oddsDecimal: odds,
        oddsAmerican: decimalToAmericanOdds(odds),
        teamCode: String(prop.awayCode ?? "").trim().toUpperCase() || null,
        opponentCode: String(prop.homeCode ?? "").trim().toUpperCase() || null,
        bookmakerKey: String(prop.bookmaker ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || null,
        bookmakerName: prop.bookmaker ?? null,
        source: "top_props",
      };

      const upsert = upsertParlayDraftLeg(leg);
      syncParlayDraftKeys();
      if (!upsert.added) {
        setTopPropsActionMessage({ text: "Leg deja present dans le Parlay Builder.", error: false });
        if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
        topPropsActionTimer.current = setTimeout(() => {
          setTopPropsActionMessage(null);
        }, 2500);
        router.push("/nba/parlay");
        return;
      }
      setParlayAddedId(prop.id);
      setTopPropsActionMessage({ text: "Leg ajoute au Parlay Builder.", error: false });
      if (parlayAddedTimer.current) clearTimeout(parlayAddedTimer.current);
      parlayAddedTimer.current = setTimeout(() => {
        setParlayAddedId(null);
      }, 1600);
      if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
      topPropsActionTimer.current = setTimeout(() => {
        setTopPropsActionMessage(null);
      }, 2500);
      const encodedLeg = encodeURIComponent(JSON.stringify(leg));
      router.push(`/nba/parlay?add=${encodedLeg}`);
    },
    [gamesDate, router, syncParlayDraftKeys],
  );

  const loadJournal = useCallback(async (refresh: boolean) => {
    try {
      setJournalLoading(true);
      if (refresh) setJournalError(null);
      const url = new URL("/api/nba/journal", window.location.origin);
      url.searchParams.set("limit", "240");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.status === 401) {
        setJournalEntries([]);
        setJournalAuthRequired(true);
        setJournalLoaded(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch journal");
      const data = (await res.json()) as NbaJournalApiPayload;
      if (!data.ok) throw new Error(data.error ?? "Failed to fetch journal");
      setJournalEntries(Array.isArray(data.entries) ? data.entries : []);
      setJournalAuthRequired(false);
      setJournalError(null);
      setJournalLoaded(true);
    } catch (err) {
      setJournalEntries([]);
      setJournalAuthRequired(false);
      setJournalError(err instanceof Error ? err.message : "Unknown error");
      setJournalLoaded(true);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((activeSection !== "dashboard" && activeSection !== "players") || topPropsLoaded || topPropsLoading) return;
    loadTopProps(false);
  }, [activeSection, topPropsLoaded, topPropsLoading, loadTopProps]);

  useEffect(() => {
    setTopProps([]); setTopPropsError(null); setTopPropsLoaded(false);
    setTopPropsGeneratedAt(null);
  }, [gamesDate]);

  useEffect(() => {
    if ((activeSection !== "dashboard" && activeSection !== "players") || journalLoaded || journalLoading) return;
    loadJournal(false);
  }, [activeSection, journalLoaded, journalLoading, loadJournal]);

  const refreshDashboard = useCallback(() => {
    void loadTopProps(true);
    void loadJournal(true);
  }, [loadTopProps, loadJournal]);

  const topPropsGameOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [
      { value: "ALL", label: "Tous les games" },
    ];
    const seen = new Set<string>();

    for (const g of playableGameCards) {
      const key = String(g.id);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ value: key, label: `${g.away} vs ${g.home}` });
    }

    if (options.length === 1) {
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
    }

    return options;
  }, [playableGameCards, topProps]);

  useEffect(() => {
    if (topPropsGameFilter === "ALL") return;
    const exists = topPropsGameOptions.some((option) => option.value === topPropsGameFilter);
    if (!exists) setTopPropsGameFilter("ALL");
  }, [topPropsGameFilter, topPropsGameOptions]);

  const finishedGameIds = useMemo(() => {
    const finished = new Set(["FT", "AOT", "AET", "AWD", "WO", "ABD"]);
    const ids = new Set<number>();
    for (const g of games) {
      const id = Number(g.id ?? NaN);
      if (!Number.isFinite(id)) continue;
      const status = String(g.status?.short ?? "").toUpperCase();
      if (finished.has(status)) ids.add(id);
    }
    return ids;
  }, [games]);

  const topPropsDisplay = useMemo(() => {
    const selectedGameId = topPropsGameFilter === "ALL" ? NaN : Number(topPropsGameFilter);
    const hasGameFilter = Number.isFinite(selectedGameId) && selectedGameId > 0;
    const filtered = topProps.filter((item) => {
      const gameId = Number(item.gameId ?? NaN);
      if (Number.isFinite(gameId) && finishedGameIds.has(gameId)) return false;
      if (hasGameFilter && gameId !== selectedGameId) return false;
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
  }, [topProps, topPropsGameFilter, topPropsOu, topPropsSortBy, finishedGameIds]);

  const topPropsPageCount = useMemo(
    () => Math.max(1, Math.ceil(topPropsDisplay.length / TOP_PROPS_PAGE_SIZE)),
    [topPropsDisplay.length],
  );

  useEffect(() => {
    if (skipTopPropsPageResetOnce.current) {
      skipTopPropsPageResetOnce.current = false;
      return;
    }
    setTopPropsPage(1);
  }, [topPropsGameFilter, topPropsOu, topPropsSortBy]);

  useEffect(() => {
    if (topPropsPage <= topPropsPageCount) return;
    setTopPropsPage(topPropsPageCount);
  }, [topPropsPage, topPropsPageCount]);

  const topPropsPagedDisplay = useMemo(() => {
    const start = (topPropsPage - 1) * TOP_PROPS_PAGE_SIZE;
    return topPropsDisplay.slice(start, start + TOP_PROPS_PAGE_SIZE);
  }, [topPropsDisplay, topPropsPage]);

  // --- Standings display ---
  const standingsDisplay = useMemo(() => {
    const rows = standingsPayload?.standings ?? [];
    const base: NbaStandingDisplayRow[] = rows.map((row) => {
      const g = Number.isFinite(row.games) && row.games > 0 ? row.games : 0;
      const pfPerGame = g > 0 ? row.pointsFor / g : 0;
      const paPerGame = g > 0 ? row.pointsAgainst / g : 0;
      return {
        ...row, leagueRank: 0, conferenceRank: null,
        formStreak: formatFormStreak(row.form),
        pfPerGame, paPerGame, diffPerGame: pfPerGame - paPerGame,
      };
    });

    const rankedLeague = [...base]
      .sort(compareStandingsForRank)
      .map((row, index) => ({ ...row, leagueRank: index + 1 }));

    const confCounters = new Map<NbaStandingConference, number>();
    const withConferenceRank = rankedLeague.map((row) => {
      if (row.conference !== "East" && row.conference !== "West") return row;
      const nextRank = (confCounters.get(row.conference) ?? 0) + 1;
      confCounters.set(row.conference, nextRank);
      return { ...row, conferenceRank: nextRank };
    });

    return {
      league: withConferenceRank,
      east: withConferenceRank.filter((row) => row.conference === "East"),
      west: withConferenceRank.filter((row) => row.conference === "West"),
    };
  }, [standingsPayload]);

  const standingsFilteredRows = useMemo(() => {
    if (standingsFilter === "east") return standingsDisplay.east;
    if (standingsFilter === "west") return standingsDisplay.west;
    return standingsDisplay.league;
  }, [standingsDisplay, standingsFilter]);

  // --- DvP helpers ---
  const dvpTeamsById = useMemo(() => {
    const map = new Map<number, BetalyzeNbaTeam>();
    (teamsPayload?.teams ?? []).forEach((team) => map.set(team.id, team));
    return map;
  }, [teamsPayload]);
  const teamMetaByCode = useMemo(() => {
    const map = new Map<string, BetalyzeNbaTeam>();
    (teamsPayload?.teams ?? []).forEach((team) => {
      const code = String(team.code ?? "").trim().toUpperCase();
      if (!code) return;
      map.set(code, team);
    });
    return map;
  }, [teamsPayload]);

  const dvpColumns = useMemo(
    () =>
      [
        { key: "pra", label: "PRA", percent: false },
        { key: "points", label: "PTS", percent: false },
        { key: "rebounds", label: "REB", percent: false },
        { key: "assists", label: "AST", percent: false },
        { key: "threePointsMade", label: "3PT", percent: false },
        { key: "minutes", label: "MIN", percent: false },
        { key: "fgPct", label: "FG%", percent: true },
        { key: "ftPct", label: "FT%", percent: true },
      ] as Array<{ key: NbaDvpSortKey; label: string; percent: boolean }>,
    [],
  );

  const resolveDvpValue = (row: NbaDvpRow, key: NbaDvpSortKey): number | null => {
    if (key === "btp") return row.btpPerGame;
    if (key === "games") return row.games;
    const perGame = row.metrics?.perGame;
    if (!perGame) return null;
    if (key === "fgPct") {
      const v = safeRatio(perGame.fieldGoalsMade, perGame.fieldGoalsAttempted);
      return v === null ? null : v * 100;
    }
    if (key === "ftPct") {
      const v = safeRatio(perGame.freeThrowsMade, perGame.freeThrowsAttempted);
      return v === null ? null : v * 100;
    }
    if (key === "points") return perGame.points ?? null;
    if (key === "rebounds") return perGame.rebounds ?? null;
    if (key === "assists") return perGame.assists ?? null;
    if (key === "pra") {
      const pts = Number(perGame.points ?? NaN);
      const reb = Number(perGame.rebounds ?? NaN);
      const ast = Number(perGame.assists ?? NaN);
      if (!Number.isFinite(pts) || !Number.isFinite(reb) || !Number.isFinite(ast)) return null;
      return pts + reb + ast;
    }
    if (key === "threePointsMade") return perGame.threePointsMade ?? null;
    if (key === "minutes") return perGame.minutes ?? null;
    return null;
  };

  const dvpSorted = useMemo(() => {
    const nbaOnlyRows = dvpRows.filter((row) => {
      const teamId = Number(row.teamId ?? NaN);
      return Number.isFinite(teamId) && teamId > 0;
    });
    const rankSourceKey: NbaDvpSortKey = dvpSortKey === "games" ? "btp" : dvpSortKey;
    const rankByTeam = new Map<number, number>();
    [...nbaOnlyRows]
      .map((row) => ({ teamId: Number(row.teamId), value: resolveDvpValue(row, rankSourceKey) }))
      .filter((item) => Number.isFinite(item.value ?? NaN))
      .sort((a, b) => Number(a.value) - Number(b.value))
      .forEach((item, idx) => { rankByTeam.set(item.teamId, idx + 1); });

    return nbaOnlyRows
      .map((row) => ({ ...row, rank: rankByTeam.get(Number(row.teamId)) ?? row.rank }))
      .map((row, idx) => ({ row, idx, value: resolveDvpValue(row, dvpSortKey) }))
      .sort((a, b) => {
        const av = Number.isFinite(a.value ?? NaN) ? Number(a.value) : null;
        const bv = Number.isFinite(b.value ?? NaN) ? Number(b.value) : null;
        if (av === null && bv === null) return a.idx - b.idx;
        if (av === null) return 1;
        if (bv === null) return -1;
        if (av === bv) return (a.row.rank ?? 999) - (b.row.rank ?? 999);
        return dvpSortDir === "asc" ? av - bv : bv - av;
      })
      .map((item) => item.row);
  }, [dvpRows, dvpSortKey, dvpSortDir]);

  const applyDvpSort = (key: NbaDvpSortKey) => {
    if (dvpSortKey === key) { setDvpSortDir(dvpSortDir === "asc" ? "desc" : "asc"); return; }
    setDvpSortKey(key); setDvpSortDir("asc");
  };
  const sortIndicator = (key: NbaDvpSortKey) => dvpSortKey !== key ? "" : dvpSortDir === "asc" ? "^" : "v";
  const tierForRank = (rank?: number | null) => {
    if (!rank) return { label: "—", tone: "text-slate-400 bg-white/5" };
    if (rank <= 5) return { label: "Elite", tone: "text-emerald-200 bg-emerald-500/15" };
    if (rank <= 12) return { label: "Solid", tone: "text-sky-200 bg-sky-500/15" };
    if (rank <= 20) return { label: "Average", tone: "text-slate-200 bg-white/10" };
    if (rank <= 28) return { label: "Weak", tone: "text-amber-200 bg-amber-500/15" };
    return { label: "Soft", tone: "text-rose-200 bg-rose-500/15" };
  };

  // --- Sidebar ---
  const handleComingSoon = (sport: string) => {
    setComingSoon(`${sport} arrive bientôt sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  const sidebarActive: NbaSidebarPage =
    activeSection === "defense"
      ? "DvP"
      : activeSection === "equipes"
        ? "Teams"
        : activeSection === "players"
          ? "Players"
          : "Best Props";

  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Bet Journal") { router.push("/nba/journal"); return; }
    if (page === "Parlay") { router.push("/nba/parlay"); return; }
    if (page === "Settings") { router.push("/nba/settings"); return; }
    if (page === "Billing") { router.push("/nba/billing"); return; }
    if (page === "Players") { setActiveSection("players"); return; }
    if (page === "DvP") { setActiveSection("defense"); return; }
    if (page === "Teams") { setActiveSection("equipes"); return; }
    if (page === "Best Props") { setActiveSection("dashboard"); return; }
    handleComingSoon(page);
  };

  // --- Render ---
  return (
    <div className="min-h-screen text-white md:h-screen md:overflow-hidden md:p-3" style={{ background: "#07070b" }}>

      {/* ── App card — arrondie sur desktop ── */}
      <div
        className="relative flex min-h-screen flex-col md:min-h-0 md:h-full md:flex-row md:rounded-2xl md:overflow-hidden"
        style={{ background: "#0d0d0f" }}
      >
        {/* Gradients (absolute, clippés par overflow-hidden) */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(700px 500px at 80% -5%, rgba(255,138,0,.14) 0%, transparent 60%), radial-gradient(600px 400px at 15% 50%, rgba(25,199,195,.07) 0%, transparent 60%)" }} />

      {/* ── Sidebar ── */}
      <NbaSidebar active={sidebarActive} onSelect={setSidebarActive} />

      {/* ── Colonne principale ── */}
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">

        <NbaHeader
          search={search}
          setSearch={setSearch}
          suggestions={suggestions}
          playersLoading={playersLoading}
          playersError={playersError}
        />

        <div className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:overflow-y-auto md:pb-6">
          {comingSoon && (
            <div className="mb-3 flex justify-end text-[11px] text-amber-200">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                {comingSoon}
              </span>
            </div>
          )}


          <main className="space-y-6">

            {activeSection === "dashboard" && (
              <DashboardSection
                gamesCount={gameCards.length}
                playableGamesCount={playableGameCards.length}
                topProps={topProps}
                topPropsLoading={topPropsLoading}
                topPropsError={topPropsError}
                topPropsGeneratedAt={topPropsGeneratedAt}
                journalEntries={journalEntries}
                journalLoading={journalLoading}
                journalError={journalError}
                journalAuthRequired={journalAuthRequired}
                onOpenPlayers={() => setActiveSection("players")}
                oddsFormat={oddsFormat}
              />
            )}

            {activeSection === "players" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Players</h1>
                  <p className="mt-0.5 text-[13px] text-white/40">Stats & matchups · NBA</p>
                </div>
                <ResultsDrawer oddsFormat={oddsFormat} />
              </div>
            )}

            {activeSection === "players" && (
              <BestPropsSection
                topPropsPagedDisplay={topPropsPagedDisplay}
                topPropsDisplay={topPropsDisplay}
                topPropsLoading={topPropsLoading}
                topPropsError={topPropsError}
                topPropsActionMessage={topPropsActionMessage}
                topPropsOu={topPropsOu}
                setTopPropsOu={setTopPropsOu}
                topPropsSortBy={topPropsSortBy}
                setTopPropsSortBy={setTopPropsSortBy}
                topPropsGameFilter={topPropsGameFilter}
                setTopPropsGameFilter={setTopPropsGameFilter}
                topPropsGameOptions={topPropsGameOptions}
                topPropsPage={topPropsPage}
                onPrevPage={() => setTopPropsPage((prev) => Math.max(1, prev - 1))}
                onNextPage={() => setTopPropsPage((prev) => Math.min(topPropsPageCount, prev + 1))}
                topPropsPageCount={topPropsPageCount}
                addTopPropToJournal={addTopPropToJournal}
                addTopPropToParlay={addTopPropToParlay}
                isTopPropInParlay={isTopPropInParlay}
                parlayAddedId={parlayAddedId}
                journalAddingId={journalAddingId}
                journalAddedId={journalAddedId}
                teamMetaByCode={teamMetaByCode}
                gameTimeById={gameTimeById}
                sidebarActive={sidebarActive}
                oddsFormat={oddsFormat}
              />
            )}

            {activeSection === "players" && (
              <SplitsSection />
            )}

            {activeSection !== "defense" && activeSection !== "players" && (
              <GamesSlateSection
                gamesLoading={gamesLoading}
                gamesError={gamesError}
                gameCards={gameCards}
                standingsRows={standingsPayload?.standings ?? []}
                oddsFormat={oddsFormat}
              />
            )}

            {activeSection === "defense" && (
              <DvpSection
                dvpWindow={dvpWindow}
                setDvpWindow={setDvpWindow}
                dvpPosition={dvpPosition}
                setDvpPosition={setDvpPosition}
                dvpSorted={dvpSorted}
                dvpLoading={dvpLoading}
                dvpError={dvpError}
                dvpSortKey={dvpSortKey}
                dvpColumns={dvpColumns}
                applyDvpSort={applyDvpSort}
                sortIndicator={sortIndicator}
                tierForRank={tierForRank}
                dvpTeamsById={dvpTeamsById}
                teamMetaByCode={teamMetaByCode}
                resolveDvpValue={resolveDvpValue}
                onRefresh={() => setDvpRefreshKey((prev) => prev + 1)}
                formatTeamCode={formatTeamCode}
              />
            )}

            {activeSection === "equipes" && (
              <TeamsSection
                standingsFilter={standingsFilter}
                setStandingsFilter={setStandingsFilter}
                standingsFilteredRows={standingsFilteredRows}
                standingsLoading={standingsLoading}
                standingsError={standingsError}
                standingsPayload={standingsPayload}
              />
            )}
          </main>
        </div>
      </div>

      <MobileBottomNav
        activeTab={activeSection}
        onTabChange={(tab) => setActiveSection(tab)}
      />
      </div>
    </div>
  );
}
