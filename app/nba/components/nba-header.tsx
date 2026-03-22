"use client";

import Link from "next/link";
import { Bell, CreditCard, Loader2, LogOut, Search, Settings, User, X } from "lucide-react";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type HeaderSuggestion = {
  type: "player" | "team";
  id: number;
  label: string;
  meta: string;
  href: string;
  logo?: string | null;
  teamCode?: string | null;
  teamLogo?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  jerseyNumber?: string | null;
};

type Props = {
  search?: string;
  setSearch?: (v: string) => void;
  suggestions?: HeaderSuggestion[];
  playersLoading?: boolean;
  playersError?: string | null;
};

function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-orange-400">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function NbaHeader({
  search = "",
  setSearch,
  suggestions = [],
  playersLoading,
  playersError,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountUser, setAccountUser] = useState<{ displayName: string | null; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; user?: { displayName?: string | null; email?: string } }) => {
        if (d.authenticated && d.user) {
          setAccountUser({ displayName: d.user.displayName ?? null, email: d.user.email ?? "" });
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/account");
  }

  const query = search.trim();
  const isInteractive = !!setSearch;

  const players = suggestions.filter((s) => s.type === "player");
  const teams = suggestions.filter((s) => s.type === "team");
  const flat = suggestions;

  const showDropdown = open && query.length >= 2;

  useEffect(() => { setActiveIdx(-1); }, [suggestions]);
  useEffect(() => { if (isInteractive) setOpen(query.length >= 2); }, [query, isInteractive]);

  // ⌘K global shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleClear = useCallback(() => {
    setSearch?.("");
    setOpen(false);
    inputRef.current?.focus();
  }, [setSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const count = flat.length;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (!open || count === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((p) => (p < count - 1 ? p + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((p) => (p > 0 ? p - 1 : count - 1)); }
      else if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        router.push(flat[activeIdx].href);
        setOpen(false);
        setSearch?.("");
      }
    },
    [open, flat, activeIdx, router, setSearch],
  );

  return (
    <div
      className="z-10 shrink-0"
      style={{
        background: "#0d0d0f",
        boxShadow: "0 1px 0 rgba(255,255,255,.05)",
      }}
    >
      {/* Sport switcher — mobile uniquement, tout en haut */}
      <div className="px-3 pt-3 pb-2 md:hidden">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,.05)" }}>
          {(["NBA", "NFL", "NHL", "MLB"] as const).map((sport) => {
            const isActive = sport === "NBA";
            return (
              <span
                key={sport}
                className="flex flex-1 items-center justify-center rounded-lg py-1.5 text-[11px] font-bold"
                style={isActive ? {
                  background: "rgba(255,138,0,.18)",
                  color: "#ffb14a",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
                } : {
                  color: "rgba(255,255,255,.20)",
                  filter: "blur(2px)",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {sport}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main header row */}
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {/* Logo mobile (sidebar cachée) */}
      <Link href="/" className="flex shrink-0 items-center md:hidden">
        <BetalyzeLogo height={22} />
      </Link>

      {/* Search bar */}
      <div ref={containerRef} className="relative w-full max-w-sm">
        {isInteractive ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch?.(e.target.value)}
                onFocus={() => { if (query.length >= 2) setOpen(true); }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher joueur, équipe…"
                className="w-full rounded-xl border border-white/8 bg-white/[0.05] py-2.5 pl-10 pr-20 text-[13px] text-white placeholder:text-white/25 focus:border-amber-500/30 focus:outline-none focus:ring-1 focus:ring-amber-500/15 transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {playersLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400/50" />}
                {query.length > 0 ? (
                  <button type="button" onClick={handleClear} className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/40 hover:text-white/70 transition">
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center rounded border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/20">⌘K</kbd>
                )}
              </div>
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-white/10 bg-[#0d0d0f]/98 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
                {flat.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto">
                    {players.length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">Joueurs</p>
                        {players.map((item, i) => (
                          <Link
                            key={`player-${item.id}`}
                            href={item.href}
                            onClick={() => { setOpen(false); setSearch?.(""); }}
                            onMouseEnter={() => setActiveIdx(i)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${activeIdx === i ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
                              {item.teamLogo
                                ? <img src={item.teamLogo} alt="" className="h-5 w-5 object-contain opacity-80" />
                                : <span className="text-[10px] font-bold text-white/40">{item.teamCode ?? "?"}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] text-white/90">
                                {item.firstName && <span className="font-normal">{highlightMatch(item.firstName, query)} </span>}
                                {item.lastName && <span className="font-bold">{highlightMatch(item.lastName.toUpperCase(), query)}</span>}
                                {!item.firstName && !item.lastName && highlightMatch(item.label, query)}
                              </p>
                              <p className="text-[11px] text-white/40">{item.meta}</p>
                            </div>
                            <span className="shrink-0 rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-400/80">Player</span>
                          </Link>
                        ))}
                      </>
                    )}
                    {players.length > 0 && teams.length > 0 && (
                      <div className="mx-3 my-1 border-t border-white/[0.06]" />
                    )}
                    {teams.length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">Équipes</p>
                        {teams.map((item, i) => {
                          const fi = players.length + i;
                          return (
                            <Link
                              key={`team-${item.id}`}
                              href={item.href}
                              onClick={() => { setOpen(false); setSearch?.(""); }}
                              onMouseEnter={() => setActiveIdx(fi)}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${activeIdx === fi ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
                                {item.logo
                                  ? <img src={item.logo} alt="" className="h-5 w-5 object-contain" />
                                  : <span className="text-[10px] font-bold text-white/40">{item.teamCode ?? "?"}</span>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] text-white/90">{highlightMatch(item.label, query)}</p>
                                <p className="text-[11px] text-white/40">{item.meta}</p>
                              </div>
                              <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400/80">Team</span>
                            </Link>
                          );
                        })}
                      </>
                    )}
                  </div>
                ) : !playersLoading && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Search className="h-5 w-5 text-white/10" />
                    <p className="text-xs text-white/30">Aucun résultat pour &quot;{query}&quot;</p>
                  </div>
                )}
                {flat.length > 0 && (
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-3 pb-1 pt-2 text-[10px] text-white/15">
                    <span>
                      <kbd className="rounded border border-white/8 bg-white/[0.03] px-1 py-0.5">↑↓</kbd>{" "}naviguer{" · "}
                      <kbd className="rounded border border-white/8 bg-white/[0.03] px-1 py-0.5">↵</kbd>{" "}ouvrir
                    </span>
                    <span>{flat.length} résultat{flat.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Pages sans search (settings, billing, etc.) */
          <div className="hidden md:flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white/25">
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1">Rechercher joueur, équipe…</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/20">⌘K</kbd>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white/40 transition hover:border-white/15 hover:text-white/70"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Account dropdown — desktop only */}
        <div ref={accountRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setAccountOpen((p) => !p)}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 text-[12px] text-white/50 transition hover:border-white/15 hover:text-white/80"
          >
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg,#ff8a00,#ffb14a)" }}
            >
              <User className="h-3 w-3 text-black" />
            </div>
            <span>{accountUser?.displayName?.split(" ")[0] ?? "Mon compte"}</span>
          </button>

          {accountOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl p-1.5"
              style={{
                background: "rgba(14,14,20,.98)",
                border: "1px solid rgba(255,255,255,.10)",
                boxShadow: "0 16px 48px rgba(0,0,0,.6)",
              }}
            >
              {accountUser && (
                <div className="px-3 py-2.5 border-b border-white/[0.06] mb-1">
                  <p className="text-[13px] font-semibold text-white/90">{accountUser.displayName ?? "—"}</p>
                  <p className="text-[11px] text-white/35 truncate">{accountUser.email}</p>
                </div>
              )}
              <Link
                href="/nba/billing"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <CreditCard className="h-4 w-4 text-amber-400/70" />
                Billing
              </Link>
              <Link
                href="/nba/settings"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Settings className="h-4 w-4 text-amber-400/70" />
                Settings
              </Link>
              <div className="my-1 border-t border-white/[0.06]" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
