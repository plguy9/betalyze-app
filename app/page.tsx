"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BasketballArena } from "@/components/basketball-arena";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import {
  ArrowRight,
  BarChart2,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  Lock,
  Menu,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";

/* ── Brand tokens ─────────────────────────────────────────────────────── */
const B = {
  bg: "#050508",
  panel: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.09)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.50)",
  orange: "#ff8a00",
  orange2: "#ffb14a",
  green: "#17d48a",
  teal: "#19c7c3",
  red: "#ff3d57",
};

function hex2rgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return `rgba(245,158,11,${a})`;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function gradeTone(grade?: string | null) {
  if (!grade) return "bg-white/5 text-slate-200 ring-white/10";
  if (grade.startsWith("A")) return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40";
  if (grade.startsWith("B")) return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/40";
  if (grade.startsWith("C")) return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40";
  return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40";
}

/* ── Small reusable components ────────────────────────────────────────── */
function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: B.muted }}>
      {children}
    </p>
  );
}

function Chip({ children, tone = "orange" }: { children: ReactNode; tone?: "orange" | "green" | "teal" | "blue" | "muted" }) {
  const s: Record<string, React.CSSProperties> = {
    orange: { borderColor: "rgba(255,138,0,.4)", background: "rgba(255,138,0,.09)", color: B.orange2 },
    green:  { borderColor: "rgba(23,212,138,.4)", background: "rgba(23,212,138,.09)", color: B.green },
    teal:   { borderColor: "rgba(25,199,195,.4)", background: "rgba(25,199,195,.09)", color: B.teal },
    blue:   { borderColor: "rgba(90,160,255,.4)", background: "rgba(90,160,255,.09)", color: "#5aa0ff" },
    muted:  { borderColor: "rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.7)" },
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium" style={s[tone]}>
      {children}
    </span>
  );
}

/* ── NBA Mock picks ───────────────────────────────────────────────────── */
const NBA_PICKS = [
  {
    player: "Nikola Jokić", pos: "C", team: "DEN", opp: "LAL",
    metric: "PRA", line: "O 52.5", odds: "-110", edge: "+14%",
    score: 94, grade: "A+", hitRate: "8/10", hitL5: "5/5", dvp: "#2/30", restEdge: "+2",
    teamColor: "#0E2240",
  },
  {
    player: "Luka Dončić", pos: "PG", team: "DAL", opp: "OKC",
    metric: "PTS", line: "O 33.5", odds: "-115", edge: "+11%",
    score: 88, grade: "A", hitRate: "7/10", hitL5: "4/5", dvp: "#5/30", restEdge: "0",
    teamColor: "#00538C",
  },
  {
    player: "Anthony Edwards", pos: "SG", team: "MIN", opp: "GSW",
    metric: "Pts+Ast", line: "O 28.5", odds: "-108", edge: "+8%",
    score: 81, grade: "B+", hitRate: "6/10", hitL5: "3/5", dvp: "#8/30", restEdge: "+1",
    teamColor: "#0C2340",
  },
  {
    player: "SGA", pos: "PG", team: "OKC", opp: "DAL",
    metric: "PTS", line: "O 31.5", odds: "-112", edge: "+9%",
    score: 85, grade: "A", hitRate: "7/10", hitL5: "4/5", dvp: "#4/30", restEdge: "0",
    teamColor: "#007AC1",
  },
];

function PickCard({ pick }: { pick: typeof NBA_PICKS[number] }) {
  const primary = pick.teamColor;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition"
      style={{
        background: `linear-gradient(135deg, ${hex2rgba(primary, .24)} 0%, rgba(8,8,14,.90) 100%)`,
        border: `1px solid ${hex2rgba(primary, .40)}`,
        boxShadow: `inset 0 1px 0 ${hex2rgba(primary, .30)}`,
      }}
    >
      {/* Left glow */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20"
        style={{ background: `linear-gradient(90deg, ${hex2rgba(primary, .28)} 0%, transparent 100%)` }} />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/50">{pick.pos}</span>
              <span className="text-[14px] font-bold text-white/95">{pick.player}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-semibold" style={{ color: B.orange2 }}>{pick.metric}</span>
              <span className="text-white/70">{pick.line}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/50">{pick.odds}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                {pick.edge}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-white/30">
              {pick.team} vs {pick.opp}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ${gradeTone(pick.grade)}`}>
            {pick.grade}
          </span>
        </div>

        {/* BZ Score bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span style={{ color: "rgba(255,255,255,.30)" }}>Betalyze Score</span>
            <span className="font-bold" style={{ color: B.orange2 }}>{pick.score}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
            <div
              className="h-1 rounded-full"
              style={{ width: `${pick.score}%`, background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
            L10 {pick.hitRate}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
            L5 {pick.hitL5}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
            DvP {pick.dvp}
          </span>
          {pick.restEdge !== "0" && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${pick.restEdge.startsWith("+") ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-rose-400/25 bg-rose-500/10 text-rose-300"}`}>
              Repos {pick.restEdge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function Home() {
  const [open, setOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes float    { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-14px)} }
        @keyframes float-sm { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)}  }
        @keyframes orb      { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.75;transform:scale(1.08)} }
        @keyframes fade-up  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ping-slow{ 0%{transform:scale(1);opacity:.6} 70%{transform:scale(1.9);opacity:0} 100%{transform:scale(1);opacity:0} }
        .anim-float    { animation: float    7s ease-in-out infinite }
        .anim-float-sm { animation: float-sm 5s ease-in-out infinite }
        .anim-orb      { animation: orb      5s ease-in-out infinite }
        .anim-fade-up  { animation: fade-up  .9s ease-out both }
        .anim-fade-up-d{ animation: fade-up  .9s ease-out .25s both }
        .anim-ping     { animation: ping-slow 2.6s ease-out infinite }
      `}</style>

      {/* ── Background layers ──────────────────────────────────────────── */}
      <div className="fixed inset-0 -z-30" style={{ background: B.bg }} />
      <div className="fixed inset-0 -z-20"
        style={{ backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`, backgroundSize: "32px 32px" }}
      />
      <div className="fixed inset-0 -z-10"
        style={{
          background:
            `radial-gradient(900px 600px at 15% -10%, rgba(255,138,0,.22) 0%, transparent 55%),` +
            `radial-gradient(700px 500px at 85% 8%, rgba(25,199,195,.12) 0%, transparent 55%),` +
            `radial-gradient(500px 400px at 50% 110%, rgba(255,61,87,.06) 0%, transparent 60%)`,
        }}
      />
      <div className="fixed inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat", backgroundSize: "180px 180px",
        }}
      />

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full" style={{ background: "transparent" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:h-20">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center">
            <BetalyzeLogo height={30} />
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden items-center gap-0 md:flex">
            {[
              { label: "Fonctionnalités", href: "#product" },
              { label: "Comment ça marche", href: "#how" },
              { label: "Tarifs",          href: "#pricing" },
              { label: "FAQ",             href: "#faq" },
            ].map((n) => (
              <a key={n.href} href={n.href}
                className="group relative px-5 py-2 text-[14px] font-medium transition-colors duration-150 hover:text-white"
                style={{ color: "rgba(255,255,255,.52)" }}>
                {n.label}
                <span className="absolute inset-x-3 bottom-0 h-px scale-x-0 rounded-full bg-orange-400 transition-transform duration-200 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          {/* CTA — desktop + mobile hamburger */}
          <div className="flex items-center gap-3">
            <Link href="/account"
              className="hidden items-center rounded-full border px-5 py-2 text-[13px] font-medium transition hover:bg-white/[0.06] md:inline-flex"
              style={{ borderColor: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.70)" }}>
              Se connecter
            </Link>
            <Link href="/account?mode=register"
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold text-black transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)", boxShadow: "0 0 24px rgba(255,138,0,.35), inset 0 1px 0 rgba(255,255,255,.25)" }}>
              Commencer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => setOpen(true)}
              className="rounded-lg p-2 transition-colors hover:bg-white/[0.06] md:hidden"
              style={{ color: B.text }} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="border-t md:hidden" style={{ borderColor: "rgba(255,255,255,.07)", background: "rgba(5,5,8,.95)", backdropFilter: "blur(20px)" }}>
            <div className="px-5 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: B.muted }}>Menu</span>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 transition hover:bg-white/5"
                  style={{ color: B.muted }} aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-0.5">
                {[
                  { label: "Fonctionnalités", href: "#product" },
                  { label: "Comment ça marche", href: "#how" },
                  { label: "Tarifs",          href: "#pricing" },
                  { label: "FAQ",             href: "#faq" },
                  { label: "Se connecter",    href: "/account" },
                ].map((n) => (
                  <a key={n.href} href={n.href} onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-[15px] font-medium transition hover:bg-white/5"
                    style={{ color: B.text }}>
                    {n.label}
                  </a>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/account?mode=register" onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-center text-[15px] font-bold text-black"
                  style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                  Commencer gratuitement
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden pt-10 md:pt-16">

        {/* Animated background orbs */}
        <div className="anim-orb pointer-events-none absolute left-[10%] top-[15%] h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,138,0,.22) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="anim-orb pointer-events-none absolute right-[15%] top-[10%] h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(25,199,195,.16) 0%, transparent 70%)", filter: "blur(50px)", animationDelay: "2.5s" }} />
        <div className="anim-orb pointer-events-none absolute bottom-0 left-[40%] h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,138,0,.12) 0%, transparent 70%)", filter: "blur(40px)", animationDelay: "1.2s" }} />

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 md:flex-row md:items-center md:gap-0">

          {/* Left — content */}
          <div className="anim-fade-up flex-1 pb-6 text-center md:pb-0 md:text-left">
            <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-[64px] lg:text-[72px]" style={{ color: B.text }}>
              Arrête de deviner.
              <br />
              <span style={{ backgroundImage: "linear-gradient(90deg,#ff8a00,#ffb14a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Commence à analyser.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed md:text-xl" style={{ color: B.muted }}>
              Forme récente, DvP, repos, usage rate — tout condensé en un Betalyze Score et un grade A+ → F sur chaque prop.
            </p>
            <div className="anim-fade-up-d mt-9 flex flex-col items-center gap-3 sm:flex-row md:items-start">
              <Link href="/nba"
                className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-[15px] font-bold text-black shadow-2xl shadow-orange-500/30 transition hover:opacity-90"
                style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                Explorer les props
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing"
                className="inline-flex items-center gap-2 rounded-2xl border px-7 py-4 text-[15px] font-semibold transition hover:bg-white/5"
                style={{ borderColor: "rgba(255,255,255,.13)", color: B.text }}>
                Voir les tarifs
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-6 text-[12px] md:justify-start" style={{ color: B.muted }}>
              {["Aucune carte requise", "Grades F → A+", "Betalyze Score 0–100"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: B.green }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — arena with floating cards (desktop only) */}
          <div className="relative hidden shrink-0 items-center justify-center md:flex md:w-[520px] lg:w-[600px]">

            {/* Glow behind arena */}
            <div className="anim-orb pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 55% 55%, rgba(255,138,0,.20) 0%, rgba(25,199,195,.10) 50%, transparent 72%)", filter: "blur(32px)", animationDelay: ".8s" }} />

            {/* Floating card — BZ Score (top-left) */}
            <div className="anim-float absolute -left-8 top-10 z-10 rounded-2xl border px-4 py-3 shadow-2xl"
              style={{ background: "rgba(8,8,14,.82)", borderColor: "rgba(255,138,0,.35)", backdropFilter: "blur(16px)", animationDelay: "0s" }}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: B.muted }}>Betalyze Score</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black" style={{ color: B.orange2 }}>94</span>
                <span className="mb-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">A+</span>
              </div>
              <div className="mt-2 h-1 w-24 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
                <div className="h-full rounded-full" style={{ width: "94%", background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }} />
              </div>
            </div>

            {/* Floating card — Hit rate (right) */}
            <div className="anim-float-sm absolute -right-6 top-1/3 z-10 rounded-2xl border px-3 py-2.5 shadow-2xl"
              style={{ background: "rgba(8,8,14,.82)", borderColor: "rgba(25,199,195,.30)", backdropFilter: "blur(16px)", animationDelay: "1.5s" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: B.muted }}>L10 Hit Rate</p>
              <p className="mt-0.5 text-xl font-black" style={{ color: B.teal }}>8 / 10</p>
              <p className="text-[10px]" style={{ color: B.muted }}>DvP #2 · Repos +2j</p>
            </div>

            {/* Floating card — Live badge (bottom) */}
            <div className="anim-float absolute bottom-10 left-0 z-10 flex items-center gap-2 rounded-full border px-3 py-2 shadow-xl"
              style={{ background: "rgba(8,8,14,.82)", borderColor: "rgba(255,255,255,.10)", backdropFilter: "blur(16px)", animationDelay: "3s" }}>
              <span className="relative flex h-2 w-2">
                <span className="anim-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold" style={{ color: B.text }}>NBA · 8 picks ce soir</span>
            </div>

            {/* Arena */}
            <div className="anim-float relative" style={{ animationDelay: ".4s" }}>
              <BasketballArena className="rounded-3xl" style={{ width: 480, height: "auto", aspectRatio: "4/3", minHeight: 240 }} />
            </div>
          </div>
        </div>
      </section>

      {/* transition hero → ticker */}
      <div className="h-10 w-full md:h-24" style={{ background: "linear-gradient(to bottom, transparent, #030305)" }} />

      {/* ── Stats ticker — full width ──────────────────────────────────── */}
      <div className="w-full" style={{ background: "#030305" }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0"
          style={{ borderColor: B.line }}>
          {[
            { value: "2 400+", label: "Props analysés / semaine", color: B.orange2, icon: <BarChart2 className="h-4 w-4" /> },
            { value: "94",     label: "BZ Score max ce soir",     color: B.green,   icon: <Sparkles className="h-4 w-4" /> },
            { value: "NBA",    label: "Sport actif · NFL bientôt",color: B.teal,    icon: <Trophy className="h-4 w-4" /> },
            { value: "F → A+", label: "Grades clairs sur chaque prop", color: B.orange2, icon: <TrendingUp className="h-4 w-4" /> },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-6 py-5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                style={{ background: `${s.color}15`, color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-lg font-black" style={{ color: B.text }}>{s.value}</p>
                <p className="text-[11px] leading-tight" style={{ color: B.muted }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* transition ticker → picks */}
      <div className="h-6 w-full md:h-12" style={{ background: "linear-gradient(to bottom, #030305, #050508)" }} />

      {/* ── Picks preview — full width ─────────────────────────────────── */}
      <section id="product" className="w-full py-12 md:py-20" style={{ background: "#050508" }}>
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-3 flex items-center gap-3">
            <Label>Picks du soir · NBA</Label>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
              Chaque pick, analysé.<br />Chaque edge, visible.
            </h2>
            <Link href="/nba"
              className="hidden shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] font-semibold transition hover:bg-white/5 md:inline-flex"
              style={{ borderColor: B.line, color: B.text }}>
              Voir tous les picks
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Full-width card grid */}
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-3 md:grid-cols-2">
            {NBA_PICKS.map((p) => <PickCard key={p.player} pick={p} />)}
          </div>

          {/* Blur CTA */}
          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-x-0 -top-12 h-16"
              style={{ background: `linear-gradient(to bottom, transparent, ${B.bg})` }} />
            <Link href="/account?mode=register"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-[13px] font-semibold transition hover:bg-white/5"
              style={{ borderColor: B.line, color: B.muted }}>
              <Lock className="h-4 w-4" />
              Connecte-toi pour voir tous les picks du soir
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* transition picks → features */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #050508, #08080e)" }} />

      {/* ── Features — full width alternating ──────────────────────────── */}
      <section className="w-full py-14 md:py-24" style={{ background: "#08080e" }}>

        {/* Feature 1 — Betalyze Score */}
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <Label>Betalyze Score</Label>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
                Un score. Un signal.<br />Pas de bruit.
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: B.muted }}>
                Le Betalyze Score (0–100) condense 5 facteurs en un seul chiffre actionnable. Un score élevé = signal fort. Un grade A+ = mise recommandée.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  { label: "Forme récente & tendances",     color: B.orange2 },
                  { label: "Qualité du matchup",            color: B.teal },
                  { label: "Usage rate & opportunité",      color: B.green },
                  { label: "Repos & récupération",          color: "#5aa0ff" },
                  { label: "Contexte de match & volatilité",color: B.muted },
                ].map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.color }} />
                    <span className="text-[13px]" style={{ color: "rgba(255,255,255,.78)" }}>{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Score visual mock */}
            <div className="rounded-2xl border p-6"
              style={{ background: "radial-gradient(600px 300px at 80% 0%, rgba(255,138,0,.12) 0%, transparent 60%), rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.09)", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
              <p className="mb-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: B.muted }}>Nikola Jokić · PRA O 52.5</p>
              <div className="mb-6 flex items-center gap-5">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{ background: "conic-gradient(#ff8a00 0% 94%, rgba(255,255,255,.06) 94% 100%)", boxShadow: "0 0 32px rgba(255,138,0,.25)" }}>
                  <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: "#09090f" }}>
                    <span className="text-2xl font-black" style={{ color: B.orange2 }}>94</span>
                  </div>
                </div>
                <div>
                  <span className="inline-block rounded-full bg-emerald-500/15 px-4 py-1.5 text-xl font-black text-emerald-200 ring-1 ring-emerald-400/40">A+</span>
                  <p className="mt-2 text-sm" style={{ color: B.muted }}>Signal très fort</p>
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,.35)" }}>Edge +14% · Cote -110</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Forme récente",  val: 96, color: B.orange2 },
                  { label: "Matchup DEN vs LAL", val: 91, color: B.teal },
                  { label: "Repos (2 jours)", val: 90, color: "#5aa0ff" },
                  { label: "Usage rate",     val: 88, color: B.green },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-[11px]" style={{ color: B.muted }}>{row.label}</span>
                    <div className="flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.07)", height: 4 }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${row.val}%`, background: row.color }} />
                    </div>
                    <span className="w-8 text-right text-[11px] font-bold" style={{ color: row.color }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-auto my-20 max-w-6xl px-5">
          <div className="h-px w-full" style={{ background: B.line }} />
        </div>

        {/* Feature 2 — DvP */}
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* DvP mock */}
            <div className="order-2 md:order-1 rounded-2xl border p-5"
              style={{ background: "radial-gradient(500px 300px at 20% 0%, rgba(25,199,195,.10) 0%, transparent 60%), rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.09)", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: B.text }}>Defense vs Position</p>
                  <p className="text-[11px]" style={{ color: B.muted }}>Guards · PTS · L10</p>
                </div>
                <Chip tone="teal"><ShieldAlert className="h-3 w-3" />DvP</Chip>
              </div>
              <div className="space-y-2">
                {[
                  { team: "LAL", label: "Lakers", rank: 1,  pts: 28.4, tone: "rose" },
                  { team: "OKC", label: "Thunder",rank: 4,  pts: 25.1, tone: "amber" },
                  { team: "DEN", label: "Nuggets",rank: 8,  pts: 23.8, tone: "amber" },
                  { team: "MIN", label: "Wolves", rank: 18, pts: 21.2, tone: "slate" },
                  { team: "BOS", label: "Celtics",rank: 27, pts: 18.6, tone: "emerald" },
                ].map((row) => (
                  <div key={row.team} className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: B.line, background: "rgba(0,0,0,.20)" }}>
                    <span className="w-7 shrink-0 text-center text-[10px] font-bold" style={{ color: B.muted }}>#{row.rank}</span>
                    <span className="w-10 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-center text-[10px] font-bold text-white/70">{row.team}</span>
                    <span className="flex-1 text-[12px]" style={{ color: B.text }}>{row.label}</span>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(row.pts / 30) * 100}%`, background: row.tone === "rose" ? B.red : row.tone === "emerald" ? B.green : row.tone === "amber" ? B.orange : B.muted }} />
                    </div>
                    <span className="w-10 text-right text-[12px] font-bold" style={{ color: row.tone === "rose" ? B.red : row.tone === "emerald" ? B.green : B.text }}>{row.pts}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[10px]" style={{ color: B.muted }}>Rang #1 = défense la plus faible (opportunité)</p>
            </div>

            <div className="order-1 md:order-2">
              <Label>Defense vs Position</Label>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
                Sais-tu contre qui<br />ton joueur joue ce soir ?
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: B.muted }}>
                La section DvP classe toutes les équipes selon leur capacité à défendre chaque position. Un rang faible = opportunité. C'est l'un des edges les plus sous-utilisés.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Classement des 30 équipes par position",
                  "Filtres G / F / C et métriques (PTS, REB, AST…)",
                  "Intégré automatiquement dans le Betalyze Score",
                  "Mis à jour chaque semaine de saison",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,.78)" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: B.teal }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* transition features → how it works */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #08080e, #030305)" }} />

      {/* ── How it works — full width ──────────────────────────────────── */}
      <section id="how" className="w-full py-14 md:py-24" style={{ background: "#030305" }}>
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 text-center">
            <Label>Comment ça marche</Label>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
              3 étapes. Un seul edge.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { step: "01", icon: <Sparkles className="h-5 w-5" />, color: B.orange2, title: "Scanner", desc: "Ouvre les Best Props du soir. Chaque pick a un grade (A+ → F) et un edge calculé. Tu vois immédiatement les meilleures opportunités." },
              { step: "02", icon: <ShieldAlert className="h-5 w-5" />, color: B.teal, title: "Analyser", desc: "Creuse le DvP, les splits, le repos, l'usage rate. Le Betalyze Score combine tout ça en un chiffre. Plus c'est haut, plus le signal est fort." },
              { step: "03", icon: <Zap className="h-5 w-5" />, color: B.green, title: "Décider", desc: "Tu choisis. Sans bruit, sans hésitation. Track tes picks dans le Bet Journal et vois ton edge évoluer en temps réel." },
            ].map((s, i) => (
              <div key={s.step} className="relative rounded-2xl border p-6"
                style={{
                  borderColor: B.line,
                  background: `radial-gradient(500px 300px at ${i === 0 ? "0%" : i === 1 ? "50%" : "100%"} 0%, rgba(255,255,255,.04) 0%, transparent 70%), ${B.panel}`,
                }}>
                <div className="mb-2 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{ borderColor: `${s.color}40`, background: `${s.color}12`, color: s.color }}>
                    {s.icon}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: B.muted }}>Étape {s.step}</span>
                </div>
                <h3 className="text-lg font-bold" style={{ color: B.text }}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: B.muted }}>{s.desc}</p>
                {i < 2 && (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded-full border p-1 md:block"
                    style={{ borderColor: B.line, background: B.bg }}>
                    <ArrowRight className="h-3 w-3" style={{ color: B.muted }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* transition how it works → bet journal */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #030305, #050508)" }} />

      {/* ── Bet Journal — full width ───────────────────────────────────── */}
      <section className="w-full py-14 md:py-24" style={{ background: "#050508" }}>
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <Label>Bet Journal</Label>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
                Suis chaque pick.<br />Vois ton edge évoluer.
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: B.muted }}>
                Enregistre chaque mise, track tes résultats et analyse ta progression. Win rate, ROI, streak, cote moyenne — tout est calculé automatiquement.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Historique complet de tes paris",
                  "Win rate & ROI calculés en temps réel",
                  "Cote moyenne hit/miss, best odds, streak",
                  "Filtres par sport, joueur, grade",
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,.78)" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: B.green }} />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/account?mode=register"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:brightness-105"
                  style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)", boxShadow: "0 0 18px rgba(255,138,0,.25)" }}>
                  <BookMarked className="h-4 w-4" />
                  Commencer à tracker
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border p-5"
              style={{ background: "radial-gradient(600px 300px at 80% 0%, rgba(255,138,0,.10) 0%, transparent 60%), rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.09)", boxShadow: "0 30px 80px rgba(0,0,0,.55)" }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: B.text }}>Mon Journal</p>
                  <p className="text-[11px]" style={{ color: B.muted }}>Saison 2025–2026 · NBA</p>
                </div>
                <Chip tone="green">+8.5u ce mois</Chip>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Win Rate", value: "62%", color: B.green },
                  { label: "ROI", value: "+14.2%", color: B.green },
                  { label: "Streak", value: "W4", color: B.orange2 },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border px-3 py-2.5 text-center"
                    style={{ borderColor: B.line, background: "rgba(0,0,0,.20)" }}>
                    <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: B.muted }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {[
                  { player: "Nikola Jokić",   pick: "PRA O 52.5",      grade: "A+", result: "WIN",  pnl: "+$60", odds: "-110" },
                  { player: "Luka Dončić",    pick: "PTS O 33.5",      grade: "A",  result: "WIN",  pnl: "+$35", odds: "-115" },
                  { player: "Anthony Edwards",pick: "Pts+Ast O 28.5",   grade: "B+", result: "WIN",  pnl: "+$28", odds: "-108" },
                  { player: "SGA",            pick: "PTS O 31.5",      grade: "A",  result: "LOSS", pnl: "−$20", odds: "-112" },
                  { player: "Jayson Tatum",   pick: "PTS O 27.5",      grade: "B+", result: "WIN",  pnl: "+$30", odds: "-114" },
                ].map((row, i) => {
                  const isWin = row.result === "WIN";
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                      style={{ borderColor: B.line, background: "rgba(0,0,0,.18)" }}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: isWin ? B.green : B.red }} />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold" style={{ color: B.text }}>{row.player}</p>
                          <p className="text-[10px]" style={{ color: B.muted }}>{row.pick} · {row.odds}</p>
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${gradeTone(row.grade)}`}>{row.grade}</span>
                        <span className="w-12 text-right text-[12px] font-bold" style={{ color: isWin ? B.green : B.red }}>{row.pnl}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-x-0 -top-8 h-10 rounded-b-xl"
                  style={{ background: "linear-gradient(to bottom, transparent, rgba(5,5,8,.95))" }} />
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-semibold"
                  style={{ borderColor: B.line, color: B.muted }}>
                  <Lock className="h-3.5 w-3.5" />
                  Connecte-toi pour voir ton journal complet
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* transition bet journal → testimonials */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #050508, #08080e)" }} />

      {/* ── Testimonials ──────────────────────────────────────────────── */}
      <section className="w-full py-14 md:py-24" style={{ background: "#08080e" }}>
        <div className="mx-auto max-w-6xl px-5">
          <div className="mb-12 text-center">
            <Label>Témoignages</Label>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
              Ils ont changé leur façon de parier.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: "Marc-Antoine L.", handle: "Parieur NBA · Montréal", initials: "ML", color: B.orange, quote: "Avant Betalyze je passais 2h à chercher les stats. Maintenant j'ai tout en 10 minutes — grades, DvP, tendances. C'est un game changer." },
              { name: "Jonathan R.", handle: "Parieur NBA · Québec", initials: "JR", color: B.teal, quote: "Le système de grades est exactement ce qu'il me fallait. Je ne mise plus au feeling, j'ai un vrai signal derrière chaque pick." },
              { name: "Sébastien T.", handle: "Parieur NBA · Toronto", initials: "ST", color: B.green, quote: "La section DvP m'a ouvert les yeux sur des edges que je ne voyais pas du tout. Mon win rate a monté dès la première semaine." },
            ].map((t) => (
              <div key={t.name} className="flex flex-col rounded-2xl border p-6" style={{ borderColor: B.line, background: B.panel }}>
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" style={{ color: B.orange2 }} />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3 border-t pt-5" style={{ borderColor: B.line }}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-black"
                    style={{ background: hex2rgba(t.color, 0.18), color: t.color, border: `1px solid ${hex2rgba(t.color, 0.35)}` }}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: B.text }}>{t.name}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: B.muted }}>{t.handle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* transition testimonials → pricing */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #08080e, #030305)" }} />

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" className="w-full py-14 md:py-24" style={{ background: "#030305" }}>
        <div className="mx-auto max-w-5xl px-5">
          <div className="mb-12 text-center">
            <Label>Tarifs</Label>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>Simple. Transparent.</h2>
            <p className="mt-3 text-sm" style={{ color: B.muted }}>Sans engagement. Sans surprise. Essai 7 jours gratuit.</p>
          </div>
          <div className="grid items-start gap-4 md:grid-cols-3 md:gap-5">
            <div className="rounded-2xl border p-6" style={{ borderColor: B.line, background: B.panel }}>
              <p className="text-sm font-bold" style={{ color: B.text }}>Gratuit</p>
              <p className="mt-0.5 text-[11px]" style={{ color: B.muted }}>Découverte</p>
              <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>0 $</p>
              <p className="text-xs" style={{ color: B.muted }}>/ mois</p>
              <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
                {["Aperçu Best Props (limité)", "DvP en lecture", "Pages joueurs basiques"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: B.green }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/account?mode=register"
                className="mt-7 block w-full rounded-xl border py-2.5 text-center text-sm font-semibold transition hover:bg-white/5"
                style={{ borderColor: B.line, color: B.text }}>
                Commencer
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-2xl border p-6 shadow-[0_30px_80px_rgba(255,138,0,.18)] md:-translate-y-2"
              style={{
                borderColor: "rgba(255,138,0,.55)",
                background: "radial-gradient(800px 300px at 50% 0%, rgba(255,138,0,.22) 0%, transparent 60%), linear-gradient(180deg, rgba(255,138,0,.14) 0%, rgba(255,255,255,.04) 100%)",
              }}>
              <div className="absolute inset-x-8 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,138,0,.9), transparent)" }} />
              <div className="absolute -top-10 right-4 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: B.text }}>Pro — NBA</p>
                  <p className="mt-0.5 text-[11px]" style={{ color: B.muted }}>Le plus populaire</p>
                </div>
                <Chip tone="orange">Populaire</Chip>
              </div>
              <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>7,99 $</p>
              <p className="text-xs" style={{ color: B.muted }}>/ mois · 7 jours gratuits</p>
              <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.85)" }}>
                {["Tous les modules NBA", "Best Props complet + BZ Score", "Pages joueurs + logs", "DvP + Splits + Matchups", "Bet Journal illimité"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: B.green }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/account?mode=register"
                className="mt-7 block w-full rounded-xl py-2.5 text-center text-sm font-bold text-black shadow-lg shadow-orange-500/25 transition hover:brightness-105"
                style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                Commencer NBA
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-2xl border p-6" style={{ borderColor: B.line, background: B.panel }}>
              <div className="pointer-events-none select-none opacity-25">
                <p className="text-sm font-bold" style={{ color: B.text }}>All Sports</p>
                <p className="mt-0.5 text-[11px]" style={{ color: B.muted }}>NBA + NFL + NHL</p>
                <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>12,99 $</p>
                <p className="text-xs" style={{ color: B.muted }}>/ mois</p>
                <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
                  {["Tous les modules", "Multi-sport", "Best Props tous sports", "DvP + Matchups"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: B.green }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300 shadow-lg">
                  <Lock className="h-3.5 w-3.5" />
                  À venir
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* transition pricing → faq */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #030305, #050508)" }} />

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="w-full py-14 md:py-24" style={{ background: "#050508" }}>
        <div className="mx-auto max-w-3xl px-5">
          <div className="mb-12 text-center">
            <Label>FAQ</Label>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>Questions fréquentes</h2>
          </div>
          <div className="space-y-2">
            {[
              { q: "C'est quoi exactement le plan gratuit ?", a: "Le plan gratuit te donne accès à un aperçu limité des Best Props, la lecture des données DvP et des pages joueurs basiques. Pas de grades complets, pas d'alertes. Parfait pour tester l'outil avant de passer au Pro." },
              { q: "Le plan Pro couvre NBA et NFL ?", a: "Le plan Pro NBA couvre uniquement la NBA — tous les modules, grades complets, DvP, logs et Betalyze Score. Un plan NFL est en développement. L'offre All Sports (NBA + NFL + NHL) arrive bientôt." },
              { q: "D'où viennent les données ?", a: "Betalyze agrège les données de plusieurs APIs sportives spécialisées et les cotes en temps réel de bookmakers reconnus. Les données sont mises à jour en continu pendant la saison." },
              { q: "Est-ce que je peux annuler à tout moment ?", a: "Oui, sans engagement. Tu peux annuler ton abonnement à tout moment depuis ton compte. Tu gardes l'accès Pro jusqu'à la fin de la période payée." },
              { q: "Le Betalyze Score, c'est quoi exactement ?", a: "C'est un score de 0 à 100 calculé à partir de plusieurs facteurs : forme récente, qualité du matchup, usage rate, repos et contexte de match. Le tout combiné en un seul chiffre actionnable. Un grade A+ = signal fort, F = éviter." },
              { q: "Betalyze garantit-il des gains ?", a: "Non, et personne ne devrait. Betalyze est un outil d'analyse — il t'aide à prendre de meilleures décisions avec les données, pas à gagner à coup sûr. Parie de façon responsable." },
            ].map((item, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border transition-colors"
                style={{ borderColor: faqOpen === i ? "rgba(255,138,0,.30)" : B.line, background: faqOpen === i ? "rgba(255,138,0,.05)" : B.panel }}>
                <button className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <span className="pr-4 text-sm font-semibold" style={{ color: B.text }}>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200"
                    style={{ color: B.muted, transform: faqOpen === i ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {faqOpen === i && (
                  <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: B.line }}>
                    <p className="text-sm leading-relaxed" style={{ color: B.muted }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* transition faq → cta */}
      <div className="h-8 w-full md:h-16" style={{ background: "linear-gradient(to bottom, #050508, #030305)" }} />

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="w-full py-14 md:py-24" style={{ background: "#030305" }}>
        <div className="mx-auto max-w-5xl px-5">
          <div className="relative overflow-hidden rounded-3xl p-10 text-center md:p-16"
            style={{
              background: "radial-gradient(900px 400px at 50% 0%, rgba(255,138,0,.30) 0%, transparent 65%), linear-gradient(180deg, rgba(255,138,0,.16) 0%, rgba(255,255,255,.03) 100%)",
              border: "1px solid rgba(255,138,0,.35)",
            }}>
            <div className="absolute -top-16 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-orange-400/15 blur-3xl" />
            <h2 className="relative text-3xl font-black tracking-tight md:text-5xl" style={{ color: B.text }}>
              Prêt à avoir un vrai edge ?
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-base" style={{ color: B.muted }}>
              Rejoins Betalyze. 7 jours gratuits. Aucune carte requise.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/account?mode=register"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-black shadow-xl shadow-orange-500/30 transition hover:opacity-90"
                style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/nba"
                className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold transition hover:bg-white/5"
                style={{ borderColor: B.line, color: B.text }}>
                Voir l&apos;app NBA
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "rgba(255,255,255,.06)", background: "#020203" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs sm:flex-row" style={{ color: B.muted }}>
          <span>© {new Date().getFullYear()} Betalyze — Better picks. Cleaner insights.</span>
          <div className="flex gap-5">
            {["Produit", "Tarifs", "Connexion"].map((l) => (
              <a key={l} href="#" className="transition hover:text-white">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
