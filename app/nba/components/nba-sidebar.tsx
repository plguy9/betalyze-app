"use client";

import {
  BookMarked,
  CreditCard,
  LayoutDashboard,
  List,
  Settings,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BetalyzeLogo } from "@/components/betalyze-logo";
import Link from "next/link";

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
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
        active ? "text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white/80",
      )}
      style={active ? {
        background: "rgba(255,138,0,.12)",
        border: "1px solid rgba(255,138,0,.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
      } : undefined}
    >
      <span style={{ color: active ? "#ffb14a" : "rgba(255,255,255,.40)" }}>{icon}</span>
      <span className="truncate">{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "#ff8a00" }} />
      )}
    </button>
  );
}

export type NbaSidebarPage =
  | "Best Props"
  | "Bet Journal"
  | "Players"
  | "Teams"
  | "Parlay"
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
    <aside
      className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto"
      style={{
        background: "#111113",
        boxShadow: "1px 0 0 rgba(255,255,255,.05)",
      }}
    >
      <div className="flex h-full flex-col gap-1 p-5">

        {/* Logo — centré */}
        <div className="mb-4 flex items-center justify-center pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
          <Link href="/">
            <BetalyzeLogo height={24} />
          </Link>
        </div>

        {/* Sport switcher */}
        <div
          className="mb-3 flex gap-1 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,.05)" }}
        >
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

        {/* Nav — MENU */}
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,.20)" }}>
          Menu
        </p>

        <div className="space-y-0.5">
          <NavItem label="Dashboard"           active={active === "Best Props"}  onClick={() => onSelect("Best Props")}  icon={<LayoutDashboard className="h-4 w-4" />} />
          <NavItem label="Players"             active={active === "Players"}     onClick={() => onSelect("Players")}    icon={<Users className="h-4 w-4" />} />
          <NavItem label="Teams"               active={active === "Teams"}       onClick={() => onSelect("Teams")}      icon={<Trophy className="h-4 w-4" />} />
          <NavItem label="Parlay Builder"      active={active === "Parlay"}      onClick={() => onSelect("Parlay")}     icon={<List className="h-4 w-4" />} />
          <NavItem label="Defense vs Position" active={active === "DvP"}         onClick={() => onSelect("DvP")}        icon={<ShieldAlert className="h-4 w-4" />} />
          <NavItem label="Bet Journal"         active={active === "Bet Journal"} onClick={() => onSelect("Bet Journal")}icon={<BookMarked className="h-4 w-4" />} />
        </div>

        {/* Nav — COMPTE */}
        <div className="mt-3 space-y-0.5 border-t pt-3" style={{ borderColor: "rgba(255,255,255,.05)" }}>
          <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,.20)" }}>
            Compte
          </p>
          <NavItem label="Settings" active={active === "Settings"} onClick={() => onSelect("Settings")} icon={<Settings className="h-4 w-4" />} />
          <NavItem label="Billing"  active={active === "Billing"}  onClick={() => onSelect("Billing")}  icon={<CreditCard className="h-4 w-4" />} />
        </div>

        {/* Upgrade card */}
        <div
          className="mt-auto rounded-2xl p-4"
          style={{
            background: "radial-gradient(600px 200px at 50% 0%, rgba(255,138,0,.22) 0%, transparent 70%), rgba(255,138,0,.08)",
            border: "1px solid rgba(255,138,0,.28)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <p className="text-[12px] font-bold" style={{ color: "#ffb14a" }}>Passer Premium</p>
          <p className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,.50)" }}>
            Alertes, line movement & multi-sport.
          </p>
          <button
            className="mt-3 w-full rounded-xl py-2 text-[12px] font-bold text-black transition hover:brightness-105"
            style={{ background: "linear-gradient(90deg,#ff8a00,#ffb14a)", boxShadow: "0 4px 16px rgba(255,138,0,.28)" }}
          >
            Upgrade
          </button>
        </div>

      </div>
    </aside>
  );
}
