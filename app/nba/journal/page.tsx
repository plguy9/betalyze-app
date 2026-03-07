"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
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

      <div className="relative space-y-2 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", toneDot(entry.tone))} />
              <p className="truncate text-[13px] font-semibold text-slate-100">
                {entry.player}
                <span className="ml-1 text-[11px] font-normal text-white/45">{entry.team ?? "NBA"}</span>
              </p>
            </div>
            <p className="truncate pl-4 text-[11px] text-white/62">
              {entry.side === "over" ? "Over" : entry.side === "under" ? "Under" : "Tous"} · {entry.prop}
              {entry.odds !== null ? ` @ ${entry.odds.toFixed(2)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                gradePillClass(entry.grade),
              )}
            >
              {entry.grade ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/72">
          {entry.edgePct !== null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              Edge {entry.edgePct > 0 ? "+" : ""}
              {entry.edgePct.toFixed(1)}%
            </span>
          )}
          {entry.score !== null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Score {entry.score.toFixed(0)}</span>
          )}
          {(entry.stakePct !== null || entry.stakeCash !== null) && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              Stake {formatStake(entry)}
            </span>
          )}
          {entry.bookmaker && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{entry.bookmaker}</span>
          )}
          <ResultSelect
            value={entry.result}
            disabled={Boolean(updatingResult)}
            onChange={(value) => onResultChange(entry.id, value)}
          />
          <span className="ml-auto text-white/50">{formatDateLabel(entry.eventDate ?? entry.createdAt)}</span>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-[10px] font-semibold text-white/80 transition hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
        </div>
        {entry.note && <p className="text-[10px] text-white/40">{entry.note}</p>}
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

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

  useEffect(() => {
    void refreshJournal();
  }, [refreshJournal]);

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
    const confirmed = window.confirm("Supprimer ce log du journal ?");
    if (!confirmed) return;

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
    if (page === "Best Props" || page === "Players") {
      router.push("/nba?section=players");
      return;
    }
    handleComingSoon(page);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070b] text-white">
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

          <main className="min-w-0 flex-1 space-y-6">
            <GlassCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs tracking-widest text-white/35">BET JOURNAL · NBA</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
                    Performance & journal
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("fr-CA")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void refreshJournal()}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/10"
                  >
                    Rafraîchir <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid items-start gap-3 lg:grid-cols-[228px_minmax(0,1fr)]">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-orange-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New entry
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    <Filter className="h-3.5 w-3.5" />
                    Filtres
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <BankrollChart series={bankrollSeries} />
              </div>

              {showForm && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs tracking-widest text-white/40">NOUVELLE ENTRÉE</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <input
                      value={form.player}
                      onChange={(e) => setForm((prev) => ({ ...prev, player: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Player"
                    />
                    <input
                      value={form.team}
                      onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Team"
                    />
                    <input
                      value={form.opp}
                      onChange={(e) => setForm((prev) => ({ ...prev, opp: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Opp"
                    />
                    <input
                      value={form.prop}
                      onChange={(e) => setForm((prev) => ({ ...prev, prop: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Prop"
                    />
                    <input
                      value={form.odds}
                      onChange={(e) => setForm((prev) => ({ ...prev, odds: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Odds (1.90)"
                    />
                    <input
                      value={form.edgePct}
                      onChange={(e) => setForm((prev) => ({ ...prev, edgePct: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Edge %"
                    />
                    <input
                      value={form.score}
                      onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Score"
                    />
                    <input
                      value={form.stakePct}
                      onChange={(e) => setForm((prev) => ({ ...prev, stakePct: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Stake %"
                    />
                    <input
                      value={form.clv}
                      onChange={(e) => setForm((prev) => ({ ...prev, clv: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="CLV"
                    />
                    <input
                      value={form.grade}
                      onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Grade"
                    />
                    <select
                      value={form.result}
                      onChange={(e) => setForm((prev) => ({ ...prev, result: e.target.value as JournalResult }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                    >
                      <option value="W">W</option>
                      <option value="L">L</option>
                      <option value="V">V</option>
                    </select>
                    <select
                      value={form.side}
                      onChange={(e) => setForm((prev) => ({ ...prev, side: e.target.value as JournalSide }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                    >
                      <option value="all">All</option>
                      <option value="over">Over</option>
                      <option value="under">Under</option>
                    </select>
                    <input
                      value={form.bookmaker}
                      onChange={(e) => setForm((prev) => ({ ...prev, bookmaker: e.target.value }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                      placeholder="Bookmaker"
                    />
                    <select
                      value={form.tone}
                      onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value as JournalTone }))}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                    >
                      <option value="orange">orange</option>
                      <option value="red">red</option>
                      <option value="blue">blue</option>
                      <option value="green">green</option>
                      <option value="purple">purple</option>
                      <option value="neutral">neutral</option>
                    </select>
                  </div>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-orange-400/40"
                    placeholder="Note"
                  />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitEntry()}
                      disabled={saving}
                      className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Ajouter"}
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white/80 placeholder:text-white/35 outline-none focus:border-orange-500/35"
                    placeholder="Rechercher (player, prop, matchup, id...)"
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
              </div>

              {loading ? (
                <p className="mt-4 text-sm text-slate-400">Chargement du journal...</p>
              ) : error ? (
                <p className="mt-4 text-sm text-rose-300">{error}</p>
              ) : filtered.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">Aucune entrée pour ces filtres.</p>
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
            </GlassCard>

            {editingEntry && editForm && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#0b0b12] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold tracking-wide text-white/90">Modifier leg</p>
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10"
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

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void deleteEditEntry()}
                      disabled={savingEdit || deletingEdit}
                      className="rounded-full border border-rose-500/35 bg-rose-500/12 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      {deletingEdit ? "Suppression..." : "Supprimer"}
                    </button>
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
                      className="rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                    >
                      {savingEdit ? "Sauvegarde..." : "Sauvegarder"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
