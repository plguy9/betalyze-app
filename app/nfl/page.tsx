"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Activity,
  Flame,
  Search as SearchIcon,
  Calendar,
  Filter,
  ArrowUpRight,
} from "lucide-react";

type NflTeam = {
  id: number;
  name: string;
  code: string | null;
  city: string | null;
  logo: string | null;
  conference: "AFC" | "NFC" | "Unknown";
  division:
    | "AFC East"
    | "AFC North"
    | "AFC South"
    | "AFC West"
    | "NFC East"
    | "NFC North"
    | "NFC South"
    | "NFC West"
    | "Unknown";
};

type NflTeamsResponse = {
  ok?: boolean;
  season: string;
  league?: string;
  response: any[];
  errors?: any;
  results?: number | null;
};

type RecordLine = { w: number; l: number; t: number; pct: number; text?: string };

type StandingRow = {
  teamId: number;
  name: string;
  code: string | null;
  logo: string | null;
  city: string | null;
  division:
    | "AFC East"
    | "AFC North"
    | "AFC South"
    | "AFC West"
    | "NFC East"
    | "NFC North"
    | "NFC South"
    | "NFC West"
    | "Unknown";
  conference: "AFC" | "NFC" | "Unknown";
  position: number | null;
  w: number;
  l: number;
  t: number;
  pct: number;
  pf: number;
  pa: number;
  net: number;
  home: RecordLine;
  road: RecordLine;
  div: RecordLine;
  conf: RecordLine;
  nonConf: RecordLine;
  streak: string | null;
  last5: { w: number; l: number; t: number };
  order: number;
};

type NflPlayerBasic = {
  id: number;
  name: string;
  position: string | null;
  number: number | string | null;
  image: string | null;
};

type NflPlayerSearch = {
  id: number;
  name: string;
  position: string | null;
  number: number | string | null;
  image: string | null;
  team: {
    id: number;
    name: string;
    code: string | null;
    logo: string | null;
  };
};

type NflPlayersSearchResponse = {
  ok?: boolean;
  query?: string;
  season?: string;
  league?: string;
  count?: number;
  players?: NflPlayerSearch[];
};

type PlayerStatsResponse = {
  ok: boolean;
  season: string;
  player: {
    id: number | null;
    name: string | null;
    image: string | null;
    team?: { id?: number; name?: string; logo?: string };
  };
  stats: Record<string, Record<string, any>>;
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

type DvpWindow = "season" | "L10" | "L5";
type DvpPosition = "QB" | "RB" | "WR" | "TE";
type DvpContext = "all" | "home" | "away";
type DvpSortKey =
  | "btp"
  | "games"
  | "rank"
  | keyof DvpStatTotals
  | "passPct"
  | "passYpa"
  | "rushYpc"
  | "recYpr"
  | "recYpt";
type DvpStatTotals = {
  passYds: number;
  passTD: number;
  ints: number;
  completions: number;
  attempts: number;
  rushYds: number;
  rushTD: number;
  rushAtt: number;
  rec: number;
  recYds: number;
  recTD: number;
  targets: number;
};

type DvpRow = {
  season: string;
  window: DvpWindow;
  context: DvpContext;
  teamId: number;
  teamName?: string | null;
  teamAbbr?: string | null;
  position: DvpPosition;
  games: number;
  ffpTotal: number;
  ffpPerGame: number;
  metrics: { totals: DvpStatTotals; perGame: DvpStatTotals };
  rank?: number | null;
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


const DIVISION_BY_CODE: Record<
  string,
  {
    division:
      | "AFC East"
      | "AFC North"
      | "AFC South"
      | "AFC West"
      | "NFC East"
      | "NFC North"
      | "NFC South"
      | "NFC West";
    conference: "AFC" | "NFC";
  }
> = {
  BUF: { division: "AFC East", conference: "AFC" },
  MIA: { division: "AFC East", conference: "AFC" },
  NE: { division: "AFC East", conference: "AFC" },
  NYJ: { division: "AFC East", conference: "AFC" },

  BAL: { division: "AFC North", conference: "AFC" },
  CIN: { division: "AFC North", conference: "AFC" },
  CLE: { division: "AFC North", conference: "AFC" },
  PIT: { division: "AFC North", conference: "AFC" },

  HOU: { division: "AFC South", conference: "AFC" },
  IND: { division: "AFC South", conference: "AFC" },
  JAX: { division: "AFC South", conference: "AFC" },
  TEN: { division: "AFC South", conference: "AFC" },

  DEN: { division: "AFC West", conference: "AFC" },
  KC: { division: "AFC West", conference: "AFC" },
  LAC: { division: "AFC West", conference: "AFC" },
  LV: { division: "AFC West", conference: "AFC" },

  DAL: { division: "NFC East", conference: "NFC" },
  NYG: { division: "NFC East", conference: "NFC" },
  PHI: { division: "NFC East", conference: "NFC" },
  WAS: { division: "NFC East", conference: "NFC" },

  CHI: { division: "NFC North", conference: "NFC" },
  DET: { division: "NFC North", conference: "NFC" },
  GB: { division: "NFC North", conference: "NFC" },
  MIN: { division: "NFC North", conference: "NFC" },

  ATL: { division: "NFC South", conference: "NFC" },
  CAR: { division: "NFC South", conference: "NFC" },
  NO: { division: "NFC South", conference: "NFC" },
  TB: { division: "NFC South", conference: "NFC" },

  ARI: { division: "NFC West", conference: "NFC" },
  LA: { division: "NFC West", conference: "NFC" },
  SF: { division: "NFC West", conference: "NFC" },
  SEA: { division: "NFC West", conference: "NFC" },
};

const DIVISION_ORDER: Array<NflTeam["division"]> = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
];

const mockTodayMeta = {
  dateLabel: "Dimanche - Week 1",
  gamesCount: 16,
};

type ScheduleMeta = {
  dateLabel: string;
  gamesCount: number;
};

const WEEK_NUMBER_RE = /\d+/;

function normalizeWeekValue(raw: any): string | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const candidates = [raw.current, raw.week, raw.number, raw.id];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
      if (typeof candidate === "string") return candidate;
    }
  }
  return null;
}

function weekKeyFromValue(raw: any): string | null {
  const str = normalizeWeekValue(raw);
  if (!str) return null;
  const match = str.match(WEEK_NUMBER_RE);
  return match ? `wk-${match[0]}` : str.toLowerCase();
}

function formatWeekLabel(raw: any): string | null {
  const str = normalizeWeekValue(raw);
  if (!str) return null;
  const match = str.match(WEEK_NUMBER_RE);
  return match ? `Week ${match[0]}` : str;
}

function getGameDate(raw: any): Date | null {
  const dateValue = raw?.date ?? raw?.game?.date ?? null;
  if (!dateValue) return null;
  if (typeof dateValue === "number" && Number.isFinite(dateValue)) {
    const ms = dateValue < 2_000_000_000 ? dateValue * 1000 : dateValue;
    const parsed = new Date(ms);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof dateValue === "string") {
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof dateValue === "object") {
    const timestamp = Number(dateValue?.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      const parsed = new Date(timestamp * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const dateStr = typeof dateValue?.date === "string" ? dateValue.date : null;
    if (dateStr) {
      const timeStr = typeof dateValue?.time === "string" ? dateValue.time : "00:00";
      const tz = typeof dateValue?.timezone === "string" ? dateValue.timezone : "";
      const suffix = tz.toUpperCase() === "UTC" ? "Z" : "";
      const parsed = new Date(`${dateStr}T${timeStr}${suffix}`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function getGameWeekRaw(raw: any): any {
  return (
    raw?.week?.current ??
    raw?.week ??
    raw?.game?.week?.current ??
    raw?.game?.week ??
    raw?.game?.stage ??
    null
  );
}

function formatDayLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-FR", { weekday: "long" });
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Jour";
}

const mockGames = [
  {
    id: 1,
    time: "13:00",
    away: "KC",
    awayName: "Kansas City Chiefs",
    home: "CIN",
    homeName: "Cincinnati Bengals",
    total: 48.5,
    spreadFavorite: "KC -3.5",
    betalyzeScore: 93,
    paceTag: "High scoring",
  },
  {
    id: 2,
    time: "16:25",
    away: "PHI",
    awayName: "Philadelphia Eagles",
    home: "DAL",
    homeName: "Dallas Cowboys",
    total: 47.0,
    spreadFavorite: "DAL -2.5",
    betalyzeScore: 88,
    paceTag: "Balanced",
  },
  {
    id: 3,
    time: "20:20",
    away: "BUF",
    awayName: "Buffalo Bills",
    home: "NYJ",
    homeName: "New York Jets",
    total: 45.5,
    spreadFavorite: "BUF -1.5",
    betalyzeScore: 85,
    paceTag: "Air heavy",
  },
];

const mockSpotlightPlayers = [
  {
    id: 101,
    name: "Patrick Mahomes",
    team: "KC",
    metric: "Pass yards",
    proj: 305.5,
    line: 295.5,
    edge: "+10.0",
    betalyzeScore: 92,
  },
  {
    id: 102,
    name: "Ja'Marr Chase",
    team: "CIN",
    metric: "Rec yards",
    proj: 89.5,
    line: 83.5,
    edge: "+6.0",
    betalyzeScore: 90,
  },
  {
    id: 103,
    name: "Christian McCaffrey",
    team: "SF",
    metric: "Rush/Rec yards",
    proj: 118.0,
    line: 112.5,
    edge: "+5.5",
    betalyzeScore: 89,
  },
];

const PLAYER_AVATAR_SRC = "/images/avatar-player.svg";
const PLAYER_PLACEHOLDER_TOKENS = [
  "players/0",
  "placeholder",
  "default",
  "no-image",
  "noimage",
  "not-available",
  "image-not-available",
  "unknown",
];

function isPlaceholderPlayerImage(src: string | null | undefined) {
  if (!src) return true;
  const normalized = src.toLowerCase();
  return PLAYER_PLACEHOLDER_TOKENS.some((token) => normalized.includes(token));
}

function normalizeCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.trim().toUpperCase();
}

function divisionFromTeam(
  name: string,
  code: string | null,
): { division: NflTeam["division"]; conference: NflTeam["conference"] } {
  const normalizedCode = normalizeCode(code);
  if (normalizedCode && DIVISION_BY_CODE[normalizedCode]) {
    return DIVISION_BY_CODE[normalizedCode];
  }

  const byName = name.trim().toLowerCase();
  const fallback: Array<{ key: keyof typeof DIVISION_BY_CODE; match: string }> = [
    { key: "LA", match: "chargers" },
  ];
  for (const entry of fallback) {
    if (byName.includes(entry.match) && DIVISION_BY_CODE[entry.key]) {
      return DIVISION_BY_CODE[entry.key];
    }
  }

  return { division: "Unknown", conference: "Unknown" };
}

function mapNflTeams(data: any[] | undefined): NflTeam[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((t) => {
      const id = Number(t?.id);
      const name = t?.name || "Team";
      if (!Number.isFinite(id)) return null;
      // on ignore les entrees "AFC"/"NFC" generiques
      const normalizedName = name.trim().toUpperCase();
      if (normalizedName === "AFC" || normalizedName === "NFC") return null;
      const code = normalizeCode(t?.code);
      const divisionInfo = divisionFromTeam(name, code);
      return {
        id,
        name,
        code,
        city: t?.city || null,
        logo: t?.logo || null,
        division: divisionInfo.division,
        conference: divisionInfo.conference,
      } satisfies NflTeam;
    })
    .filter(Boolean) as NflTeam[];
}

export default function NflPage() {
  return <Suspense><NflPageInner /></Suspense>;
}

function NflPageInner() {
  const [teams, setTeams] = useState<NflTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<"equipes" | "players" | "defense">(
    "players",
  );
  const [players, setPlayers] = useState<NflPlayerBasic[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStatsResponse | null>(null);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerStatsError, setPlayerStatsError] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerSuggestions, setPlayerSuggestions] = useState<NflPlayerSearch[]>([]);
  const [playerSuggestionsLoading, setPlayerSuggestionsLoading] = useState(false);
  const [topProps, setTopProps] = useState<TopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(false);
  const [topPropsError, setTopPropsError] = useState<string | null>(null);
  const [topPropsMeta, setTopPropsMeta] = useState<{
    generatedAt?: string;
    cached?: boolean;
    events?: number;
  } | null>(null);
  const [topPropsLoaded, setTopPropsLoaded] = useState(false);
  const [dvpWindow, setDvpWindow] = useState<DvpWindow>("L10");
  const [dvpPosition, setDvpPosition] = useState<DvpPosition>("RB");
  const [dvpContext, setDvpContext] = useState<DvpContext>("all");
  const [dvpRows, setDvpRows] = useState<DvpRow[]>([]);
  const [dvpLoading, setDvpLoading] = useState(false);
  const [dvpError, setDvpError] = useState<string | null>(null);
  const [dvpRefreshKey, setDvpRefreshKey] = useState(0);
  const [dvpSortKey, setDvpSortKey] = useState<DvpSortKey>("btp");
  const [dvpSortDir, setDvpSortDir] = useState<"asc" | "desc">("asc");
  const [scheduleMeta, setScheduleMeta] = useState<ScheduleMeta>(mockTodayMeta);
  const searchParams = useSearchParams();

  useEffect(() => {
    const section = searchParams?.get("section");
    if (section === "equipes" || section === "players" || section === "defense") {
      setActiveSection(section);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        setTeamsLoading(true);
        setTeamsError(null);
        const res = await fetch(`/api/nfl/teams?season=${DEFAULT_SEASON}`);
        if (!res.ok) throw new Error("Failed to fetch NFL teams");
        const data: NflTeamsResponse = await res.json();
        setTeams(mapNflTeams(data.response));
      } catch (err: any) {
        setTeamsError(err?.message || "Unknown error");
      } finally {
        setTeamsLoading(false);
      }
    };
    loadTeams();
  }, []);

  useEffect(() => {
    const loadStandings = async () => {
      try {
        setStandingsLoading(true);
        setStandingsError(null);
        const res = await fetch(`/api/nfl/standings?season=${DEFAULT_SEASON}`);
        if (!res.ok) throw new Error("Failed to fetch standings");
        const data = await res.json();
        const rows: StandingRow[] = Array.isArray(data?.teams) ? data.teams : [];
        setStandings(rows);
      } catch (err: any) {
        setStandingsError(err?.message || "Unknown error");
      } finally {
        setStandingsLoading(false);
      }
    };
    loadStandings();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadScheduleMeta = async () => {
      const fetchSeason = async (season: string) => {
        const res = await fetch(
          `/api/nfl/games?season=${encodeURIComponent(season)}&status=NS`,
          { signal: controller.signal },
        );
        if (!res.ok) return [] as any[];
        const data = await res.json();
        return Array.isArray(data?.response) ? data.response : [];
      };

      try {
        const seasonsToTry = [DEFAULT_SEASON];
        const fallbackSeason = String(Number(DEFAULT_SEASON) - 1);
        if (fallbackSeason !== DEFAULT_SEASON && !Number.isNaN(Number(fallbackSeason))) {
          seasonsToTry.push(fallbackSeason);
        }

        let games: any[] = [];
        for (const season of seasonsToTry) {
          games = await fetchSeason(season);
          if (games.length) break;
        }
        if (!games.length) {
          for (const season of seasonsToTry) {
            const res = await fetch(`/api/nfl/games?season=${encodeURIComponent(season)}`, {
              signal: controller.signal,
            });
            if (!res.ok) continue;
            const data = await res.json();
            games = Array.isArray(data?.response) ? data.response : [];
            if (games.length) break;
          }
        }
        if (!games.length) return;

        const datedGames = games
          .map((game: any) => ({ game, date: getGameDate(game) }))
          .filter((entry: { game: any; date: Date | null }) => entry.date);
        if (!datedGames.length) return;

        const upcomingGames = datedGames.filter(({ date }) => {
          if (!date) return false;
          return date.getTime() >= Date.now() - 1000 * 60 * 60 * 12;
        });
        if (!upcomingGames.length) return;

        upcomingGames.sort(
          (a: { date: Date | null }, b: { date: Date | null }) =>
            (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
        );

        const nextGame = upcomingGames[0];
        if (!nextGame?.date) return;

        const weekRaw = getGameWeekRaw(nextGame.game);
        const weekKey = weekKeyFromValue(weekRaw);
        const weekLabel = formatWeekLabel(weekRaw);
        const dayLabel = formatDayLabel(nextGame.date);
        const dateLabel = weekLabel ? `${dayLabel} - ${weekLabel}` : dayLabel;

        let gamesCount = 0;
        if (weekKey) {
          gamesCount = upcomingGames.filter(
            ({ game }) => weekKeyFromValue(getGameWeekRaw(game)) === weekKey,
          ).length;
        } else {
          const dayKey = nextGame.date.toISOString().slice(0, 10);
          gamesCount = upcomingGames.filter(({ game }) => {
            const date = getGameDate(game);
            return date && date.toISOString().slice(0, 10) === dayKey;
          }).length;
        }

        if (gamesCount <= 0) return;
        setScheduleMeta({ dateLabel, gamesCount });
      } catch (err) {
        if (controller.signal.aborted) return;
      }
    };

    loadScheduleMeta();
    return () => controller.abort();
  }, []);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return teams
      .filter((t) => {
        const name = (t.name || "").toLowerCase();
        const code = (t.code || "").toLowerCase();
        const city = (t.city || "").toLowerCase();
        return name.includes(q) || code.includes(q) || city.includes(q);
      })
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        label: t.name,
        meta: [t.code, t.city, t.division].filter(Boolean).join(" - "),
        href: `/nfl?team=${t.id}`,
        logo: t.logo,
      }));
  }, [search, teams]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setPlayerSuggestions([]);
      setPlayerSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setPlayerSuggestionsLoading(true);
        const url = new URL("/api/nfl/players/search", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("season", DEFAULT_SEASON);
        url.searchParams.set("limit", "20");
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) {
          setPlayerSuggestions([]);
          return;
        }
        const data: NflPlayersSearchResponse = await res.json();
        setPlayerSuggestions(Array.isArray(data?.players) ? data.players : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlayerSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setPlayerSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const divisions = useMemo(
    () =>
      DIVISION_ORDER.map((div) => ({
        name: div,
        teams: standings
          .filter((t) => t.division === div)
          .sort((a, b) => a.order - b.order),
      })).filter((d) => d.teams.length > 0),
    [standings],
  );

  const conferences = useMemo(
    () =>
      [
        { name: "AFC", teams: standings.filter((t) => t.conference === "AFC") },
        { name: "NFC", teams: standings.filter((t) => t.conference === "NFC") },
      ].map((c) => ({
        ...c,
        teams: c.teams.sort((a, b) => a.order - b.order),
      })),
    [standings],
  );

  const leagueSorted = useMemo(
    () => [...standings].sort((a, b) => a.order - b.order),
    [standings],
  );

  const groupedDivisions = useMemo(() => {
    const byConf: Record<"AFC" | "NFC", typeof divisions[number][]> = {
      AFC: [],
      NFC: [],
    };
    divisions.forEach((d) => {
      if (d.name.startsWith("AFC")) byConf.AFC.push(d);
      else if (d.name.startsWith("NFC")) byConf.NFC.push(d);
    });
    return [
      { label: "AMERICAN FOOTBALL CONFERENCE", divisions: byConf.AFC },
      { label: "NATIONAL FOOTBALL CONFERENCE", divisions: byConf.NFC },
    ];
  }, [divisions]);

  // Sélectionner une équipe par défaut pour l'onglet Players : premier teamId des standings
  useEffect(() => {
    if (!selectedTeamId && standings.length > 0) {
      setSelectedTeamId(String(standings[0].teamId));
    }
  }, [standings, selectedTeamId]);

  const loadPlayers = async (teamId: string | null) => {
    if (!teamId) return;
    try {
      setPlayersLoading(true);
      setPlayersError(null);
      const url = new URL("/api/nfl/players", window.location.origin);
      url.searchParams.set("season", DEFAULT_SEASON);
      url.searchParams.set("team", teamId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch players");
      const data = await res.json();
      const list: NflPlayerBasic[] = Array.isArray(data?.players)
        ? data.players.map((p: any) => ({
            id: Number(p?.id),
            name: p?.name ?? "Player",
            position: p?.position ?? null,
            number: p?.number ?? null,
            image: p?.image ?? null,
          }))
        : [];
      setPlayers(list);
    } catch (err: any) {
      setPlayersError(err?.message || "Unknown error");
    } finally {
      setPlayersLoading(false);
    }
  };

  const loadPlayerStats = async (playerId: number | null) => {
    if (!playerId) return;
    try {
      setPlayerStatsLoading(true);
      setPlayerStatsError(null);
      const url = new URL(`/api/nfl/players/${playerId}/statistics`, window.location.origin);
      url.searchParams.set("season", DEFAULT_SEASON);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch player stats");
      const data: PlayerStatsResponse = await res.json();
      setPlayerStats(data);
    } catch (err: any) {
      setPlayerStatsError(err?.message || "Unknown error");
      setPlayerStats(null);
    } finally {
      setPlayerStatsLoading(false);
    }
  };

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
    if (activeSection === "players" && selectedTeamId) {
      loadPlayers(selectedTeamId);
    }
  }, [activeSection, selectedTeamId]);

  useEffect(() => {
    if (activeSection !== "players") return;
    if (topPropsLoaded || topPropsLoading) return;
    loadTopProps(false);
  }, [activeSection, topPropsLoaded, topPropsLoading]);

  useEffect(() => {
    if (activeSection !== "defense") return;
    const controller = new AbortController();
    const loadDvp = async () => {
      try {
        setDvpLoading(true);
        setDvpError(null);
        const url = new URL("/api/nfl/defense/dvp", window.location.origin);
        url.searchParams.set("season", DEFAULT_SEASON);
        url.searchParams.set("window", dvpWindow);
        url.searchParams.set("position", dvpPosition);
        url.searchParams.set("context", dvpContext);
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch DvP");
        const data = await res.json();
        const rows: DvpRow[] = Array.isArray(data?.rows) ? data.rows : [];
        setDvpRows(rows);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setDvpRows([]);
        setDvpError(err?.message || "Unknown error");
      } finally {
        if (!controller.signal.aborted) setDvpLoading(false);
      }
    };
    loadDvp();
    return () => controller.abort();
  }, [activeSection, dvpWindow, dvpPosition, dvpContext, dvpRefreshKey]);

  const teamMetaById = useMemo(() => {
    const map = new Map<number, { name?: string | null; code?: string | null; logo?: string | null }>();
    teams.forEach((team) => {
      map.set(team.id, { name: team.name, code: team.code, logo: team.logo });
    });
    return map;
  }, [teams]);

  const dvpColumns = useMemo(() => {
    if (dvpPosition === "QB") {
      return [
        { key: "passYds", label: "Pass Yds", help: "Yards a la passe concedes par match." },
        { key: "completions", label: "Cmp", help: "Passes complétées concédées." },
        { key: "attempts", label: "Att", help: "Tentatives de passe concédées." },
        { key: "passTD", label: "Pass TD", help: "TD a la passe concédés par match." },
        { key: "ints", label: "INT", help: "Interceptions lancees contre la defense." },
        { key: "passPct", label: "Cmp%", help: "% de passes complétées concédées." },
        { key: "passYpa", label: "Yds/Att", help: "Yards par tentative de passe." },
        { key: "rushYds", label: "Rush Yds", help: "Yards au sol du QB concédés." },
        { key: "rushTD", label: "Rush TD", help: "TD au sol du QB concédés." },
        { key: "rushAtt", label: "Rush Att", help: "Courses du QB concédées." },
      ] as const;
    }
    if (dvpPosition === "RB") {
      return [
        { key: "rushYds", label: "Rush Yds", help: "Yards au sol concédés aux RB." },
        { key: "rushTD", label: "Rush TD", help: "TD au sol concédés aux RB." },
        { key: "rec", label: "Rec", help: "Réceptions concédées aux RB." },
        { key: "recYds", label: "Rec Yds", help: "Yards à la réception concédés." },
        { key: "targets", label: "Targets", help: "Cibles concédées aux RB." },
        { key: "rushYpc", label: "Yds/Att", help: "Yards par course concédés." },
        { key: "recYpr", label: "Yds/Rec", help: "Yards par réception concédés." },
      ] as const;
    }
    return [
      { key: "rec", label: "Rec", help: "Réceptions concédées." },
      { key: "recYds", label: "Rec Yds", help: "Yards à la réception concédés." },
      { key: "recTD", label: "Rec TD", help: "TD à la réception concédés." },
      { key: "targets", label: "Targets", help: "Cibles concédées." },
      { key: "recYpr", label: "Yds/Rec", help: "Yards par réception concédés." },
      { key: "recYpt", label: "Yds/Tgt", help: "Yards par cible concédés." },
    ] as const;
  }, [dvpPosition]);

  const defaultSortDir = (key: DvpSortKey) => {
    return "asc";
  };

  const rankDirection = (key: DvpSortKey) => {
    return "asc";
  };

  const applySort = (key: DvpSortKey) => {
    if (dvpSortKey === key) {
      setDvpSortDir(dvpSortDir === "asc" ? "desc" : "asc");
      return;
    }
    setDvpSortKey(key);
    setDvpSortDir(defaultSortDir(key));
  };

  const sortIndicator = (key: DvpSortKey) => {
    if (dvpSortKey !== key) return "";
    return dvpSortDir === "asc" ? "^" : "v";
  };

  const sortedHeaderTone = (key: DvpSortKey) =>
    dvpSortKey === key ? "bg-emerald-500/15 text-emerald-100" : "";
  const sortedCellTone = (key: DvpSortKey) =>
    dvpSortKey === key ? "bg-emerald-500/10" : "";

  const calcRatio = (num: number, den: number) => {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return num / den;
  };

  const resolveDvpValue = (
    perGame: DvpStatTotals,
    key:
      | keyof DvpStatTotals
      | "passPct"
      | "passYpa"
      | "rushYpc"
      | "recYpr"
      | "recYpt",
  ) => {
    if (key === "passPct") {
      const pct = calcRatio(perGame.completions, perGame.attempts);
      return pct === null ? null : pct * 100;
    }
    if (key === "passYpa") {
      return calcRatio(perGame.passYds, perGame.attempts);
    }
    if (key === "rushYpc") {
      return calcRatio(perGame.rushYds, perGame.rushAtt);
    }
    if (key === "recYpr") {
      return calcRatio(perGame.recYds, perGame.rec);
    }
    if (key === "recYpt") {
      return calcRatio(perGame.recYds, perGame.targets);
    }
    return perGame[key];
  };

  const formatDvpNumber = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return "—";
    return Number(value).toFixed(1);
  };

  const formatDvpPercent = (value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return "—";
    return `${Number(value).toFixed(1)}%`;
  };

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

  const dvpRankMap = useMemo(() => {
    const rankKey: DvpSortKey = dvpSortKey === "rank" ? "btp" : dvpSortKey;
    const direction = rankDirection(rankKey);
    const items = dvpRows.map((row, idx) => {
      const perGame = row.metrics?.perGame ?? ({} as DvpStatTotals);
      const value =
        rankKey === "btp"
          ? row.ffpPerGame
          : rankKey === "games"
            ? row.games
            : resolveDvpValue(perGame, rankKey);
      return { row, idx, value };
    });

    items.sort((a, b) => {
      const av = Number.isFinite(a.value ?? NaN) ? Number(a.value) : null;
      const bv = Number.isFinite(b.value ?? NaN) ? Number(b.value) : null;
      if (av === null && bv === null) return a.idx - b.idx;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av === bv) return a.idx - b.idx;
      return direction === "asc" ? av - bv : bv - av;
    });

    const map = new Map<number, number>();
    items.forEach((item, idx) => {
      map.set(item.row.teamId, idx + 1);
    });
    return map;
  }, [dvpRows, dvpSortKey]);

  const dvpSorted = useMemo(() => {
    return [...dvpRows]
      .map((row, idx) => {
        const perGame = row.metrics?.perGame ?? ({} as DvpStatTotals);
        const value =
          dvpSortKey === "btp"
            ? row.ffpPerGame
            : dvpSortKey === "games"
              ? row.games
              : dvpSortKey === "rank"
                ? row.rank ?? null
                : resolveDvpValue(perGame, dvpSortKey);
        return { row, idx, value };
      })
      .sort((a, b) => {
        const av = Number.isFinite(a.value ?? NaN) ? Number(a.value) : null;
        const bv = Number.isFinite(b.value ?? NaN) ? Number(b.value) : null;
        if (av === null && bv === null) return a.idx - b.idx;
        if (av === null) return 1;
        if (bv === null) return -1;
        if (av === bv) return (a.row.rank ?? 999) - (b.row.rank ?? 999);
        return dvpSortDir === "asc" ? av - bv : bv - av;
      })
      .map((item) => ({ row: item.row }));
  }, [dvpRows, dvpSortKey, dvpSortDir]);

  const renderTable = (title: string, rows: StandingRow[]) => {
    if (!rows.length) return null;
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b090f]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-200">{title}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px] text-slate-100">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Team</th>
                <th className="px-2 py-2 text-center font-semibold">W</th>
                <th className="px-2 py-2 text-center font-semibold">L</th>
                <th className="px-2 py-2 text-center font-semibold">T</th>
                <th className="px-2 py-2 text-center font-semibold">Pct</th>
                <th className="px-2 py-2 text-center font-semibold">PF</th>
                <th className="px-2 py-2 text-center font-semibold">PA</th>
                <th className="px-2 py-2 text-center font-semibold">Net</th>
                <th className="px-2 py-2 text-center font-semibold">Home</th>
                <th className="px-2 py-2 text-center font-semibold">Road</th>
                <th className="px-2 py-2 text-center font-semibold">Div</th>
                <th className="px-2 py-2 text-center font-semibold">Conf</th>
                <th className="px-2 py-2 text-center font-semibold">Non-Conf</th>
                <th className="px-2 py-2 text-center font-semibold">Stk</th>
                <th className="px-2 py-2 text-center font-semibold">Last 5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((team) => (
                <tr key={team.teamId} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
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
                      <p className="truncate text-[11px] font-medium text-slate-100">
                        {team.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100 font-medium">{team.w}</td>
                  <td className="px-2 py-2 text-center text-slate-100 font-medium">{team.l}</td>
                  <td className="px-2 py-2 text-center text-slate-100 font-medium">{team.t}</td>
                  <td className="px-2 py-2 text-center text-slate-100 font-medium">
                    {team.pct.toFixed(3)}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">{team.pf}</td>
                  <td className="px-2 py-2 text-center text-slate-100">{team.pa}</td>
                  <td className="px-2 py-2 text-center text-slate-100">{team.net}</td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.home.text ?? `${team.home.w}-${team.home.l}-${team.home.t}`}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.road.text ?? `${team.road.w}-${team.road.l}-${team.road.t}`}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.div.text ?? `${team.div.w}-${team.div.l}-${team.div.t}`}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.conf.text ?? `${team.conf.w}-${team.conf.l}-${team.conf.t}`}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.nonConf.text ?? `${team.nonConf.w}-${team.nonConf.l}-${team.nonConf.t}`}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.streak ?? "-"}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-100">
                    {team.last5.w}-{team.last5.l}-{team.last5.t}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const StandingsSection = () => (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          Equipes NFL
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-50">Classement</h2>
      </div>

      {standingsLoading && (
        <p className="text-sm text-slate-400">Chargement des standings...</p>
      )}

      {standingsError && (
        <p className="text-sm text-red-400">
          Erreur lors du chargement des standings : {standingsError}
        </p>
      )}

      {!standingsLoading && !standingsError && standings.length === 0 && (
        <p className="text-sm text-slate-400">
          Aucun match termine retourne pour la saison {DEFAULT_SEASON}.
        </p>
      )}

      {divisions.length > 0 && (
        <div className="space-y-5">
          {groupedDivisions.map((block) =>
            block.divisions.length ? (
              <div key={block.label} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {block.label}
                </p>
                <div className="space-y-3">
                  {block.divisions.map((div) => (
                    <div key={div.name}>{renderTable(div.name, div.teams)}</div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <div className="rounded-xl border border-white/10 bg-[#0b090f]/80 p-3 text-[10px] text-slate-300">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Legende
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["W / L / T", "Wins / Losses / Ties"],
                ["Pct", "Winning %"],
                ["PF / PA", "Points For / Against"],
                ["Net Pts", "PF - PA"],
                ["Home / Road", "Records domicile / exterieur"],
                ["Stk", "Streak en cours"],
                ["Last 5", "Forme 5 derniers"],
              ].map(([label, desc]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-300">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  const MatchupsSection = () => (
    <section className="rounded-3xl border border-white/10 bg-[#050309] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            Top matchups semaine (mock)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Spots offensifs ou mismatchs defensifs selon Betalyze.
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
            <span>Totals eleves</span>
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
                {g.time} - {g.paceTag}
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
    </section>
  );

  const PlayersSection = () => (
    <section className="rounded-3xl border border-white/10 bg-[#08050d]/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
            Players / props (beta)
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Liste des joueurs NFL (source API-Sports) et stats par poste.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          <select
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1"
            value={selectedTeamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value || null)}
          >
            {(standings || []).map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Rechercher un joueur..."
            className="w-48 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {playersError && <p className="mt-3 text-xs text-red-400">{playersError}</p>}

      <div className="mt-3 grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {playersLoading && <p className="text-xs text-slate-400">Chargement joueurs...</p>}
          {!playersLoading && players.length === 0 && (
            <p className="text-xs text-slate-500">Aucun joueur.</p>
          )}
          {players
            .filter((p) => {
              if (!playerSearch.trim()) return true;
              return p.name.toLowerCase().includes(playerSearch.trim().toLowerCase());
            })
            .map((p) => (
              <Link
                key={p.id}
                href={`/nfl/players/${p.id}`}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#0b070f] px-3 py-2 text-left hover:border-amber-400/60"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-[10px] font-semibold text-amber-200 ring-1 ring-white/10">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-slate-100">{p.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {p.position ?? "Pos"} {p.number ? ` · #${p.number}` : ""}
                  </p>
                </div>
              </Link>
            ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b070f] p-4">
          <p className="text-xs text-slate-400">
            Clique sur un joueur pour voir sa fiche detaillee.
          </p>
        </div>
      </div>
    </section>
  );

  const BestPropsSection = () => (
    <section className="rounded-3xl border border-white/10 bg-[#0b090f] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
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

      {topPropsError && <p className="mt-3 text-xs text-rose-300">{topPropsError}</p>}
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
                  background: `linear-gradient(90deg, ${hexToRgba(primary, 0.35)} 0%, rgba(0,0,0,0) 100%)`,
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
  );

  const AllGamesSection = () => (
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
          Rafraichir
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
                {g.time} - Total {g.total.toFixed(1)} - {g.spreadFavorite}
              </p>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-100 sm:gap-4">
              <div className="hidden flex-col items-center sm:flex">
                <span className="text-[9px] text-slate-500">Note</span>
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
  );

  const DefenseSection = () => {
    const windowOptions: Array<{ key: DvpWindow; label: string }> = [
      { key: "season", label: "Season" },
      { key: "L10", label: "L10" },
      { key: "L5", label: "L5" },
    ];
    const positionOptions: DvpPosition[] = ["QB", "RB", "WR", "TE"];
    const contextOptions: Array<{ key: DvpContext; label: string }> = [
      { key: "all", label: "All" },
      { key: "home", label: "Home" },
      { key: "away", label: "Away" },
    ];

    const tierForRank = (rank?: number | null) => {
      if (!rank) return { label: "—", tone: "text-slate-400 bg-white/5" };
      if (rank <= 5) return { label: "Elite", tone: "text-emerald-200 bg-emerald-500/15" };
      if (rank <= 12) return { label: "Solid", tone: "text-sky-200 bg-sky-500/15" };
      if (rank <= 20) return { label: "Average", tone: "text-slate-200 bg-white/10" };
      if (rank <= 28) return { label: "Weak", tone: "text-amber-200 bg-amber-500/15" };
      return { label: "Soft", tone: "text-rose-200 bg-rose-500/15" };
    };

    return (
      <section className="rounded-3xl border border-white/10 bg-[#0b090f] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Defense vs position (BTP allowed)
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Classement par points Betalyze concédés + splits par poste.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 text-[11px]">
              {windowOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDvpWindow(opt.key)}
                  className={`rounded-full px-3 py-1 transition ${
                    dvpWindow === opt.key
                      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 text-[11px]">
              {positionOptions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setDvpPosition(pos)}
                  className={`rounded-full px-3 py-1 transition ${
                    dvpPosition === pos
                      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 text-[11px]">
              {contextOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDvpContext(opt.key)}
                  className={`rounded-full px-3 py-1 transition ${
                    dvpContext === opt.key
                      ? "bg-slate-200/10 text-slate-100 ring-1 ring-white/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setDvpRefreshKey((prev) => prev + 1)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-200"
            >
              Rafraichir
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {dvpError && <p className="mt-3 text-xs text-rose-300">{dvpError}</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b070f]">
          {dvpLoading ? (
            <div className="px-4 py-6 text-sm text-slate-400">Chargement DvP...</div>
          ) : dvpSorted.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">Aucune donnée disponible.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[10px] text-slate-100">
                <thead className="bg-white/5 text-[9px] uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Rk</th>
                    <th className="px-3 py-2 text-left font-semibold">Team</th>
                    <th
                      className={`group relative px-2 py-2 text-center font-semibold ${sortedHeaderTone(
                        "btp",
                      )}`}
                    >
                      <button
                        type="button"
                        onClick={() => applySort("btp")}
                        className="inline-flex items-center gap-1"
                      >
                        BTP/G
                        <span className="text-[8px] text-slate-500">{sortIndicator("btp")}</span>
                      </button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                        Points Betalyze concédés par match.
                      </span>
                    </th>
                    <th
                      className={`group relative px-2 py-2 text-center font-semibold ${sortedHeaderTone(
                        "games",
                      )}`}
                    >
                      <button
                        type="button"
                        onClick={() => applySort("games")}
                        className="inline-flex items-center gap-1"
                      >
                        GP
                        <span className="text-[8px] text-slate-500">
                          {sortIndicator("games")}
                        </span>
                      </button>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                        Matchs joués dans la fenêtre.
                      </span>
                    </th>
                    <th className="group relative px-2 py-2 text-center font-semibold">
                      <span>Tier</span>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                        Classement visuel basé sur le rang BTP/G.
                      </span>
                    </th>
                    {dvpColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`group relative px-2 py-2 text-center font-semibold ${sortedHeaderTone(
                          col.key as DvpSortKey,
                        )}`}
                      >
                        <button
                          type="button"
                          onClick={() => applySort(col.key as DvpSortKey)}
                          className="inline-flex items-center gap-1"
                        >
                          {col.label}
                          <span className="text-[8px] text-slate-500">
                            {sortIndicator(col.key as DvpSortKey)}
                          </span>
                        </button>
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                          {col.help}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dvpSorted.map(({ row }) => {
                    const meta = teamMetaById.get(row.teamId);
                    const name = meta?.name ?? row.teamName ?? "Team";
                    const abbr = meta?.code ?? row.teamAbbr ?? "";
                    const logo = meta?.logo ?? null;
                    const perGame = row.metrics?.perGame ?? ({} as DvpStatTotals);
                    const rank = row.rank ?? null;
                    const displayRank = dvpRankMap.get(row.teamId) ?? null;
                    const toneRank =
                      dvpSortKey === "btp" || dvpSortKey === "rank" ? rank : null;
                    const rankTone =
                      toneRank && toneRank <= 5
                        ? "text-emerald-300"
                        : toneRank && toneRank >= 28
                          ? "text-rose-300"
                          : "text-slate-200";
                    const tier = tierForRank(rank);
                    return (
                      <tr key={`${row.teamId}-${row.position}-${row.window}-${row.context}`}>
                        <td className={`px-3 py-2 font-semibold ${rankTone}`}>
                          {Number.isFinite(displayRank ?? NaN) ? `#${displayRank}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={logo}
                                alt={name}
                                className="h-5 w-5 object-contain"
                              />
                            ) : (
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-300">
                                {abbr || name.slice(0, 3).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-medium text-slate-100">
                                {name}
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {abbr || row.teamAbbr || "NFL"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`px-2 py-2 text-center text-amber-200 ${sortedCellTone(
                            "btp",
                          )}`}
                        >
                          {formatDvpNumber(row.ffpPerGame)}
                        </td>
                        <td
                          className={`px-2 py-2 text-center text-slate-300 ${sortedCellTone(
                            "games",
                          )}`}
                        >
                          {row.games ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] ${tier.tone}`}>
                            {tier.label}
                          </span>
                        </td>
                        {dvpColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-2 py-2 text-center text-slate-200 ${sortedCellTone(
                              col.key as DvpSortKey,
                            )}`}
                          >
                            {col.key === "passPct"
                              ? formatDvpPercent(resolveDvpValue(perGame, col.key))
                              : formatDvpNumber(resolveDvpValue(perGame, col.key))}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
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
              className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              NBA
            </Link>
            <span className="rounded-full px-2 py-1 text-amber-200 bg-white/5 border border-white/10">
              NFL
            </span>
            <span className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5">
              NHL
            </span>
            <span className="rounded-full px-2 py-1 text-slate-400 hover:bg-white/5">
              MLB
            </span>
          </div>
        </div>

        <main className="space-y-10">
          {/* Hero / search */}
          <section className="rounded-3xl border border-white/10 bg-[#0b090f] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b090f] px-3 py-1.5 text-[11px] text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{scheduleMeta.dateLabel}</span>
                </button>
                <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-300">
                  {scheduleMeta.gamesCount} matchs au programme
                </span>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-semibold tracking-wide text-black shadow-md shadow-orange-500/40 hover:brightness-110">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Matchups NFL - coming soon</span>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <div>
                  <p className="font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Recherche equipe
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Autosuggest equipes
                </div>
              </div>

              <div className="relative flex-1">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <SearchIcon className="h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une equipe (ville, code, nom)..."
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {teamsError && (
                <p className="text-xs text-red-400">
                  Erreur lors du chargement : {teamsError}
                </p>
              )}

              {(suggestions.length > 0 ||
                playerSuggestions.length > 0 ||
                playerSuggestionsLoading) && (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-2 text-sm max-h-64 overflow-y-auto pr-1">
                  {suggestions.length > 0 && (
                    <div className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Equipes
                    </div>
                  )}
                  {suggestions.map((item) => (
                    <Link
                      key={`team-${item.id}`}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 ring-1 ring-white/10">
                          {item.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.logo}
                              alt={item.label}
                              className="h-6 w-6 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-200">
                              {(item.label || "").slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-50">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.meta || "NFL"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] border-emerald-400/60 text-emerald-200">
                        Team
                      </span>
                    </Link>
                  ))}

                  {(playerSuggestionsLoading || playerSuggestions.length > 0) && (
                    <div className="px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Joueurs
                    </div>
                  )}
                  {playerSuggestionsLoading && (
                    <p className="px-3 text-[11px] text-slate-500">Chargement joueurs…</p>
                  )}
                  {playerSuggestions.map((player) => {
                    const teamMeta = player.team?.code || player.team?.name || "NFL";
                    const numberLabel =
                      player.number !== null && player.number !== undefined
                        ? `#${player.number}`
                        : "";
                    const meta = [teamMeta, player.position, numberLabel]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Link
                        key={`player-${player.id}`}
                        href={`/nfl/players/${player.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 ring-1 ring-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                player.image && !isPlaceholderPlayerImage(player.image)
                                  ? player.image
                                  : PLAYER_AVATAR_SRC
                              }
                              alt={player.name}
                              className="h-6 w-6 rounded-md object-cover"
                              onError={(event) => {
                                event.currentTarget.src = PLAYER_AVATAR_SRC;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-50">
                              {player.name}
                            </p>
                            <p className="text-[11px] text-slate-500">{meta || "NFL"}</p>
                          </div>
                        </div>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] border-amber-400/60 text-amber-200">
                          Player
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {!teamsLoading &&
                search.trim().length >= 2 &&
                suggestions.length === 0 &&
                playerSuggestions.length === 0 &&
                !playerSuggestionsLoading &&
                !teamsError && (
                  <p className="text-xs text-slate-500">
                    Aucun resultat pour "{search.trim()}".
                  </p>
                )}

              {/* Navigation cards */}
              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveSection("players")}
                  className={
                    "flex flex-col items-start gap-1 rounded-2xl px-3 py-2.5 text-left ring-1 ring-amber-400/60 transition " +
                    (activeSection === "players"
                      ? "bg-gradient-to-br from-amber-500/35 to-orange-500/40 border border-amber-300/80 ring-2 ring-amber-300/80 shadow-[0_0_24px_rgba(245,158,11,0.45)]"
                      : "bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-transparent hover:brightness-110")
                  }
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    <Sparkles className="h-3 w-3" />
                    Players/Props
                  </span>
                  <span className="text-xs text-amber-100">
                    Module props et leaders joueurs (coming soon).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("equipes")}
                  className={
                    "flex flex-col items-start gap-1 rounded-2xl px-3 py-2.5 text-left ring-1 ring-white/10 transition " +
                    (activeSection === "equipes"
                      ? "bg-[#0b070f] border border-amber-300/70 ring-2 ring-amber-300/60 shadow-[0_0_22px_rgba(251,191,36,0.35)]"
                      : "bg-[#0b070f] hover:border-amber-400/60 border border-white/10")
                  }
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    <Activity className="h-3 w-3 text-amber-400" />
                    Equipes
                  </span>
                  <span className="text-xs text-slate-300">
                    Profils NFL, standings et matchups.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("defense")}
                  className={
                    "flex flex-col items-start gap-1 rounded-2xl px-3 py-2.5 text-left ring-1 ring-emerald-500/40 transition " +
                    (activeSection === "defense"
                      ? "bg-[#071010] border border-emerald-300/70 ring-2 ring-emerald-300/70 shadow-[0_0_22px_rgba(16,185,129,0.35)]"
                      : "bg-[#071010] border border-transparent hover:border-emerald-400/60")
                  }
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    <Flame className="h-3 w-3 text-emerald-300" />
                    Defense vs position
                  </span>
                  <span className="text-xs text-emerald-50/90">
                    Classements DvP par poste (QB/RB/WR/TE).
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Section dynamique selon l'onglet */}
          {activeSection === "equipes" && (
            <div className="space-y-6">
              <MatchupsSection />
              <AllGamesSection />
              <StandingsSection />
            </div>
          )}

          {activeSection === "players" && (
            <div className="space-y-6">
              <BestPropsSection />
              <PlayersSection />
              <AllGamesSection />
            </div>
          )}

          {activeSection === "defense" && (
            <div className="space-y-6">
              <DefenseSection />
              <AllGamesSection />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
