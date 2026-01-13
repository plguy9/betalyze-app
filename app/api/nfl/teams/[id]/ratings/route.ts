// app/api/nfl/teams/[id]/ratings/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE = process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = "2025";

function sanitizeId(raw: string | string[] | null | undefined) {
  if (Array.isArray(raw)) return raw[0];
  return raw ?? null;
}

function isFinishedGame(game: any, includePreseason: boolean): boolean {
  const status =
    (game?.game?.status?.short ?? game?.status?.short ?? "").toString().toUpperCase();
  const stage = (game?.game?.stage ?? game?.stage ?? "").toString().toLowerCase();
  if (!includePreseason && stage.includes("pre")) return false;
  const finishedCodes = new Set(["FT", "AOT", "AET", "AP", "FINAL", "F", "3"]);
  return finishedCodes.has(status);
}

function toNumber(val: any): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } },
) {
  const rawIdParam = sanitizeId(params?.id);
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

  const season = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const league = req.nextUrl.searchParams.get("league") ?? DEFAULT_LEAGUE;
  const wantDebug = req.nextUrl.searchParams.get("debug") === "1";
  const includePreseason = req.nextUrl.searchParams.get("includePreseason") === "1";

  try {
    // Liste des matchs pour l'equipe
    const gamesUrl = new URL("/games", API_BASE);
    gamesUrl.searchParams.set("league", league);
    gamesUrl.searchParams.set("season", season);
    gamesUrl.searchParams.set("team", String(teamId));
    const gamesRes = await fetch(gamesUrl.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    const gamesJson = await gamesRes.json();
    if (!gamesRes.ok) {
      const txt = await gamesRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream games error", status: gamesRes.status, body: txt },
        { status: 502 },
      );
    }
    const gamesList = Array.isArray(gamesJson?.response) ? gamesJson.response : [];
    const finished = gamesList.filter((g: any) => isFinishedGame(g, includePreseason));

    if (!finished.length) {
      return NextResponse.json(
        {
          ok: true,
          season,
          ratings: null,
          countedGames: 0,
          debug: wantDebug
            ? {
                gamesReturned: gamesList.length,
                finishedCount: finished.length,
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
    let countedGames = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;

    // limiter le nombre si la saison est enorme
    const sample = finished.slice(0, 30);

    for (const g of sample) {
      const homeId = g?.teams?.home?.id;
      const awayId = g?.teams?.away?.id;
      const homeScore = toNumber(g?.scores?.home?.total);
      const awayScore = toNumber(g?.scores?.away?.total);
      const hasScores = homeScore !== null && awayScore !== null;
      if (!hasScores) continue;

      if (String(homeId) === String(teamId)) {
        ptsFor += homeScore;
        ptsAgainst += awayScore;
        if (homeScore === awayScore) ties += 1;
        else if (homeScore > awayScore) wins += 1;
        else losses += 1;
        countedGames += 1;
      } else if (String(awayId) === String(teamId)) {
        ptsFor += awayScore;
        ptsAgainst += homeScore;
        if (awayScore === homeScore) ties += 1;
        else if (awayScore > homeScore) wins += 1;
        else losses += 1;
        countedGames += 1;
      }
    }

    if (countedGames === 0) {
      return NextResponse.json(
        {
          ok: true,
          season,
          ratings: null,
          countedGames,
          debug: wantDebug
            ? {
                gamesReturned: gamesList.length,
                finishedCount: finished.length,
                countedGames,
                usedScores: true,
              }
            : undefined,
        },
        { status: 200 },
      );
    }

    const pointsPerGame = Number((ptsFor / countedGames).toFixed(1));
    const pointsAllowedPerGame = Number((ptsAgainst / countedGames).toFixed(1));
    const pointDiffPerGame = Number(((ptsFor - ptsAgainst) / countedGames).toFixed(1));

    return NextResponse.json({
      ok: true,
      season,
      ratings: {
        offense: {
          pointsPerGame,
        },
        defense: {
          pointsAllowedPerGame,
        },
        net: {
          pointDiffPerGame,
        },
        pace: null,
        countedGames,
        record: { wins, losses, ties },
        totals: { pointsFor: ptsFor, pointsAgainst: ptsAgainst, pointDiff: ptsFor - ptsAgainst },
        note: "Calcul base scores/match. Statistiques avancees (yards/plays) non fournies par l'endpoint actuel.",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
