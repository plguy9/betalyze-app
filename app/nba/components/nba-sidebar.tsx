"use client";

import { Activity, BookOpen, CreditCard, Flame, Search as SearchIcon, Settings, Sparkles } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function NavItem({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
        active ? "bg-orange-500/10 text-orange-200" : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className={cn("text-white/60", active && "text-orange-200")}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export type NbaSidebarPage =
  | "Best Props"
  | "Bet Journal"
  | "Players"
  | "Teams"
  | "DvP"
  | "Settings"
  | "Billing";

export function NbaSidebar({
  active,
  onSelect,
}: {
  active: NbaSidebarPage;
  onSelect: (v: NbaSidebarPage) => void;
}) {
  return (
    <aside className="relative hidden overflow-hidden md:sticky md:top-4 md:flex md:h-[calc(100vh-6.25rem)] md:w-64 md:flex-col md:gap-3 md:self-start md:rounded-2xl md:border md:border-white/10 md:bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.04)_52%,rgba(255,255,255,0.02)_100%)] md:p-4 md:backdrop-blur-xl md:shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.16),transparent_65%)] blur-xl" />
      </div>
      <div className="relative flex h-full flex-col gap-3">
        <div className="px-2 text-xs tracking-widest text-white/40">NAVIGATION</div>

        <div className="space-y-1">
          <NavItem
            label="Best Props"
            active={active === "Best Props"}
            onClick={() => onSelect("Best Props")}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <NavItem
            label="Players"
            active={active === "Players"}
            onClick={() => onSelect("Players")}
            icon={<SearchIcon className="h-4 w-4" />}
          />
          <NavItem
            label="Teams"
            active={active === "Teams"}
            onClick={() => onSelect("Teams")}
            icon={<Activity className="h-4 w-4" />}
          />
          <NavItem
            label="Defense vs Position"
            active={active === "DvP"}
            onClick={() => onSelect("DvP")}
            icon={<Flame className="h-4 w-4" />}
          />
          <NavItem
            label="Bet Journal"
            active={active === "Bet Journal"}
            onClick={() => onSelect("Bet Journal")}
            icon={<BookOpen className="h-4 w-4" />}
          />
        </div>

        <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
          <div className="px-2 text-xs tracking-widest text-white/40">COMPTE</div>
          <NavItem
            label="Settings"
            active={active === "Settings"}
            onClick={() => onSelect("Settings")}
            icon={<Settings className="h-4 w-4" />}
          />
          <NavItem
            label="Billing"
            active={active === "Billing"}
            onClick={() => onSelect("Billing")}
            icon={<CreditCard className="h-4 w-4" />}
          />
        </div>

        <div className="mt-auto rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
          <div className="text-xs font-semibold text-orange-200">Go Premium</div>
          <div className="mt-1 text-[11px] text-white/55">Unlock alerts, line movement & more.</div>
          <button className="mt-2 w-full rounded-lg bg-gradient-to-b from-orange-400 to-orange-500 px-3 py-2 text-xs font-semibold text-black transition hover:brightness-110">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}
