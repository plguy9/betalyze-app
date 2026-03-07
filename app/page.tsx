"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  LayoutGrid,
  LineChart,
  Lock,
  Menu,
  Shield,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";

const BRAND = {
  bg: "#050508",
  panel: "rgba(255,255,255,0.04)",
  panel2: "rgba(255,255,255,0.06)",
  line: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.62)",
  orange: "#ff8a00",
  orange2: "#ffb14a",
  green: "#17d48a",
  teal: "#19c7c3",
  red: "#ff3d57",
  blue: "#5aa0ff",
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
  LA: "#003594",
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

const TEAM_LOGO_BY_CODE: Record<string, string> = {
  ARI: "https://media.api-sports.io/american-football/teams/1.png",
  ATL: "https://media.api-sports.io/american-football/teams/2.png",
  BAL: "https://media.api-sports.io/american-football/teams/3.png",
  BUF: "https://media.api-sports.io/american-football/teams/20.png",
  CAR: "https://media.api-sports.io/american-football/teams/4.png",
  CHI: "https://media.api-sports.io/american-football/teams/16.png",
  CIN: "https://media.api-sports.io/american-football/teams/5.png",
  CLE: "https://media.api-sports.io/american-football/teams/6.png",
  DAL: "https://media.api-sports.io/american-football/teams/29.png",
  DEN: "https://media.api-sports.io/american-football/teams/28.png",
  DET: "https://media.api-sports.io/american-football/teams/7.png",
  GB: "https://media.api-sports.io/american-football/teams/8.png",
  HOU: "https://media.api-sports.io/american-football/teams/34.png",
  IND: "https://media.api-sports.io/american-football/teams/9.png",
  JAX: "https://media.api-sports.io/american-football/teams/10.png",
  KC: "https://media.api-sports.io/american-football/teams/11.png",
  LV: "https://media.api-sports.io/american-football/teams/13.png",
  LAC: "https://media.api-sports.io/american-football/teams/30.png",
  LAR: "https://media.api-sports.io/american-football/teams/31.png",
  LA: "https://media.api-sports.io/american-football/teams/31.png",
  MIA: "https://media.api-sports.io/american-football/teams/15.png",
  MIN: "https://media.api-sports.io/american-football/teams/17.png",
  NE: "https://media.api-sports.io/american-football/teams/18.png",
  NO: "https://media.api-sports.io/american-football/teams/19.png",
  NYG: "https://media.api-sports.io/american-football/teams/21.png",
  NYJ: "https://media.api-sports.io/american-football/teams/13.png",
  PHI: "https://media.api-sports.io/american-football/teams/24.png",
  PIT: "https://media.api-sports.io/american-football/teams/25.png",
  SF: "https://media.api-sports.io/american-football/teams/14.png",
  SEA: "https://media.api-sports.io/american-football/teams/23.png",
  TB: "https://media.api-sports.io/american-football/teams/27.png",
  TEN: "https://media.api-sports.io/american-football/teams/26.png",
  WAS: "https://media.api-sports.io/american-football/teams/32.png",
};

const NAV = [
  { id: "products", label: "Produits", href: "#products" },
  { id: "how", label: "Comment ca marche", href: "#how" },
  { id: "pricing", label: "Pricing", href: "#pricing" },
  { id: "resources", label: "Ressources", href: "#resources" },
];

const PRODUCTS = [
  {
    label: "Props",
    desc: "Top props + grades, edge et raisons.",
    href: "/nfl?section=players",
    icon: Sparkles,
  },
  {
    label: "Matchups",
    desc: "Contexte de match, rythme et blessures.",
    href: "/nfl?section=equipes",
    icon: Flame,
  },
  {
    label: "Defense vs Position",
    desc: "Classements DvP et splits (L10/L5, home/away).",
    href: "/nfl?section=defense",
    icon: Shield,
  },
  {
    label: "Page joueur",
    desc: "Logs, tendances, props et resume sticky.",
    href: "/nfl/players/1",
    icon: LineChart,
  },
];

const MOCK_PICKS = [
  {
    player: "Christian McCaffrey",
    team: "SF",
    opp: "SEA",
    pos: "RB",
    pick: "Rush Yds",
    line: "87.5",
    odds: "@ 1.88",
    grade: "A+",
    edge: "+21.4%",
    score: 94,
    matchup: "vs SEA",
    pill: { label: "DvP Rush Yds #26/32", tone: "blue" },
    tone: "red",
  },
  {
    player: "Josh Allen",
    team: "BUF",
    opp: "DEN",
    pos: "QB",
    pick: "Pass TD",
    line: "1.5",
    odds: "@ 1.76",
    grade: "A",
    edge: "+14.2%",
    score: 86,
    matchup: "vs DEN",
    pill: { label: "DvP Pass TD #22/32", tone: "blue" },
    tone: "blue",
  },
  {
    player: "Caleb Williams",
    team: "CHI",
    opp: "LAR",
    pos: "QB",
    pick: "Pass Yds",
    line: "238.5",
    odds: "@ 1.90",
    grade: "B+",
    edge: "+9.4%",
    score: 78,
    matchup: "vs LAR",
    pill: { label: "DvP Pass Yds #18/32", tone: "blue" },
    tone: "blue",
  },
  {
    player: "CeeDee Lamb",
    team: "DAL",
    opp: "NYJ",
    pos: "WR",
    pick: "Rec Yds",
    line: "79.5",
    odds: "@ 1.91",
    grade: "C+",
    edge: "+3.2%",
    score: 66,
    matchup: "vs NYJ",
    pill: { label: "DvP Rec Yds #6/32", tone: "blue" },
    tone: "blue",
  },
];

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return `rgba(245, 158, 11, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getTeamPrimaryColor(code?: string | null) {
  const key = code?.toUpperCase();
  if (key && TEAM_PRIMARY_BY_CODE[key]) return TEAM_PRIMARY_BY_CODE[key];
  return BRAND.orange;
}

function gradeTone(grade: string | null | undefined) {
  if (!grade) return "bg-white/5 text-slate-200 ring-white/10";
  if (grade.startsWith("A")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40";
  if (grade.startsWith("B")) return "bg-sky-500/15 text-sky-200 ring-sky-400/40";
  if (grade.startsWith("C")) return "bg-amber-500/15 text-amber-200 ring-amber-400/40";
  if (grade.startsWith("D")) return "bg-rose-500/15 text-rose-200 ring-rose-400/40";
  return "bg-rose-600/25 text-rose-100 ring-rose-400/40";
}

function Badge({
  children,
  tone = "orange",
}: {
  children: ReactNode;
  tone?: "orange" | "green" | "teal" | "red" | "muted" | "blue";
}) {
  const stylesByTone: Record<string, React.CSSProperties> = {
    orange: {
      borderColor: "rgba(255,138,0,0.45)",
      background: "rgba(255,138,0,0.10)",
      color: BRAND.orange2,
    },
    green: {
      borderColor: "rgba(23,212,138,0.45)",
      background: "rgba(23,212,138,0.10)",
      color: BRAND.green,
    },
    teal: {
      borderColor: "rgba(25,199,195,0.45)",
      background: "rgba(25,199,195,0.10)",
      color: BRAND.teal,
    },
    red: {
      borderColor: "rgba(255,61,87,0.45)",
      background: "rgba(255,61,87,0.10)",
      color: BRAND.red,
    },
    blue: {
      borderColor: "rgba(90,160,255,0.45)",
      background: "rgba(90,160,255,0.10)",
      color: BRAND.blue,
    },
    muted: {
      borderColor: "rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.72)",
    },
  };

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
      style={stylesByTone[tone]}
    >
      {children}
    </span>
  );
}

function PrimaryButton({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-black shadow-lg transition hover:opacity-95"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,138,0,1) 0%, rgba(255,177,74,1) 100%)",
      }}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function SecondaryButton({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
      style={{ borderColor: BRAND.line, color: BRAND.text }}
    >
      {children}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_70px_rgba(0,0,0,0.55)]",
        className,
      )}
      style={{
        background:
          "radial-gradient(1200px 400px at 10% 0%, rgba(255,138,0,0.10) 0%, rgba(0,0,0,0.0) 55%)," +
          "radial-gradient(1000px 600px at 90% 10%, rgba(25,199,195,0.08) 0%, rgba(0,0,0,0.0) 60%)," +
          `linear-gradient(180deg, ${BRAND.panel} 0%, rgba(255,255,255,0.03) 100%)`,
        borderColor: BRAND.line,
      }}
    >
      {children}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone = "orange",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "orange" | "green" | "teal";
}) {
  const toneStyle =
    tone === "orange"
      ? { borderColor: "rgba(255,138,0,0.35)", background: "rgba(255,138,0,0.10)" }
      : tone === "green"
        ? { borderColor: "rgba(23,212,138,0.35)", background: "rgba(23,212,138,0.10)" }
        : { borderColor: "rgba(25,199,195,0.35)", background: "rgba(25,199,195,0.10)" };

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ ...toneStyle, color: BRAND.text }}
    >
      <div
        className="grid h-10 w-10 place-items-center rounded-xl border"
        style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.20)" }}
      >
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-[11px]" style={{ color: BRAND.muted }}>
          {label}
        </div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function PickCard({ pick }: { pick: (typeof MOCK_PICKS)[number] }) {
  const teamLabel = pick.team;
  const oppLabel = pick.opp ?? pick.matchup.replace("vs", "").trim();
  const teamLogo = TEAM_LOGO_BY_CODE[teamLabel];
  const oppLogo = TEAM_LOGO_BY_CODE[oppLabel];
  const primary = getTeamPrimaryColor(teamLabel);
  const primarySoft = hexToRgba(primary, 0.22);
  const primaryMid = hexToRgba(primary, 0.12);
  const primaryLine = hexToRgba(primary, 0.55);
  const oppPrimary = getTeamPrimaryColor(oppLabel);
  const oppChipBg = hexToRgba(oppPrimary, 0.18);
  const oppChipRing = hexToRgba(oppPrimary, 0.28);

  return (
    <div
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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.30)",
              color: BRAND.orange2,
            }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-100">
              {pick.player}
              <span className="ml-2 text-[11px] text-slate-400">
                {pick.pos} · {teamLabel}
                {teamLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teamLogo}
                    alt={teamLabel}
                    className="ml-1 inline h-4 w-4 object-contain"
                  />
                )}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              vs {oppLabel} · {pick.pick} {pick.line}{" "}
              <span className="text-amber-200">{pick.odds}</span>
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span className="rounded-full bg-white/5 px-2 py-0.5">
            Edge {pick.edge}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5">
            Score {pick.score}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-slate-100"
            style={{ backgroundColor: oppChipBg, borderColor: oppChipRing }}
          >
            {oppLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={oppLogo} alt={oppLabel} className="h-3.5 w-3.5 object-contain" />
            )}
            {pick.pill.label}
          </span>
        </div>
      </div>
      <span
        className={`relative z-10 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${gradeTone(
          pick.grade,
        )}`}
      >
        {pick.grade}
      </span>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(900px 500px at 15% -10%, rgba(255,138,0,0.20) 0%, rgba(0,0,0,0) 55%)," +
          "radial-gradient(800px 500px at 80% 0%, rgba(25,199,195,0.14) 0%, rgba(0,0,0,0) 60%)," +
          "radial-gradient(900px 600px at 60% 110%, rgba(255,61,87,0.10) 0%, rgba(0,0,0,0) 55%)," +
          `linear-gradient(180deg, ${BRAND.bg} 0%, #070610 70%, #050508 100%)`,
      }}
    >
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,5,8,0.55)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl border"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.12) 100%)",
              }}
            >
              <span className="text-sm font-black" style={{ color: BRAND.orange2 }}>
                BZ
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                Betalyze
              </div>
              <div className="text-[11px]" style={{ color: BRAND.muted }}>
                Better picks. Cleaner insights.
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="rounded-full px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
                style={{ color: BRAND.muted }}
              >
                {item.label}
              </a>
            ))}

            <Link
              href="#app-preview"
              className="rounded-full border px-3 py-2 text-xs font-semibold transition hover:bg-white/5"
              style={{ borderColor: "rgba(255,138,0,0.35)", color: BRAND.text, background: "rgba(255,138,0,0.08)" }}
            >
              Ouvrir l'app
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="hidden rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-white/5 md:inline-flex"
              style={{ borderColor: BRAND.line, color: BRAND.text }}
            >
              Se connecter
            </Link>
            <Link
              href="/account?mode=register"
              className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-black shadow transition hover:opacity-95 md:inline-flex"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,138,0,1) 0%, rgba(255,177,74,1) 100%)",
              }}
            >
              Creer un compte
            </Link>

            <button
              onClick={() => setMenuOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border p-2 transition hover:bg-white/5 md:hidden"
              style={{ borderColor: BRAND.line, color: BRAND.text }}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden">
            <div className="mx-auto max-w-6xl px-4 pb-4">
              <div
                className="mt-3 rounded-2xl border p-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.22)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                    Menu
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                    className="rounded-xl border p-2"
                    style={{ borderColor: BRAND.line, color: BRAND.text }}
                    aria-label="Fermer le menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  {NAV.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      className="rounded-xl border px-3 py-3 text-sm font-semibold"
                      style={{ borderColor: BRAND.line, color: BRAND.text, background: "rgba(255,255,255,0.04)" }}
                    >
                      {item.label}
                    </a>
                  ))}

                  <Link
                    href="#app-preview"
                    className="rounded-xl px-3 py-3 text-sm font-semibold text-black"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,138,0,1) 0%, rgba(255,177,74,1) 100%)",
                    }}
                  >
                    Ouvrir l'app
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/account"
                      className="rounded-xl border px-3 py-3 text-sm font-semibold"
                      style={{ borderColor: BRAND.line, color: BRAND.text, background: "rgba(0,0,0,0.18)" }}
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/account?mode=register"
                      className="rounded-xl px-3 py-3 text-center text-sm font-semibold text-black"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,138,0,1) 0%, rgba(255,177,74,1) 100%)",
                      }}
                    >
                      S'inscrire
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="orange">
                <Flame className="h-4 w-4" />
                Best Props • mis a jour en continu
              </Badge>
              <Badge tone="teal">
                <Shield className="h-4 w-4" />
                Data + contexte + matchup
              </Badge>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-[-0.03em] md:text-6xl" style={{ color: BRAND.text }}>
              Mets tes picks
              <span style={{ color: BRAND.orange2 }}> avec</span>
              <br />
              des insights qui comptent.
            </h1>

            <p className="mt-4 max-w-xl text-base md:text-lg" style={{ color: BRAND.muted }}>
              Betalyze te donne un edge clair: forme recente, DvP, usage, rythme et contexte de match —
              le tout dans une interface simple et rapide.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/nfl">Explorer les props</PrimaryButton>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <StatPill
                icon={<Zap className="h-4 w-4" style={{ color: BRAND.orange2 }} />}
                label="Edge prive"
                value="Top picks filtres"
                tone="orange"
              />
              <StatPill
                icon={<BarChart3 className="h-4 w-4" style={{ color: BRAND.green }} />}
                label="Score Betalyze"
                value="Grades F a A+"
                tone="green"
              />
              <StatPill
                icon={<LayoutGrid className="h-4 w-4" style={{ color: BRAND.teal }} />}
                label="Matchup IQ"
                value="DvP + stats clees"
                tone="teal"
              />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 text-xs" style={{ color: BRAND.muted }}>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.green }} />
                Probabilite et coherence
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.green }} />
                Comparaisons matchup
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.green }} />
                Logs clairs, style ESPN
              </span>
            </div>
          </div>

          <div id="app-preview" className="animate-rise-delay">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                    Apercu — Best Props Weekly
                  </div>
                  <div className="text-xs" style={{ color: BRAND.muted }}>
                    Top picks simules • Multi-sport
                  </div>
                </div>
                <Badge tone="orange">
                  <Trophy className="h-4 w-4" />
                  Top 10
                </Badge>
              </div>

              <div className="mt-4">
                <div className="grid gap-3">
                  {MOCK_PICKS.slice(0, 4).map((p) => (
                    <PickCard key={p.player + p.pick} pick={p} />
                  ))}
                </div>

                <div className="mt-4" />
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section id="products" className="mx-auto mt-12 max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Produits
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">
              Tout le workflow Betalyze, en un seul endroit.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Props, matchups et DvP relies pour decider vite, sans bruit.
            </p>
          </div>
          <Badge tone="orange">
            <Sparkles className="h-4 w-4" />
            Acces direct a l'app
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <GlassCard key={p.label}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.22)",
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: BRAND.orange2 }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                      {p.label}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                      {p.desc}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs" style={{ color: BRAND.muted }}>
                  <span>Disponible dans l'app NFL</span>
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold text-slate-100 transition hover:bg-white/5"
                    style={{ borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    Explorer <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      <section id="how" className="mx-auto mt-12 max-w-6xl px-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Scanner",
              desc: "Tu parcours les top props avec leurs grades et edge.",
              icon: Sparkles,
              tone: "orange",
            },
            {
              title: "Verifier",
              desc: "Tu compares le DvP, le contexte, la tendance L10.",
              icon: Shield,
              tone: "teal",
            },
            {
              title: "Decider",
              desc: "Tu choisis les picks avec le meilleur signal.",
              icon: Zap,
              tone: "green",
            },
          ].map((step, idx) => {
            const Icon = step.icon;
            return (
              <GlassCard key={step.title} className="animate-stagger" style={{ animationDelay: `${idx * 120}ms` }}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{
                      borderColor:
                        step.tone === "orange"
                          ? "rgba(255,138,0,0.35)"
                          : step.tone === "teal"
                            ? "rgba(25,199,195,0.35)"
                            : "rgba(23,212,138,0.35)",
                      background:
                        step.tone === "orange"
                          ? "rgba(255,138,0,0.10)"
                          : step.tone === "teal"
                            ? "rgba(25,199,195,0.10)"
                            : "rgba(23,212,138,0.10)",
                    }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{
                        color:
                          step.tone === "orange"
                            ? BRAND.orange2
                            : step.tone === "teal"
                              ? BRAND.teal
                              : BRAND.green,
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                      {step.title}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      <section id="research" className="mx-auto mt-10 max-w-6xl px-4">
        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                  Pourquoi Betalyze ?
                </div>
                <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                  Un flow simple: tu scans, tu valides, tu pick.
                </div>
              </div>
              <Badge tone="green">
                <Star className="h-4 w-4" />
                + rapide
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              {["Scanner les top props", "Comparer le matchup", "Valider avec les logs", "Exporter / tracker"].map(
                (t) => (
                  <div key={t} className="flex items-center gap-2 text-sm" style={{ color: BRAND.text }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: BRAND.green }} />
                    <span>{t}</span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="orange">Props</Badge>
              <Badge tone="teal">Matchups</Badge>
              <Badge tone="green">DvP</Badge>
              <Badge tone="muted">Logs</Badge>
              <Badge tone="muted">Heat Index</Badge>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                  Exemple d'experience
                </div>
                <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                  Une seule page = toutes les reponses.
                </div>
              </div>
              <Badge tone="orange">
                <Zap className="h-4 w-4" />
                UI premium
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              {[
                {
                  title: "Page joueur",
                  desc: "Logs + props + resume — sans scroller 10 fois.",
                  icon: <LineChart className="h-4 w-4" style={{ color: BRAND.orange2 }} />,
                },
                {
                  title: "Defense vs Position",
                  desc: "Tableau complet + filtres rapides (L10/L5, home/away).",
                  icon: <Shield className="h-4 w-4" style={{ color: BRAND.teal }} />,
                },
                {
                  title: "Best Props Weekly",
                  desc: "Top 10 prets a scanner — avec grades et raisons.",
                  icon: <Flame className="h-4 w-4" style={{ color: BRAND.green }} />,
                },
              ].map((x) => (
                <div
                  key={x.title}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                  style={{ borderColor: BRAND.line, background: "rgba(0,0,0,0.16)" }}
                >
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.22)" }}
                  >
                    {x.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                      {x.title}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                      {x.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      <section id="pricing" className="mx-auto mt-10 max-w-6xl px-4">
        <div className="rounded-3xl border border-white/10 bg-[#0b090f]/60 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Pricing
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-100">
                Choisis ton niveau d'acces.
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Des plans simples pour passer de l'analyse rapide a l'edge avance.
              </p>
            </div>
            <Badge tone="orange">
              <Trophy className="h-4 w-4" />
              Early access
            </Badge>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-[0_25px_70px_rgba(0,0,0,0.55)] md:order-1"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background:
                  "radial-gradient(700px 260px at 20% 0%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0) 55%)," +
                  "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Gratuit</div>
                  <div className="mt-1 text-xs text-slate-400">Decouverte</div>
                </div>
                <Badge tone="muted">Free</Badge>
              </div>
              <div className="mt-5 text-3xl font-semibold text-slate-100">0 $</div>
              <div className="text-xs text-slate-400">/ mois</div>
              <div className="mt-5 space-y-2 text-sm text-slate-300">
                {[
                  "Apercu Best Props (limite)",
                  "DvP + Matchups en lecture",
                  "Pages joueurs basiques",
                  "Pas d'alertes ni tracking",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="#app-preview"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Tester gratuitement
              </Link>
            </div>

            <div
              className="relative flex h-full -translate-y-3 flex-col overflow-hidden rounded-2xl border p-6 shadow-[0_35px_90px_rgba(0,0,0,0.65)] md:order-2 md:scale-[1.07]"
              style={{
                borderColor: "rgba(255,138,0,0.6)",
                background:
                  "radial-gradient(900px 320px at 20% 0%, rgba(255,138,0,0.30) 0%, rgba(0,0,0,0) 55%)," +
                  "linear-gradient(180deg, rgba(255,138,0,0.20) 0%, rgba(255,255,255,0.05) 100%)",
              }}
            >
              <div className="absolute -top-10 right-6 h-24 w-24 rounded-full bg-amber-400/25 blur-2xl" />
              <div
                className="absolute inset-x-6 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,138,0,0) 0%, rgba(255,138,0,0.95) 50%, rgba(255,138,0,0) 100%)",
                }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">NFL</div>
                  <div className="mt-1 text-xs text-slate-400">Focus saison NFL</div>
                </div>
                <Badge tone="orange">Populaire</Badge>
              </div>
              <div className="mt-5 text-3xl font-semibold text-slate-100">14,99 $</div>
              <div className="text-xs text-slate-400">/ mois</div>
              <div className="mt-5 space-y-2 text-sm text-slate-300">
                {[
                  "NFL uniquement",
                  "Tous les modules NFL",
                  "Best Props Weekly NFL",
                  "Pages joueurs completes",
                  "DvP + Matchups NFL",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="#app-preview"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-2 text-xs font-semibold text-black shadow-lg shadow-orange-500/30 transition hover:brightness-110"
              >
                Commencer NFL
              </Link>
            </div>

            <div
              className="relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_70px_rgba(0,0,0,0.55)] md:order-3"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background:
                  "radial-gradient(900px 300px at 20% 0%, rgba(25,199,195,0.18) 0%, rgba(0,0,0,0) 55%)," +
                  "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
              }}
            >
              <div className="pointer-events-none select-none blur-[14px] opacity-20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">All Sports</div>
                    <div className="mt-1 text-xs text-slate-400">NFL + NBA + NHL + MLB</div>
                  </div>
                  <Badge tone="teal">Premium</Badge>
                </div>
                <div className="mt-5 text-3xl font-semibold text-slate-100">24,99 $</div>
                <div className="text-xs text-slate-400">/ mois</div>
                <div className="mt-5 space-y-2 text-sm text-slate-300">
                  {[
                    "Tous les modules",
                    "Best Props multi-sport",
                    "Pages joueurs tous sports",
                    "Matchups et DvP multi-ligues",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200 shadow-[0_0_25px_rgba(0,0,0,0.6)]">
                  <Lock className="h-3.5 w-3.5 text-slate-300" />
                  A venir
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Plus tard (pas maintenant)</div>
                <p className="mt-1 text-xs text-slate-400">
                  Elite Add-On optionnel (+10 $/mois) : alertes, tracking, heat index.
                </p>
              </div>
              <Badge tone="muted">A venir</Badge>
            </div>
          </div>
        </div>
      </section>

      <section id="resources" className="mx-auto mt-10 max-w-6xl px-4 pb-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Analyses rapides",
              desc: "Un resume clair pour chaque prop.",
              icon: BarChart3,
            },
            {
              title: "Matchup radar",
              desc: "Defense vs position + splits.",
              icon: Shield,
            },
            {
              title: "Library",
              desc: "Glossaire des markets et methodes.",
              icon: LayoutGrid,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <GlassCard key={item.title} className="animate-stagger" style={{ animationDelay: `${idx * 120}ms` }}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.22)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: BRAND.orange2 }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BRAND.text }}>
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: BRAND.muted }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        <div
          className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 md:flex-row"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs" style={{ color: BRAND.muted }}>
            © {new Date().getFullYear()} Betalyze — UI mock
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-full border px-3 py-1 text-xs hover:bg-white/5"
              style={{ borderColor: BRAND.line, color: BRAND.muted }}
            >
              Produit
            </button>
            <button
              className="rounded-full border px-3 py-1 text-xs hover:bg-white/5"
              style={{ borderColor: BRAND.line, color: BRAND.muted }}
            >
              Ressources
            </button>
            <button
              className="rounded-full border px-3 py-1 text-xs hover:bg-white/5"
              style={{ borderColor: BRAND.line, color: BRAND.muted }}
            >
              Contact
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
