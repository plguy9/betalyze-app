// app/nba/teams/[id]/preview/page.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

type BetalyzeTeam = {
  id: number;
  name: string;
  fullName: string;
  code?: string | null;
  conference: "East" | "West" | "N/A";
  division: string | null;
  logo: string | null;
  city: string | null;
};

type TeamsApiPayload = {
  season: string;
  count: number;
  teams: BetalyzeTeam[];
};

type GameLog = {
  date: string;
  opponent: string;
  opponentLogo?: string | null;
  homeAway: "home" | "away";
  result: "W" | "L" | "NA";
  score: string;
  scoreDiff: number;
  pointsFor: number | null;
  pointsAgainst: number | null;
  isScheduled: boolean;
  isPreseason: boolean;
};

type TeamSummaryPayload = {
  ok: boolean;
  summary?: {
    teamId: number;
    season: string;
    games: Array<{
      gameId: number;
      date: string;
      homeAway: "home" | "away";
      opponentId: number | null;
      opponentName: string | null;
      result: "W" | "L" | "NA";
      score: string | null;
      scoreDiff: number | null;
      pointsFor: number | null;
      pointsAgainst: number | null;
      isScheduled: boolean;
      isPreseason: boolean;
      statusShort: string | null;
    }>;
  };
};

function computeTeamScore(games: GameLog[]): number {
  if (!games.length) return 72;
  const last5 = games.slice(0, 5);
  const wins = last5.filter((g) => g.result === "W").length;
  const base = 70;
  return Math.round(Math.min(99, base + wins * 5 + games[0].scoreDiff / 3));
}

function avgScoreDiff(games: GameLog[]): number {
  if (!games.length) return 0;
  const last5 = games.slice(0, 5);
  return Number(
    (
      last5.reduce((acc, g) => acc + g.scoreDiff, 0) / last5.length
    ).toFixed(1),
  );
}

function avgPoints(games: GameLog[], key: "pointsFor" | "pointsAgainst"): number {
  const vals = games
    .map((g) => g[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return 0;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

function netRatingLike(games: GameLog[]): number {
  const off = avgPoints(games, "pointsFor");
  const def = avgPoints(games, "pointsAgainst");
  return Number((off - def).toFixed(1));
}

function computeRecord(games: GameLog[]) {
  const wins = games.filter((g) => g.result === "W").length;
  const losses = games.filter((g) => g.result === "L").length;
  return { wins, losses };
}

function computeStreak(games: GameLog[]) {
  if (!games.length) return { type: null as "W" | "L" | null, count: 0 };
  const sorted = [...games].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (Number.isNaN(da) || Number.isNaN(db)) return 0;
    return db - da;
  });
  const first = sorted.find((g) => g.result === "W" || g.result === "L");
  if (!first) return { type: null as "W" | "L" | null, count: 0 };
  const target = first.result as "W" | "L";
  let count = 0;
  for (const g of sorted) {
    if (g.result === target) {
      count += 1;
    } else if (g.result === (target === "W" ? "L" : "W")) {
      break;
    }
  }
  return { type: target, count };
}

type TeamStatsApi = {
  games: number;
  points: number;
  fgm: number;
  fga: number;
  fgp: string;
  tpm: number;
  tpa: number;
  tpp: string;
  ftm: number;
  fta: number;
  ftp: string;
  offReb: number;
  defReb: number;
  totReb: number;
  assists: number;
  pFouls: number;
  steals: number;
  turnovers: number;
  blocks: number;
  plusMinus: number;
};

function recordOverGames(games: GameLog[], span = 5) {
  const slice = games.slice(0, span);
  const wins = slice.filter((g) => g.result === "W").length;
  const losses = slice.filter((g) => g.result === "L").length;
  return { wins, losses };
}

function formatDateLabel(dateStr: string): { month: string; dayLabel: string } {
  if (!dateStr) return { month: "Unknown", dayLabel: "—" };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { month: "Unknown", dayLabel: dateStr };
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const dayLabel = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { month, dayLabel };
}

function renderGroupedRows(games: GameLog[]) {
  let currentMonth = "";
  return games.map((g) => {
    const { month, dayLabel } = formatDateLabel(g.date);
    const oppInitials =
      g.opponent
        ?.split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase() || "—";
    const rows: JSX.Element[] = [];
    if (month !== currentMonth) {
      currentMonth = month;
      rows.push(
        <tr key={`month-${month}`}>
          <td
            colSpan={7}
            className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
          >
            {month}
          </td>
        </tr>,
      );
    }
    rows.push(
      <tr
        key={`${g.date}-${g.opponent}-${month}`}
        className="rounded-2xl bg-[#0f0a12] align-middle shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
      >
        <td className="rounded-l-2xl px-3 py-2 text-sm text-slate-100">
          <div className="text-[12px] font-medium">{dayLabel}</div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            {g.homeAway === "home" ? "vs" : "@"}
          </div>
        </td>
        <td className="px-3 py-2 text-sm text-slate-100">
          <div className="flex items-center gap-2">
            {g.opponentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={g.opponentLogo}
                alt={g.opponent}
                loading="lazy"
                decoding="async"
                className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_0_6px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <span className="shrink-0 text-[10px] font-semibold text-slate-200">
                {oppInitials}
              </span>
            )}
            <span>{g.opponent}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-sm">
          <span
            className={
              "inline-flex items-center justify-center rounded-full px-2 py-[2px] text-[11px] font-semibold ring-1 " +
              (g.result === "W"
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/40"
                : g.result === "L"
                ? "bg-rose-500/10 text-rose-200 ring-rose-500/40"
                : "bg-slate-500/10 text-slate-200 ring-slate-500/30")
            }
          >
            {g.result}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-slate-200">
          {g.result === "NA" ? "Scheduled" : g.score ?? "—"}
        </td>
        <td className="px-3 py-2 text-right text-sm text-slate-200">
          {g.pointsFor ?? "—"}
        </td>
        <td className="px-3 py-2 text-right text-sm text-slate-200">
          {g.pointsAgainst ?? "—"}
        </td>
        <td className="rounded-r-2xl px-3 py-2 text-right text-sm font-semibold text-slate-100">
          {g.scoreDiff > 0 ? "+" : ""}
          {g.scoreDiff}
        </td>
      </tr>,
    );
    return <Fragment key={`${g.date}-${g.opponent}-${month}`}>{rows}</Fragment>;
  });
}

export default function TeamPreviewPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState<BetalyzeTeam | null>(null);
  const [summary, setSummary] = useState<TeamSummaryPayload["summary"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsFilter, setMetricsFilter] = useState<"global" | "home" | "away">("global");
  const [metricsResult, setMetricsResult] = useState<"all" | "wins" | "losses">("all");
  const [logFilter, setLogFilter] = useState<"global" | "home" | "away">("global");
  const [emptyGames, setEmptyGames] = useState(false);
  const [showCount, setShowCount] = useState(5);
  const [seasonType, setSeasonType] = useState<"all" | "regular" | "preseason">("all");
  const [metricsSpan, setMetricsSpan] = useState<"last5" | "last10" | "season">("last5");
  const [teamsById, setTeamsById] = useState<Record<string, BetalyzeTeam>>({});
  const [teamStats, setTeamStats] = useState<TeamStatsApi | null>(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [teamRatings, setTeamRatings] = useState<{
    offRtg: number;
    defRtg: number;
    netRtg: number;
    pace: number;
    countedGames: number;
  } | null>(null);
  const [teamRatingsLoading, setTeamRatingsLoading] = useState(false);
  const aliasMap: Record<string, string> = {
    okc: "Oklahoma City Thunder",
    oklahomacity: "Oklahoma City Thunder",
    thunder: "Oklahoma City Thunder",
    lac: "Los Angeles Clippers",
    clippers: "Los Angeles Clippers",
    losangelesclippers: "Los Angeles Clippers",
    la_clippers: "Los Angeles Clippers",
    mil: "Milwaukee Bucks",
    milwaukee: "Milwaukee Bucks",
    bucks: "Milwaukee Bucks",
    mem: "Memphis Grizzlies",
    memphis: "Memphis Grizzlies",
    grizzlies: "Memphis Grizzlies",
    den: "Denver Nuggets",
    denver: "Denver Nuggets",
    nuggets: "Denver Nuggets",
    lal: "Los Angeles Lakers",
    lakers: "Los Angeles Lakers",
    losangeleslakers: "Los Angeles Lakers",
    ind: "Indiana Pacers",
    indiana: "Indiana Pacers",
    pacers: "Indiana Pacers",
    nop: "New Orleans Pelicans",
    neworleans: "New Orleans Pelicans",
    pelicans: "New Orleans Pelicans",
    rockets: "Houston Rockets",
    hou: "Houston Rockets",
    houston: "Houston Rockets",
    jazz: "Utah Jazz",
    utah: "Utah Jazz",
    por: "Portland Trail Blazers",
    portland: "Portland Trail Blazers",
    blazers: "Portland Trail Blazers",
    trailblazers: "Portland Trail Blazers",
    heat: "Miami Heat",
    miami: "Miami Heat",
    magic: "Orlando Magic",
    orlando: "Orlando Magic",
    spurs: "San Antonio Spurs",
    sas: "San Antonio Spurs",
    sa: "San Antonio Spurs",
    sanantonio: "San Antonio Spurs",
  };

  const normalize = (val?: string | null) =>
    (val ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const resolveTeam = (raw?: string | null) => {
    if (!raw) return undefined;
    const norm = normalize(raw);
    if (!norm) return undefined;
    const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);

    // Alias direct vers un nom complet si dispo
    const aliasHit = aliasMap[norm];
    if (aliasHit) {
      const normAlias = normalize(aliasHit);
      const direct = Object.values(teamsById).find(
        (t) =>
          normalize(t.fullName) === normAlias ||
          normalize(t.name) === normAlias ||
          normalize(t.code) === normAlias,
      );
      if (direct) return direct;
    }

    // Alias par token (ex: "houston")
    for (const tok of tokens) {
      const tokAlias = aliasMap[tok];
      if (tokAlias) {
        const normAlias = normalize(tokAlias);
        const direct = Object.values(teamsById).find(
          (t) =>
            normalize(t.fullName) === normAlias ||
            normalize(t.name) === normAlias ||
            normalize(t.code) === normAlias,
        );
        if (direct) return direct;
      }
    }

    let best: { team?: BetalyzeTeam; score: number } = { score: 0 };

    Object.values(teamsById).forEach((t) => {
      const nFull = normalize(t.fullName);
      const nName = normalize(t.name);
      const nCity = normalize(t.city);
      const nCode = normalize(t.code);
      const candidates = Array.from(
        new Set(
          [nFull, nName, `${nCity}${nName}`, `${nCity}-${nName}`, nCity, nCode].filter(Boolean),
        ),
      );

      candidates.forEach((cand) => {
        if (!cand) return;
        let score = 0;
        if (cand === norm) score += 6;
        if (nCode && nCode === norm) score += 6;
        tokens.forEach((tok) => {
          if (!tok) return;
          if (cand.includes(tok)) score += 2;
          if (cand.startsWith(tok)) score += 1;
        });
        if (score > best.score) {
          best = { team: t, score };
        }
      });
    });

    return best.score >= 3 ? best.team : undefined;
  };

  const resolvedId = useMemo(() => {
    const raw = params?.id;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw ?? null;
  }, [params]);

  const seasonParam = searchParams?.get("season");
  const seasonTypeParam = searchParams?.get("type");
  const defaultSeason =
    process.env.NEXT_PUBLIC_APISPORTS_BASKETBALL_SEASON ?? "2025-2026";
  const season = seasonParam || defaultSeason;
  useEffect(() => {
    if (seasonTypeParam === "preseason" || seasonTypeParam === "regular") {
      setSeasonType(seasonTypeParam);
    }
  }, [seasonTypeParam]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!resolvedId) {
        setError("ID équipe manquant");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/nba/teams?season=${season}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch teams failed");
        const data = (await res.json()) as TeamsApiPayload;
        const map = data.teams.reduce<Record<string, BetalyzeTeam>>((acc, t) => {
          acc[String(t.id)] = t;
          return acc;
        }, {});
        setTeamsById(map);
        const match = data.teams.find(
          (t) => String(t.id) === String(resolvedId),
        );
        if (!match) {
          setError("Équipe introuvable");
          setTeam(null);
        } else {
          setTeam(match);
        }
        // Stats avancées (totaux saison) via API-Sports v2
        try {
          setTeamStatsLoading(true);
          const statsRes = await fetch(`/api/nba/teams/${resolvedId}/stats`);
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            setTeamStats(statsJson?.stats ?? null);
          } else {
            setTeamStats(null);
          }
        } catch {
          setTeamStats(null);
        } finally {
          setTeamStatsLoading(false);
        }
        // Ratings Off/Def basés sur boxscores (possessions réelles)
        try {
          setTeamRatingsLoading(true);
          const ratingsRes = await fetch(`/api/nba/teams/${resolvedId}/ratings`);
          if (ratingsRes.ok) {
            const ratingsJson = await ratingsRes.json();
            setTeamRatings(ratingsJson?.ratings ?? null);
          } else {
            setTeamRatings(null);
          }
        } catch {
          setTeamRatings(null);
        } finally {
          setTeamRatingsLoading(false);
        }
        try {
          const sumRes = await fetch(
            `/api/nba/teams/${resolvedId}/summary?season=${season}&refresh=1`,
            { signal: controller.signal, cache: "no-store" },
          );
          if (sumRes.ok) {
            const dataSum = (await sumRes.json()) as TeamSummaryPayload;
            setSummary(dataSum.summary ?? undefined);
            setEmptyGames(!(dataSum.summary?.games?.length > 0));
          } else {
            setSummary(undefined);
            setEmptyGames(true);
          }
        } catch {
          if (!controller.signal.aborted) {
            setSummary(undefined);
            setEmptyGames(true);
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Équipe introuvable");
          setTeam(null);
        }
      } finally {
        setLoading(false);
      }
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

  if (!team || error) {
    return (
      <main className="min-h-screen bg-[#050308] text-slate-100 flex items-center justify-center px-4">
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-400">{error ?? "Équipe introuvable"}</p>
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

  const gamesRaw =
    summary?.games
      ?.map((g) => {
        const opponentTeam = g.opponentId
          ? teamsById[String(g.opponentId)]
          : undefined;
        const fallbackTeam =
          !opponentTeam && g.opponentName ? resolveTeam(g.opponentName) : undefined;
        const opponentLogo = opponentTeam?.logo ?? fallbackTeam?.logo ?? null;

        return {
          date: g.date,
          opponent: opponentTeam?.fullName ?? fallbackTeam?.fullName ?? g.opponentName ?? "—",
          opponentLogo,
          homeAway: g.homeAway,
          result: g.result,
          score: g.score ?? "—",
          scoreDiff: g.scoreDiff ?? 0,
          pointsFor: g.pointsFor,
          pointsAgainst: g.pointsAgainst,
          isScheduled: g.isScheduled,
          isPreseason: g.isPreseason,
        };
      })
      // on enlève les matchs sans score réel (0-0 ou score manquant)
      .filter((g) => {
        if (g.isScheduled) return false;
        if (!g.score || g.score === "—") return false;
        if (g.score === "0-0") return false;
        const [a, b] = g.score.split("-").map((v) => Number(v.trim()));
        if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
        return a !== 0 || b !== 0;
      }) ?? [];

  const recordBase = gamesRaw.filter((g) => !g.isPreseason);
  const seasonRecord = computeRecord(recordBase);
  const streak = computeStreak(recordBase);

  const metricsFiltered =
    metricsFilter === "home"
      ? gamesRaw.filter((g) => g.homeAway === "home")
      : metricsFilter === "away"
      ? gamesRaw.filter((g) => g.homeAway === "away")
      : gamesRaw;

  const metricsFilteredResult =
    metricsResult === "wins"
      ? metricsFiltered.filter((g) => g.result === "W")
      : metricsResult === "losses"
      ? metricsFiltered.filter((g) => g.result === "L")
      : metricsFiltered;

  const typeFilteredMetrics =
    seasonType === "preseason"
      ? metricsFilteredResult.filter((g) => g.isPreseason)
      : metricsFilteredResult.filter((g) => !g.isPreseason);

  const logFiltered =
    logFilter === "home"
      ? gamesRaw.filter((g) => g.homeAway === "home")
      : logFilter === "away"
      ? gamesRaw.filter((g) => g.homeAway === "away")
      : gamesRaw;

  const typeFilteredLogs =
    seasonType === "preseason"
      ? logFiltered.filter((g) => g.isPreseason)
      : logFiltered.filter((g) => !g.isPreseason);

  const visibleGames = typeFilteredLogs.slice(0, Math.max(5, showCount));

  const teamScore = computeTeamScore(gamesRaw);
  const currentSet =
    metricsSpan === "last5"
      ? typeFilteredMetrics.slice(0, 5)
      : metricsSpan === "last10"
      ? typeFilteredMetrics.slice(0, 10)
      : typeFilteredMetrics;
  const diffLast5 = avgScoreDiff(currentSet);
  const offRating = avgPoints(currentSet, "pointsFor");
  const defRating = avgPoints(currentSet, "pointsAgainst");
  const netRating = netRatingLike(currentSet);
  const paceApprox = avgPoints(currentSet, "pointsFor") + avgPoints(currentSet, "pointsAgainst");
  const gamesStats = teamStats?.games ?? 0;
  const totalsPoss =
    teamStats && teamStats.fga + 0.44 * teamStats.fta + teamStats.turnovers - teamStats.offReb;
  const offRatingAdv =
    teamRatings?.offRtg ??
    (teamStats && totalsPoss && totalsPoss > 0
      ? Number(((teamStats.points / totalsPoss) * 100).toFixed(1))
      : null);
  const paceFromStats =
    teamRatings?.pace ??
    (teamStats && gamesStats > 0 && totalsPoss !== null && totalsPoss !== undefined
      ? Number((totalsPoss / gamesStats).toFixed(1))
      : null);
  const useSeasonStats =
    metricsSpan === "season" &&
    metricsFilter === "global" &&
    metricsResult === "all" &&
    seasonType !== "preseason";
  const seasonRegularGames = gamesRaw.filter((g) => !g.isPreseason);
  const pointsAgainstSeason =
    useSeasonStats && seasonRegularGames.length > 0
      ? avgPoints(seasonRegularGames, "pointsAgainst")
      : null;
  const defRatingAdv =
    teamRatings?.defRtg ??
    (useSeasonStats && pointsAgainstSeason !== null && paceFromStats
      ? Number(((pointsAgainstSeason * 100) / paceFromStats).toFixed(1))
      : null);
  const offRatingDisplay = useSeasonStats && offRatingAdv !== null ? offRatingAdv : offRating;
  const defRatingDisplay = useSeasonStats && defRatingAdv !== null ? defRatingAdv : defRating;
  const netRatingDisplay =
    useSeasonStats && offRatingAdv !== null && defRatingAdv !== null
      ? Number((offRatingAdv - defRatingAdv).toFixed(1))
      : netRating;
  const paceDisplay = useSeasonStats && paceFromStats !== null ? paceFromStats : paceApprox;
  const ratingSourceNote =
    useSeasonStats && teamRatings
      ? `Ratings boxscore (last ${teamRatings.countedGames} games)`
      : useSeasonStats && teamStats
      ? "Ratings stats saison"
      : "Ratings calculés sur le filtre affiché";

  const fga = teamStats?.fga ?? 0;
  const fgm = teamStats?.fgm ?? 0;
  const tpa = teamStats?.tpa ?? 0;
  const tpm = teamStats?.tpm ?? 0;
  const fta = teamStats?.fta ?? 0;
  const pointsTotal = teamStats?.points ?? 0;

  const efg = fga > 0 ? (fgm + 0.5 * tpm) / fga : null;
  const ts =
    fga + 0.44 * fta > 0 ? pointsTotal / (2 * (fga + 0.44 * fta)) : null;
  const threeRate = fga > 0 ? tpa / fga : null;
  const ftRate = fga > 0 ? fta / fga : null;
  const tovPerc =
    totalsPoss && totalsPoss > 0 ? (teamStats?.turnovers ?? 0) / totalsPoss : null;
  const record5 = recordOverGames(currentSet, 5);
  const handleTypeChange = (val: "all" | "regular" | "preseason") => {
    setSeasonType(val);
  };

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-6">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/nba"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b090f] px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm hover:border-white/25 hover:bg-[#110f17]"
          >
            ← Retour NBA
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40">
              Betalyze Team
            </span>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-[#0b0a0f] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {team.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.logo}
                  alt={team.fullName}
                  className="h-14 w-14 rounded-2xl border border-white/10 bg-black/40 object-contain p-2 ring-1 ring-amber-400/40"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-lg font-semibold text-amber-300 ring-1 ring-amber-400/40">
                  {team.name.slice(0, 3).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                  Team overview
                </p>
                <h1 className="text-2xl font-semibold text-slate-50">
                  {team.fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <span className="font-medium">
                    {team.name.toUpperCase()}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  <span>{team.conference} Conference</span>
                  {team.division && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      <span>{team.division}</span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-200 ring-1 ring-emerald-500/30">
                    Record {seasonRecord.wins}-{seasonRecord.losses}
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 " +
                      (streak.type === "W"
                        ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                        : streak.type === "L"
                        ? "bg-rose-500/10 text-rose-200 ring-rose-500/30"
                        : "bg-slate-500/10 text-slate-200 ring-slate-500/30")
                    }
                  >
                    {streak.type ? `Streak ${streak.type}${streak.count}` : "Streak —"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 font-medium text-orange-200 ring-1 ring-orange-500/30">
                    4e à l&apos;Ouest
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f0a12] px-4 py-3 text-sm w-full max-w-md">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  <span>Betalyze Team Score</span>
                  <span className="rounded-full bg-black/40 px-3 py-[5px] text-[10px] font-semibold tracking-[0.18em] text-slate-200">
                    Based on last 5
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold text-amber-200">
                        {teamScore}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-slate-400">
                      Indicateur maison combinant forme récente et dynamique.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-2xl bg-black/60 px-3 py-2 ring-1 ring-white/10 text-center min-w-[110px]">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        Saison
                      </p>
                      <div className="mt-1 text-xs font-semibold text-slate-100">
                        {season}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-black/60 px-3 py-2 ring-1 ring-white/10 text-center min-w-[72px]">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        Pace
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold text-slate-100">
                        {paceDisplay ? paceDisplay.toFixed(1) : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/60 px-3 py-2 ring-1 ring-white/10 text-center min-w-[80px]">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        Form
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold text-slate-100 leading-tight">
                        {record5.wins}-{record5.losses}
                        <br />
                        (last 5)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-white/10 border-t-amber-500/40 bg-[#0b0a0f] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Team metrics & splits
                  </p>
                  <p className="text-xs text-slate-500">
                    Vue rapide des forces/faiblesses.
                  </p>
                </div>
                <div className="px-0 py-0">
                  <select
                    aria-label="Portée"
                    value={metricsSpan}
                    onChange={(e) => setMetricsSpan(e.target.value as any)}
                    className="rounded-full bg-gradient-to-r from-amber-500/12 via-[#0b0a12] to-amber-500/12 px-3 py-1.5 text-[10px] text-amber-100 ring-1 ring-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-300/70"
                  >
                    <option value="season">Season</option>
                    <option value="last10">Last 10</option>
                    <option value="last5">Last 5</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] sm:justify-end sm:text-[10px]">
                <label className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-black/70 via-black/60 to-black/70 px-2.5 py-1.5 text-slate-200 shadow-inner shadow-black/40">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-slate-400">
                    Home/Away
                  </span>
                  <select
                    value={metricsFilter}
                    onChange={(e) => setMetricsFilter(e.target.value as any)}
                    className="rounded-full bg-gradient-to-r from-amber-500/12 via-[#0b0a12] to-amber-500/12 px-2.5 py-1 text-[10px] text-amber-100 ring-1 ring-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-300/70"
                  >
                    <option value="global">Global</option>
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-black/70 via-black/60 to-black/70 px-2.5 py-1.5 text-slate-200 shadow-inner shadow-black/40">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-slate-400">
                    Résultat
                  </span>
                  <select
                    value={metricsResult}
                    onChange={(e) => setMetricsResult(e.target.value as any)}
                    className="rounded-full bg-gradient-to-r from-amber-500/12 via-[#0b0a12] to-amber-500/12 px-2.5 py-1 text-[10px] text-amber-100 ring-1 ring-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-300/70"
                  >
                    <option value="all">All</option>
                    <option value="wins">Win</option>
                    <option value="losses">Loss</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <MetricCard
                label="Off rating"
                value={
                  offRatingDisplay !== null && offRatingDisplay !== undefined
                    ? offRatingDisplay.toString()
                    : "—"
                }
                detail="Points pour / 100 poss"
                hint="Points marqués par 100 possessions (stats API si dispo, sinon moyenne)"
                color="from-orange-500/20 via-amber-500/20 to-orange-500/20"
                ring="ring-amber-400/60"
              />
              <MetricCard
                label="Def rating"
                value={
                  defRatingDisplay !== null && defRatingDisplay !== undefined
                    ? defRatingDisplay.toString()
                    : "—"
                }
                detail="Points contre / 100 poss"
                hint="Points encaissés par 100 possessions (proxy possessions si pas de stat opposée)"
                color="from-sky-500/20 via-blue-500/20 to-sky-500/20"
                ring="ring-sky-400/60"
              />
              <MetricCard
                label="Pace"
                value={paceDisplay ? paceDisplay.toString() : "—"}
                detail="Volume points (approx.)"
                hint="Points pour + points contre (approximatif, filtre courant)"
                color="from-emerald-500/20 via-teal-500/20 to-emerald-500/20"
                ring="ring-emerald-400/60"
              />
              <MetricCard
                label="Net rating"
                value={
                  netRatingDisplay !== null && netRatingDisplay !== undefined
                    ? `${netRatingDisplay > 0 ? "+" : ""}${netRatingDisplay}`
                    : "—"
                }
                detail="Forme générale / 100 poss"
                hint="OffRtg - DefRtg sur 100 possessions"
                color="from-fuchsia-500/20 via-purple-500/20 to-fuchsia-500/20"
                ring="ring-fuchsia-400/60"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Globalement, équipe plutôt offensive avec un net rating positif et une bonne dynamique récente.
                </span>
                <span className="text-[11px] text-slate-500">{ratingSourceNote}</span>
              </div>
            </div>
            {teamStats && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
                <div className="relative rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    eFG%
                  </div>
                  <div className="text-sm font-semibold text-amber-100">
                    {efg !== null ? `${(efg * 100).toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">Poids des 3pts inclus</div>
                  <span className="group absolute bottom-2 right-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-6 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                      Effective FG% = (FGM + 0.5*3PM) / FGA
                    </div>
                  </span>
                </div>
                <div className="relative rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    TS%
                  </div>
                  <div className="text-sm font-semibold text-amber-100">
                    {ts !== null ? `${(ts * 100).toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">Efficacité tir + LF</div>
                  <span className="group absolute bottom-2 right-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-6 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                      True Shooting% = Points / (2*(FGA + 0.44*FTA))
                    </div>
                  </span>
                </div>
                <div className="relative rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    3P Rate
                  </div>
                  <div className="text-sm font-semibold text-amber-100">
                    {threeRate !== null ? `${(threeRate * 100).toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">Part des tirs à 3 pts</div>
                  <span className="group absolute bottom-2 right-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-6 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                      Part des tirs pris à 3 pts = 3PA / FGA
                    </div>
                  </span>
                </div>
                <div className="relative rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    FT Rate
                  </div>
                  <div className="text-sm font-semibold text-amber-100">
                    {ftRate !== null ? `${(ftRate * 100).toFixed(2)}` : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">LF tentés / FGA</div>
                  <span className="group absolute bottom-2 right-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-6 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                      LF tentés par tir tenté = FTA / FGA
                    </div>
                  </span>
                </div>
                <div className="relative rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    TOV%
                  </div>
                  <div className="text-sm font-semibold text-amber-100">
                    {tovPerc !== null ? `${(tovPerc * 100).toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">Pertes de balle / poss.</div>
                  <span className="group absolute bottom-2 right-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-6 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
                      Pertes de balle par possession estimée
                    </div>
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 border-t-amber-500/40 bg-[#0b0a0f] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                Game Log
              </p>
              <p className="text-xs text-slate-500">
                Derniers matchs. Filtre par lieu ou portée.
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              Saison : <span className="font-semibold text-slate-200">{summary?.season ?? "—"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-full bg-black/60 p-1 text-[11px]">
              {(["global", "home", "away"] as const).map((mode) => {
                return (
                  <button
                    key={mode}
                    onClick={() => setLogFilter(mode)}
                    className={
                      "rounded-full px-2.5 py-1 transition " +
                      (logFilter === mode
                        ? "bg-amber-500/20 text-amber-200"
                        : "text-slate-400")
                    }
                  >
                    {mode === "global" ? "All" : mode === "home" ? "Home" : "Away"}
                  </button>
                );
              })}
            </div>
            <div className="inline-flex rounded-full bg-black/60 p-1 text-[11px]">
              {(["all", "regular", "preseason"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={
                    "rounded-full px-2.5 py-1 transition " +
                    (seasonType === t
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400")
                  }
                >
                  {t === "all" ? "All" : t === "regular" ? "Saison" : "Pré-saison"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm text-slate-100">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Opp</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-left">Score</th>
                  <th className="px-3 py-2 text-right">Pts For</th>
                  <th className="px-3 py-2 text-right">Pts Against</th>
                  <th className="px-3 py-2 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {visibleGames.length > 0 ? (
                  renderGroupedRows(visibleGames)
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-[12px]">
                      Aucun match trouvé pour cette saison. Essaie d&apos;ajouter &quot;?refresh=1&quot; dans l&apos;URL ou de vérifier l&apos;ID / saison.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {typeFilteredLogs.length > 5 && (
            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() =>
                  setShowCount((prev) =>
                    prev >= typeFilteredLogs.length
                      ? 5
                      : Math.min(prev + 5, typeFilteredLogs.length),
                  )
                }
                className="text-[11px] font-medium text-amber-300 hover:text-amber-200"
              >
                {showCount >= typeFilteredLogs.length
                  ? "Voir moins de matchs"
                  : "Voir plus de matchs"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  hint,
  color = "from-amber-500/10 via-orange-500/10 to-emerald-500/10",
  ring = "ring-amber-400/40",
}: {
  label: string;
  value: string;
  detail: string;
  hint?: string;
  color?: string;
  ring?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${color} px-3 py-2.5 ring-1 ${ring}`}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300">{label}</p>
      <p className="mt-1 text-base font-semibold text-amber-200">{value}</p>
      <p className="text-[11px] text-slate-300/90">{detail}</p>
      {hint ? (
        <>
          <span
            className="group absolute bottom-2 right-2"
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-amber-100"
              title={hint}
            >
              !
            </span>
            <div className="pointer-events-none absolute bottom-8 right-0 z-10 w-44 rounded-lg bg-black/80 px-3 py-2 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">
              {hint}
            </div>
          </span>
        </>
      ) : null}
    </div>
  );
}
