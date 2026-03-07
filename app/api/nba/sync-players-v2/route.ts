// app/api/nba/sync-players-v2/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  nbaSeasonAliases,
  normalizeNbaSeasonLabel,
  upsertNbaPlayersForSeason,
  type NbaPlayerRecord,
} from "@/lib/nba/players-db";

const API_BASE =
  process.env.APISPORTS_BASKETBALL_URL ||
  process.env.APISPORTS_NBA_URL ||
  "https://v1.basketball.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON =
  process.env.APISPORTS_BASKETBALL_SEASON ||
  process.env.APISPORTS_NBA_SEASON ||
  "2025-2026";
const LEAGUE =
  process.env.APISPORTS_BASKETBALL_LEAGUE_ID ||
  process.env.APISPORTS_NBA_LEAGUE_ID ||
  "12";
const IS_BASKETBALL_V1 = API_BASE.includes("basketball");

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

export async function GET() {
  if (!API_BASE || !API_KEY) {
    return NextResponse.json(
      { error: "API key/URL missing" },
      { status: 500 },
    );
  }

  const season = IS_BASKETBALL_V1 ? normalizeNbaSeasonLabel(RAW_SEASON) : seasonInt(RAW_SEASON);
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
    // Essayer plusieurs variantes pour lister les équipes (sans league)
    const teamSeasonCandidates = IS_BASKETBALL_V1
      ? nbaSeasonAliases(RAW_SEASON)
      : [season];
    let teamIds: number[] = [];
    const teamNameById = new Map<number, string>();
    let resolvedSeasonForTeams = season;
    for (const teamSeason of teamSeasonCandidates) {
      const teamUrl = (() => {
        const url = new URL("/teams", API_BASE);
        if (IS_BASKETBALL_V1) {
          url.searchParams.set("league", LEAGUE);
          url.searchParams.set("season", teamSeason);
        }
        return url.toString();
      })();
      const resTeams = await fetch(teamUrl, {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      const teamsData = resTeams.ok ? ((await resTeams.json()) as any) : null;
      const ids =
        teamsData && Array.isArray(teamsData.response)
          ? teamsData.response.map((t: any) => t.id).filter(Boolean)
          : [];
      if (teamsData && Array.isArray(teamsData.response)) {
        for (const t of teamsData.response) {
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
        attempts.push({ team: tid, errors: res.status + " " + text, url: url.toString() });
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
      if (IS_BASKETBALL_V1) {
        const rawName = p.name ?? "";
        const parts = rawName.split(/\s+/).filter(Boolean);
        const firstName = parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null;
        const lastName =
          parts.length >= 2 ? parts.slice(0, -1).join(" ") : null;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || rawName;
        return {
          id: p.id,
          firstName,
          lastName,
          fullName,
          teamId: p.team?.id ?? p._teamIdHint ?? null,
          teamName: p.team?.name ?? p._teamNameHint ?? null,
          teamCode: null,
          position: p.position ?? null,
          jerseyNumber: p.number ? String(p.number) : null,
          age: null,
          nationality: p.country ?? null,
          height: null,
          weight: null,
          birthDate: null,
          isActive: null,
        };
      }
      return {
        id: p.id,
        firstName: p.firstname ?? null,
        lastName: p.lastname ?? null,
        fullName: [p.firstname, p.lastname].filter(Boolean).join(" ") || `Player ${p.id}`,
        teamId: p.team?.id ?? null,
        teamName: p.team?.name ?? null,
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
      IS_BASKETBALL_V1
        ? `nba-players-${season.replace(/[^0-9]/g, "")}.json`
        : `nba-players-nba-v2-${season}.json`,
    );
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf-8");

    const dbUpserted = await upsertNbaPlayersForSeason({
      season,
      source: "sync-players-v2",
      players: uniquePlayers,
    }).catch(() => 0);

    return NextResponse.json({
      ok: true,
      saved: outFile,
      count: uniquePlayers.length,
      dbUpserted,
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
