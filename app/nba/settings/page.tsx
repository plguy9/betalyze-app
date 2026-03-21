"use client";

import Link from "next/link";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  Flame,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  User,
  Wallet,
  X,
} from "lucide-react";
import { NbaSidebar, type NbaSidebarPage } from "@/app/nba/components/nba-sidebar";
import { NbaHeader } from "@/app/nba/components/nba-header";
import { MobileBottomNav } from "@/app/nba/components/mobile-bottom-nav";

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

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ background: "rgba(255,138,0,0.12)", border: "1px solid rgba(255,138,0,0.2)" }}
      >
        <span style={{ color: "#ffb14a" }}>{icon}</span>
      </div>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium tracking-wide text-white/45">{children}</span>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
      placeholder={placeholder}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#0b0f18]">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex h-11 items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-9 flex-1 rounded-lg text-xs font-semibold transition",
            value === opt.value
              ? "text-orange-200"
              : "text-white/55 hover:bg-white/8",
          )}
          style={value === opt.value ? { background: "rgba(255,138,0,0.18)" } : undefined}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SaveButton({
  onClick,
  loading,
  label,
  loadingLabel,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-black transition disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
    >
      <Save className="h-3.5 w-3.5" />
      {loading ? loadingLabel : label}
    </button>
  );
}

type ConfirmModalState = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "orange" | "amber" | "rose";
  onConfirm: () => void;
} | null;

function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmModalState;
  onClose: () => void;
}) {
  if (!state) return null;

  const variantStyles = {
    orange: {
      icon: <Wallet className="h-5 w-5" style={{ color: "#ffb14a" }} />,
      iconBg: "rgba(255,138,0,0.12)",
      iconBorder: "rgba(255,138,0,0.22)",
      btn: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)",
      btnText: "text-black",
    },
    amber: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-300" />,
      iconBg: "rgba(245,158,11,0.12)",
      iconBorder: "rgba(245,158,11,0.22)",
      btn: "",
      btnText: "",
    },
    rose: {
      icon: <AlertTriangle className="h-5 w-5 text-rose-300" />,
      iconBg: "rgba(239,68,68,0.12)",
      iconBorder: "rgba(239,68,68,0.22)",
      btn: "",
      btnText: "",
    },
  }[state.variant];

  const confirmBtnClass =
    state.variant === "orange"
      ? "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-black transition disabled:opacity-60"
      : state.variant === "amber"
        ? "inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
        : "inline-flex items-center gap-2 rounded-full border border-rose-500/45 bg-rose-500/20 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-white/10 p-6 shadow-2xl sm:rounded-3xl"
        style={{ background: "rgba(12,12,20,0.98)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
            style={{ background: variantStyles.iconBg, border: `1px solid ${variantStyles.iconBorder}` }}
          >
            {variantStyles.icon}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-full border border-white/10 p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="mt-4 text-base font-semibold text-white">{state.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{state.description}</p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => { onClose(); state.onConfirm(); }}
            className={cn("flex-1", confirmBtnClass)}
            style={variantStyles.btn ? { background: variantStyles.btn } : undefined}
          >
            {state.confirmLabel}
          </button>
        </div>
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

export default function NbaSettingsPage() {
  const router = useRouter();
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
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
    if (page === "Billing") { router.push("/nba/billing"); return; }
    if (page === "Bet Journal") { router.push("/nba/journal"); return; }
    if (page === "Parlay") { router.push("/nba/parlay"); return; }
    if (page === "DvP") { router.push("/nba?section=defense#nba-dvp"); return; }
    if (page === "Teams") { router.push("/nba?section=equipes"); return; }
    if (page === "Best Props" || page === "Players") { router.push("/nba?section=players"); return; }
    handleComingSoon(page);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), email: email.trim() }),
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
        body: JSON.stringify({ defaultBookmaker, oddsFormat, stakeMode, stakePct: nextStakePct, stakeCash: nextStakeCash, timezone }),
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

  const doAdjustBalance = async (direction: "add" | "withdraw") => {
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
        body: JSON.stringify({ action: "balance.adjust", direction, amount }),
      });
      const data = await parseJson<SettingsApiResponse>(res);
      if (!res.ok || !data.ok || !data.settings) {
        showNotice("error", data.error ?? "Impossible d'ajuster le solde.");
        return;
      }
      applySettingsSnapshot({ settings: data.settings });
      showNotice("success", direction === "add" ? "Solde ajouté." : "Solde retiré.");
    } catch {
      showNotice("error", "Erreur reseau pendant l'ajustement du solde.");
    } finally {
      setWorkingBalance(false);
    }
  };

  const confirmAdjustBalance = (direction: "add" | "withdraw") => {
    const amount = Number(balanceAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice("error", "Montant invalide.");
      return;
    }
    const formatted = amount.toFixed(2);
    if (direction === "add") {
      setConfirmModal({
        title: "Confirmer le dépôt",
        description: `Tu es sur le point d'ajouter ${formatted}$ à ton solde Bet Journal. Le nouveau solde sera mis à jour immédiatement.`,
        confirmLabel: `Déposer ${formatted}$`,
        variant: "orange",
        onConfirm: () => void doAdjustBalance("add"),
      });
    } else {
      setConfirmModal({
        title: "Confirmer le retrait",
        description: `Tu es sur le point de retirer ${formatted}$ de ton solde Bet Journal. Cette action ne peut pas être annulée.`,
        confirmLabel: `Retirer ${formatted}$`,
        variant: "amber",
        onConfirm: () => void doAdjustBalance("withdraw"),
      });
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
        body: JSON.stringify({ action: "password.change", currentPassword, newPassword }),
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

  const confirmResetJournal = () => {
    setConfirmModal({
      title: "Vider le Bet Journal",
      description: "Toutes tes entrées du journal seront supprimées définitivement. Cette action est irréversible.",
      confirmLabel: "Vider le journal",
      variant: "amber",
      onConfirm: () => void resetJournal(),
    });
  };

  const resetJournal = async () => {
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

  const confirmDeleteAccount = () => {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      showNotice("error", "Tape DELETE pour confirmer.");
      return;
    }
    setConfirmModal({
      title: "Supprimer le compte",
      description: "Ton compte et toutes tes données seront supprimés définitivement. Cette action est irréversible.",
      confirmLabel: "Supprimer mon compte",
      variant: "rose",
      onConfirm: () => void deleteAccount(),
    });
  };

  const deleteAccount = async () => {
    setWorkingDanger(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "account.delete", confirmText: deleteConfirm.trim() }),
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
    <div className="min-h-screen text-white md:h-screen md:overflow-hidden md:p-3" style={{ background: "#07070b" }}>
      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

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
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Settings</h1>
                <p className="mt-0.5 text-[13px] text-white/40">Compte & préférences · NBA</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadSettings()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rafraîchir
                </button>
              </div>
            </div>

            {/* Notice */}
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
              <GlassCard className="p-6">
                <div className="flex items-center gap-3 text-white/50">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Chargement des paramètres...</span>
                </div>
              </GlassCard>
            ) : authRequired ? (
              <GlassCard className="p-6">
                <p className="text-sm text-white/65">Connecte-toi pour accéder à cette page.</p>
                <div className="mt-4">
                  <Link
                    href="/account?mode=login"
                    className="inline-flex rounded-full px-5 py-2 text-xs font-bold text-black transition"
                    style={{ background: "linear-gradient(135deg, #ff8a00 0%, #ffb14a 100%)" }}
                  >
                    Aller à la connexion →
                  </Link>
                </div>
              </GlassCard>
            ) : (
              <>
                {/* 1. Profil */}
                <GlassCard className="p-4 sm:p-5">
                  <SectionHeader
                    icon={<User className="h-4 w-4" />}
                    title="Profil"
                    subtitle={`Créé le ${createdAtLabel}`}
                  />

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <FieldLabel>Nom d&apos;affichage</FieldLabel>
                      <TextInput value={displayName} onChange={setDisplayName} placeholder="Ton nom" />
                    </label>
                    <label className="space-y-1.5">
                      <FieldLabel>Adresse email</FieldLabel>
                      <TextInput value={email} onChange={setEmail} placeholder="toi@email.com" />
                    </label>
                  </div>

                  <div className="mt-5">
                    <SaveButton
                      onClick={() => void saveProfile()}
                      loading={savingProfile}
                      label="Sauvegarder le profil"
                      loadingLabel="Sauvegarde..."
                    />
                  </div>
                </GlassCard>

                {/* 2. Préférences betting */}
                <GlassCard className="p-4 sm:p-5">
                  <SectionHeader
                    icon={<SlidersHorizontal className="h-4 w-4" />}
                    title="Préférences betting"
                    subtitle="Bookmaker, format des cotes, stake"
                  />

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>Bookmaker par défaut</FieldLabel>
                      <SelectInput
                        value={defaultBookmaker}
                        onChange={setDefaultBookmaker}
                        options={BOOKMAKER_OPTIONS}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel>Timezone</FieldLabel>
                      <SelectInput
                        value={timezone}
                        onChange={setTimezone}
                        options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel>Format des cotes</FieldLabel>
                      <ToggleGroup
                        value={oddsFormat}
                        onChange={(v) => setOddsFormat(v as OddsFormat)}
                        options={[
                          { value: "decimal", label: "Décimal" },
                          { value: "american", label: "Américain" },
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel>Mode de stake</FieldLabel>
                      <ToggleGroup
                        value={stakeMode}
                        onChange={(v) => setStakeMode(v as StakeMode)}
                        options={[
                          { value: "pct", label: "% bankroll" },
                          { value: "cash", label: "$ montant fixe" },
                        ]}
                      />
                    </div>

                    <label className="space-y-1.5">
                      <FieldLabel>Stake % (défaut)</FieldLabel>
                      <TextInput value={stakePct} onChange={setStakePct} placeholder="0.5" />
                    </label>

                    <label className="space-y-1.5">
                      <FieldLabel>Stake cash (défaut)</FieldLabel>
                      <TextInput value={stakeCash} onChange={setStakeCash} placeholder="10" />
                    </label>
                  </div>

                  <div className="mt-5">
                    <SaveButton
                      onClick={() => void savePreferences()}
                      loading={savingPrefs}
                      label="Sauvegarder les préférences"
                      loadingLabel="Sauvegarde..."
                    />
                  </div>
                </GlassCard>

                {/* 3. Solde Journal */}
                <GlassCard className="p-4 sm:p-5">
                  <SectionHeader
                    icon={<Wallet className="h-4 w-4" />}
                    title="Solde Bet Journal"
                    subtitle="Gérer ta bankroll de suivi"
                  />

                  <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 p-4">
                    <div className="flex items-end gap-3">
                      <div>
                        <p className="text-[11px] tracking-widest text-white/40">SOLDE ACTUEL</p>
                        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-100">
                          {settings ? `${settings.journalBalance.toFixed(2)}` : "0.00"}
                          <span className="ml-1 text-xl text-white/50">$</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        value={balanceAmount}
                        onChange={(e) => setBalanceAmount(e.target.value)}
                        className="h-11 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
                        placeholder="Montant ($)"
                      />
                      <button
                        type="button"
                        disabled={workingBalance}
                        onClick={() => confirmAdjustBalance("add")}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/12 px-5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Déposer
                      </button>
                      <button
                        type="button"
                        disabled={workingBalance}
                        onClick={() => confirmAdjustBalance("withdraw")}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/12 px-5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        <MinusCircle className="h-4 w-4" />
                        Retirer
                      </button>
                    </div>
                  </div>
                </GlassCard>

                {/* 4. Zone dangereuse */}
                <GlassCard className="border-rose-500/20 bg-rose-500/[0.03] p-4 sm:p-5">
                  <SectionHeader
                    icon={<ShieldAlert className="h-4 w-4" />}
                    title="Zone dangereuse"
                    subtitle="Actions irréversibles — procède avec prudence"
                  />

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {/* Change password */}
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <p className="text-sm font-semibold text-white/90">Changer le mot de passe</p>
                      <div className="mt-3 space-y-2">
                        <TextInput
                          type="password"
                          value={currentPassword}
                          onChange={setCurrentPassword}
                          placeholder="Mot de passe actuel"
                        />
                        <TextInput
                          type="password"
                          value={newPassword}
                          onChange={setNewPassword}
                          placeholder="Nouveau mot de passe"
                        />
                        <TextInput
                          type="password"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          placeholder="Confirmer le nouveau mot de passe"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={workingDanger}
                        onClick={() => void changePassword()}
                        className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Mettre à jour
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Reset journal */}
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-300" />
                          <p className="text-sm font-semibold text-amber-100">Reset Bet Journal</p>
                        </div>
                        <p className="mt-1 text-xs text-amber-100/60">
                          Supprime toutes tes entrées du journal. Action irréversible.
                        </p>
                        <button
                          type="button"
                          disabled={workingDanger}
                          onClick={confirmResetJournal}
                          className="mt-3 rounded-full border border-amber-400/35 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-60"
                        >
                          Vider le journal
                        </button>
                      </div>

                      {/* Delete account */}
                      <div className="rounded-2xl border border-rose-500/35 bg-rose-500/8 p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-rose-300" />
                          <p className="text-sm font-semibold text-rose-100">Supprimer le compte</p>
                        </div>
                        <p className="mt-1 text-xs text-rose-200/60">
                          Tape <span className="font-mono font-bold text-rose-300">DELETE</span> pour confirmer la suppression définitive.
                        </p>
                        <input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="mt-3 h-10 w-full rounded-xl border border-rose-500/35 bg-black/35 px-3 text-sm font-mono text-slate-100 outline-none transition focus:border-rose-400/60"
                          placeholder="DELETE"
                        />
                        <button
                          type="button"
                          disabled={workingDanger}
                          onClick={confirmDeleteAccount}
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

      <MobileBottomNav />
      </div>
    </div>
  );
}
