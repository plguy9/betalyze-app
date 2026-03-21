"use client";

import { BookMarked, CreditCard, LayoutDashboard, List, MoreHorizontal, Settings, ShieldAlert, Trophy, Users, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MainTab = "dashboard" | "players" | "equipes" | "defense";

export function MobileBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab?: MainTab;
  onTabChange?: (tab: MainTab) => void;
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = [
    { label: "Dashboard", tab: "dashboard" as MainTab, icon: LayoutDashboard },
    { label: "Players",   tab: "players"   as MainTab, icon: Users },
    { label: "Teams",     tab: "equipes"   as MainTab, icon: Trophy },
    { label: "DvP",       tab: "defense"   as MainTab, icon: ShieldAlert },
  ] as const;

  const moreItems = [
    { label: "Bet Journal",    icon: BookMarked, action: () => { setMoreOpen(false); router.push("/nba/journal"); } },
    { label: "Parlay Builder", icon: List,       action: () => { setMoreOpen(false); router.push("/nba/parlay"); } },
    { label: "Settings",       icon: Settings,   action: () => { setMoreOpen(false); router.push("/nba/settings"); } },
    { label: "Billing",        icon: CreditCard, action: () => { setMoreOpen(false); router.push("/nba/billing"); } },
  ];

  const isMoreActive = !activeTab;

  return (
    <>
      {/* Overlay "Plus" */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }} />
          <div
            className="absolute bottom-20 left-4 right-4 rounded-2xl p-2"
            style={{
              background: "rgba(18,18,22,.98)",
              border: "1px solid rgba(255,255,255,.10)",
              boxShadow: "0 -8px 40px rgba(0,0,0,.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,.25)" }}>Plus</span>
              <button type="button" onClick={() => setMoreOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.08)" }}>
                <X className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,.5)" }} />
              </button>
            </div>
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition hover:bg-white/[0.06]"
                  style={{ color: "rgba(255,255,255,.75)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: "rgba(255,138,0,.8)" }} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden"
        style={{
          background: "rgba(10,10,15,.97)",
          borderTop: "1px solid rgba(255,255,255,.08)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-stretch">
          {tabs.map((item) => {
            const isActive = activeTab === item.tab;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  if (onTabChange) {
                    onTabChange(item.tab);
                  } else {
                    router.push(`/nba?section=${item.tab}`);
                  }
                }}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition"
                style={{ color: isActive ? "#ffb14a" : "rgba(255,255,255,.32)" }}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style={{ background: "#ffb14a" }} />
                )}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Plus */}
          <button
            type="button"
            onClick={() => setMoreOpen((p) => !p)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition"
            style={{ color: moreOpen || isMoreActive ? "#ffb14a" : "rgba(255,255,255,.32)" }}
          >
            {(moreOpen || isMoreActive) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full" style={{ background: "#ffb14a" }} />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-tight">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
