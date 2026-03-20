"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BasketballArena } from "@/components/basketball-arena";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Lock,
  Menu,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";

/* ─── Brand tokens ─────────────────────────────────────────────────────────── */
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

/* ─── Team data ─────────────────────────────────────────────────────────────── */
const TEAM_PRIMARY: Record<string, string> = {
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#041E42", DEN: "#002244", DET: "#0076B6", GB:  "#203731",
  HOU: "#03202F", IND: "#002C5F", JAX: "#006778", KC:  "#E31837",
  LV:  "#000000", LAC: "#0080C6", LAR: "#003594", LA:  "#003594",
  MIA: "#008E97", MIN: "#4F2683", NE:  "#002244", NO:  "#D3BC8D",
  NYG: "#0B2265", NYJ: "#125740", PHI: "#004C54", PIT: "#FFB612",
  SF:  "#AA0000", SEA: "#002244", TB:  "#D50A0A", TEN: "#0C2340",
  WAS: "#5A1414",
};
const TEAM_LOGO: Record<string, string> = {
  ARI: "https://media.api-sports.io/american-football/teams/1.png",
  ATL: "https://media.api-sports.io/american-football/teams/2.png",
  BAL: "https://media.api-sports.io/american-football/teams/3.png",
  BUF: "https://media.api-sports.io/american-football/teams/4.png",
  CAR: "https://media.api-sports.io/american-football/teams/5.png",
  CHI: "https://media.api-sports.io/american-football/teams/6.png",
  CIN: "https://media.api-sports.io/american-football/teams/7.png",
  CLE: "https://media.api-sports.io/american-football/teams/8.png",
  DAL: "https://media.api-sports.io/american-football/teams/9.png",
  DEN: "https://media.api-sports.io/american-football/teams/10.png",
  DET: "https://media.api-sports.io/american-football/teams/11.png",
  GB:  "https://media.api-sports.io/american-football/teams/12.png",
  HOU: "https://media.api-sports.io/american-football/teams/34.png",
  IND: "https://media.api-sports.io/american-football/teams/14.png",
  JAX: "https://media.api-sports.io/american-football/teams/15.png",
  KC:  "https://media.api-sports.io/american-football/teams/16.png",
  LAC: "https://media.api-sports.io/american-football/teams/29.png",
  LAR: "https://media.api-sports.io/american-football/teams/28.png",
  LV:  "https://media.api-sports.io/american-football/teams/13.png",
  MIA: "https://media.api-sports.io/american-football/teams/18.png",
  MIN: "https://media.api-sports.io/american-football/teams/19.png",
  NE:  "https://media.api-sports.io/american-football/teams/20.png",
  NO:  "https://media.api-sports.io/american-football/teams/21.png",
  NYG: "https://media.api-sports.io/american-football/teams/22.png",
  NYJ: "https://media.api-sports.io/american-football/teams/23.png",
  PHI: "https://media.api-sports.io/american-football/teams/24.png",
  PIT: "https://media.api-sports.io/american-football/teams/25.png",
  SF:  "https://media.api-sports.io/american-football/teams/26.png",
  SEA: "https://media.api-sports.io/american-football/teams/27.png",
  TB:  "https://media.api-sports.io/american-football/teams/30.png",
  TEN: "https://media.api-sports.io/american-football/teams/31.png",
  WAS: "https://media.api-sports.io/american-football/teams/32.png",
};

/* ─── Mock picks ────────────────────────────────────────────────────────────── */
const PICKS = [
  { player: "Ja'Marr Chase",    pos: "WR", team: "CIN", opp: "KC",  pick: "Rec. Yards", line: "O 82.5", odds: "-115", edge: "+12%", score: 91, grade: "A+", pill: { label: "DvP Rec Yds #29/32", tone: "green" } },
  { player: "Travis Kelce",     pos: "TE", team: "KC",  opp: "CIN", pick: "Rec.",        line: "O 4.5",  odds: "-108", edge: "+9%",  score: 87, grade: "A",  pill: { label: "DvP TE Rec #27/32",  tone: "green" } },
  { player: "Brock Purdy",      pos: "QB", team: "SF",  opp: "SEA", pick: "Pass Yards",  line: "O 238.5",odds: "-112", edge: "+7%",  score: 79, grade: "B+", pill: { label: "DvP Pass Yds #22/32",tone: "teal"  } },
  { player: "Tony Pollard",     pos: "RB", team: "TEN", opp: "NYJ", pick: "Rush Yards",  line: "O 68.5", odds: "-118", edge: "+5%",  score: 66, grade: "B",  pill: { label: "DvP Rec Yds #6/32",  tone: "blue"  } },
];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function hex2rgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return `rgba(245,158,11,${a})`;
  const r = parseInt(c.slice(0,2), 16), g = parseInt(c.slice(2,4), 16), b = parseInt(c.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function teamColor(code?: string | null) {
  return TEAM_PRIMARY[code?.toUpperCase() ?? ""] ?? B.orange;
}
function gradeTone(grade?: string | null) {
  if (!grade) return "bg-white/5 text-slate-200 ring-white/10";
  if (grade.startsWith("A")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40";
  if (grade.startsWith("B")) return "bg-sky-500/15 text-sky-200 ring-sky-400/40";
  if (grade.startsWith("C")) return "bg-amber-500/15 text-amber-200 ring-amber-400/40";
  return "bg-rose-500/15 text-rose-200 ring-rose-400/40";
}

/* ─── Small components ──────────────────────────────────────────────────────── */
function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: B.muted }}>
      {children}
    </p>
  );
}

function Chip({
  children,
  tone = "orange",
}: {
  children: ReactNode;
  tone?: "orange" | "green" | "teal" | "blue" | "muted";
}) {
  const s: Record<string, React.CSSProperties> = {
    orange: { borderColor: "rgba(255,138,0,.4)",  background: "rgba(255,138,0,.09)",  color: B.orange2 },
    green:  { borderColor: "rgba(23,212,138,.4)", background: "rgba(23,212,138,.09)", color: B.green  },
    teal:   { borderColor: "rgba(25,199,195,.4)", background: "rgba(25,199,195,.09)", color: B.teal   },
    blue:   { borderColor: "rgba(90,160,255,.4)", background: "rgba(90,160,255,.09)", color: "#5aa0ff"},
    muted:  { borderColor: "rgba(255,255,255,.12)",background: "rgba(255,255,255,.05)",color: "rgba(255,255,255,.7)"},
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium" style={s[tone]}>
      {children}
    </span>
  );
}

function PickCard({ pick }: { pick: typeof PICKS[number] }) {
  const primary = teamColor(pick.team);
  const opp     = teamColor(pick.opp);
  return (
    <div
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border px-4 py-3"
      style={{
        background: `linear-gradient(135deg, ${hex2rgba(primary,.20)} 0%, ${hex2rgba(primary,.10)} 40%, rgba(3,3,7,.88) 100%)`,
        borderColor: hex2rgba(primary,.45),
        boxShadow: `inset 0 1px 0 ${hex2rgba(primary,.50)}`,
      }}
    >
      {/* Left glow */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16"
        style={{ background: `linear-gradient(90deg, ${hex2rgba(primary,.30)} 0%, transparent 100%)` }} />

      <div className="relative z-10 min-w-0">
        {/* Player + team */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full border"
            style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(0,0,0,.28)", color: B.orange2 }}>
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-100">
              {pick.player}
              <span className="ml-2 text-[11px] font-normal text-slate-400">
                {pick.pos} · {pick.team}
                {TEAM_LOGO[pick.team] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={TEAM_LOGO[pick.team]} alt={pick.team} className="ml-1 inline h-4 w-4 object-contain" />
                )}
              </span>
            </p>
            <p className="text-[11px] text-slate-400">
              vs {pick.opp} · {pick.pick} {pick.line}{" "}
              <span className="text-amber-200">{pick.odds}</span>
            </p>
          </div>
        </div>

        {/* Pills */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">Edge {pick.edge}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">Score {pick.score}</span>
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-slate-100"
            style={{ background: hex2rgba(opp,.15), borderColor: hex2rgba(opp,.25) }}>
            {TEAM_LOGO[pick.opp] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={TEAM_LOGO[pick.opp]} alt={pick.opp} className="h-3 w-3 object-contain" />
            )}
            {pick.pill.label}
          </span>
        </div>
      </div>

      {/* Grade */}
      <span className={`relative z-10 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${gradeTone(pick.grade)}`}>
        {pick.grade}
      </span>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function Home() {
  const [open, setOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Background layers ──────────────────────────────────────────────── */}
      {/* 1. Base dark color */}
      <div className="fixed inset-0 -z-30" style={{ background: B.bg }} />
      {/* 2. Dot grid */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      {/* 3. Gradient color blobs */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            `radial-gradient(800px 500px at 20% -5%, rgba(255,138,0,.20) 0%, transparent 60%),` +
            `radial-gradient(700px 500px at 80% 5%, rgba(25,199,195,.13) 0%, transparent 60%),` +
            `radial-gradient(600px 400px at 50% 100%, rgba(255,61,87,.07) 0%, transparent 60%)`,
        }}
      />
      {/* 4. Noise grain overlay */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
        }}
      />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 px-4 pt-4">
        <header
          className="mx-auto max-w-5xl rounded-2xl backdrop-blur-xl"
          style={{
            background: "rgba(8,8,14,.80)",
            border: "1px solid rgba(255,255,255,.10)",
            boxShadow: "0 0 0 1px rgba(255,138,0,.08), 0 8px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <BetalyzeLogo height={28} />
            </Link>

            {/* Desktop nav — pill style */}
            <nav
              className="hidden items-center gap-0.5 rounded-xl p-1 md:flex"
              style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}
            >
              {[{ label: "Produit", href: "#product" }, { label: "Tarifs", href: "#pricing" }, { label: "FAQ", href: "#faq" }].map((n) => (
                <a key={n.href} href={n.href}
                  className="rounded-lg px-4 py-1.5 text-[12px] font-medium transition hover:bg-white/[0.07]"
                  style={{ color: "rgba(255,255,255,.55)" }}>
                  {n.label}
                </a>
              ))}
            </nav>

            {/* CTA group */}
            <div className="flex items-center gap-2">
              <Link href="/account"
                className="hidden text-[12px] font-medium transition hover:text-white md:inline-flex"
                style={{ color: "rgba(255,255,255,.45)" }}>
                Se connecter
              </Link>
              <Link href="/account?mode=register"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-black transition hover:brightness-105"
                style={{
                  background: "linear-gradient(90deg,#ff8a00,#ffb14a)",
                  boxShadow: "0 0 18px rgba(255,138,0,.35), inset 0 1px 0 rgba(255,255,255,.25)",
                }}>
                Commencer
                <ArrowRight className="h-3 w-3" />
              </Link>
              <button onClick={() => setOpen(true)}
                className="rounded-xl border p-1.5 transition hover:bg-white/5 md:hidden"
                style={{ borderColor: B.line, color: B.text }} aria-label="Menu">
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile drawer */}
          {open && (
            <div className="border-t md:hidden" style={{ borderColor: B.line }}>
              <div className="space-y-1 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: B.muted }}>Menu</span>
                  <button onClick={() => setOpen(false)} className="rounded-lg border p-1.5 transition hover:bg-white/5"
                    style={{ borderColor: B.line, color: B.text }} aria-label="Fermer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {[{ label: "Produit", href: "#product" }, { label: "Tarifs", href: "#pricing" }, { label: "FAQ", href: "#faq" }].map((n) => (
                  <a key={n.href} href={n.href} onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-white/5"
                    style={{ color: B.text }}>
                    {n.label}
                  </a>
                ))}
                <div className="pt-1">
                  <Link href="/account?mode=register"
                    className="block rounded-xl px-4 py-2.5 text-center text-sm font-bold text-black"
                    style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                    Commencer gratuitement
                  </Link>
                </div>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 md:pt-28">
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-8">

          {/* Left: text */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-4xl font-black leading-[1.06] tracking-[-0.03em] sm:text-5xl md:text-6xl"
              style={{ color: B.text }}
            >
              Arrête de deviner.
              <br />
              <span style={{
                backgroundImage: "linear-gradient(90deg,#ff8a00,#ffb14a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Commence à analyser.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed md:text-xl" style={{ color: B.muted }}>
              Forme récente, DvP, usage rate, contexte de match — tout en un seul endroit,
              avec un grade clair sur chaque prop.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row md:items-start">
              <Link href="/nba"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-black shadow-xl shadow-orange-500/20 transition hover:opacity-90"
                style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)" }}>
                Explorer les props
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing"
                className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition hover:bg-white/5"
                style={{ borderColor: B.line, color: B.text }}>
                Voir les tarifs
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs md:justify-start" style={{ color: B.muted }}>
              {["Aucune carte requise", "Props mis à jour en continu", "Grades F → A+"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: B.green }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: 3D arena */}
          <div className="relative hidden md:flex shrink-0 items-center justify-center">
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{ background: "radial-gradient(ellipse at center, rgba(255,138,0,.13) 0%, transparent 70%)" }}
            />
            <BasketballArena className="rounded-2xl" style={{ width: 440, height: 330 }} />
          </div>

        </div>
      </section>

      {/* ── Product preview ─────────────────────────────────────────────────── */}
      <section id="product" className="mx-auto max-w-5xl px-5 pb-24">
        <div className="relative">
          {/* Glow behind card */}
          <div className="pointer-events-none absolute -inset-6 rounded-3xl opacity-40"
            style={{ background: "radial-gradient(600px 400px at 50% 30%, rgba(255,138,0,.22) 0%, transparent 70%)" }} />

          <div
            className="relative rounded-3xl border p-5 shadow-[0_40px_100px_rgba(0,0,0,.65)] md:p-7"
            style={{
              background:
                "radial-gradient(1000px 350px at 10% 0%, rgba(255,138,0,.10) 0%, transparent 55%)," +
                `linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.02) 100%)`,
              borderColor: "rgba(255,255,255,.09)",
            }}
          >
            {/* Card header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Label>Ce soir · Best Props</Label>
                <p className="mt-1 text-sm font-semibold" style={{ color: B.text }}>Top picks simulés · Multi-sport</p>
              </div>
              <Chip tone="orange">
                <Trophy className="h-3.5 w-3.5" />
                Top 10
              </Chip>
            </div>

            {/* Picks */}
            <div className="grid gap-3">
              {PICKS.map((p) => <PickCard key={p.player} pick={p} />)}
            </div>

            {/* Footer fade */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-3xl"
              style={{ background: "linear-gradient(to top, rgba(5,5,8,.9), transparent)" }} />
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div
          className="grid grid-cols-1 divide-y rounded-2xl border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          style={{ borderColor: B.line, divideColor: B.line, background: B.panel }}
        >
          {[
            { value: "2 400+", label: "Props analysés / semaine", icon: <BarChart3 className="h-5 w-5" style={{ color: B.orange2 }} /> },
            { value: "NBA · NFL",  label: "Sports couverts",           icon: <Trophy    className="h-5 w-5" style={{ color: B.teal   }} /> },
            { value: "F → A+",    label: "Système de grades clair",    icon: <TrendingUp className="h-5 w-5" style={{ color: B.green  }} /> },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4 px-7 py-6">
              {s.icon}
              <div>
                <p className="text-xl font-black" style={{ color: B.text }}>{s.value}</p>
                <p className="text-xs" style={{ color: B.muted }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-28">
        <div className="mb-12 text-center">
          <Label>Comment ça marche</Label>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
            3 étapes. Un seul edge.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01", icon: <Sparkles className="h-5 w-5" />, color: B.orange2,
              title: "Scanner",
              desc: "Parcours les top props du soir avec leurs grades A+ → F et leur edge calculé.",
            },
            {
              step: "02", icon: <Shield className="h-5 w-5" />, color: B.teal,
              title: "Analyser",
              desc: "Compare le DvP, la tendance L10, l'usage rate et le contexte matchup.",
            },
            {
              step: "03", icon: <Zap className="h-5 w-5" />, color: B.green,
              title: "Décider",
              desc: "Choisis les picks avec le signal le plus fort. Sans bruit. Sans hesitation.",
            },
          ].map((s, i) => (
            <div
              key={s.step}
              className="rounded-2xl border p-6"
              style={{
                borderColor: B.line,
                background: `radial-gradient(500px 300px at ${i === 0 ? "0%" : i === 1 ? "50%" : "100%"} 0%, rgba(255,255,255,.04) 0%, transparent 70%),${B.panel}`,
              }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border"
                  style={{ borderColor: `${s.color}40`, background: `${s.color}12`, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-xs font-bold" style={{ color: B.muted }}>Étape {s.step}</span>
              </div>
              <h3 className="text-base font-bold" style={{ color: B.text }}>{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: B.muted }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bet Journal ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-28">
        <div className="grid items-center gap-10 md:grid-cols-2">

          {/* Left — pitch */}
          <div>
            <Label>Bet Journal</Label>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
              Suis chaque pick.<br />Vois ton edge évoluer.
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: B.muted }}>
              Enregistre chaque mise, track tes résultats et analyse ta progression dans le temps. Win rate, ROI, unités gagnées — tout est calculé automatiquement.
            </p>

            <ul className="mt-7 space-y-3">
              {[
                { icon: <CheckCircle2 className="h-4 w-4" style={{ color: B.green }} />, text: "Historique complet de tes paris" },
                { icon: <CheckCircle2 className="h-4 w-4" style={{ color: B.green }} />, text: "Win rate & ROI calculés en temps réel" },
                { icon: <CheckCircle2 className="h-4 w-4" style={{ color: B.green }} />, text: "Filtres par sport, joueur, grade" },
                { icon: <CheckCircle2 className="h-4 w-4" style={{ color: B.green }} />, text: "Identifie tes forces et points faibles" },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,.78)" }}>
                  {item.icon}
                  {item.text}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link href="/account?mode=register"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:brightness-105"
                style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)", boxShadow: "0 0 18px rgba(255,138,0,.25)" }}>
                Commencer à tracker
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right — mock journal UI */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: "radial-gradient(700px 300px at 80% 0%, rgba(255,138,0,.10) 0%, transparent 60%), rgba(255,255,255,.03)",
              borderColor: "rgba(255,255,255,.09)",
              boxShadow: "0 30px 80px rgba(0,0,0,.55)",
            }}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: B.text }}>Mon Journal</p>
                <p className="text-[11px]" style={{ color: B.muted }}>Saison 2025–2026 · NBA</p>
              </div>
              <Chip tone="green">+8.5u ce mois</Chip>
            </div>

            {/* Stats row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { label: "Win Rate", value: "62%", color: B.green },
                { label: "ROI",      value: "+14.2%", color: B.green },
                { label: "Picks",    value: "34",    color: B.orange2 },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border px-3 py-2.5 text-center"
                  style={{ borderColor: B.line, background: "rgba(0,0,0,.20)" }}>
                  <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px]" style={{ color: B.muted }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Journal rows */}
            <div className="space-y-1.5">
              {[
                { player: "Ja'Marr Chase",  pick: "Rec Yds O 82.5", grade: "A+", result: "WIN",  pnl: "+$45", sport: "NFL" },
                { player: "Travis Kelce",   pick: "Rec O 4.5",       grade: "A",  result: "WIN",  pnl: "+$28", sport: "NFL" },
                { player: "Nikola Jokić",   pick: "PRA O 52.5",      grade: "A+", result: "WIN",  pnl: "+$60", sport: "NBA" },
                { player: "Brock Purdy",    pick: "Pass Yds O 238.5",grade: "B+", result: "LOSS", pnl: "−$20", sport: "NFL" },
                { player: "Luka Dončić",    pick: "Pts O 33.5",      grade: "A",  result: "WIN",  pnl: "+$35", sport: "NBA" },
              ].map((row, i) => {
                const isWin = row.result === "WIN";
                return (
                  <div key={i}
                    className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                    style={{ borderColor: B.line, background: "rgba(0,0,0,.18)" }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Result dot */}
                      <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: isWin ? B.green : B.red }} />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold" style={{ color: B.text }}>{row.player}</p>
                        <p className="text-[10px]" style={{ color: B.muted }}>{row.pick} · {row.sport}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ring-1 ${gradeTone(row.grade)}`}>
                        {row.grade}
                      </span>
                      <span className="text-[12px] font-bold w-12 text-right"
                        style={{ color: isWin ? B.green : B.red }}>
                        {row.pnl}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Blur CTA overlay at bottom */}
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-x-0 -top-8 h-10 rounded-b-xl"
                style={{ background: "linear-gradient(to bottom, transparent, rgba(5,5,8,.95))" }} />
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-semibold transition hover:bg-white/5 cursor-pointer"
                style={{ borderColor: B.line, color: B.muted }}>
                <Lock className="h-3.5 w-3.5" />
                Connecte-toi pour voir ton journal complet
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-28">
        <div className="mb-12 text-center">
          <Label>Témoignages</Label>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
            Ils ont changé leur façon de parier.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Marc-Antoine L.",
              handle: "Parieur NBA · Montréal",
              initials: "ML",
              color: B.orange,
              quote: "Avant Betalyze je passais 2h à chercher les stats. Maintenant j'ai tout en 10 minutes — grades, DvP, tendances. C'est un game changer.",
            },
            {
              name: "Jonathan R.",
              handle: "Parieur NFL · Québec",
              initials: "JR",
              color: B.teal,
              quote: "Le système de grades est exactement ce qu'il me fallait. Je ne mise plus au feeling, j'ai un vrai signal derrière chaque pick.",
            },
            {
              name: "Sébastien T.",
              handle: "Parieur multi-sport · Toronto",
              initials: "ST",
              color: B.green,
              quote: "La section DvP m'a ouvert les yeux sur des edges que je ne voyais pas du tout. Mon win rate a monté dès la première semaine.",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border p-6"
              style={{ borderColor: B.line, background: B.panel }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" style={{ color: B.orange2 }} />
                ))}
              </div>

              {/* Quote */}
              <p className="flex-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-5 flex items-center gap-3 border-t pt-5" style={{ borderColor: B.line }}>
                <div
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[11px] font-black"
                  style={{ background: hex2rgba(t.color, 0.18), color: t.color, border: `1px solid ${hex2rgba(t.color, 0.35)}` }}
                >
                  {t.initials}
                </div>
                <div className="leading-none">
                  <p className="text-[13px] font-semibold" style={{ color: B.text }}>{t.name}</p>
                  <p className="mt-1 text-[11px]" style={{ color: B.muted }}>{t.handle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-5xl px-5 pb-28">
        <div className="mb-12 text-center">
          <Label>Tarifs</Label>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
            Simple. Transparent.
          </h2>
          <p className="mt-3 text-sm" style={{ color: B.muted }}>Sans engagement. Sans surprise.</p>
        </div>

        <div className="grid items-start gap-4 md:grid-cols-3 md:gap-5">
          {/* Free */}
          <div className="rounded-2xl border p-6" style={{ borderColor: B.line, background: B.panel }}>
            <p className="text-sm font-bold" style={{ color: B.text }}>Gratuit</p>
            <p className="text-[11px] mt-0.5" style={{ color: B.muted }}>Découverte</p>
            <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>0 $</p>
            <p className="text-xs" style={{ color: B.muted }}>/ mois</p>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
              {["Aperçu Best Props (limité)", "DvP en lecture", "Pages joueurs basiques"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: B.green }} />
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

          {/* Pro – highlighted */}
          <div className="relative overflow-hidden rounded-2xl border p-6 shadow-[0_30px_80px_rgba(255,138,0,.18)] md:-translate-y-2"
            style={{
              borderColor: "rgba(255,138,0,.55)",
              background:
                "radial-gradient(800px 300px at 50% 0%, rgba(255,138,0,.22) 0%, transparent 60%)," +
                "linear-gradient(180deg, rgba(255,138,0,.14) 0%, rgba(255,255,255,.04) 100%)",
            }}>
            {/* Top glow line */}
            <div className="absolute inset-x-8 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,138,0,.9), transparent)" }} />
            <div className="absolute -top-10 right-4 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: B.text }}>Pro — NBA</p>
                <p className="text-[11px] mt-0.5" style={{ color: B.muted }}>Le plus populaire</p>
              </div>
              <Chip tone="orange">Populaire</Chip>
            </div>
            <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>7,99 $</p>
            <p className="text-xs" style={{ color: B.muted }}>/ mois</p>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.85)" }}>
              {[
                "Tous les modules NBA",
                "Best Props Weekly complet",
                "Pages joueurs + logs",
                "DvP + Matchups",
                "Betalyze Score",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: B.green }} />
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

          {/* All Sports – coming soon */}
          <div className="relative overflow-hidden rounded-2xl border p-6"
            style={{ borderColor: B.line, background: B.panel }}>
            <div className="pointer-events-none select-none opacity-25">
              <p className="text-sm font-bold" style={{ color: B.text }}>All Sports</p>
              <p className="text-[11px] mt-0.5" style={{ color: B.muted }}>NBA + NFL + NHL</p>
              <p className="mt-5 text-4xl font-black" style={{ color: B.text }}>12,99 $</p>
              <p className="text-xs" style={{ color: B.muted }}>/ mois</p>
              <ul className="mt-6 space-y-2.5 text-sm" style={{ color: "rgba(255,255,255,.75)" }}>
                {["Tous les modules", "Multi-sport", "Best Props tous sports", "DvP + Matchups"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: B.green }} />
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
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-28">
        <div className="mb-12 text-center">
          <Label>FAQ</Label>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl" style={{ color: B.text }}>
            Questions fréquentes
          </h2>
        </div>

        <div className="space-y-2">
          {[
            {
              q: "C'est quoi exactement le plan gratuit ?",
              a: "Le plan gratuit te donne accès à un aperçu limité des Best Props, la lecture des données DvP et des pages joueurs basiques. Pas de grades complets, pas d'alertes. Parfait pour tester l'outil avant de passer au Pro.",
            },
            {
              q: "Le plan Pro couvre NBA et NFL ?",
              a: "Le plan Pro NBA couvre uniquement la NBA — tous les modules, grades complets, DvP, logs et Betalyze Score. Un plan NFL est en développement. L'offre All Sports (NBA + NFL + NHL) arrive bientôt.",
            },
            {
              q: "D'où viennent les données ?",
              a: "Betalyze agrège les données de plusieurs APIs sportives spécialisées et les cotes en temps réel de bookmakers reconnus. Les données sont mises à jour en continu pendant la saison.",
            },
            {
              q: "Est-ce que je peux annuler à tout moment ?",
              a: "Oui, sans engagement. Tu peux annuler ton abonnement à tout moment depuis ton compte. Tu gardes l'accès Pro jusqu'à la fin de la période payée.",
            },
            {
              q: "Le Betalyze Score, c'est quoi exactement ?",
              a: "C'est un score de 0 à 100 calculé sur 5 facteurs : forme récente (40%), qualité du matchup (30%), volatilité (10%), opportunité comme l'usage rate (10%) et le flow du match attendu (10%). Un grade A+ = signal fort, F = éviter.",
            },
            {
              q: "Betalyze garantit-il des gains ?",
              a: "Non, et personne ne devrait. Betalyze est un outil d'analyse — il t'aide à prendre de meilleures décisions avec les données, pas à gagner à coup sûr. Parie de façon responsable.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border transition-colors"
              style={{ borderColor: faqOpen === i ? "rgba(255,138,0,.30)" : B.line, background: faqOpen === i ? "rgba(255,138,0,.05)" : B.panel }}
            >
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              >
                <span className="pr-4 text-sm font-semibold" style={{ color: B.text }}>{item.q}</span>
                <ChevronDown
                  className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
                  style={{ color: B.muted, transform: faqOpen === i ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {faqOpen === i && (
                <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: B.line }}>
                  <p className="text-sm leading-relaxed" style={{ color: B.muted }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div
          className="relative overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background:
              "radial-gradient(900px 400px at 50% 0%, rgba(255,138,0,.30) 0%, transparent 65%)," +
              "linear-gradient(180deg, rgba(255,138,0,.16) 0%, rgba(255,255,255,.03) 100%)",
            border: "1px solid rgba(255,138,0,.35)",
          }}
        >
          <div className="absolute -top-16 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-orange-400/15 blur-3xl" />
          <h2 className="relative text-3xl font-black tracking-tight md:text-5xl" style={{ color: B.text }}>
            Prêt à avoir un vrai edge ?
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-base" style={{ color: B.muted }}>
            Rejoins Betalyze. Aucune carte requise pour commencer.
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
              Voir l'app NBA
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{ borderColor: B.line }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs sm:flex-row"
          style={{ color: B.muted }}>
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
