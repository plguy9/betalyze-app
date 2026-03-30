import {
  TEAM_CODE_BY_ID,
  TEAM_PRIMARY_BY_CODE,
  DEFAULT_TEAM_PRIMARY,
  FINISHED_GAME_STATUSES,
} from "@/lib/nba/constants";
import type { ApiGame, NbaGameCard, NbaPlayer, OddsApiPayload, NbaDvpPosition } from "./nba-shared-types";

export type OddsDisplayFormat = "decimal" | "american";

const SLATE_GAME_STATUSES = new Set([
  "NS", "Q1", "Q2", "Q3", "Q4", "HT", "OT", "LIVE", "1Q", "2Q", "3Q", "4Q",
]);

export function isPlayableSlateStatus(statusRaw: string | null | undefined): boolean {
  const status = String(statusRaw ?? "").trim().toUpperCase();
  if (!status) return false;
  if (FINISHED_GAME_STATUSES.has(status)) return false;
  return SLATE_GAME_STATUSES.has(status);
}

export function formatPlayerName(player: NbaPlayer): string {
  const fromParts = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
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

export function formatTodayLabel(d: Date): string {
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" ", " · ");
}

export function torontoYmd(offsetDays = 0): string {
  const base = new Date();
  const shifted = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export function inferSeasonForDate(dateIso: string): string | null {
  const ts = Date.parse(dateIso);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function formatTeamCode(teamId?: number | null, teamName?: string | null): string {
  if (teamId && TEAM_CODE_BY_ID[teamId]) return TEAM_CODE_BY_ID[teamId];
  const raw = teamName ?? "";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}

export function normalizeDvpPositionParam(value: string | null): NbaDvpPosition | null {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "G" || v === "F" || v === "C") return v;
  return null;
}

export function formatTimeLabel(game: ApiGame): string {
  const status = game.status?.short ?? null;
  if (status && status !== "NS") return status;
  if (game.time) return game.time;
  const raw = game.date ? Date.parse(game.date) : NaN;
  if (Number.isNaN(raw)) return "TBD";
  return new Date(raw).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// Format a UTC ISO timestamp in the user's IANA timezone (e.g. "7:30 PM")
export function formatGameTimeForUser(
  dateIso: string | null | undefined,
  userTimezone: string,
): string {
  if (!dateIso) return "";
  try {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

export function computeTotalFromScores(game: ApiGame): number | null {
  const home = game.scores?.home?.total;
  const away = game.scores?.away?.total;
  if (typeof home === "number" && typeof away === "number") return home + away;
  return null;
}

export function computeBetalyzeScore(total: number | null): number {
  if (total === null) return 72;
  const score = 70 + (total - 220) / 2;
  return Math.round(Math.max(40, Math.min(99, score)));
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (!Number.isFinite(value ?? NaN)) return "-";
  return Number(value).toFixed(digits);
}

function toDecimalOdds(value: number): number | null {
  if (!Number.isFinite(value) || value === 0) return null;
  if (Math.abs(value) < 20) return value > 1 ? value : null;
  if (value > 0) return 1 + value / 100;
  return 1 + 100 / Math.abs(value);
}

function toAmericanOdds(value: number): number | null {
  if (!Number.isFinite(value) || value === 0) return null;
  if (Math.abs(value) >= 20) return value;
  if (value <= 1) return null;
  if (value >= 2) return (value - 1) * 100;
  return -100 / (value - 1);
}

export function formatOddsForDisplay(
  value: number | null | undefined,
  format: OddsDisplayFormat,
): string {
  if (!Number.isFinite(value ?? NaN)) return "—";
  const n = Number(value);
  if (format === "decimal") {
    const decimal = toDecimalOdds(n);
    if (!Number.isFinite(decimal ?? NaN)) return "—";
    return Number(decimal).toFixed(2);
  }
  const american = toAmericanOdds(n);
  if (!Number.isFinite(american ?? NaN)) return "—";
  const rounded = Math.round(Number(american));
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function formatEdge(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "-";
  const num = Number(value);
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
}

export function trendMetricParamFromTopMetric(metric: string | null | undefined): string | null {
  const key = String(metric ?? "").trim().toUpperCase();
  if (key === "PTS" || key === "POINTS") return "pts";
  if (key === "REB" || key === "REBOUNDS") return "reb";
  if (key === "AST" || key === "ASSISTS") return "ast";
  if (key === "3PT" || key === "3PM" || key === "THREES") return "tp";
  if (key === "PRA" || key === "P+A" || key === "P+R" || key === "R+A") return "pra";
  return null;
}

export function normalizeBookmakerQueryValue(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function gradeTone(grade: string | null | undefined): string {
  const g = String(grade ?? "").toUpperCase().trim();
  if (g === "S") return "bg-amber-500/20 text-amber-300 ring-amber-400/60";
  if (g === "A") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40";
  if (g === "B") return "bg-sky-500/15 text-sky-200 ring-sky-400/40";
  if (g === "C") return "bg-white/8 text-white/40 ring-white/15";
  return "bg-rose-500/10 text-rose-300/60 ring-rose-400/20";
}

export function gradeSortRank(grade: string | null | undefined): number {
  const g = String(grade ?? "").trim().toUpperCase();
  if (g === "S") return 5;
  if (g === "A") return 4;
  if (g === "B") return 3;
  if (g === "C") return 2;
  return 0;
}

type PaceSource = "odds" | "scores" | "none";

export function paceTagForTotal(
  total: number | null,
  options?: { statusShort?: string | null; source?: PaceSource },
): string {
  const status = String(options?.statusShort ?? "").trim().toUpperCase();
  const source = options?.source ?? (total === null ? "none" : "odds");
  const isFinished = FINISHED_GAME_STATUSES.has(status);

  if (source === "none" || total === null) return "Line pending";
  if (source === "scores" && !isFinished) return "Live";
  if (total >= 236) return "High pace";
  if (total >= 229) return "Up-tempo";
  if (total >= 222) return "Balanced";
  if (total >= 215) return "Half-court";
  return "Defensive";
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getTeamPrimaryColor(teamCode?: string | null): string {
  const codeKey = teamCode?.toUpperCase();
  if (codeKey && TEAM_PRIMARY_BY_CODE[codeKey]) return TEAM_PRIMARY_BY_CODE[codeKey];
  return DEFAULT_TEAM_PRIMARY;
}

export function buildGameCard(game: ApiGame, odds: OddsApiPayload | null): NbaGameCard | null {
  if (!game.id || !game.teams?.home?.name || !game.teams?.away?.name) return null;
  const homeId = game.teams.home.id ?? null;
  const awayId = game.teams.away.id ?? null;
  const homeName = game.teams.home.name ?? "Home";
  const awayName = game.teams.away.name ?? "Away";
  const homeApiCode = String(game.teams.home.code ?? "").trim().toUpperCase();
  const awayApiCode = String(game.teams.away.code ?? "").trim().toUpperCase();
  const homeCode = homeApiCode || formatTeamCode(homeId, homeName);
  const awayCode = awayApiCode || formatTeamCode(awayId, awayName);
  const homeLogo = game.teams.home.logo ?? null;
  const awayLogo = game.teams.away.logo ?? null;
  const homeScore = Number.isFinite(game.scores?.home?.total ?? NaN)
    ? Number(game.scores?.home?.total)
    : null;
  const awayScore = Number.isFinite(game.scores?.away?.total ?? NaN)
    ? Number(game.scores?.away?.total)
    : null;
  const statusShort = String(game.status?.short ?? "").trim().toUpperCase();
  const totalFromOdds = Number.isFinite(odds?.total ?? NaN) ? Number(odds?.total) : null;
  const totalFromScores = statusShort === "NS" ? null : computeTotalFromScores(game);
  const total = totalFromOdds ?? totalFromScores;
  const paceSource: PaceSource =
    totalFromOdds !== null ? "odds" : totalFromScores !== null ? "scores" : "none";
  const spread = odds?.spread ?? null;
  const openingSpread = odds?.openingSpread ?? null;
  const moneyline = odds?.moneyline ?? null;
  const spreadFavorite =
    spread && Number.isFinite(spread.line)
      ? `${spread.side === "home" ? homeCode : awayCode} ${spread.line > 0 ? `+${spread.line}` : spread.line}`
      : null;
  return {
    id: game.id,
    dateIso: game.date ?? null,
    time: formatTimeLabel(game),
    awayId,
    away: awayCode,
    awayName,
    awayLogo,
    awayScore,
    homeId,
    home: homeCode,
    homeName,
    homeLogo,
    homeScore,
    total,
    openingTotal: Number.isFinite(odds?.openingTotal ?? NaN) ? Number(odds?.openingTotal) : null,
    marketSource: paceSource,
    spreadLine: spread && Number.isFinite(spread.line) ? Number(spread.line) : null,
    spreadSide: spread?.side === "home" || spread?.side === "away" ? spread.side : null,
    openingSpreadLine:
      openingSpread && Number.isFinite(openingSpread.line) ? Number(openingSpread.line) : null,
    openingSpreadSide:
      openingSpread?.side === "home" || openingSpread?.side === "away"
        ? openingSpread.side
        : null,
    moneylineHome: Number.isFinite(moneyline?.home ?? NaN) ? Number(moneyline?.home) : null,
    moneylineAway: Number.isFinite(moneyline?.away ?? NaN) ? Number(moneyline?.away) : null,
    openingMoneylineHome:
      Number.isFinite(moneyline?.homeOpen ?? NaN) ? Number(moneyline?.homeOpen) : null,
    openingMoneylineAway:
      Number.isFinite(moneyline?.awayOpen ?? NaN) ? Number(moneyline?.awayOpen) : null,
    spreadFavorite,
    bookmakerName: odds?.bookmaker?.name ?? null,
    betalyzeScore: computeBetalyzeScore(total),
    paceTag: paceTagForTotal(total, { statusShort: game.status?.short ?? null, source: paceSource }),
    statusShort: game.status?.short ?? null,
  };
}

export function safeRatio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

export function formatDvpNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "—";
  return Number(value).toFixed(1);
}

export function formatDvpPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function formatFormStreak(form: string | null | undefined): string {
  const clean = String(form ?? "").toUpperCase().replace(/[^WL]/g, "");
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

export function compareStandingsForRank(
  a: { winPct: number; wins: number; losses: number; diffPerGame: number; name: string },
  b: { winPct: number; wins: number; losses: number; diffPerGame: number; name: string },
): number {
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  if (a.diffPerGame !== b.diffPerGame) return b.diffPerGame - a.diffPerGame;
  return a.name.localeCompare(b.name);
}
