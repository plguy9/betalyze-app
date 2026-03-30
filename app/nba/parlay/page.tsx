"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BookOpen,
  Flame,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
import { NbaHeader } from "@/app/nba/components/nba-header";
import { MobileBottomNav } from "@/app/nba/components/mobile-bottom-nav";
import { Card, LeagueTab, TabGroup } from "@/app/nba/components/nba-ui";
import {
  getTeamPrimaryColor,
  hexToRgba,
  formatOddsForDisplay,
  formatGameTimeForUser,
  torontoYmd,
  inferSeasonForDate,
  gradeTone,
  formatEdge,
  formatDecimal,
  type OddsDisplayFormat,
} from "@/app/nba/components/nba-helpers";
import {
  clearParlayDraftLegs,
  parlayLegIdentityKey,
  readParlayDraftLegs,
  upsertParlayDraftLeg,
  writeParlayDraftLegs,
} from "@/lib/nba/parlay-draft";
import { getNbaCdnTeamLogo } from "@/lib/nba/constants";
import type { ParlayLegV1, ParlayQuoteResponseV1, ParlayTicket } from "@/types/parlay";

type RecommendationTag = "SAFE" | "BALANCED" | "AGGRESSIVE" | "LONGSHOT";
type GradeFilter = "ALL" | "S" | "A" | "B" | "C";

type TopProp = {
  id: string;
  playerId?: number | null;
  player: string;
  metric: string;
  side: "over" | "under";
  line: number;
  odds: number;
  gameId?: number | null;
  teamCode?: string | null;
  opponentCode?: string | null;
  bookmaker?: string | null;
  edge?: number;
  grade?: string;
  hitRate?: number;
  hitRateL5?: number;
  hitRateL10?: number;
  hitRateL20?: number;
  seasonHitRate?: number;
  impliedProbability?: number;
  modelEdge?: number;
  dvpScore?: number;
  dvpRank?: number | null;
  dvpTotalTeams?: number | null;
  dvpValue?: number | null;
  dvpMetricFlag?: "weakness" | "strength" | "neutral" | null;
  dvpPosition?: string | null;
  consistencyScore?: number;
  recommendationScore?: number;
  recommendationTag?: RecommendationTag;
  score?: number;
  finalScore?: number;
};

type TopPropsApiPayload = {
  ok?: boolean;
  props?: TopProp[];
  error?: string;
};

const FINISHED_STATUSES = new Set(["FT", "AOT", "AET", "AWD", "WO", "ABD"]);
const LIVE_STATUSES = new Set(["Q1", "Q2", "Q3", "Q4", "HT", "OT", "LIVE", "1Q", "2Q", "3Q", "4Q"]);

// ─── Style configs ────────────────────────────────────────────────────────────

const TAG_STYLES: Record<
  string,
  { badge: string; border: string; bg: string; barColor: string }
> = {
  SAFE: {
    badge: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
    border: "rgba(52,211,153,.30)",
    bg: "rgba(52,211,153,.06)",
    barColor: "#34d399",
  },
  BALANCED: {
    badge: "border-sky-500/35 bg-sky-500/12 text-sky-300",
    border: "rgba(56,189,248,.28)",
    bg: "rgba(56,189,248,.05)",
    barColor: "#38bdf8",
  },
  AGGRESSIVE: {
    badge: "border-amber-500/35 bg-amber-500/12 text-amber-300",
    border: "rgba(251,191,36,.28)",
    bg: "rgba(251,191,36,.05)",
    barColor: "#fbbf24",
  },
  LONGSHOT: {
    badge: "border-rose-500/35 bg-rose-500/12 text-rose-300",
    border: "rgba(248,113,113,.28)",
    bg: "rgba(248,113,113,.05)",
    barColor: "#f87171",
  },
};

const QUALITY_THRESHOLDS = [
  { minHR: 65, label: "Solide", color: "#34d399" },
  { minHR: 55, label: "Équilibré", color: "#38bdf8" },
  { minHR: 45, label: "Risqué", color: "#fbbf24" },
  { minHR: 0, label: "Volatile", color: "#f87171" },
];

const STAKE_PRESETS = ["5", "10", "25", "50", "100"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAmericanOdds(decimal: number): number | null {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

function hitRateColor(rate: number | null | undefined): string {
  if (!Number.isFinite(rate ?? NaN)) return "rgba(255,255,255,.18)";
  const r = Number(rate);
  if (r >= 65) return "#34d399";
  if (r >= 55) return "#38bdf8";
  if (r >= 45) return "#fbbf24";
  return "#f87171";
}

type ConsistencyInfo = { label: string; color: string };
function consistencyInfo(score: number | null | undefined): ConsistencyInfo | null {
  if (!Number.isFinite(score ?? NaN)) return null;
  const s = Number(score);
  if (s >= 5) return { label: "Stable", color: "#34d399" };
  if (s <= -5) return { label: "Volatile", color: "#fb923c" };
  return { label: "Moyen", color: "rgba(255,255,255,.38)" };
}

function buildLegFromTopProp(prop: TopProp): ParlayLegV1 {
  const market = String(prop.metric ?? "PTS").trim().toUpperCase() || "PTS";
  const side = prop.side === "under" ? "under" : "over";
  const line = Number(prop.line);
  const oddsDecimal = Number(prop.odds);
  const gameId =
    prop.gameId !== null && prop.gameId !== undefined && Number.isFinite(Number(prop.gameId))
      ? Math.trunc(Number(prop.gameId))
      : null;
  const legId = [
    "nba",
    gameId ?? "na",
    String(prop.player ?? "player").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    market.toLowerCase(),
    side,
    line,
    String(prop.bookmaker ?? "book").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  ].join(":");

  return {
    legId,
    sport: "NBA",
    gameId,
    eventDate: null,
    playerId: Number.isFinite(Number(prop.playerId ?? NaN)) ? Number(prop.playerId) : null,
    player: String(prop.player ?? "Player"),
    market,
    side,
    line,
    oddsDecimal,
    oddsAmerican: toAmericanOdds(oddsDecimal),
    teamCode: prop.teamCode ? String(prop.teamCode).toUpperCase() : null,
    opponentCode: prop.opponentCode ? String(prop.opponentCode).toUpperCase() : null,
    bookmakerKey: prop.bookmaker
      ? String(prop.bookmaker).toLowerCase().replace(/[^a-z0-9]/g, "")
      : null,
    bookmakerName: prop.bookmaker ? String(prop.bookmaker) : null,
    source: "top_props",
  };
}

function parseQuickAddLeg(raw: string): ParlayLegV1 | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const player = String(parsed.player ?? "").trim();
    const market = String(parsed.market ?? "").trim().toUpperCase();
    const side = String(parsed.side ?? "").trim().toLowerCase();
    const line = Number(parsed.line ?? NaN);
    const oddsDecimal = Number(parsed.oddsDecimal ?? NaN);
    if (!player || !market) return null;
    if (side !== "over" && side !== "under") return null;
    if (!Number.isFinite(line) || !Number.isFinite(oddsDecimal) || oddsDecimal <= 1) return null;
    const gameId = Number(parsed.gameId ?? NaN);
    const playerId = Number(parsed.playerId ?? NaN);
    const oddsAmerican = Number(parsed.oddsAmerican ?? NaN);
    const legId = String(parsed.legId ?? "").trim();
    const normalized: ParlayLegV1 = {
      legId:
        legId ||
        [
          "nba",
          Number.isFinite(gameId) ? Math.trunc(gameId) : "na",
          player.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          market.toLowerCase(),
          side,
          line,
          String(parsed.bookmakerName ?? "book").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        ].join(":"),
      sport: "NBA",
      gameId: Number.isFinite(gameId) ? Math.trunc(gameId) : null,
      eventDate: parsed.eventDate ? String(parsed.eventDate) : null,
      playerId: Number.isFinite(playerId) ? Math.trunc(playerId) : null,
      player,
      market,
      side: side as "over" | "under",
      line,
      oddsDecimal,
      oddsAmerican: Number.isFinite(oddsAmerican) ? Math.trunc(oddsAmerican) : null,
      teamCode: parsed.teamCode ? String(parsed.teamCode).toUpperCase() : null,
      opponentCode: parsed.opponentCode ? String(parsed.opponentCode).toUpperCase() : null,
      bookmakerKey: parsed.bookmakerKey ? String(parsed.bookmakerKey) : null,
      bookmakerName: parsed.bookmakerName ? String(parsed.bookmakerName) : null,
      source: "top_props",
    };
    return normalized;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NbaParlayPage() {
  return <Suspense><NbaParlayPageInner /></Suspense>;
}

function NbaParlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state
  const [oddsFormat, setOddsFormat] = useState<OddsDisplayFormat>("decimal");
  const [userTimezone, setUserTimezone] = useState("America/Toronto");
  const [gameTimeByKey, setGameTimeByKey] = useState<Map<string, string>>(new Map());
  const [gameStatusByKey, setGameStatusByKey] = useState<Map<string, string>>(new Map());
  const [topProps, setTopProps] = useState<TopProp[]>([]);
  const [loadingTopProps, setLoadingTopProps] = useState(true);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [legs, setLegs] = useState<ParlayLegV1[]>([]);
  const [stakeInput, setStakeInput] = useState("10");
  const [quote, setQuote] = useState<ParlayQuoteResponseV1 | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [ticketsCount, setTicketsCount] = useState<number>(0);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Filter state
  const [filterGrade, setFilterGrade] = useState<GradeFilter>("ALL");
  const [filterMetric, setFilterMetric] = useState<string>("ALL");
  const [filterGame, setFilterGame] = useState<string>("ALL");
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // DvP client-side lookup
  const [dvpLookup, setDvpLookup] = useState<
    Map<string, { rank: number; totalTeams: number; value: number; flag: "weakness" | "strength" | "neutral"; position: string }>
  >(new Map());

  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentlyAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sidebarActive: NbaSidebarPage = "Parlay";
  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Parlay") return;
    if (page === "Billing") { router.push("/nba/billing"); return; }
    if (page === "Settings") { router.push("/nba/settings"); return; }
    if (page === "Bet Journal") { router.push("/nba/journal"); return; }
    if (page === "DvP") { router.push("/nba?section=defense#nba-dvp"); return; }
    if (page === "Teams") { router.push("/nba?section=equipes"); return; }
    if (page === "Best Props") { router.push("/nba"); return; }
    if (page === "Players") { router.push("/nba?section=players"); return; }
    setComingSoon(`${page} arrive bientôt sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  useEffect(() => {
    return () => {
      if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
      if (recentlyAddedTimer.current) clearTimeout(recentlyAddedTimer.current);
    };
  }, []);

  // Fetch user settings (odds format + timezone)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/account/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          settings?: { oddsFormat?: string | null; timezone?: string | null };
        };
        if (!data?.ok) return;
        const next: OddsDisplayFormat =
          String(data.settings?.oddsFormat ?? "").toLowerCase() === "american"
            ? "american"
            : "decimal";
        if (!cancelled) setOddsFormat(next);
        const tz = String(data.settings?.timezone ?? "").trim();
        if (!cancelled && tz) setUserTimezone(tz);
      } catch { /* keep default */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Fetch today's games to get start times
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const todayDate = torontoYmd(0);
        const inferredSeason = inferSeasonForDate(todayDate);
        const gamesParams = new URLSearchParams({ date: todayDate, league: "12", timezone: "America/Toronto" });
        if (inferredSeason) gamesParams.set("season", inferredSeason);
        const res = await fetch(`/api/nba/games?${gamesParams.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          response?: Array<{
            id?: number | null;
            date?: string | null;
            status?: { short?: string | null } | null;
            teams?: {
              home?: { code?: string | null };
              away?: { code?: string | null };
            } | null;
          }>;
        };
        if (!Array.isArray(data.response)) return;
        const timeMap = new Map<string, string>();
        const statusMap = new Map<string, string>();
        for (const g of data.response) {
          const home = String(g.teams?.home?.code ?? "").toUpperCase();
          const away = String(g.teams?.away?.code ?? "").toUpperCase();
          if (!home || !away) continue;
          const [a, b] = [home, away].sort();
          const pairKey = `${a}@${b}`;
          if (g.date) timeMap.set(pairKey, g.date);
          const status = String(g.status?.short ?? "").toUpperCase();
          if (status) statusMap.set(pairKey, status);
        }
        if (!cancelled) { setGameTimeByKey(timeMap); setGameStatusByKey(statusMap); }
      } catch { /* ignore */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const refreshTicketsCount = async () => {
    try {
      const res = await fetch("/api/nba/parlay/tickets?limit=200", { cache: "no-store" });
      if (res.status === 401) { setTicketsCount(0); return; }
      const data = (await res.json()) as { ok?: boolean; tickets?: ParlayTicket[] };
      if (!res.ok || !data?.ok) return;
      setTicketsCount(Array.isArray(data.tickets) ? data.tickets.length : 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setLegs(readParlayDraftLegs());
    const onStorage = () => setLegs(readParlayDraftLegs());
    window.addEventListener("storage", onStorage);
    void refreshTicketsCount();
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => { writeParlayDraftLegs(legs); }, [legs]);

  useEffect(() => {
    const raw = searchParams?.get("add");
    if (!raw) return;
    const quickAddLeg = parseQuickAddLeg(raw);
    if (!quickAddLeg) {
      router.replace("/nba/parlay", { scroll: false });
      return;
    }
    setLegs((prev) => {
      const key = parlayLegIdentityKey(quickAddLeg);
      const exists = prev.some((leg) => parlayLegIdentityKey(leg) === key);
      if (exists) return prev;
      if (prev.length >= 10) return prev;
      const next = [...prev, quickAddLeg];
      writeParlayDraftLegs(next);
      return next;
    });
    router.replace("/nba/parlay", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingTopProps(true);
        setTopPropsError(null);
        const res = await fetch("/api/nba/props/top?mode=alternates_best&limit=180", {
          cache: "no-store",
        });
        const data = (await res.json()) as TopPropsApiPayload;
        if (!res.ok || !data?.ok || !Array.isArray(data.props)) {
          throw new Error(data?.error ?? "Impossible de charger les props.");
        }
        if (cancelled) return;
        setTopProps(data.props);
      } catch (error) {
        if (cancelled) return;
        setTopPropsError(error instanceof Error ? error.message : "Erreur inconnue.");
        setTopProps([]);
      } finally {
        if (!cancelled) setLoadingTopProps(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Fetch DvP client-side for G/F/C — same endpoint the DvP section uses
  useEffect(() => {
    let cancelled = false;
    const loadDvp = async () => {
      const positions = ["G", "F", "C"] as const;
      const lookup = new Map<string, { rank: number; totalTeams: number; value: number; flag: "weakness" | "strength" | "neutral"; position: string }>();
      await Promise.all(positions.map(async (pos) => {
        try {
          const params = new URLSearchParams({ season: "2025", window: "L10", position: pos, context: "all" });
          const res = await fetch(`/api/nba/defense/dvp?${params.toString()}`, { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as { rows?: Array<{ teamAbbr?: string | null; metrics?: { perGame?: Record<string, number | null> | null } | null }> };
          const rows = Array.isArray(data.rows) ? data.rows : [];
          if (!rows.length) return;

          const metricMap: Record<string, string> = { PTS: "points", REB: "rebounds", AST: "assists", "3PT": "threePointsMade" };

          for (const [propMetric, statKey] of Object.entries(metricMap)) {
            const entries = rows
              .map((r) => ({ abbr: String(r.teamAbbr ?? "").toUpperCase(), value: Number(r.metrics?.perGame?.[statKey] ?? NaN) }))
              .filter((e) => e.abbr && Number.isFinite(e.value));
            if (!entries.length) continue;
            const avg = entries.reduce((s, e) => s + e.value, 0) / entries.length;
            entries.sort((a, b) => a.value - b.value);
            entries.forEach((e, idx) => {
              const delta = avg > 0 ? (e.value - avg) / avg : 0;
              const flag = delta >= 0.07 ? "weakness" : delta <= -0.07 ? "strength" : "neutral";
              lookup.set(`${pos}:${propMetric}:${e.abbr}`, { rank: idx + 1, totalTeams: entries.length, value: e.value, flag, position: pos });
            });
          }

          // PRA = points + rebounds + assists
          const praEntries = rows
            .map((r) => {
              const p = Number(r.metrics?.perGame?.points ?? NaN);
              const rb = Number(r.metrics?.perGame?.rebounds ?? NaN);
              const a = Number(r.metrics?.perGame?.assists ?? NaN);
              const abbr = String(r.teamAbbr ?? "").toUpperCase();
              if (!abbr || !Number.isFinite(p) || !Number.isFinite(rb) || !Number.isFinite(a)) return null;
              return { abbr, value: p + rb + a };
            })
            .filter(Boolean) as Array<{ abbr: string; value: number }>;
          if (praEntries.length) {
            const praAvg = praEntries.reduce((s, e) => s + e.value, 0) / praEntries.length;
            praEntries.sort((a, b) => a.value - b.value);
            praEntries.forEach((e, idx) => {
              const delta = praAvg > 0 ? (e.value - praAvg) / praAvg : 0;
              const flag = delta >= 0.07 ? "weakness" : delta <= -0.07 ? "strength" : "neutral";
              lookup.set(`${pos}:PRA:${e.abbr}`, { rank: idx + 1, totalTeams: praEntries.length, value: e.value, flag, position: pos });
            });
          }
        } catch { /* ignore */ }
      }));
      if (!cancelled) setDvpLookup(lookup);
    };
    void loadDvp();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const quoteParlay = async () => {
      setQuoteError(null);
      if (legs.length === 0) { setQuote(null); return; }
      try {
        setQuoteLoading(true);
        const parsedStake = Number(stakeInput.replace(",", "."));
        const stake = Number.isFinite(parsedStake) ? parsedStake : null;
        const res = await fetch("/api/nba/parlay/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ legs, stake }),
        });
        const data = (await res.json()) as ParlayQuoteResponseV1 & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Quote impossible.");
        if (cancelled) return;
        setQuote(data);
      } catch (error) {
        if (cancelled) return;
        setQuoteError(error instanceof Error ? error.message : "Erreur réseau.");
        setQuote(null);
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };
    void quoteParlay();
    return () => { cancelled = true; };
  }, [legs, stakeInput]);

  // ─── Derived state ───────────────────────────────────────────────────────────

  const selectedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const leg of legs) set.add(parlayLegIdentityKey(leg));
    return set;
  }, [legs]);

  const availableMetrics = useMemo(() => {
    const set = new Set(topProps.map((p) => p.metric.toUpperCase()));
    return ["ALL", ...Array.from(set).sort()];
  }, [topProps]);

  // Unique games derived from props: key = "AWAY@HOME", label = "AWAY vs HOME · HH:MM"
  const availableGames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of topProps) {
      if (!p.teamCode || !p.opponentCode) continue;
      const [a, b] = [p.teamCode.toUpperCase(), p.opponentCode.toUpperCase()].sort();
      const key = `${a}@${b}`;
      if (!map.has(key)) {
        const dateIso = gameTimeByKey.get(key);
        const timeStr = dateIso ? formatGameTimeForUser(dateIso, userTimezone) : "";
        map.set(key, timeStr ? `${a} vs ${b} · ${timeStr}` : `${a} vs ${b}`);
      }
    }
    return [
      { key: "ALL", label: "Tous les matchs" },
      ...Array.from(map.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => {
          const ta = gameTimeByKey.get(a.key) ? new Date(gameTimeByKey.get(a.key)!).getTime() : Infinity;
          const tb = gameTimeByKey.get(b.key) ? new Date(gameTimeByKey.get(b.key)!).getTime() : Infinity;
          return ta - tb;
        }),
    ];
  }, [topProps, gameTimeByKey, userTimezone]);

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0, S: 0, A: 0, B: 0, C: 0 };
    for (const p of topProps) {
      counts.ALL++;
      const g = String(p.grade ?? "").toUpperCase();
      if (g in counts) counts[g]++;
    }
    return counts;
  }, [topProps]);

  const filteredProps = useMemo(() => {
    return topProps.filter((p) => {
      // Exclure les props dont le game est terminé
      const [a, b] = [p.teamCode?.toUpperCase() ?? "", p.opponentCode?.toUpperCase() ?? ""].sort();
      const pairKey = `${a}@${b}`;
      const status = gameStatusByKey.get(pairKey);
      if (status && FINISHED_STATUSES.has(status)) return false;
      if (filterGrade !== "ALL" && String(p.grade ?? "").toUpperCase() !== filterGrade) return false;
      if (filterMetric !== "ALL" && p.metric.toUpperCase() !== filterMetric) return false;
      if (filterGame !== "ALL" && pairKey !== filterGame) return false;
      if (filterSide !== "ALL" && p.side !== filterSide) return false;
      if (searchQuery.trim()) {
        if (!p.player.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [topProps, gameStatusByKey, filterGrade, filterMetric, filterGame, filterSide, searchQuery]);

  const parlayQuality = useMemo(() => {
    if (legs.length === 0) return null;
    const legProps = legs.flatMap((leg) => {
      const match = topProps.find(
        (p) =>
          p.player === leg.player &&
          p.metric.toUpperCase() === leg.market.toUpperCase() &&
          p.side === leg.side &&
          Math.abs(p.line - leg.line) < 0.01,
      );
      return match ? [match] : [];
    });
    if (legProps.length === 0) return null;
    const validHR = legProps.filter((p) => Number.isFinite((p.hitRateL10 ?? p.hitRate) ?? NaN));
    if (validHR.length === 0) return null;
    const avgHR =
      validHR.reduce((s, p) => s + (p.hitRateL10 ?? p.hitRate ?? 0), 0) / validHR.length;
    const q =
      QUALITY_THRESHOLDS.find((t) => avgHR >= t.minHR) ??
      QUALITY_THRESHOLDS[QUALITY_THRESHOLDS.length - 1]!;
    return {
      avgHR,
      label: q.label,
      color: q.color,
      barPct: Math.min(96, Math.max(4, avgHR)),
    };
  }, [legs, topProps]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const addToParlay = (prop: TopProp) => {
    const leg = buildLegFromTopProp(prop);
    const upsert = upsertParlayDraftLeg(leg);
    setLegs(upsert.legs);
    if (upsert.added) {
      setRecentlyAddedId(prop.id);
      if (recentlyAddedTimer.current) clearTimeout(recentlyAddedTimer.current);
      recentlyAddedTimer.current = setTimeout(() => setRecentlyAddedId(null), 2000);
    }
  };

  const removeLeg = (legId: string) => {
    setLegs((prev) => {
      const next = prev.filter((leg) => leg.legId !== legId);
      writeParlayDraftLegs(next);
      return next;
    });
  };

  const clearSlip = () => { clearParlayDraftLegs(); setLegs([]); };

  const saveTicket = async () => {
    if (!quote?.ok) {
      setSaveMessage({ text: "Parlay invalide : corrige les warnings avant de sauvegarder.", error: true });
      return;
    }
    if (legs.length < 2) {
      setSaveMessage({ text: "Minimum 2 legs requis.", error: true });
      return;
    }
    try {
      setSaveLoading(true);
      setSaveMessage(null);
      const stakeNum = Number(stakeInput.replace(",", "."));
      const stake = Number.isFinite(stakeNum) && stakeNum >= 0 ? stakeNum : null;
      const res = await fetch("/api/nba/parlay/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs,
          stake,
          combinedDecimal: quote.combinedDecimal,
          combinedAmerican: quote.combinedAmerican,
          payout: quote.payout,
          profit: quote.profit,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; ticket?: ParlayTicket };
      if (res.status === 401) throw new Error("Connecte-toi pour sauvegarder un parlay.");
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Impossible de sauvegarder.");
      setSaveMessage({ text: `Ticket sauvegardé ! (${legs.length} legs)`, error: false });
      await refreshTicketsCount();
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Erreur réseau.",
        error: true,
      });
    } finally {
      setSaveLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

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

        <NbaHeader />

        <div className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:overflow-y-auto md:pb-6">
          {comingSoon && (
            <div className="mb-3 flex justify-end">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
                {comingSoon}
              </span>
            </div>
          )}

          <main className="min-w-0 flex-1 space-y-5">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Parlay Builder</h1>
                <p className="mt-0.5 text-[13px] text-white/40">Construis ton parlay du soir · NBA</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {legs.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[12px] font-bold text-amber-200">
                      {legs.length} leg{legs.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] text-white/55">Multi-game</span>
                </div>
                <Link
                  href="/nba/journal"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/80"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  {ticketsCount} ticket{ticketsCount !== 1 ? "s" : ""}
                </Link>
              </div>
            </div>

            {/* Main 2-col grid */}
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">

              {/* ══ LEFT: Props Browser ══════════════════════════════════════ */}
              <Card>
                <div className="p-4 sm:p-5">

                  {/* Filters — même style que best-props-section */}
                  <div className="mb-4 space-y-2.5">
                    {/* Row 1: Match + Stat + Side */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        <span className="text-[11px] text-white/45">Match</span>
                        <select
                          value={filterGame}
                          onChange={(e) => setFilterGame(e.target.value)}
                          className="max-w-[130px] bg-transparent text-[11px] font-medium text-white/90 outline-none sm:max-w-none"
                        >
                          {availableGames.map(({ key, label }) => (
                            <option key={key} value={key} className="bg-[#0b0f18] text-white">
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        <span className="text-[11px] text-white/45">Stat</span>
                        <select
                          value={filterMetric}
                          onChange={(e) => setFilterMetric(e.target.value)}
                          className="bg-transparent text-[11px] font-medium text-white/90 outline-none"
                        >
                          {availableMetrics.map((m) => (
                            <option key={m} value={m} className="bg-[#0b0f18] text-white">
                              {m === "ALL" ? "Toutes" : m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <TabGroup
                        value={filterSide}
                        onChange={setFilterSide}
                        options={[
                          { value: "ALL", label: "Tous" },
                          { value: "over", label: "Over" },
                          { value: "under", label: "Under" },
                        ]}
                      />
                    </div>
                    {/* Row 2: Tag + Search */}
                    <div className="flex flex-wrap items-center gap-2">
                      <TabGroup
                        value={filterGrade}
                        onChange={(v) => setFilterGrade(v as GradeFilter)}
                        options={[
                          { value: "ALL", label: "Tous" },
                          { value: "S", label: "S" },
                          { value: "A", label: "A" },
                          { value: "B", label: "B" },
                          { value: "C", label: "C" },
                        ]}
                      />
                      <div className="flex flex-1 min-w-[140px] items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        <Search className="h-3.5 w-3.5 shrink-0 text-white/25" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Joueur…"
                          className="flex-1 min-w-0 bg-transparent text-[11px] text-white/90 placeholder-white/25 outline-none"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                        {searchQuery && (
                          <button type="button" onClick={() => setSearchQuery("")} className="text-white/25 hover:text-white/55">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Results summary */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] text-white/35">
                      {loadingTopProps
                        ? "Chargement…"
                        : `${filteredProps.length} prop${filteredProps.length !== 1 ? "s" : ""}`}
                    </p>
                    {legs.length >= 10 && (
                      <p className="text-[11px] text-amber-300">Maximum 10 legs atteint</p>
                    )}
                  </div>

                  {topPropsError && (
                    <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-300">
                      {topPropsError}
                    </div>
                  )}

                  {/* Props list */}
                  <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-0.5">
                    {/* Skeletons */}
                    {loadingTopProps &&
                      Array.from({ length: 7 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-[90px] animate-pulse rounded-xl border border-white/8 bg-white/[0.025]"
                        />
                      ))}

                    {/* Empty */}
                    {!loadingTopProps && filteredProps.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Target className="mb-3 h-8 w-8 text-white/15" />
                        <p className="text-[13px] text-white/30">Aucune prop pour ces filtres</p>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterTag("ALL");
                            setFilterMetric("ALL");
                            setSearchQuery("");
                          }}
                          className="mt-3 rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/45 transition hover:text-white/70"
                        >
                          Réinitialiser les filtres
                        </button>
                      </div>
                    )}

                    {/* Prop cards */}
                    {!loadingTopProps &&
                      filteredProps.map((prop) => {
                        const leg = buildLegFromTopProp(prop);
                        const key = parlayLegIdentityKey(leg);
                        const isSelected = selectedKeys.has(key);
                        const isFlashing = recentlyAddedId === prop.id;
                        const primary = getTeamPrimaryColor(prop.teamCode);
                        const hr = prop.hitRateL10 ?? prop.hitRate;
                        const hrColor = hitRateColor(hr);
                        const edgePos =
                          Number.isFinite(prop.edge ?? NaN) && Number(prop.edge) > 0;
                        // DvP: look up from client-side data
                        const dvpMetricKey = prop.metric.toUpperCase();
                        const dvpOpp = String(prop.opponentCode ?? "").toUpperCase();
                        const dvpEntry = (() => {
                          if (!dvpOpp || !dvpLookup.size) return null;
                          // If position known, use it directly
                          if (prop.dvpPosition) {
                            return dvpLookup.get(`${prop.dvpPosition}:${dvpMetricKey}:${dvpOpp}`) ?? null;
                          }
                          // Fallback: try all 3 positions, pick the one with the highest rank (worst defense = most useful for Over)
                          const tries = (["G", "F", "C"] as const)
                            .map((p) => dvpLookup.get(`${p}:${dvpMetricKey}:${dvpOpp}`))
                            .filter(Boolean) as Array<{ rank: number; totalTeams: number; value: number; flag: "weakness" | "strength" | "neutral"; position: string }>;
                          if (!tries.length) return null;
                          return tries.sort((a, b) => b.rank - a.rank)[0];
                        })();
                        const hasDvpReal = !!dvpEntry;
                        const dvpColor =
                          dvpEntry?.flag === "weakness" ? "#34d399"
                          : dvpEntry?.flag === "strength" ? "#f87171"
                          : "rgba(255,255,255,.35)";
                        const dvpPos = dvpEntry?.position ?? prop.dvpPosition;
                        const isTopGrade = prop.grade === "S" || prop.grade === "A";
                        const gradientOpacity = isTopGrade ? 0.22 : prop.grade === "B" ? 0.15 : 0.10;
                        const borderOpacity = isTopGrade ? 0.50 : prop.grade === "B" ? 0.35 : 0.22;
                        const sideLabel = prop.side === "over" ? "Over" : "Under";
                        const matchupKey = prop.teamCode && prop.opponentCode
                          ? [prop.teamCode.toUpperCase(), prop.opponentCode.toUpperCase()].sort().join("@")
                          : null;
                        const gameStatus = matchupKey ? (gameStatusByKey.get(matchupKey) ?? null) : null;
                        const isLive = gameStatus ? LIVE_STATUSES.has(gameStatus) : false;
                        const matchTime = matchupKey ? gameTimeByKey.get(matchupKey) ?? null : null;
                        const matchTimeStr = isLive ? gameStatus : (matchTime ? formatGameTimeForUser(matchTime, userTimezone) : null);

                        return (
                          <div
                            key={prop.id}
                            className="group relative overflow-hidden rounded-xl border transition"
                            style={{
                              background: `linear-gradient(135deg, ${hexToRgba(primary, gradientOpacity)} 0%, rgba(5,5,8,.97) 60%)`,
                              borderColor: hexToRgba(primary, borderOpacity),
                              boxShadow: `inset 3px 0 0 ${hexToRgba(primary, isTopGrade ? 0.70 : prop.grade === "B" ? 0.50 : 0.35)}`,
                            }}
                          >
                            {/* Top row: grade + matchup + time */}
                            <div className="flex items-center justify-between px-3 pt-2.5">
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ring-1 ${gradeTone(prop.grade)}`}>
                                {prop.grade}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {getNbaCdnTeamLogo(prop.teamCode) && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={getNbaCdnTeamLogo(prop.teamCode)!} alt={prop.teamCode ?? ""} className="h-4 w-4 object-contain opacity-80" />
                                )}
                                <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>
                                  {prop.teamCode}
                                </span>
                                <span className="text-[9px]" style={{ color: "rgba(255,255,255,.20)" }}>vs</span>
                                {getNbaCdnTeamLogo(prop.opponentCode) && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={getNbaCdnTeamLogo(prop.opponentCode)!} alt={prop.opponentCode ?? ""} className="h-4 w-4 object-contain opacity-80" />
                                )}
                                <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>
                                  {prop.opponentCode ?? "?"}
                                </span>
                                {matchTimeStr && (
                                  <span
                                    className="text-[9px] font-bold"
                                    style={{ color: isLive ? "#34d399" : "rgba(255,255,255,.22)" }}
                                  >
                                    · {matchTimeStr}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Player name + line + odds */}
                            <div className="px-3 pb-0 pt-2">
                              <p className="truncate text-[15px] font-bold leading-tight text-white/95">
                                {prop.player}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span
                                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                                  style={{ background: "rgba(0,0,0,.30)", border: "1px solid rgba(255,255,255,.10)", color: "rgba(255,255,255,.65)" }}
                                >
                                  {prop.metric} {sideLabel} {formatDecimal(prop.line, 1)}
                                </span>
                                <span
                                  className="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
                                  style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.50)" }}
                                >
                                  {formatOddsForDisplay(prop.odds, oddsFormat)}
                                </span>
                              </div>
                            </div>

                            {/* DVP bar */}
                            {(() => {
                              const segments = 5;
                              const filledRaw = dvpEntry?.rank ? ((dvpEntry.totalTeams - dvpEntry.rank + 1) / dvpEntry.totalTeams) * segments : 0;
                              return (
                                <div className="px-3 pb-2 pt-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-white/20">
                                      DEF{dvpPos ? ` vs ${prop.metric} ${dvpPos}` : ""}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                      {Array.from({ length: segments }).map((_, i) => {
                                        const full = i < Math.floor(filledRaw);
                                        const half = !full && i === Math.floor(filledRaw) && (filledRaw % 1) >= 0.3;
                                        const bg = full
                                          ? dvpColor
                                          : half
                                            ? `linear-gradient(to right, ${dvpColor} 50%, rgba(255,255,255,.08) 50%)`
                                            : "rgba(255,255,255,.08)";
                                        return <div key={i} className="h-2 w-3.5 rounded-sm" style={{ background: bg }} />;
                                      })}
                                    </div>
                                    {dvpEntry?.rank ? (
                                      <span className="text-[10px] font-bold tabular-nums" style={{ color: dvpColor }}>
                                        #{dvpEntry.rank}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-white/15">N/D</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Bottom row: hit rate L10 + edge + parlay button */}
                            <div
                              className="flex items-center justify-between border-t px-3 py-2"
                              style={{ borderColor: "rgba(255,255,255,.06)" }}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className="text-[11px] font-bold tabular-nums"
                                  style={{ color: edgePos ? "#34d399" : "rgba(255,255,255,.30)" }}
                                >
                                  {formatEdge(prop.edge)} edge
                                </span>
                                {Number.isFinite(hr) && (
                                  <span className="text-[11px] tabular-nums" style={{ color: hrColor }}>
                                    L10 <span className="font-bold">{Number(hr).toFixed(0)}%</span>
                                  </span>
                                )}
                                <span className="text-[11px]" style={{ color: "rgba(255,255,255,.25)" }}>
                                  BZ <span className="font-bold text-white/50">{formatDecimal(prop.finalScore ?? prop.score, 0)}</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={isSelected || legs.length >= 10}
                                onClick={() => addToParlay(prop)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                                  isSelected || isFlashing
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                    : "border-white/15 bg-white/5 text-white/60 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200"
                                } disabled:cursor-not-allowed`}
                              >
                                {isSelected ? (
                                  <><span className="text-[10px]">✓</span> Ajouté</>
                                ) : (
                                  <><Plus className="h-3 w-3" /> Parlay</>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </Card>

              {/* ══ RIGHT: Parlay Slip ════════════════════════════════════════ */}
              <div className="space-y-4">
                <Card>
                  <div className="p-4 sm:p-5">

                    {/* Slip header */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[16px] font-semibold">Parlay Slip</h2>
                        {legs.length > 0 && (
                          <span className="rounded-full border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                            {legs.length}/10
                          </span>
                        )}
                      </div>
                      {legs.length > 0 && (
                        <button
                          type="button"
                          onClick={clearSlip}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
                        >
                          <Trash2 className="h-3 w-3" />
                          Vider
                        </button>
                      )}
                    </div>

                    {/* Empty state */}
                    {legs.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-12 text-center">
                        <Flame className="mb-3 h-8 w-8 text-amber-500/25" />
                        <p className="text-[13px] text-white/30">Ajoute des props depuis la liste</p>
                        <p className="mt-1 text-[11px] text-white/18">
                          Minimum 2 legs · Maximum 10
                        </p>
                      </div>
                    )}

                    {/* Legs list */}
                    {legs.length > 0 && (
                      <div className="space-y-2">
                        {legs.map((leg) => {
                          const matchProp = topProps.find(
                            (p) =>
                              p.player === leg.player &&
                              p.metric.toUpperCase() === leg.market.toUpperCase() &&
                              p.side === leg.side &&
                              Math.abs(p.line - leg.line) < 0.01,
                          );
                          const tagS = matchProp?.recommendationTag
                            ? TAG_STYLES[matchProp.recommendationTag]
                            : null;

                          return (
                            <div
                              key={leg.legId}
                              className="rounded-xl border px-3 py-2.5"
                              style={{
                                borderColor: tagS?.border ?? "rgba(255,255,255,.09)",
                                background: tagS
                                  ? `linear-gradient(135deg, ${tagS.bg} 0%, rgba(5,5,8,.97) 80%)`
                                  : "rgba(255,255,255,.025)",
                                boxShadow: tagS ? `inset 2px 0 0 ${tagS.border}` : "none",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    {matchProp?.recommendationTag && tagS && (
                                      <span
                                        className={`rounded border px-1 py-0.5 text-[9px] font-black ${tagS.badge}`}
                                      >
                                        {matchProp.recommendationTag}
                                      </span>
                                    )}
                                    <p className="truncate text-[13px] font-bold text-white/90">
                                      {leg.player}
                                    </p>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-white/50">
                                    {leg.market} {leg.side === "over" ? "Over" : "Under"} {leg.line}
                                    <span className="ml-2 font-bold tabular-nums text-white/70">
                                      {formatOddsForDisplay(leg.oddsDecimal, oddsFormat)}
                                    </span>
                                  </p>
                                  {leg.teamCode && (
                                    <p className="text-[10px] text-white/22">
                                      {leg.teamCode}
                                      {leg.opponentCode ? ` vs ${leg.opponentCode}` : ""}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeLeg(leg.legId)}
                                  className="mt-0.5 rounded-md border border-white/10 bg-white/5 p-1 text-white/35 transition hover:border-rose-500/30 hover:bg-rose-500/12 hover:text-rose-300"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Parlay quality meter */}
                    {parlayQuality && (
                      <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] text-white/35">Qualité du parlay</span>
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: parlayQuality.color }}
                          >
                            {parlayQuality.label}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${parlayQuality.barPct}%`,
                              background: parlayQuality.color,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-white/28">
                          Hit Rate moyen L10 : {parlayQuality.avgHR.toFixed(0)}%
                        </p>
                      </div>
                    )}

                    {/* Stake */}
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] text-white/40">Mise ($)</p>
                      <div className="flex gap-1.5">
                        {STAKE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setStakeInput(preset)}
                            className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                              stakeInput === preset
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                                : "border-white/10 bg-white/4 text-white/45 hover:bg-white/8 hover:text-white/70"
                            }`}
                          >
                            ${preset}
                          </button>
                        ))}
                      </div>
                      <input
                        value={stakeInput}
                        onChange={(e) => setStakeInput(e.target.value)}
                        className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3.5 text-sm text-white placeholder-white/22 outline-none transition focus:border-amber-500/40"
                        placeholder="Montant personnalisé…"
                      />
                    </div>

                    {/* Quote */}
                    {(quoteLoading || quoteError || (quote && legs.length > 0)) && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                        {quoteLoading && (
                          <div className="flex items-center justify-center gap-2.5 py-3 text-[12px] text-white/35">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-white/55" />
                            Calcul en cours…
                          </div>
                        )}
                        {quoteError && (
                          <p className="text-center text-[12px] text-rose-300">{quoteError}</p>
                        )}
                        {!quoteLoading && !quoteError && quote && (
                          <div>
                            {/* Big combined odds */}
                            <div className="mb-4 text-center">
                              <p className="text-[10px] tracking-widest text-white/30">
                                COTES COMBINÉES
                              </p>
                              <p className="mt-0.5 text-[32px] font-black tabular-nums leading-none text-white">
                                {formatOddsForDisplay(quote.combinedDecimal, oddsFormat)}
                              </p>
                              <p className="mt-1 text-[12px] text-white/35">
                                {formatOddsForDisplay(
                                  quote.combinedDecimal,
                                  oddsFormat === "decimal" ? "american" : "decimal",
                                )}{" "}
                                · prob.{" "}
                                {quote.impliedProbability !== null
                                  ? `${(quote.impliedProbability * 100).toFixed(1)}%`
                                  : "—"}
                              </p>
                            </div>

                            {/* Payout breakdown */}
                            <div className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-white/40">Mise</span>
                                <span className="text-[13px] font-semibold text-white">
                                  ${quote.stake !== null ? quote.stake.toFixed(2) : stakeInput}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-white/40">Payout total</span>
                                <span className="text-[15px] font-bold text-emerald-300">
                                  {quote.payout !== null ? `$${quote.payout.toFixed(2)}` : "—"}
                                </span>
                              </div>
                              <div
                                className="flex items-center justify-between border-t pt-2.5"
                                style={{ borderColor: "rgba(255,255,255,.06)" }}
                              >
                                <span className="text-[11px] text-white/40">Profit net</span>
                                <span className="text-[16px] font-black text-amber-300">
                                  {quote.profit !== null ? `+$${quote.profit.toFixed(2)}` : "—"}
                                </span>
                              </div>
                            </div>

                            {quote.warnings.length > 0 && (
                              <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                                ⚠ {quote.warnings[0]?.message ?? "Warnings détectés."}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save button */}
                    <button
                      type="button"
                      onClick={() => void saveTicket()}
                      disabled={saveLoading || legs.length < 2 || !quote?.ok}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-2.5 text-[13px] font-semibold text-amber-100 transition hover:bg-amber-500/22 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Save className="h-4 w-4" />
                      {saveLoading
                        ? "Sauvegarde…"
                        : legs.length < 2
                        ? "Minimum 2 legs requis"
                        : "Sauvegarder le ticket"}
                    </button>

                    {saveMessage && (
                      <p
                        className={`mt-2 text-center text-[11px] ${
                          saveMessage.error ? "text-rose-300" : "text-emerald-300"
                        }`}
                      >
                        {saveMessage.text}
                      </p>
                    )}
                  </div>
                </Card>

                {/* Legend */}
                <div className="rounded-xl border border-white/8 bg-white/[0.015] px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold tracking-widest text-white/25">
                    TAGS
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { tag: "SAFE", desc: "Hit Rate > 70% · Cotes faibles" },
                      { tag: "BALANCED", desc: "Hit Rate 55–70% · Risque modéré" },
                      { tag: "AGGRESSIVE", desc: "Hit Rate 45–55% · Cotes élevées" },
                      { tag: "LONGSHOT", desc: "Hit Rate < 45% · Très risqué" },
                    ].map(({ tag, desc }) => {
                      const s = TAG_STYLES[tag]!;
                      return (
                        <div key={tag} className="flex items-center gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-black ${s.badge}`}>
                            {tag}
                          </span>
                          <span className="text-[10px] text-white/28">{desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav />
      </div>
    </div>
  );
}
