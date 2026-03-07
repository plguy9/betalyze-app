"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";

// Types alignés sur tes API internes
type BetalyzeNbaTeam = {
  id: number;
  name: string;
  fullName: string;
  code?: string | null;
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

type NbaStandingConference = "East" | "West" | "N/A";

type NbaStandingRow = {
  teamId: number;
  name: string;
  logo: string | null;
  conference: NbaStandingConference;
  position: number | null;
  overallRank: number;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  form: string | null;
  description: string | null;
};

type NbaStandingsPayload = {
  season: string;
  count: number;
  updatedAt: string;
  standings: NbaStandingRow[];
};

type NbaStandingDisplayRow = NbaStandingRow & {
  leagueRank: number;
  conferenceRank: number | null;
  formStreak: string;
  pfPerGame: number;
  paPerGame: number;
  diffPerGame: number;
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

type ApiGame = {
  id?: number | null;
  date?: string | null;
  time?: string | null;
  status?: { short?: string | null; long?: string | null } | null;
  league?: { id?: number | null; season?: string | null } | null;
  teams?: {
    home?: { id?: number | null; name?: string | null; logo?: string | null };
    away?: { id?: number | null; name?: string | null; logo?: string | null };
  } | null;
  scores?: {
    home?: { total?: number | null } | null;
    away?: { total?: number | null } | null;
  } | null;
};

type GamesApiPayload = {
  ok: boolean;
  response?: ApiGame[];
  errors?: Record<string, unknown> | null;
};

type OddsApiPayload = {
  ok: boolean;
  game: number;
  total: number | null;
  spread?: { side: "home" | "away"; line: number } | null;
  bookmaker?: { id?: number | null; name?: string | null } | null;
  cacheLayer?: "memory" | "supabase" | "file" | "network" | null;
  playerProps?: Array<{
    name: string;
    metric: string;
    line: number;
    odd: string | null;
    overOdd?: string | null;
    underOdd?: string | null;
    bookmakerName?: string | null;
  }>;
};

type NbaGameCard = {
  id: number;
  time: string;
  away: string;
  awayName: string;
  home: string;
  homeName: string;
  total: number | null;
  spreadFavorite: string | null;
  betalyzeScore: number;
  paceTag: string;
  statusShort: string | null;
};

type NbaTopProp = {
  id: string;
  playerId?: number | null;
  player: string;
  metric: string;
  line: number;
  side: "over" | "under";
  odds: number;
  edge: number;
  score: number;
  grade: string;
  finalScore: number;
  gameId: number | null;
  awayCode: string;
  homeCode: string;
  bookmaker: string | null;
};

type NbaTopPropsApiPayload = {
  ok: boolean;
  generatedAt?: string;
  props?: Array<{
    id: string;
    playerId?: number | null;
    player: string;
    teamCode?: string | null;
    opponentCode?: string | null;
    metric: string;
    side: "over" | "under";
    line: number;
    odds: number;
    edge: number;
    score: number;
    grade: string;
    finalScore: number;
    gameId?: number | null;
    bookmaker?: string | null;
  }>;
};

type NbaDvpWindow = "season" | "L10" | "L5";
type NbaDvpPosition = "G" | "F" | "C";
type NbaDvpContext = "all" | "home" | "away";
type NbaDvpSortKey =
  | "btp"
  | "games"
  | "pra"
  | "points"
  | "rebounds"
  | "assists"
  | "threePointsMade"
  | "minutes"
  | "fgPct"
  | "ftPct";

type NbaDvpStatTotals = {
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  threePointsMade: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

type NbaDvpRow = {
  season: string;
  window: NbaDvpWindow;
  context: NbaDvpContext;
  teamId: number;
  teamName: string | null;
  teamAbbr: string | null;
  position: NbaDvpPosition;
  games: number;
  btpTotal: number;
  btpPerGame: number;
  metrics: { totals: NbaDvpStatTotals; perGame: NbaDvpStatTotals };
  rank: number | null;
};

type NbaDvpResponse = {
  ok: boolean;
  rows?: NbaDvpRow[];
  error?: string;
};

const TEAM_CODE_BY_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  140: "DET",
  143: "IND",
  147: "MIA",
  148: "MIL",
  151: "NYK",
  153: "ORL",
  154: "PHI",
  159: "TOR",
  161: "WAS",
  138: "DAL",
  139: "DEN",
  141: "GSW",
  142: "HOU",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  149: "MIN",
  150: "NOP",
  152: "OKC",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  160: "UTA",
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
const TOP_PROPS_PAGE_SIZE = 10;
const NBA_TEAM_ID_SET = new Set<number>(
  Object.keys(TEAM_CODE_BY_ID)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id)),
);
const DEFAULT_DVP_SEASON =
  process.env.NEXT_PUBLIC_APISPORTS_BASKETBALL_SEASON ?? "2025-2026";
const FINISHED_GAME_STATUSES = new Set([
  "FT",
  "AOT",
  "AET",
  "AWD",
  "WO",
  "ABD",
  "CAN",
  "PEN",
  "POST",
]);

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "green" | "blue" | "yellow" | "red" | "gray";

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; tone?: Tone }>;
}) {
  const toneMap: Record<Tone, string> = {
    green:
      "data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-200 data-[active=true]:border-emerald-500/30",
    blue:
      "data-[active=true]:bg-sky-500/15 data-[active=true]:text-sky-200 data-[active=true]:border-sky-500/30",
    yellow:
      "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-200 data-[active=true]:border-amber-500/30",
    red:
      "data-[active=true]:bg-rose-500/15 data-[active=true]:text-rose-200 data-[active=true]:border-rose-500/30",
    gray:
      "data-[active=true]:bg-white/10 data-[active=true]:text-white data-[active=true]:border-white/15",
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        const tone: Tone = o.tone ?? "gray";
        const toneClass = toneMap[tone] ?? toneMap.gray;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            data-active={active}
            className={cn(
              "rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium text-white/60 transition",
              "hover:bg-white/10 hover:text-white",
              "data-[active=true]:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
              toneClass,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function LeagueTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-xs font-semibold transition",
        active
          ? "border-orange-500/40 bg-orange-500/15 text-orange-200"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

const SLATE_GAME_STATUSES = new Set([
  "NS",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "HT",
  "OT",
  "LIVE",
  "1Q",
  "2Q",
  "3Q",
  "4Q",
]);

function isPlayableSlateStatus(statusRaw: string | null | undefined): boolean {
  const status = String(statusRaw ?? "")
    .trim()
    .toUpperCase();
  if (!status) return false;
  if (FINISHED_GAME_STATUSES.has(status)) return false;
  return SLATE_GAME_STATUSES.has(status);
}

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

function formatTodayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" ", " · ");
}

function torontoYmd(offsetDays = 0): string {
  const base = new Date();
  const shifted = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function inferSeasonForDate(dateIso: string): string | null {
  const ts = Date.parse(dateIso);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function formatTeamCode(teamId?: number | null, teamName?: string | null): string {
  if (teamId && TEAM_CODE_BY_ID[teamId]) return TEAM_CODE_BY_ID[teamId];
  const raw = teamName ?? "";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function normalizeDvpPositionParam(value: string | null): NbaDvpPosition | null {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "G" || v === "F" || v === "C") return v;
  return null;
}

function formatTimeLabel(game: ApiGame): string {
  const status = game.status?.short ?? null;
  if (status && status !== "NS") return status;
  if (game.time) return game.time;
  const raw = game.date ? Date.parse(game.date) : NaN;
  if (Number.isNaN(raw)) return "TBD";
  return new Date(raw).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeTotalFromScores(game: ApiGame): number | null {
  const home = game.scores?.home?.total;
  const away = game.scores?.away?.total;
  if (typeof home === "number" && typeof away === "number") {
    return home + away;
  }
  return null;
}

function computeBetalyzeScore(total: number | null): number {
  if (total === null) return 72;
  const base = 70;
  const score = base + (total - 220) / 2;
  return Math.round(Math.max(40, Math.min(99, score)));
}

function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (!Number.isFinite(value ?? NaN)) return "-";
  return Number(value).toFixed(digits);
}

function formatEdge(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "-";
  const num = Number(value);
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function trendMetricParamFromTopMetric(metric: string | null | undefined): string | null {
  const key = String(metric ?? "").trim().toUpperCase();
  if (key === "PTS" || key === "POINTS") return "pts";
  if (key === "REB" || key === "REBOUNDS") return "reb";
  if (key === "AST" || key === "ASSISTS") return "ast";
  if (key === "3PT" || key === "3PM" || key === "THREES") return "tp";
  if (key === "PRA" || key === "P+A" || key === "P+R" || key === "R+A") return "pra";
  return null;
}

function normalizeBookmakerQueryValue(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function gradeTone(grade: string | null | undefined): string {
  const g = String(grade ?? "").toUpperCase();
  if (g.startsWith("A")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40";
  if (g.startsWith("B")) return "bg-sky-500/15 text-sky-200 ring-sky-400/40";
  if (g.startsWith("C")) return "bg-amber-500/15 text-amber-200 ring-amber-400/40";
  return "bg-rose-500/15 text-rose-200 ring-rose-400/40";
}

function gradeSortRank(grade: string | null | undefined): number {
  const g = String(grade ?? "").trim().toUpperCase();
  if (g === "A+") return 10;
  if (g === "A") return 9;
  if (g === "A-") return 8;
  if (g === "B+") return 7;
  if (g === "B") return 6;
  if (g === "B-") return 5;
  if (g === "C+") return 4;
  if (g === "C") return 3;
  if (g === "C-") return 2;
  if (g === "D") return 1;
  return 0;
}

function paceTagForTotal(total: number | null): string {
  if (total === null) return "TBD";
  if (total >= 235) return "High pace";
  if (total >= 225) return "Balanced";
  return "Defense focused";
}

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

function buildGameCard(
  game: ApiGame,
  odds: OddsApiPayload | null,
): NbaGameCard | null {
  if (!game.id || !game.teams?.home?.name || !game.teams?.away?.name) return null;
  const homeId = game.teams.home.id ?? null;
  const awayId = game.teams.away.id ?? null;
  const homeName = game.teams.home.name ?? "Home";
  const awayName = game.teams.away.name ?? "Away";
  const homeCode = formatTeamCode(homeId, homeName);
  const awayCode = formatTeamCode(awayId, awayName);
  const total = odds?.total ?? computeTotalFromScores(game);
  const spread = odds?.spread ?? null;
  const spreadFavorite =
    spread && Number.isFinite(spread.line)
      ? `${spread.side === "home" ? homeCode : awayCode} ${
          spread.line > 0 ? `+${spread.line}` : spread.line
        }`
      : null;

  return {
    id: game.id,
    time: formatTimeLabel(game),
    away: awayCode,
    awayName,
    home: homeCode,
    homeName,
    total,
    spreadFavorite,
    betalyzeScore: computeBetalyzeScore(total),
    paceTag: paceTagForTotal(total),
    statusShort: game.status?.short ?? null,
  };
}

function safeRatio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

function formatDvpNumber(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "—";
  return Number(value).toFixed(1);
}

function formatDvpPercent(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function formatFormStreak(form: string | null | undefined): string {
  const clean = String(form ?? "")
    .toUpperCase()
    .replace(/[^WL]/g, "");
  if (!clean) return "-";
  const latest = clean[clean.length - 1];
  if (!latest) return "-";
  let count = 0;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    if (clean[i] !== latest) break;
    count += 1;
  }
  return `${latest}${count}`;
}

function compareStandingsForRank(
  a: Pick<NbaStandingDisplayRow, "winPct" | "wins" | "losses" | "diffPerGame" | "name">,
  b: Pick<NbaStandingDisplayRow, "winPct" | "wins" | "losses" | "diffPerGame" | "name">,
): number {
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  if (a.diffPerGame !== b.diffPerGame) return b.diffPerGame - a.diffPerGame;
  return a.name.localeCompare(b.name);
}

export default function NbaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teamsPayload, setTeamsPayload] =
    useState<BetalyzeNbaTeamsPayload | null>(null);
  const [standingsPayload, setStandingsPayload] =
    useState<NbaStandingsPayload | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [standingsFilter, setStandingsFilter] = useState<"league" | "east" | "west">("league");

  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<NbaPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [gamesDate, setGamesDate] = useState<string | null>(null);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [oddsByGameId, setOddsByGameId] = useState<
    Record<number, OddsApiPayload>
  >({});
  const [oddsRefreshKey] = useState(0);
  const [topProps, setTopProps] = useState<NbaTopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [topPropsLoaded, setTopPropsLoaded] = useState(false);
  const [topPropsActionMessage, setTopPropsActionMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const topPropsActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [journalAddingId, setJournalAddingId] = useState<string | null>(null);
  const [journalAddedId, setJournalAddedId] = useState<string | null>(null);
  const [topPropsOu, setTopPropsOu] = useState<"ALL" | "OVER" | "UNDER">("ALL");
  const [topPropsSortBy, setTopPropsSortBy] = useState<"GRADE" | "EDGE">("GRADE");
  const [topPropsGameFilter, setTopPropsGameFilter] = useState<string>("ALL");
  const [topPropsPage, setTopPropsPage] = useState(1);
  const [dvpWindow, setDvpWindow] = useState<NbaDvpWindow>("L10");
  const [dvpPosition, setDvpPosition] = useState<NbaDvpPosition>("G");
  const [dvpRows, setDvpRows] = useState<NbaDvpRow[]>([]);
  const [dvpLoading, setDvpLoading] = useState(false);
  const [dvpError, setDvpError] = useState<string | null>(null);
  const [dvpSortKey, setDvpSortKey] = useState<NbaDvpSortKey>("btp");
  const [dvpSortDir, setDvpSortDir] = useState<"asc" | "desc">("asc");
  const [dvpRefreshKey, setDvpRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState<
    "equipes" | "players" | "defense"
  >("players");

  useEffect(() => {
    const section = (searchParams?.get("section") ?? "").toLowerCase();
    if (section === "defense") setActiveSection("defense");
    else if (section === "equipes") setActiveSection("equipes");
    else if (section === "players") setActiveSection("players");

    const urlPos = normalizeDvpPositionParam(searchParams?.get("dvpPosition") ?? null);
    if (urlPos) setDvpPosition(urlPos);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (topPropsActionTimer.current) clearTimeout(topPropsActionTimer.current);
    };
  }, []);

  // Charger les équipes au chargement de la page
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const res = await fetch("/api/nba/teams");
        if (!res.ok) {
          throw new Error("Failed to fetch NBA teams");
        }
        const data: BetalyzeNbaTeamsPayload = await res.json();
        setTeamsPayload(data);
      } catch (err) {
        console.error("Failed to load NBA teams", err);
      }
    };

    loadTeams();
  }, []);

  useEffect(() => {
    const loadStandings = async () => {
      try {
        setStandingsLoading(true);
        setStandingsError(null);
        const res = await fetch("/api/nba/standings", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch NBA standings");
        }
        const data: NbaStandingsPayload = await res.json();
        setStandingsPayload(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setStandingsError(message);
      } finally {
        setStandingsLoading(false);
      }
    };

    loadStandings();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadGames = async () => {
      try {
        setGamesLoading(true);
        setGamesError(null);
        const fetchByDate = async (dateParam: string): Promise<ApiGame[]> => {
          const inferredSeason = inferSeasonForDate(dateParam);
          const params = new URLSearchParams({
            date: dateParam,
            league: "12",
            timezone: "America/Toronto",
          });
          if (inferredSeason) params.set("season", inferredSeason);
          const res = await fetch(`/api/nba/games?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) {
            throw new Error("Failed to fetch NBA games");
          }
          const data = (await res.json()) as GamesApiPayload;
          const raw = Array.isArray(data.response) ? data.response : [];
          return raw.filter((g) => g.league?.id === 12 || !g.league);
        };

        const todayDate = torontoYmd(0);
        const tomorrowDate = torontoYmd(1);
        const todayGames = await fetchByDate(todayDate);
        const todayActive = todayGames.filter((g) =>
          isPlayableSlateStatus(g.status?.short ?? null),
        );
        if (todayActive.length > 0) {
          setGames(todayGames);
          setGamesDate(todayDate);
          return;
        }

        const tomorrowGames = await fetchByDate(tomorrowDate);
        const tomorrowActive = tomorrowGames.filter((g) =>
          isPlayableSlateStatus(g.status?.short ?? null),
        );
        if (tomorrowActive.length > 0) {
          setGames(tomorrowGames);
          setGamesDate(tomorrowDate);
          return;
        }

        setGames([]);
        setGamesDate(todayDate);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setGamesError(message);
        setGames([]);
        setGamesDate(null);
      } finally {
        setGamesLoading(false);
      }
    };

    loadGames();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!games.length) return;
    const controller = new AbortController();
    const loadOdds = async () => {
      const gameMap = new Map<
        number,
        { id: number; homeName: string; awayName: string }
      >();
      games.forEach((g) => {
        const id = Number(g.id ?? NaN);
        if (!Number.isFinite(id)) return;
        if (gameMap.has(id)) return;
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
            if (oddsRefreshKey > 0) params.set("refresh", "1");
            const res = await fetch(`/api/nba/odds?${params.toString()}`, {
              signal: controller.signal,
              cache: "no-store",
            });
            if (!res.ok) return null;
            const data = (await res.json()) as OddsApiPayload;
            return data.ok ? data : null;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<number, OddsApiPayload> = {};
      for (const entry of entries) {
        if (entry?.game) next[entry.game] = entry;
      }
      setOddsByGameId(next);
    };

    loadOdds();
    return () => controller.abort();
  }, [games, oddsRefreshKey]);

  const hasPlayableGames = useMemo(
    () => games.some((g) => isPlayableSlateStatus(g.status?.short ?? null)),
    [games],
  );

  const loadTopProps = useCallback(async (refresh: boolean) => {
    try {
      setTopPropsLoading(true);
      setTopPropsError(null);
      if (!hasPlayableGames) {
        setTopProps([]);
        setTopPropsLoaded(true);
        return;
      }
      const url = new URL("/api/nba/props/top", window.location.origin);
      if (refresh) url.searchParams.set("refresh", "1");
      if (gamesDate) url.searchParams.set("date", gamesDate);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch top props");
      const data = (await res.json()) as NbaTopPropsApiPayload;
      const list = Array.isArray(data?.props) ? data.props : [];
      const normalized: NbaTopProp[] = list
        .map((item) => {
          const side: "over" | "under" = item.side === "under" ? "under" : "over";
          return {
          id: String(item.id),
          playerId: item.playerId ?? null,
          player: String(item.player ?? "Player"),
          metric: String(item.metric ?? "PTS"),
          line: Number(item.line),
          side,
          odds: Number(item.odds),
          edge: Number(item.edge),
          score: Number(item.score),
          grade: String(item.grade ?? "C"),
          finalScore: Number(item.finalScore ?? item.score ?? 0),
          gameId: item.gameId ?? null,
          awayCode: String(item.teamCode ?? "NBA"),
          homeCode: String(item.opponentCode ?? "OPP"),
          bookmaker: item.bookmaker ?? null,
          };
        })
        .filter((item) => Number.isFinite(item.line) && Number.isFinite(item.odds));
      setTopProps(normalized);
      setTopPropsLoaded(true);
    } catch (err) {
      setTopProps([]);
      setTopPropsLoaded(true);
      setTopPropsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTopPropsLoading(false);
    }
  }, [gamesDate, hasPlayableGames]);

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
          note: "Ajouté depuis Top opportunités NBA",
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
        setTopPropsActionMessage({ text: "Prop ajoutée au Bet Journal.", error: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible d'ajouter la prop au journal";
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

  useEffect(() => {
    const controller = new AbortController();
    const loadDvp = async () => {
      try {
        setDvpLoading(true);
        setDvpError(null);
        const params = new URLSearchParams({
          season: DEFAULT_DVP_SEASON,
          window: dvpWindow,
          position: dvpPosition,
          context: "all",
        });
        if (dvpRefreshKey > 0) {
          params.set("refresh", "1");
        }
        const res = await fetch(`/api/nba/defense/dvp?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch NBA DvP");
        }
        const data = (await res.json()) as NbaDvpResponse;
        setDvpRows(Array.isArray(data.rows) ? data.rows : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setDvpRows([]);
        setDvpError(message);
      } finally {
        if (!controller.signal.aborted) setDvpLoading(false);
      }
    };

    loadDvp();
    return () => controller.abort();
  }, [dvpWindow, dvpPosition, dvpRefreshKey]);

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
        // On limite a 15 resultats pour l'autosuggest, et on retire les doublons
        const seen = new Set<number>();
        const unique = data.players.filter((p) => {
          const id = Number(p.id);
          if (!Number.isFinite(id)) return false;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setPlayers(unique.slice(0, 15));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setPlayersError(message);
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

  useEffect(() => {
    if (activeSection !== "players") return;
    if (!gamesDate) return;
    if (topPropsLoaded || topPropsLoading) return;
    loadTopProps(false);
  }, [activeSection, topPropsLoaded, topPropsLoading, gamesDate, loadTopProps]);

  useEffect(() => {
    setTopProps([]);
    setTopPropsError(null);
    setTopPropsLoaded(false);
  }, [gamesDate]);

  useEffect(() => {
    if (hasPlayableGames) return;
    setTopProps([]);
    setTopPropsError(null);
    setTopPropsLoaded(true);
  }, [hasPlayableGames]);

  const gameCards = useMemo(
    () =>
      games
        .map((g) => buildGameCard(g, g.id ? oddsByGameId[g.id] ?? null : null))
        .filter((g): g is NbaGameCard => Boolean(g)),
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
  const todayMeta = useMemo(
    () => ({
      dateLabel: gamesDate
        ? formatTodayLabel(new Date(`${gamesDate}T12:00:00`))
        : formatTodayLabel(new Date()),
      gamesCount: playableGameCards.length,
    }),
    [playableGameCards.length, gamesDate],
  );

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

  const topPropsDisplay = useMemo(() => {
    const selectedGameId =
      topPropsGameFilter === "ALL" ? NaN : Number(topPropsGameFilter);
    const hasGameFilter = Number.isFinite(selectedGameId) && selectedGameId > 0;
    const filtered = topProps.filter((item) => {
      if (
        hasGameFilter &&
        Number(item.gameId ?? NaN) !== selectedGameId
      ) {
        return false;
      }
      if (topPropsOu === "OVER") return item.side === "over";
      if (topPropsOu === "UNDER") return item.side === "under";
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (topPropsSortBy === "EDGE") return b.edge - a.edge;
      const gradeDiff = gradeSortRank(b.grade) - gradeSortRank(a.grade);
      if (gradeDiff !== 0) return gradeDiff;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return b.edge - a.edge;
    });
    return sorted;
  }, [topProps, topPropsGameFilter, topPropsOu, topPropsSortBy]);

  const topPropsPageCount = useMemo(
    () => Math.max(1, Math.ceil(topPropsDisplay.length / TOP_PROPS_PAGE_SIZE)),
    [topPropsDisplay.length],
  );

  useEffect(() => {
    setTopPropsPage(1);
  }, [topPropsGameFilter, topPropsOu, topPropsSortBy, gamesDate]);

  useEffect(() => {
    if (topPropsPage <= topPropsPageCount) return;
    setTopPropsPage(topPropsPageCount);
  }, [topPropsPage, topPropsPageCount]);

  const topPropsPagedDisplay = useMemo(() => {
    const start = (topPropsPage - 1) * TOP_PROPS_PAGE_SIZE;
    return topPropsDisplay.slice(start, start + TOP_PROPS_PAGE_SIZE);
  }, [topPropsDisplay, topPropsPage]);

  const standingsDisplay = useMemo(() => {
    const rows = standingsPayload?.standings ?? [];
    const base: NbaStandingDisplayRow[] = rows.map((row) => {
      const games = Number.isFinite(row.games) && row.games > 0 ? row.games : 0;
      const pfPerGame = games > 0 ? row.pointsFor / games : 0;
      const paPerGame = games > 0 ? row.pointsAgainst / games : 0;
      const diffPerGame = pfPerGame - paPerGame;
      return {
        ...row,
        leagueRank: 0,
        conferenceRank: null,
        formStreak: formatFormStreak(row.form),
        pfPerGame,
        paPerGame,
        diffPerGame,
      };
    });

    const rankedLeague = [...base]
      .sort(compareStandingsForRank)
      .map((row, index) => ({ ...row, leagueRank: index + 1 }));

    const confCounters = new Map<NbaStandingConference, number>();
    const withConferenceRank = rankedLeague.map((row) => {
      if (row.conference !== "East" && row.conference !== "West") {
        return row;
      }
      const nextRank = (confCounters.get(row.conference) ?? 0) + 1;
      confCounters.set(row.conference, nextRank);
      return {
        ...row,
        conferenceRank: nextRank,
      };
    });

    return {
      league: withConferenceRank,
      east: withConferenceRank.filter((row) => row.conference === "East"),
      west: withConferenceRank.filter((row) => row.conference === "West"),
      other: withConferenceRank.filter(
        (row) => row.conference !== "East" && row.conference !== "West",
      ),
    };
  }, [standingsPayload]);

  const standingsFilteredRows = useMemo(() => {
    if (standingsFilter === "east") return standingsDisplay.east;
    if (standingsFilter === "west") return standingsDisplay.west;
    return standingsDisplay.league;
  }, [standingsDisplay, standingsFilter]);

  const dvpTeamsById = useMemo(() => {
    const map = new Map<number, BetalyzeNbaTeam>();
    (teamsPayload?.teams ?? []).forEach((team) => map.set(team.id, team));
    return map;
  }, [teamsPayload]);
  const teamMetaByCode = useMemo(() => {
    const map = new Map<string, BetalyzeNbaTeam>();
    (teamsPayload?.teams ?? []).forEach((team) => {
      const code = String(team.code ?? "").toUpperCase();
      if (code) map.set(code, team);
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

  const resolveDvpValue = (row: NbaDvpRow, key: NbaDvpSortKey) => {
    if (key === "btp") return row.btpPerGame;
    if (key === "games") return row.games;
    const perGame = row.metrics?.perGame;
    if (!perGame) return null;
    if (key === "fgPct") {
      const fgPct = safeRatio(
        perGame.fieldGoalsMade,
        perGame.fieldGoalsAttempted,
      );
      return fgPct === null ? null : fgPct * 100;
    }
    if (key === "ftPct") {
      const ftPct = safeRatio(
        perGame.freeThrowsMade,
        perGame.freeThrowsAttempted,
      );
      return ftPct === null ? null : ftPct * 100;
    }
    if (key === "points") return perGame.points ?? null;
    if (key === "rebounds") return perGame.rebounds ?? null;
    if (key === "assists") return perGame.assists ?? null;
    if (key === "pra") {
      const points = Number(perGame.points ?? NaN);
      const rebounds = Number(perGame.rebounds ?? NaN);
      const assists = Number(perGame.assists ?? NaN);
      if (!Number.isFinite(points) || !Number.isFinite(rebounds) || !Number.isFinite(assists)) {
        return null;
      }
      return points + rebounds + assists;
    }
    if (key === "threePointsMade") return perGame.threePointsMade ?? null;
    if (key === "minutes") return perGame.minutes ?? null;
    return null;
  };

  const dvpSorted = useMemo(() => {
    const nbaOnlyRows = dvpRows.filter((row) => {
      const teamId = Number(row.teamId ?? NaN);
      return Number.isFinite(teamId) && NBA_TEAM_ID_SET.has(teamId);
    });

    const rankSourceKey: NbaDvpSortKey = dvpSortKey === "games" ? "btp" : dvpSortKey;
    const rankByTeam = new Map<number, number>();
    [...nbaOnlyRows]
      .map((row) => ({
        teamId: Number(row.teamId),
        value: resolveDvpValue(row, rankSourceKey),
      }))
      .filter((item) => Number.isFinite(item.value ?? NaN))
      .sort((a, b) => {
        const av = Number(a.value);
        const bv = Number(b.value);
        return av - bv;
      })
      .forEach((item, idx) => {
        rankByTeam.set(item.teamId, idx + 1);
      });

    return nbaOnlyRows
      .map((row) => ({
        ...row,
        rank: rankByTeam.get(Number(row.teamId)) ?? row.rank,
      }))
      .map((row, idx) => ({
        row,
        idx,
        value: resolveDvpValue(row, dvpSortKey),
      }))
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
    if (dvpSortKey === key) {
      setDvpSortDir(dvpSortDir === "asc" ? "desc" : "asc");
      return;
    }
    setDvpSortKey(key);
    setDvpSortDir("asc");
  };

  const sortIndicator = (key: NbaDvpSortKey) => {
    if (dvpSortKey !== key) return "";
    return dvpSortDir === "asc" ? "^" : "v";
  };

  const tierForRank = (rank?: number | null) => {
    if (!rank) return { label: "—", tone: "text-slate-400 bg-white/5" };
    if (rank <= 5) return { label: "Elite", tone: "text-emerald-200 bg-emerald-500/15" };
    if (rank <= 12) return { label: "Solid", tone: "text-sky-200 bg-sky-500/15" };
    if (rank <= 20) return { label: "Average", tone: "text-slate-200 bg-white/10" };
    if (rank <= 28) return { label: "Weak", tone: "text-amber-200 bg-amber-500/15" };
    return { label: "Soft", tone: "text-rose-200 bg-rose-500/15" };
  };

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
        : "Best Props";

  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Bet Journal") {
      router.push("/nba/journal");
      return;
    }
    if (page === "Settings") {
      router.push("/nba/settings");
      return;
    }
    if (page === "DvP") {
      setActiveSection("defense");
      return;
    }
    if (page === "Teams") {
      setActiveSection("equipes");
      return;
    }
    if (page === "Best Props" || page === "Players") {
      setActiveSection("players");
      return;
    }
    handleComingSoon(page);
  };

  return (
    <div className="min-h-screen bg-[#07070b] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-120px] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.18),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative w-full px-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
              <span className="text-xs font-semibold text-white/60">LOGO</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold">Betalyze</div>
              <div className="text-[11px] text-white/45">Analytics</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LeagueTab label="NBA" active onClick={() => undefined} />
            <Link href="/nfl">
              <LeagueTab label="NFL" />
            </Link>
            <LeagueTab label="NHL" onClick={() => handleComingSoon("NHL")} />
            <LeagueTab label="MLB" onClick={() => handleComingSoon("MLB")} />
          </div>
        </div>
      </div>

      <div className="relative w-full px-6 pb-20 pt-6">
        {comingSoon && (
          <div className="mb-3 flex justify-end text-[11px] text-amber-200">
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
              {comingSoon}
            </span>
          </div>
        )}
        <div className="flex gap-6">
          <NbaSidebar active={sidebarActive} onSelect={setSidebarActive} />

          <main className="flex-1 space-y-10">
          {/* Recherche joueur + navigation */}
          <Card>
            <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {gamesLoading ? "..." : todayMeta.dateLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {gamesLoading
                    ? "..."
                    : todayMeta.gamesCount === 0
                      ? "0 games"
                      : `${todayMeta.gamesCount} ${
                          todayMeta.gamesCount > 1 ? "games" : "game"
                        }`}
                </span>
              </div>
              <button className="rounded-full bg-gradient-to-b from-orange-400 to-orange-500 px-4 py-2 text-xs font-semibold text-black shadow-md hover:brightness-110 transition">
                Meilleurs spots
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un joueur..."
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-5 py-3 text-sm text-white placeholder:text-white/30 focus:border-orange-400/40 focus:outline-none transition"
                />
                {playersLoading && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
                    …
                  </span>
                )}
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

              <div className="text-[11px] text-white/0">.</div>

              <div className="md:hidden">
                <Segmented
                  value={activeSection}
                  onChange={(v) =>
                    setActiveSection(v as "equipes" | "players" | "defense")
                  }
                  options={[
                    { value: "players", label: "Best Props", tone: "yellow" },
                    { value: "equipes", label: "Teams", tone: "gray" },
                    { value: "defense", label: "DvP", tone: "green" },
                  ]}
                />
              </div>
            </div>
            </div>
          </Card>

          {/* BEST PROPS */}
          {activeSection === "players" && (
          <Card>
            <div className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-xs tracking-widest text-white/40">
                    {sidebarActive.toUpperCase()} • NBA
                  </div>
                  <h2 className="mt-2 text-[36px] font-semibold leading-tight sm:text-[40px]">
                    Top opportunités
                  </h2>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <span className="text-[11px] text-white/45">Game</span>
                    <select
                      value={topPropsGameFilter}
                      onChange={(e) => setTopPropsGameFilter(e.target.value)}
                      className="min-w-[150px] bg-transparent text-[11px] font-medium text-white/90 outline-none"
                    >
                      {topPropsGameOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          className="bg-[#0b0f18] text-white"
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Segmented
                    value={topPropsOu}
                    onChange={(v) => setTopPropsOu(v as "ALL" | "OVER" | "UNDER")}
                    options={[
                      { value: "ALL", label: "Tous", tone: "gray" },
                      { value: "OVER", label: "Over", tone: "green" },
                      { value: "UNDER", label: "Under", tone: "red" },
                    ]}
                  />
                  <Segmented
                    value={topPropsSortBy}
                    onChange={(v) => setTopPropsSortBy(v as "GRADE" | "EDGE")}
                    options={[
                      { value: "GRADE", label: "Note", tone: "gray" },
                      { value: "EDGE", label: "Edge", tone: "gray" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => loadTopProps(true)}
                    className="whitespace-nowrap text-xs text-white/50 transition hover:text-white"
                    disabled={topPropsLoading}
                  >
                    Rafraîchir ↻
                  </button>
                </div>
              </div>

              {topPropsError && (
                <p className="mt-3 text-[11px] text-rose-300">{topPropsError}</p>
              )}
              {topPropsActionMessage && (
                <p
                  className={
                    "mt-2 text-[11px] " +
                    (topPropsActionMessage.error ? "text-rose-300" : "text-emerald-300")
                  }
                >
                  {topPropsActionMessage.text}
                </p>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {topPropsLoading && (
                  <p className="text-[11px] text-slate-500">
                    Chargement des props…
                  </p>
                )}
                {!topPropsLoading && topPropsDisplay.length === 0 && (
                  <div className="col-span-full rounded-xl border border-white/10 bg-black/20 py-16 text-center text-white/50">
                    <div className="mb-3 text-2xl">🏀</div>
                    {topPropsGameFilter === "ALL"
                      ? "Aucune game NBA disponible actuellement"
                      : "Aucune prop disponible pour ce match"}
                  </div>
                )}
                {topPropsPagedDisplay.map((p) => (
                  (() => {
                    const team = teamMetaByCode.get(p.awayCode);
                    const opp = teamMetaByCode.get(p.homeCode);
                    const teamLabel = team?.code ?? team?.name ?? p.awayCode;
                    const oppLabel = opp?.code ?? opp?.name ?? p.homeCode;
                    const posLabel = "NBA";
                    const primary = getTeamPrimaryColor(p.awayCode);
                    const primarySoft = hexToRgba(primary, 0.22);
                    const primaryMid = hexToRgba(primary, 0.12);
                    const primaryLine = hexToRgba(primary, 0.55);
                    const oppPrimary = getTeamPrimaryColor(p.homeCode);
                    const oppChipBg = hexToRgba(oppPrimary, 0.18);
                    const oppChipRing = hexToRgba(oppPrimary, 0.28);
                    const sideLabel = p.side === "over" ? "O" : "U";
                    const matchTime =
                      Number.isFinite(Number(p.gameId ?? NaN)) && Number(p.gameId) > 0
                        ? gameTimeById.get(Number(p.gameId)) ?? null
                        : null;
                    const qs = new URLSearchParams();
                    const metricParam = trendMetricParamFromTopMetric(p.metric);
                    if (metricParam) qs.set("metric", metricParam);
                    if (Number.isFinite(p.line)) qs.set("line", String(p.line));
                    if (p.side === "over" || p.side === "under") qs.set("side", p.side);
                    if (Number.isFinite(Number(p.gameId ?? NaN))) {
                      qs.set("gameId", String(p.gameId));
                    }
                    if (Number.isFinite(Number(p.score ?? NaN))) {
                      qs.set("score", String(Math.round(Number(p.score))));
                    }
                    if (p.grade) {
                      qs.set("grade", String(p.grade).toUpperCase());
                    }
                    if (p.homeCode) qs.set("opp", String(p.homeCode).toUpperCase());
                    const bookmakerParam = normalizeBookmakerQueryValue(p.bookmaker);
                    if (bookmakerParam) qs.set("bookmaker", bookmakerParam);
                    const href = p.playerId
                      ? `/nba/players/${p.playerId}${qs.toString() ? `?${qs.toString()}` : ""}`
                      : null;
                    const isAdding = journalAddingId === p.id;
                    const isAdded = journalAddedId === p.id;
                    const cardContent = (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 w-20 opacity-50"
                          style={{
                            background: `linear-gradient(90deg, ${hexToRgba(primary, 0.35)} 0%, rgba(0,0,0,0) 100%)`,
                          }}
                        />
                        <div className="relative z-10 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-slate-100">
                              {p.player}
                            </p>
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
                            vs {oppLabel} · {p.metric} {sideLabel}{" "}
                            {formatDecimal(p.line, 1)} @ {formatDecimal(p.odds, 2)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="rounded-full bg-white/5 px-2 py-0.5">
                              Edge {formatEdge(p.edge)}
                            </span>
                            <span className="rounded-full bg-white/5 px-2 py-0.5">
                              Score {formatDecimal(p.score, 0)}
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
                              {matchTime ? <span className="text-slate-300/90">· {matchTime}</span> : null}
                            </span>
                          </div>
                        </div>
                        <div className="relative z-20 flex flex-col items-center gap-1.5">
                          <span
                            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${gradeTone(
                              p.grade,
                            )}`}
                          >
                            {p.grade}
                          </span>
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void addTopPropToJournal(p, teamLabel, oppLabel);
                            }}
                            className={
                              "rounded-full border px-3 py-1 text-[10px] font-semibold transition " +
                              (isAdded
                                ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-200"
                                : "border-white/15 bg-black/35 text-slate-100 hover:border-white/30 hover:bg-white/10") +
                              (isAdding ? " cursor-not-allowed opacity-70" : "")
                            }
                          >
                            {isAdding ? "Ajout..." : isAdded ? "Ajouté" : "Journal +"}
                          </button>
                        </div>
                      </>
                    );

                    return (
                      <div
                        key={p.id}
                        role={href ? "button" : undefined}
                        tabIndex={href ? 0 : undefined}
                        onClick={() => {
                          if (!href) return;
                          router.push(href);
                        }}
                        onKeyDown={(e) => {
                          if (!href) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(href);
                          }
                        }}
                        className={
                          "group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 px-4 py-3 " +
                          (href ? "cursor-pointer transition hover:brightness-110" : "")
                        }
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${primarySoft} 0%, ${primaryMid} 45%, rgba(3, 3, 7, 0.85) 100%)`,
                          boxShadow: `inset 0 1px 0 ${primaryLine}`,
                          borderColor: primaryLine,
                        }}
                        title={href ? `Ouvrir la page joueur de ${p.player}` : undefined}
                      >
                        {cardContent}
                      </div>
                    );
                  })()
                ))}
              </div>
              {!topPropsLoading && topPropsDisplay.length > TOP_PROPS_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[11px] text-white/55">
                    Page {topPropsPage}/{topPropsPageCount} •{" "}
                    {topPropsDisplay.length} cartes
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTopPropsPage((prev) => Math.max(1, prev - 1))}
                      disabled={topPropsPage <= 1}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTopPropsPage((prev) => Math.min(topPropsPageCount, prev + 1))
                      }
                      disabled={topPropsPage >= topPropsPageCount}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant →
                    </button>
                  </div>
                </div>
              )}
              <div className="text-[11px] text-white/45">
                Match: {
                  topPropsGameFilter === "ALL"
                    ? "Tous"
                    : (topPropsGameOptions.find((option) => option.value === topPropsGameFilter)?.label ?? "Sélection")
                } •
                {" "}
                OU: {topPropsOu === "ALL" ? "Tous" : topPropsOu === "OVER" ? "Over" : "Under"} •
                {" "}Tri: {topPropsSortBy === "GRADE" ? "Note" : "Edge"}
              </div>
            </div>
          </Card>
          )}

          {/* ALL GAMES */}
          {activeSection !== "defense" && (
          <Card>
            <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs tracking-widest text-white/40">TOUS LES MATCHS • NBA</div>
                <h2 className="mt-2 text-xl font-semibold">Calendrier complet</h2>
              </div>
              <button className="text-xs text-white/50 hover:text-white">Rafraîchir ↻</button>
            </div>

            <div className="mt-8 space-y-1.5 text-[11px]">
              {gamesLoading && (
                <p className="text-xs text-slate-500">Chargement du slate…</p>
              )}
              {gamesError && (
                <p className="text-xs text-red-400">
                  Erreur lors du chargement du slate : {gamesError}
                </p>
              )}
              {!gamesLoading && !gamesError && playableGameCards.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 py-16 text-center text-white/50">
                  <div className="mb-3 text-2xl">📅</div>
                  Aucun match NBA disponible
                </div>
              )}
              {!gamesLoading &&
                !gamesError &&
                playableGameCards.map((g) => (
                  <div
                    key={`table-${g.id}`}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-[#07040d] px-3 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-slate-100">
                        {g.away} @ {g.home}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {g.time} · Total{" "}
                        {g.total !== null ? g.total.toFixed(1) : "—"} ·{" "}
                        {g.spreadFavorite ?? "—"}
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
            </div>
          </Card>
          )}

          {activeSection === "defense" && (
          <Card id="nba-dvp">
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <div className="text-xs tracking-widest text-white/40">DEFENSE VS POSITION • NBA</div>
                  <h2 className="mt-2 text-xl font-semibold">Classement DvP</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Classement par points Betalyze concédés + splits par poste.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Segmented
                    value={dvpWindow}
                    onChange={(v) => setDvpWindow(v as NbaDvpWindow)}
                    options={[
                      { value: "season", label: "Season", tone: "gray" },
                      { value: "L10", label: "L10", tone: "green" },
                      { value: "L5", label: "L5", tone: "green" },
                    ]}
                  />

                  <Segmented
                    value={dvpPosition}
                    onChange={(v) => setDvpPosition(v as NbaDvpPosition)}
                    options={[
                      { value: "G", label: "G", tone: "yellow" },
                      { value: "F", label: "F", tone: "yellow" },
                      { value: "C", label: "C", tone: "yellow" },
                    ]}
                  />

                  <button
                    onClick={() => setDvpRefreshKey((prev) => prev + 1)}
                    className="whitespace-nowrap text-xs text-white/50 transition hover:text-white"
                  >
                    Rafraîchir ↻
                  </button>
                </div>
              </div>

              {dvpError && <p className="mt-3 text-xs text-rose-300">{dvpError}</p>}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {dvpLoading ? (
                  <div className="px-4 py-6 text-sm text-slate-400">Chargement DvP...</div>
                ) : dvpSorted.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">
                    Pas encore assez de logs NBA pour construire le DvP.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-[11px] text-slate-100">
                      <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-white/45">
                        <tr>
                          <th className="px-3 py-3 text-left font-semibold">RK</th>
                          <th className="px-3 py-3 text-left font-semibold">Team</th>
                          <th
                            className={
                              "px-3 py-3 text-center font-semibold cursor-pointer " +
                              (dvpSortKey === "btp" ? "bg-emerald-500/12 text-emerald-100" : "")
                            }
                            onClick={() => applyDvpSort("btp")}
                          >
                            <span>BTP/G</span>
                            <span className="ml-1 text-[8px] text-slate-500">{sortIndicator("btp")}</span>
                          </th>
                          <th
                            className={
                              "px-3 py-3 text-center font-semibold cursor-pointer " +
                              (dvpSortKey === "games" ? "bg-emerald-500/12 text-emerald-100" : "")
                            }
                            onClick={() => applyDvpSort("games")}
                          >
                            <span>GP</span>
                            <span className="ml-1 text-[8px] text-slate-500">
                              {sortIndicator("games")}
                            </span>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold">TIER</th>
                          {dvpColumns.map((col) => (
                            <th
                              key={col.key}
                              className={
                                "px-3 py-3 text-center font-semibold cursor-pointer " +
                                (dvpSortKey === col.key ? "bg-emerald-500/12 text-emerald-100" : "")
                              }
                              onClick={() => applyDvpSort(col.key)}
                            >
                              <span>{col.label}</span>
                              <span className="ml-1 text-[8px] text-slate-500">
                                {sortIndicator(col.key)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dvpSorted.map((row) => {
                          const teamMeta = dvpTeamsById.get(row.teamId);
                          const name =
                            row.teamName ?? teamMeta?.fullName ?? teamMeta?.name ?? `Team ${row.teamId}`;
                          const abbr =
                            row.teamAbbr ?? teamMeta?.code ?? formatTeamCode(row.teamId, name);
                          const logo = teamMeta?.logo ?? null;
                          const rank = row.rank ?? null;
                          const toneRank = dvpSortKey === "btp" ? rank : null;
                          const rankTone =
                            toneRank && toneRank <= 5
                              ? "text-emerald-300"
                              : toneRank && toneRank >= 28
                                ? "text-rose-300"
                                : "text-slate-200";
                          const tier = tierForRank(rank);
                          return (
                            <tr
                              key={`${row.teamId}-${row.position}-${row.window}-${row.context}`}
                              className="hover:bg-white/[0.03]"
                            >
                              <td className={`px-3 py-2.5 text-left font-semibold ${rankTone}`}>
                                #{row.rank ?? "-"}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  {logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logo} alt={name} className="h-6 w-6 object-contain" />
                                  ) : (
                                    <span className="text-[10px] font-semibold text-slate-200">
                                      {abbr.slice(0, 3)}
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-medium text-slate-100">{name}</p>
                                    <p className="text-[10px] text-slate-500">{abbr}</p>
                                  </div>
                                </div>
                              </td>
                              <td
                                className={
                                  "px-3 py-2.5 text-center font-semibold " +
                                  (dvpSortKey === "btp" ? "bg-emerald-500/10 text-emerald-100" : "")
                                }
                              >
                                {formatDvpNumber(row.btpPerGame)}
                              </td>
                              <td
                                className={
                                  "px-3 py-2.5 text-center " +
                                  (dvpSortKey === "games" ? "bg-emerald-500/10 text-emerald-100" : "")
                                }
                              >
                                {row.games}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${tier.tone}`}>
                                  {tier.label}
                                </span>
                              </td>
                              {dvpColumns.map((col) => {
                                const value = resolveDvpValue(row, col.key);
                                return (
                                  <td
                                    key={`${row.teamId}-${col.key}`}
                                    className={
                                      "px-3 py-2.5 text-center " +
                                      (dvpSortKey === col.key ? "bg-emerald-500/10 text-emerald-100" : "")
                                    }
                                  >
                                    {col.percent ? formatDvpPercent(value) : formatDvpNumber(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Card>
          )}

          {/* Bloc équipes NBA */}
          {activeSection === "equipes" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                  Teams • NBA
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-50">
                  Classement NBA
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Segmented
                  value={standingsFilter}
                  onChange={(v) => setStandingsFilter(v as "league" | "east" | "west")}
                  options={[
                    { value: "league", label: "League", tone: "gray" },
                    { value: "east", label: "Est", tone: "gray" },
                    { value: "west", label: "Ouest", tone: "gray" },
                  ]}
                />
                {standingsPayload?.season && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                    Saison {standingsPayload.season}
                  </span>
                )}
              </div>
            </div>

            {standingsLoading && (
              <p className="text-sm text-slate-400">Chargement du classement NBA...</p>
            )}

            {standingsError && (
              <p className="text-sm text-red-400">
                Erreur lors du chargement du classement : {standingsError}
              </p>
            )}

            {!standingsLoading &&
              !standingsError &&
              standingsFilteredRows.length === 0 && (
                <p className="text-sm text-slate-400">
                  Aucun classement disponible pour le moment.
                </p>
              )}

            {standingsFilteredRows.length > 0 && (
              <Card className="p-3">
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {standingsFilter === "league"
                    ? "Classement League"
                    : standingsFilter === "east"
                      ? "Classement Conférence Est"
                      : "Classement Conférence Ouest"}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0b090f]/80">
                  <table className="min-w-[980px] w-full text-[13px] text-slate-200">
                    <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Team</th>
                        <th className="px-3 py-2 text-center">W</th>
                        <th className="px-3 py-2 text-center">L</th>
                        <th className="px-3 py-2 text-center">GP</th>
                        <th className="px-3 py-2 text-center">Win%</th>
                        <th className="px-3 py-2 text-center">PF/G</th>
                        <th className="px-3 py-2 text-center">PA/G</th>
                        <th className="px-3 py-2 text-center">Diff/G</th>
                        <th className="px-3 py-2 text-center">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsFilteredRows.map((team) => (
                        <tr
                          key={`${standingsFilter}-${team.teamId}`}
                          className="border-t border-white/5 transition hover:bg-white/[0.03]"
                        >
                          <td className="px-3 py-2.5 font-semibold text-slate-300">
                            #
                            {standingsFilter === "league"
                              ? team.leagueRank
                              : team.conferenceRank ?? "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/nba/teams/${team.teamId}/preview`}
                              className="inline-flex items-center gap-2 hover:text-amber-200"
                            >
                              <span className="grid h-8 w-8 place-items-center rounded-lg bg-black/20">
                                {team.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={team.logo}
                                    alt={team.name}
                                    className="h-6 w-6 object-contain"
                                  />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-200">
                                    {team.name.slice(0, 3).toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span className="font-medium text-slate-100">{team.name}</span>
                              <span
                                className={
                                  "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                  (team.conference === "East"
                                    ? "bg-sky-500/15 text-sky-200"
                                    : team.conference === "West"
                                      ? "bg-amber-500/15 text-amber-200"
                                      : "bg-white/10 text-slate-300")
                                }
                              >
                                {team.conference}
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-emerald-200">
                            {team.wins}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-rose-200">
                            {team.losses}
                          </td>
                          <td className="px-3 py-2.5 text-center">{team.games}</td>
                          <td className="px-3 py-2.5 text-center">
                            {(team.winPct * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 text-center">{team.pfPerGame.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-center">{team.paPerGame.toFixed(1)}</td>
                          <td
                            className={
                              "px-3 py-2.5 text-center " +
                              (team.diffPerGame >= 0 ? "text-emerald-200" : "text-rose-200")
                            }
                          >
                            {team.diffPerGame >= 0 ? "+" : ""}
                            {team.diffPerGame.toFixed(1)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-[11px] text-slate-300">
                            {team.formStreak}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
          )}
        </main>
      </div>
    </div>
    </div>
  );
}
