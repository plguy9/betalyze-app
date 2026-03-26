"use client";

import { useRouter } from "next/navigation";
import { Card, TabGroup } from "./nba-ui";
import {
  gradeTone,
  formatDecimal,
  formatOddsForDisplay,
  type OddsDisplayFormat,
  formatEdge,
  trendMetricParamFromTopMetric,
  normalizeBookmakerQueryValue,
  getTeamPrimaryColor,
  hexToRgba,
} from "./nba-helpers";
import { TOP_PROPS_PAGE_SIZE } from "@/lib/nba/constants";
import type { NbaTopProp, BetalyzeNbaTeam } from "./nba-shared-types";
import type { NbaSidebarPage } from "./nba-sidebar";

type Props = {
  topPropsPagedDisplay: NbaTopProp[];
  topPropsDisplay: NbaTopProp[];
  topPropsLoading: boolean;
  topPropsError: string | null;
  topPropsActionMessage: { text: string; error: boolean } | null;
  topPropsOu: "ALL" | "OVER" | "UNDER";
  setTopPropsOu: (v: "ALL" | "OVER" | "UNDER") => void;
  topPropsSortBy: "GRADE" | "EDGE";
  setTopPropsSortBy: (v: "GRADE" | "EDGE") => void;
  topPropsGameFilter: string;
  setTopPropsGameFilter: (v: string) => void;
  topPropsGameOptions: Array<{ value: string; label: string }>;
  topPropsPage: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  topPropsPageCount: number;
  addTopPropToJournal: (prop: NbaTopProp, teamLabel: string, oppLabel: string) => void;
  addTopPropToParlay: (prop: NbaTopProp) => void;
  isTopPropInParlay: (prop: NbaTopProp) => boolean;
  parlayAddedId: string | null;
  journalAddingId: string | null;
  journalAddedId: string | null;
  teamMetaByCode: Map<string, BetalyzeNbaTeam>;
  gameTimeById: Map<number, string>;
  sidebarActive: NbaSidebarPage;
  oddsFormat: OddsDisplayFormat;
};

export function BestPropsSection({
  topPropsPagedDisplay,
  topPropsDisplay,
  topPropsLoading,
  topPropsError,
  topPropsActionMessage,
  topPropsOu,
  setTopPropsOu,
  topPropsSortBy,
  setTopPropsSortBy,
  topPropsGameFilter,
  setTopPropsGameFilter,
  topPropsGameOptions,
  topPropsPage,
  onPrevPage,
  onNextPage,
  topPropsPageCount,
  addTopPropToJournal,
  addTopPropToParlay,
  isTopPropInParlay,
  parlayAddedId,
  journalAddingId,
  journalAddedId,
  teamMetaByCode,
  gameTimeById,
  sidebarActive,
  oddsFormat,
}: Props) {
  const router = useRouter();

  return (
    <Card>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-5 w-0.5 flex-shrink-0 rounded-full" style={{ background: "linear-gradient(to bottom, #ff8a00, #ffb14a44)" }} />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Picks du soir</h2>
              <p className="mt-0.5 text-[12px] text-white/35">Classés par grade Betalyze · NBA</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              <span className="text-[11px] text-white/45">Game</span>
              <select
                value={topPropsGameFilter}
                onChange={(e) => setTopPropsGameFilter(e.target.value)}
                className="max-w-[120px] bg-transparent text-[11px] font-medium text-white/90 outline-none sm:max-w-none sm:min-w-[150px]"
              >
                {topPropsGameOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0b0f18] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <TabGroup
              value={topPropsOu}
              onChange={(v) => setTopPropsOu(v as "ALL" | "OVER" | "UNDER")}
              options={[
                { value: "ALL", label: "Tous" },
                { value: "OVER", label: "Over" },
                { value: "UNDER", label: "Under" },
              ]}
            />
            <TabGroup
              value={topPropsSortBy}
              onChange={(v) => setTopPropsSortBy(v as "GRADE" | "EDGE")}
              options={[
                { value: "GRADE", label: "Note" },
                { value: "EDGE", label: "Edge" },
              ]}
            />
          </div>
        </div>

        {topPropsError && (
          <p className="mt-3 text-[11px] text-rose-300">{topPropsError}</p>
        )}
        {topPropsActionMessage && (
          <p
            className={
              "mt-2 text-[11px] " +
              (topPropsActionMessage.error ? "text-rose-300" : "text-emerald-300")
            }
          >
            {topPropsActionMessage.text}
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {topPropsLoading && (
            <p className="text-[11px] text-slate-500">Chargement des props…</p>
          )}
          {!topPropsLoading && topPropsDisplay.length === 0 && (
            <div className="col-span-full rounded-xl border border-white/10 bg-black/20 py-16 text-center text-white/50">
              <div className="mb-3 text-2xl">🏀</div>
              {topPropsGameFilter === "ALL"
                ? "Aucune game NBA disponible actuellement"
                : "Aucune prop disponible pour ce match"}
            </div>
          )}

          {topPropsPagedDisplay.map((p) => {
            const team = teamMetaByCode.get(p.awayCode);
            const opp = teamMetaByCode.get(p.homeCode);
            const teamLabel =
              team?.code ?? team?.name ?? (p.awayCode && p.awayCode !== "—" ? p.awayCode : "—");
            const oppLabel =
              opp?.code ?? opp?.name ?? (p.homeCode && p.homeCode !== "—" ? p.homeCode : "—");
            const oppDisplay = oppLabel === "—" ? "?" : oppLabel;
            const primary = getTeamPrimaryColor(p.awayCode);
            const isTopGrade = p.grade === "S" || p.grade === "A";
            const gradientOpacity = isTopGrade ? 0.22 : p.grade === "B" ? 0.15 : 0.10;
            const borderOpacity = isTopGrade ? 0.50 : p.grade === "B" ? 0.35 : 0.22;
            const sideLabel = p.side === "over" ? "Over" : "Under";
            const matchTime =
              Number.isFinite(Number(p.gameId ?? NaN)) && Number(p.gameId) > 0
                ? gameTimeById.get(Number(p.gameId)) ?? null
                : null;
            const edgePos = p.edge > 0;

            const qs = new URLSearchParams();
            const metricParam = trendMetricParamFromTopMetric(p.metric);
            if (metricParam) qs.set("metric", metricParam);
            if (Number.isFinite(p.line)) qs.set("line", String(p.line));
            if (p.side === "over" || p.side === "under") qs.set("side", p.side);
            if (Number.isFinite(Number(p.gameId ?? NaN))) qs.set("gameId", String(p.gameId));
            if (Number.isFinite(Number(p.score ?? NaN))) qs.set("score", String(Math.round(Number(p.score))));
            if (p.grade) qs.set("grade", String(p.grade).toUpperCase());
            if (p.homeCode) qs.set("opp", String(p.homeCode).toUpperCase());
            const bookmakerParam = normalizeBookmakerQueryValue(p.bookmaker);
            if (bookmakerParam) qs.set("bookmaker", bookmakerParam);
            const href = p.playerId
              ? `/nba/players/${p.playerId}${qs.toString() ? `?${qs.toString()}` : ""}`
              : null;
            const isAdding = journalAddingId === p.id;
            const isAdded = journalAddedId === p.id;
            const isInParlay = isTopPropInParlay(p);
            const isParlayFlashAdded = parlayAddedId === p.id;

            return (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-xl border transition"
                style={{
                  background: `linear-gradient(135deg, ${hexToRgba(primary, gradientOpacity)} 0%, rgba(5,5,8,.97) 60%)`,
                  borderColor: hexToRgba(primary, borderOpacity),
                  boxShadow: `inset 3px 0 0 ${hexToRgba(primary, isTopGrade ? 0.70 : p.grade === "B" ? 0.50 : 0.35)}`,
                }}
              >
                {/* Top row: grade + matchup */}
                <div
                  className="flex items-center justify-between px-3 pt-2.5"
                >
                  {/* Grade */}
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ring-1 ${gradeTone(p.grade)}`}>
                    {p.grade}
                  </span>

                  {/* Matchup + time */}
                  <div className="flex items-center gap-1.5">
                    {team?.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={team.logo} alt={teamLabel} className="h-4 w-4 object-contain opacity-80" />
                    )}
                    <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>
                      {teamLabel}
                    </span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,.20)" }}>vs</span>
                    {opp?.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opp.logo} alt={oppDisplay} className="h-4 w-4 object-contain opacity-80" />
                    )}
                    <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>
                      {oppDisplay}
                    </span>
                    {matchTime && (
                      <span className="text-[9px]" style={{ color: "rgba(255,255,255,.22)" }}>· {matchTime}</span>
                    )}
                  </div>
                </div>

                {/* Main content: player + line */}
                <div
                  role={href ? "button" : undefined}
                  tabIndex={href ? 0 : undefined}
                  onClick={() => { if (!href) return; router.push(href); }}
                  onKeyDown={(e) => {
                    if (!href) return;
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); }
                  }}
                  className={href ? "cursor-pointer" : ""}
                  title={href ? `Ouvrir la page joueur de ${p.player}` : undefined}
                >
                  <div className="px-3 pb-0 pt-2">
                    <p className="truncate text-[15px] font-bold leading-tight text-white/95 group-hover:text-white">
                      {p.player}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: "rgba(0,0,0,.30)",
                          border: "1px solid rgba(255,255,255,.10)",
                          color: "rgba(255,255,255,.65)",
                        }}
                      >
                        {p.metric} {sideLabel} {formatDecimal(p.line, 1)}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
                        style={{
                          background: "rgba(0,0,0,.25)",
                          border: "1px solid rgba(255,255,255,.08)",
                          color: "rgba(255,255,255,.50)",
                        }}
                      >
                        {formatOddsForDisplay(p.odds, oddsFormat)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom row: edge + score + actions */}
                <div className="mt-2.5 flex items-center justify-between border-t px-3 py-2"
                  style={{ borderColor: "rgba(255,255,255,.06)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: edgePos ? "#34d399" : "rgba(255,255,255,.30)" }}
                    >
                      {formatEdge(p.edge)} edge
                    </span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,.25)" }}>
                      BZ <span className="font-bold text-white/50">{formatDecimal(p.score, 0)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addTopPropToParlay(p);
                      }}
                      className={
                        "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition " +
                        (isInParlay || isParlayFlashAdded
                          ? "border-sky-500/35 bg-sky-500/12 text-sky-200"
                          : "border-white/12 bg-white/5 text-white/55 hover:border-white/25 hover:bg-white/10 hover:text-white/80")
                      }
                    >
                      {isParlayFlashAdded ? "✓ Parlay" : isInParlay ? "Ouvrir Slip" : "+ Parlay"}
                    </button>

                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const teamMeta = teamMetaByCode.get(p.awayCode);
                        const oppMeta = teamMetaByCode.get(p.homeCode);
                        void addTopPropToJournal(
                          p,
                          teamMeta?.code ?? teamMeta?.name ?? p.awayCode ?? "—",
                          oppMeta?.code ?? oppMeta?.name ?? p.homeCode ?? "—",
                        );
                      }}
                      className={
                        "rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition " +
                        (isAdded
                          ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
                          : "border-white/12 bg-white/5 text-white/55 hover:border-white/25 hover:bg-white/10 hover:text-white/80") +
                        (isAdding ? " cursor-not-allowed opacity-60" : "")
                      }
                    >
                      {isAdding ? "..." : isAdded ? "✓ Journal" : "+ Journal"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bas de section : pagination + filtres actifs + BZ info ── */}
        <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "rgba(255,255,255,.06)" }}>

          {/* Pagination */}
          {!topPropsLoading && topPropsDisplay.length > TOP_PROPS_PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30 tabular-nums">
                {topPropsDisplay.length} picks · page {topPropsPage} / {topPropsPageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrevPage}
                  disabled={topPropsPage <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                >
                  ‹
                </button>
                <span
                  className="min-w-[48px] rounded-lg px-2.5 py-1 text-center text-[11px] font-semibold tabular-nums"
                  style={{ background: "rgba(255,138,0,.12)", color: "#ffb14a", border: "1px solid rgba(255,138,0,.20)" }}
                >
                  {topPropsPage} / {topPropsPageCount}
                </span>
                <button
                  type="button"
                  onClick={onNextPage}
                  disabled={topPropsPage >= topPropsPageCount}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                >
                  ›
                </button>
              </div>
            </div>
          )}

          {/* Filtres actifs + BZ tooltip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {topPropsGameFilter !== "ALL" && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45">
                  {topPropsGameOptions.find((o) => o.value === topPropsGameFilter)?.label ?? "Match"}
                </span>
              )}
              {topPropsOu !== "ALL" && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45">
                  {topPropsOu === "OVER" ? "Over" : "Under"}
                </span>
              )}
              {topPropsSortBy !== "GRADE" && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/45">
                  Tri : Edge
                </span>
              )}
              {topPropsGameFilter === "ALL" && topPropsOu === "ALL" && topPropsSortBy === "GRADE" && (
                <span className="text-[10px] text-white/20">Aucun filtre actif</span>
              )}
            </div>

            {/* BZ Score tooltip */}
            <div className="group/bz relative cursor-help">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/35 transition group-hover/bz:border-amber-500/25 group-hover/bz:text-amber-400/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500/50" />
                Score Betalyze
              </span>
              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-60 rounded-2xl border border-white/10 bg-[#0d0d0f] p-3.5 opacity-0 shadow-2xl transition-opacity duration-150 group-hover/bz:opacity-100">
                <p className="mb-1.5 text-[12px] font-semibold text-white/90">Score Betalyze (0 – 100)</p>
                <p className="text-[11px] leading-relaxed text-white/50">
                  Évalue chaque pick selon plusieurs signaux propriétaires : forme récente du joueur, qualité du matchup défensif et valeur perçue des cotes. Plus le score est élevé, plus l'opportunité est jugée favorable.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">75+ Excellent</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-400">55–74 Bon</span>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-semibold text-white/35">&lt;55 Faible</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Card>
  );
}
