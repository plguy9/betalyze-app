// app/api/nfl/players/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";

const ALLOWED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const EXCLUDED_GROUPS = new Set([
  "Practice Squad",
  "Injured Reserve",
  "Injured Reserve Or O",
  "Reserve",
  "Out",
]);

type TeamSummary = {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTeams(season: string, league: string): Promise<TeamSummary[]> {
  const url = new URL("/teams", API_BASE);
  url.searchParams.set("season", season);
  url.searchParams.set("league", league);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return [];

  return (json?.response ?? [])
    .map((team: any) => ({
      id: Number(team?.id ?? team?.team?.id),
      name: team?.name ?? team?.team?.name ?? "",
      code: team?.code ?? team?.team?.code ?? null,
      logo: team?.logo ?? team?.team?.logo ?? null,
    }))
    .filter((team: TeamSummary) => Number.isFinite(team.id) && team.name);
}

async function fetchPlayersForTeam(team: TeamSummary, season: string) {
  const url = new URL("/players", API_BASE);
  url.searchParams.set("team", String(team.id));
  url.searchParams.set("season", season);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return [];

  const list = Array.isArray(json?.response) ? json.response : [];
  return list
    .map((player: any) => {
      const id = Number(player?.id);
      if (!Number.isFinite(id)) return null;
      const name = player?.name ?? "";
      if (!name) return null;
      const position = player?.position ?? null;
      const pos = String(position ?? "").toUpperCase();
      if (!ALLOWED_POSITIONS.has(pos)) return null;
      const group = player?.group ?? "";
      if (group && EXCLUDED_GROUPS.has(group)) return null;
      const [firstName, ...rest] = String(name).split(" ");
      const lastName = rest.join(" ").trim();
      return {
        externalId: String(id),
        firstName: firstName || name,
        lastName: lastName || "-",
        position: pos,
        teamExternalId: String(team.id),
      };
    })
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const season = params.get("season") ?? DEFAULT_SEASON;
  const league = params.get("league") ?? DEFAULT_LEAGUE;
  const sport = "nfl";

  const teams = await fetchTeams(season, league);
  if (!teams.length) {
    return NextResponse.json({ ok: false, error: "No teams returned" }, { status: 500 });
  }

  let teamUpserts = 0;
  let playerUpserts = 0;
  let failedTeams = 0;

  for (const team of teams) {
    try {
      const dbTeam = await prisma.team.upsert({
        where: {
          sport_externalId: {
            sport,
            externalId: String(team.id),
          },
        },
        create: {
          sport,
          externalId: String(team.id),
          name: team.name,
          abbreviation: team.code,
        },
        update: {
          name: team.name,
          abbreviation: team.code,
        },
      });
      teamUpserts += 1;

      const players = await fetchPlayersForTeam(team, season);
      for (const p of players) {
        await prisma.player.upsert({
          where: {
            sport_externalId: {
              sport,
              externalId: p.externalId,
            },
          },
          create: {
            sport,
            externalId: p.externalId,
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position,
            teamId: dbTeam.id,
          },
          update: {
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position,
            teamId: dbTeam.id,
          },
        });
        playerUpserts += 1;
      }
    } catch (err) {
      failedTeams += 1;
    }
    await sleep(120);
  }

  return NextResponse.json({
    ok: true,
    teams: teamUpserts,
    players: playerUpserts,
    failedTeams,
  });
}
