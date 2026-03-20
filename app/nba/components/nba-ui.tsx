"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "green" | "blue" | "yellow" | "red" | "gray";

const TONE_MAP: Record<Tone, string> = {
  green: "data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-200 data-[active=true]:border-emerald-500/30",
  blue: "data-[active=true]:bg-sky-500/15 data-[active=true]:text-sky-200 data-[active=true]:border-sky-500/30",
  yellow: "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-200 data-[active=true]:border-amber-500/30",
  red: "data-[active=true]:bg-rose-500/15 data-[active=true]:text-rose-200 data-[active=true]:border-rose-500/30",
  gray: "data-[active=true]:bg-white/10 data-[active=true]:text-white data-[active=true]:border-white/15",
};

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; tone?: Tone }>;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/20 p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        const toneClass = TONE_MAP[o.tone ?? "gray"] ?? TONE_MAP.gray;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            data-active={active}
            className={cn(
              "rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium text-white/60 transition",
              "hover:bg-white/10 hover:text-white",
              "data-[active=true]:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
              toneClass,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── TabGroup ─────────────────────────────────────────────────────────────────
// Filtres compacts style splits — utiliser partout à la place de Segmented
export function TabGroup({
  value,
  onChange,
  options,
  activeStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  activeStyle?: React.CSSProperties;
}) {
  const active = activeStyle ?? { background: "rgba(255,138,0,.18)", color: "#ffb14a" };
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg text-[10px]"
      style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.25)" }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="px-2.5 py-1.5 font-bold transition"
          style={value === o.value ? active : { color: "rgba(255,255,255,.30)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
// Barre orange + titre + sous-titre + pastille info optionnelle
export function SectionHeader({
  title,
  subtitle,
  info,
  children,
}: {
  title: string;
  subtitle?: string;
  info?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-5 w-0.5 flex-shrink-0 rounded-full"
          style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
            {info && (
              <div className="group/info relative cursor-help">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 text-[9px] font-bold text-white/30 transition group-hover/info:border-amber-500/30 group-hover/info:text-amber-400/70">
                  ?
                </span>
                <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-60 rounded-2xl border border-white/10 bg-[#111113] p-3.5 opacity-0 shadow-2xl transition group-hover/info:opacity-100">
                  <p className="text-[11px] leading-relaxed text-white/60">{info}</p>
                </div>
              </div>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] text-white/35">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function LeagueTab({
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
