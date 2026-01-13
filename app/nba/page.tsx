"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Activity,
  Flame,
  Search as SearchIcon,
  Calendar,
  Filter,
  ArrowUpRight,
} from "lucide-react";

// Types alignés sur tes API internes
type BetalyzeNbaTeam = {
  id: number;
  name: string;
  fullName: string;
  logo: string | null;
  conference: "East" | "West" | "N/A";
};

type BetalyzeNbaTeamsPayload = {
  season: string;
  count: number;
  conferences: {
    east: number;
    west: number;
    other: number;
  };
  teams: BetalyzeNbaTeam[];
};

type NbaPlayer = {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId: number | null;
  position: string | null;
  jerseyNumber: string | null;
  nationality: string | null;
  isActive: boolean;
};

type PlayersResponse = {
  season: string;
  updatedAt: string;
  count: number;
  players: NbaPlayer[];
};

// MOCKS pour les sections "Top matchups" et "Spotlight players"
const mockTodayMeta = {
  dateLabel: "Mardi · Dec 2",
  gamesCount: 9,
};

const mockGames = [
  {
    id: 1,
    time: "19:30",
    away: "LAL",
    awayName: "Los Angeles Lakers",
    home: "BOS",
    homeName: "Boston Celtics",
    total: 231.5,
    spreadFavorite: "BOS -5.5",
    betalyzeScore: 92,
    paceTag: "High pace",
  },
  {
    id: 2,
    time: "20:00",
    away: "DEN",
    awayName: "Denver Nuggets",
    home: "DAL",
    homeName: "Dallas Mavericks",
    total: 235.5,
    spreadFavorite: "DAL -2.5",
    betalyzeScore: 88,
    paceTag: "Offense focused",
  },
  {
    id: 3,
    time: "19:00",
    away: "NYK",
    awayName: "New York Knicks",
    home: "PHI",
    homeName: "Philadelphia 76ers",
    total: 221.0,
    spreadFavorite: "PHI -3.5",
    betalyzeScore: 81,
    paceTag: "Balanced",
  },
];

const mockSpotlightPlayers = [
  {
    id: 101,
    name: "Jayson Tatum",
    team: "BOS",
    metric: "Points",
    proj: 28.7,
    line: 27.5,
    edge: "+1.2",
    betalyzeScore: 91,
  },
  {
    id: 102,
    name: "LeBron James",
    team: "LAL",
    metric: "Points",
    proj: 26.3,
    line: 24.5,
    edge: "+1.8",
    betalyzeScore: 89,
  },
  {
    id: 103,
    name: "Nikola Jokić",
    team: "DEN",
    metric: "Rebounds",
    proj: 12.4,
    line: 11.5,
    edge: "+0.9",
    betalyzeScore: 94,
  },
];

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

export default function NbaPage() {
  const [teamsPayload, setTeamsPayload] =
    useState<BetalyzeNbaTeamsPayload | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<NbaPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger les équipes au chargement de la page
  useEffect(() => {
    const loadTeams = async () => {
      try {
        setTeamsLoading(true);
        const res = await fetch("/api/nba/teams");
        if (!res.ok) {
          throw new Error("Failed to fetch NBA teams");
        }
        const data: BetalyzeNbaTeamsPayload = await res.json();
        setTeamsPayload(data);
      } catch (err: any) {
        setTeamsError(err.message ?? "Unknown error");
      } finally {
        setTeamsLoading(false);
      }
    };

    loadTeams();
  }, []);

  // Autosuggest joueurs : fetch automatique dès qu'on tape >= 2 lettres
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
        // On limite à 15 résultats pour l'autosuggest
        setPlayers(data.players.slice(0, 15));
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setPlayersError(err.message ?? "Unknown error");
      } finally {
        setPlayersLoading(false);
      }
    };

    const timeout = setTimeout(fetchPlayers, 250); // petit debounce

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];

    const teamMatches =
      teamsPayload?.teams.filter((t) => {
        const full = (t.fullName ?? "").toLowerCase();
        const name = (t.name ?? "").toLowerCase();
        const code = (t.code ?? "").toLowerCase();
        return (
          full.includes(q) ||
          name.includes(q) ||
          (code && code.includes(q))
        );
      }) ?? [];

    const playerItems = players.map((p) => ({
      type: "player" as const,
      id: p.id,
      label: formatPlayerName(p),
      meta: `${p.position ?? "Position inconnue"}${
        p.jerseyNumber ? ` · #${p.jerseyNumber}` : ""
      }`,
      href: `/nba/players/${p.id}`,
    }));

    const teamItems = teamMatches.map((t) => ({
      type: "team" as const,
      id: t.id,
      label: t.fullName,
      meta: `${t.conference} Conf`,
      href: `/nba/teams/${t.id}/preview`,
      logo: t.logo,
    }));

    return [...playerItems, ...teamItems];
  }, [players, search, teamsPayload]);

  const handleComingSoon = (sport: string) => {
    setComingSoon(`${sport} arrive bientôt sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#050308] text-slate-100 px-4 pb-10 pt-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0b090f] text-[12px] font-semibold text-amber-200">
              Logo
            </div>
            <div className="text-[11px] text-slate-500">Betalyze</div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0b090f] px-2 py-1 text-[11px] text-slate-300">
            <Link
              href="/nba"
              className="rounded-full px-2 py-1 text-amber-200 hover:bg-white/5"
            >
              NBA
            </Link>
            <Link
              href="/nfl"
              className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              NFL
            </Link>
            <button
              type="button"
              onClick={() => handleComingSoon("NHL")}
              className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              NHL
            </button>
            <button
              type="button"
              onClick={() => handleComingSoon("MLB")}
              className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              MLB
            </button>
          </div>
        </div>
        {comingSoon && (
          <div className="flex justify-end text-[11px] text-amber-200">
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
              {comingSoon}
            </span>
          </div>
        )}

        <main className="space-y-10">
          {/* Recherche joueur + navigation */}
          <section className="rounded-3xl border border-white/10 bg-[#0b090f] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b090f] px-3 py-1.5 text-[11px] text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{mockTodayMeta.dateLabel}</span>
                </button>
                <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-300">
                  {mockTodayMeta.gamesCount} matchs au programme
                </span>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40 hover:brightness-110">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Meilleurs spots du soir</span>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <div>
                  <p className="font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Recherche joueur
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Autosuggest
                </div>
              </div>

              <div className="relative flex-1">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <SearchIcon className="h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un joueur..."
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                  {playersLoading && (
                    <span className="text-[11px] text-slate-500">…</span>
                  )}
                </div>
              </div>

              {playersError && (
                <p className="text-xs text-red-400">{playersError}</p>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-2 text-sm max-h-64 overflow-y-auto pr-1">
                  {suggestions.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 ring-1 ring-white/10">
                          {item.type === "team" && item.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.logo}
                              alt={item.label}
                              className="h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-200">
                              {item.label.slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-50">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.meta}
                          </p>
                        </div>
                      </div>
                      <span
                        className={
                          "rounded-full border px-2 py-0.5 text-[10px] " +
                          (item.type === "player"
                            ? "border-amber-400/60 text-amber-200"
                            : "border-emerald-400/60 text-emerald-200")
                        }
                      >
                        {item.type === "player" ? "Player" : "Team"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {!playersLoading &&
                search.trim().length >= 2 &&
                suggestions.length === 0 &&
                !playersError && (
                  <p className="text-xs text-slate-500">
                    Aucun résultat pour “{search.trim()}”.
                  </p>
                )}

              {/* Navigation cards */}
              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <Link
                  href="/nba"
                  className="flex flex-col items-start gap-1 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 px-3 py-2.5 text-left ring-1 ring-amber-400/60 hover:brightness-110"
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    <Sparkles className="h-3 w-3" />
                    Joueurs
                  </span>
                  <span className="text-xs text-amber-100">
                    Accède à la page joueurs Betalyze pour analyser un player.
                  </span>
                </Link>

                <Link
                  href="/nba"
                  className="flex flex-col items-start gap-1 rounded-2xl bg-[#0b070f] px-3 py-2.5 text-left ring-1 ring-white/10 hover:border-amber-400/60"
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    <Activity className="h-3 w-3 text-amber-400" />
                    Équipes
                  </span>
                  <span className="text-xs text-slate-300">
                    Voir le profil global et le score Betalyze Team.
                  </span>
                </Link>

                <div className="flex flex-col items-start gap-1 rounded-2xl bg-[#071010] px-3 py-2.5 text-left ring-1 ring-emerald-500/40">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    <Flame className="h-3 w-3 text-emerald-300" />
                    Defense vs position
                  </span>
                  <span className="text-xs text-emerald-50/90">
                    Module à venir pour voir la défense par poste.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* TOP MATCHUPS + SPOTLIGHT */}
          <section className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-white/10 bg-[#050309] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Top matchups du soir (mock)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Matchs avec fort potentiel offensif selon Betalyze.
                  </p>
                </div>

                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200"
                  >
                    <Filter className="h-3 w-3" />
                    <span>All</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-slate-400"
                  >
                    <Flame className="h-3 w-3" />
                    <span>Totals élevés</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {mockGames.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b070f] px-3 py-2 sm:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-slate-100">
                        {g.away} @ {g.home}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {g.awayName} @ {g.homeName}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {g.time} · {g.paceTag}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-100 sm:gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">Total</span>
                        <span className="font-semibold">{g.total.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">Spread</span>
                        <span className="font-semibold">{g.spreadFavorite}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">BZ score</span>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          {g.betalyzeScore}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-white/10 bg-[#08050d]/90">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5 sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Players à surveiller (mock)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Quelques joueurs mis en avant.
                  </p>
                </div>
              </div>

              <div className="space-y-2 px-3 py-3 text-xs sm:px-4">
                {mockSpotlightPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#0b070f] px-3 py-2 sm:px-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#050309] text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/60">
                        {p.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-slate-100">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {p.team} · {p.metric}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-100 sm:gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">Proj</span>
                        <span className="font-semibold">{p.proj.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">Line</span>
                        <span className="font-semibold">{p.line.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">Edge</span>
                        <span className="font-semibold text-emerald-300">{p.edge}</span>
                      </div>
                      <div className="hidden flex-col items-center sm:flex">
                        <span className="text-[10px] text-slate-500">BZ</span>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                          {p.betalyzeScore}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ALL GAMES (mock) */}
          <section className="rounded-3xl border border-white/10 bg-[#050309] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                  Tous les matchs du slate (mock)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Vue compacte pour scanner rapidement les spots.
                </p>
              </div>
              <button className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                Rafraîchir
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-1 space-y-1.5 text-[11px]">
              {mockGames.map((g) => (
                <div
                  key={`table-${g.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-[#07040d] px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-100">
                      {g.away} @ {g.home}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {g.time} · Total {g.total.toFixed(1)} · {g.spreadFavorite}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-100 sm:gap-4">
                    <div className="hidden flex-col items-center sm:flex">
                      <span className="text-[9px] text-slate-500">Pace</span>
                      <span className="font-medium text-slate-200">
                        {g.paceTag}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-500">BZ</span>
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        {g.betalyzeScore}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bloc équipes NBA */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                  Équipes NBA
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-50">
                  Toutes les équipes de la ligue
                </h2>
              </div>
            </div>

            {teamsLoading && (
              <p className="text-sm text-slate-400">Chargement des équipes...</p>
            )}

            {teamsError && (
              <p className="text-sm text-red-400">
                Erreur lors du chargement des équipes : {teamsError}
              </p>
            )}

            {teamsPayload && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                {teamsPayload.teams.map((team, index) => (
                  <div
                    key={`${team.id}-${index}`}
                    className="group rounded-2xl border border-white/10 bg-[#0b090f] p-3 text-center transition hover:border-amber-400/60 hover:bg-black/40"
                  >
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 ring-1 ring-white/10 shadow-[0_0_20px_rgba(0,0,0,0.45)]">
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logo}
                          alt={team.fullName}
                          className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(0,0,0,0.8)] group-hover:scale-105 transition"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold text-slate-300">
                          {team.name.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-100 leading-tight">
                      {team.fullName}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {team.conference === "East"
                        ? "Conf. Est"
                        : team.conference === "West"
                        ? "Conf. Ouest"
                        : "Autre"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
