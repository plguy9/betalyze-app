"use client";

import Link from "next/link";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
import { NbaHeader } from "@/app/nba/components/nba-header";
import { MobileBottomNav } from "@/app/nba/components/mobile-bottom-nav";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

type JournalSide = "all" | "over" | "under";
type JournalSort = "date" | "score" | "edge";
type JournalResult = "W" | "L" | "V";
type JournalTone = "red" | "blue" | "green" | "purple" | "orange" | "neutral";
type StakeInputMode = "pct" | "cash";

type JournalEntry = {
  id: string;
  createdAt: string;
  eventDate: string | null;
  league: string;
  player: string;
  team: string | null;
  opp: string | null;
  prop: string;
  side: JournalSide;
  odds: number | null;
  tag: string | null;
  edgePct: number | null;
  score: number | null;
  grade: string | null;
  result: JournalResult;
  stakeMode: StakeInputMode;
  stakePct: number | null;
  stakeCash: number | null;
  clv: number | null;
  note: string | null;
  tone: JournalTone;
  bookmaker: string | null;
};

type JournalApiPayload = {
  ok: boolean;
  entries?: JournalEntry[];
  error?: string;
};

type AccountSettingsApiPayload = {
  ok: boolean;
  settings?: {
    journalBalance?: number;
  };
  error?: string;
};

type ParlayTicketLeg = {
  id: string;
  player: string;
  team: string | null;
  opp: string | null;
  market: string;
  side: "over" | "under";
  line: number;
  oddsDecimal: number;
  oddsAmerican: number | null;
  bookmaker: string | null;
};

type ParlayTicket = {
  id: string;
  legsCount: number;
  combinedDecimal: number;
  combinedAmerican: number | null;
  stake: number | null;
  payout: number | null;
  profit: number | null;
  status: "open" | "won" | "lost" | "void";
  note: string | null;
  createdAt: string;
  legs: ParlayTicketLeg[];
};

type BankrollPoint = {
  label: string;
  value: number;
};

type NewEntryForm = {
  player: string;
  team: string;
  opp: string;
  prop: string;
  side: JournalSide;
  odds: string;
  edgePct: string;
  score: string;
  grade: string;
  result: JournalResult;
  stakePct: string;
  clv: string;
  note: string;
  tone: JournalTone;
  bookmaker: string;
};

type EditEntryForm = {
  eventDate: string;
  odds: string;
  stakeMode: StakeInputMode;
  stakePct: string;
  stakeCash: string;
  bookmaker: string;
  legType: string;
  legSide: JournalSide;
  legLine: string;
};

const LEG_TYPE_OPTIONS = ["PTS", "REB", "AST", "3PT", "PRA", "PR", "PA", "STL", "BLK", "TO"];
const BOOKMAKER_OPTIONS = [
  "FanDuel",
  "DraftKings",
  "BetMGM",
  "Caesars",
  "ESPN BET",
  "bet365",
  "PointsBet",
  "Pinnacle",
  "Unibet",
];
const STAKE_PCT_OPTIONS = ["0.25", "0.5", "1", "2", "3", "5"];
const STAKE_CASH_OPTIONS = ["5", "10", "20", "25", "50", "75", "100", "150", "200"];
const DEFAULT_BASE_BANKROLL_CASH = 5000;

const DEFAULT_FORM: NewEntryForm = {
  player: "",
  team: "",
  opp: "",
  prop: "",
  side: "all",
  odds: "",
  edgePct: "",
  score: "",
  grade: "A",
  result: "V",
  stakePct: "0.5",
  clv: "",
  note: "",
  tone: "orange",
  bookmaker: "FanDuel",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function asNumber(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function parseInputNumber(value: unknown): number | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatInputNumber(value: number | null, maxDecimals = 4) {
  if (value === null || !Number.isFinite(value)) return "";
  return Number(value.toFixed(maxDecimals)).toString();
}

function normalizeEntry(entry: JournalEntry): JournalEntry {
  return {
    ...entry,
    side:
      entry.side === "over" || entry.side === "under" || entry.side === "all"
        ? entry.side
        : "all",
    result: entry.result === "W" || entry.result === "L" || entry.result === "V" ? entry.result : "V",
    stakeMode: entry.stakeMode === "cash" ? "cash" : "pct",
    tone:
      entry.tone === "red" ||
      entry.tone === "blue" ||
      entry.tone === "green" ||
      entry.tone === "purple" ||
      entry.tone === "orange"
        ? entry.tone
        : "neutral",
    odds: asNumber(entry.odds),
    edgePct: asNumber(entry.edgePct),
    score: asNumber(entry.score),
    stakePct: asNumber(entry.stakePct),
    stakeCash: asNumber(entry.stakeCash),
    clv: asNumber(entry.clv),
  };
}

function formatStake(entry: Pick<JournalEntry, "stakeMode" | "stakePct" | "stakeCash">) {
  if (entry.stakeMode === "cash") {
    if (entry.stakeCash === null) return "—";
    return `${Number(entry.stakeCash.toFixed(2)).toString()}$`;
  }
  if (entry.stakePct === null) return "—";
  return `${entry.stakePct.toFixed(2)}%`;
}

function formatDateLabel(input: string | null) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
}

function toInputDate(input: string | null) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeLegType(input: string) {
  const value = String(input ?? "")
    .trim()
    .toUpperCase();
  if (LEG_TYPE_OPTIONS.includes(value)) return value;
  if (value.includes("3")) return "3PT";
  if (value.includes("REB")) return "REB";
  if (value.includes("AST")) return "AST";
  if (value.includes("PRA")) return "PRA";
  if (value.includes("PR")) return "PR";
  if (value.includes("PA")) return "PA";
  if (value.includes("STL")) return "STL";
  if (value.includes("BLK")) return "BLK";
  if (value.includes("TO")) return "TO";
  return "PTS";
}

function parseLegFromProp(prop: string, fallbackSide: JournalSide) {
  const raw = String(prop ?? "").trim();
  const full = raw.match(/^(.*?)(?:\s+(O|U|OVER|UNDER)\s+(-?\d+(?:[.,]\d+)?))$/i);
  if (full) {
    const sideToken = String(full[2]).toUpperCase();
    return {
      legType: full[1].trim(),
      legSide: sideToken === "U" || sideToken === "UNDER" ? "under" : "over",
      legLine: String(full[3]).replace(",", "."),
    } as const;
  }

  const lineOnly = raw.match(/^(.*?)(?:\s+(-?\d+(?:[.,]\d+)?))$/);
  if (lineOnly) {
    return {
      legType: lineOnly[1].trim(),
      legSide: fallbackSide,
      legLine: String(lineOnly[2]).replace(",", "."),
    } as const;
  }

  return {
    legType: raw,
    legSide: fallbackSide,
    legLine: "",
  } as const;
}

function buildLegProp(input: { legType: string; legSide: JournalSide; legLine: string }) {
  const legType = String(input.legType ?? "").trim();
  if (!legType) return "";
  const legLine = String(input.legLine ?? "")
    .trim()
    .replace(",", ".");
  const sideToken = input.legSide === "under" ? "U" : input.legSide === "over" ? "O" : "";
  if (!legLine) return sideToken ? `${legType} ${sideToken}` : legType;
  return sideToken ? `${legType} ${sideToken} ${legLine}` : `${legType} ${legLine}`;
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekdayMonday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: Array<{ key: string; date: Date; inCurrentMonth: boolean }> = [];

  for (let i = firstWeekdayMonday - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const d = new Date(year, month - 1, day);
    cells.push({ key: `p-${d.toISOString()}`, date: d, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({ key: `c-${d.toISOString()}`, date: d, inCurrentMonth: true });
  }

  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day += 1) {
    const d = new Date(year, month + 1, day);
    cells.push({ key: `n-${d.toISOString()}`, date: d, inCurrentMonth: false });
  }

  return cells;
}

function toneRing(grade: string | null, tone: JournalTone) {
  const normalized = String(grade ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("A")) return "border-emerald-500/40";
  if (normalized.startsWith("B")) return "border-sky-500/40";
  if (normalized.startsWith("C")) return "border-orange-500/40";
  if (normalized.startsWith("D") || normalized.startsWith("F")) return "border-rose-500/40";
  if (tone === "red") return "border-rose-500/40";
  if (tone === "blue") return "border-sky-500/40";
  if (tone === "green") return "border-emerald-500/40";
  if (tone === "purple") return "border-violet-500/40";
  if (tone === "orange") return "border-amber-500/40";
  return "border-white/10";
}

function toneDot(tone: JournalTone) {
  if (tone === "red") return "bg-rose-400";
  if (tone === "blue") return "bg-sky-400";
  if (tone === "green") return "bg-emerald-400";
  if (tone === "purple") return "bg-violet-400";
  if (tone === "orange") return "bg-amber-400";
  return "bg-white/45";
}

function gradeGlow(grade: string | null, tone: JournalTone) {
  const normalized = String(grade ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("A")) return "from-emerald-500/18";
  if (normalized.startsWith("B")) return "from-sky-500/18";
  if (normalized.startsWith("C")) return "from-orange-500/16";
  if (normalized.startsWith("D") || normalized.startsWith("F")) return "from-rose-500/18";
  if (tone === "red") return "from-rose-500/14";
  if (tone === "blue") return "from-sky-500/14";
  if (tone === "green") return "from-emerald-500/14";
  if (tone === "purple") return "from-violet-500/14";
  if (tone === "orange") return "from-amber-500/14";
  return "from-white/8";
}

function gradePillClass(grade: string | null) {
  const normalized = String(grade ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("A")) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (normalized.startsWith("B")) return "border-sky-500/25 bg-sky-500/10 text-sky-200";
  if (normalized.startsWith("C")) return "border-orange-500/25 bg-orange-500/10 text-orange-200";
  if (normalized.startsWith("D") || normalized.startsWith("F")) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  }
  return "border-white/15 bg-white/5 text-white/75";
}

function ResultSelect({
  value,
  disabled,
  onChange,
}: {
  value: JournalResult;
  disabled?: boolean;
  onChange: (value: JournalResult) => void;
}) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value as JournalResult)}
      className={cn(
        "h-8 w-[94px] rounded-full border border-white/15 bg-black/45 px-2.5 text-[10px] font-semibold outline-none",
        "focus:border-orange-400/45",
        value === "W" && "text-emerald-200",
        value === "L" && "text-rose-200",
        value === "V" && "text-white/80",
        disabled && "opacity-60",
      )}
    >
      <option value="W">Win</option>
      <option value="L">Loss</option>
      <option value="V">Void</option>
    </select>
  );
}

function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.035] shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function winRateGlowClass(winRate: number) {
  if (winRate >= 70) return "from-emerald-500/22";
  if (winRate >= 55) return "from-sky-500/20";
  if (winRate >= 45) return "from-amber-500/18";
  return "from-rose-500/20";
}

function StatTile({
  title,
  value,
  subtitle,
  glowClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  glowClass?: string;
}) {
  return (
    <GlassCard className="relative overflow-hidden p-4">
      {glowClass && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent to-transparent",
            glowClass,
          )}
        />
      )}
      <div className="relative">
        <p className="text-xs text-white/45">{title}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
        <p className="mt-1 text-xs text-white/35">{subtitle}</p>
      </div>
    </GlassCard>
  );
}

function MainWinRateTile({
  winRate,
  wins,
  losses,
}: {
  winRate: number;
  wins: number;
  losses: number;
}) {
  return (
    <GlassCard className="relative overflow-hidden p-5 lg:min-h-[142px] lg:w-[228px] lg:self-start">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent to-transparent",
          winRateGlowClass(winRate),
        )}
      />
      <div className="relative">
        <p className="text-xs tracking-widest text-white/45">WIN RATE</p>
        <p className="mt-3 text-5xl font-semibold leading-none text-slate-100">{winRate}%</p>
        <p className="mt-2 text-sm text-white/65">
          {wins}-{losses} settled
        </p>
      </div>
    </GlassCard>
  );
}

function BankrollChart({ series }: { series: BankrollPoint[] }) {
  if (!series.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-sm text-slate-400">
        Aucune donnée bankroll
      </div>
    );
  }

  const values = series.map((pt) => pt.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = series
    .map((pt, index) => {
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
      const y = 100 - ((pt.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const latest = series[series.length - 1]?.value ?? 0;
  const first = series[0]?.value ?? 0;
  const delta = latest - first;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
        <defs>
          <linearGradient id="lineFill" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(249,115,22,0.75)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.75)" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#lineFill)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-white/50">Départ {first.toFixed(0)}$</span>
        <span className={cn(delta >= 0 ? "text-emerald-200" : "text-rose-200")}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}$
        </span>
        <span className="text-white/50">Actuel {latest.toFixed(0)}$</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/45">
        {series.map((pt, index) => (
          <span key={`${pt.label}-${pt.value}-${index}`} className="rounded-full bg-white/5 px-2 py-1">
            {pt.label}
          </span>
        ))}
      </div>
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

function EntryLogRow({
  entry,
  onResultChange,
  onEdit,
  updatingResult,
}: {
  entry: JournalEntry;
  onResultChange: (id: string, value: JournalResult) => void;
  onEdit: (entry: JournalEntry) => void;
  updatingResult?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-black/25 px-3 py-2", toneRing(entry.grade, entry.tone))}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent to-transparent",
          gradeGlow(entry.grade, entry.tone),
        )}
      />
      <div className="relative hidden grid-cols-[minmax(0,1.75fr)_82px_68px_68px_72px_66px_72px_96px_102px_102px] items-center gap-1 [&>*]:px-1.5 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-white/5 lg:grid">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot(entry.tone))} />
            <p className="truncate text-[13px] font-semibold text-slate-100">
              {entry.player}
              <span className="ml-2 text-[11px] font-normal text-white/45">
                {entry.league} · {entry.team ?? "NBA"}
              </span>
            </p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                gradePillClass(entry.grade),
              )}
            >
              {entry.grade ?? "—"}
            </span>
          </div>
          <p className="truncate pl-4 text-[11px] text-white/62">
            vs {entry.opp ?? "OPP"} · {entry.prop}
            {entry.tag ? ` · ${entry.tag}` : ""}
          </p>
          {entry.note && <p className="truncate pl-4 text-[10px] text-white/40">{entry.note}</p>}
        </div>
        <div className="flex items-center justify-center text-[10px] text-white/55">
          {formatDateLabel(entry.eventDate ?? entry.createdAt)}
        </div>
        <div className="text-center text-[11px] font-semibold text-white/72">
          {entry.side === "all" ? "Tous" : entry.side === "over" ? "Over" : "Under"}
        </div>
        <div className="text-center text-[11px] text-white/75">
          {entry.odds !== null ? entry.odds.toFixed(2) : "—"}
        </div>
        <div className="text-center text-[11px] text-white/75">
          {entry.edgePct !== null ? `${entry.edgePct > 0 ? "+" : ""}${entry.edgePct.toFixed(1)}%` : "—"}
        </div>
        <div className="text-center text-[11px] text-white/75">{entry.score !== null ? entry.score.toFixed(0) : "—"}</div>
        <div className="text-center text-[11px] text-white/75">
          {formatStake(entry)}
        </div>
        <div className="truncate text-center text-[11px] text-white/75">
          {entry.bookmaker ? entry.bookmaker : "—"}
        </div>
        <div className="flex justify-center">
          <ResultSelect
            value={entry.result}
            disabled={Boolean(updatingResult)}
            onChange={(value) => onResultChange(entry.id, value)}
          />
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="inline-flex h-8 w-[96px] items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-[10px] font-semibold text-white/80 transition hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
        </div>
      </div>

      <div className="relative space-y-1.5 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneDot(entry.tone))} />
            <p className="truncate text-[12px] font-semibold text-slate-100">
              {entry.player}
              <span className="ml-1 text-[10px] font-normal text-white/45">{entry.team ?? "NBA"}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", gradePillClass(entry.grade))}>
              {entry.grade ?? "—"}
            </span>
            <span className="text-[10px] text-white/45">{formatDateLabel(entry.eventDate ?? entry.createdAt)}</span>
          </div>
        </div>
        <p className="truncate pl-3 text-[11px] text-white/55">
          {entry.side === "over" ? "Over" : entry.side === "under" ? "Under" : "Tous"} · {entry.prop}
          {entry.odds !== null ? ` @ ${entry.odds.toFixed(2)}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/65">
          {entry.edgePct !== null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">
              Edge {entry.edgePct > 0 ? "+" : ""}{entry.edgePct.toFixed(1)}%
            </span>
          )}
          {entry.score !== null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">Score {entry.score.toFixed(0)}</span>
          )}
          {entry.bookmaker && (
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5">{entry.bookmaker}</span>
          )}
          <ResultSelect
            value={entry.result}
            disabled={Boolean(updatingResult)}
            onChange={(value) => onResultChange(entry.id, value)}
          />
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 text-[10px] font-semibold text-white/75 transition hover:bg-white/10"
          >
            <Pencil className="h-3 w-3" />
            Modifier
          </button>
        </div>
        {entry.note && <p className="pl-3 text-[10px] text-white/40">{entry.note}</p>}
      </div>
    </div>
  );
}

export default function NbaBetJournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [baseBankrollCash, setBaseBankrollCash] = useState(DEFAULT_BASE_BANKROLL_CASH);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<JournalSide>("all");
  const [sortBy, setSortBy] = useState<JournalSort>("date");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEntryForm>(DEFAULT_FORM);
  const [updatingResultId, setUpdatingResultId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editForm, setEditForm] = useState<EditEntryForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEdit, setDeletingEdit] = useState(false);
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [journalTab, setJournalTab] = useState<"bets" | "parlays">("bets");
  const [parlayTickets, setParlayTickets] = useState<ParlayTicket[]>([]);
  const [parlayLoading, setParlayLoading] = useState(false);
  const [parlayError, setParlayError] = useState<string | null>(null);
  const [updatingParlayId, setUpdatingParlayId] = useState<string | null>(null);
  const [expandedParlayId, setExpandedParlayId] = useState<string | null>(null);

  const selectedEditDate = useMemo(() => {
    if (!editForm?.eventDate) return null;
    const parsed = new Date(`${editForm.eventDate}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [editForm?.eventDate]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const bookmakerOptions = useMemo(() => {
    if (!editForm?.bookmaker) return BOOKMAKER_OPTIONS;
    const current = editForm.bookmaker.trim();
    if (!current) return BOOKMAKER_OPTIONS;
    if (BOOKMAKER_OPTIONS.includes(current)) return BOOKMAKER_OPTIONS;
    return [current, ...BOOKMAKER_OPTIONS];
  }, [editForm?.bookmaker]);

  const loadJournal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nba/journal?limit=300", { cache: "no-store" });
      const data = (await res.json()) as JournalApiPayload;
      if (res.status === 401) {
        throw new Error("Connecte-toi pour accéder à ton journal personnalisé.");
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to fetch bet journal");
      }
      const list = Array.isArray(data.entries) ? data.entries.map(normalizeEntry) : [];
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal indisponible");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJournalBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/account/settings", { cache: "no-store" });
      if (res.status === 401) {
        setBaseBankrollCash(DEFAULT_BASE_BANKROLL_CASH);
        return;
      }
      const data = (await res.json()) as AccountSettingsApiPayload;
      if (!res.ok || !data.ok) return;
      const balance = Number(data.settings?.journalBalance ?? NaN);
      if (Number.isFinite(balance) && balance >= 0) {
        setBaseBankrollCash(balance);
      }
    } catch {
      // Keep previous local value if settings fetch fails
    }
  }, []);

  const refreshJournal = useCallback(async () => {
    await Promise.all([loadJournal(), loadJournalBalance()]);
  }, [loadJournal, loadJournalBalance]);

  const loadParlayTickets = useCallback(async () => {
    setParlayLoading(true);
    setParlayError(null);
    try {
      const res = await fetch("/api/nba/parlay/tickets?limit=100", { cache: "no-store" });
      if (res.status === 401) {
        setParlayError("Connecte-toi pour voir tes tickets parlay.");
        return;
      }
      const data = (await res.json()) as { ok?: boolean; tickets?: ParlayTicket[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Impossible de charger les parlays.");
      setParlayTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (err) {
      setParlayError(err instanceof Error ? err.message : "Erreur de chargement");
      setParlayTickets([]);
    } finally {
      setParlayLoading(false);
    }
  }, []);

  const updateParlayStatus = async (ticketId: string, status: "open" | "won" | "lost" | "void") => {
    setUpdatingParlayId(ticketId);
    try {
      const res = await fetch("/api/nba/parlay/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status }),
      });
      if (!res.ok) return;
      setParlayTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status } : t)),
      );
    } catch { /* ignore */ } finally {
      setUpdatingParlayId(null);
    }
  };

  useEffect(() => {
    void refreshJournal();
    void loadParlayTickets();
  }, [refreshJournal, loadParlayTickets]);

  useEffect(
    () => () => {
      if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((entry) => {
      if (view !== "all" && entry.side !== view) return false;
      if (!q) return true;
      const haystack = [
        entry.id,
        entry.player,
        entry.team ?? "",
        entry.opp ?? "",
        entry.prop,
        entry.note ?? "",
        entry.tag ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    return [...list].sort((a, b) => {
      if (sortBy === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (sortBy === "edge") return (b.edgePct ?? -999) - (a.edgePct ?? -999);
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      return tb - ta;
    });
  }, [entries, query, sortBy, view]);

  const kpis = useMemo(() => {
    const settled = filtered.filter((item) => item.result !== "V");
    const wins = settled.filter((item) => item.result === "W").length;
    const losses = settled.filter((item) => item.result === "L").length;
    const winRate = settled.length ? Math.round((wins / settled.length) * 100) : 0;
    const withEdge = filtered.filter((item) => item.edgePct !== null);
    const avgEdge =
      withEdge.length > 0
        ? withEdge.reduce((acc, item) => acc + (item.edgePct ?? 0), 0) / withEdge.length
        : 0;
    const avgScore =
      filtered.length > 0
        ? filtered.reduce((acc, item) => acc + (item.score ?? 0), 0) / filtered.length
        : 0;

    let riskedUnits = 0;
    let profitUnits = 0;
    for (const item of settled) {
      const stake =
        item.stakeMode === "cash"
          ? Math.max(0, item.stakeCash ?? 0)
          : (baseBankrollCash * Math.max(0, item.stakePct ?? 0.5)) / 100;
      riskedUnits += stake;
      if (item.result === "W") {
        const odd = item.odds ?? 1.9;
        profitUnits += stake * Math.max(0, odd - 1);
      } else if (item.result === "L") {
        profitUnits -= stake;
      }
    }
    const roiPct = riskedUnits > 0 ? (profitUnits / riskedUnits) * 100 : 0;

    const highGradeSettled = settled.filter((item) => {
      const grade = String(item.grade ?? "")
        .trim()
        .toUpperCase();
      return grade.startsWith("A");
    });
    const highGradeWins = highGradeSettled.filter((item) => item.result === "W").length;
    const highGradeWinRate = highGradeSettled.length
      ? Math.round((highGradeWins / highGradeSettled.length) * 100)
      : 0;

    return {
      wins,
      losses,
      winRate,
      avgEdge,
      edgeSamples: withEdge.length,
      avgScore,
      roiPct,
      highGradeWinRate,
      highGradeSamples: highGradeSettled.length,
    };
  }, [filtered, baseBankrollCash]);

  const bankrollSeries = useMemo(() => {
    const ordered = [...filtered].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
    const points: BankrollPoint[] = [];
    let bankroll = baseBankrollCash;
    for (const item of ordered) {
      const stake =
        item.stakeMode === "cash"
          ? Math.max(0, item.stakeCash ?? 0)
          : bankroll * (Math.max(0, item.stakePct ?? 0.5) / 100);
      if (item.result === "W") {
        const odd = item.odds ?? 1.9;
        bankroll += stake * Math.max(0, odd - 1);
      } else if (item.result === "L") {
        bankroll -= stake;
      }
      points.push({
        label: formatDateLabel(item.eventDate ?? item.createdAt),
        value: Number(bankroll.toFixed(1)),
      });
    }
    return points.slice(-8);
  }, [filtered, baseBankrollCash]);

  const submitEntry = async () => {
    if (!form.player.trim() || !form.prop.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        player: form.player.trim(),
        team: form.team.trim() || null,
        opp: form.opp.trim() || null,
        prop: form.prop.trim(),
        side: form.side,
        odds: asNumber(form.odds),
        edgePct: asNumber(form.edgePct),
        score: asNumber(form.score),
        grade: form.grade.trim() || null,
        result: form.result,
        stakePct: asNumber(form.stakePct),
        clv: asNumber(form.clv),
        note: form.note.trim() || null,
        tone: form.tone,
        bookmaker: form.bookmaker.trim() || null,
      };
      const res = await fetch("/api/nba/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (res.status === 401) {
        throw new Error("Connecte-toi pour ajouter des props dans ton journal.");
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Create failed");
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await loadJournal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer l'entrée");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (entry: JournalEntry) => {
    const parsed = parseLegFromProp(entry.prop, entry.side);
    const selectedDate = toInputDate(entry.eventDate ?? entry.createdAt);
    const stakeMode: StakeInputMode = entry.stakeMode === "cash" ? "cash" : "pct";
    setDeletingConfirm(false);
    setEditingEntry(entry);
    setEditForm({
      eventDate: selectedDate,
      odds: entry.odds !== null ? String(entry.odds) : "",
      stakeMode,
      stakePct: formatInputNumber(entry.stakePct),
      stakeCash: formatInputNumber(entry.stakeCash, 2),
      bookmaker: entry.bookmaker || BOOKMAKER_OPTIONS[0],
      legType: normalizeLegType(parsed.legType),
      legSide: parsed.legSide,
      legLine: parsed.legLine,
    });
    setShowDatePicker(false);
    if (selectedDate) {
      setCalendarMonth(new Date(`${selectedDate}T12:00:00`));
    } else {
      setCalendarMonth(new Date());
    }
  };

  const switchStakeMode = (nextMode: StakeInputMode) => {
    setEditForm((prev) => (prev ? { ...prev, stakeMode: nextMode } : prev));
  };

  const closeEditModal = () => {
    if (savingEdit || deletingEdit) return;
    setShowDatePicker(false);
    setDeletingConfirm(false);
    setEditingEntry(null);
    setEditForm(null);
  };

  const submitEdit = async () => {
    if (!editingEntry || !editForm) return;
    if (!editForm.legType.trim()) {
      setError("Le type de leg est requis.");
      return;
    }
    const prop = buildLegProp(editForm);
    if (!prop) {
      setError("Format de leg invalide.");
      return;
    }
    let nextStakePct: number | null;
    let nextStakeCash: number | null;
    let nextStakeMode: StakeInputMode;
    if (editForm.stakeMode === "cash") {
      const cash = parseInputNumber(editForm.stakeCash);
      if (cash !== null && cash < 0) {
        setError("Le montant de stake ne peut pas être négatif.");
        return;
      }
      nextStakeMode = "cash";
      nextStakeCash = cash;
      nextStakePct = null;
    } else {
      const pct = parseInputNumber(editForm.stakePct);
      if (pct !== null && pct < 0) {
        setError("Le stake % ne peut pas être négatif.");
        return;
      }
      nextStakeMode = "pct";
      nextStakePct = pct;
      nextStakeCash = null;
    }

    setSavingEdit(true);
    setError(null);
    try {
      const payload = {
        id: editingEntry.id,
        eventDate: editForm.eventDate || null,
        side: editForm.legSide,
        prop,
        odds: parseInputNumber(editForm.odds),
        stakeMode: nextStakeMode,
        stakePct: nextStakePct,
        stakeCash: nextStakeCash,
        bookmaker: editForm.bookmaker.trim() || null,
      };
      const res = await fetch("/api/nba/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; entry?: JournalEntry; error?: string };
      if (res.status === 401) {
        throw new Error("Connecte-toi pour modifier les logs de ton journal.");
      }
      if (!res.ok || !data.ok || !data.entry) {
        throw new Error(data.error ?? "Update failed");
      }

      const updated = normalizeEntry(data.entry);
      setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setEditingEntry(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier cette entrée");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEditEntry = async () => {
    if (!editingEntry) return;
    setDeletingEdit(true);
    setError(null);
    try {
      const res = await fetch("/api/nba/journal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingEntry.id }),
      });
      const data = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (res.status === 401) {
        throw new Error("Connecte-toi pour supprimer les logs de ton journal.");
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      setEntries((prev) => prev.filter((entry) => entry.id !== editingEntry.id));
      setEditingEntry(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer cette entrée");
    } finally {
      setDeletingEdit(false);
    }
  };

  const updateEntryResult = async (id: string, value: JournalResult) => {
    const current = entries.find((entry) => entry.id === id);
    if (!current || current.result === value) return;

    setUpdatingResultId(id);
    setError(null);
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, result: value } : entry)));

    try {
      const res = await fetch("/api/nba/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, result: value }),
      });
      const data = (await res.json()) as { ok: boolean; entry?: JournalEntry; error?: string };
      if (res.status === 401) {
        throw new Error("Connecte-toi pour modifier le résultat d'une entrée.");
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      if (data.entry) {
        const updated = normalizeEntry(data.entry);
        setEntries((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
      }
    } catch (err) {
      setEntries((prev) => prev.map((entry) => (entry.id === id ? current : entry)));
      setError(err instanceof Error ? err.message : "Impossible de modifier le résultat");
    } finally {
      setUpdatingResultId((activeId) => (activeId === id ? null : activeId));
    }
  };

  const handleComingSoon = (sport: string) => {
    setComingSoon(`${sport} arrive bientôt sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  const sidebarActive: NbaSidebarPage = "Bet Journal";
  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Bet Journal") return;
    if (page === "Billing") { router.push("/nba/billing"); return; }
    if (page === "Parlay") { router.push("/nba/parlay"); return; }
    if (page === "Settings") {
      router.push("/nba/settings");
      return;
    }
    if (page === "DvP") {
      router.push("/nba?section=defense#nba-dvp");
      return;
    }
    if (page === "Teams") {
      router.push("/nba?section=equipes");
      return;
    }
    if (page === "Best Props") { router.push("/nba"); return; }
    if (page === "Players") { router.push("/nba?section=players"); return; }
    handleComingSoon(page);
  };

  return (
    <div className="min-h-screen text-white md:h-screen md:overflow-hidden md:p-3" style={{ background: "#07070b" }}>

      {/* ── App card — arrondie sur desktop ── */}
      <div
        className="relative flex min-h-screen flex-col md:min-h-0 md:h-full md:flex-row md:rounded-2xl md:overflow-hidden"
        style={{ background: "#0d0d0f" }}
      >
        {/* Gradients (absolute, clippés par overflow-hidden) */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(700px 500px at 80% -5%, rgba(255,138,0,.14) 0%, transparent 60%), radial-gradient(600px 400px at 15% 50%, rgba(25,199,195,.07) 0%, transparent 60%)" }} />

      {/* ── Sidebar ── */}
      <NbaSidebar active={sidebarActive} onSelect={setSidebarActive} />

      {/* ── Colonne principale ── */}
      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">

        <NbaHeader />

        <div className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:overflow-y-auto md:pb-6">
          {comingSoon && (
            <div className="mb-3 flex justify-end text-[11px] text-amber-200">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
                {comingSoon}
              </span>
            </div>
          )}

          <main className="min-w-0 flex-1 space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Bet Journal</h1>
                <p className="mt-0.5 text-[13px] text-white/40">Historique & performance · NBA</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/55">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date().toLocaleDateString("fr-CA")}
                </span>
              </div>
            </div>

            <GlassCard className="p-5">
              <div className="mt-0 grid items-start gap-3 lg:grid-cols-[228px_minmax(0,1fr)]">
                <MainWinRateTile winRate={kpis.winRate} wins={kpis.wins} losses={kpis.losses} />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <StatTile
                    title="ROI"
                    value={`${kpis.roiPct >= 0 ? "+" : ""}${kpis.roiPct.toFixed(1)}%`}
                    subtitle="units settled"
                  />
                  <StatTile
                    title="WR A-/A/A+"
                    value={`${kpis.highGradeWinRate}%`}
                    subtitle={`${kpis.highGradeSamples} bets`}
                    glowClass={winRateGlowClass(kpis.highGradeWinRate)}
                  />
                  <StatTile
                    title="Avg Edge"
                    value={`${kpis.avgEdge >= 0 ? "+" : ""}${kpis.avgEdge.toFixed(1)}%`}
                    subtitle={`${kpis.edgeSamples} avec edge`}
                  />
                  <StatTile title="Avg Score" value={kpis.avgScore.toFixed(0)} subtitle="Betalyze score" />
                  <StatTile
                    title="Entries"
                    value={String(filtered.length)}
                    subtitle={`${view.toUpperCase()} view`}
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs tracking-widest text-white/35">BANKROLL</p>
                  <p className="mt-1 text-sm text-white/65">Suivi des entrées récentes</p>
                </div>
              </div>
              <div className="mt-4">
                <BankrollChart series={bankrollSeries} />
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setJournalTab("bets")}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-[11px] font-semibold transition",
                      journalTab === "bets"
                        ? "bg-orange-500/15 text-orange-200"
                        : "text-white/50 hover:text-white/80",
                    )}
                  >
                    Mes paris
                    <span className="ml-1.5 text-[10px] opacity-60">{filtered.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJournalTab("parlays")}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-[11px] font-semibold transition",
                      journalTab === "parlays"
                        ? "bg-orange-500/15 text-orange-200"
                        : "text-white/50 hover:text-white/80",
                    )}
                  >
                    Parlays
                    <span className="ml-1.5 text-[10px] opacity-60">{parlayTickets.length}</span>
                  </button>
                </div>
                {journalTab === "bets" && (
                  <button
                    type="button"
                    onClick={() => { setForm(DEFAULT_FORM); setShowForm(true); }}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-black transition hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nouvelle entrée
                  </button>
                )}
              </div>
              {journalTab === "bets" && <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white/80 placeholder:text-white/35 outline-none focus:border-orange-500/35"
                    placeholder="Rechercher (player, prop, matchup, id...)"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-[11px]">
                    {(["all", "over", "under"] as JournalSide[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setView(s)}
                        className={cn(
                          "rounded-full px-3 py-1.5 font-semibold transition",
                          view === s
                            ? "bg-orange-500/15 text-orange-200"
                            : "text-white/60 hover:text-white",
                        )}
                      >
                        {s === "all" ? "Tous" : s === "over" ? "Over" : "Under"}
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-[11px]">
                    {(["date", "score", "edge"] as JournalSort[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSortBy(s)}
                        className={cn(
                          "rounded-full px-3 py-1.5 font-semibold transition",
                          sortBy === s ? "bg-white/12 text-white" : "text-white/60 hover:text-white",
                        )}
                      >
                        {s === "date" ? "Date" : s === "score" ? "Score" : "Edge"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>}

              {journalTab === "bets" ? (
                <>
                  {loading ? (
                    <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Chargement du journal...
                    </div>
                  ) : error ? (
                    <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                      {error}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 py-14 text-center text-sm text-slate-500">
                      <div className="mb-2 text-2xl">📋</div>
                      Aucune entrée pour ces filtres
                    </div>
                  ) : (
                    <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-2">
                      <div className="hidden grid-cols-[minmax(0,1.75fr)_82px_68px_68px_72px_66px_72px_96px_102px_102px] items-center gap-1 border-b border-white/10 px-2 pb-2 text-[10px] uppercase tracking-widest text-white/40 [&>*]:px-1.5 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-white/5 lg:grid">
                        <span>Joueur / marché</span>
                        <span className="text-center">Date</span>
                        <span className="text-center">Side</span>
                        <span className="text-center">Cote</span>
                        <span className="text-center">Edge</span>
                        <span className="text-center">Score</span>
                        <span className="text-center">Stake</span>
                        <span className="text-center">Book</span>
                        <span className="text-center">W/L</span>
                        <span className="text-center">Action</span>
                      </div>
                      {filtered.map((entry) => (
                        <EntryLogRow
                          key={entry.id}
                          entry={entry}
                          updatingResult={updatingResultId === entry.id}
                          onResultChange={updateEntryResult}
                          onEdit={openEditModal}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* ── Parlays tab ─────────────────────────────────────────── */
                <div className="mt-4">
                  {parlayLoading ? (
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Chargement des tickets…
                    </div>
                  ) : parlayError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                      {parlayError}
                    </div>
                  ) : parlayTickets.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 py-12 text-center">
                      <div className="mb-2 text-2xl">🎰</div>
                      <p className="text-sm text-slate-500">Aucun ticket parlay sauvegardé</p>
                      <a
                        href="/nba/parlay"
                        className="mt-3 inline-block rounded-full border border-amber-500/35 bg-amber-500/10 px-4 py-1.5 text-[12px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                      >
                        Créer un parlay →
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {parlayTickets.map((ticket) => {
                        const STATUS_CFG: Record<string, { border: string; bg: string; dot: string; label: string }> = {
                          won:  { border: "rgba(52,211,153,.28)",  bg: "rgba(52,211,153,.07)",  dot: "#34d399", label: "Gagné" },
                          lost: { border: "rgba(248,113,113,.26)", bg: "rgba(248,113,113,.06)", dot: "#f87171", label: "Perdu" },
                          void: { border: "rgba(148,163,184,.18)", bg: "rgba(148,163,184,.05)", dot: "#94a3b8", label: "Annulé" },
                          open: { border: "rgba(251,191,36,.22)",  bg: "rgba(251,191,36,.05)",  dot: "#fbbf24", label: "En cours" },
                        };
                        const s = STATUS_CFG[ticket.status] ?? STATUS_CFG.open!;
                        const isExpanded = expandedParlayId === ticket.id;
                        const isUpdating = updatingParlayId === ticket.id;
                        const amOdds = Number.isFinite(ticket.combinedAmerican ?? NaN)
                          ? (ticket.combinedAmerican! > 0 ? `+${ticket.combinedAmerican}` : `${ticket.combinedAmerican}`)
                          : `${ticket.combinedDecimal.toFixed(2)}×`;
                        const createdDate = new Date(ticket.createdAt).toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
                        const legPreviews = ticket.legs.slice(0, 4).map((l) => {
                          const lastName = l.player.split(" ").slice(1).join(" ") || l.player;
                          const sideLabel = l.side === "over" ? "O" : "U";
                          return `${lastName} ${l.market} ${sideLabel}${l.line}`;
                        });
                        const moreLegs = ticket.legs.length > 4 ? ` +${ticket.legs.length - 4}` : "";
                        const payoutDisplay = ticket.status === "won"
                          ? { label: `+$${(ticket.profit ?? ticket.payout ?? 0).toFixed(2)}`, color: "#34d399" }
                          : ticket.status === "lost"
                            ? { label: `-$${(ticket.stake ?? 0).toFixed(2)}`, color: "#f87171" }
                            : ticket.payout !== null
                              ? { label: `→ $${ticket.payout.toFixed(2)}`, color: "rgba(255,255,255,.40)" }
                              : null;

                        return (
                          <div
                            key={ticket.id}
                            className="overflow-hidden rounded-xl border transition-all"
                            style={{ borderColor: s.border, background: `linear-gradient(135deg, ${s.bg} 0%, rgba(5,5,8,.97) 65%)` }}
                          >
                            {/* Compact 2-row header */}
                            <button
                              type="button"
                              onClick={() => setExpandedParlayId(isExpanded ? null : ticket.id)}
                              className="flex w-full flex-col gap-1.5 px-3.5 py-2.5 text-left"
                            >
                              {/* Row 1: status badge · legs+odds · date · arrow */}
                              <div className="flex w-full items-center gap-2.5">
                                {/* Status badge pill */}
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.dot }}
                                >
                                  {s.label}
                                </span>

                                {/* Legs count + odds */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[12px] font-bold text-white/70">
                                    {ticket.legsCount}L
                                  </span>
                                  <span className="text-[13px] font-black tabular-nums" style={{ color: s.dot }}>
                                    {amOdds}
                                  </span>
                                </div>

                                <div className="flex-1" />

                                {/* Stake & payout */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {ticket.stake !== null && (
                                    <span className="text-[11px] text-white/40">${ticket.stake.toFixed(0)}</span>
                                  )}
                                  {payoutDisplay && (
                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: payoutDisplay.color }}>
                                      {payoutDisplay.label}
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] text-white/25 shrink-0">{createdDate}</span>
                                <span className="text-[10px] text-white/25 shrink-0">{isExpanded ? "▲" : "▼"}</span>
                              </div>

                              {/* Row 2: leg previews */}
                              <div className="flex items-center gap-0 min-w-0">
                                {legPreviews.map((preview, idx) => (
                                  <span key={idx} className="shrink-0 text-[10px] text-white/38">
                                    {idx > 0 && <span className="mx-1.5 text-white/18">·</span>}
                                    {preview}
                                  </span>
                                ))}
                                {moreLegs && (
                                  <span className="ml-1.5 text-[10px] text-white/25">{moreLegs}</span>
                                )}
                              </div>
                            </button>

                            {/* Expanded: legs + status buttons */}
                            {isExpanded && (
                              <div style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                                {/* Legs list */}
                                <div className="grid gap-px" style={{ background: "rgba(0,0,0,.15)" }}>
                                  {ticket.legs.map((leg) => (
                                    <div key={leg.id} className="flex items-center justify-between gap-2 px-4 py-1.5" style={{ background: "rgba(0,0,0,.10)" }}>
                                      <div className="min-w-0">
                                        <span className="text-[12px] font-semibold text-white/80">{leg.player}</span>
                                        <span className="ml-2 text-[11px] text-white/40">
                                          {leg.market} {leg.side === "over" ? "O" : "U"} {leg.line}
                                        </span>
                                        {(leg.team ?? leg.opp) && (
                                          <span className="ml-1.5 text-[10px] text-white/22">
                                            {leg.team}{leg.opp ? ` vs ${leg.opp}` : ""}
                                          </span>
                                        )}
                                      </div>
                                      {leg.oddsAmerican !== null && (
                                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/45">
                                          {leg.oddsAmerican > 0 ? `+${leg.oddsAmerican}` : leg.oddsAmerican}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Status buttons + summary */}
                                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="mr-1 text-[10px] text-white/30">Résultat :</span>
                                    {(["open", "won", "lost", "void"] as const).map((st) => {
                                      const cfg = STATUS_CFG[st]!;
                                      const isActive = ticket.status === st;
                                      return (
                                        <button
                                          key={st}
                                          type="button"
                                          disabled={isUpdating || isActive}
                                          onClick={() => void updateParlayStatus(ticket.id, st)}
                                          className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition"
                                          style={{
                                            borderColor: isActive ? cfg.border : "rgba(255,255,255,.10)",
                                            background: isActive ? cfg.bg : "transparent",
                                            color: isActive ? cfg.dot : "rgba(255,255,255,.35)",
                                            cursor: isActive ? "default" : "pointer",
                                          }}
                                        >
                                          {cfg.label}
                                        </button>
                                      );
                                    })}
                                    {isUpdating && (
                                      <span className="text-[10px] text-white/30">Mise à jour…</span>
                                    )}
                                  </div>

                                  {/* Payout summary */}
                                  {ticket.stake !== null && ticket.payout !== null && (
                                    <div className="flex items-center gap-3 text-right">
                                      <span className="text-[10px] text-white/30">
                                        ${ticket.stake.toFixed(2)} → <span className="font-bold text-white/55">${ticket.payout.toFixed(2)}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            {editingEntry && editForm && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                <div className="w-full max-w-2xl rounded-t-3xl border border-white/15 bg-[#0b0b12] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:p-5">
                  {/* Modal header with player context */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-white/35">MODIFIER ENTRÉE</p>
                      <p className="mt-0.5 text-base font-semibold text-white">{editingEntry.player}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {editingEntry.team ?? "NBA"}
                        {editingEntry.opp ? ` · vs ${editingEntry.opp}` : ""}
                        {" · "}
                        <span className={cn("font-semibold", gradePillClass(editingEntry.grade).split(" ").find(c => c.startsWith("text-")))}>
                          {editingEntry.grade ?? "—"}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="grid gap-3 md:grid-cols-2 md:items-start">
                      <div className="relative space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Date</span>
                        <button
                          type="button"
                          onClick={() => setShowDatePicker((prev) => !prev)}
                          className="flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/85 transition hover:border-white/20"
                        >
                          <span>{editForm.eventDate || "Choisir une date"}</span>
                          <Calendar className="h-4 w-4 text-white/60" />
                        </button>
                        {showDatePicker && (
                          <div className="absolute left-0 top-[74px] z-20 w-[288px] rounded-2xl border border-white/15 bg-[#10101a] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">
                            <div className="mb-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  setCalendarMonth(
                                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                                  )
                                }
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <span className="text-xs font-semibold text-white/85">
                                {calendarMonth.toLocaleDateString("fr-CA", {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setCalendarMonth(
                                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                                  )
                                }
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-white/45">
                              {["L", "M", "M", "J", "V", "S", "D"].map((d, index) => (
                                <span key={`${d}-${index}`}>{d}</span>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {calendarDays.map((cell) => {
                                const iso = cell.date.toISOString().slice(0, 10);
                                const selected = selectedEditDate
                                  ? selectedEditDate.toDateString() === cell.date.toDateString()
                                  : false;
                                return (
                                  <button
                                    key={cell.key}
                                    type="button"
                                    onClick={() => {
                                      setEditForm((prev) =>
                                        prev ? { ...prev, eventDate: iso } : prev,
                                      );
                                      setShowDatePicker(false);
                                    }}
                                    className={cn(
                                      "h-8 rounded-lg text-[11px] transition",
                                      selected
                                        ? "bg-orange-500/25 text-orange-200"
                                        : "bg-white/5 text-white/80 hover:bg-white/10",
                                      !cell.inCurrentMonth && "text-white/35",
                                    )}
                                  >
                                    {cell.date.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Bookmaker</span>
                        <select
                          value={editForm.bookmaker}
                          onChange={(e) => setEditForm((prev) => (prev ? { ...prev, bookmaker: e.target.value } : prev))}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none focus:border-orange-400/45"
                        >
                          {bookmakerOptions.map((book) => (
                            <option key={book} value={book}>
                              {book}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                        <label className="space-y-1">
                          <div className="flex h-[34px] items-center">
                            <span className="text-[11px] uppercase tracking-widest text-white/45">Cote</span>
                          </div>
                          <input
                            value={editForm.odds}
                            onChange={(e) => setEditForm((prev) => (prev ? { ...prev, odds: e.target.value } : prev))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm outline-none focus:border-orange-400/45"
                            placeholder="1.90"
                          />
                        </label>
                        <div className="space-y-1">
                          <div className="flex h-[34px] items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-widest text-white/45">Stake</span>
                            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-[11px]">
                              <button
                                type="button"
                                onClick={() => switchStakeMode("pct")}
                                className={cn(
                                  "rounded-full px-3 py-1.5 font-semibold transition",
                                  editForm.stakeMode === "pct"
                                    ? "bg-orange-500/15 text-orange-200"
                                    : "text-white/60 hover:text-white",
                                )}
                              >
                                % bankroll
                              </button>
                              <button
                                type="button"
                                onClick={() => switchStakeMode("cash")}
                                className={cn(
                                  "rounded-full px-3 py-1.5 font-semibold transition",
                                  editForm.stakeMode === "cash"
                                    ? "bg-orange-500/15 text-orange-200"
                                    : "text-white/60 hover:text-white",
                                )}
                              >
                                $ cash
                              </button>
                            </div>
                          </div>
                          <div className="relative">
                            {editForm.stakeMode === "cash" && (
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/45">
                                $
                              </span>
                            )}
                            <input
                              list={editForm.stakeMode === "cash" ? "stake-cash-options" : "stake-pct-options"}
                              value={editForm.stakeMode === "cash" ? editForm.stakeCash : editForm.stakePct}
                              onChange={(e) =>
                                setEditForm((prev) =>
                                  prev
                                    ? prev.stakeMode === "cash"
                                      ? { ...prev, stakeCash: e.target.value }
                                      : { ...prev, stakePct: e.target.value }
                                    : prev,
                                )
                              }
                              className={cn(
                                "h-10 w-full rounded-xl border border-white/10 bg-black/35 py-2 text-sm outline-none focus:border-orange-400/45",
                                editForm.stakeMode === "cash" ? "pl-7 pr-3" : "pl-3 pr-7",
                              )}
                              placeholder={editForm.stakeMode === "cash" ? "10" : "0.5"}
                            />
                            {editForm.stakeMode === "pct" && (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/45">
                                %
                              </span>
                            )}
                          </div>
                          <datalist id="stake-pct-options">
                            {STAKE_PCT_OPTIONS.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                          <datalist id="stake-cash-options">
                            {STAKE_CASH_OPTIONS.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-widest text-white/45">Type de leg</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {LEG_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setEditForm((prev) => (prev ? { ...prev, legType: option } : prev))}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                              editForm.legType.trim().toUpperCase() === option
                                ? "border-orange-500/40 bg-orange-500/15 text-orange-200"
                                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[130px_1fr_140px]">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Side</span>
                        <select
                          value={editForm.legSide}
                          onChange={(e) => setEditForm((prev) => (prev ? { ...prev, legSide: e.target.value as JournalSide } : prev))}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none focus:border-orange-400/45"
                        >
                          <option value="over">Over</option>
                          <option value="under">Under</option>
                          <option value="all">All</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Line</span>
                        <input
                          value={editForm.legLine}
                          onChange={(e) => setEditForm((prev) => (prev ? { ...prev, legLine: e.target.value } : prev))}
                          className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm outline-none focus:border-orange-400/45"
                          placeholder="1.5"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Aperçu</span>
                        <div className="flex h-10 items-center rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-white/75">
                          {buildLegProp(editForm) || "—"}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Delete confirmation strip */}
                  {deletingConfirm ? (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3">
                      <p className="flex-1 text-xs text-rose-200">Supprimer définitivement cette entrée ?</p>
                      <button
                        type="button"
                        onClick={() => setDeletingConfirm(false)}
                        disabled={deletingEdit}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEditEntry()}
                        disabled={deletingEdit}
                        className="rounded-full border border-rose-500/45 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-60"
                      >
                        {deletingEdit ? "Suppression..." : "Oui, supprimer"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDeletingConfirm(true)}
                        disabled={savingEdit || deletingEdit}
                        className="rounded-full border border-rose-500/35 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={closeEditModal}
                          disabled={savingEdit || deletingEdit}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitEdit()}
                          disabled={savingEdit || deletingEdit}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black transition disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
                        >
                          {savingEdit ? "Sauvegarde..." : "Sauvegarder"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── New entry modal ── */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                <div className="w-full max-w-2xl rounded-t-3xl border border-white/15 bg-[#0b0b12] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl sm:p-5">
                  {/* Modal header */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-white/35">NOUVELLE ENTRÉE</p>
                      <p className="mt-0.5 text-base font-semibold text-white">Ajouter un pari</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      disabled={saving}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    {/* JOUEUR */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-widest text-white/35">JOUEUR</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Joueur *</span>
                          <input
                            value={form.player}
                            onChange={(e) => setForm((prev) => ({ ...prev, player: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="LeBron James"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Équipe</span>
                          <input
                            value={form.team}
                            onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="LAL"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Adversaire</span>
                          <input
                            value={form.opp}
                            onChange={(e) => setForm((prev) => ({ ...prev, opp: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="GSW"
                          />
                        </label>
                      </div>
                    </div>

                    {/* PARI */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-widest text-white/35">PARI</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Prop *</span>
                          <input
                            value={form.prop}
                            onChange={(e) => setForm((prev) => ({ ...prev, prop: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="PTS O 27.5"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Side</span>
                          <select
                            value={form.side}
                            onChange={(e) => setForm((prev) => ({ ...prev, side: e.target.value as JournalSide }))}
                            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 outline-none focus:border-orange-400/45"
                          >
                            <option value="over">Over</option>
                            <option value="under">Under</option>
                            <option value="all">All</option>
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Bookmaker</span>
                          <select
                            value={form.bookmaker}
                            onChange={(e) => setForm((prev) => ({ ...prev, bookmaker: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 outline-none focus:border-orange-400/45"
                          >
                            {BOOKMAKER_OPTIONS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Cote</span>
                          <input
                            value={form.odds}
                            onChange={(e) => setForm((prev) => ({ ...prev, odds: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="1.90"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Stake %</span>
                          <input
                            list="new-stake-pct-opts"
                            value={form.stakePct}
                            onChange={(e) => setForm((prev) => ({ ...prev, stakePct: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="0.5"
                          />
                          <datalist id="new-stake-pct-opts">
                            {STAKE_PCT_OPTIONS.map((v) => <option key={v} value={v} />)}
                          </datalist>
                        </label>
                      </div>
                    </div>

                    {/* ANALYSE */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-widest text-white/35">ANALYSE</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Grade</span>
                          <input
                            value={form.grade}
                            onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="A+"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Edge %</span>
                          <input
                            value={form.edgePct}
                            onChange={(e) => setForm((prev) => ({ ...prev, edgePct: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="+5.2"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-widest text-white/45">Score</span>
                          <input
                            value={form.score}
                            onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))}
                            className="h-10 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                            placeholder="82"
                          />
                        </label>
                      </div>
                      <label className="mt-3 block space-y-1">
                        <span className="text-[11px] uppercase tracking-widest text-white/45">Note</span>
                        <textarea
                          value={form.note}
                          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                          rows={2}
                          className="w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-orange-400/45"
                          placeholder="Contexte, analyse..."
                        />
                      </label>
                    </div>

                    {/* RÉSULTAT */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold tracking-widest text-white/35">RÉSULTAT</p>
                      <ResultSelect
                        value={form.result}
                        onChange={(value) => setForm((prev) => ({ ...prev, result: value }))}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      disabled={saving}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitEntry()}
                      disabled={saving || !form.player.trim() || !form.prop.trim()}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {saving ? "Ajout..." : "Ajouter"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <MobileBottomNav />
      </div>
    </div>
  );
}
