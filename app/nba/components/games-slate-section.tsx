"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { Card } from "./nba-ui";
import { inferSeasonForDate, formatOddsForDisplay, type OddsDisplayFormat } from "./nba-helpers";
import type { ApiGame, GamesApiPayload, NbaGameCard, NbaStandingRow } from "./nba-shared-types";
import { TEAM_CODE_BY_ID } from "@/lib/nba/constants";

type Props = {
  gamesLoading: boolean;
  gamesError: string | null;
  gameCards: NbaGameCard[];
  standingsRows: NbaStandingRow[];
  oddsFormat: OddsDisplayFormat;
};

type TeamRestMetrics = {
  restDays: number | null;
  isB2B: boolean;
  isThreeInFour: boolean;
  isFourInSix: boolean;
  lastGameYmd: string | null;
};

type RestModalState = {
  loading: boolean;
  error: string | null;
  home: TeamRestMetrics | null;
  away: TeamRestMetrics | null;
};

const TORONTO_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTorontoYmd(dateIso: string | null | undefined): string | null {
  const raw = String(dateIso ?? "").trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return TORONTO_YMD.format(new Date(ts));
}

function ymdIndex(ymd: string | null): number | null {
  if (!ymd) return null;
  const ts = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / (24 * 60 * 60 * 1000));
}

function formatSpreadLine(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  if (value < 0) return value.toFixed(1);
  return "0.0";
}

function toHomeSpreadLine(
  line: number | null,
  side: "home" | "away" | null,
): number | null {
  if (!Number.isFinite(line ?? NaN) || !side) return null;
  const n = Number(line);
  return side === "home" ? n : -n;
}

function formatSignedValue(value: number | null, digits = 1): string {
  if (!Number.isFinite(value ?? NaN)) return "—";
  const n = Number(value);
  const fixed = n.toFixed(digits);
  return n > 0 ? `+${fixed}` : fixed;
}

function restLabel(rest: TeamRestMetrics | null): string {
  if (!rest) return "N/A";
  if (rest.restDays === null) return "Aucun match récent";
  if (rest.restDays === 0) return "Back-to-back";
  if (rest.restDays === 1) return "1 jour de repos";
  return `${rest.restDays} jours de repos`;
}

function formatStatusLabel(statusShort: string | null): string {
  const s = String(statusShort ?? "").trim().toUpperCase();
  if (s === "NS") return "Avant match";
  if (s === "LIVE" || s === "Q1" || s === "Q2" || s === "Q3" || s === "Q4") return "En direct";
  if (s === "HT") return "Mi-temps";
  if (s === "FT") return "Final";
  return s || "Statut inconnu";
}

function formatSourceLabel(source: "odds" | "scores" | "none"): string {
  if (source === "odds") return "Cotes pre-match";
  if (source === "scores") return "Score en direct";
  return "Aucune ligne";
}

function confidenceLabel(confidence: string): string {
  const key = String(confidence).toLowerCase();
  if (key === "high") return "Elevee";
  if (key === "medium") return "Moyenne";
  return "Faible";
}

async function fetchTeamRestMetrics(
  teamId: number,
  gameId: number,
  gameDateIso: string,
): Promise<TeamRestMetrics | null> {
  const currentYmd = toTorontoYmd(gameDateIso);
  const currentIdx = ymdIndex(currentYmd);
  if (currentIdx === null) return null;

  const season = inferSeasonForDate(gameDateIso);
  const params = new URLSearchParams({ team: String(teamId), league: "12" });
  if (season) params.set("season", season);

  const res = await fetch(`/api/nba/games?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return null;

  const payload = (await res.json()) as GamesApiPayload;
  const games = Array.isArray(payload.response) ? payload.response : [];

  const dedupedById = new Map<number, ApiGame>();
  for (const game of games) {
    const id = Number(game.id ?? NaN);
    if (!Number.isFinite(id) || id === gameId) continue;
    if (!game.date) continue;
    dedupedById.set(id, game);
  }

  const history = Array.from(dedupedById.values())
    .map((game) => {
      const gameYmd = toTorontoYmd(game.date ?? null);
      const idx = ymdIndex(gameYmd);
      return { idx, ymd: gameYmd };
    })
    .filter((row): row is { idx: number; ymd: string } => Number.isFinite(row.idx) && Boolean(row.ymd));

  const previous = history
    .filter((row) => row.idx < currentIdx)
    .sort((a, b) => b.idx - a.idx);

  const last = previous[0] ?? null;
  const restDays = last ? Math.max(0, currentIdx - last.idx - 1) : null;

  const inLast4 = previous.filter((row) => row.idx >= currentIdx - 3).length;
  const inLast6 = previous.filter((row) => row.idx >= currentIdx - 5).length;

  return {
    restDays,
    isB2B: restDays === 0,
    isThreeInFour: inLast4 >= 3,
    isFourInSix: inLast6 >= 4,
    lastGameYmd: last?.ymd ?? null,
  };
}

export function GamesSlateSection({
  gamesLoading,
  gamesError,
  gameCards,
  standingsRows,
  oddsFormat,
}: Props) {
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const prevGameCount = useRef(0);
  const [restState, setRestState] = useState<RestModalState>({
    loading: false,
    error: null,
    home: null,
    away: null,
  });

  const standingsByTeamId = useMemo(() => {
    const map = new Map<number, NbaStandingRow>();
    for (const row of standingsRows) map.set(row.teamId, row);
    return map;
  }, [standingsRows]);

  const standingsByTeamCode = useMemo(() => {
    const map = new Map<string, NbaStandingRow>();
    for (const row of standingsRows) {
      const code = String(TEAM_CODE_BY_ID[Number(row.teamId)] ?? "")
        .trim()
        .toUpperCase();
      if (!code) continue;
      map.set(code, row);
    }
    return map;
  }, [standingsRows]);

  const selectedGame = useMemo(
    () => gameCards.find((card) => card.id === selectedGameId) ?? null,
    [gameCards, selectedGameId],
  );

  const openModal = (gameId: number) => {
    setSelectedGameId(gameId);
    setRestState({ loading: true, error: null, home: null, away: null });
  };

  const closeModal = () => {
    setSelectedGameId(null);
    setRestState({ loading: false, error: null, home: null, away: null });
  };

  useEffect(() => {
    if (!selectedGame) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedGameId(null);
        setRestState({ loading: false, error: null, home: null, away: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;

    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame || !selectedGame.homeId || !selectedGame.awayId || !selectedGame.dateIso) return;
    const homeId = selectedGame.homeId;
    const awayId = selectedGame.awayId;
    const gameDateIso = selectedGame.dateIso;
    const gameId = selectedGame.id;

    let cancelled = false;

    (async () => {
      try {
        const [home, away] = await Promise.all([
          fetchTeamRestMetrics(homeId, gameId, gameDateIso),
          fetchTeamRestMetrics(awayId, gameId, gameDateIso),
        ]);
        if (cancelled) return;
        setRestState({ loading: false, error: null, home, away });
      } catch (err) {
        if (cancelled) return;
        setRestState({
          loading: false,
          error: err instanceof Error ? err.message : "Rest metrics unavailable",
          home: null,
          away: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  const matchupDetails = useMemo(() => {
    if (!selectedGame) return null;
    const homeCode = String(selectedGame.home ?? "").trim().toUpperCase();
    const awayCode = String(selectedGame.away ?? "").trim().toUpperCase();
    const homeById =
      Number.isFinite(Number(selectedGame.homeId ?? NaN)) && Number(selectedGame.homeId) > 0
        ? standingsByTeamId.get(Number(selectedGame.homeId))
        : undefined;
    const awayById =
      Number.isFinite(Number(selectedGame.awayId ?? NaN)) && Number(selectedGame.awayId) > 0
        ? standingsByTeamId.get(Number(selectedGame.awayId))
        : undefined;
    const home =
      homeById ??
      (homeCode ? standingsByTeamCode.get(homeCode) : undefined);
    const away =
      awayById ??
      (awayCode ? standingsByTeamCode.get(awayCode) : undefined);
    if (!home || !away || home.games <= 0 || away.games <= 0) return null;

    const homePf = home.pointsFor / home.games;
    const homePa = home.pointsAgainst / home.games;
    const awayPf = away.pointsFor / away.games;
    const awayPa = away.pointsAgainst / away.games;
    const leagueRows = standingsRows.filter((row) => Number.isFinite(row.games) && row.games > 0);
    const leaguePfAvg =
      leagueRows.length > 0
        ? leagueRows.reduce((sum, row) => sum + row.pointsFor / row.games, 0) / leagueRows.length
        : (homePf + awayPf) / 2;
    const leaguePaAvg =
      leagueRows.length > 0
        ? leagueRows.reduce((sum, row) => sum + row.pointsAgainst / row.games, 0) / leagueRows.length
        : (homePa + awayPa) / 2;

    const restScore = (rest: TeamRestMetrics | null): number => {
      if (!rest) return 0;
      let score = 0;
      if (rest.restDays !== null) {
        if (rest.restDays === 0) score -= 1.5;
        else if (rest.restDays >= 2) score += Math.min(0.8, 0.3 + (rest.restDays - 2) * 0.2);
      }
      if (rest.isThreeInFour) score -= 0.7;
      if (rest.isFourInSix) score -= 1.1;
      return score;
    };

    const homeOffStrength = homePf - leaguePfAvg;
    const awayOffStrength = awayPf - leaguePfAvg;
    const homeDefWeakness = homePa - leaguePaAvg;
    const awayDefWeakness = awayPa - leaguePaAvg;

    const homeCourtAdvantage = 1.7;
    let homeProjectionRaw =
      leaguePfAvg + 0.62 * homeOffStrength + 0.48 * awayDefWeakness + homeCourtAdvantage;
    let awayProjectionRaw =
      leaguePfAvg + 0.62 * awayOffStrength + 0.48 * homeDefWeakness;

    const restDiff = restScore(restState.home) - restScore(restState.away);
    homeProjectionRaw += restDiff * 0.45;
    awayProjectionRaw -= restDiff * 0.45;

    homeProjectionRaw = Math.max(85, Math.min(145, homeProjectionRaw));
    awayProjectionRaw = Math.max(85, Math.min(145, awayProjectionRaw));

    const rawTotal = homeProjectionRaw + awayProjectionRaw;
    const rawSpreadHome = homeProjectionRaw - awayProjectionRaw;

    const marketSpreadHome =
      selectedGame.spreadLine !== null && selectedGame.spreadSide
        ? selectedGame.spreadSide === "home"
          ? selectedGame.spreadLine
          : -selectedGame.spreadLine
        : null;
    const marketTotal = selectedGame.marketSource === "odds" ? selectedGame.total : null;

    const totalMarketWeight =
      marketTotal === null ? 0 : Math.abs(rawTotal - marketTotal) > 8 ? 0.35 : 0.5;
    const spreadMarketWeight =
      marketSpreadHome === null ? 0 : Math.abs(rawSpreadHome - marketSpreadHome) > 6 ? 0.35 : 0.5;

    const modelTotal =
      marketTotal === null ? rawTotal : rawTotal * (1 - totalMarketWeight) + marketTotal * totalMarketWeight;
    const modelSpreadHome =
      marketSpreadHome === null
        ? rawSpreadHome
        : rawSpreadHome * (1 - spreadMarketWeight) + marketSpreadHome * spreadMarketWeight;

    const totalEdge = marketTotal === null ? null : modelTotal - marketTotal;
    const spreadEdge = marketSpreadHome === null ? null : modelSpreadHome - marketSpreadHome;

    const homeOffVsAwayDef = homePf - awayPa;
    const awayOffVsHomeDef = awayPf - homePa;
    const matchupScore = clamp(
      50 + (homeOffStrength - awayOffStrength) * 4 + restDiff * 8,
      0,
      100,
    );

    let confidence = "Low";
    let confidenceScore = 0;
    if (home.games >= 20 && away.games >= 20) confidenceScore += 1;
    if (marketTotal !== null) confidenceScore += 1;
    if (marketSpreadHome !== null) confidenceScore += 1;
    if (restState.home && restState.away) confidenceScore += 1;
    if (totalEdge !== null && Math.abs(totalEdge) >= 2) confidenceScore += 1;
    if (spreadEdge !== null && Math.abs(spreadEdge) >= 1.5) confidenceScore += 1;
    if (confidenceScore >= 5) confidence = "High";
    else if (confidenceScore >= 2) confidence = "Medium";

    return {
      homePf,
      homePa,
      awayPf,
      awayPa,
      modelTotal,
      modelSpreadHome,
      marketTotal,
      marketSpreadHome,
      totalEdge,
      spreadEdge,
      homeOffVsAwayDef,
      awayOffVsHomeDef,
      matchupScore,
      confidence,
    };
  }, [selectedGame, standingsByTeamId, standingsByTeamCode, standingsRows, restState.home, restState.away]);

  const marketDetails = useMemo(() => {
    if (!selectedGame) return null;

    const currentHomeSpread = toHomeSpreadLine(selectedGame.spreadLine, selectedGame.spreadSide);
    const openingHomeSpread = toHomeSpreadLine(
      selectedGame.openingSpreadLine,
      selectedGame.openingSpreadSide,
    );
    const spreadMove =
      currentHomeSpread !== null && openingHomeSpread !== null
        ? currentHomeSpread - openingHomeSpread
        : null;
    const totalMove =
      selectedGame.total !== null && selectedGame.openingTotal !== null
        ? selectedGame.total - selectedGame.openingTotal
        : null;
    const homeMlMove =
      selectedGame.moneylineHome !== null && selectedGame.openingMoneylineHome !== null
        ? selectedGame.moneylineHome - selectedGame.openingMoneylineHome
        : null;
    const awayMlMove =
      selectedGame.moneylineAway !== null && selectedGame.openingMoneylineAway !== null
        ? selectedGame.moneylineAway - selectedGame.openingMoneylineAway
        : null;

    return {
      currentHomeSpread,
      openingHomeSpread,
      spreadMove,
      totalMove,
      homeMlMove,
      awayMlMove,
    };
  }, [selectedGame]);

  const LIVE_STATUSES = new Set(["LIVE", "Q1", "Q2", "Q3", "Q4", "HT", "OT", "1Q", "2Q", "3Q", "4Q"]);
  const FINISHED_STATUSES = new Set(["FT", "AOT", "AET", "AWD", "WO", "ABD"]);

  function isLiveStatus(statusShort: string | null): boolean {
    return LIVE_STATUSES.has(String(statusShort ?? "").trim().toUpperCase());
  }

  function isFinishedStatus(statusShort: string | null): boolean {
    return FINISHED_STATUSES.has(String(statusShort ?? "").trim().toUpperCase());
  }

  function hasDisplayableScore(game: NbaGameCard): boolean {
    const hasBothScores =
      Number.isFinite(game.homeScore ?? NaN) && Number.isFinite(game.awayScore ?? NaN);
    if (!hasBothScores) return false;
    return isLiveStatus(game.statusShort) || isFinishedStatus(game.statusShort);
  }

  function statusPill(statusShort: string | null) {
    const s = String(statusShort ?? "").trim().toUpperCase();
    if (LIVE_STATUSES.has(s)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
          {s === "HT" ? "MI-T" : "LIVE"}
        </span>
      );
    }
    if (FINISHED_STATUSES.has(s)) {
      return <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-semibold text-white/35">FINAL</span>;
    }
    return <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400/80">À VENIR</span>;
  }

  function bzScoreColor(score: number) {
    if (score >= 75) return "border-amber-500/40 bg-amber-500/15 text-amber-300";
    if (score >= 55) return "border-amber-500/20 bg-amber-500/8 text-amber-400/80";
    return "border-white/10 bg-white/5 text-white/45";
  }

  function getTeamRecord(code: string): string | null {
    const upper = code.trim().toUpperCase();
    const row = standingsByTeamCode.get(upper);
    if (!row || row.games <= 0) return null;
    return `${row.wins}-${row.losses}`;
  }

  // Sort: live first, then upcoming, then finished
  const sortedCards = [...gameCards].sort((a, b) => {
    const sa = String(a.statusShort ?? "").trim().toUpperCase();
    const sb = String(b.statusShort ?? "").trim().toUpperCase();
    const order = (s: string) => LIVE_STATUSES.has(s) ? 0 : FINISHED_STATUSES.has(s) ? 2 : 1;
    const diff = order(sa) - order(sb);
    if (diff !== 0) return diff;
    return b.betalyzeScore - a.betalyzeScore;
  });

  const GAMES_PER_PAGE = 2;
  const totalPages = Math.max(1, Math.ceil(sortedCards.length / GAMES_PER_PAGE));
  const currentPage = Math.floor(carouselIndex / GAMES_PER_PAGE);
  const visibleCards = sortedCards.slice(carouselIndex, carouselIndex + GAMES_PER_PAGE);
  const canPrev = true;
  const canNext = true;
  const liveCount = gameCards.filter((g) => LIVE_STATUSES.has(String(g.statusShort ?? "").toUpperCase())).length;

  // Reset carousel when games reload
  if (prevGameCount.current !== gameCards.length) {
    prevGameCount.current = gameCards.length;
    if (carouselIndex !== 0) setCarouselIndex(0);
  }

  return (
    <>
      <Card>
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold leading-tight sm:text-2xl">Calendrier</h2>
              {!gamesLoading && gameCards.length > 0 && (
                <p className="mt-1 text-[11px] text-white/40">
                  {gameCards.length} match{gameCards.length > 1 ? "s" : ""}
                  {liveCount > 0 && <span className="ml-2 text-rose-400">{liveCount} en direct</span>}
                </p>
              )}
            </div>
            {!gamesLoading && sortedCards.length > GAMES_PER_PAGE && (
              <span className="text-[11px] text-white/25 tabular-nums">{currentPage + 1} / {totalPages}</span>
            )}
          </div>

          {/* Carousel — flèches aux extrémités */}
          <div className="mt-5 flex items-center gap-2">

            {/* Flèche gauche */}
            <button
              type="button"
              onClick={() => setCarouselIndex((i) => i - GAMES_PER_PAGE < 0 ? (totalPages - 1) * GAMES_PER_PAGE : i - GAMES_PER_PAGE)}
              disabled={!canPrev || gamesLoading}
              aria-label="Matchs précédents"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 shadow-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Grille 2 cards */}
            <div className="min-w-0 flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Loading skeleton */}
            {gamesLoading && [1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-14 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="h-4 w-12 animate-pulse rounded-full bg-white/[0.06]" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/[0.07]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/[0.07]" />
                    <div className="h-6 w-6 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                </div>
                <div className="mt-2.5 flex justify-center gap-3">
                  <div className="h-2 w-14 animate-pulse rounded-full bg-white/[0.05]" />
                  <div className="h-2 w-14 animate-pulse rounded-full bg-white/[0.05]" />
                </div>
              </div>
            ))}

            {gamesError && (
              <p className="col-span-full text-[11px] text-rose-400">Erreur : {gamesError}</p>
            )}

            {!gamesLoading && !gamesError && gameCards.length === 0 && (
              <div className="col-span-full rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center">
                <p className="text-sm text-white/40">Aucun match NBA disponible</p>
              </div>
            )}

            {!gamesLoading && !gamesError && visibleCards.map((g) => {
              const isHighValue = g.betalyzeScore >= 75;
              const isLive = isLiveStatus(g.statusShort);
              const hasScore = hasDisplayableScore(g);
              const homeRecord = getTeamRecord(g.home);
              const awayRecord = getTeamRecord(g.away);

              return (
                <button
                  key={`card-${g.id}`}
                  type="button"
                  onClick={() => openModal(g.id)}
                  className={`group w-full rounded-xl border p-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.03] ${isHighValue ? "border-amber-500/15 bg-amber-500/[0.02]" : isLive ? "border-rose-500/15 bg-rose-500/[0.02]" : "border-white/6 bg-white/[0.015]"}`}
                >
                  {/* Row 1: status + time | BZ score */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {statusPill(g.statusShort)}
                      <span className="text-[9px] text-white/30">{g.time}</span>
                    </div>
                    <span className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${bzScoreColor(g.betalyzeScore)}`}>
                      BZ {g.betalyzeScore}
                    </span>
                  </div>

                  {/* Row 2: teams + score */}
                  <div className="flex items-center gap-1.5">
                    {/* Away team */}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      {g.awayLogo ? (
                        <img src={g.awayLogo} alt={g.awayName} className="h-6 w-6 shrink-0 rounded object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/15 bg-white/8 text-[7px] font-bold text-white/60">
                          {g.away.slice(0, 3)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-white/90">{g.away}</p>
                        {awayRecord && <p className="text-[9px] text-white/25">{awayRecord}</p>}
                      </div>
                    </div>

                    {/* Center: score or separator */}
                    <div className="shrink-0 px-1 text-center">
                      {hasScore ? (
                        <div className={`relative flex items-center gap-1 rounded-lg px-2 py-1 ${isLive ? "bg-rose-500/10" : "bg-white/[0.04]"}`}>
                          {isLive && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                            </span>
                          )}
                          <span className={`text-[14px] font-black tabular-nums leading-none ${isLive ? "text-rose-300" : "text-white/80"}`}>
                            {g.awayScore}
                          </span>
                          <span className={`text-[9px] font-bold ${isLive ? "text-rose-500/60" : "text-white/20"}`}>—</span>
                          <span className={`text-[14px] font-black tabular-nums leading-none ${isLive ? "text-rose-300" : "text-white/80"}`}>
                            {g.homeScore}
                          </span>
                        </div>
                      ) : (
                        <span className="px-1 text-[9px] font-medium text-white/20">@</span>
                      )}
                    </div>

                    {/* Home team */}
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <div className="min-w-0 text-right">
                        <p className="truncate text-[11px] font-semibold text-white/90">{g.home}</p>
                        {homeRecord && <p className="text-[9px] text-white/25">{homeRecord}</p>}
                      </div>
                      {g.homeLogo ? (
                        <img src={g.homeLogo} alt={g.homeName} className="h-6 w-6 shrink-0 rounded object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/15 bg-white/8 text-[7px] font-bold text-white/60">
                          {g.home.slice(0, 3)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: market info compact */}
                  <div className="mt-2 flex items-center justify-center gap-2 text-[9px] text-white/30">
                    {g.total !== null && (
                      <span>O/U <span className="font-medium text-white/50">{g.total.toFixed(1)}</span></span>
                    )}
                    {g.total !== null && g.spreadFavorite && <span className="text-white/10">·</span>}
                    {g.spreadFavorite && <span>{g.spreadFavorite}</span>}
                    {(g.total !== null || g.spreadFavorite) && g.paceTag && <span className="text-white/10">·</span>}
                    <span>{g.paceTag}</span>
                    <span className="ml-auto text-white/15 transition group-hover:text-white/40">→</span>
                  </div>
                </button>
              );
            })}
            </div>

            {/* Flèche droite */}
            <button
              type="button"
              onClick={() => setCarouselIndex((i) => i + GAMES_PER_PAGE >= sortedCards.length ? 0 : i + GAMES_PER_PAGE)}
              disabled={!canNext || gamesLoading}
              aria-label="Matchs suivants"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/40 shadow-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

          </div>
        </div>
      </Card>

      {selectedGame &&
        createPortal(
          <div
            className="fixed inset-0 z-[1200] flex min-h-[100dvh] items-center justify-center bg-black/35 p-4 backdrop-blur-md"
            onClick={closeModal}
          >
            <div
              className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#09080f] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {selectedGame.awayLogo ? (
                    <img src={selectedGame.awayLogo} alt={selectedGame.awayName} className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[9px] font-bold text-white">{selectedGame.away}</span>
                  )}
                  <span className="text-sm font-semibold text-slate-100">{selectedGame.away}</span>
                </div>
                <span className="text-[10px] font-medium text-slate-500">@</span>
                <div className="flex items-center gap-1.5">
                  {selectedGame.homeLogo ? (
                    <img src={selectedGame.homeLogo} alt={selectedGame.homeName} className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[9px] font-bold text-white">{selectedGame.home}</span>
                  )}
                  <span className="text-sm font-semibold text-slate-100">{selectedGame.home}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-[10px] text-slate-500">{selectedGame.time}</span>
                  <span className="text-[10px] font-medium text-amber-400">{formatStatusLabel(selectedGame.statusShort)}</span>
                </div>
                <span className="flex flex-col items-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1">
                  <span className="text-[8px] font-bold tracking-widest text-amber-500/70">BZ</span>
                  <span className="text-sm font-bold leading-tight text-amber-400">{selectedGame.betalyzeScore}</span>
                </span>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {hasDisplayableScore(selectedGame) && (
              <div className="border-b border-white/8 px-5 py-2.5">
                <p className="text-center text-base font-semibold text-white/85">
                  {selectedGame.away} {selectedGame.awayScore} - {selectedGame.homeScore} {selectedGame.home}
                </p>
              </div>
            )}

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* Section 1 : Marché */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Marché</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Total */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[10px] text-slate-500">Total O/U</p>
                  <p className="mt-1 text-lg font-bold text-slate-100">
                    {selectedGame.total !== null ? selectedGame.total.toFixed(1) : "—"}
                  </p>
                  {marketDetails?.totalMove !== null && marketDetails?.totalMove !== undefined ? (
                    <p className={`mt-0.5 text-[9px] font-medium ${marketDetails.totalMove > 0 ? "text-emerald-400/90" : marketDetails.totalMove < 0 ? "text-rose-400/90" : "text-slate-500"}`}>
                      {marketDetails.totalMove > 0 ? "↑" : marketDetails.totalMove < 0 ? "↓" : "→"} {marketDetails.totalMove > 0 ? "+" : ""}{marketDetails.totalMove.toFixed(1)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[9px] text-slate-600">— ouverture</p>
                  )}
                </div>

                {/* Spread */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[10px] text-slate-500">Handicap</p>
                  {marketDetails?.currentHomeSpread !== null && marketDetails?.currentHomeSpread !== undefined ? (
                    <>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{selectedGame.home}</span>
                          <span className="text-xs font-bold text-slate-100">
                            {formatSpreadLine(marketDetails.currentHomeSpread)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{selectedGame.away}</span>
                          <span className="text-xs font-bold text-slate-100">
                            {formatSpreadLine(-marketDetails.currentHomeSpread)}
                          </span>
                        </div>
                      </div>
                      {marketDetails.openingHomeSpread !== null && (
                        <p className={`mt-1 text-[9px] font-medium ${(marketDetails.spreadMove ?? 0) > 0 ? "text-emerald-400/90" : (marketDetails.spreadMove ?? 0) < 0 ? "text-rose-400/90" : "text-slate-500"}`}>
                          {(marketDetails.spreadMove ?? 0) > 0 ? "↑" : (marketDetails.spreadMove ?? 0) < 0 ? "↓" : "→"} Dom {formatSpreadLine(marketDetails.openingHomeSpread)} {"->"} {formatSpreadLine(marketDetails.currentHomeSpread)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-0.5 text-[9px] text-slate-600">— domicile</p>
                  )}
                </div>

                {/* Moneyline */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[10px] text-slate-500">Moneyline</p>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{selectedGame.home}</span>
                      <span className="text-xs font-bold text-slate-100">
                        {formatOddsForDisplay(selectedGame.moneylineHome, oddsFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{selectedGame.away}</span>
                      <span className="text-xs font-bold text-slate-100">
                        {formatOddsForDisplay(selectedGame.moneylineAway, oddsFormat)}
                      </span>
                    </div>
                  </div>
                  {selectedGame.bookmakerName && (
                    <p className="mt-1.5 text-[9px] text-slate-600">{selectedGame.bookmakerName}</p>
                  )}
                </div>
              </div>

              {/* Section 2 : Projection modèle */}
              <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projection modèle</p>
              {matchupDetails ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Total edge */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Total modèle</span>
                        <span className="text-xs font-bold text-slate-100">{matchupDetails.modelTotal.toFixed(1)}</span>
                      </div>
                      {matchupDetails.marketTotal !== null && (
                        <>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full transition-all ${matchupDetails.totalEdge !== null && matchupDetails.totalEdge >= 1.5 ? "bg-emerald-500" : matchupDetails.totalEdge !== null && matchupDetails.totalEdge <= -1.5 ? "bg-sky-500" : "bg-slate-600"}`}
                              style={{ width: `${matchupDetails.totalEdge !== null ? clamp(50 + (matchupDetails.totalEdge / 10) * 50, 5, 95) : 50}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className={`text-[10px] font-semibold ${matchupDetails.totalEdge !== null && matchupDetails.totalEdge >= 1.5 ? "text-emerald-400" : matchupDetails.totalEdge !== null && matchupDetails.totalEdge <= -1.5 ? "text-sky-400" : "text-slate-500"}`}>
                              {matchupDetails.totalEdge === null ? "—" :
                                matchupDetails.totalEdge >= 1.5 ? "↑ Over" :
                                matchupDetails.totalEdge <= -1.5 ? "↓ Under" : "Neutre"}
                            </span>
                            <span className={`text-[10px] font-medium ${matchupDetails.totalEdge !== null && Math.abs(matchupDetails.totalEdge) >= 1.5 ? "text-slate-300" : "text-slate-600"}`}>
                              Edge {formatSignedValue(matchupDetails.totalEdge)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Spread edge */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Handicap modèle</span>
                        <span className="text-[10px] font-medium text-slate-500">2 equipes</span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{selectedGame.home}</span>
                          <span className="text-xs font-bold text-slate-100">
                            {formatSpreadLine(matchupDetails.modelSpreadHome)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{selectedGame.away}</span>
                          <span className="text-xs font-bold text-slate-100">
                            {formatSpreadLine(-matchupDetails.modelSpreadHome)}
                          </span>
                        </div>
                      </div>
                      {matchupDetails.marketSpreadHome !== null && (
                        <>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full transition-all ${matchupDetails.spreadEdge !== null && matchupDetails.spreadEdge >= 1 ? "bg-emerald-500" : matchupDetails.spreadEdge !== null && matchupDetails.spreadEdge <= -1 ? "bg-rose-500" : "bg-slate-600"}`}
                              style={{ width: `${matchupDetails.spreadEdge !== null ? clamp(50 + (matchupDetails.spreadEdge / 10) * 50, 5, 95) : 50}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className={`text-[10px] font-semibold ${matchupDetails.spreadEdge !== null && matchupDetails.spreadEdge >= 1 ? "text-emerald-400" : matchupDetails.spreadEdge !== null && matchupDetails.spreadEdge <= -1 ? "text-rose-400" : "text-slate-500"}`}>
                              {matchupDetails.spreadEdge === null ? "—" :
                                matchupDetails.spreadEdge >= 1 ? `↑ ${selectedGame.home}` :
                                matchupDetails.spreadEdge <= -1 ? `↑ ${selectedGame.away}` : "Neutre"}
                            </span>
                            <span className={`text-[10px] font-medium ${matchupDetails.spreadEdge !== null && Math.abs(matchupDetails.spreadEdge) >= 1 ? "text-slate-300" : "text-slate-600"}`}>
                              Edge {formatSignedValue(matchupDetails.spreadEdge)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Confiance */}
                  <div className="mt-3 flex items-center gap-1.5 border-t border-white/6 pt-3">
                    <span className="text-[10px] text-slate-500">Confiance modèle :</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${matchupDetails.confidence === "High" ? "bg-emerald-500/15 text-emerald-400" : matchupDetails.confidence === "Medium" ? "bg-amber-500/15 text-amber-400" : "bg-white/8 text-slate-500"}`}>
                      {confidenceLabel(matchupDetails.confidence)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center text-xs text-slate-500">
                  Données insuffisantes pour une projection fiable
                </div>
              )}

              {/* Section 3 : Repos & Matchup */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {/* Repos / fatigue */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Repos</p>
                  {restState.loading ? (
                    <p className="mt-3 text-[10px] text-slate-600">Calcul en cours...</p>
                  ) : restState.error ? (
                    <p className="mt-3 text-[10px] text-rose-400">Indisponible</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {([
                        { code: selectedGame.away, rest: restState.away },
                        { code: selectedGame.home, rest: restState.home },
                      ] as { code: string; rest: TeamRestMetrics | null }[]).map(({ code, rest }) => {
                        const isB2B = rest?.isB2B;
                        const isTired = rest?.isThreeInFour || rest?.isFourInSix;
                        const statusColor = isB2B ? "text-rose-400" : isTired ? "text-amber-400" : "text-emerald-400";
                        const dotColor = isB2B ? "bg-rose-500" : isTired ? "bg-amber-500" : "bg-emerald-500";
                        return (
                          <div key={code} className="flex items-start gap-2">
                            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-slate-300">{code}</p>
                              <p className={`text-[10px] ${statusColor}`}>{restLabel(rest)}</p>
                              {(rest?.isThreeInFour || rest?.isFourInSix) && (
                                <p className="text-[9px] text-amber-500/70">
                                  {rest?.isFourInSix ? "4J en 6 nuits" : "3J en 4 nuits"}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Matchup rating */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Matchup</p>
                  {matchupDetails ? (
                    <div className="mt-3">
                      {/* Score gauge */}
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-slate-100">{Math.round(matchupDetails.matchupScore)}</span>
                        <span className="mb-1 text-[10px] text-slate-500">/100</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${matchupDetails.matchupScore}%` }}
                        />
                      </div>

                      {/* Off vs Def */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">{selectedGame.home} off vs {selectedGame.away} def</span>
                          <span className={`text-[10px] font-semibold ${matchupDetails.homeOffVsAwayDef > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {matchupDetails.homeOffVsAwayDef > 0 ? "+" : ""}{matchupDetails.homeOffVsAwayDef.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">{selectedGame.away} off vs {selectedGame.home} def</span>
                          <span className={`text-[10px] font-semibold ${matchupDetails.awayOffVsHomeDef > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {matchupDetails.awayOffVsHomeDef > 0 ? "+" : ""}{matchupDetails.awayOffVsHomeDef.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] text-slate-600">Non disponible</p>
                  )}
                </div>
              </div>

              {/* Footer source */}
              <p className="mt-4 text-center text-[9px] text-slate-600">
                {formatSourceLabel(selectedGame.marketSource)}{selectedGame.bookmakerName ? ` · ${selectedGame.bookmakerName}` : ""}
              </p>
            </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
