"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Lock, Mail, User, X } from "lucide-react";

type AuthUser = {
  id: number;
  email: string;
  displayName: string | null;
  createdAt: string | null;
};

type MeResponse = {
  ok: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  expiresAt?: string | null;
};

export default function AccountPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const initialTab: "login" | "register" =
    mode === "register" ? "register" : "login";
  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const closeHref = !loading && user ? "/nba" : "/";

  async function parseApiPayload(
    res: Response,
  ): Promise<{ error?: string; [key: string]: unknown }> {
    const raw = await res.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw) as { error?: string; [key: string]: unknown };
    } catch {
      return { error: raw };
    }
  }

  async function loadMe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = (await res.json()) as MeResponse;
      if (!payload.authenticated || !payload.user) {
        setUser(null);
        setExpiresAt(null);
      } else {
        setUser(payload.user);
        setExpiresAt(payload.expiresAt ?? null);
      }
    } catch {
      setError("Impossible de verifier la session.");
      setUser(null);
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const sessionLabel = useMemo(() => {
    if (!expiresAt) return null;
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("fr-CA", { hour12: false });
  }, [expiresAt]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const payload = await parseApiPayload(res);
      if (!res.ok) {
        setError((payload.error as string | undefined) ?? "Connexion impossible.");
        return;
      }
      setInfo("Connexion reussie.");
      setLoginPassword("");
      await loadMe();
    } catch {
      setError("Erreur reseau pendant la connexion.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          displayName: registerName,
        }),
      });
      const payload = await parseApiPayload(res);
      if (!res.ok) {
        setError((payload.error as string | undefined) ?? "Inscription impossible.");
        return;
      }
      setInfo("Compte cree et connecte.");
      setRegisterPassword("");
      await loadMe();
    } catch {
      setError("Erreur reseau pendant l'inscription.");
    } finally {
      setWorking(false);
    }
  }

  async function handleLogout() {
    setWorking(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!res.ok) {
        setError("Deconnexion impossible.");
        return;
      }
      setInfo("Deconnecte.");
      await loadMe();
    } catch {
      setError("Erreur reseau pendant la deconnexion.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050508] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_460px_at_20%_-10%,rgba(255,138,0,0.18),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_92%_8%,rgba(25,199,195,0.16),transparent_64%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.48)_100%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <section
          className="w-full max-w-[560px] rounded-[26px] border border-white/10 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-6"
          style={{
            background:
              "radial-gradient(700px 260px at 8% 0%, rgba(255,138,0,0.14) 0%, rgba(0,0,0,0) 58%)," +
              "radial-gradient(650px 260px at 98% 0%, rgba(25,199,195,0.12) 0%, rgba(0,0,0,0) 58%)," +
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
          }}
        >
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Betalyze Access
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
                {user ? "Compte Betalyze" : "Connexion Betalyze"}
              </h1>
            </div>
            <Link
              href={closeHref}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-slate-300 transition hover:border-amber-400/60 hover:text-amber-200"
              aria-label="Retour NBA"
            >
              <X className="h-4 w-4" />
            </Link>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-slate-400">
              Verification de session...
            </div>
          ) : user ? (
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/90">
                Connecte
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {user.displayName?.trim() || user.email}
              </p>
              <p className="mt-1 text-sm text-slate-300">{user.email}</p>
              {sessionLabel && (
                <p className="mt-2 text-xs text-slate-500">
                  Session valide jusqu&apos;a: {sessionLabel}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={working}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                >
                  {working ? "..." : "Se deconnecter"}
                </button>
                <Link
                  href="/nba"
                  className="rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                >
                  Continuer vers NBA
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    activeTab === "login"
                      ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className={`rounded-full px-4 py-1.5 transition ${
                    activeTab === "register"
                      ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Inscription
                </button>
              </div>

              {activeTab === "login" ? (
                <form className="space-y-3" onSubmit={handleLogin}>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </span>
                    <input
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      type="email"
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/50"
                      placeholder="toi@email.com"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                      Mot de passe
                    </span>
                    <input
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      type="password"
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/50"
                      placeholder="Minimum 8 caracteres"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={working}
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(255,138,0,0.40)] transition hover:opacity-95 disabled:opacity-60"
                  >
                    {working ? "..." : "Se connecter"}
                  </button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleRegister}>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <User className="h-3.5 w-3.5" />
                      Nom (optionnel)
                    </span>
                    <input
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                      placeholder="Ton nom"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </span>
                    <input
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      type="email"
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                      placeholder="toi@email.com"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                      Mot de passe
                    </span>
                    <input
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      type="password"
                      required
                      minLength={8}
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                      placeholder="Minimum 8 caracteres"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={working}
                    className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-sm font-semibold text-black shadow-[0_12px_40px_rgba(16,185,129,0.40)] transition hover:opacity-95 disabled:opacity-60"
                  >
                    {working ? "..." : "Creer un compte"}
                  </button>
                </form>
              )}
            </>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {info}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
