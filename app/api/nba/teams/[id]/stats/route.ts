// app/api/nba/teams/[id]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ?? "2025";

// Correspondance codes -> IDs NBA v2 (https://v2.nba.api-sports.io)
const V2_TEAM_ID_BY_CODE: Record<string, number> = {
  ATL: 1,
  BOS: 2,
  BKN: 3,
  CHA: 5,
  CHI: 6,
  CLE: 7,
  DET: 10,
  IND: 15,
  MIA: 20,
  MIL: 21,
  NYK: 24,
  ORL: 26,
  PHI: 27,
  TOR: 38,
  WAS: 41,
  DAL: 8,
  DEN: 9,
  GSW: 11,
  HOU: 14,
  LAC: 16,
  LAL: 17,
  MEM: 19,
  MIN: 22,
  NOP: 23,
  OKC: 25,
  PHX: 28,
  POR: 29,
  SAC: 30,
  SAS: 31,
  UTA: 40,
};

// Correspondance des IDs basket v1 (12=NBA) -> codes équipes
const CODE_BY_TEAM_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  140: "DET",
  143: "IND",
  147: "MIA",
  148: "MIL",
  151: "NYK",
  153: "ORL",
  154: "PHI",
  159: "TOR",
  161: "WAS",
  138: "DAL",
  139: "DEN",
  141: "GSW",
  142: "HOU",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  149: "MIN",
  150: "NOP",
  152: "OKC",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  160: "UTA",
};

function resolveV2TeamId(teamId: number) {
  const code = CODE_BY_TEAM_ID[teamId];
  if (!code) return teamId;
  return V2_TEAM_ID_BY_CODE[code] ?? teamId;
}

function resolveTeamIdForApi(teamId: number) {
  return resolveV2TeamId(teamId);
}

function normalizeSeason(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return value;
  return String(year);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;

  const teamId = Number(rawId);
  if (!Number.isFinite(teamId)) {
    return NextResponse.json(
      { error: "Missing or invalid team id" },
      { status: 400 },
    );
  }

  const seasonParam = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const season = normalizeSeason(seasonParam);
  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing API key", response: null },
      { status: 500 },
    );
  }

  try {
    const teamIdForApi = resolveTeamIdForApi(teamId);

    const url = new URL("/teams/statistics", API_BASE);
    url.searchParams.set("id", String(teamIdForApi));
    url.searchParams.set("season", String(season));

    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream error", status: res.status, body: txt },
        { status: 502 },
      );
    }

    const json = await res.json();
    const payload = json?.response?.[0] ?? null;
    return NextResponse.json({ ok: true, season, stats: payload ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
