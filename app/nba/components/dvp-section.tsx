"use client";

import { Card, SectionHeader, TabGroup } from "./nba-ui";
import { formatDvpNumber, formatDvpPercent } from "./nba-helpers";
import type {
  NbaDvpWindow,
  NbaDvpPosition,
  NbaDvpSortKey,
  NbaDvpRow,
  BetalyzeNbaTeam,
} from "./nba-shared-types";

type DvpColumn = { key: NbaDvpSortKey; label: string; percent: boolean };

type Props = {
  dvpWindow: NbaDvpWindow;
  setDvpWindow: (v: NbaDvpWindow) => void;
  dvpPosition: NbaDvpPosition;
  setDvpPosition: (v: NbaDvpPosition) => void;
  dvpSorted: NbaDvpRow[];
  dvpLoading: boolean;
  dvpError: string | null;
  dvpSortKey: NbaDvpSortKey;
  dvpColumns: DvpColumn[];
  applyDvpSort: (key: NbaDvpSortKey) => void;
  sortIndicator: (key: NbaDvpSortKey) => string;
  tierForRank: (rank?: number | null) => { label: string; tone: string };
  dvpTeamsById: Map<number, BetalyzeNbaTeam>;
  teamMetaByCode: Map<string, BetalyzeNbaTeam>;
  resolveDvpValue: (row: NbaDvpRow, key: NbaDvpSortKey) => number | null;
  onRefresh: () => void;
  formatTeamCode: (teamId?: number | null, teamName?: string | null) => string;
};

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-white/5">
      <td className="px-3 py-2.5"><div className="h-2.5 w-4 animate-pulse rounded-full bg-white/[0.06]" /></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/[0.07]" />
        </div>
      </td>
      <td className="px-3 py-2.5 text-center"><div className="mx-auto h-2.5 w-10 animate-pulse rounded-full bg-white/[0.06]" /></td>
      <td className="px-3 py-2.5 text-center"><div className="mx-auto h-2.5 w-6 animate-pulse rounded-full bg-white/[0.06]" /></td>
      <td className="px-3 py-2.5 text-center"><div className="mx-auto h-4 w-10 animate-pulse rounded-full bg-white/[0.06]" /></td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2.5 text-center">
          <div className="mx-auto h-2.5 w-8 animate-pulse rounded-full bg-white/[0.05]" />
        </td>
      ))}
    </tr>
  );
}

export function DvpSection({
  dvpWindow,
  setDvpWindow,
  dvpPosition,
  setDvpPosition,
  dvpSorted,
  dvpLoading,
  dvpError,
  dvpSortKey,
  dvpColumns,
  applyDvpSort,
  sortIndicator,
  tierForRank,
  dvpTeamsById,
  teamMetaByCode,
  resolveDvpValue,
  onRefresh,
  formatTeamCode,
}: Props) {
  return (
    <div className="space-y-5">

      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Defense vs Position</h1>
          <p className="mt-0.5 text-[13px] text-white/40">Analyse défensive par position · NBA</p>
        </div>
      </div>

    <Card id="nba-dvp">
      <div className="p-4 sm:p-6">
        <SectionHeader
          title="Defense vs Position"
          subtitle={`Concessions par poste · NBA${!dvpLoading && dvpSorted.length > 0 ? ` · ${dvpSorted.length} équipes` : ""}`}
          info="Mesure combien de points/rebonds/passes chaque équipe concède aux Guards, Forwards et Centers adverses. Un rang élevé = défense faible = favorable pour les Overs."
        >
          <TabGroup
            value={dvpWindow}
            onChange={(v) => setDvpWindow(v as NbaDvpWindow)}
            options={[
              { value: "season", label: "Saison" },
              { value: "L10", label: "L10" },
              { value: "L5", label: "L5" },
            ]}
          />
          <TabGroup
            value={dvpPosition}
            onChange={(v) => setDvpPosition(v as NbaDvpPosition)}
            options={[
              { value: "G", label: "G" },
              { value: "F", label: "F" },
              { value: "C", label: "C" },
            ]}
          />
        </SectionHeader>

        {dvpError && (
          <p className="mt-4 text-[11px] text-rose-400">Erreur : {dvpError}</p>
        )}

        {!dvpLoading && !dvpError && dvpSorted.length === 0 && (
          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center">
            <p className="text-sm text-white/40">Pas encore de données DvP</p>
            <p className="mt-1 text-[10px] text-white/25">Les logs NBA sont en cours de compilation</p>
          </div>
        )}

        {/* Table */}
        {(dvpLoading || dvpSorted.length > 0) && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
            <table className="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead>
                <tr className="border-b border-white/8 text-[9px] uppercase tracking-[0.14em] text-white/35">
                  <th className="px-3 py-2.5 text-left font-semibold">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Équipe</th>
                  <th
                    className={`cursor-pointer px-3 py-2.5 text-center font-semibold transition hover:text-white/60 ${dvpSortKey === "btp" ? "text-amber-400/80" : ""}`}
                    onClick={() => applyDvpSort("btp")}
                  >
                    BTP/M {sortIndicator("btp")}
                  </th>
                  <th
                    className={`cursor-pointer px-3 py-2.5 text-center font-semibold transition hover:text-white/60 ${dvpSortKey === "games" ? "text-amber-400/80" : ""}`}
                    onClick={() => applyDvpSort("games")}
                  >
                    MJ {sortIndicator("games")}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">Tier</th>
                  {dvpColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`cursor-pointer px-3 py-2.5 text-center font-semibold transition hover:text-white/60 ${dvpSortKey === col.key ? "text-amber-400/80" : ""}`}
                      onClick={() => applyDvpSort(col.key)}
                    >
                      {col.label} {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dvpLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={dvpColumns.length} />)
                ) : (
                  dvpSorted.map((row) => {
                    const inferredCode = String(
                      row.teamAbbr ?? formatTeamCode(row.teamId, row.teamName ?? null),
                    )
                      .trim()
                      .toUpperCase();
                    const byId = dvpTeamsById.get(Number(row.teamId));
                    const byCode = inferredCode ? teamMetaByCode.get(inferredCode) : undefined;
                    const teamMeta = byId ?? byCode;
                    const name = row.teamName ?? teamMeta?.fullName ?? teamMeta?.name ?? `Team ${row.teamId}`;
                    const abbr = row.teamAbbr ?? teamMeta?.code ?? formatTeamCode(row.teamId, name);
                    const logo = teamMeta?.logo ?? null;
                    const rank = row.rank ?? null;
                    const isTop = rank !== null && rank <= 5;
                    const isBottom = rank !== null && rank >= 26;
                    const tier = tierForRank(rank);

                    return (
                      <tr
                        key={`${row.teamId}-${row.position}-${row.window}-${row.context}`}
                        className="border-t border-white/5 transition hover:bg-white/[0.03]"
                      >
                        {/* Rank */}
                        <td className="px-3 py-2">
                          <span className={`text-[11px] font-bold ${isTop ? "text-emerald-400/80" : isBottom ? "text-rose-400/80" : "text-white/30"}`}>
                            {rank ?? "-"}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt={name} className="h-5 w-5 shrink-0 rounded object-contain" />
                            ) : (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/15 bg-white/8 text-[7px] font-bold text-white/60">
                                {abbr.slice(0, 3)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-medium text-white/85">{abbr}</p>
                            </div>
                          </div>
                        </td>

                        {/* BTP/G */}
                        <td className={`px-3 py-2 text-center font-semibold ${dvpSortKey === "btp" ? "text-amber-300" : "text-white/70"}`}>
                          {formatDvpNumber(row.btpPerGame)}
                        </td>

                        {/* GP */}
                        <td className={`px-3 py-2 text-center ${dvpSortKey === "games" ? "text-amber-300" : "text-white/40"}`}>
                          {row.games}
                        </td>

                        {/* Tier */}
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tier.tone}`}>
                            {tier.label}
                          </span>
                        </td>

                        {/* Dynamic columns */}
                        {dvpColumns.map((col) => {
                          const value = resolveDvpValue(row, col.key);
                          return (
                            <td
                              key={`${row.teamId}-${col.key}`}
                              className={`px-3 py-2 text-center ${dvpSortKey === col.key ? "text-amber-300/80" : "text-white/50"}`}
                            >
                              {col.percent ? formatDvpPercent(value) : formatDvpNumber(value)}
                            </td>
                          );
                        })}
                      </tr>
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
