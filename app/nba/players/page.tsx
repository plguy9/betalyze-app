"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";

type NbaTeamMeta = {
  id: number;
  name: string;
  fullName: string | null;
  code: string | null;
  logo: string | null;
};

type NbaPlayer = {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId: number | null;
  position: string | null;
};

type PlayersResponse = {
  season: string;
  updatedAt: string;
  count: number;
  players: NbaPlayer[];
};

type TeamsApiPayload = {
  teams?: Array<{
    id: number;
    name?: string | null;
    fullName?: string | null;
    code?: string | null;
    logo?: string | null;
  }>;
};

type TopProp = {
  playerId: number;
  player: string;
  teamId: number;
  opponentId: number;
  position: string | null;
  metric: string;
  side: "over" | "under";
  line: number;
  odds: number;
  score: number;
  grade: string;
  edge: number;
};

const MOCK_TOP_PROPS: TopProp[] = [
  {
    playerId: 621,
    player: "Nikola Jokic",
    teamId: 139,
    opponentId: 145,
    position: "C",
    metric: "pts",
    side: "over",
    line: 26.5,
    odds: -115,
    score: 93,
    grade: "A",
    edge: 0.09,
  },
  {
    playerId: 526,
    player: "Jayson Tatum",
    teamId: 133,
    opponentId: 151,
    position: "F",
    metric: "pts",
    side: "over",
    line: 29.5,
    odds: -110,
    score: 90,
    grade: "A-",
    edge: 0.06,
  },
  {
    playerId: 661,
    player: "Stephen Curry",
    teamId: 141,
    opponentId: 157,
    position: "G",
    metric: "3pm",
    side: "over",
    line: 4.5,
    odds: -105,
    score: 88,
    grade: "B+",
    edge: 0.05,
  },
  {
    playerId: 807,
    player: "Giannis Antetokounmpo",
    teamId: 148,
    opponentId: 154,
    position: "F",
    metric: "reb",
    side: "over",
    line: 11.5,
    odds: -120,
    score: 89,
    grade: "A-",
    edge: 0.07,
  },
  {
    playerId: 612,
    player: "Luka Doncic",
    teamId: 138,
    opponentId: 139,
    position: "G",
    metric: "pra",
    side: "over",
    line: 49.5,
    odds: -110,
    score: 92,
    grade: "A",
    edge: 0.08,
  },
  {
    playerId: 878,
    player: "Shai Gilgeous-Alexander",
    teamId: 152,
    opponentId: 140,
    position: "G",
    metric: "pts",
    side: "over",
    line: 30.5,
    odds: -115,
    score: 90,
    grade: "A-",
    edge: 0.06,
  },
  {
    playerId: 820,
    player: "Anthony Edwards",
    teamId: 149,
    opponentId: 155,
    position: "G",
    metric: "pts",
    side: "over",
    line: 28.5,
    odds: -110,
    score: 87,
    grade: "B+",
    edge: 0.04,
  },
  {
    playerId: 910,
    player: "Joel Embiid",
    teamId: 154,
    opponentId: 148,
    position: "C",
    metric: "pts",
    side: "over",
    line: 31.5,
    odds: -115,
    score: 91,
    grade: "A",
    edge: 0.07,
  },
  {
    playerId: 747,
    player: "LeBron James",
    teamId: 145,
    opponentId: 141,
    position: "F",
    metric: "ast",
    side: "over",
    line: 7.5,
    odds: -105,
    score: 86,
    grade: "B",
    edge: 0.03,
  },
  {
    playerId: 932,
    player: "Devin Booker",
    teamId: 155,
    opponentId: 149,
    position: "G",
    metric: "pts",
    side: "over",
    line: 27.5,
    odds: -110,
    score: 86,
    grade: "B",
    edge: 0.04,
  },
];

const PROP_METRIC_LABELS: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  pra: "PRA",
  "3pm": "3PM",
  blk: "BLK",
  stl: "STL",
};

const TEAM_PRIMARY_BY_CODE: Record<string, string> = {
  ATL: "#E03A3E",
  BOS: "#007A33",
  BKN: "#000000",
  CHA: "#1D1160",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#0E2240",
  DET: "#C8102E",
  GSW: "#1D428A",
  HOU: "#CE1141",
  IND: "#002D62",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#0C2340",
  NOP: "#0C2340",
  NYK: "#006BB6",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHX: "#1D1160",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SAS: "#C4CED4",
  TOR: "#CE1141",
  UTA: "#002B5C",
  WAS: "#002B5C",
};

const DEFAULT_PRIMARY = "#F59E0B";
const MAX_SUGGESTIONS = 10;

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTeamPrimaryColor = (teamCode?: string | null) => {
  const codeKey = teamCode?.toUpperCase();
  if (codeKey && TEAM_PRIMARY_BY_CODE[codeKey]) return TEAM_PRIMARY_BY_CODE[codeKey];
  return DEFAULT_PRIMARY;
};

const shuffleList = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function formatPlayerName(player: NbaPlayer): string {
  const fromParts = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;

  const raw = player.fullName?.trim();
  if (!raw) return `Player #${player.id}`;

  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts.pop();
    const last = parts.join(" ");
    return `${first} ${last}`.trim();
  }

  return raw;
}

const formatDecimal = (value: number | null | undefined, digits = 2) => {
  if (!Number.isFinite(value ?? NaN)) return "-";
  return Number(value).toFixed(digits);
};

const formatEdge = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN)) return "-";
  const num = Number(value) * 100;
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
};

const formatOdds = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN)) return "-";
  const num = Math.round(Number(value));
  return num > 0 ? `+${num}` : `${num}`;
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

const cn = (...classes: Array<string | null | undefined | false>) =>
  classes.filter(Boolean).join(" ");

export default function NbaPlayersPage() {
  const [teams, setTeams] = useState<NbaTeamMeta[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<NbaPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [topProps, setTopProps] = useState<TopProp[]>(() => shuffleList(MOCK_TOP_PROPS));
  const [topPropsMeta, setTopPropsMeta] = useState(() => ({
    generatedAt: new Date().toISOString(),
    source: "mock",
  }));

  useEffect(() => {
    const loadTeams = async () => {
      try {
        setTeamsLoading(true);
        setTeamsError(null);
        const res = await fetch("/api/nba/teams");
        if (!res.ok) throw new Error("Failed to fetch NBA teams");
        const data: TeamsApiPayload = await res.json();
        const list: NbaTeamMeta[] = Array.isArray(data?.teams)
          ? data.teams
              .map((t) => {
                const id = Number(t?.id);
                if (!Number.isFinite(id)) return null;
                return {
                  id,
                  name: t?.name ?? t?.fullName ?? "Team",
                  fullName: t?.fullName ?? null,
                  code: t?.code ?? null,
                  logo: t?.logo ?? null,
                };
              })
              .filter(Boolean)
          : [];
        setTeams(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setTeamsError(message);
      } finally {
        setTeamsLoading(false);
      }
    };
    loadTeams();
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
        if (!res.ok) {
          throw new Error("Failed to fetch players");
        }
        const data: PlayersResponse = await res.json();
        const list = Array.isArray(data?.players) ? data.players : [];
        const seen = new Set<number>();
        const unique = list.filter((p) => {
          const id = Number(p.id);
          if (!Number.isFinite(id)) return false;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setPlayers(unique.slice(0, MAX_SUGGESTIONS));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setPlayersError(message);
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

  const teamMetaById = useMemo(() => {
    const map = new Map<number, NbaTeamMeta>();
    teams.forEach((team) => {
      map.set(team.id, team);
    });
    return map;
  }, [teams]);

  const suggestions = useMemo(() => {
    if (search.trim().length < 2) return [];
    return players.slice(0, MAX_SUGGESTIONS).map((player) => {
      const teamId = player.teamId ?? null;
      const team = teamId ? teamMetaById.get(Number(teamId)) : undefined;
      return {
        id: String(player.id),
        label: formatPlayerName(player),
        position: player.position ?? "-",
        teamLabel: team?.code ?? team?.name ?? "NBA",
        teamLogo: team?.logo ?? null,
      };
    });
  }, [players, search, teamMetaById]);

  const refreshMock = () => {
    setTopProps(shuffleList(MOCK_TOP_PROPS));
    setTopPropsMeta({ generatedAt: new Date().toISOString(), source: "mock" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070b] px-4 pb-10 pt-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-44 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute -bottom-56 -left-44 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),transparent_65%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">NBA Players / Props</h1>
            <p className="text-sm text-slate-400/90">
              Focus joueurs NBA. Props en mock pour le moment.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshMock}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-200"
          >
            Rafraichir
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

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
            {playersLoading && (
              <span className="text-[10px] text-slate-500">Chargement joueurs...</span>
            )}
            {playersError && (
              <span className="text-[10px] text-rose-300">{playersError}</span>
            )}
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
              {suggestions.map((item) => {
                const teamPrimary = getTeamPrimaryColor(item.teamLabel);
                const softGlow = hexToRgba(teamPrimary, 0.2);
                const midGlow = hexToRgba(teamPrimary, 0.12);
                const lineGlow = hexToRgba(teamPrimary, 0.45);
                return (
                  <Link
                    key={item.id}
                    href={`/nba/players/${item.id}`}
                    className="group relative flex items-center justify-between overflow-hidden rounded-2xl border px-3 py-2 text-left text-[12px] transition hover:-translate-y-0.5 hover:border-amber-300/70"
                    style={{
                      backgroundImage: `linear-gradient(130deg, ${softGlow} 0%, ${midGlow} 42%, rgba(3,3,7,0.8) 100%)`,
                      borderColor: lineGlow,
                      boxShadow: `inset 0 1px 0 ${hexToRgba(teamPrimary, 0.5)}`,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 w-20 opacity-60"
                      style={{
                        background: `linear-gradient(90deg, ${hexToRgba(teamPrimary, 0.3)} 0%, rgba(0,0,0,0) 100%)`,
                      }}
                    />
                    <div className="relative z-10 flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10">
                        {item.teamLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.teamLogo}
                            alt={item.teamLabel}
                            className="h-6 w-6 object-contain"
                          />
                        ) : (
                          item.teamLabel.slice(0, 3).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-50">{item.label}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.position} / {item.teamLabel}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="relative z-10 h-4 w-4 text-slate-500 transition group-hover:text-amber-200" />
                  </Link>
                );
              })}
            </div>
          )}

          {!playersLoading &&
            search.trim().length >= 2 &&
            suggestions.length === 0 &&
            !playersError && (
              <p className="mt-3 text-xs text-slate-500">
                Aucun resultat pour &quot;{search.trim()}&quot;.
              </p>
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
                  Best props (mock)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Top 10 props NBA en mock. Les odds resteront fictives.
                </p>
                {topPropsMeta.generatedAt && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    Maj: {new Date(topPropsMeta.generatedAt).toLocaleString("fr-CA")} / {topPropsMeta.source}
                  </p>
                )}
              </div>
            </div>
            {teamsLoading && (
              <span className="text-[10px] text-slate-500">Chargement equipes...</span>
            )}
            {teamsError && (
              <span className="text-[10px] text-rose-300">{teamsError}</span>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topProps.map((prop) => {
              const team = teamMetaById.get(prop.teamId);
              const opp = teamMetaById.get(prop.opponentId);
              const teamLabel = team?.code ?? team?.name ?? "Team";
              const oppLabel = opp?.code ?? opp?.name ?? "Opp";
              const posLabel = prop.position ?? "POS";
              const sideLabel = prop.side === "over" ? "O" : "U";
              const primary = getTeamPrimaryColor(team?.code ?? teamLabel);
              const primarySoft = hexToRgba(primary, 0.22);
              const primaryMid = hexToRgba(primary, 0.12);
              const primaryLine = hexToRgba(primary, 0.55);
              const oppPrimary = getTeamPrimaryColor(opp?.code ?? oppLabel);
              const oppChipBg = hexToRgba(oppPrimary, 0.18);
              const oppChipRing = hexToRgba(oppPrimary, 0.28);
              return (
                <div
                  key={`${prop.playerId}-${prop.metric}-${prop.side}`}
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
                      background: `linear-gradient(90deg, ${hexToRgba(
                        primary,
                        0.35,
                      )} 0%, rgba(0,0,0,0) 100%)`,
                    }}
                  />
                  <div className="relative z-10 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/nba/players/${prop.playerId}`}
                        className="truncate text-[13px] font-semibold text-slate-100 hover:text-amber-200"
                      >
                        {prop.player}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-white/10">
                        {posLabel} / {teamLabel}
                        {team?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team.logo}
                            alt={team?.name ?? teamLabel}
                            className="h-4 w-4 object-contain"
                          />
                        )}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-300">
                        Mock
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300/90">
                      vs {oppLabel} / {metricLabel(prop.metric)} {sideLabel}{" "}
                      {formatDecimal(prop.line, 1)} @ {formatOdds(prop.odds)}
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
                          <img
                            src={opp.logo}
                            alt={opp?.name ?? oppLabel}
                            className="h-3.5 w-3.5 object-contain"
                          />
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
        </section>
      </div>
    </div>
  );
}
