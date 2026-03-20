// app/api/nba/sync-players-v2/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  pruneNbaPlayersForSeason,
  upsertNbaPlayersForSeason,
  type NbaPlayerRecord,
} from "@/lib/nba/players-db";

const API_BASE =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON =
  process.env.APISPORTS_NBA_SEASON || "2025";
const LEAGUE = (() => {
  const raw = String(process.env.APISPORTS_NBA_LEAGUE_ID ?? "standard")
    .trim()
    .toLowerCase();
  if (!raw || raw === "nba" || raw === "12") return "standard";
  return raw;
})();
const MIN_SAFE_PLAYERS_FOR_PRUNE = 350;

// l'API NBA v2 attend un entier (ex: 2025 pour la saison 2025-2026)
function seasonInt(value: string): string {
  const match = value.match(/(\d{4})/);
  return match ? match[1] : value;
}

type ApiPlayer = {
  id: number;
  name?: string;
  position?: string;
  number?: number | string | null;
  country?: string | null;
  firstname?: string;
  lastname?: string;
  birth?: { date?: string | null; country?: string | null };
  height?: { meters?: string | null };
  weight?: { kilograms?: string | null };
  leagues?: { standard?: { jersey?: number; active?: boolean; pos?: string } };
  team?: { id?: number; name?: string };
};

type ApiResponse = {
  response: ApiPlayer[];
  results?: number;
  errors?: any;
};

type CollectedApiPlayer = ApiPlayer & {
  _teamIdHint?: number | null;
  _teamNameHint?: string | null;
};

function positiveIntOrNull(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  return t > 0 ? t : null;
}

export async function GET() {
  if (!API_BASE || !API_KEY) {
    return NextResponse.json(
      { error: "API key/URL missing" },
      { status: 500 },
    );
  }

  if (API_BASE.includes("basketball")) {
    return NextResponse.json(
      {
        error:
          "APISPORTS_NBA_URL must point to NBA v2 (v2.nba.api-sports.io). Basketball v1 fallback is disabled.",
      },
      { status: 500 },
    );
  }

  const season = seasonInt(RAW_SEASON);
  const collected: CollectedApiPlayer[] = [];
  const attempts: Array<{
    team?: number;
    page?: number;
    results?: number;
    errors?: any;
    url?: string;
    step?: string;
  }> = [];

  try {
    // 1) Récupérer la liste des équipes NBA v2 pour la saison
    const teamSeasonCandidates = [season];
    let teamIds: number[] = [];
    const teamNameById = new Map<number, string>();
    let resolvedSeasonForTeams = season;
    for (const teamSeason of teamSeasonCandidates) {
      const teamUrls = [
        (() => {
          const url = new URL("/teams", API_BASE);
          url.searchParams.set("league", LEAGUE);
          url.searchParams.set("season", teamSeason);
          return url.toString();
        })(),
        (() => {
          const url = new URL("/teams", API_BASE);
          return url.toString();
        })(),
      ];

      for (const teamUrl of teamUrls) {
        const resTeams = await fetch(teamUrl, {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        const teamsData = resTeams.ok ? ((await resTeams.json()) as any) : null;
        const ids =
          teamsData && Array.isArray(teamsData.response)
            ? teamsData.response
                .filter((t: any) => t?.nbaFranchise === true)
                .map((t: any) => t.id)
                .filter(Boolean)
            : [];
        if (teamsData && Array.isArray(teamsData.response)) {
          for (const t of teamsData.response) {
            if (t?.nbaFranchise !== true) continue;
            const id = Number(t?.id ?? NaN);
            const name = String(t?.name ?? "").trim();
            if (Number.isFinite(id) && id > 0 && name) {
              teamNameById.set(id, name);
            }
          }
        }
        attempts.push({
          step: "teams",
          results: teamsData?.results,
          errors: teamsData?.errors ?? (!resTeams.ok ? resTeams.status : undefined),
          url: teamUrl,
        });
        if (ids.length) {
          teamIds = ids;
          resolvedSeasonForTeams = teamSeason;
          break;
        }
      }
      if (teamIds.length) break;
    }

    if (!teamIds.length) {
      return NextResponse.json(
        {
          ok: true,
          saved: "",
          count: 0,
          attempts,
          error: "No teams returned. Check league or API access.",
        },
        { status: 200 },
      );
    }

    // 2) Pour chaque équipe, appeler /players avec team et season (pas de page, pas de league)
    for (const tid of teamIds) {
      const url = new URL("/players", API_BASE);
      url.searchParams.set("team", String(tid));
      // saison entière (ex: 2024)
      url.searchParams.set("season", resolvedSeasonForTeams);

      const res = await fetch(url.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        attempts.push({
          team: tid,
          errors: `${res.status} ${text}`,
          url: url.toString(),
        });
        continue;
      }

      const data = (await res.json()) as ApiResponse;
      attempts.push({ team: tid, results: data.results, errors: data.errors, url: url.toString() });

      if (Array.isArray(data.response) && data.response.length > 0) {
        const teamNameHint = teamNameById.get(tid) ?? null;
        collected.push(
          ...data.response.map((p) => ({
            ...p,
            _teamIdHint: tid,
            _teamNameHint: teamNameHint,
          })),
        );
      }
    }

    const mapped: NbaPlayerRecord[] = collected.map((p) => {
      const resolvedTeamId =
        positiveIntOrNull(p.team?.id) ?? positiveIntOrNull(p._teamIdHint) ?? null;
      const resolvedTeamName = p.team?.name ?? p._teamNameHint ?? null;
      const firstName = p.firstname ?? null;
      const lastName = p.lastname ?? null;
      const fullNameFromSplit = [firstName, lastName].filter(Boolean).join(" ").trim();
      return {
        id: p.id,
        firstName,
        lastName,
        fullName: fullNameFromSplit || p.name || `Player ${p.id}`,
        // NBA v2 /players often returns team.id = 0 or null.
        // Keep only strictly positive ids and fallback to loop team hint.
        teamId: resolvedTeamId,
        teamName: resolvedTeamName,
        teamCode: null,
        position: p.leagues?.standard?.pos ?? null,
        jerseyNumber: p.leagues?.standard?.jersey
          ? String(p.leagues.standard.jersey)
          : null,
        age: null,
        nationality: p.birth?.country ?? null,
        height: p.height?.meters ?? null,
        weight: p.weight?.kilograms ?? null,
        birthDate: p.birth?.date ?? null,
        isActive: p.leagues?.standard?.active ?? null,
      };
    });

    const dedupedById = new Map<number, NbaPlayerRecord>();
    for (const player of mapped) {
      if (!Number.isFinite(player.id)) continue;
      dedupedById.set(player.id, player);
    }
    const uniquePlayers = Array.from(dedupedById.values());

    const payload = {
      season,
      updatedAt: new Date().toISOString(),
      count: uniquePlayers.length,
      players: uniquePlayers,
    };

    const outFile = path.join(
      process.cwd(),
      "data",
      `nba-players-nba-v2-${season}.json`,
    );
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf-8");

    const dbUpserted = await upsertNbaPlayersForSeason({
      season,
      source: "sync-players-v2",
      players: uniquePlayers,
    }).catch(() => 0);
    const prune = await pruneNbaPlayersForSeason({
      season,
      keepPlayerIds: uniquePlayers.map((player) => player.id),
      minKeepCount: MIN_SAFE_PLAYERS_FOR_PRUNE,
    }).catch(() => ({ kept: uniquePlayers.length, deleted: 0, skipped: true }));

    return NextResponse.json({
      ok: true,
      saved: outFile,
      count: uniquePlayers.length,
      dbUpserted,
      prune,
      attempts,
    });
  } catch (err: any) {
    console.error("sync-players-v2 error", err);
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
