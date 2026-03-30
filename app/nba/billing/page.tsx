"use client";

import Link from "next/link";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import { useEffect, useRef, useState, Suspense, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Flame,
  HelpCircle,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
import { NbaHeader } from "@/app/nba/components/nba-header";
import { MobileBottomNav } from "@/app/nba/components/mobile-bottom-nav";

/* ── Types ── */

type AccountPayload = {
  id: number;
  email: string;
  displayName: string | null;
  createdAt: string | null;
  sessionExpiresAt: string | null;
};

type Plan = {
  id: "free" | "pro_nba" | "all_sports";
  name: string;
  subtitle: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  comingSoon: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    subtitle: "Découverte",
    price: "0 $",
    period: "/ mois",
    features: [
      "Aperçu Best Props (limité)",
      "DvP en lecture seule",
      "Pages joueurs basiques",
    ],
    highlighted: false,
    comingSoon: false,
    cta: "Plan actuel",
  },
  {
    id: "pro_nba",
    name: "Pro — NBA",
    subtitle: "Le plus populaire",
    price: "7,99 $",
    period: "/ mois",
    features: [
      "Tous les modules NBA",
      "Best Props complet + grades",
      "Pages joueurs + game logs",
      "DvP + Matchups avancés",
      "Betalyze Score",
      "Journal de paris illimité",
    ],
    highlighted: true,
    comingSoon: false,
    cta: "Passer à Pro",
  },
  {
    id: "all_sports",
    name: "All Sports",
    subtitle: "NBA + NFL + NHL",
    price: "12,99 $",
    period: "/ mois",
    features: [
      "Tous les modules multi-sport",
      "Best Props tous sports",
      "DvP + Matchups complets",
      "Alertes & notifications",
    ],
    highlighted: false,
    comingSoon: true,
    cta: "Bientôt disponible",
  },
];

/* ── Helpers ── */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(
      "rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl",
      className,
    )}>
      {children}
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

/* ── Page ── */

export default function NbaBillingPage() {
  return (
    <Suspense>
      <NbaBillingPageInner />
    </Suspense>
  );
}

function NbaBillingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("free");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const isPro = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const currentPlan: Plan["id"] = isPro ? "pro_nba" : "free";

  useEffect(() => {
    (async () => {
      try {
        // If coming back from Stripe checkout, fulfill the session directly
        const sessionId = searchParams.get("session_id");
        if (sessionId) {
          await fetch("/api/stripe/fulfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          // Clean URL
          router.replace("/nba/billing");
        }

        const res = await fetch("/api/account/settings", { cache: "no-store" });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (data.ok && data.account) setAccount(data.account);
        if (data.subscriptionStatus) setSubscriptionStatus(data.subscriptionStatus);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    };
  }, []);

  const handleUpgrade = async () => {
    try {
      setCheckoutLoading(true);
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // silent
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      // silent
    } finally {
      setPortalLoading(false);
    }
  };

  const handleComingSoon = (sport: string) => {
    setComingSoon(`${sport} arrive bientôt sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  const sidebarActive: NbaSidebarPage = "Billing";
  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Billing") return;
    if (page === "Settings") { router.push("/nba/settings"); return; }
    if (page === "Bet Journal") { router.push("/nba/journal"); return; }
    if (page === "Parlay") { router.push("/nba/parlay"); return; }
    if (page === "DvP") { router.push("/nba?section=defense#nba-dvp"); return; }
    if (page === "Teams") { router.push("/nba?section=equipes"); return; }
    if (page === "Best Props" || page === "Players") { router.push("/nba?section=players"); return; }
    router.push("/nba");
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
          {/* Coming soon toast */}
          {comingSoon && (
            <div className="mb-3 flex justify-end">
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
                {comingSoon}
              </span>
            </div>
          )}

          <main className="min-w-0 flex-1 space-y-4">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Billing</h1>
                <p className="mt-0.5 text-[13px] text-white/40">Abonnement & facturation · NBA</p>
              </div>
            </div>

            {/* Current plan banner */}
            <GlassCard className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Plan actuel</p>
                  {loading ? (
                    <div className="mt-2 h-6 w-32 animate-pulse rounded-full bg-white/[0.07]" />
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={cn(
                        "rounded-full border px-3 py-1 text-sm font-bold",
                        isPro
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                          : "border-white/15 bg-white/8 text-white/80"
                      )}>
                        {isPro ? "Pro — NBA" : "Gratuit"}
                      </span>
                      <span className="text-[11px] text-white/35">
                        {isPro ? (subscriptionStatus === "trialing" ? "Essai gratuit · 7 jours" : "7,99 $ / mois") : "0 $ / mois"}
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-white/40">
                    {isPro
                      ? "Accès complet à tous les modules NBA."
                      : "Accès limité — passe à Pro pour débloquer tous les modules NBA."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Actif
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Plans comparison */}
            <div className="grid gap-3 md:grid-cols-3">
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isHighlighted = plan.highlighted;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border p-5 transition",
                      isHighlighted
                        ? "border-amber-500/40 bg-gradient-to-b from-amber-500/[0.08] to-white/[0.03]"
                        : "border-white/10 bg-white/[0.035]",
                      plan.comingSoon && "opacity-50",
                    )}
                  >
                    {/* Highlight glow */}
                    {isHighlighted && (
                      <>
                        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
                        <div className="absolute -top-8 right-4 h-20 w-20 rounded-full bg-amber-400/15 blur-2xl" />
                      </>
                    )}

                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-white/90">{plan.name}</p>
                        <p className="text-[10px] text-white/40">{plan.subtitle}</p>
                      </div>
                      {isHighlighted && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                          Populaire
                        </span>
                      )}
                      {isCurrent && !isHighlighted && (
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[9px] font-bold text-white/50">
                          Actuel
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mt-4">
                      <span className="text-3xl font-black text-white/90">{plan.price}</span>
                      <span className="ml-1 text-xs text-white/40">{plan.period}</span>
                    </div>

                    {/* Features */}
                    <ul className="mt-5 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[11px] text-white/65">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      type="button"
                      disabled={isCurrent || plan.comingSoon || checkoutLoading || portalLoading}
                      onClick={() => {
                        if (isCurrent && isPro) { void handlePortal(); return; }
                        if (plan.id === "pro_nba" && !isCurrent) { void handleUpgrade(); return; }
                      }}
                      className={cn(
                        "mt-6 w-full rounded-xl py-2.5 text-[12px] font-bold transition",
                        isCurrent && !isPro
                          ? "cursor-default border border-white/10 bg-white/5 text-white/35"
                          : isCurrent && isPro
                            ? "border border-white/20 bg-white/8 text-white/70 hover:bg-white/12"
                            : isHighlighted && !plan.comingSoon
                              ? "text-black shadow-lg shadow-amber-500/20 hover:brightness-105"
                              : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                        plan.comingSoon && "cursor-not-allowed",
                      )}
                      style={isHighlighted && !plan.comingSoon && !isCurrent ? { background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" } : undefined}
                    >
                      {isCurrent && isPro
                        ? (portalLoading ? "Chargement…" : "Gérer l'abonnement")
                        : isCurrent
                          ? "Plan actuel"
                          : plan.comingSoon
                            ? "Bientôt disponible"
                            : checkoutLoading ? "Chargement…" : plan.cta}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Feature comparison table — premium */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {/* Top glow line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <div className="absolute -top-12 left-1/2 h-24 w-72 -translate-x-1/2 rounded-full bg-amber-500/8 blur-3xl" />

              {/* Header */}
              <div className="relative border-b border-white/8 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: "linear-gradient(135deg,rgba(255,138,0,.25),rgba(255,138,0,.08))", border: "1px solid rgba(255,138,0,.35)" }}
                  >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "#ffb14a" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white/90">Comparaison détaillée</p>
                    <p className="text-[10px] text-white/35">Toutes les fonctionnalités par plan</p>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  {/* Column headers */}
                  <thead>
                    <tr>
                      <th className="w-[40%] px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30 sm:px-6">
                        Fonctionnalité
                      </th>
                      <th className="w-[20%] px-3 py-3.5 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">Gratuit</span>
                      </th>
                      <th className="relative w-[20%] px-3 py-3.5 text-center">
                        {/* Pro column highlight */}
                        <div className="absolute inset-x-1 inset-y-0 -z-10 rounded-t-xl bg-amber-500/[0.06]" />
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                          Pro NBA
                        </span>
                      </th>
                      <th className="w-[20%] px-3 py-3.5 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">All Sports</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { feature: "Best Props", icon: "chart", free: "Limité", pro: true, all: true },
                      { feature: "Grades (A, B, C)", icon: "grade", free: false, pro: true, all: true },
                      { feature: "Betalyze Score", icon: "score", free: false, pro: true, all: true },
                      { feature: "Defense vs Position", icon: "dvp", free: "Lecture", pro: true, all: true },
                      { feature: "Pages joueurs", icon: "player", free: "Basique", pro: true, all: true },
                      { feature: "Game Logs détaillés", icon: "log", free: false, pro: true, all: true },
                      { feature: "Matchups avancés", icon: "matchup", free: false, pro: true, all: true },
                      { feature: "Journal de paris", icon: "journal", free: false, pro: true, all: true },
                      { feature: "Modules NFL", icon: "nfl", free: false, pro: false, all: true },
                      { feature: "Modules NHL", icon: "nhl", free: false, pro: false, all: true },
                      { feature: "Alertes & notifications", icon: "alert", free: false, pro: false, all: true },
                    ] as Array<{ feature: string; icon: string; free: boolean | string; pro: boolean | string; all: boolean | string }>).map((row, rowIdx) => (
                      <tr
                        key={row.feature}
                        className={cn(
                          "group transition",
                          rowIdx % 2 === 0 ? "bg-white/[0.012]" : "",
                        )}
                      >
                        {/* Feature name */}
                        <td className="px-5 py-3 sm:px-6">
                          <span className="text-[12px] font-medium text-white/70 transition group-hover:text-white/90">
                            {row.feature}
                          </span>
                        </td>

                        {/* Free */}
                        <td className="px-3 py-3 text-center">
                          {row.free === true ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            </span>
                          ) : row.free === false ? (
                            <span className="inline-block h-px w-4 rounded bg-white/12" />
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/45">
                              {row.free}
                            </span>
                          )}
                        </td>

                        {/* Pro — highlighted column */}
                        <td className="relative px-3 py-3 text-center">
                          <div className="absolute inset-x-1 inset-y-0 -z-10 bg-amber-500/[0.06]" />
                          {row.pro === true ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 shadow-[0_0_8px_rgba(255,138,0,0.15)]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                            </span>
                          ) : row.pro === false ? (
                            <span className="inline-block h-px w-4 rounded bg-white/12" />
                          ) : (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300/70">
                              {row.pro}
                            </span>
                          )}
                        </td>

                        {/* All Sports */}
                        <td className="px-3 py-3 text-center">
                          {row.all === true ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            </span>
                          ) : row.all === false ? (
                            <span className="inline-block h-px w-4 rounded bg-white/12" />
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/45">
                              {row.all}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom CTA bar */}
              <div className="border-t border-white/8 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-white/40">
                    Passe à <span className="font-semibold text-amber-400/80">Pro NBA</span> pour débloquer toutes les fonctionnalités.
                  </p>
                  <button
                    type="button"
                    className="rounded-xl px-5 py-2 text-[11px] font-bold text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
                  >
                    Passer à Pro — 7,99 $ / mois
                  </button>
                </div>
              </div>
            </div>

            {/* FAQ — premium */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              {/* Top glow */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {/* Header */}
              <div className="relative border-b border-white/8 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: "linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03))", border: "1px solid rgba(255,255,255,.12)" }}
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-white/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white/90">Questions fréquentes</p>
                    <p className="text-[10px] text-white/35">Tout ce que tu dois savoir sur la facturation</p>
                  </div>
                </div>
              </div>

              {/* FAQ items */}
              <div className="divide-y divide-white/[0.06]">
                {[
                  {
                    q: "Quand serai-je facturé ?",
                    a: "La facturation commence dès l'activation du plan Pro. Tu seras facturé mensuellement à la même date.",
                    icon: <CreditCard className="h-3.5 w-3.5" />,
                  },
                  {
                    q: "Puis-je annuler à tout moment ?",
                    a: "Oui. Sans engagement. Tu gardes l'accès jusqu'à la fin de la période payée.",
                    icon: <ChevronRight className="h-3.5 w-3.5" />,
                  },
                  {
                    q: "Quels moyens de paiement ?",
                    a: "Carte de crédit/débit via Stripe. Apple Pay et Google Pay seront supportés prochainement.",
                    icon: <ShieldCheck className="h-3.5 w-3.5" />,
                  },
                  {
                    q: "Remboursement ?",
                    a: "Si tu annules dans les 48h suivant ton premier paiement, tu es remboursé intégralement.",
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                  },
                ].map((item, idx) => (
                  <div
                    key={item.q}
                    className={cn(
                      "group px-5 py-4 transition hover:bg-white/[0.02] sm:px-6",
                      idx % 2 === 0 ? "bg-white/[0.008]" : "",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/[0.04] text-white/30 transition group-hover:border-white/15 group-hover:text-white/50">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white/80 transition group-hover:text-white/95">
                          {item.q}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/40 transition group-hover:text-white/55">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-white/8 px-5 py-3.5 sm:px-6">
                <p className="text-[10px] text-white/25">
                  Une autre question ? Contacte-nous à <span className="font-medium text-white/40">support@betalyze.com</span>
                </p>
              </div>
            </div>

            {/* Bottom spacing */}
            <div className="h-8" />
          </main>
        </div>
      </div>

      <MobileBottomNav />
      </div>
    </div>
  );
}
