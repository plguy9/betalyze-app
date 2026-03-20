"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Card, SectionHeader, TabGroup } from "./nba-ui";
import type { NbaStandingDisplayRow, NbaStandingsPayload } from "./nba-shared-types";

type Props = {
  standingsFilter: "league" | "east" | "west";
  setStandingsFilter: (v: "league" | "east" | "west") => void;
  standingsFilteredRows: NbaStandingDisplayRow[];
  standingsLoading: boolean;
  standingsError: string | null;
  standingsPayload: NbaStandingsPayload | null;
};

type SummaryTeamRow = {
  teamId: number;
  name: string;
  logo: string | null;
  conference: "East" | "West" | "N/A";
  pfPerGame: number;
  pointsAllowedPerGame: number;
  reboundsPerGame: number;
  reboundsAllowedPerGame: number;
  assistsPerGame: number;
  assistsAllowedPerGame: number;
  threesMadePerGame: number;
  threesAllowedPerGame: number;
  fgPct: number;
  fgPctAllowed: number;
  ftPct: number;
  ftPctAllowed: number;
};

type PowerMetricKey = "PTS" | "REB" | "AST" | "3PM" | "FGP" | "FTP";
type PowerMetricConfig = {
  label: string;
  subtitle: string;
  offenseMetricLabel: string;
  defenseMetricLabel: string;
  offenseHigherIsBetter: boolean;
  defenseHigherIsBetter: boolean;
  offenseValueGetter: (row: SummaryTeamRow) => number;
  defenseValueGetter: (row: SummaryTeamRow) => number;
  formatValue: (value: number) => string;
};

const POWER_METRIC_OPTIONS: Array<{ value: PowerMetricKey; label: string; tone: "green" | "blue" | "yellow" | "red" | "gray" }> = [
  { value: "PTS", label: "PTS", tone: "green" },
  { value: "REB", label: "REB", tone: "yellow" },
  { value: "AST", label: "AST", tone: "blue" },
  { value: "3PM", label: "3PM", tone: "green" },
  { value: "FGP", label: "FG%", tone: "gray" },
  { value: "FTP", label: "FT%", tone: "gray" },
];

const POWER_METRIC_CONFIG: Record<PowerMetricKey, PowerMetricConfig> = {
  PTS: {
    label: "Points / match",
    subtitle: "Offense vs defense adverse",
    offenseMetricLabel: "PTS/M",
    defenseMetricLabel: "PTS allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.pfPerGame,
    defenseValueGetter: (row) => row.pointsAllowedPerGame,
    formatValue: (value) => value.toFixed(1),
  },
  REB: {
    label: "Rebonds / match",
    subtitle: "Rebonds pris vs concédés",
    offenseMetricLabel: "REB/M",
    defenseMetricLabel: "REB allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.reboundsPerGame,
    defenseValueGetter: (row) => row.reboundsAllowedPerGame,
    formatValue: (value) => value.toFixed(1),
  },
  AST: {
    label: "Passes / match",
    subtitle: "Création vs passes concédées",
    offenseMetricLabel: "AST/M",
    defenseMetricLabel: "AST allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.assistsPerGame,
    defenseValueGetter: (row) => row.assistsAllowedPerGame,
    formatValue: (value) => value.toFixed(1),
  },
  "3PM": {
    label: "3PTS marqués / match",
    subtitle: "Tir extérieur pour/contre",
    offenseMetricLabel: "3PM/M",
    defenseMetricLabel: "3PM allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.threesMadePerGame,
    defenseValueGetter: (row) => row.threesAllowedPerGame,
    formatValue: (value) => value.toFixed(1),
  },
  FGP: {
    label: "Adresse au tir",
    subtitle: "FG% pour et contre",
    offenseMetricLabel: "FG%",
    defenseMetricLabel: "FG% allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.fgPct,
    defenseValueGetter: (row) => row.fgPctAllowed,
    formatValue: (value) => `${value.toFixed(1)}%`,
  },
  FTP: {
    label: "Adresse LF",
    subtitle: "FT% pour et contre",
    offenseMetricLabel: "FT%",
    defenseMetricLabel: "FT% allowed",
    offenseHigherIsBetter: true,
    defenseHigherIsBetter: false,
    offenseValueGetter: (row) => row.ftPct,
    defenseValueGetter: (row) => row.ftPctAllowed,
    formatValue: (value) => `${value.toFixed(1)}%`,
  },
};

/* ── Helpers ── */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function rankStyle(index: number): { num: string; dot: string } {
  if (index === 0) return { num: "text-amber-300 font-black", dot: "bg-amber-400" };
  if (index === 1) return { num: "text-white/60 font-bold", dot: "bg-white/35" };
  if (index === 2) return { num: "text-amber-600/80 font-bold", dot: "bg-amber-700/60" };
  return { num: "text-white/25 font-semibold", dot: "bg-white/15" };
}

/* ── Skeleton components ── */

function SkeletonRow() {
  return (
    <tr className="border-t border-white/5">
      <td className="px-3 py-2.5"><div className="h-2.5 w-4 animate-pulse rounded-full bg-white/[0.06]" /></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/[0.07]" />
        </div>
      </td>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5 text-center">
          <div className="mx-auto h-2.5 w-8 animate-pulse rounded-full bg-white/[0.06]" />
        </td>
      ))}
    </tr>
  );
}

/* ── Power card (Top/Bottom lists) ── */

type PowerCardProps = {
  title: string;
  subtitle: string;
  metricLabel: string;
  accentClass: string;        // text color for value
  glowClass: string;          // top line gradient
  barClass: string;           // mini bar fill color
  items: SummaryTeamRow[];
  loading: boolean;
  valueGetter: (row: SummaryTeamRow) => number;
  formatValue?: (value: number) => string;
  higherIsBetter: boolean;
  keyPrefix: string;
};

function PowerCard({
  title,
  subtitle,
  metricLabel,
  accentClass,
  glowClass,
  barClass,
  items,
  loading,
  valueGetter,
  formatValue,
  higherIsBetter,
  keyPrefix,
}: PowerCardProps) {
  const maxVal = items.length > 0 ? Math.max(...items.map(valueGetter)) : 1;
  const minVal = items.length > 0 ? Math.min(...items.map(valueGetter)) : 0;
  const range = Math.max(maxVal - minVal, 1);

  function barWidth(row: SummaryTeamRow): number {
    const v = valueGetter(row);
    if (higherIsBetter) return Math.max(8, ((v - minVal) / range) * 100);
    return Math.max(8, ((maxVal - v) / range) * 100);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.022] backdrop-blur-sm">
      {/* Colored top line */}
      <div className={`absolute inset-x-0 top-0 h-px ${glowClass}`} />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2.5">
        <div>
          <p className="text-[12px] font-bold text-white/85">{title}</p>
          <p className="text-[9px] text-white/30">{subtitle}</p>
        </div>
        <span className={`rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold ${accentClass}`}>
          {metricLabel}
        </span>
      </div>

      {/* List */}
      <div className="max-h-[430px] space-y-1.5 overflow-y-auto px-3.5 pb-3.5 pr-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="h-2.5 w-4 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-4 w-4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-2.5 flex-1 animate-pulse rounded-full bg-white/[0.07]" />
                <div className="h-2.5 w-8 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
            ))
          : items.map((team, index) => {
              const styles = rankStyle(index);
              const val = valueGetter(team);
              const bw = barWidth(team);

              return (
                <Link
                  key={`${keyPrefix}-${team.teamId}-${index}`}
                  href={`/nba/teams/${team.teamId}/preview`}
                  className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-white/[0.04]"
                >
                  {/* Rank */}
                  <span className={cn("w-5 shrink-0 text-center text-[10px]", styles.num)}>
                    {index + 1}
                  </span>

                  {/* Logo */}
                  {team.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logo} alt={team.name} className="h-5 w-5 shrink-0 rounded object-contain" />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/15 bg-white/8 text-[7px] font-bold text-white/60">
                      {team.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  {/* Name + bar */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[11px] font-medium text-white/80 group-hover:text-white/95">
                        {team.name}
                      </p>
                      <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", accentClass)}>
                        {formatValue ? formatValue(val) : val.toFixed(1)}
                      </span>
                    </div>
                    {/* Mini bar */}
                    <div className="mt-1 h-[3px] w-full rounded-full bg-white/[0.06]">
                      <div
                        className={cn("h-full rounded-full transition-all", barClass)}
                        style={{ width: `${bw}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

/* ── Main section ── */

export function TeamsSection({
  standingsFilter,
  setStandingsFilter,
  standingsFilteredRows,
  standingsLoading,
  standingsError,
  standingsPayload,
}: Props) {
  const router = useRouter();
  const [powerMetric, setPowerMetric] = useState<PowerMetricKey>("PTS");

  const summaryRows = useMemo(() => {
    const rows = standingsPayload?.standings ?? [];
    return rows
      .map((row) => {
        const games = Number.isFinite(row.games) && row.games > 0 ? row.games : 0;
        const pfPerGame = games > 0 ? row.pointsFor / games : 0;
        const pointsAllowedPerGame = Number(row.pointsAllowedPerGame ?? NaN);
        const reboundsPerGame = Number(row.reboundsPerGame ?? 0) || 0;
        const reboundsAllowedPerGame = Number(row.reboundsAllowedPerGame ?? 0) || 0;
        const assistsPerGame = Number(row.assistsPerGame ?? 0) || 0;
        const assistsAllowedPerGame = Number(row.assistsAllowedPerGame ?? 0) || 0;
        const threesMadePerGame = Number(row.threesMadePerGame ?? 0) || 0;
        const threesAllowedPerGame = Number(row.threesAllowedPerGame ?? 0) || 0;
        const fgPct = Number(row.fgPct ?? 0) || 0;
        const fgPctAllowed = Number(row.fgPctAllowed ?? 0) || 0;
        const ftPct = Number(row.ftPct ?? 0) || 0;
        const ftPctAllowed = Number(row.ftPctAllowed ?? 0) || 0;
        return {
          teamId: row.teamId,
          name: row.name,
          logo: row.logo,
          conference: row.conference,
          pfPerGame,
          pointsAllowedPerGame:
            Number.isFinite(pointsAllowedPerGame) && pointsAllowedPerGame > 0
              ? pointsAllowedPerGame
              : games > 0
                ? row.pointsAgainst / games
                : 0,
          reboundsPerGame,
          reboundsAllowedPerGame,
          assistsPerGame,
          assistsAllowedPerGame,
          threesMadePerGame,
          threesAllowedPerGame,
          fgPct,
          fgPctAllowed,
          ftPct,
          ftPctAllowed,
        } satisfies SummaryTeamRow;
      })
      .filter(
        (row) =>
          row.pfPerGame > 0 ||
          row.pointsAllowedPerGame > 0 ||
          row.reboundsPerGame > 0 ||
          row.reboundsAllowedPerGame > 0 ||
          row.assistsPerGame > 0 ||
          row.assistsAllowedPerGame > 0 ||
          row.threesMadePerGame > 0 ||
          row.threesAllowedPerGame > 0 ||
          row.fgPct > 0 ||
          row.fgPctAllowed > 0 ||
          row.ftPct > 0 ||
          row.ftPctAllowed > 0,
      );
  }, [standingsPayload]);

  const powerMetricConfig = POWER_METRIC_CONFIG[powerMetric];
  const compareOffenseTop = useMemo(
    () =>
      (a: SummaryTeamRow, b: SummaryTeamRow) => {
        const av = powerMetricConfig.offenseValueGetter(a);
        const bv = powerMetricConfig.offenseValueGetter(b);
        return powerMetricConfig.offenseHigherIsBetter ? bv - av : av - bv;
      },
    [powerMetricConfig],
  );
  const compareDefenseTop = useMemo(
    () =>
      (a: SummaryTeamRow, b: SummaryTeamRow) => {
        const av = powerMetricConfig.defenseValueGetter(a);
        const bv = powerMetricConfig.defenseValueGetter(b);
        return powerMetricConfig.defenseHigherIsBetter ? bv - av : av - bv;
      },
    [powerMetricConfig],
  );

  const metricRows = useMemo(
    () =>
      summaryRows.filter((row) => {
        const offenseValue = powerMetricConfig.offenseValueGetter(row);
        const defenseValue = powerMetricConfig.defenseValueGetter(row);
        return (
          Number.isFinite(offenseValue) &&
          Number.isFinite(defenseValue) &&
          offenseValue > 0 &&
          defenseValue > 0
        );
      }),
    [powerMetricConfig, summaryRows],
  );

  const offenseRankedRows = useMemo(
    () => [...metricRows].sort(compareOffenseTop),
    [compareOffenseTop, metricRows],
  );
  const defenseRankedRows = useMemo(
    () => [...metricRows].sort(compareDefenseTop),
    [compareDefenseTop, metricRows],
  );

  return (
    <div className="space-y-5">

      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Teams</h1>
          <p className="mt-0.5 text-[13px] text-white/40">Classements & power rankings · NBA</p>
        </div>
      </div>

      {/* ── Power Rankings card ── */}
      <Card>
        <div className="p-4 sm:p-6">
          <SectionHeader
            title="Power Rankings"
            subtitle={`${powerMetricConfig.label} · saison complète${standingsPayload?.season ? ` · ${standingsPayload.season}` : ""}`}
            info="Classement offensif et défensif de chaque équipe selon la métrique choisie. Utilise ces rankings pour évaluer la qualité du matchup avant de parier."
          >
            <TabGroup
              value={powerMetric}
              onChange={(v) => setPowerMetric(v as PowerMetricKey)}
              options={POWER_METRIC_OPTIONS}
            />
          </SectionHeader>

          {/* Empty state */}
          {!standingsLoading && !standingsError && metricRows.length === 0 && (
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] py-10 text-center">
              <p className="text-sm text-white/40">Aucune donnée disponible</p>
            </div>
          )}

          {/* 2-up grid */}
          {(standingsLoading || metricRows.length > 0) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PowerCard
                title="Classement offense"
                subtitle="Complet (meilleur au moins bon)"
                metricLabel={powerMetricConfig.offenseMetricLabel}
                accentClass="text-emerald-300"
                glowClass="bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
                barClass="bg-emerald-500/60"
                items={offenseRankedRows}
                loading={standingsLoading}
                valueGetter={powerMetricConfig.offenseValueGetter}
                formatValue={powerMetricConfig.formatValue}
                higherIsBetter={powerMetricConfig.offenseHigherIsBetter}
                keyPrefix={`offense-full-${powerMetric}`}
              />
              <PowerCard
                title="Classement defense"
                subtitle="Complet (meilleur au moins bon)"
                metricLabel={powerMetricConfig.defenseMetricLabel}
                accentClass="text-rose-300"
                glowClass="bg-gradient-to-r from-transparent via-rose-500/40 to-transparent"
                barClass="bg-rose-500/50"
                items={defenseRankedRows}
                loading={standingsLoading}
                valueGetter={powerMetricConfig.defenseValueGetter}
                formatValue={powerMetricConfig.formatValue}
                higherIsBetter={powerMetricConfig.defenseHigherIsBetter}
                keyPrefix={`defense-full-${powerMetric}`}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Standings card ── */}
      <Card>
        <div className="p-4 sm:p-6">
          <SectionHeader
            title="Classement"
            subtitle={standingsPayload?.season ? `Saison ${standingsPayload.season}${!standingsLoading && standingsFilteredRows.length > 0 ? ` · ${standingsFilteredRows.length} équipes` : ""}` : "Classements NBA · saison en cours"}
            info="Classement actuel par conférence avec les zones playoff. Les équipes en bas de tableau offrent souvent de meilleures opportunités pour les Overs défensifs."
          >
            <TabGroup
              value={standingsFilter}
              onChange={(v) => setStandingsFilter(v as "league" | "east" | "west")}
              options={[
                { value: "league", label: "NBA" },
                { value: "east", label: "Est" },
                { value: "west", label: "Ouest" },
              ]}
            />
          </SectionHeader>

          {standingsError && <p className="mt-4 text-[11px] text-rose-400">Erreur : {standingsError}</p>}

          {!standingsLoading && !standingsError && standingsFilteredRows.length === 0 && (
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center">
              <p className="text-sm text-white/40">Aucun classement disponible</p>
            </div>
          )}

          {(standingsLoading || standingsFilteredRows.length > 0) && (
            <div className="mt-5 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
              {/* Zone legend — conférence seulement */}
              {!standingsLoading && standingsFilteredRows.length > 0 && standingsFilter !== "league" && (
                <div className="flex items-center gap-3 border-b border-white/5 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-white/50" />
                    <span className="text-[9px] text-white/30">Playoffs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500/60" />
                    <span className="text-[9px] text-white/30">Play-in (7–10)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-white/15" />
                    <span className="text-[9px] text-white/30">Éliminé</span>
                  </div>
                </div>
              )}
              <table className="min-w-[820px] w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/8 text-[9px] uppercase tracking-[0.14em] text-white/30">
                    <th className="px-3 py-2.5 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Équipe</th>
                    <th className="px-3 py-2.5 text-center font-semibold">V</th>
                    <th className="px-3 py-2.5 text-center font-semibold">D</th>
                    <th className="px-3 py-2.5 text-center font-semibold">MJ</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Win%</th>
                    <th className="px-3 py-2.5 text-center font-semibold">PF/M</th>
                    <th className="px-3 py-2.5 text-center font-semibold">PA/M</th>
                    <th className="px-3 py-2.5 text-center font-semibold">+/-</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Forme</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : (
                    standingsFilteredRows.map((team, idx) => {
                      const rank = standingsFilter === "league" ? team.leagueRank : team.conferenceRank ?? null;
                      const isTop = rank !== null && rank <= 6;
                      const isPlayIn = rank !== null && rank >= 7 && rank <= 10;
                      const winPct = (team.winPct * 100).toFixed(1);

                      // Separator after position 6 (playoffs cutoff) and 10 (play-in cutoff)
                      const showPlayInDivider = rank === 7 && standingsFilter !== "league";
                      const showEliminatedDivider = rank === 11 && standingsFilter !== "league";

                      return (
                        <Fragment key={`${standingsFilter}-${team.teamId}-${idx}`}>
                          {(showPlayInDivider || showEliminatedDivider) && (
                            <tr key={`divider-${rank}`}>
                              <td colSpan={10} className="px-3 py-0">
                                <div className={`h-px ${showPlayInDivider ? "bg-amber-500/20" : "bg-white/8"}`} />
                              </td>
                            </tr>
                          )}
                          <tr
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/nba/teams/${team.teamId}/preview`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(`/nba/teams/${team.teamId}/preview`);
                              }
                            }}
                            className={cn(
                              "group cursor-pointer border-t border-white/5 transition hover:bg-white/[0.03]",
                              idx % 2 === 0 ? "bg-white/[0.006]" : "",
                            )}
                          >
                            {/* Rank with left accent bar (conférence only) */}
                            <td className="relative px-3 py-2">
                              {standingsFilter !== "league" && isTop && (
                                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-white/30" />
                              )}
                              {standingsFilter !== "league" && isPlayIn && (
                                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-amber-500/50" />
                              )}
                              <span className={`text-[11px] font-bold ${standingsFilter !== "league" && isTop ? "text-white/80" : standingsFilter !== "league" && isPlayIn ? "text-amber-400/70" : "text-white/50"}`}>
                                {rank ?? "-"}
                              </span>
                            </td>

                            {/* Team */}
                            <td className="px-3 py-2">
                              <div className="inline-flex items-center gap-2">
                                {team.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={team.logo} alt={team.name} className="h-5 w-5 shrink-0 rounded object-contain" />
                                ) : (
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/15 bg-white/8 text-[7px] font-bold text-white/60">
                                    {team.name.slice(0, 3).toUpperCase()}
                                  </span>
                                )}
                                <span className={cn("text-[11px] font-medium transition group-hover:text-white", isTop ? "text-white/90" : "text-white/70")}>{team.name}</span>
                                {standingsFilter === "league" && (
                                  <span className={`rounded-full px-1.5 py-px text-[8px] font-semibold ${team.conference === "East" ? "bg-sky-500/12 text-sky-300/60" : team.conference === "West" ? "bg-amber-500/12 text-amber-300/60" : "bg-white/8 text-white/35"}`}>
                                    {team.conference === "East" ? "E" : team.conference === "West" ? "W" : "?"}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* W */}
                            <td className="px-3 py-2 text-center font-bold text-emerald-400/80">{team.wins}</td>
                            {/* L */}
                            <td className="px-3 py-2 text-center font-bold text-rose-400/70">{team.losses}</td>
                            {/* GP */}
                            <td className="px-3 py-2 text-center text-white/35">{team.games}</td>

                            {/* Win% with color scale */}
                            <td className="px-3 py-2 text-center">
                              <span className={`font-semibold ${Number(winPct) >= 60 ? "text-emerald-300" : Number(winPct) >= 50 ? "text-white/75" : Number(winPct) >= 40 ? "text-amber-400/70" : "text-rose-400/65"}`}>
                                {winPct}%
                              </span>
                            </td>

                            {/* PF/G */}
                            <td className="px-3 py-2 text-center text-white/55">{team.pfPerGame.toFixed(1)}</td>
                            {/* PA/G */}
                            <td className="px-3 py-2 text-center text-white/55">{team.paPerGame.toFixed(1)}</td>

                            {/* Diff */}
                            <td className="px-3 py-2 text-center">
                              <span className={`font-bold ${team.diffPerGame > 0 ? "text-emerald-400/80" : team.diffPerGame < 0 ? "text-rose-400/70" : "text-white/30"}`}>
                                {team.diffPerGame > 0 ? "+" : ""}{team.diffPerGame.toFixed(1)}
                              </span>
                            </td>

                            {/* Form — 5 dots */}
                            <td className="px-3 py-2 text-center">
                              <div className="inline-flex items-center gap-[3px]">
                                {team.formStreak.split("").slice(-5).map((ch, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      ch === "W" ? "bg-emerald-500/80" : ch === "L" ? "bg-rose-500/70" : "bg-white/12",
                                    )}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
