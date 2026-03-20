"use client";

import Link from "next/link";
import { Search, X, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, TabGroup } from "./nba-ui";

type Suggestion = {
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
  search: string;
  setSearch: (v: string) => void;
  playersLoading: boolean;
  playersError: string | null;
  suggestions: Suggestion[];
  gamesLoading: boolean;
  todayMeta: { dateLabel: string; gamesCount: number };
  activeSection: "dashboard" | "equipes" | "players" | "defense";
  setActiveSection: (v: "dashboard" | "equipes" | "players" | "defense") => void;
};

/* ── helpers ── */

function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-orange-400 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchCard({
  search,
  setSearch,
  playersLoading,
  playersError,
  suggestions,
  gamesLoading,
  todayMeta,
  activeSection,
  setActiveSection,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const query = search.trim();

  // Group suggestions by type
  const grouped = useMemo(() => {
    const players = suggestions.filter((s) => s.type === "player");
    const teams = suggestions.filter((s) => s.type === "team");
    const flat = [...players, ...teams];
    return { players, teams, flat };
  }, [suggestions]);

  // Reset active index when suggestions change
  useEffect(() => { setActiveIdx(-1); }, [suggestions]);

  // Open/close dropdown based on query
  useEffect(() => {
    setOpen(query.length >= 2);
  }, [query, suggestions]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Click outside to close
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
    setSearch("");
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }, [setSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const count = grouped.flat.length;
      if (e.key === "Escape") {
        e.preventDefault();
        if (open) { setOpen(false); setActiveIdx(-1); } else { handleClear(); }
        return;
      }
      if (!open || count === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((prev) => (prev < count - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : count - 1));
      } else if (e.key === "Enter" && activeIdx >= 0 && activeIdx < count) {
        e.preventDefault();
        router.push(grouped.flat[activeIdx].href);
        setOpen(false);
        setSearch("");
      }
    },
    [open, grouped.flat, activeIdx, router, setSearch, handleClear],
  );

  const showDropdown = open && query.length >= 2;
  const hasResults = grouped.flat.length > 0;
  const showNoResults = !playersLoading && query.length >= 2 && !hasResults && !playersError;

  /* ── Render a single suggestion row ── */
  function renderItem(item: Suggestion, flatIdx: number) {
    const isActive = flatIdx === activeIdx;
    const isPlayer = item.type === "player";
    const teamLogo = isPlayer ? item.teamLogo : item.logo;
    const code = item.teamCode;

    const hasNameParts = isPlayer && (item.firstName || item.lastName);

    return (
      <Link
        key={`${item.type}-${item.id}`}
        href={item.href}
        data-idx={flatIdx}
        onClick={() => { setOpen(false); setSearch(""); }}
        onMouseEnter={() => setActiveIdx(flatIdx)}
        className={
          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors " +
          (isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")
        }
      >
        {/* Logo / Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40">
          {isPlayer ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/avatar-player.svg" alt="" className="h-6 w-6 object-contain opacity-85" />
          ) : teamLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogo} alt="" className="h-6 w-6 object-contain drop-shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
          ) : (
            <span className="text-[10px] font-bold text-white/40">
              {code ?? item.label.slice(0, 3).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          {hasNameParts ? (
            <>
              {/* Prénom normal + NOM BOLD */}
              <p className="truncate text-[13px] text-white/90">
                {item.firstName && (
                  <span className="font-normal">{highlightMatch(item.firstName, query)}</span>
                )}
                {item.firstName && item.lastName && " "}
                {item.lastName && (
                  <span className="font-bold tracking-wide">
                    {highlightMatch(item.lastName.toUpperCase(), query)}
                  </span>
                )}
              </p>
              {/* Chips : poste · #numéro · logo équipe + code */}
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                {item.position && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/[0.06] text-white/45 ring-1 ring-white/[0.08]">
                    {item.position}
                  </span>
                )}
                {item.jerseyNumber && (
                  <span className="text-[11px] font-medium text-white/35">#{item.jerseyNumber}</span>
                )}
                {code && (
                  <>
                    <span className="text-white/15">·</span>
                    {teamLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamLogo} alt="" className="h-3.5 w-3.5 object-contain opacity-80" />
                    )}
                    <span className="text-[11px] font-semibold text-white/50">{code}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="truncate text-[13px] font-medium text-white/90">
                {highlightMatch(item.label, query)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span>{item.meta}</span>
                {isPlayer && code && (
                  <>
                    <span className="text-white/15">·</span>
                    {teamLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamLogo} alt="" className="h-3.5 w-3.5 object-contain opacity-80" />
                    )}
                    <span className="font-semibold text-white/50">{code}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Type badge */}
        <span
          className={
            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium " +
            (isPlayer
              ? "bg-orange-500/10 text-orange-400/80"
              : "bg-emerald-500/10 text-emerald-400/80")
          }
        >
          {isPlayer ? "Player" : "Team"}
        </span>
      </Link>
    );
  }

  return (
    <Card className="relative z-20 overflow-visible">
      <div className="space-y-6 p-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {gamesLoading ? "..." : todayMeta.dateLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {gamesLoading
                ? "..."
                : todayMeta.gamesCount === 0
                  ? "0 games"
                  : `${todayMeta.gamesCount} ${todayMeta.gamesCount > 1 ? "games" : "game"}`}
            </span>
          </div>
          <button className="rounded-full bg-gradient-to-b from-orange-400 to-orange-500 px-4 py-2 text-xs font-semibold text-black shadow-md hover:brightness-110 transition">
            Meilleurs spots
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 flex flex-col gap-3">
          <div ref={containerRef} className="relative flex-1">
            {/* Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => { if (query.length >= 2) setOpen(true); }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un joueur ou une équipe..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-11 pr-24 text-sm text-white placeholder:text-white/25 focus:border-orange-500/30 focus:outline-none focus:ring-1 focus:ring-orange-500/15 transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {playersLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400/50" />
                )}
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/40 hover:bg-white/15 hover:text-white/70 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {query.length === 0 && (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-white/25">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-white/10 bg-[#0a0a12]/98 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
                {playersError && (
                  <p className="px-3 py-2 text-xs text-red-400/80">{playersError}</p>
                )}

                {hasResults && (
                  <div ref={listRef} className="max-h-80 overflow-y-auto overscroll-contain">
                    {/* Players group */}
                    {grouped.players.length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                          Joueurs
                        </p>
                        {grouped.players.map((item) =>
                          renderItem(item, grouped.flat.indexOf(item)),
                        )}
                      </>
                    )}

                    {/* Separator */}
                    {grouped.players.length > 0 && grouped.teams.length > 0 && (
                      <div className="mx-3 my-1 border-t border-white/[0.06]" />
                    )}

                    {/* Teams group */}
                    {grouped.teams.length > 0 && (
                      <>
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                          Équipes
                        </p>
                        {grouped.teams.map((item) =>
                          renderItem(item, grouped.flat.indexOf(item)),
                        )}
                      </>
                    )}
                  </div>
                )}

                {showNoResults && (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Search className="h-5 w-5 text-white/10" />
                    <p className="text-xs text-white/30">
                      Aucun résultat pour &quot;{query}&quot;
                    </p>
                  </div>
                )}

                {/* Footer */}
                {hasResults && (
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-3 pt-2 pb-1 text-[10px] text-white/15">
                    <span>
                      <kbd className="rounded border border-white/8 bg-white/[0.03] px-1 py-0.5">↑↓</kbd>
                      {" "}naviguer{" · "}
                      <kbd className="rounded border border-white/8 bg-white/[0.03] px-1 py-0.5">↵</kbd>
                      {" "}ouvrir{" · "}
                      <kbd className="rounded border border-white/8 bg-white/[0.03] px-1 py-0.5">esc</kbd>
                      {" "}fermer
                    </span>
                    <span>{grouped.flat.length} résultat{grouped.flat.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="md:hidden">
            <TabGroup
              value={activeSection}
              onChange={(v) => setActiveSection(v as "dashboard" | "equipes" | "players" | "defense")}
              options={[
                { value: "dashboard", label: "Dashboard" },
                { value: "players", label: "Players" },
                { value: "equipes", label: "Teams" },
                { value: "defense", label: "DvP" },
              ]}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
