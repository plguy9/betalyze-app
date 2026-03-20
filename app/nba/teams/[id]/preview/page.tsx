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
    process.env.NEXT_PUBLIC_APISPORTS_NBA_SEASON ?? "2025";
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
    <div className="relative min-h-screen overflow-hidden bg-[#06060a] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.16),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-56 -left-44 h-[580px] w-[580px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_65%)] blur-3xl" />
      </div>

      <div className="relative mx-2 w-auto px-5 pb-10 pt-5 md:mx-3 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/nba"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            ← Retour NBA
          </Link>

          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 md:flex">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-slate-300">
              BZ
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Betalyze</p>
              <p className="text-[11px] text-slate-500">Fiche équipe</p>
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[1.65fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b090f] p-4">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(249,115,22,0.22),transparent_55%)]" />
              <div className="relative z-10 flex items-start gap-4">
                {team.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logo}
                    alt={team.fullName}
                    className="h-16 w-16 rounded-2xl border border-white/10 bg-black/40 object-contain p-2"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-amber-500/15 text-lg font-semibold text-amber-300">
                    {team.name.slice(0, 3).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                    FICHE ÉQUIPE
                  </p>
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50">
                    {team.fullName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold">
                      {team.code ?? team.name.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {team.conference}
                    </span>
                    {team.division ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        {team.division}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Saison {season}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                      Record {seasonRecord.wins}-{seasonRecord.losses}
                    </span>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold " +
                        (streak.type === "W"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : streak.type === "L"
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                          : "border-white/15 bg-white/5 text-slate-300")
                      }
                    >
                      {streak.type ? `Série ${streak.type}${streak.count}` : "Série —"}
                    </span>
                    {emptyGames ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-200">
                        Données partielles
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-orange-500/25 bg-black/35 p-4 ring-1 ring-orange-500/20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_8%,rgba(249,115,22,0.2),transparent_45%)]" />
              <div className="relative z-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                  Betalyze Team Score
                </p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-4xl font-bold tracking-tight text-slate-100">
                    {teamScore}
                    <span className="text-xl text-slate-500"> /100</span>
                  </p>
                  <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-slate-300">
                    basé last 5
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Indicateur maison combinant forme, diff et momentum.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
                    <p className="text-[10px] text-slate-500">Saison</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-100">{season}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
                    <p className="text-[10px] text-slate-500">Pace</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-100">
                      {paceDisplay ? paceDisplay.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
                    <p className="text-[10px] text-slate-500">Forme</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-100">
                      {record5.wins}-{record5.losses}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-widest text-white/40">Aperçu équipe • NBA</p>
              <p className="mt-2 text-sm text-white/55">
                Metrics clés + splits pour comparer rapidement la force réelle.
              </p>
            </div>
            {(teamStatsLoading || teamRatingsLoading) && (
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-200">
                Sync stats avancées...
              </span>
            )}
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
              {(["season", "last10", "last5"] as const).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => setMetricsSpan(span)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (metricsSpan === span
                      ? "border border-orange-500/35 bg-orange-500/15 text-orange-200"
                      : "text-slate-400 hover:bg-white/10 hover:text-slate-200")
                  }
                >
                  {span === "season" ? "Saison" : span === "last10" ? "Last 10" : "Last 5"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
              {(["global", "home", "away"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMetricsFilter(mode)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (metricsFilter === mode
                      ? "border border-white/20 bg-white/10 text-slate-100"
                      : "text-slate-400 hover:bg-white/10 hover:text-slate-200")
                  }
                >
                  {mode === "global" ? "Global" : mode === "home" ? "Home" : "Away"}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
              {(["all", "wins", "losses"] as const).map((resKey) => (
                <button
                  key={resKey}
                  type="button"
                  onClick={() => setMetricsResult(resKey)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (metricsResult === resKey
                      ? "border border-white/20 bg-white/10 text-slate-100"
                      : "text-slate-400 hover:bg-white/10 hover:text-slate-200")
                  }
                >
                  {resKey === "all" ? "All" : resKey === "wins" ? "Win" : "Loss"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
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
              ring="ring-amber-400/50"
            />
            <MetricCard
              label="Def rating"
              value={
                defRatingDisplay !== null && defRatingDisplay !== undefined
                  ? defRatingDisplay.toString()
                  : "—"
              }
              detail="Points contre / 100 poss"
              hint="Points encaissés par 100 possessions"
              color="from-sky-500/20 via-blue-500/20 to-sky-500/20"
              ring="ring-sky-400/50"
            />
            <MetricCard
              label="Pace"
              value={paceDisplay ? paceDisplay.toFixed(1) : "—"}
              detail="Volume points (approx.)"
              hint="Points pour + points contre (approx.)"
              color="from-emerald-500/20 via-teal-500/20 to-emerald-500/20"
              ring="ring-emerald-400/50"
            />
            <MetricCard
              label="Net rating"
              value={
                netRatingDisplay !== null && netRatingDisplay !== undefined
                  ? `${netRatingDisplay > 0 ? "+" : ""}${netRatingDisplay}`
                  : "—"
              }
              detail="OffRtg - DefRtg"
              hint="Différence sur 100 possessions"
              color="from-fuchsia-500/20 via-purple-500/20 to-fuchsia-500/20"
              ring="ring-fuchsia-400/50"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Écart moyen récent:{" "}
                <span className={diffLast5 >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {diffLast5 > 0 ? "+" : ""}
                  {diffLast5.toFixed(1)}
                </span>
              </span>
              <span className="text-[11px] text-slate-500">{ratingSourceNote}</span>
            </div>
          </div>

          {teamStats && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">eFG%</div>
                <div className="text-sm font-semibold text-amber-100">
                  {efg !== null ? `${(efg * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">TS%</div>
                <div className="text-sm font-semibold text-amber-100">
                  {ts !== null ? `${(ts * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">3P Rate</div>
                <div className="text-sm font-semibold text-amber-100">
                  {threeRate !== null ? `${(threeRate * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">FT Rate</div>
                <div className="text-sm font-semibold text-amber-100">
                  {ftRate !== null ? `${(ftRate * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">TOV%</div>
                <div className="text-sm font-semibold text-amber-100">
                  {tovPerc !== null ? `${(tovPerc * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-widest text-white/40">Historique matchs • NBA</p>
              <p className="mt-2 text-sm text-white/55">
                Derniers matchs, avec filtres de contexte.
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              Saison : <span className="font-semibold text-slate-200">{summary?.season ?? "—"}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
              {(["global", "home", "away"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLogFilter(mode)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (logFilter === mode
                      ? "border border-orange-500/35 bg-orange-500/15 text-orange-200"
                      : "text-slate-400 hover:bg-white/10 hover:text-slate-200")
                  }
                >
                  {mode === "global" ? "All" : mode === "home" ? "Home" : "Away"}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px]">
              {(["all", "regular", "preseason"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={
                    "rounded-full px-3 py-1 transition " +
                    (seasonType === t
                      ? "border border-orange-500/35 bg-orange-500/15 text-orange-200"
                      : "text-slate-400 hover:bg-white/10 hover:text-slate-200")
                  }
                >
                  {t === "all" ? "All" : t === "regular" ? "Saison" : "Pré-saison"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm text-slate-100">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Opp</th>
                  <th className="px-3 py-2 text-left">Résultat</th>
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
                    <td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">
                      Aucun match trouvé pour ce filtre.
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
                    prev >= typeFilteredLogs.length ? 5 : Math.min(prev + 5, typeFilteredLogs.length),
                  )
                }
                className="text-[11px] font-medium text-amber-300 hover:text-amber-200"
              >
                {showCount >= typeFilteredLogs.length ? "Voir moins de matchs" : "Voir plus de matchs"}
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
