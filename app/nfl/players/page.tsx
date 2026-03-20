"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

type NflTeamMeta = {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
};

type TopProp = {
  playerId: number;
  player: string;
  teamId: number;
  opponentId: number;
  position: string | null;
  market: string;
  metric: string;
  side: "over" | "under";
  line: number;
  odds: number;
  score: number;
  grade: string;
  edge: number;
  finalScore: number;
  dvpRank?: number | null;
  dvpCount?: number | null;
  dvpFlag?: "weakness" | "strength" | "neutral" | null;
};

const DEFAULT_SEASON = "2025";
const PROP_METRIC_LABELS: Record<string, string> = {
  passYds: "Pass Yds",
  passTD: "Pass TD",
  completions: "Cmp",
  attempts: "Att",
  passLong: "Pass LNG",
  ints: "INT",
  rushYds: "Rush Yds",
  rushTD: "Rush TD",
  rushLng: "Rush LNG",
  rec: "Rec",
  recYds: "Rec Yds",
  recTD: "Rec TD",
  recLng: "Rec LNG",
};

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

const TEAM_PRIMARY_BY_CODE: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#311D00",
  DAL: "#041E42",
  DEN: "#002244",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#03202F",
  IND: "#002C5F",
  JAX: "#006778",
  KC: "#E31837",
  LV: "#000000",
  LAC: "#0080C6",
  LAR: "#003594",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SF: "#AA0000",
  SEA: "#002244",
  TB: "#D50A0A",
  TEN: "#0C2340",
  WAS: "#5A1414",
};

const DEFAULT_PRIMARY = "#F59E0B";

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTeamPrimaryColor = (teamName?: string | null, teamCode?: string | null) => {
  const nameKey = teamName?.toLowerCase();
  if (nameKey && TEAM_PRIMARY_BY_NAME[nameKey]) return TEAM_PRIMARY_BY_NAME[nameKey];
  const codeKey = teamCode?.toUpperCase();
  if (codeKey && TEAM_PRIMARY_BY_CODE[codeKey]) return TEAM_PRIMARY_BY_CODE[codeKey];
  return DEFAULT_PRIMARY;
};

export default function NflPlayersPage() {
  const [teams, setTeams] = useState<NflTeamMeta[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [topProps, setTopProps] = useState<TopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [topPropsMeta, setTopPropsMeta] = useState<{
    generatedAt?: string;
    cached?: boolean;
    events?: number;
  } | null>(null);
  const [topPropsLoaded, setTopPropsLoaded] = useState(false);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        setTeamsLoading(true);
        setTeamsError(null);
        const res = await fetch(`/api/nfl/teams?season=${DEFAULT_SEASON}`);
        if (!res.ok) throw new Error("Failed to fetch NFL teams");
        const data = await res.json();
        const list: NflTeamMeta[] = Array.isArray(data?.response)
          ? data.response
              .map((t: any) => {
                const id = Number(t?.id ?? t?.team?.id);
                const name = t?.name ?? t?.team?.name ?? "Team";
                if (!Number.isFinite(id)) return null;
                return {
                  id,
                  name,
                  code: t?.code ?? t?.team?.code ?? null,
                  logo: t?.logo ?? t?.team?.logo ?? null,
                };
              })
              .filter(Boolean)
          : [];
        setTeams(list);
      } catch (err: any) {
        setTeamsError(err?.message || "Unknown error");
      } finally {
        setTeamsLoading(false);
      }
    };
    loadTeams();
  }, []);

  const loadTopProps = async (refresh: boolean) => {
    try {
      setTopPropsLoading(true);
      setTopPropsError(null);
      const url = new URL("/api/nfl/props/top", window.location.origin);
      if (refresh) {
        url.searchParams.set("refresh", "1");
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch top props");
      const data = await res.json();
      const list: TopProp[] = Array.isArray(data?.props) ? data.props : [];
      setTopProps(list);
      setTopPropsMeta({
        generatedAt: data?.generatedAt,
        cached: data?.cached,
        events: data?.events,
      });
      setTopPropsLoaded(true);
    } catch (err: any) {
      setTopPropsError(err?.message || "Unknown error");
      setTopPropsLoaded(true);
    } finally {
      setTopPropsLoading(false);
    }
  };

  useEffect(() => {
    if (topPropsLoaded || topPropsLoading) return;
    loadTopProps(false);
  }, [topPropsLoaded, topPropsLoading]);

  const teamMetaById = useMemo(() => {
    const map = new Map<number, { name?: string | null; code?: string | null; logo?: string | null }>();
    teams.forEach((team) => {
      map.set(team.id, { name: team.name, code: team.code, logo: team.logo });
    });
    return map;
  }, [teams]);

  const formatDecimal = (value: number | null | undefined, digits = 2) => {
    if (!Number.isFinite(value ?? NaN)) return "—";
    return Number(value).toFixed(digits);
  };

  const formatEdge = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return "—";
    const num = Number(value) * 100;
    return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
  };

  const metricLabel = (metric: string | null | undefined) => {
    if (!metric) return "Metric";
    return PROP_METRIC_LABELS[metric] ?? metric.toUpperCase();
  };

  const gradeTone = (grade: string | null | undefined) => {
    if (!grade) return "bg-white/5 text-slate-200 ring-white/10";
    if (grade.startsWith("A")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40";
    if (grade.startsWith("B")) return "bg-sky-500/15 text-sky-200 ring-sky-400/40";
    if (grade.startsWith("C")) return "bg-amber-500/15 text-amber-200 ring-amber-400/40";
    if (grade.startsWith("D")) return "bg-rose-500/15 text-rose-200 ring-rose-400/40";
    return "bg-rose-600/25 text-rose-100 ring-rose-400/40";
  };

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100 px-4 pb-10 pt-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-50">NFL Players / Props</h1>
            <p className="text-sm text-slate-400">
              Best props de la semaine (refresh manuel).
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadTopProps(true)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-400/60 hover:text-amber-200"
            disabled={topPropsLoading}
          >
            Rafraichir
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#0b090f] p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/50">
              <Sparkles className="h-4 w-4 text-amber-200" />
            </div>
            <div>
              <p className="text-[15px] font-semibold uppercase tracking-[0.12em] text-slate-100">
                Best props weekly
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Top 10 props de la ligue (refresh manuel).
              </p>
              {topPropsMeta?.generatedAt && (
                <p className="mt-2 text-[10px] text-slate-500">
                  Maj: {new Date(topPropsMeta.generatedAt).toLocaleString("fr-CA")}
                  {topPropsMeta.cached ? " · cache" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
            {teamsLoading && (
              <span className="text-[10px] text-slate-500">Chargement equipes…</span>
            )}
            {teamsError && (
              <span className="text-[10px] text-rose-300">{teamsError}</span>
            )}
          </div>

          {topPropsError && (
            <p className="mt-3 text-xs text-rose-300">{topPropsError}</p>
          )}
          {topPropsLoading && (
            <p className="mt-3 text-xs text-slate-400">Chargement des props...</p>
          )}
          {!topPropsLoading && !topPropsLoaded && (
            <p className="mt-3 text-xs text-slate-500">
              Clique sur Rafraichir pour charger les meilleures props.
            </p>
          )}
          {!topPropsLoading && topPropsLoaded && topProps.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">Aucune prop disponible.</p>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topProps.map((prop) => {
              const team = teamMetaById.get(prop.teamId);
              const opp = teamMetaById.get(prop.opponentId);
              const teamLabel = team?.code ?? team?.name ?? "Team";
              const oppLabel = opp?.code ?? opp?.name ?? "Opp";
              const posLabel = prop.position ?? "POS";
              const sideLabel = prop.side === "over" ? "O" : "U";
              const primary = getTeamPrimaryColor(team?.name, team?.code ?? teamLabel);
              const primarySoft = hexToRgba(primary, 0.22);
              const primaryMid = hexToRgba(primary, 0.12);
              const primaryLine = hexToRgba(primary, 0.55);
              const oppPrimary = getTeamPrimaryColor(opp?.name, opp?.code ?? oppLabel);
              const oppChipBg = hexToRgba(oppPrimary, 0.18);
              const oppChipRing = hexToRgba(oppPrimary, 0.28);
              const dvpLabel =
                prop.dvpRank && prop.dvpCount
                  ? `DvP ${metricLabel(prop.metric)} #${prop.dvpRank}/${prop.dvpCount}`
                  : null;
              return (
                <div
                  key={`${prop.playerId}-${prop.market}-${prop.side}`}
                  className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 px-4 py-3"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${primarySoft} 0%, ${primaryMid} 45%, rgba(3, 3, 7, 0.85) 100%)`,
                    boxShadow: `inset 0 1px 0 ${primaryLine}`,
                    borderColor: primaryLine,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-20 opacity-50"
                    style={{
                      background: `linear-gradient(90deg, ${hexToRgba(
                        primary,
                        0.35,
                      )} 0%, rgba(0,0,0,0) 100%)`,
                    }}
                  />
                  <div className="relative z-10 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/nfl/players/${prop.playerId}`}
                        className="truncate text-[13px] font-semibold text-slate-100 hover:text-amber-200"
                      >
                        {prop.player}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        {posLabel} · {teamLabel}
                        {team?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo}
                            alt={team?.name ?? teamLabel}
                            className="h-4 w-4 object-contain"
                          />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      vs {oppLabel} · {metricLabel(prop.metric)} {sideLabel}{" "}
                      {formatDecimal(prop.line, 1)} @ {formatDecimal(prop.odds, 2)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="rounded-full bg-white/5 px-2 py-0.5">
                        Edge {formatEdge(prop.edge)}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5">
                        Score {formatDecimal(prop.score, 0)}
                      </span>
                      {dvpLabel && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-slate-100"
                          style={{ backgroundColor: oppChipBg, borderColor: oppChipRing }}
                        >
                          {opp?.logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opp.logo}
                              alt={opp?.name ?? oppLabel}
                              className="h-3.5 w-3.5 object-contain"
                            />
                          )}
                          {dvpLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`relative z-10 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${gradeTone(
                      prop.grade,
                    )}`}
                  >
                    {prop.grade}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
