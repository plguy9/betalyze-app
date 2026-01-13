import { NextResponse } from "next/server";

const API_BASE =
  process.env.APISPORTS_NBA_URL ||
  process.env.APISPORTS_BASKETBALL_URL ||
  "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ??
  process.env.APISPORTS_BASKETBALL_SEASON ??
  "2025";
const LEAGUE_ID = 1; // NBA on v2 api
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;

type ApiTeamSide = {
  id?: number | null;
  name?: string | null;
  nickname?: string | null;
  logo?: string | null;
  code?: string | null;
};

type ApiGame = {
  id: number;
  date: string | { start?: string | null; end?: string | null; duration?: number | null };
  league?: { id: number; name?: string; season?: string };
  stage?: number | string | null;
  teams?: {
    home?: ApiTeamSide;
    away?: ApiTeamSide;
    visitors?: ApiTeamSide;
  };
  scores?: {
    home?: { total?: number | null; points?: number | null } | number | null;
    away?: { total?: number | null; points?: number | null } | number | null;
    visitors?: { total?: number | null; points?: number | null } | number | null;
  };
  status?: { short?: string | number | null };
};

type ApiGamesResponse = {
  response: ApiGame[];
  results?: number;
};

type TeamSummary = {
  teamId: number;
  season: string;
  games: Array<{
    gameId: number;
    date: string;
    homeAway: "home" | "away";
    opponentId: number | null;
    opponentName: string | null;
    result: "W" | "L" | "NA";
    score: string | null;
    scoreDiff: number | null;
    pointsFor: number | null;
    pointsAgainst: number | null;
    isScheduled: boolean;
    isPreseason: boolean;
    statusShort: string | null;
  }>;
};

const memoryCache = new Map<
  string,
  { ts: number; payload: ReturnType<typeof NextResponse.json> }
>();

const dynamicTeamIdCache = new Map<string, number>();

function normalizeDate(d: ApiGame["date"]): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d === "object" && d.start) return d.start;
  return "";
}

function extractScore(
  side:
    | { total?: number | null; points?: number | null; win?: number | null; loss?: number | null }
    | number
    | null
    | undefined,
): number | null {
  if (side === null || side === undefined) return null;
  if (typeof side === "number") return Number.isFinite(side) ? side : null;
  const total = (side as any)?.total;
  if (total !== undefined && total !== null) return Number(total);
  const points = (side as any)?.points;
  if (points !== undefined && points !== null) return Number(points);
  const win = (side as any)?.win;
  if (win !== undefined && win !== null) return Number(win);
  return null;
}

function getTeamSides(g: ApiGame) {
  // v2 uses home/visitors (sometimes away)
  const home = g.teams?.home;
  const away = g.teams?.away ?? g.teams?.visitors;
  const scoresHome = g.scores?.home ?? null;
  const scoresAway = g.scores?.away ?? g.scores?.visitors ?? null;
  return { home, away, scoresHome, scoresAway };
}

async function resolveTeamIdForApi(teamId: number): Promise<number> {
  const code = CODE_BY_TEAM_ID[teamId];
  if (!code) return teamId;
  if (dynamicTeamIdCache.has(code)) return dynamicTeamIdCache.get(code)!;

  const mapped = V2_TEAM_ID_BY_CODE[code];
  // Try live lookup to avoid stale mapping
  try {
    const url = new URL("/teams", API_BASE);
    url.searchParams.set("search", code);
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { response?: Array<{ id?: number; code?: string; nickname?: string; name?: string }> };
      const found = data.response?.find(
        (t) =>
          t.code?.toUpperCase() === code ||
          t.nickname?.toUpperCase() === code ||
          t.name?.toUpperCase().includes(code),
      );
      if (found?.id) {
        dynamicTeamIdCache.set(code, found.id);
        return found.id;
      }
    }
  } catch {
    // ignore lookup errors, fallback to static mapping
  }

  const fallback = mapped ?? teamId;
  dynamicTeamIdCache.set(code, fallback);
  return fallback;
}

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

function resolveV2TeamId(teamId: number): number {
  const code = CODE_BY_TEAM_ID[teamId];
  if (!code) return teamId;
  return V2_TEAM_ID_BY_CODE[code] ?? teamId;
}

const FALLBACK_OPPONENTS: Array<{ id: number; name: string }> = [
  { id: 145, name: "Lakers" },
  { id: 133, name: "Celtics" },
  { id: 141, name: "Warriors" },
  { id: 151, name: "Knicks" },
  { id: 138, name: "Mavericks" },
  { id: 139, name: "Nuggets" },
  { id: 148, name: "Bucks" },
];

function buildFallbackSummary(teamId: number, season: string): TeamSummary {
  const games = Array.from({ length: 5 }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - idx * 2);
    const opp = FALLBACK_OPPONENTS[idx % FALLBACK_OPPONENTS.length];
    const homeAway = idx % 2 === 0 ? "home" : "away";
    const scoreHome = 110 + idx * 2;
    const scoreAway = 100 + idx;
    const weHome = homeAway === "home";
    const scoreDiff = weHome ? scoreHome - scoreAway : scoreAway - scoreHome;
    const result = scoreDiff > 0 ? "W" : "L";
    return {
      gameId: Number(`${teamId}${idx}`),
      date: date.toISOString(),
      homeAway,
      opponentId: opp.id,
      opponentName: opp.name,
      result,
      score: weHome ? `${scoreHome}-${scoreAway}` : `${scoreAway}-${scoreHome}`,
      scoreDiff,
      isPreseason: false,
      statusShort: "FT",
    };
  });

  return {
    teamId,
    season,
    games,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { id?: string } },
) {
  const urlReq = new URL(req.url);

  const extractId = (): string | null => {
    if (params?.id) return params.id;
    const fromQuery = urlReq.searchParams.get("id") ?? urlReq.searchParams.get("team");
    if (fromQuery) return fromQuery;
    const match = urlReq.pathname.match(/\/teams\/([^/]+)\/summary/);
    return match ? match[1] : null;
  };

  const teamId = extractId();
  if (!teamId) {
    return NextResponse.json(
      { error: "Missing team id" },
      { status: 400 },
    );
  }
  const teamIdNum = Number(teamId);
  const teamIdForApi = await resolveTeamIdForApi(teamIdNum);
  if (!Number.isFinite(teamIdNum)) {
    return NextResponse.json(
      { error: "Team id must be a number" },
      { status: 400 },
    );
  }

  const season = urlReq.searchParams.get("season") ?? DEFAULT_SEASON;
  const forceRefresh = urlReq.searchParams.get("refresh") === "1";
  const cacheKey = `${teamId}-${season}`;
  const cached = memoryCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.ts < MEMORY_CACHE_TTL_MS) {
    return cached.payload;
  }

  if (!API_BASE || !API_KEY) {
    const summary = buildFallbackSummary(Number(teamId), season);
    const response = NextResponse.json({ ok: true, summary });
    memoryCache.set(cacheKey, { ts: Date.now(), payload: response });
    return response;
  }

  try {
    const attempts: Array<{ url: string; results?: number; errors?: any }> = [];
    const seasonYear = season.match(/(\d{4})/)?.[1] ?? season;
    const seasonInt =
      seasonYear && /^\d{4}$/.test(seasonYear) ? Number(seasonYear) : null;
    const targetSeason = seasonInt ? String(seasonInt) : season;
    const seasonsToTry = [targetSeason];

    const requestedSeason = seasonsToTry[0];
    let gamesResponse: ApiGame[] = [];
    let usedSeason = requestedSeason;
    let lastFetchedRaw: ApiGame[] = [];

    for (const s of seasonsToTry) {
      const urls = [
        (() => {
          const u = new URL("/games", API_BASE);
          u.searchParams.set("season", s);
          u.searchParams.set("team", String(teamIdForApi));
          return u.toString();
        })(),
        (() => {
          const u = new URL("/games", API_BASE);
          u.searchParams.set("team", String(teamIdForApi));
          return u.toString();
        })(),
      ];

      for (const u of urls) {
        const res = await fetch(u, {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        if (!res.ok) {
          attempts.push({ url: u, errors: res.status });
          continue;
        }
        const data = (await res.json()) as ApiGamesResponse;
        attempts.push({ url: u, results: data.results, errors: (data as any).errors });
        if (Array.isArray(data.response) && data.response.length > 0) {
          lastFetchedRaw = data.response;
          const withScores = data.response.filter((g) => {
          const { scoresHome, scoresAway } = getTeamSides(g);
          const homeScore = extractScore(scoresHome);
          const awayScore = extractScore(scoresAway);
          return homeScore !== null && awayScore !== null;
        });
          gamesResponse = withScores.length > 0 ? withScores : data.response;
          usedSeason = s;
          break;
        }
      }
      if (gamesResponse.length > 0) break;
    }

    if (gamesResponse.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          summary: { teamId: teamIdNum, season, games: [] },
          debug: { attempts, empty: true, sample: lastFetchedRaw.slice(0, 3) },
        },
        { status: 200 },
      );
    }

    const games = gamesResponse
      .map((g) => {
        const { home, away, scoresHome, scoresAway } = getTeamSides(g);
        const homeId = home?.id ?? null;
        const awayId = away?.id ?? null;
        const isHome =
          homeId !== null &&
          (String(homeId) === String(teamIdForApi) || String(homeId) === String(teamId));
        const homeScore = extractScore(scoresHome);
        const awayScore = extractScore(scoresAway);

        let scoreDiff: number | null = null;
        if (homeScore !== null && awayScore !== null) {
          scoreDiff = isHome ? homeScore - awayScore : awayScore - homeScore;
        }

        let result: "W" | "L" | "NA" = "NA";
        if (scoreDiff !== null) {
          result = scoreDiff > 0 ? "W" : "L";
        }

        const opponentId = isHome ? awayId : homeId;
        const opponentName = isHome
          ? away?.name ?? away?.nickname ?? null
          : home?.name ?? home?.nickname ?? null;

        const normalizedDate = normalizeDate(g.date);
        const pointsFor =
          homeScore !== null && awayScore !== null
            ? isHome
              ? homeScore
              : awayScore
            : null;
        const pointsAgainst =
          homeScore !== null && awayScore !== null
            ? isHome
              ? awayScore
              : homeScore
            : null;
        const stageVal = (g as any)?.stage;
        const isPre =
          stageVal === 1 ||
          stageVal === "1" ||
          (typeof g.league?.name === "string" &&
            g.league.name.toLowerCase().includes("pre"));

        return {
          gameId: g.id,
          date: normalizedDate,
          homeAway: isHome ? "home" : "away",
          opponentId: opponentId ?? null,
          opponentName,
          result,
          score:
            homeScore !== null && awayScore !== null
              ? `${homeScore}-${awayScore}`
              : null,
          scoreDiff,
          pointsFor,
          pointsAgainst,
          isScheduled: homeScore === null || awayScore === null,
          isPreseason: Boolean(isPre),
          statusShort:
            typeof g.status?.short === "number"
              ? String(g.status?.short)
              : (g.status?.short as any) ?? null,
        };
      })
      .sort((a, b) => {
        const ta = Date.parse(a.date || "");
        const tb = Date.parse(b.date || "");
        const ka = Number.isFinite(ta) ? ta : a.gameId;
        const kb = Number.isFinite(tb) ? tb : b.gameId;
        return kb - ka;
      });

    const summary: TeamSummary = {
      teamId: teamIdNum,
      season: usedSeason,
      games,
    };

    const includeDebug = urlReq.searchParams.get("debug") === "1";
    const responsePayload = {
      ok: true,
      summary,
      debug: includeDebug
        ? {
            attempts,
            sample: gamesResponse.slice(0, 3),
            requestedTeamId: teamIdNum,
            apiTeamId: teamIdForApi,
            requestedSeason,
          }
        : undefined,
    };
    const response = NextResponse.json(responsePayload);
    // On ne met pas en cache les réponses vides pour éviter de bloquer l'affichage
    if (!forceRefresh && summary.games.length > 0) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: response });
    }
    return response;
  } catch (err: any) {
    console.error("Unexpected error in /api/nba/teams/[id]/summary:", err);
    return NextResponse.json(
      { error: "Unexpected server error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
