// app/api/nba/sync-players-v2/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const API_BASE =
  process.env.APISPORTS_NBA_URL ||
  process.env.APISPORTS_BASKETBALL_URL ||
  "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON =
  process.env.APISPORTS_NBA_SEASON ||
  process.env.APISPORTS_BASKETBALL_SEASON ||
  "2025-2026";
const LEAGUE = process.env.APISPORTS_NBA_LEAGUE_ID || "nba";

// l'API NBA v2 attend un entier (ex: 2025 pour la saison 2025-2026)
function seasonInt(value: string): string {
  const match = value.match(/(\d{4})/);
  return match ? match[1] : value;
}

type ApiPlayer = {
  id: number;
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

export async function GET() {
  if (!API_BASE || !API_KEY) {
    return NextResponse.json(
      { error: "API key/URL missing" },
      { status: 500 },
    );
  }

  const season = seasonInt(RAW_SEASON);
  const collected: ApiPlayer[] = [];
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
    const teamUrls = [
      new URL("/teams", API_BASE).toString(),
    ];
    let teamIds: number[] = [];
    for (const tu of teamUrls) {
      const resTeams = await fetch(tu, {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      const teamsData = resTeams.ok ? ((await resTeams.json()) as any) : null;
      const ids =
        teamsData && Array.isArray(teamsData.response)
          ? teamsData.response.map((t: any) => t.id).filter(Boolean)
          : [];
      attempts.push({
        step: "teams",
        results: teamsData?.results,
        errors: teamsData?.errors ?? (!resTeams.ok ? resTeams.status : undefined),
        url: tu,
      });
      if (ids.length) {
        teamIds = ids;
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
      url.searchParams.set("season", season);

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
        collected.push(...data.response);
      }
    }

    const mapped = collected.map((p) => ({
      id: p.id,
      firstName: p.firstname ?? null,
      lastName: p.lastname ?? null,
      fullName: [p.firstname, p.lastname].filter(Boolean).join(" "),
      teamId: p.team?.id ?? null,
      teamName: p.team?.name ?? null,
      position: p.leagues?.standard?.pos ?? null,
      jerseyNumber: p.leagues?.standard?.jersey
        ? String(p.leagues.standard.jersey)
        : null,
      nationality: p.birth?.country ?? null,
      height: p.height?.meters ?? null,
      weight: p.weight?.kilograms ?? null,
      birthDate: p.birth?.date ?? null,
      isActive: p.leagues?.standard?.active ?? null,
    }));

    const payload = {
      season,
      updatedAt: new Date().toISOString(),
      count: mapped.length,
      players: mapped,
    };

    const outFile = path.join(
      process.cwd(),
      "data",
      `nba-players-nba-v2-${season}.json`,
    );
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf-8");

    return NextResponse.json({
      ok: true,
      saved: outFile,
      count: mapped.length,
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
