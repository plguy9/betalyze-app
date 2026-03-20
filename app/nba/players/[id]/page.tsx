"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Shield, SlidersHorizontal, Sparkles } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type NbaPlayer = {
  id?: number | string;
  fullName?: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId?: number | string | null;
  teamName?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
  age?: number | null;
  height?: string | null;
  weight?: string | null;
  nationality?: string | null;
  isActive?: boolean;
};

type PlayerSummaryPayload = {
  ok: boolean;
  summary?: {
    player?: NbaPlayer | null;
    last5: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
      pointsStdDev?: number | null;
      minutesStdDev?: number | null;
    } | null;
    last10: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
      pointsStdDev?: number | null;
      minutesStdDev?: number | null;
    } | null;
    seasonAvg?: {
      sampleSize: number;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
      pointsStdDev?: number | null;
      minutesStdDev?: number | null;
    } | null;
    pointsTrend: "up" | "flat" | "down" | "unknown";
    dataQuality: "low" | "medium" | "high";
    games?: Array<{
      gameId: number;
      date: string;
      teamCode: string | null;
      opponentTeamName: string | null;
      opponentTeamCode: string | null;
      homeAway?: "home" | "away" | "unknown";
      result?: "W" | "L" | "NA";
      score?: string | null;
      points: number | null;
      rebounds: number | null;
      assists: number | null;
      minutes: number | null;
      fieldGoalsMade?: number | null;
      fieldGoalsAttempted?: number | null;
      fieldGoalPct?: number | null;
      threePointsMade?: number | null;
      threePointsAttempted?: number | null;
      threePointPct?: number | null;
      freeThrowsMade?: number | null;
      freeThrowsAttempted?: number | null;
      freeThrowPct?: number | null;
      isPreseason?: boolean;
    }>;
  };
};

type PlayersApiPayload = {
  players?: NbaPlayer[];
  response?: NbaPlayer[];
  player?: NbaPlayer | null;
};

type TeamMeta = {
  id: number;
  name: string;
  fullName: string | null;
  code: string | null;
  logo: string | null;
};

type TeamsApiPayload = {
  teams?: TeamMeta[];
};

type NextGame = {
  id?: number | string | null;
  timestamp?: number | null;
  date?: string | null;
  time?: string | null;
  timezone?: string | null;
  venue?: string | { name?: string | null; city?: string | null } | null;
  status?: { short?: string | null; long?: string | null } | null;
  teams?: {
    home?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      code?: string | null;
    };
    away?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      code?: string | null;
    };
  } | null;
};

type NbaDvpPosition = "G" | "F" | "C";

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
  teamId: number;
  teamName: string | null;
  teamAbbr: string | null;
  games: number;
  btpPerGame: number;
  rank: number | null;
  metrics?: {
    perGame?: NbaDvpStatTotals | null;
  } | null;
};

type NbaOddsPlayerProp = {
  name: string;
  metric: string;
  line: number;
  odd: string | null;
  overOdd?: string | null;
  underOdd?: string | null;
  bookmakerId?: number | null;
  bookmakerName?: string | null;
};

type NbaOddsPayload = {
  ok?: boolean;
  game?: number;
  source?: string | null;
  cacheLayer?: "memory" | "supabase" | "file" | "network" | string | null;
  bookmaker?: { id?: number | null; name?: string | null } | null;
  availableBookmakers?: Array<{ key: string; name: string }>;
  total?: number | null;
  spread?: { side: "home" | "away"; line: number } | null;
  playerProps?: NbaOddsPlayerProp[];
};

type OverviewRange = "Season" | "Last 5" | "Last 10";

type GameFilter = "all" | "home" | "away";

type TrendMetricKey = "pts" | "reb" | "ast" | "pra" | "tp";
type TrendWindowKey = "L20" | "L10" | "L5";

type OverviewTone = "orange" | "green" | "blue" | "gold";

type OverviewTileProps = {
  label: string;
  value: string;
  tone: OverviewTone;
  subLeft: string;
  subRight: string;
};

const DEFAULT_SEASON =
  process.env.NEXT_PUBLIC_APISPORTS_NBA_SEASON ?? "2025";
const DEFAULT_ODDS_BOOKMAKER = "fanduel";

const ODDS_METRIC_ALIASES: Record<TrendMetricKey, string[]> = {
  pts: ["Points"],
  reb: ["Rebounds"],
  ast: ["Assists"],
  pra: ["PRA", "P+A", "P+R"],
  tp: ["3PM"],
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
const NBA_TEAM_ID_BY_CODE: Record<string, string> = {
  ATL: "1610612737",
  BOS: "1610612738",
  BKN: "1610612751",
  CHA: "1610612766",
  CHI: "1610612741",
  CLE: "1610612739",
  DAL: "1610612742",
  DEN: "1610612743",
  DET: "1610612765",
  GSW: "1610612744",
  HOU: "1610612745",
  IND: "1610612754",
  LAC: "1610612746",
  LAL: "1610612747",
  MEM: "1610612763",
  MIA: "1610612748",
  MIL: "1610612749",
  MIN: "1610612750",
  NOP: "1610612740",
  NYK: "1610612752",
  OKC: "1610612760",
  ORL: "1610612753",
  PHI: "1610612755",
  PHX: "1610612756",
  POR: "1610612757",
  SAC: "1610612758",
  SAS: "1610612759",
  TOR: "1610612761",
  UTA: "1610612762",
  WAS: "1610612764",
};

const APISPORTS_TEAM_ID_BY_CODE: Record<string, number> = {
  ATL: 132,
  BOS: 133,
  BKN: 134,
  CHA: 135,
  CHI: 136,
  CLE: 137,
  DAL: 138,
  DEN: 139,
  DET: 140,
  GSW: 141,
  HOU: 142,
  IND: 143,
  LAC: 144,
  LAL: 145,
  MEM: 146,
  MIA: 147,
  MIL: 148,
  MIN: 149,
  NOP: 150,
  NYK: 151,
  OKC: 152,
  ORL: 153,
  PHI: 154,
  PHX: 155,
  POR: 156,
  SAC: 157,
  SAS: 158,
  TOR: 159,
  UTA: 160,
  WAS: 161,
};

const TEAM_FULL_NAME_BY_CODE: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

const getNbaCdnLogo = (code?: string | null) => {
  if (!code) return null;
  const key = code.toUpperCase();
  const id = NBA_TEAM_ID_BY_CODE[key];
  if (!id) return null;
  return `https://cdn.nba.com/logos/nba/${id}/primary/L/logo.svg`;
};

function formatName(p: NbaPlayer): string {
  const fromParts = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  if (p.fullName) {
    const raw = p.fullName.trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts.pop();
      const last = parts.join(" ");
      return `${first} ${last}`.trim();
    }
    return raw;
  }
  return `Player #${p.id}`;
}

function normalizeSearchInput(value: string): string {
  return value.replace(/[-_]+/g, " ").trim();
}

function safeNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function formatMadeAttempt(
  made: number | null | undefined,
  attempts: number | null | undefined,
): string {
  if (made === null || made === undefined) return "-";
  if (attempts === null || attempts === undefined) return "-";
  return `${made}-${attempts}`;
}

function formatPct(
  pct: number | null | undefined,
  made: number | null | undefined,
  attempts: number | null | undefined,
): string {
  const direct =
    pct !== null && pct !== undefined
      ? pct
      : made !== null &&
        made !== undefined &&
        attempts !== null &&
        attempts !== undefined &&
        attempts > 0
      ? (made / attempts) * 100
      : null;
  if (direct === null || direct === undefined || Number.isNaN(direct)) return "-";
  return Number(direct).toFixed(1);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pctHit(values: number[], line: number) {
  if (!values.length) return 0;
  const hit = values.filter((v) => v >= line).length;
  return Math.round((hit / values.length) * 100);
}

function dateShort(raw: string) {
  if (!raw) return "-";
  if (!raw.includes("-")) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function altLineForGame(base: number, g: PlayerSummaryPayload["summary"]["games"][number]) {
  if (!Number.isFinite(base) || base <= 0) return base;
  const seed = `${g.opponentTeamCode ?? ""}-${g.date ?? ""}-${g.gameId ?? ""}`;
  const hash = hashString(seed);
  const offsetPct = ((hash % 13) - 6) / 100;
  return Math.round(base * (1 + offsetPct) * 10) / 10;
}

function lean(line: number, proj: number) {
  const edge = proj - line;
  if (Math.abs(edge) < 0.75) return { label: "Lean", tone: "neutral" as const };
  return edge > 0
    ? { label: "Lean Over", tone: "pos" as const }
    : { label: "Lean Under", tone: "neg" as const };
}

function formatHomeAwayLabel(homeAway?: string | null): string {
  if (homeAway === "home") return "vs";
  if (homeAway === "away") return "@";
  return "-";
}

function trendMetricValue(
  g: PlayerSummaryPayload["summary"]["games"][number],
  metric: TrendMetricKey,
): number {
  if (metric === "pts") return Number(g.points ?? NaN);
  if (metric === "reb") return Number(g.rebounds ?? NaN);
  if (metric === "ast") return Number(g.assists ?? NaN);
  if (metric === "tp") return Number(g.threePointsMade ?? NaN);
  if (metric === "pra") {
    if (
      g.points === null ||
      g.points === undefined ||
      g.rebounds === null ||
      g.rebounds === undefined ||
      g.assists === null ||
      g.assists === undefined
    ) {
      return Number.NaN;
    }
    return Number(g.points + g.rebounds + g.assists);
  }
  return Number.NaN;
}

function computeBzScore(games: PlayerSummaryPayload["summary"]["games"]) {
  if (!games || games.length === 0) return null;
  const last5 = games.slice(0, 5);
  const avgLast5 =
    last5.reduce((sum, g) => sum + (g.points ?? 0), 0) / last5.length;
  const avgAll =
    games.reduce((sum, g) => sum + (g.points ?? 0), 0) / games.length;
  const base = 72;
  const delta = avgLast5 - avgAll;
  return Math.round(Math.max(40, Math.min(99, base + delta * 2)));
}

const formatTrendValue = (val: number) =>
  val.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

const stdDev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const round1 = (val: number) => Math.round(val * 10) / 10;

function gradeFromScore(score: number) {
  if (score >= 90) return { label: "A+", tone: "emerald" as const };
  if (score >= 85) return { label: "A", tone: "emerald" as const };
  if (score >= 80) return { label: "A-", tone: "emerald" as const };
  if (score >= 75) return { label: "B+", tone: "sky" as const };
  if (score >= 70) return { label: "B", tone: "sky" as const };
  if (score >= 65) return { label: "B-", tone: "sky" as const };
  if (score >= 60) return { label: "C+", tone: "amber" as const };
  if (score >= 55) return { label: "C", tone: "amber" as const };
  if (score >= 50) return { label: "C-", tone: "amber" as const };
  if (score >= 40) return { label: "D", tone: "rose" as const };
  return { label: "F", tone: "rose" as const };
}

function gradeFromTrendSignals(params: {
  score: number;
  hitPct: number;
  sampleSize: number;
  cv: number;
}) {
  const { score, hitPct, sampleSize, cv } = params;

  if (hitPct >= 74 && sampleSize >= 8 && cv <= 0.28 && score >= 86) {
    return { label: "A+", tone: "emerald" as const };
  }
  if (hitPct >= 68 && sampleSize >= 7 && cv <= 0.33 && score >= 80) {
    return { label: "A", tone: "emerald" as const };
  }
  if (hitPct >= 62 && sampleSize >= 6 && cv <= 0.38 && score >= 74) {
    return { label: "A-", tone: "emerald" as const };
  }

  let cappedScore = score;
  if (hitPct < 52) cappedScore = Math.min(cappedScore, 62); // C+
  else if (hitPct < 56) cappedScore = Math.min(cappedScore, 69); // B-
  if (sampleSize < 6) cappedScore = Math.min(cappedScore, 72); // B

  return gradeFromScore(cappedScore);
}

function splitName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: name };
  if (parts.length === 1) return { first: "", last: parts[0] };
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return { first, last };
}

function normalizePlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamLabel(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBookmakerKey(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDecimalOdd(value: string | number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

function parseTrendMetricParam(value: string | null | undefined): TrendMetricKey | null {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return null;
  if (key === "pts" || key === "points") return "pts";
  if (key === "reb" || key === "rebounds") return "reb";
  if (key === "ast" || key === "assists") return "ast";
  if (key === "tp" || key === "3pt" || key === "3pm" || key === "threes") return "tp";
  if (key === "pra" || key === "p+a" || key === "p+r" || key === "r+a") return "pra";
  return null;
}

function normalizeNbaDvpPosition(raw: string | null | undefined): NbaDvpPosition | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return null;
  const tokens = value
    .replace(/[^A-Z0-9/-]/g, " ")
    .split(/[\s/-]+/)
    .filter(Boolean);
  for (const token of tokens) {
    if (token === "C" || token === "CENTER") return "C";
    if (token === "F" || token === "SF" || token === "PF" || token === "FORWARD") return "F";
    if (token === "G" || token === "PG" || token === "SG" || token === "GUARD") return "G";
  }
  if (value.includes("CENTER")) return "C";
  if (value.includes("FORWARD")) return "F";
  if (value.includes("GUARD")) return "G";
  return null;
}

const FINISHED_GAME_STATUSES = new Set([
  "FT",
  "AOT",
  "AET",
  "CANC",
  "CAN",
  "POST",
  "ABD",
  "SUSP",
]);

const LIVE_GAME_STATUSES = new Set([
  "LIVE",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "1Q",
  "2Q",
  "3Q",
  "4Q",
  "HT",
  "OT",
  "1",
  "2",
]);

function normalizeGameStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function isLikelyLiveGame(game: NextGame | null, nowUnix: number) {
  if (!game) return false;
  const statusShort = normalizeGameStatus(game.status?.short ?? null);
  const statusLong = String(game.status?.long ?? "").trim().toLowerCase();
  const ts = Number(game.timestamp ?? NaN);
  if (LIVE_GAME_STATUSES.has(statusShort)) return true;
  if (statusShort === "NS") return false;
  if (
    statusLong.includes("in play") ||
    statusLong.includes("halftime") ||
    statusLong.includes("quarter") ||
    statusLong.includes("overtime") ||
    statusLong.includes("live")
  ) {
    return true;
  }
  if (!Number.isFinite(ts)) return false;
  return ts <= nowUnix && ts >= nowUnix - 4 * 60 * 60;
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

function OverviewTile({ label, value, tone, subLeft, subRight }: OverviewTileProps) {
  const toneHex: Record<OverviewTone, string> = {
    orange: "#F97316",
    green: "#10B981",
    blue: "#38BDF8",
    gold: "#F59E0B",
  };
  const accent = toneHex[tone];
  const glow = hexToRgba(accent, 0.18);
  const glowSoft = hexToRgba(accent, 0.08);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-5"
      style={{ backgroundImage: `linear-gradient(135deg, ${glow} 0%, ${glowSoft} 45%, rgba(3,3,7,0.35) 100%)` }}
    >
      <div className="absolute right-5 top-5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] text-white/55">
        ?
      </div>
      <p className="text-[11px] tracking-widest text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">{value}</p>
      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-white/50">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
          {subLeft}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
          {subRight}
        </span>
      </div>
    </div>
  );
}

export default function PlayerPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const requestedTrendMetric = useMemo(
    () => parseTrendMetricParam(searchParams?.get("metric") ?? null),
    [searchParams],
  );
  const requestedLine = useMemo(() => {
    const raw = Number(searchParams?.get("line"));
    return Number.isFinite(raw) ? raw : null;
  }, [searchParams]);
  const requestedSide = useMemo(() => {
    const side = String(searchParams?.get("side") ?? "").trim().toLowerCase();
    return side === "over" || side === "under" ? side : null;
  }, [searchParams]);
  const requestedBookmaker = useMemo(
    () => normalizeBookmakerKey(searchParams?.get("bookmaker") ?? null),
    [searchParams],
  );
  const requestedGameId = useMemo(() => {
    const raw = Number(searchParams?.get("gameId"));
    return Number.isFinite(raw) ? raw : null;
  }, [searchParams]);
  const requestedOpponentCode = useMemo(() => {
    const raw = String(searchParams?.get("opp") ?? "").trim().toUpperCase();
    return raw || null;
  }, [searchParams]);
  const [dataPlayer, setDataPlayer] = useState<NbaPlayer | null>(null);
  const [summary, setSummary] = useState<PlayerSummaryPayload["summary"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewRange, setOverviewRange] = useState<OverviewRange>("Season");
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>(
    requestedTrendMetric ?? "pts",
  );
  const [trendWindow, setTrendWindow] = useState<TrendWindowKey>("L10");
  const [filter, setFilter] = useState<GameFilter>("all");
  const [showAllGames, setShowAllGames] = useState(false);
  const [nextGame, setNextGame] = useState<NextGame | null>(null);
  const [nextGameLoading, setNextGameLoading] = useState(false);
  const [dvpRow, setDvpRow] = useState<NbaDvpRow | null>(null);
  const [dvpTotalTeams, setDvpTotalTeams] = useState<number | null>(null);
  const [dvpLoading, setDvpLoading] = useState(false);
  const [dvpLeagueAvg, setDvpLeagueAvg] = useState<NbaDvpStatTotals | null>(null);
  const [dvpRowsForPosition, setDvpRowsForPosition] = useState<NbaDvpRow[]>([]);
  const [radarHover, setRadarHover] = useState<{
    label: string;
    hint: string;
    value: number;
    leagueAvg: number;
    x: number;
    y: number;
    size: number;
  } | null>(null);
  const [oddsPayload, setOddsPayload] = useState<NbaOddsPayload | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [selectedBookmaker, setSelectedBookmaker] = useState(
    requestedBookmaker || DEFAULT_ODDS_BOOKMAKER,
  );

  const [teams, setTeams] = useState<TeamMeta[]>([]);

  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const avatarSrc = "/images/avatar-player.svg";
  const [useAvatarImage, setUseAvatarImage] = useState(true);

  const resolvedId = useMemo(() => {
    const rawId = params?.id;
    if (Array.isArray(rawId)) return rawId[0] ?? null;
    return rawId ?? null;
  }, [params]);

  const season = searchParams?.get("season") ?? DEFAULT_SEASON;

  useEffect(() => {
    if (requestedTrendMetric) setTrendMetric(requestedTrendMetric);
  }, [requestedTrendMetric]);

  useEffect(() => {
    if (requestedBookmaker) setSelectedBookmaker(requestedBookmaker);
  }, [requestedBookmaker]);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const res = await fetch("/api/nba/teams");
        if (!res.ok) throw new Error("Failed to fetch NBA teams");
        const data = (await res.json()) as TeamsApiPayload;
        setTeams(Array.isArray(data?.teams) ? data.teams : []);
      } catch {
        setTeams([]);
      }
    };
    loadTeams();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!resolvedId) {
        setError("ID manquant");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setDataPlayer(null);
      setSummary(undefined);
      let found: NbaPlayer | null = null;
      let resolvedPlayerId: string | null = null;
      let summaryPlayer: NbaPlayer | null = null;
      let summaryLoaded = false;
      const isNumericId = Number.isFinite(Number(resolvedId));

      if (isNumericId) {
        try {
          const res = await fetch(
            `/api/nba/players/${resolvedId}/summary?season=${encodeURIComponent(
              season,
            )}`,
            {
              signal: controller.signal,
              cache: "no-store",
            },
          );
          if (res.ok) {
            const data = (await res.json()) as PlayerSummaryPayload;
            setSummary(data.summary ?? undefined);
            summaryPlayer = data.summary?.player ?? null;
            summaryLoaded = true;
          }
        } catch {
          // ignore summary errors
        }
      }

      try {
        const res = await fetch(`/api/nba/players?id=${resolvedId}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as PlayersApiPayload;
          const arr = Array.isArray(data.players)
            ? data.players
            : Array.isArray(data.response)
            ? data.response
            : data.player
            ? [data.player]
            : [];
          found = arr[0] ?? null;
          if (found?.id !== undefined && found?.id !== null) {
            resolvedPlayerId = String(found.id);
          }
        }
      } catch {
        // ignore
      }
      if (!found && resolvedId) {
        const cleaned = normalizeSearchInput(resolvedId);
        const isNumeric = Number.isFinite(Number(cleaned));
        if (cleaned && !isNumeric) {
          try {
            const res = await fetch(
              `/api/nba/players?search=${encodeURIComponent(cleaned)}`,
              { signal: controller.signal },
            );
            if (res.ok) {
              const data = (await res.json()) as PlayersApiPayload;
              const arr = Array.isArray(data.players)
                ? data.players
                : Array.isArray(data.response)
                ? data.response
                : [];
              found = arr[0] ?? null;
              if (found?.id !== undefined && found?.id !== null) {
                resolvedPlayerId = String(found.id);
              }
            }
          } catch {
            // ignore
          }
        }
      }
      const selectedPlayer = found ?? summaryPlayer;
      if (!selectedPlayer) {
        if (isNumericId) {
          setDataPlayer({
            id: Number(resolvedId),
            fullName: `Player #${resolvedId}`,
            position: null,
            jerseyNumber: null,
            nationality: null,
            isActive: null,
          });
          setError(null);
        } else {
          setError("Joueur introuvable");
          setLoading(false);
          return;
        }
      } else {
        setDataPlayer(selectedPlayer);
      }

      const summaryPlayerId = resolvedPlayerId ?? (isNumericId ? resolvedId : null);
      if (!summaryLoaded && summaryPlayerId) {
        try {
          const res = await fetch(
            `/api/nba/players/${summaryPlayerId}/summary?season=${encodeURIComponent(
              season,
            )}`,
            {
              signal: controller.signal,
              cache: "no-store",
            },
          );
          if (res.ok) {
            const data = (await res.json()) as PlayerSummaryPayload;
            setSummary(data.summary ?? undefined);
          }
        } catch {
          // ignore
        }
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, [resolvedId, season]);

  useEffect(() => {
    setUseAvatarImage(true);
  }, [dataPlayer]);

  const handlePlayerImgError = () => {
    setUseAvatarImage(true);
  };

  const handlePlayerImgLoad = () => {
    if (!playerImgRef.current) return;
  };

  const teamMetaById = useMemo(() => {
    const map = new Map<number, TeamMeta>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const teamMetaByCode = useMemo(() => {
    const map = new Map<string, TeamMeta>();
    teams.forEach((team) => {
      if (team.code) map.set(team.code.toUpperCase(), team);
    });
    return map;
  }, [teams]);
  const apiSportsTeamIdByCode = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach((team) => {
      const code = String(team.code ?? "")
        .trim()
        .toUpperCase();
      const id = Number(team.id ?? NaN);
      if (!code || !Number.isFinite(id)) return;
      map.set(code, id);
    });
    return map;
  }, [teams]);
  const teamAbbrByName = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((team) => {
      if (!team.code) return;
      if (team.name) map.set(team.name.toLowerCase(), team.code.toUpperCase());
      if (team.fullName) map.set(team.fullName.toLowerCase(), team.code.toUpperCase());
    });
    return map;
  }, [teams]);

  const playerName = dataPlayer ? formatName(dataPlayer) : "Player";
  const nameParts = splitName(playerName);
  const dvpPosition = useMemo(
    () => normalizeNbaDvpPosition(dataPlayer?.position ?? summary?.player?.position ?? null),
    [dataPlayer?.position, summary?.player?.position],
  );
  const summaryFirstGameTeamId = summary?.games?.[0]?.teamId ?? null;
  const teamId = useMemo(() => {
    const candidates = [summaryFirstGameTeamId, summary?.player?.teamId, dataPlayer?.teamId];
    for (const candidate of candidates) {
      const n = Number(candidate ?? NaN);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
    return null;
  }, [summaryFirstGameTeamId, summary?.player?.teamId, dataPlayer?.teamId]);
  useEffect(() => {
    const controller = new AbortController();
    const fetchNextGame = async () => {
      if (!teamId) {
        setNextGame(null);
        return;
      }
      setNextGameLoading(true);
      try {
        const url = `/api/nba/games?team=${teamId}&season=${encodeURIComponent(season)}`;
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) {
          setNextGame(null);
          return;
        }
        const json = await res.json();
        const games: NextGame[] = Array.isArray(json?.response) ? json.response : [];
        const now = Math.floor(Date.now() / 1000);
        const candidates = games
          .filter((g) => {
            const ts = Number(g?.timestamp ?? 0);
            if (!ts) return false;
            const status = normalizeGameStatus(g?.status?.short ?? null);
            return !FINISHED_GAME_STATUSES.has(status);
          })
          .sort((a, b) => Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0));
        const liveCandidates = candidates
          .filter((g) => isLikelyLiveGame(g, now))
          .sort((a, b) => Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0));
        const futureGames = candidates
          .filter((g) => Number(g?.timestamp ?? 0) >= now)
          .sort((a, b) => Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0));
        const picked = liveCandidates[0] ?? futureGames[0] ?? null;
        if (!picked) {
          setNextGame(null);
          return;
        }
        setNextGame({
          id: picked?.id ?? null,
          timestamp: picked?.timestamp ?? null,
          date: picked?.date ?? null,
          time: picked?.time ?? null,
          timezone: picked?.timezone ?? null,
          venue: picked?.venue ?? null,
          status: picked?.status ?? null,
          teams: picked?.teams ?? null,
        });
      } catch {
        if (controller.signal.aborted) return;
        setNextGame(null);
      } finally {
        setNextGameLoading(false);
      }
    };
    fetchNextGame();
    return () => controller.abort();
  }, [teamId, season]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchOdds = async () => {
      const homeCode = String(nextGame?.teams?.home?.code ?? "")
        .trim()
        .toUpperCase();
      const awayCode = String(nextGame?.teams?.away?.code ?? "")
        .trim()
        .toUpperCase();
      const homeNameRaw = String(nextGame?.teams?.home?.name ?? "").trim();
      const awayNameRaw = String(nextGame?.teams?.away?.name ?? "").trim();
      const homeName =
        homeNameRaw || (homeCode ? TEAM_FULL_NAME_BY_CODE[homeCode] ?? "" : "");
      const awayName =
        awayNameRaw || (awayCode ? TEAM_FULL_NAME_BY_CODE[awayCode] ?? "" : "");
      const gameRaw = requestedGameId ?? nextGame?.id ?? null;
      const gameId = Number(gameRaw ?? NaN);
      const canUseTeams = Boolean(homeName && awayName);
      if (!Number.isFinite(gameId) && !canUseTeams) {
        setOddsPayload(null);
        return;
      }
      setOddsLoading(true);
      try {
        const url = new URL("/api/nba/odds", window.location.origin);
        if (Number.isFinite(gameId)) {
          url.searchParams.set("game", String(gameId));
        }
        // Player page should only consume daily synced odds cache (no upstream odds refresh).
        url.searchParams.set("cacheOnly", "1");
        if (selectedBookmaker) url.searchParams.set("bookmaker", selectedBookmaker);
        if (homeName) url.searchParams.set("home", homeName);
        if (awayName) url.searchParams.set("away", awayName);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          setOddsPayload(null);
          return;
        }
        const data = (await res.json()) as NbaOddsPayload;
        setOddsPayload(data);
        const books = Array.isArray(data.availableBookmakers) ? data.availableBookmakers : [];
        if (books.length) {
          const selectedNorm = normalizeBookmakerKey(selectedBookmaker);
          const matchingBook = books.find(
            (book) => normalizeBookmakerKey(book.key) === selectedNorm,
          );
          const preferredBook = books.find(
            (book) =>
              normalizeBookmakerKey(book.key) === normalizeBookmakerKey(DEFAULT_ODDS_BOOKMAKER),
          );
          if (!matchingBook) {
            setSelectedBookmaker((preferredBook ?? books[0]).key);
          } else if (matchingBook.key !== selectedBookmaker) {
            setSelectedBookmaker(matchingBook.key);
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        setOddsPayload(null);
      } finally {
        if (!controller.signal.aborted) setOddsLoading(false);
      }
    };
    fetchOdds();
    return () => controller.abort();
  }, [
    requestedGameId,
    nextGame?.id,
    nextGame?.teams?.home?.code,
    nextGame?.teams?.home?.name,
    nextGame?.teams?.away?.code,
    nextGame?.teams?.away?.name,
    selectedBookmaker,
  ]);
  const teamMeta = teamId ? teamMetaById.get(teamId) : null;
  const teamCode =
    teamMeta?.code ??
    summary?.games?.[0]?.teamCode ??
    summary?.player?.teamCode ??
    null;
  const teamMetaByCodeResolved = teamCode
    ? teamMetaByCode.get(teamCode.toUpperCase())
    : null;
  const resolvedTeamMeta = teamMeta ?? teamMetaByCodeResolved ?? null;
  const teamLabel = resolvedTeamMeta?.code ?? teamCode ?? resolvedTeamMeta?.name ?? "NBA";
  const teamName =
    resolvedTeamMeta?.fullName ??
    resolvedTeamMeta?.name ??
    summary?.player?.teamName ??
    summary?.games?.[0]?.teamName ??
    dataPlayer?.teamName ??
    "NBA";
  const teamLogo =
    getNbaCdnLogo(resolvedTeamMeta?.code ?? teamCode) ?? resolvedTeamMeta?.logo ?? null;
  const teamPrimary = getTeamPrimaryColor(resolvedTeamMeta?.code ?? teamCode ?? teamLabel);
  const teamPrimarySoft = hexToRgba(teamPrimary, 0.2);
  const teamPrimaryLine = hexToRgba(teamPrimary, 0.45);

  const nextGameHomeCode = String(nextGame?.teams?.home?.code ?? "")
    .trim()
    .toUpperCase();
  const nextGameAwayCode = String(nextGame?.teams?.away?.code ?? "")
    .trim()
    .toUpperCase();
  const nextGameHomeName = String(nextGame?.teams?.home?.name ?? "").trim();
  const nextGameAwayName = String(nextGame?.teams?.away?.name ?? "").trim();
  const teamCodeUpper = String(teamCode ?? "")
    .trim()
    .toUpperCase();
  const teamNameNorm = normalizeTeamLabel(teamName);

  const nextGamePlayerSide = useMemo<"home" | "away" | null>(() => {
    const homeId = Number(nextGame?.teams?.home?.id ?? NaN);
    const awayId = Number(nextGame?.teams?.away?.id ?? NaN);
    const currentTeamId = Number(teamId ?? NaN);
    if (Number.isFinite(homeId) && Number.isFinite(currentTeamId) && homeId === currentTeamId) {
      return "home";
    }
    if (Number.isFinite(awayId) && Number.isFinite(currentTeamId) && awayId === currentTeamId) {
      return "away";
    }

    if (teamCodeUpper) {
      if (nextGameHomeCode && nextGameHomeCode === teamCodeUpper) return "home";
      if (nextGameAwayCode && nextGameAwayCode === teamCodeUpper) return "away";
    }

    if (teamNameNorm) {
      const homeNorm = normalizeTeamLabel(nextGameHomeName);
      const awayNorm = normalizeTeamLabel(nextGameAwayName);
      if (
        homeNorm &&
        (homeNorm === teamNameNorm ||
          homeNorm.includes(teamNameNorm) ||
          teamNameNorm.includes(homeNorm))
      ) {
        return "home";
      }
      if (
        awayNorm &&
        (awayNorm === teamNameNorm ||
          awayNorm.includes(teamNameNorm) ||
          teamNameNorm.includes(awayNorm))
      ) {
        return "away";
      }
    }

    return null;
  }, [
    nextGame?.teams?.home?.id,
    nextGame?.teams?.away?.id,
    nextGameHomeCode,
    nextGameAwayCode,
    nextGameHomeName,
    nextGameAwayName,
    teamCodeUpper,
    teamId,
    teamNameNorm,
  ]);
  const nextGameIsHome = nextGamePlayerSide === "home";
  const nextGameOpp =
    nextGamePlayerSide === "home"
      ? nextGame?.teams?.away
      : nextGamePlayerSide === "away"
      ? nextGame?.teams?.home
      : nextGame?.teams?.home ?? nextGame?.teams?.away ?? null;
  const nextGameOppId =
    nextGameOpp?.id !== null && nextGameOpp?.id !== undefined
      ? Number(nextGameOpp.id)
      : null;
  const nextGameOppMeta = nextGameOppId ? teamMetaById.get(nextGameOppId) : null;
  const nextGameOppCodeFromName = nextGameOpp?.name
    ? teamAbbrByName.get(nextGameOpp.name.toLowerCase()) ?? null
    : null;
  const nextGameOppCodeRaw = String(nextGameOpp?.code ?? "")
    .trim()
    .toUpperCase();
  const nextGameOppCode =
    nextGameOppMeta?.code ??
    (nextGameOppCodeRaw || null) ??
    nextGameOppCodeFromName ??
    null;
  const nextGameOppName =
    nextGameOpp?.name ??
    (nextGameOppCode
      ? teamMetaByCode.get(nextGameOppCode)?.fullName ??
        teamMetaByCode.get(nextGameOppCode)?.name ??
        TEAM_FULL_NAME_BY_CODE[nextGameOppCode] ??
        null
      : null) ??
    nextGameOppMeta?.fullName ??
    nextGameOppMeta?.name ??
    null;
  const nextGameOppLogo =
    getNbaCdnLogo(nextGameOppMeta?.code ?? nextGameOppCode ?? null) ??
    nextGameOpp?.logo ??
    nextGameOppMeta?.logo ??
    null;
  const nextGameHomeAway =
    nextGame && nextGamePlayerSide ? (nextGameIsHome ? "vs" : "@") : "";
  const nextGameDate = nextGame?.timestamp
    ? new Date(nextGame.timestamp * 1000)
    : nextGame?.date
    ? new Date(nextGame.date)
    : null;
  const nextGameDateLabel = nextGameDate
    ? nextGameDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "-";
  const nextGameTimeLabel = nextGameDate
    ? nextGameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const nextGameIsLive = isLikelyLiveGame(nextGame, Math.floor(Date.now() / 1000));
  const nextGameVenueName =
    typeof nextGame?.venue === "string"
      ? nextGame.venue
      : nextGame?.venue?.name ?? null;
  const nextGameVenueCity =
    typeof nextGame?.venue === "string" ? null : nextGame?.venue?.city ?? null;
  const nextGameVenueLabel = nextGameVenueName
    ? `${nextGameVenueName}${nextGameVenueCity ? ` · ${nextGameVenueCity}` : ""}`
    : null;

  const opponentCodeRaw =
    requestedOpponentCode ??
    nextGameOppCode ??
    summary?.games?.[0]?.opponentTeamCode ??
    null;
  const opponentCode = opponentCodeRaw
    ? String(opponentCodeRaw).trim().toUpperCase()
    : null;
  const oppPrimary = getTeamPrimaryColor(opponentCode ?? null);
  const oppPrimarySoft = hexToRgba(oppPrimary, 0.2);
  const oppPrimaryRing = hexToRgba(oppPrimary, 0.4);

  const forcedOppTeamId =
    requestedOpponentCode &&
    Number.isFinite(
      Number(
        apiSportsTeamIdByCode.get(requestedOpponentCode) ??
          APISPORTS_TEAM_ID_BY_CODE[requestedOpponentCode] ??
          NaN,
      ),
    )
      ? Number(
          apiSportsTeamIdByCode.get(requestedOpponentCode) ??
            APISPORTS_TEAM_ID_BY_CODE[requestedOpponentCode],
        )
      : null;
  const opponentCodeTeamId =
    opponentCode &&
    Number.isFinite(
      Number(
        apiSportsTeamIdByCode.get(opponentCode) ??
          APISPORTS_TEAM_ID_BY_CODE[opponentCode] ??
          NaN,
      ),
    )
      ? Number(
          apiSportsTeamIdByCode.get(opponentCode) ??
            APISPORTS_TEAM_ID_BY_CODE[opponentCode],
        )
      : null;
  const effectiveOppTeamCode =
    (requestedOpponentCode ? String(requestedOpponentCode).trim().toUpperCase() : null) ??
    opponentCode ??
    (nextGameOppCode ? String(nextGameOppCode).trim().toUpperCase() : null) ??
    null;
  const effectiveOppTeamId = forcedOppTeamId ?? opponentCodeTeamId ?? nextGameOppId;
  const dvpWindowForTrend = useMemo(() => {
    if (trendWindow === "L5") return "L5";
    if (trendWindow === "L10") return "L10";
    return "season";
  }, [trendWindow]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDvp = async () => {
      if (!dvpPosition || (!effectiveOppTeamId && !effectiveOppTeamCode)) {
        setDvpRow(null);
        setDvpTotalTeams(null);
        setDvpLeagueAvg(null);
        setDvpRowsForPosition([]);
        setDvpLoading(false);
        return;
      }
      setDvpLoading(true);
      try {
        const url = new URL("/api/nba/defense/dvp", window.location.origin);
        url.searchParams.set("season", season);
        url.searchParams.set("window", dvpWindowForTrend);
        url.searchParams.set("context", "all");
        url.searchParams.set("position", dvpPosition);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          setDvpRow(null);
          setDvpTotalTeams(null);
          setDvpLeagueAvg(null);
          setDvpRowsForPosition([]);
          return;
        }
        const json = (await res.json()) as { rows?: NbaDvpRow[] };
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        const match =
          rows.find((row) => {
            const rowCode = String(row.teamAbbr ?? "")
              .trim()
              .toUpperCase();
            if (effectiveOppTeamCode && rowCode && rowCode === effectiveOppTeamCode) {
              return true;
            }
            if (effectiveOppTeamId) {
              return Number(row.teamId) === Number(effectiveOppTeamId);
            }
            return false;
          }) ?? null;
        setDvpRowsForPosition(rows);
        setDvpTotalTeams(rows.length || null);
        setDvpRow(match);

        if (!rows.length) {
          setDvpLeagueAvg(null);
          return;
        }
        const totals: NbaDvpStatTotals = {
          points: 0,
          rebounds: 0,
          assists: 0,
          minutes: 0,
          threePointsMade: 0,
          fieldGoalsMade: 0,
          fieldGoalsAttempted: 0,
          freeThrowsMade: 0,
          freeThrowsAttempted: 0,
        };
        let totalGames = 0;
        rows.forEach((row) => {
          const per = row.metrics?.perGame;
          if (!per) return;
          const games = Number(row.games) || 0;
          const weight = games > 0 ? games : 1;
          totalGames += weight;
          totals.points += (per.points ?? 0) * weight;
          totals.rebounds += (per.rebounds ?? 0) * weight;
          totals.assists += (per.assists ?? 0) * weight;
          totals.minutes += (per.minutes ?? 0) * weight;
          totals.threePointsMade += (per.threePointsMade ?? 0) * weight;
          totals.fieldGoalsMade += (per.fieldGoalsMade ?? 0) * weight;
          totals.fieldGoalsAttempted += (per.fieldGoalsAttempted ?? 0) * weight;
          totals.freeThrowsMade += (per.freeThrowsMade ?? 0) * weight;
          totals.freeThrowsAttempted += (per.freeThrowsAttempted ?? 0) * weight;
        });
        if (!totalGames) {
          setDvpLeagueAvg(null);
          return;
        }
        setDvpLeagueAvg({
          points: totals.points / totalGames,
          rebounds: totals.rebounds / totalGames,
          assists: totals.assists / totalGames,
          minutes: totals.minutes / totalGames,
          threePointsMade: totals.threePointsMade / totalGames,
          fieldGoalsMade: totals.fieldGoalsMade / totalGames,
          fieldGoalsAttempted: totals.fieldGoalsAttempted / totalGames,
          freeThrowsMade: totals.freeThrowsMade / totalGames,
          freeThrowsAttempted: totals.freeThrowsAttempted / totalGames,
        });
      } catch {
        if (controller.signal.aborted) return;
        setDvpRow(null);
        setDvpTotalTeams(null);
        setDvpLeagueAvg(null);
        setDvpRowsForPosition([]);
      } finally {
        if (!controller.signal.aborted) setDvpLoading(false);
      }
    };
    fetchDvp();
    return () => controller.abort();
  }, [season, dvpWindowForTrend, dvpPosition, effectiveOppTeamId, effectiveOppTeamCode]);

  const overviewWindow = useMemo(() => {
    if (overviewRange === "Last 5") return summary?.last5 ?? null;
    if (overviewRange === "Last 10") return summary?.last10 ?? null;
    return summary?.seasonAvg ?? summary?.last10 ?? summary?.last5 ?? null;
  }, [overviewRange, summary]);

  const overviewPra =
    overviewWindow?.points != null &&
    overviewWindow?.rebounds != null &&
    overviewWindow?.assists != null
      ? overviewWindow.points + overviewWindow.rebounds + overviewWindow.assists
      : null;
  const overviewGameLimit = overviewRange === "Last 5" ? 5 : overviewRange === "Last 10" ? 10 : 999;
  const rebSeries = (summary?.games ?? [])
    .slice(0, overviewGameLimit)
    .map((g) => Number(g.rebounds ?? NaN))
    .filter((v) => Number.isFinite(v)) as number[];
  const astSeries = (summary?.games ?? [])
    .slice(0, overviewGameLimit)
    .map((g) => Number(g.assists ?? NaN))
    .filter((v) => Number.isFinite(v)) as number[];
  const rebStd = rebSeries.length ? safeNum(stdDev(rebSeries), 1) : "-";
  const astStd = astSeries.length ? safeNum(stdDev(astSeries), 1) : "-";
  const pseudoUsg =
    overviewWindow?.points != null && overviewWindow?.assists != null
      ? `${safeNum(overviewWindow.points + overviewWindow.assists, 1)}%`
      : "-";
  const seasonLabel = `${season} Regular Season`;
  const baseColumns = [
    { key: "date", label: "DATE", full: "Date" },
    { key: "opp", label: "OPP", full: "Opponent" },
    { key: "res", label: "RES", full: "Result" },
  ];
  const statColumns = [
    { key: "min", label: "MIN", full: "Minutes" },
    { key: "fg", label: "FG", full: "Field goals" },
    { key: "fgPct", label: "FG%", full: "Field goal %" },
    { key: "tp", label: "3PT", full: "3-pointers" },
    { key: "tpPct", label: "3P%", full: "3-point %" },
    { key: "ft", label: "FT", full: "Free throws" },
    { key: "ftPct", label: "FT%", full: "Free throw %" },
    { key: "reb", label: "REB", full: "Rebounds" },
    { key: "ast", label: "AST", full: "Assists" },
    { key: "pts", label: "PTS", full: "Points" },
  ].map((col) => ({ ...col, id: `stat-${col.key}` }));
  const baseColWidths = ["12%", "12%", "12%"];
  const statColWidth = "4.25%";
  const trendMetricCfg = useMemo(
    () => [
      { key: "pts" as const, label: "PTS" },
      { key: "reb" as const, label: "REB" },
      { key: "ast" as const, label: "AST" },
      { key: "pra" as const, label: "PRA" },
      { key: "tp" as const, label: "3PT" },
    ],
    [],
  );
  const trendLogsAll = useMemo(
    () => (summary?.games ?? []).filter((g) => !g.isPreseason),
    [summary],
  );
  const metricValuesAll = useMemo(
    () =>
      trendLogsAll
        .map((g) => trendMetricValue(g, trendMetric))
        .filter((v) => Number.isFinite(v)),
    [trendLogsAll, trendMetric],
  );
  const logLineForMetric = useMemo(() => {
    if (!metricValuesAll.length) return 0;
    return round1(avg(metricValuesAll));
  }, [metricValuesAll]);
  const selectedPropOdds = useMemo<NbaOddsPlayerProp | null>(() => {
    const props: NbaOddsPlayerProp[] = Array.isArray(oddsPayload?.playerProps)
      ? oddsPayload.playerProps
      : [];
    if (!props.length) return null;
    const aliases = new Set(ODDS_METRIC_ALIASES[trendMetric]);
    const metricProps = props.filter((p) => aliases.has(String(p.metric ?? "")));
    if (!metricProps.length) return null;
    const normalizedPlayer = normalizePlayerName(playerName);
    const normalizedLast = normalizePlayerName(nameParts.last ?? "");
    let best: NbaOddsPlayerProp | null = null;
    let bestScore = -1;
    const preferRequestedLine =
      requestedLine !== null && requestedTrendMetric === trendMetric;
    const requestedBookNorm = normalizeBookmakerKey(requestedBookmaker);
    metricProps.forEach((prop) => {
      const hasOddsPrice = Boolean(prop.overOdd || prop.underOdd || prop.odd);
      if (!hasOddsPrice) return;
      const normalizedCandidate = normalizePlayerName(prop.name ?? "");
      let score = 0;
      if (!normalizedCandidate) return;
      if (normalizedCandidate === normalizedPlayer) score += 5;
      if (
        normalizedPlayer &&
        (normalizedCandidate.includes(normalizedPlayer) || normalizedPlayer.includes(normalizedCandidate))
      ) {
        score += 3;
      }
      if (normalizedLast && normalizedCandidate.includes(normalizedLast)) score += 2;
      if (trendMetric === "pra" && prop.metric === "PRA") score += 1;
      if (prop.overOdd) score += 1;
      if (prop.underOdd) score += 1;
      if (prop.overOdd && prop.underOdd) score += 2;
      if (requestedSide === "over" && prop.overOdd) score += 2;
      if (requestedSide === "under" && prop.underOdd) score += 2;
      if (preferRequestedLine) {
        const diff = Math.abs(Number(prop.line ?? NaN) - Number(requestedLine));
        if (diff <= 0.001) score += 12;
        else if (diff <= 0.25) score += 6;
        else if (diff <= 0.5) score += 3;
        else score -= Math.min(8, Math.round(diff * 4));
      }
      if (requestedBookNorm) {
        const propBookNorm = normalizeBookmakerKey(prop.bookmakerName ?? null);
        if (propBookNorm && propBookNorm === requestedBookNorm) score += 2;
      }
      const selectedBookNorm = normalizeBookmakerKey(selectedBookmaker);
      if (selectedBookNorm) {
        const propBookNorm = normalizeBookmakerKey(prop.bookmakerName ?? null);
        if (propBookNorm && propBookNorm === selectedBookNorm) score += 4;
      }
      const over = parseDecimalOdd(prop.overOdd ?? null);
      const under = parseDecimalOdd(prop.underOdd ?? null);
      // Prefer the "main" market line (both sides available, near even prices).
      if (over && under) {
        const centerGap = Math.abs(over - 1.9) + Math.abs(under - 1.9);
        const imbalance = Math.abs(over - under);
        score += Math.max(-4, 8 - centerGap * 8 - imbalance * 6);
      }
      if (score > bestScore) {
        bestScore = score;
        best = prop;
      }
    });
    return bestScore > 0 ? best : null;
  }, [
    oddsPayload,
    trendMetric,
    playerName,
    nameParts.last,
    requestedLine,
    requestedSide,
    requestedTrendMetric,
    requestedBookmaker,
    selectedBookmaker,
  ]);
  const hasAnyPlayerOdds = useMemo(() => {
    const props: NbaOddsPlayerProp[] = Array.isArray(oddsPayload?.playerProps)
      ? oddsPayload.playerProps
      : [];
    if (!props.length) return false;
    const normalizedPlayer = normalizePlayerName(playerName);
    const normalizedLast = normalizePlayerName(nameParts.last ?? "");
    return props.some((prop) => {
      const hasOddsPrice = Boolean(prop.overOdd || prop.underOdd || prop.odd);
      if (!hasOddsPrice) return false;
      const normalizedCandidate = normalizePlayerName(prop.name ?? "");
      if (!normalizedCandidate) return false;
      if (normalizedCandidate === normalizedPlayer) return true;
      if (
        normalizedPlayer &&
        (normalizedCandidate.includes(normalizedPlayer) ||
          normalizedPlayer.includes(normalizedCandidate))
      ) {
        return true;
      }
      return Boolean(
        normalizedLast &&
          (normalizedCandidate.includes(normalizedLast) ||
            normalizedLast.includes(normalizedCandidate)),
      );
    });
  }, [oddsPayload, playerName, nameParts.last]);
  const lineForMetric = useMemo(() => {
    if (Number.isFinite(Number(selectedPropOdds?.line ?? NaN))) {
      return Number(selectedPropOdds?.line);
    }
    if (requestedTrendMetric === trendMetric && requestedLine !== null) {
      return requestedLine;
    }
    return logLineForMetric;
  }, [requestedTrendMetric, trendMetric, requestedLine, selectedPropOdds?.line, logLineForMetric]);
  const selectedOverOdd = selectedPropOdds?.overOdd ?? selectedPropOdds?.odd ?? null;
  const selectedUnderOdd = selectedPropOdds?.underOdd ?? selectedPropOdds?.odd ?? null;
  const hasSelectedOddsMarket = Boolean(selectedOverOdd || selectedUnderOdd);
  const hasScoringLine =
    (requestedTrendMetric === trendMetric && requestedLine !== null) || hasSelectedOddsMarket;
  const projForMetric = useMemo(() => {
    const base = trendLogsAll
      .slice(0, 5)
      .map((g) => trendMetricValue(g, trendMetric))
      .filter((v) => Number.isFinite(v));
    if (!base.length) return lineForMetric;
    return round1(avg(base));
  }, [trendLogsAll, trendMetric, lineForMetric]);
  const windowLogs = useMemo(() => {
    const n = trendWindow === "L20" ? 20 : trendWindow === "L5" ? 5 : 10;
    return trendLogsAll.slice(0, n);
  }, [trendLogsAll, trendWindow]);
  const values = useMemo(() => {
    return windowLogs
      .slice()
      .reverse()
      .map((g) => {
        const raw = trendMetricValue(g, trendMetric);
        const v = Number.isFinite(raw) ? raw : 0;
        return { g, v };
      });
  }, [windowLogs, trendMetric]);
  const trendBarWidth = useMemo(() => {
    const baseCount = Math.max(values.length, 17);
    const total = Math.max(1, baseCount);
    const gapPx = 8;
    return `calc((100% - ${(total - 1) * gapPx}px) / ${total})`;
  }, [values.length]);
  const vMax = useMemo(() => {
    const max = Math.max(1, lineForMetric, ...values.map((x) => x.v));
    return Math.ceil(max * 1.15);
  }, [values, lineForMetric]);
  const visualMetricLabel =
    trendMetricCfg.find((m) => m.key === trendMetric)?.label ?? "";
  const hitPct = useMemo(() => pctHit(values.map((x) => x.v), lineForMetric), [
    values,
    lineForMetric,
  ]);
  const trendOppKey =
    nextGameOppCode ??
    nextGameOppName ??
    summary?.games?.[0]?.opponentTeamCode ??
    summary?.games?.[0]?.opponentTeamName ??
    null;
  const trendOppCode =
    typeof trendOppKey === "string" && teamMetaByCode.has(trendOppKey.toUpperCase())
      ? trendOppKey.toUpperCase()
      : null;
  const trendOppName = trendOppCode ? null : trendOppKey ? String(trendOppKey) : null;
  const trendOppLabel = trendOppCode ?? trendOppName ?? null;
  const matchupPct = useMemo(() => {
    if (!trendOppKey) return 0;
    const nameLower = trendOppName ? trendOppName.toLowerCase() : null;
    const vsOpp = trendLogsAll
      .filter((g) => {
        if (trendOppCode && g.opponentTeamCode) {
          return g.opponentTeamCode === trendOppCode;
        }
        if (nameLower && g.opponentTeamName) {
          return g.opponentTeamName.toLowerCase() === nameLower;
        }
        return false;
      })
      .slice(0, 3);
    const base = (vsOpp.length ? vsOpp : trendLogsAll.slice(0, 5)).map((g) =>
      trendMetricValue(g, trendMetric),
    );
    return pctHit(
      base.filter((v) => Number.isFinite(v)) as number[],
      lineForMetric,
    );
  }, [trendOppKey, trendOppCode, trendOppName, trendLogsAll, trendMetric, lineForMetric]);
  const noteLogs = useMemo(() => {
    const n = trendWindow === "L20" ? 20 : trendWindow === "L5" ? 5 : 10;
    return trendLogsAll.slice(0, n);
  }, [trendLogsAll, trendWindow]);
  const noteAvg = useMemo(() => {
    const base = noteLogs
      .map((g) => trendMetricValue(g, trendMetric))
      .filter((v) => Number.isFinite(v));
    if (!base.length) return null;
    return round1(avg(base as number[]));
  }, [noteLogs, trendMetric]);
  const noteHitPct = useMemo(
    () =>
      pctHit(
        noteLogs
          .map((g) => trendMetricValue(g, trendMetric))
          .filter((v) => Number.isFinite(v)) as number[],
        lineForMetric,
      ),
    [noteLogs, trendMetric, lineForMetric],
  );
  const dvpPerGame = dvpRow?.metrics?.perGame ?? null;
  const dvpMetricInfo = useMemo(() => {
    if (trendMetric === "pts") return { key: "points" as const, label: "Pts" };
    if (trendMetric === "reb") return { key: "rebounds" as const, label: "Reb" };
    if (trendMetric === "ast") return { key: "assists" as const, label: "Ast" };
    if (trendMetric === "tp") return { key: "threePointsMade" as const, label: "3PT" };
    if (trendMetric === "pra") return { key: "pra" as const, label: "PRA" };
    return null;
  }, [trendMetric]);
  const dvpMetricRank = useMemo(() => {
    if (!dvpMetricInfo || !dvpRow || !dvpRowsForPosition.length) return null;
    const toValue = (row: NbaDvpRow) => {
      const per = row.metrics?.perGame;
      if (!per) return null;
      if (dvpMetricInfo.key === "pra") {
        const pts = Number(per.points ?? NaN);
        const reb = Number(per.rebounds ?? NaN);
        const ast = Number(per.assists ?? NaN);
        if (!Number.isFinite(pts) || !Number.isFinite(reb) || !Number.isFinite(ast)) return null;
        return pts + reb + ast;
      }
      const raw = Number(per[dvpMetricInfo.key] ?? NaN);
      return Number.isFinite(raw) ? raw : null;
    };
    const sorted = dvpRowsForPosition
      .map((row) => ({ teamId: row.teamId, value: toValue(row) }))
      .filter((row) => Number.isFinite(row.value ?? NaN))
      .sort((a, b) => Number(a.value) - Number(b.value));
    const idx = sorted.findIndex((row) => Number(row.teamId) === Number(dvpRow.teamId));
    return idx >= 0 ? idx + 1 : null;
  }, [dvpMetricInfo, dvpRow, dvpRowsForPosition]);
  const dvpMetricDelta = useMemo(() => {
    if (!dvpMetricInfo || !dvpPerGame || !dvpLeagueAvg) return null;
    const value =
      dvpMetricInfo.key === "pra"
        ? Number(dvpPerGame.points ?? 0) + Number(dvpPerGame.rebounds ?? 0) + Number(dvpPerGame.assists ?? 0)
        : Number(dvpPerGame[dvpMetricInfo.key] ?? NaN);
    const league =
      dvpMetricInfo.key === "pra"
        ? Number(dvpLeagueAvg.points ?? 0) + Number(dvpLeagueAvg.rebounds ?? 0) + Number(dvpLeagueAvg.assists ?? 0)
        : Number(dvpLeagueAvg[dvpMetricInfo.key] ?? NaN);
    if (!Number.isFinite(value) || !Number.isFinite(league) || league === 0) return null;
    return (value - league) / league;
  }, [dvpMetricInfo, dvpPerGame, dvpLeagueAvg]);
  const dvpMetricFlag = useMemo(() => {
    if (dvpMetricDelta === null) return null;
    if (dvpMetricDelta >= 0.07) return "weakness";
    if (dvpMetricDelta <= -0.07) return "strength";
    return "neutral";
  }, [dvpMetricDelta]);
  const trendNote = useMemo(() => {
    if (!hasSelectedOddsMarket) return null;
    if (!Number.isFinite(noteAvg ?? NaN) || !Number.isFinite(lineForMetric ?? NaN)) return null;
    const line = Number(lineForMetric);
    const lineEdge = line > 0 ? clamp(((Number(noteAvg) - line) / line) * 40, -20, 20) : 0;
    const hitEdge = clamp(((noteHitPct / 100) - 0.5) * 40, -20, 20);
    const rankEdge =
      dvpMetricRank && dvpTotalTeams && dvpTotalTeams > 1
        ? clamp(
            ((dvpMetricRank - (dvpTotalTeams + 1) / 2) / ((dvpTotalTeams - 1) / 2)) * 20,
            -20,
            20,
          )
        : 0;
    const strengthEdge =
      dvpMetricFlag === "weakness" ? 8 : dvpMetricFlag === "strength" ? -8 : 0;

    // H2H recent matchup signal (small weight).
    const h2hEdge = clamp(((matchupPct / 100) - 0.5) * 20, -6, 6);

    // Consistency signal based on volatility in the current selected window.
    const series = noteLogs
      .map((g) => trendMetricValue(g, trendMetric))
      .filter((v) => Number.isFinite(v)) as number[];
    const mean = series.length ? avg(series) : 0;
    const sd = series.length ? stdDev(series) : 0;
    const cv = mean > 0 ? sd / mean : 0;
    const consistencyEdge = clamp((0.35 - cv) * 20, -6, 6);
    const sampleEdge = series.length < 5 ? clamp((series.length - 5) * 2, -6, 0) : 0;

    const rawScore =
      50 +
      lineEdge +
      hitEdge +
      rankEdge +
      strengthEdge +
      h2hEdge +
      consistencyEdge +
      sampleEdge;
    const score = Math.round(clamp(rawScore, 0, 100));
    const grade = gradeFromTrendSignals({
      score,
      hitPct: noteHitPct,
      sampleSize: series.length,
      cv,
    });
    const lineDeltaPct = line > 0 ? Math.round(((Number(noteAvg) - line) / line) * 100) : null;
    return {
      score,
      grade,
      lineDeltaPct,
    };
  }, [
    hasSelectedOddsMarket,
    noteAvg,
    lineForMetric,
    noteHitPct,
    dvpMetricRank,
    dvpTotalTeams,
    dvpMetricFlag,
    matchupPct,
    noteLogs,
    trendMetric,
  ]);
  const displayTrendNote = trendNote;
  const windowLabel = trendWindow;

  const bzScore = computeBzScore(summary?.games);

  const allGames = summary?.games ?? [];
  const filteredGames = allGames.filter((g) => {
    if (filter === "all") return true;
    return g.homeAway === filter;
  });
  const displayedGames = showAllGames ? filteredGames : filteredGames.slice(0, 5);

  const totals = allGames.reduce(
    (acc, g) => {
      acc.points += g.points ?? 0;
      acc.rebounds += g.rebounds ?? 0;
      acc.assists += g.assists ?? 0;
      return acc;
    },
    { points: 0, rebounds: 0, assists: 0 },
  );

  const miniStats = [
    { label: "PTS", value: safeNum(totals.points, 0) },
    { label: "REB", value: safeNum(totals.rebounds, 0) },
    { label: "AST", value: safeNum(totals.assists, 0) },
  ];

  const availableBookmakers = useMemo(() => {
    const books = Array.isArray(oddsPayload?.availableBookmakers)
      ? oddsPayload.availableBookmakers
      : [];
    const seen = new Set<string>();
    return books.filter((book) => {
      const key = normalizeBookmakerKey(book.key);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [oddsPayload]);
  // Keep the displayed DvP rank aligned with the main DvP table (global BTP rank).
  // Metric-specific ranks are still used for internal trend scoring.
  const dvpEffectiveRank = dvpRow?.rank ?? dvpMetricRank ?? null;
  const dvpTier = useMemo(() => {
    const rank = dvpEffectiveRank;
    if (!rank) {
      return {
        label: "N/A",
        text: "text-slate-300",
        ring: "ring-white/10",
        hex: "#94A3B8",
      };
    }
    if (rank <= 5) {
      return {
        label: "Elite",
        text: "text-emerald-200",
        ring: "ring-emerald-400/35",
        hex: "#10B981",
      };
    }
    if (rank <= 12) {
      return {
        label: "Solid",
        text: "text-sky-200",
        ring: "ring-sky-400/35",
        hex: "#38BDF8",
      };
    }
    if (rank <= 20) {
      return {
        label: "Average",
        text: "text-slate-200",
        ring: "ring-white/20",
        hex: "#94A3B8",
      };
    }
    if (rank <= 28) {
      return {
        label: "Weak",
        text: "text-amber-200",
        ring: "ring-amber-400/35",
        hex: "#F59E0B",
      };
    }
    return {
      label: "Soft",
      text: "text-rose-200",
      ring: "ring-rose-400/35",
      hex: "#FB7185",
    };
  }, [dvpEffectiveRank]);
  const dvpStrengthPct =
    dvpTotalTeams && Number.isFinite(dvpEffectiveRank ?? NaN)
      ? Math.round(((dvpTotalTeams - Number(dvpEffectiveRank) + 1) / dvpTotalTeams) * 100)
      : null;
  const dvpRankValue = dvpLoading
    ? "Chargement..."
    : Number.isFinite(dvpEffectiveRank ?? NaN)
      ? `Rang ${dvpEffectiveRank}${dvpTotalTeams ? `/${dvpTotalTeams}` : ""}`
      : "N/A";
  const dvpBtpValue = dvpLoading ? "—" : dvpRow ? safeNum(dvpRow.btpPerGame, 1) : "N/A";
  const dvpRadarConfig = useMemo(() => {
    if (!dvpPerGame || !dvpLeagueAvg || !dvpPosition) return null;
    if (dvpPosition === "G") {
      return [
        {
          label: "PTS",
          hint: "PTS",
          value: dvpPerGame.points ?? 0,
          leagueAvg: dvpLeagueAvg.points ?? 1,
        },
        {
          label: "AST",
          hint: "AST",
          value: dvpPerGame.assists ?? 0,
          leagueAvg: dvpLeagueAvg.assists ?? 1,
        },
        {
          label: "3PT",
          hint: "3PT",
          value: dvpPerGame.threePointsMade ?? 0,
          leagueAvg: dvpLeagueAvg.threePointsMade ?? 1,
        },
      ];
    }
    if (dvpPosition === "C") {
      return [
        {
          label: "REB",
          hint: "REB",
          value: dvpPerGame.rebounds ?? 0,
          leagueAvg: dvpLeagueAvg.rebounds ?? 1,
        },
        {
          label: "PTS",
          hint: "PTS",
          value: dvpPerGame.points ?? 0,
          leagueAvg: dvpLeagueAvg.points ?? 1,
        },
        {
          label: "AST",
          hint: "AST",
          value: dvpPerGame.assists ?? 0,
          leagueAvg: dvpLeagueAvg.assists ?? 1,
        },
      ];
    }
    return [
      {
        label: "PTS",
        hint: "PTS",
        value: dvpPerGame.points ?? 0,
        leagueAvg: dvpLeagueAvg.points ?? 1,
      },
      {
        label: "REB",
        hint: "REB",
        value: dvpPerGame.rebounds ?? 0,
        leagueAvg: dvpLeagueAvg.rebounds ?? 1,
      },
      {
        label: "AST",
        hint: "AST",
        value: dvpPerGame.assists ?? 0,
        leagueAvg: dvpLeagueAvg.assists ?? 1,
      },
    ];
  }, [dvpPerGame, dvpLeagueAvg, dvpPosition]);
  const dvpRadar = useMemo(() => {
    if (!dvpRadarConfig) return null;
    const size = 84;
    const center = 42;
    const radius = 28;
    const points = dvpRadarConfig.map((m, idx) => {
      const angle = -Math.PI / 2 + (idx * (2 * Math.PI)) / dvpRadarConfig.length;
      const ratio =
        m.leagueAvg && Number.isFinite(m.leagueAvg) ? m.value / m.leagueAvg : 0;
      const value = clamp(ratio, 0.5, 1.5) / 1.5;
      const r = radius * value;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        angle,
        label: m.label,
        hint: m.hint,
        value: m.value,
        leagueAvg: m.leagueAvg,
      };
    });
    const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
    return { size, center, radius, points, polygon };
  }, [dvpRadarConfig]);
  const dvpRadarNote = dvpLeagueAvg ? "Profil vs moyenne ligue" : "Profil DvP";
  const dvpInsights = useMemo(() => {
    if (!dvpPerGame || !dvpLeagueAvg || !dvpRow || !dvpRowsForPosition.length) return null;
    const metricPool: Array<{ key: keyof NbaDvpStatTotals; label: string }> = [
      { key: "points", label: "Pts" },
      { key: "rebounds", label: "Reb" },
      { key: "assists", label: "Ast" },
      { key: "threePointsMade", label: "3PT" },
    ];
    const rankForMetric = (metricKey: keyof NbaDvpStatTotals) => {
      const rows = dvpRowsForPosition
        .map((row) => ({
          teamId: row.teamId,
          value: Number(row.metrics?.perGame?.[metricKey] ?? NaN),
        }))
        .filter((item) => Number.isFinite(item.value))
        .sort((a, b) => a.value - b.value);
      const idx = rows.findIndex((row) => Number(row.teamId) === Number(dvpRow.teamId));
      return idx >= 0 ? idx + 1 : null;
    };
    const items = metricPool
      .map((metric) => {
        const value = Number(dvpPerGame[metric.key] ?? NaN);
        const base = Number(dvpLeagueAvg[metric.key] ?? NaN);
        if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) return null;
        return {
          ...metric,
          delta: (value - base) / base,
          value,
          leagueAvg: base,
          rank: rankForMetric(metric.key),
        };
      })
      .filter(Boolean) as Array<{
      key: keyof NbaDvpStatTotals;
      label: string;
      delta: number;
      value: number;
      leagueAvg: number;
      rank: number | null;
    }>;
    if (!items.length) return null;
    const threshold = 0.07;
    const positives = [...items].filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta);
    const negatives = [...items].filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta);
    let strengths = negatives.filter((item) => item.delta <= -threshold).slice(0, 2);
    if (!strengths.length && negatives.length) strengths = negatives.slice(0, 1);
    const strengthKeys = new Set(strengths.map((item) => item.key));
    let weaknesses = positives
      .filter((item) => item.delta >= threshold)
      .slice(0, 2)
      .filter((item) => !strengthKeys.has(item.key));
    if (!weaknesses.length) {
      weaknesses = positives.filter((item) => !strengthKeys.has(item.key)).slice(0, 1);
    }
    return { weaknesses, strengths };
  }, [dvpPerGame, dvpLeagueAvg, dvpRow, dvpRowsForPosition]);

  const showLoadingState = loading || (!summary && !error);
  const handleBackToNba = (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
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
            onClick={handleBackToNba}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour NBA</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 md:flex">
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-slate-300">
                LOGO
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Betalyze</p>
                <p className="text-[11px] text-slate-500">Betalyze Player</p>
              </div>
            </div>
          </div>
        </header>

        {showLoadingState ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b090f] p-6 text-center text-sm text-slate-400">
            Chargement des statistiques...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b090f] p-6 text-center text-sm text-rose-300">
            {error}
          </div>
        ) : (
          <>
            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
                <div
                  className="relative overflow-hidden rounded-2xl border border-white/10 p-3"
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${teamPrimarySoft} 0%, rgba(11,9,15,0.96) 56%, rgba(8,8,12,0.98) 100%)`,
                    boxShadow: `inset 0 1px 0 ${teamPrimaryLine}`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(124,58,237,0.18),transparent_45%)]" />
                  <div
                    className="absolute -right-10 top-10 h-40 w-40 rounded-full blur-2xl"
                    style={{ backgroundColor: teamPrimarySoft }}
                  />
                  {teamLogo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teamLogo}
                      alt={teamName}
                      className="absolute right-4 top-2 h-20 w-20 object-contain opacity-25 mix-blend-screen"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="relative z-10 flex min-h-[210px] items-center gap-5 pr-20">
                    <div className="grid h-24 w-24 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/55">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={playerImgRef}
                        src={useAvatarImage ? avatarSrc : avatarSrc}
                        alt="Player avatar"
                        className="h-16 w-16 object-contain opacity-90"
                        onError={handlePlayerImgError}
                        onLoad={handlePlayerImgLoad}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] tracking-widest text-white/45">FICHE JOUEUR</div>
                      <div className="mt-1 flex items-baseline gap-3">
                        <div className="truncate text-2xl font-semibold tracking-tight">
                          {nameParts.first ? `${nameParts.first} ${nameParts.last}` : nameParts.last}
                        </div>
                        <div className="truncate text-sm text-white/50">{teamName} • Saison {season}</div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {dataPlayer?.jerseyNumber && (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
                            #{dataPlayer.jerseyNumber}
                          </span>
                        )}
                        {dataPlayer?.position && (
                          <span className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-200">
                            {dataPlayer.position}
                          </span>
                        )}
                        {dataPlayer?.nationality && (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75">
                            {dataPlayer.nationality}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                          {typeof dataPlayer?.isActive === "boolean"
                            ? dataPlayer.isActive
                              ? "● Active"
                              : "● Inactive"
                            : "● N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-orange-500/25 bg-black/35 p-3 ring-1 ring-orange-500/20">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_95%_8%,rgba(249,115,22,0.2),transparent_45%)]" />
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                      Betalyze Score
                    </p>
                    <span className="rounded-full border border-orange-500/35 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-200">
                      Saison {season}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-bold tracking-tight text-slate-100">
                        {bzScore !== null ? bzScore : "-"}
                        <span className="text-xl text-slate-500"> /100</span>
                      </p>
                      <p className="text-xs text-slate-400">Score maison basé sur la forme & le contexte.</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] tracking-widest text-white/40">
                    Totals sample
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {miniStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-center text-[10px]"
                      >
                        <p className="text-[10px] tracking-widest text-white/45">{stat.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-100">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs tracking-widest text-white/40">
                    Aperçu saison • NBA
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Moyennes / match (totaux + ratios).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tracking-widest text-white/40">
                    Moyenne / match
                  </span>
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 text-[11px] ring-1 ring-white/10">
                    {(["Season", "Last 5", "Last 10"] as OverviewRange[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setOverviewRange(r)}
                        className={`rounded-full px-3 py-1 transition ${
                          overviewRange === r
                            ? "border border-orange-500/35 bg-orange-500/15 text-orange-200"
                            : "text-slate-400 hover:bg-white/10 hover:text-slate-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <OverviewTile
                  label="PTS"
                  value={safeNum(overviewWindow?.points, 1)}
                  tone="orange"
                  subLeft={`MIN ${safeNum(overviewWindow?.minutes, 1)}`}
                  subRight={`PTS STD ${safeNum(overviewWindow?.pointsStdDev, 1)}`}
                />
                <OverviewTile
                  label="REB"
                  value={safeNum(overviewWindow?.rebounds, 1)}
                  tone="green"
                  subLeft={`REB STD ${rebStd}`}
                  subRight={`GAMES ${overviewWindow?.sampleSize ?? "-"}`}
                />
                <OverviewTile
                  label="AST"
                  value={safeNum(overviewWindow?.assists, 1)}
                  tone="blue"
                  subLeft={`AST STD ${astStd}`}
                  subRight={`USG ${pseudoUsg}`}
                />
                <OverviewTile
                  label="PRA"
                  value={safeNum(overviewPra, 1)}
                  tone="gold"
                  subLeft={`MIN STD ${safeNum(overviewWindow?.minutesStdDev, 1)}`}
                  subRight={`ON/OFF +`}
                />
              </div>
            </section>

            <section
              id="matchup"
              className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Matchup & contexte
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    DvP disponible, autres donnees matchup a venir.
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] text-amber-200 ring-1 ring-amber-400/40">
                  a venir
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div
                  className="rounded-2xl bg-black/35 px-3 py-2 border"
                  style={{
                    borderColor: oppPrimaryRing,
                    background: `linear-gradient(135deg, ${oppPrimarySoft}, rgba(3, 3, 7, 0.15))`,
                  }}
                >
                  <p className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: oppPrimary }}
                    />
                    {nextGameIsLive ? "Match en direct" : "Prochain match"}
                  </p>
                  {nextGameLoading ? (
                    <>
                      <p className="mt-2 text-xs text-slate-200">Chargement...</p>
                      <p className="mt-1 text-[10px] text-slate-500">On recupere le prochain match.</p>
                    </>
                  ) : nextGame ? (
                    <>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-200">
                        {nextGameOppLogo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={nextGameOppLogo}
                            alt={nextGameOppName ?? "Opponent"}
                            className="h-5 w-5 object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <span>
                          {nextGameHomeAway} {nextGameOppName ?? "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {nextGameIsLive ? "En direct" : nextGameDateLabel}
                        {nextGameTimeLabel ? ` · ${nextGameTimeLabel}` : ""}
                      </p>
                      {nextGameVenueLabel && (
                        <p className="mt-1 text-[10px] text-slate-500">{nextGameVenueLabel}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-xs text-slate-200">TBD</p>
                      <p className="mt-1 text-[10px] text-slate-500">Matchup data soon.</p>
                    </>
                  )}
                </div>
                <div
                  className={`rounded-2xl bg-black/35 px-3 py-2 ring-1 ${dvpTier.ring}`}
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba(
                      dvpTier.hex,
                      0.16,
                    )}, rgba(3, 3, 7, 0.2))`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500">
                        Defense {nextGameOppCode ?? "—"} vs {dvpPosition ?? "—"}
                      </p>
                      <span
                        className={`rounded-full bg-black/40 px-2 py-0.5 text-[9px] ${dvpTier.text} ring-1 ${dvpTier.ring}`}
                      >
                        {dvpTier.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/nba?section=defense&dvpPosition=${dvpPosition ?? "G"}#nba-dvp`}
                        className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-amber-200 ring-1 ring-amber-400/30 hover:bg-white/10"
                      >
                        Voir DvP
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] ${dvpTier.text} ring-1 ${dvpTier.ring}`}
                      >
                        <Shield className="h-3 w-3" />
                        DvP
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-base font-semibold ${dvpTier.text}`}>
                          {dvpRankValue}
                        </p>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-white/10">
                          {dvpStrengthPct !== null ? `Top ${dvpStrengthPct}%` : "—"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">BTP/G {dvpBtpValue}</p>
                    </div>
                    <div className="ml-auto">
                      {dvpRadar ? (
                        <div
                          className="relative"
                          style={{ width: dvpRadar.size, height: dvpRadar.size }}
                        >
                          <svg
                            width={dvpRadar.size}
                            height={dvpRadar.size}
                            viewBox={`0 0 ${dvpRadar.size} ${dvpRadar.size}`}
                            className="overflow-visible rounded-full bg-black/40 ring-1 ring-white/10"
                          >
                            {[0.33, 0.66, 1].map((step) => (
                              <circle
                                key={step}
                                cx={dvpRadar.center}
                                cy={dvpRadar.center}
                                r={dvpRadar.radius * step}
                                stroke="rgba(148, 163, 184, 0.2)"
                                strokeWidth="1"
                                fill="none"
                              />
                            ))}
                            {dvpRadar.points.map((pt) => (
                              <line
                                key={pt.label}
                                x1={dvpRadar.center}
                                y1={dvpRadar.center}
                                x2={pt.x}
                                y2={pt.y}
                                stroke="rgba(148, 163, 184, 0.3)"
                                strokeWidth="1"
                              />
                            ))}
                            <polygon
                              points={dvpRadar.polygon}
                              fill={hexToRgba("#38BDF8", 0.28)}
                              stroke="#38BDF8"
                              strokeWidth="2.6"
                              style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.6))" }}
                            />
                            {dvpRadar.points.map((pt) => (
                              <circle
                                key={`${pt.label}-dot`}
                                cx={pt.x}
                                cy={pt.y}
                                r="3.3"
                                fill="#38BDF8"
                                onMouseEnter={() =>
                                  setRadarHover({
                                    label: pt.label,
                                    hint: pt.hint,
                                    value: pt.value,
                                    leagueAvg: pt.leagueAvg,
                                    x: pt.x,
                                    y: pt.y,
                                    size: dvpRadar.size,
                                  })
                                }
                                onMouseLeave={() => setRadarHover(null)}
                              />
                            ))}
                            {dvpRadar.points.map((pt) => {
                              const labelRadius = dvpRadar.radius + 6;
                              const lx = dvpRadar.center + labelRadius * Math.cos(pt.angle);
                              const ly = dvpRadar.center + labelRadius * Math.sin(pt.angle);
                              const anchor =
                                Math.abs(Math.cos(pt.angle)) < 0.25
                                  ? "middle"
                                  : Math.cos(pt.angle) > 0
                                    ? "start"
                                    : "end";
                              const dy =
                                Math.sin(pt.angle) > 0.25
                                  ? 4
                                  : Math.sin(pt.angle) < -0.25
                                    ? -2
                                    : 1;
                              return (
                                <text
                                  key={`${pt.label}-label`}
                                  x={lx}
                                  y={ly}
                                  textAnchor={anchor}
                                  dominantBaseline="middle"
                                  fontSize="8"
                                  fill="rgba(226, 232, 240, 0.7)"
                                  dy={dy}
                                >
                                  {pt.label}
                                </text>
                              );
                            })}
                          </svg>
                          {radarHover && radarHover.size === dvpRadar.size && (
                            <div
                              className="pointer-events-none absolute z-10 translate-x-3 -translate-y-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-slate-100 ring-1 ring-white/10"
                              style={{
                                left: `${(radarHover.x / radarHover.size) * 100}%`,
                                top: `${(radarHover.y / radarHover.size) * 100}%`,
                              }}
                            >
                              <div className="font-semibold text-amber-100">
                                {radarHover.hint ?? radarHover.label}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-slate-300">
                                <span>Def {safeNum(radarHover.value, 1)}/m</span>
                                <span className="text-slate-600">•</span>
                                <span>Ligue {safeNum(radarHover.leagueAvg, 1)}/m</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-black/40 text-[10px] text-slate-500 ring-1 ring-white/10">
                          —
                        </div>
                      )}
                      <p className="mt-1 text-center text-[9px] text-slate-500">
                        {dvpRadarNote}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-violet-500/30"
                  style={{
                    background: `linear-gradient(135deg, ${hexToRgba("#A78BFA", 0.14)}, rgba(3, 3, 7, 0.2))`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">
                      {nextGameOppCode ?? "OPP"} · Meilleur / moins bon contre
                    </p>
                    <span className="text-[9px] text-slate-400">vs ligue</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <p className="text-[9px] text-rose-200">Moins bon contre</p>
                      <div className="mt-1 flex flex-col gap-1">
                        {dvpInsights?.weaknesses?.length ? (
                          dvpInsights.weaknesses.map((item) => (
                            <div
                              key={`weak-${item.key}`}
                              className="rounded-xl bg-white/5 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-white/10"
                            >
                              <div className="flex items-center justify-between">
                                <span>{item.label}</span>
                                <span className="text-rose-200">
                                  {item.rank ? `#${item.rank}` : "—"}
                                  {dvpTotalTeams ? `/${dvpTotalTeams}` : ""}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                                <span>Def {safeNum(item.value, 1)}/m</span>
                                <span>Ligue {safeNum(item.leagueAvg, 1)}/m</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-500 ring-1 ring-white/10">
                            {dvpLoading ? "Chargement..." : "—"}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-200">Meilleur contre</p>
                      <div className="mt-1 flex flex-col gap-1">
                        {dvpInsights?.strengths?.length ? (
                          dvpInsights.strengths.map((item) => (
                            <div
                              key={`strong-${item.key}`}
                              className="rounded-xl bg-white/5 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-white/10"
                            >
                              <div className="flex items-center justify-between">
                                <span>{item.label}</span>
                                <span className="text-emerald-200">
                                  {item.rank ? `#${item.rank}` : "—"}
                                  {dvpTotalTeams ? `/${dvpTotalTeams}` : ""}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                                <span>Def {safeNum(item.value, 1)}/m</span>
                                <span>Ligue {safeNum(item.leagueAvg, 1)}/m</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-500 ring-1 ring-white/10">
                            {dvpLoading ? "Chargement..." : "—"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs tracking-widest text-white/40">
                    Visual trend (props)
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Tendance récente par match avec filtres rapides.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-slate-300">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {trendMetricCfg.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setTrendMetric(m.key)}
                          className={
                            "rounded-full px-5 py-1 text-[10px] font-semibold ring-1 transition " +
                            (trendMetric === m.key
                              ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/35"
                              : "bg-transparent text-slate-300 ring-transparent hover:bg-white/10 hover:ring-white/10")
                          }
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
                    {([
                      { key: "L20", label: "L20" },
                      { key: "L10", label: "L10" },
                      { key: "L5", label: "L5" },
                    ] as const).map((w) => (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() => setTrendWindow(w.key)}
                        className={
                          "rounded-full px-5 py-1 text-[10px] font-semibold ring-1 transition " +
                          (trendWindow === w.key
                            ? "bg-amber-500/15 text-amber-200 ring-amber-400/40"
                            : "bg-transparent text-slate-300 ring-transparent hover:bg-white/10 hover:ring-white/10")
                        }
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>

                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex flex-col">
                    <p className="truncate text-2xl font-semibold tracking-tight text-slate-50 sm:text-[20px]">
                      {playerName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {trendOppLabel
                        ? `${nextGameHomeAway ? `${nextGameHomeAway} ` : ""}${trendOppLabel}`
                        : "—"}{" "}
                      • Metric {visualMetricLabel || trendMetric.toUpperCase()} • {trendWindow}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                      <p className="text-slate-500">
                        Projection{" "}
                        {Number.isFinite(projForMetric)
                          ? formatTrendValue(projForMetric)
                          : "—"}
                      </p>
                      {displayTrendNote && (
                        <span className="rounded-full bg-white/5 px-3 py-0.5 text-slate-200 ring-1 ring-white/10">
                          {windowLabel} vs line{" "}
                          <span
                            className={
                              displayTrendNote.lineDeltaPct !== null && displayTrendNote.lineDeltaPct >= 0
                                ? "text-emerald-200"
                                : "text-rose-200"
                            }
                          >
                            {displayTrendNote.lineDeltaPct !== null
                              ? `${displayTrendNote.lineDeltaPct >= 0 ? "+" : ""}${displayTrendNote.lineDeltaPct}%`
                              : "-"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-4 py-1 text-lg font-semibold text-emerald-200">
                      O{selectedOverOdd ? ` ${selectedOverOdd}` : ""}
                    </span>
                    <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-4 py-1 text-lg font-semibold text-rose-200">
                      U{selectedUnderOdd ? ` ${selectedUnderOdd}` : ""}
                    </span>
                    {availableBookmakers.length > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[13px] text-slate-300">
                        <select
                          value={selectedBookmaker}
                          onChange={(e) => setSelectedBookmaker(e.target.value)}
                          disabled={oddsLoading}
                          className="border-0 bg-transparent p-0 text-[13px] text-slate-200 outline-none focus:outline-none disabled:opacity-60"
                          aria-label="Bookmaker"
                        >
                          {availableBookmakers.map((book) => (
                            <option key={book.key} value={book.key} className="bg-[#0b070f] text-slate-100">
                              {book.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[13px] text-slate-300">
                        Book
                      </span>
                    )}
                    {!oddsLoading && !hasSelectedOddsMarket && (
                      <span className="rounded-full border border-orange-500/35 bg-orange-500/10 px-5 py-1 text-[13px] font-semibold text-orange-200">
                        {hasAnyPlayerOdds
                          ? "Aucune ligne pour cette métrique/book"
                          : "Marché indisponible"}
                      </span>
                    )}
                    {displayTrendNote && (
                      <div className="ml-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-xl font-semibold text-rose-200">
                        {displayTrendNote.grade.label}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b070f] p-3">
                <div className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{vMax}</span>
                    <span>0</span>
                  </div>

                  <div className="relative h-64">
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-white/30"
                      style={{ top: `${100 - (lineForMetric / vMax) * 100}%` }}
                    />

                    <div className="absolute inset-0 flex items-stretch justify-center gap-2">
                      {values.map(({ g, v }) => {
                        const oppName = g.opponentTeamName ?? "";
                        const oppCodeRaw = g.opponentTeamCode ?? "";
                        const oppCodeClean = oppCodeRaw.trim();
                        const oppCodeIsAbbr =
                          Boolean(oppCodeClean) &&
                          oppCodeClean.length <= 4 &&
                          !oppCodeClean.includes(" ");
                        const oppLookupName = !oppCodeIsAbbr && oppCodeClean ? oppCodeClean : oppName;
                        const oppFallback = oppName ? oppName.slice(0, 3).toUpperCase() : null;
                        const oppShort =
                          (oppCodeIsAbbr ? oppCodeClean.toUpperCase() : null) ??
                          (oppLookupName
                            ? teamAbbrByName.get(oppLookupName.toLowerCase())
                            : null) ??
                          oppFallback ??
                          "OPP";
                        const homeAway = formatHomeAwayLabel(g.homeAway);
                        const oppLabel = homeAway !== "-" ? `${homeAway} ${oppShort}` : oppShort;
                        const pct = clamp((v / vMax) * 100, 0, 100);
                        const altLine = altLineForGame(lineForMetric, g);
                        const isHit = v >= altLine;
                        return (
                          <div
                            key={`${g.gameId}-${g.date}`}
                            className="flex h-full flex-none flex-col items-center justify-end"
                            style={{
                              width: trendBarWidth,
                              minWidth: trendBarWidth,
                              maxWidth: trendBarWidth,
                            }}
                          >
                            <div
                              className="group relative w-full min-w-[22px] overflow-hidden rounded-lg ring-1 ring-white/10 bg-white/5 transition hover:brightness-110"
                              style={{ height: `${pct}%` }}
                            >
                              <div
                                className={`absolute inset-0 ${
                                  isHit ? "bg-emerald-500/80" : "bg-rose-500/80"
                                }`}
                              />
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100">
                                <div className="font-semibold">
                                  {formatTrendValue(v)}{" "}
                                  <span className="text-[10px] text-slate-400">
                                    {visualMetricLabel}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatHomeAwayLabel(g.homeAway)} {oppShort} ·{" "}
                                  {dateShort(String(g.date ?? ""))}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Line {formatTrendValue(altLine)}
                                </div>
                              </div>
                              {pct >= 16 && (
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white/90 drop-shadow">
                                  {formatTrendValue(v)}
                                </div>
                              )}
                            </div>

                            <div className="mt-2 text-center text-[10px] text-slate-300">
                              <div>{oppLabel}</div>
                              <div className="mt-0.5 text-[9px] text-slate-500">
                                {dateShort(String(g.date ?? ""))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      Line:{" "}
                      <span className="text-amber-200">
                        {hasScoringLine ? formatTrendValue(lineForMetric) : "-"}
                      </span>
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      Proj: <span className="text-amber-200">{formatTrendValue(projForMetric)}</span>
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 ring-1 ring-emerald-500/25">
                      Hit%: {hasScoringLine ? `${hitPct}%` : "-"}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                      Lean:{" "}
                      <span className="text-slate-50">
                        {hasScoringLine ? lean(lineForMetric, projForMetric).label : "N/A"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Game logs (Regular Season)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                {(["all", "home", "away"] as GameFilter[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilter(mode)}
                    className={`rounded-full border px-3 py-1 transition ${
                      filter === mode
                        ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                        : "border-white/10 bg-white/5 hover:border-amber-400/40"
                    }`}
                  >
                    {mode === "all" ? "All" : mode === "home" ? "Home" : "Away"}
                  </button>
                ))}
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b070f]">
                <div
                  className={`overflow-x-hidden${showAllGames ? " overflow-y-auto" : ""}`}
                  style={showAllGames ? { maxHeight: "420px" } : undefined}
                >
                  <table className="w-full table-fixed text-left text-[10px] tabular-nums">
                    <colgroup>
                      {baseColumns.map((col, idx) => (
                        <col key={col.key} style={{ width: baseColWidths[idx] ?? "12%" }} />
                      ))}
                      {statColumns.map((col) => (
                        <col key={col.id} style={{ width: statColWidth }} />
                      ))}
                    </colgroup>
                    <thead className="bg-black/30 uppercase tracking-[0.18em] text-slate-400">
                      <tr className="text-[9px]">
                        <th
                          colSpan={baseColumns.length + statColumns.length}
                          className="px-2 py-2 text-left font-semibold text-slate-300"
                        >
                          {seasonLabel}
                        </th>
                      </tr>
                      <tr className="text-[9px]">
                        {baseColumns.map((col) => (
                          <th
                            key={col.key}
                            className="relative cursor-default px-2 py-1 group"
                            title={col.full}
                          >
                            <span>{col.label}</span>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                              {col.full}
                            </span>
                          </th>
                        ))}
                        {statColumns.map((col) => (
                          <th
                            key={col.id}
                            className="relative cursor-default px-1.5 py-1 group"
                            title={col.full}
                          >
                            <span>{col.label}</span>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-amber-100 ring-1 ring-white/10 group-hover:block">
                              {col.full}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-slate-200">
                      {displayedGames.length === 0 ? (
                        <tr className="bg-black/10">
                          <td
                            colSpan={baseColumns.length + statColumns.length}
                            className="px-2 py-3 text-center text-[11px] text-slate-500"
                          >
                            Aucun match disponible.
                          </td>
                        </tr>
                      ) : (
                        displayedGames.map((g) => {
                          const oppCode = g.opponentTeamCode ?? null;
                          const oppMeta = oppCode
                            ? teamMetaByCode.get(oppCode.toUpperCase())
                            : null;
                          const oppName =
                            g.opponentTeamName ??
                            oppMeta?.fullName ??
                            oppMeta?.name ??
                            oppCode ??
                            "OPP";
                          const oppLogo =
                            getNbaCdnLogo(oppMeta?.code ?? oppCode) ??
                            oppMeta?.logo ??
                            null;
                          const homeAwayLabel = formatHomeAwayLabel(g.homeAway);
                          const resultClass =
                            g.result === "W"
                              ? "text-emerald-300"
                              : g.result === "L"
                              ? "text-rose-300"
                              : "text-slate-400";
                          const dateValue =
                            typeof g.date === "string"
                              ? g.date
                              : g.date
                              ? String(g.date)
                              : "";
                          const parsedDate =
                            dateValue && !dateValue.includes(" ")
                              ? new Date(dateValue).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : dateValue;
                          const statValues: Record<string, string | number> = {
                            min: safeNum(g.minutes, 1),
                            fg: formatMadeAttempt(g.fieldGoalsMade, g.fieldGoalsAttempted),
                            fgPct: formatPct(
                              g.fieldGoalPct,
                              g.fieldGoalsMade,
                              g.fieldGoalsAttempted,
                            ),
                            tp: formatMadeAttempt(g.threePointsMade, g.threePointsAttempted),
                            tpPct: formatPct(
                              g.threePointPct,
                              g.threePointsMade,
                              g.threePointsAttempted,
                            ),
                            ft: formatMadeAttempt(g.freeThrowsMade, g.freeThrowsAttempted),
                            ftPct: formatPct(
                              g.freeThrowPct,
                              g.freeThrowsMade,
                              g.freeThrowsAttempted,
                            ),
                            reb: safeNum(g.rebounds, 0),
                            ast: safeNum(g.assists, 0),
                            pts: safeNum(g.points, 0),
                          };
                          return (
                            <tr key={`${g.gameId}-${dateValue}`} className="hover:bg-white/5">
                              <td className="px-2 py-1 text-slate-300">
                                <div className="leading-tight">
                                  <div>{parsedDate || "-"}</div>
                                  <div className="text-[9px] text-slate-500">
                                    {g.isPreseason ? "Preseason" : "Regular"}
                                  </div>
                                </div>
                              </td>
                              <td
                                className="px-2 py-1 text-slate-300 truncate"
                                title={`${homeAwayLabel} ${oppName}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{homeAwayLabel}</span>
                                  {oppLogo && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={oppLogo}
                                      alt={oppName}
                                      className="h-4 w-4 object-contain"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  )}
                                  <span className="truncate">
                                    {oppCode ?? oppName}
                                  </span>
                                </div>
                              </td>
                              <td className={`px-2 py-1 font-semibold ${resultClass}`}>
                                <span>{g.result ?? "-"}</span>
                                {g.score ? (
                                  <span className="ml-2 text-[10px] text-slate-400">
                                    {g.score}
                                  </span>
                                ) : null}
                              </td>
                              {statColumns.map((col) => (
                                <td
                                  key={`${g.gameId}-${col.id}`}
                                  className="px-1.5 py-1"
                                >
                                  {statValues[col.key] ?? "-"}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      )}
                      {filteredGames.length > 5 && (
                        <tr className="bg-black/20">
                          <td
                            colSpan={baseColumns.length + statColumns.length}
                            className="px-2 py-3 text-center"
                          >
                            <button
                              onClick={() => setShowAllGames((prev) => !prev)}
                              className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] text-amber-100 transition hover:border-amber-400/40"
                            >
                              {showAllGames ? "Afficher moins" : "Afficher plus"}
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
