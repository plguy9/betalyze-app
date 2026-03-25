"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { TabGroup } from "./nba-ui";
import { formatDecimal, gradeSortRank, getTeamPrimaryColor, hexToRgba } from "./nba-helpers";
import type { NbaTopProp } from "./nba-shared-types";

type LeaderboardEntry = {
  playerId: number;
  playerName: string;
  teamCode: string;
  position: string | null;
  seasonAvg: number;
  last5Avg: number | null;
  gamesPlayed: number;
  trend: "up" | "down" | "flat";
};

type LeaderboardData = {
  topScorers: LeaderboardEntry[];
  topRebounders: LeaderboardEntry[];
  topAssistmen: LeaderboardEntry[];
  playingTeams: string[];
};

type Props = {
  teamMetaByCode?: Map<string, unknown>;
};

const GRADE_HIT_RATE: Record<string, number> = {
  S: 87, A: 79, B: 66, C: 54,
};

function gradeStyle(grade: string): { bg: string; color: string } {
  if (grade === "S") return { bg: "rgba(245,158,11,.20)", color: "#fbbf24" };
  if (grade === "A") return { bg: "rgba(52,211,153,.15)", color: "#6ee7b7" };
  if (grade === "B") return { bg: "rgba(56,189,248,.12)", color: "#7dd3fc" };
  if (grade === "C") return { bg: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.40)" };
  return { bg: "rgba(244,63,94,.10)", color: "rgba(251,113,133,.60)" };
}

const RANK_ACCENT = [
  "#ffb14a", // #1 — gold
  "#94a3b8", // #2 — silver
  "#cd7f32", // #3 — bronze
  "rgba(255,255,255,.20)",
  "rgba(255,255,255,.20)",
];

export function PlayersSection({ teamMetaByCode: _teamMetaByCode }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [tab, setTab] = useState<"PTS" | "REB" | "AST">("PTS");
  const [topProps, setTopProps] = useState<NbaTopProp[]>([]);
  const [topPropsLoading, setTopPropsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLeaderboardLoading(true);
        const res = await fetch("/api/nba/players/leaderboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LeaderboardData & { ok: boolean };
        if (data.ok) setLeaderboard(data);
      } catch { /* silent */ }
      finally { setLeaderboardLoading(false); }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setTopPropsLoading(true);
        const res = await fetch("/api/nba/props/top", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { props?: NbaTopProp[] };
        setTopProps(Array.isArray(data.props) ? data.props : []);
      } catch { /* silent */ }
      finally { setTopPropsLoading(false); }
    };
    void load();
  }, []);

  const entries = useMemo(() => {
    if (!leaderboard) return [];
    if (tab === "PTS") return leaderboard.topScorers;
    if (tab === "REB") return leaderboard.topRebounders;
    return leaderboard.topAssistmen;
  }, [leaderboard, tab]);

  const hitRateProps = useMemo(() => {
    return [...topProps]
      .sort((a, b) => {
        const gradeDiff = gradeSortRank(b.grade) - gradeSortRank(a.grade);
        return gradeDiff !== 0 ? gradeDiff : b.finalScore - a.finalScore;
      })
      .slice(0, 8)
      .map((p) => ({ ...p, hitRate: GRADE_HIT_RATE[p.grade] ?? 55 }));
  }, [topProps]);

  const statLabel = tab === "PTS" ? "pts" : tab === "REB" ? "reb" : "ast";

  return (
    <div className="space-y-4">

      {/* ── Top ce soir ── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(8,8,14,.80)",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,.40)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-0.5 flex-shrink-0 rounded-full" style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Top ce soir</h2>
              <p className="mt-0.5 text-[12px] text-white/35">
                {leaderboard?.playingTeams?.length
                  ? `${leaderboard.playingTeams.length} équipes · moyenne saison`
                  : "Moyenne saison · NBA"}
              </p>
            </div>
          </div>

          <TabGroup
            value={tab}
            onChange={(v) => setTab(v as "PTS" | "REB" | "AST")}
            options={[
              { value: "PTS", label: "PTS" },
              { value: "REB", label: "REB" },
              { value: "AST", label: "AST" },
            ]}
          />
        </div>

        {/* Entries */}
        <div className="mt-3 space-y-1.5">
          {leaderboardLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl"
                style={{ background: "rgba(255,255,255,.03)" }}
              />
            ))}

          {!leaderboardLoading && entries.length === 0 && (
            <div
              className="rounded-xl py-10 text-center text-[11px]"
              style={{ background: "rgba(0,0,0,.15)", color: "rgba(255,255,255,.20)" }}
            >
              Aucun match ce soir ou données insuffisantes.
            </div>
          )}

          {entries.map((entry, index) => {
            const accentColor = getTeamPrimaryColor(entry.teamCode);
            const rankAccent = RANK_ACCENT[index] ?? RANK_ACCENT[4];
            const isUp = entry.trend === "up";
            const isDown = entry.trend === "down";

            return (
              <Link
                key={entry.playerId}
                href={`/nba/players/${entry.playerId}`}
                className="group flex items-center gap-3 rounded-xl border p-2.5 text-left transition"
                style={{
                  background: index === 0
                    ? `linear-gradient(135deg, ${hexToRgba(accentColor, 0.07)} 0%, rgba(5,5,8,.97) 65%)`
                    : "rgba(255,255,255,.02)",
                  border: index === 0
                    ? `1px solid ${hexToRgba(accentColor, 0.18)}`
                    : "1px solid rgba(255,255,255,.05)",
                }}
              >
                {/* Rank */}
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                  style={{
                    color: rankAccent,
                    background: index < 3 ? hexToRgba(rankAccent, 0.10) : "rgba(255,255,255,.04)",
                    border: `1px solid ${hexToRgba(rankAccent, 0.18)}`,
                  }}
                >
                  {index + 1}
                </span>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold text-white/90 group-hover:text-white">
                      {entry.playerName}
                    </p>
                    {entry.position && (
                      <span
                        className="flex-shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase"
                        style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.30)" }}
                      >
                        {entry.position}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,.28)" }}>
                    {entry.teamCode}
                    {entry.last5Avg !== null && (
                      <span
                        className="ml-1.5"
                        style={{
                          color: isUp ? "#34d399" : isDown ? "#f87171" : "rgba(255,255,255,.22)",
                        }}
                      >
                        {isUp ? "▲" : isDown ? "▼" : "·"} L5: {formatDecimal(entry.last5Avg, 1)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Stat */}
                <div className="flex items-baseline gap-0.5">
                  <span
                    className="text-[20px] font-black tabular-nums leading-none"
                    style={{ color: index === 0 ? "#ffb14a" : "rgba(255,255,255,.80)" }}
                  >
                    {formatDecimal(entry.seasonAvg, 1)}
                  </span>
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,.22)" }}>
                    {statLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Best Props du soir ── */}
      {(topPropsLoading || hitRateProps.length > 0) && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(8,8,14,.80)",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow: "0 12px 40px rgba(0,0,0,.40)",
          }}
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-0.5 flex-shrink-0 rounded-full" style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Meilleures props</h2>
              <p className="mt-0.5 text-[12px] text-white/35">Classées par grade Betalyze · NBA</p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {topPropsLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-xl"
                  style={{ background: "rgba(255,255,255,.03)" }}
                />
              ))}

            {hitRateProps.map((prop) => {
              const primary = getTeamPrimaryColor(String(prop.awayCode ?? ""));
              const { hitRate } = prop;
              const gs = gradeStyle(prop.grade);
              const hitColor =
                hitRate >= 80 ? "#34d399" : hitRate >= 70 ? "#ffb14a" : hitRate >= 60 ? "#fb923c" : "rgba(255,255,255,.30)";
              const barColor =
                hitRate >= 80 ? "rgba(52,211,153,.65)"
                : hitRate >= 70 ? "rgba(255,177,74,.65)"
                : hitRate >= 60 ? "rgba(251,146,60,.65)"
                : "rgba(255,255,255,.12)";
              const isTopGrade = prop.grade === "S" || prop.grade === "A";
              const playerHref = prop.playerId ? `/nba/players/${prop.playerId}` : null;
              const edgePositive = prop.edge > 0;

              const cardContent = (
                <div
                  className="flex h-full flex-col justify-between rounded-xl border p-3 transition"
                  style={{
                    background: isTopGrade
                      ? `linear-gradient(135deg, ${hexToRgba(primary, 0.09)} 0%, rgba(5,5,8,.97) 70%)`
                      : "rgba(255,255,255,.02)",
                    border: isTopGrade
                      ? `1px solid ${hexToRgba(primary, 0.20)}`
                      : "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  {/* Row 1: grade + metric | hit rate */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Grade badge */}
                      <span
                        className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black"
                        style={{ background: gs.bg, color: gs.color }}
                      >
                        {prop.grade}
                      </span>
                      {/* Metric pill */}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(0,0,0,.25)",
                          border: "1px solid rgba(255,255,255,.09)",
                          color: "rgba(255,255,255,.50)",
                        }}
                      >
                        {String(prop.metric).toUpperCase()} O {formatDecimal(prop.line, 1)}
                      </span>
                    </div>
                    {/* Hit rate */}
                    <span
                      className="flex-shrink-0 text-[18px] font-black tabular-nums leading-none"
                      style={{ color: hitColor }}
                    >
                      {hitRate}%
                    </span>
                  </div>

                  {/* Row 2: player + edge */}
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-white/90 leading-tight">
                        {prop.player}
                      </p>
                      <p className="text-[10px]" style={{ color: "rgba(255,255,255,.28)" }}>
                        {prop.awayCode && prop.homeCode
                          ? `${prop.awayCode} · vs ${prop.homeCode}`
                          : (prop.awayCode ?? prop.homeCode ?? "")}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: edgePositive ? "#34d399" : "rgba(255,255,255,.25)" }}
                      >
                        {edgePositive ? "+" : ""}{prop.edge}%
                      </span>
                      <p className="text-[9px]" style={{ color: "rgba(255,255,255,.20)" }}>
                        BZ {prop.finalScore}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="mt-2.5 h-[3px] overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${hitRate}%`, background: barColor }}
                    />
                  </div>
                </div>
              );

              return playerHref ? (
                <Link
                  key={prop.id}
                  href={playerHref}
                  className="group block hover:opacity-90 transition"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={prop.id}>{cardContent}</div>
              );
            })}
          </div>

          <p className="mt-3 text-[9px]" style={{ color: "rgba(255,255,255,.15)" }}>
            * Grade basé sur edge, forme récente, hit rate et matchup — Betalyze Score Engine
          </p>
        </div>
      )}
    </div>
  );
}
