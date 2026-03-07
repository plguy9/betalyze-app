"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";

type Notice = { kind: "success" | "error"; text: string } | null;
type OddsFormat = "decimal" | "american";
type StakeMode = "pct" | "cash";

type AccountPayload = {
  id: number;
  email: string;
  displayName: string | null;
  createdAt: string | null;
  sessionExpiresAt: string | null;
};

type SettingsPayload = {
  userId: number;
  defaultBookmaker: string;
  oddsFormat: OddsFormat;
  stakeMode: StakeMode;
  stakePct: number;
  stakeCash: number;
  timezone: string;
  journalBalance: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type SettingsApiResponse = {
  ok: boolean;
  error?: string;
  account?: AccountPayload;
  settings?: SettingsPayload;
  deleted?: number;
};

const BOOKMAKER_OPTIONS = [
  { value: "fanduel", label: "FanDuel" },
  { value: "draftkings", label: "DraftKings" },
  { value: "betmgm", label: "BetMGM" },
  { value: "caesars", label: "Caesars" },
  { value: "espnbet", label: "ESPN BET" },
  { value: "bet365", label: "bet365" },
  { value: "pointsbet", label: "PointsBet" },
  { value: "pinnacle", label: "Pinnacle" },
];

const TIMEZONE_OPTIONS = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function parseJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { ok: false, error: raw } as T;
  }
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

export default function NbaSettingsPage() {
  const router = useRouter();
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [workingDanger, setWorkingDanger] = useState(false);
  const [workingBalance, setWorkingBalance] = useState(false);

  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultBookmaker, setDefaultBookmaker] = useState("fanduel");
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("decimal");
  const [stakeMode, setStakeMode] = useState<StakeMode>("pct");
  const [stakePct, setStakePct] = useState("0.5");
  const [stakeCash, setStakeCash] = useState("10");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [balanceAmount, setBalanceAmount] = useState("100");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const createdAtLabel = useMemo(() => {
    if (!account?.createdAt) return "n/a";
    const d = new Date(account.createdAt);
    if (Number.isNaN(d.getTime())) return "n/a";
    return d.toLocaleString("fr-CA", { hour12: false });
  }, [account?.createdAt]);

  const showNotice = (kind: "success" | "error", text: string) => setNotice({ kind, text });

  const applySettingsSnapshot = (payload: { account?: AccountPayload; settings?: SettingsPayload }) => {
    if (payload.account) {
      setAccount(payload.account);
      setDisplayName(payload.account.displayName ?? "");
      setEmail(payload.account.email ?? "");
    }
    if (payload.settings) {
      const next = payload.settings;
      setSettings(next);
      setDefaultBookmaker(next.defaultBookmaker ?? "fanduel");
      setOddsFormat(next.oddsFormat === "american" ? "american" : "decimal");
      setStakeMode(next.stakeMode === "cash" ? "cash" : "pct");
      setStakePct(Number.isFinite(next.stakePct) ? String(next.stakePct) : "0.5");
      setStakeCash(Number.isFinite(next.stakeCash) ? String(next.stakeCash) : "10");
      setTimezone(next.timezone ?? "America/Toronto");
    }
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", { cache: "no-store" });
      const data = await parseJson<SettingsApiResponse>(res);
      if (res.status === 401) {
        setAuthRequired(true);
        setAccount(null);
        setSettings(null);
        return;
      }
      if (!res.ok || !data.ok || !data.account || !data.settings) {
        showNotice("error", data.error ?? "Impossible de charger les settings.");
        return;
      }
      setAuthRequired(false);
      applySettingsSnapshot({ account: data.account, settings: data.settings });
    } catch {
      showNotice("error", "Erreur reseau pendant le chargement des settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    return () => {
      if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    };
  }, [loadSettings]);

  const handleComingSoon = (sport: string) => {
    setComingSoon(`${sport} arrive bientot sur Betalyze.`);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setComingSoon(null), 2500);
  };

  const sidebarActive: NbaSidebarPage = "Settings";
  const setSidebarActive = (page: NbaSidebarPage) => {
    if (page === "Settings") return;
    if (page === "Bet Journal") {
      router.push("/nba/journal");
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

  const saveProfile = async () => {
    setSavingProfile(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
        }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok || !data.account || !data.settings) {
        showNotice("error", data.error ?? "Impossible de sauvegarder le profil.");
        return;
      }
      applySettingsSnapshot({ account: data.account, settings: data.settings });
      showNotice("success", "Profil sauvegarde.");
    } catch {
      showNotice("error", "Erreur reseau pendant la sauvegarde du profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    setNotice(null);

    const nextStakePct = Number(stakePct.replace(",", "."));
    const nextStakeCash = Number(stakeCash.replace(",", "."));

    if (!Number.isFinite(nextStakePct) || nextStakePct < 0) {
      showNotice("error", "Stake % invalide.");
      setSavingPrefs(false);
      return;
    }
    if (!Number.isFinite(nextStakeCash) || nextStakeCash < 0) {
      showNotice("error", "Stake cash invalide.");
      setSavingPrefs(false);
      return;
    }

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultBookmaker,
          oddsFormat,
          stakeMode,
          stakePct: nextStakePct,
          stakeCash: nextStakeCash,
          timezone,
        }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok || !data.settings) {
        showNotice("error", data.error ?? "Impossible de sauvegarder les preferences.");
        return;
      }
      applySettingsSnapshot({ settings: data.settings });
      showNotice("success", "Preferences betting sauvegardees.");
    } catch {
      showNotice("error", "Erreur reseau pendant la sauvegarde des preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const adjustBalance = async (direction: "add" | "withdraw") => {
    setWorkingBalance(true);
    setNotice(null);
    const amount = Number(balanceAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice("error", "Montant invalide.");
      setWorkingBalance(false);
      return;
    }
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "balance.adjust",
          direction,
          amount,
        }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok || !data.settings) {
        showNotice("error", data.error ?? "Impossible d'ajuster le solde.");
        return;
      }
      applySettingsSnapshot({ settings: data.settings });
      showNotice("success", direction === "add" ? "Solde ajoute." : "Solde retire.");
    } catch {
      showNotice("error", "Erreur reseau pendant l'ajustement du solde.");
    } finally {
      setWorkingBalance(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      showNotice("error", "Entre le mot de passe actuel et le nouveau mot de passe.");
      return;
    }
    if (newPassword.length < 8) {
      showNotice("error", "Le nouveau mot de passe doit avoir au moins 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotice("error", "La confirmation ne correspond pas.");
      return;
    }

    setWorkingDanger(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password.change",
          currentPassword,
          newPassword,
        }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok) {
        showNotice("error", data.error ?? "Impossible de changer le mot de passe.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showNotice("success", "Mot de passe mis a jour.");
    } catch {
      showNotice("error", "Erreur reseau pendant la mise a jour du mot de passe.");
    } finally {
      setWorkingDanger(false);
    }
  };

  const resetJournal = async () => {
    const confirmed = window.confirm("Supprimer tous les logs du Bet Journal ?");
    if (!confirmed) return;

    setWorkingDanger(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "journal.reset" }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok) {
        showNotice("error", data.error ?? "Impossible de reset le journal.");
        return;
      }
      showNotice("success", `Journal reset (${data.deleted ?? 0} entree(s) supprimee(s)).`);
    } catch {
      showNotice("error", "Erreur reseau pendant le reset du journal.");
    } finally {
      setWorkingDanger(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      showNotice("error", "Tape DELETE pour confirmer.");
      return;
    }

    setWorkingDanger(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "account.delete",
          confirmText: deleteConfirm.trim(),
        }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok) {
        showNotice("error", data.error ?? "Impossible de supprimer le compte.");
        return;
      }
      router.push("/account");
    } catch {
      showNotice("error", "Erreur reseau pendant la suppression du compte.");
    } finally {
      setWorkingDanger(false);
    }
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
                  <p className="text-xs tracking-widest text-white/35">SETTINGS · NBA</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
                    Compte & preferences
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("fr-CA")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadSettings()}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/10"
                  >
                    Rafraichir <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>

            {notice && (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  notice.kind === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/35 bg-rose-500/10 text-rose-200",
                )}
              >
                {notice.text}
              </div>
            )}

            {loading ? (
              <GlassCard className="p-5 text-sm text-white/60">Chargement des settings...</GlassCard>
            ) : authRequired ? (
              <GlassCard className="p-5">
                <p className="text-sm text-white/65">Connecte-toi pour acceder a cette page.</p>
                <div className="mt-3">
                  <Link
                    href="/account?mode=login"
                    className="inline-flex rounded-full border border-orange-500/35 bg-orange-500/15 px-4 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/25"
                  >
                    Aller a la connexion
                  </Link>
                </div>
              </GlassCard>
            ) : (
              <>
                <GlassCard className="p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">1. Compte</h2>
                    <span className="text-xs text-white/45">Cree le: {createdAtLabel}</span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Nom affichage</span>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="Ton nom"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Email</span>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="toi@email.com"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={savingProfile}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingProfile ? "Sauvegarde..." : "Sauvegarder profil"}
                  </button>
                </GlassCard>

                <GlassCard className="p-5">
                  <h2 className="text-lg font-semibold text-white">2. Preferences betting</h2>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Bookmaker par defaut</span>
                      <select
                        value={defaultBookmaker}
                        onChange={(e) => setDefaultBookmaker(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                      >
                        {BOOKMAKER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Timezone</span>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Format des cotes</span>
                      <div className="flex h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
                        <button
                          type="button"
                          onClick={() => setOddsFormat("decimal")}
                          className={cn(
                            "h-9 flex-1 rounded-lg text-xs font-semibold transition",
                            oddsFormat === "decimal"
                              ? "bg-orange-500/20 text-orange-200"
                              : "text-white/65 hover:bg-white/8",
                          )}
                        >
                          Decimal
                        </button>
                        <button
                          type="button"
                          onClick={() => setOddsFormat("american")}
                          className={cn(
                            "h-9 flex-1 rounded-lg text-xs font-semibold transition",
                            oddsFormat === "american"
                              ? "bg-orange-500/20 text-orange-200"
                              : "text-white/65 hover:bg-white/8",
                          )}
                        >
                          American
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Mode de stake</span>
                      <div className="flex h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
                        <button
                          type="button"
                          onClick={() => setStakeMode("pct")}
                          className={cn(
                            "h-9 flex-1 rounded-lg text-xs font-semibold transition",
                            stakeMode === "pct"
                              ? "bg-orange-500/20 text-orange-200"
                              : "text-white/65 hover:bg-white/8",
                          )}
                        >
                          % bankroll
                        </button>
                        <button
                          type="button"
                          onClick={() => setStakeMode("cash")}
                          className={cn(
                            "h-9 flex-1 rounded-lg text-xs font-semibold transition",
                            stakeMode === "cash"
                              ? "bg-orange-500/20 text-orange-200"
                              : "text-white/65 hover:bg-white/8",
                          )}
                        >
                          $ cash
                        </button>
                      </div>
                    </div>

                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Stake % (defaut)</span>
                      <input
                        value={stakePct}
                        onChange={(e) => setStakePct(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="0.5"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs tracking-wide text-white/45">Stake cash (defaut)</span>
                      <input
                        value={stakeCash}
                        onChange={(e) => setStakeCash(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="10"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => void savePreferences()}
                    disabled={savingPrefs}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingPrefs ? "Sauvegarde..." : "Sauvegarder preferences"}
                  </button>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs tracking-widest text-white/45">SOLDE BET JOURNAL</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-100">
                          {settings ? `${settings.journalBalance.toFixed(2)}$` : "0.00$"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[170px_auto_auto]">
                      <input
                        value={balanceAmount}
                        onChange={(e) => setBalanceAmount(e.target.value)}
                        className="h-11 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="Montant"
                      />
                      <button
                        type="button"
                        disabled={workingBalance}
                        onClick={() => void adjustBalance("add")}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Ajouter
                      </button>
                      <button
                        type="button"
                        disabled={workingBalance}
                        onClick={() => void adjustBalance("withdraw")}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/12 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        <MinusCircle className="h-4 w-4" />
                        Retrait
                      </button>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="border-rose-500/25 bg-rose-500/[0.04] p-5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-300" />
                    <h2 className="text-lg font-semibold text-rose-100">7. Zone dangereuse</h2>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <p className="text-sm font-semibold text-white/90">Changer mot de passe</p>
                      <div className="mt-3 space-y-2">
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                          placeholder="Mot de passe actuel"
                        />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                          placeholder="Nouveau mot de passe"
                        />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                          placeholder="Confirmer le nouveau mot de passe"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={workingDanger}
                        onClick={() => void changePassword()}
                        className="mt-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Mettre a jour le mot de passe
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-sm font-semibold text-amber-100">Reset Bet Journal</p>
                        <p className="mt-1 text-xs text-amber-100/70">
                          Supprime toutes tes entrees du journal (action irreversible).
                        </p>
                        <button
                          type="button"
                          disabled={workingDanger}
                          onClick={() => void resetJournal()}
                          className="mt-3 rounded-full border border-amber-400/35 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-60"
                        >
                          Reset journal
                        </button>
                      </div>

                      <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4">
                        <div className="flex items-center gap-2 text-rose-200">
                          <AlertTriangle className="h-4 w-4" />
                          <p className="text-sm font-semibold">Supprimer le compte</p>
                        </div>
                        <p className="mt-1 text-xs text-rose-200/70">
                          Tape DELETE pour confirmer la suppression complete du compte.
                        </p>
                        <input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="mt-3 h-11 w-full rounded-xl border border-rose-500/35 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-rose-400/60"
                          placeholder="DELETE"
                        />
                        <button
                          type="button"
                          disabled={workingDanger}
                          onClick={() => void deleteAccount()}
                          className="mt-3 rounded-full border border-rose-500/45 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-60"
                        >
                          Supprimer mon compte
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
