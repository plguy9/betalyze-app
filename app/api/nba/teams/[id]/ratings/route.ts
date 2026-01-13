// app/api/nba/teams/[id]/ratings/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.APISPORTS_NBA_URL ||
  process.env.APISPORTS_BASKETBALL_URL ||
  "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ||
  process.env.APISPORTS_BASKETBALL_SEASON ||
  "2025";

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

type GameStatsLine = {
  points?: number | null;
  fgm?: number | null;
  fga?: number | null;
  ftm?: number | null;
  fta?: number | null;
  tpm?: number | null;
  tpa?: number | null;
  offReb?: number | null;
  defReb?: number | null;
  turnovers?: number | null;
};

function calcPoss(s: GameStatsLine): number | null {
  if (!s) return null;
  const fga = s.fga ?? 0;
  const fta = s.fta ?? 0;
  const to = s.turnovers ?? 0;
  const orb = s.offReb ?? 0;
  const poss = fga + 0.44 * fta + to - orb;
  return poss > 0 ? poss : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } },
) {
  // fallback: parse depuis l'URL si params est vide
  const rawIdParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "teams");
  const rawIdPath = idx >= 0 ? segments[idx + 1] : null;
  const rawId = rawIdParam ?? rawIdPath;

  const teamId = Number(rawId);
  if (!Number.isFinite(teamId)) {
    return NextResponse.json({ error: "Missing or invalid team id" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const searchSeason = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const wantDebug = req.nextUrl.searchParams.get("debug") === "1";
  const v2Id = resolveV2TeamId(teamId);

  try {
    // 1) Liste des matchs de la saison pour ce team
    const gamesUrl = new URL("/games", API_BASE);
    gamesUrl.searchParams.set("team", String(v2Id));
    gamesUrl.searchParams.set("season", String(searchSeason));
    const gamesRes = await fetch(gamesUrl.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    if (!gamesRes.ok) {
      const txt = await gamesRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream games error", status: gamesRes.status, body: txt },
        { status: 502 },
      );
    }
    const gamesJson = await gamesRes.json();
    const gamesList = Array.isArray(gamesJson?.response) ? gamesJson.response : [];
    // On garde uniquement les matchs finis (status.short === 3) et stage != 1 (pas pré-saison)
    const finished = gamesList
      .filter((g: any) => g?.status?.short === 3 && g?.stage !== 1)
      .sort((a: any, b: any) => {
        const da = Date.parse(a?.date?.start ?? "");
        const db = Date.parse(b?.date?.start ?? "");
        return db - da;
      })
      .slice(0, 30); // limiter pour éviter trop d’appels

    if (finished.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          season: searchSeason,
          ratings: null,
          countedGames: 0,
          debug: wantDebug
            ? {
                gamesReturned: gamesList.length,
                finishedCount: finished.length,
                sample: gamesList.slice(0, 3),
                errors: gamesJson?.errors ?? null,
                results: gamesJson?.results ?? null,
              }
            : undefined,
        },
        { status: 200 },
      );
    }

    let ptsFor = 0;
    let ptsAgainst = 0;
    let possFor = 0;
    let possAgainst = 0;
    let countedGames = 0;

    for (const g of finished) {
      const gameId = g?.id;
      if (!gameId) continue;
      const statsUrl = new URL("/games/statistics", API_BASE);
      statsUrl.searchParams.set("id", String(gameId));
      const statsRes = await fetch(statsUrl.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      if (!statsRes.ok) continue;
      const statsJson = await statsRes.json();
      const entries = Array.isArray(statsJson?.response) ? statsJson.response : [];
      const myEntry = entries.find((e: any) => String(e?.team?.id) === String(v2Id));
      const oppEntry = entries.find((e: any) => String(e?.team?.id) !== String(v2Id));
      const myStats = myEntry?.statistics?.[0] as GameStatsLine | undefined;
      const oppStats = oppEntry?.statistics?.[0] as GameStatsLine | undefined;
      const myPoss = myStats ? calcPoss(myStats) : null;
      const oppPoss = oppStats ? calcPoss(oppStats) : null;
      const myPts = myStats?.points ?? null;
      const oppPts = oppStats?.points ?? null;

      if (
        myPoss !== null &&
        oppPoss !== null &&
        typeof myPts === "number" &&
        typeof oppPts === "number"
      ) {
        possFor += myPoss;
        possAgainst += oppPoss;
        ptsFor += myPts;
        ptsAgainst += oppPts;
        countedGames += 1;
      }
    }

    if (countedGames === 0 || possFor === 0 || possAgainst === 0) {
      return NextResponse.json(
        { ok: true, season: searchSeason, ratings: null, countedGames },
        { status: 200 },
      );
    }

    const offRtg = Number(((ptsFor / possFor) * 100).toFixed(1));
    const defRtg = Number(((ptsAgainst / possAgainst) * 100).toFixed(1));
    const netRtg = Number((offRtg - defRtg).toFixed(1));
    const pace = Number(((possFor + possAgainst) / (2 * countedGames)).toFixed(1));

    return NextResponse.json({
      ok: true,
      season: searchSeason,
      ratings: {
        offRtg,
        defRtg,
        netRtg,
        pace,
        countedGames,
      },
      debug: wantDebug
        ? {
            gamesReturned: gamesList.length,
            finishedCount: finished.length,
            countedGames,
          }
        : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
