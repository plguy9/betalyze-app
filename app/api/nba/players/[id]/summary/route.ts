// app/api/nba/players/[id]/summary/route.ts
import { NextResponse } from "next/server";
import type {
  NbaPlayer,
  NbaPlayerAveragesWindow,
  NbaPlayerSummary,
  NbaTrend,
} from "@/lib/models/nba";

const API_BASE =
  process.env.APISPORTS_NBA_URL ||
  process.env.APISPORTS_BASKETBALL_URL ||
  "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
// Saison par défaut (fallback si non fourni par le front)
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ??
  process.env.APISPORTS_BASKETBALL_SEASON ??
  "2025-2026";
const LEAGUE_ID =
  process.env.APISPORTS_NBA_LEAGUE_ID ??
  process.env.APISPORTS_BASKETBALL_LEAGUE_ID ??
  "nba";
const MEMORY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes pour limiter les requêtes API

// IDs des équipes NBA (API-Sports basketball)
const NBA_TEAM_IDS = new Set<number>([
  132, 133, 134, 135, 136, 137, 140, 143, 147, 148, 151, 153, 154, 159, 161, // East
  138, 139, 141, 142, 144, 145, 146, 149, 150, 152, 155, 156, 157, 158, 160, // West
]);

// Petit cache mémoire pour réduire les hits API quand on consulte souvent les mêmes joueurs
const memoryCache = new Map<
  string,
  { ts: number; payload: ReturnType<typeof NextResponse.json> }
>();

const toStr = (val: any): string | null => {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return null;
};

type ApiPlayerStatsGame = {
  game: { id: number; date: string };
  team: { id: number; name: string; code: string };
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  minutes: number | null;
  // autres champs ignorés
};

type ApiPlayersStatisticsResponse = {
  response: Array<{
    player: { id: number; firstname?: string; lastname?: string; name?: string };
    team: { id: number; name: string; code: string };
    statistics?: Array<{
      game: { id: number; date: string };
      team: { id: number; name: string; code: string };
      points?: number | null;
      rebounds?: number | null;
      assists?: number | null;
      minutes?: number | null;
    }>;
  }>;
};

function parseMinutes(min: any): number | null {
  if (min === null || min === undefined) return null;
  if (typeof min === "number") return min;
  if (typeof min === "string") {
    const parts = min.split(":");
    if (parts.length === 2) {
      const [m, s] = parts.map(Number);
      if (Number.isFinite(m) && Number.isFinite(s)) {
        return m + s / 60;
      }
    }
    const num = Number(min);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

const toNumberSafe = (val: any): number | null => {
  const num =
    typeof val === "number"
      ? val
      : typeof val === "string"
      ? Number(val)
      : null;
  return Number.isFinite(num) ? num : null;
};

const pickScore = (source: any, keys: string[]): number | null => {
  const direct = toNumberSafe(source);
  if (direct !== null) return direct;
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const candidate = toNumberSafe((source as any)[key]);
    if (candidate !== null) return candidate;
  }
  return null;
};

const normalizeGameDate = (value: any): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidates = [
      value.start,
      value.date,
      value.datetime,
      value.full,
      value.utc,
      value.original,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c) return c;
    }
  }
  return null;
};

type ApiGameResponse = { response?: any[]; results?: number; errors?: any };

type ExtractedGameInfo = {
  date: string | null;
  home: { id: number | null; name: string | null; code: string | null };
  away: { id: number | null; name: string | null; code: string | null };
  homeScore: number | null;
  awayScore: number | null;
  leagueId: number | null;
  statusShort: string | null;
};

function mapGameInfo(raw: any): ExtractedGameInfo {
  const teams = raw?.teams ?? {};
  const scores = raw?.scores ?? {};

  const homeTeam =
    teams.home ?? teams.localteam ?? teams.local ?? teams.homeTeam ?? null;
  const awayTeam =
    teams.away ??
    teams.visitors ??
    teams.visitorteam ??
    teams.visitor ??
    teams.awayTeam ??
    null;

  const homeScore =
    pickScore(scores.home, ["total", "points", "score", "fulltime"]) ??
    pickScore(scores.localteam, ["score", "points", "total"]) ??
    null;
  const awayScore =
    pickScore(scores.away, ["total", "points", "score", "fulltime"]) ??
    pickScore(scores.visitors, ["points", "total", "score", "fulltime"]) ??
    pickScore(scores.visitorteam, ["score", "points", "total"]) ??
    null;

  return {
    date: normalizeGameDate(raw?.date),
    home: {
      id: homeTeam?.id ?? null,
      name: homeTeam?.name ?? null,
      code: homeTeam?.code ?? null,
    },
    away: {
      id: awayTeam?.id ?? null,
      name: awayTeam?.name ?? null,
      code: awayTeam?.code ?? null,
    },
    homeScore,
    awayScore,
    leagueId: raw?.league?.id ?? null,
    statusShort: raw?.status?.short ?? null,
  };
}

function buildAverages(
  games: ApiPlayerStatsGame[] | undefined,
  limit: number,
): NbaPlayerAveragesWindow | null {
  if (!games || games.length === 0) return null;
  const slice = games.slice(0, limit);
  const sampleSize = slice.length;
  const sum = { points: 0, rebounds: 0, assists: 0, minutes: 0 };
  const vals = { points: [] as number[], minutes: [] as number[] };

  for (const g of slice) {
    const p = g.points ?? null;
    const r = g.rebounds ?? null;
    const a = g.assists ?? null;
    const m = parseMinutes(g.minutes);

    if (p !== null) {
      sum.points += p;
      vals.points.push(p);
    }
    if (r !== null) sum.rebounds += r;
    if (a !== null) sum.assists += a;
    if (m !== null) {
      sum.minutes += m;
      vals.minutes.push(m);
    }
  }

  const avg = (total: number, count: number) =>
    count > 0 ? Number((total / count).toFixed(2)) : null;

  const points = vals.points.length ? avg(sum.points, vals.points.length) : null;
  const rebounds = sum.rebounds ? avg(sum.rebounds, sampleSize) : null;
  const assists = sum.assists ? avg(sum.assists, sampleSize) : null;
  const minutes = vals.minutes.length
    ? avg(sum.minutes, vals.minutes.length)
    : null;

  const stddev = (arr: number[]) => {
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
    return Number(Math.sqrt(variance).toFixed(2));
  };

  return {
    sampleSize,
    points,
    rebounds,
    assists,
    minutes,
    fieldGoalsAttempted: null,
    threePointsAttempted: null,
    turnovers: null,
    pointsStdDev: stddev(vals.points),
    minutesStdDev: stddev(vals.minutes),
  };
}

function computeTrend(last5: NbaPlayerAveragesWindow | null): NbaTrend {
  if (!last5 || !last5.points || last5.pointsStdDev === null) return "unknown";
  const volatility = last5.pointsStdDev ?? 0;
  const avg = last5.points;
  if (avg > 20 && volatility < 5) return "up";
  if (avg > 10 && volatility < 8) return "flat";
  return "down";
}

export async function GET(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  let lastResponse: any = null;
  let lastUrl: string | null = null;

  if (!API_BASE || !API_KEY) {
    return NextResponse.json(
      { error: "Missing API config" },
      { status: 500 },
    );
  }

  const { searchParams, pathname } = new URL(req.url);
  const resolvedParams = await Promise.resolve(context.params);

  function extractId(): string | null {
    if (resolvedParams?.id) return String(resolvedParams.id);
    const fromQuery = searchParams.get("id");
    if (fromQuery) return fromQuery;
    const match = pathname.match(/\/players\/([^/]+)\/summary/);
    return match ? match[1] : null;
  }

  const playerId = extractId();
  if (!playerId) {
    return NextResponse.json(
      { error: "Missing player id" },
      { status: 400 },
    );
  }

  const seasonInput = searchParams.get("season") ?? DEFAULT_SEASON;
  const seasonYear = seasonInput.match(/(\d{4})/)?.[1] ?? seasonInput;
  const seasonForSummary = seasonInput;
  const forceRefresh = searchParams.get("refresh") === "1";

  // Cache mémoire (clé = playerId + season)
  const cacheKey = `${playerId}-${seasonForSummary}`;
  const cached = memoryCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.ts < MEMORY_CACHE_TTL_MS) {
    return cached.payload;
  }

  try {
    // NBA v2 attend un entier de saison (ex: 2024)
    const seasonsToTry = Array.from(
      new Set([
        seasonYear, // ex: 2025
        seasonInput, // ex: 2025-2026
        Number(seasonYear) ? String(Number(seasonYear) - 1) : null,
        "2024",
        "2023",
      ]),
    );

    let parsedResponse: ApiPlayersStatisticsResponse | null = null;
    const attempts: Array<{ url: string; results?: number; errors?: any }> = [];

    for (const s of seasonsToTry) {
      const urls = [
        (() => {
          const url = new URL("/players/statistics", API_BASE);
          url.searchParams.set("id", playerId);
          url.searchParams.set("season", s);
          return url;
        })(),
        (() => {
          const url = new URL("/players/statistics", API_BASE);
          url.searchParams.set("player", playerId);
          url.searchParams.set("season", s);
          return url;
        })(),
      ];

      for (const url of urls) {
        lastUrl = url.toString();
        const res = await fetch(lastUrl, {
          headers: { "x-apisports-key": API_KEY },
          cache: "no-store",
        });
        const textBody = await res.text().catch(() => "");
        attempts.push({ url: lastUrl, results: undefined, errors: undefined });
        lastResponse = textBody;

        if (!res.ok) {
          continue;
        }

        try {
          const data = JSON.parse(textBody) as ApiPlayersStatisticsResponse;
          attempts[attempts.length - 1].results = (data as any)?.results;
          attempts[attempts.length - 1].errors = (data as any)?.errors;
          lastResponse = data;
          if (Array.isArray(data.response) && data.response.length > 0) {
            parsedResponse = data;
            break;
          }
        } catch {
          continue;
        }
      }
      if (parsedResponse) break;
    }

    const gamesApi = [...(parsedResponse?.response ?? [])];
    // Trier par date décroissante pour avoir les matchs les plus récents en haut
    const parseDate = (val: any) => {
      if (!val) return 0;
      const d = new Date(val).getTime();
      return Number.isFinite(d) ? d : 0;
    };
    gamesApi.sort((a: any, b: any) => parseDate(b?.game?.date) - parseDate(a?.game?.date));

    if (!gamesApi || gamesApi.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        summary: {
          player: {
            id: Number(playerId),
            fullName: "",
            firstName: null,
            lastName: null,
            teamId: null,
            teamName: null,
            teamCode: null,
            position: null,
            jerseyNumber: null,
            height: null,
            weight: null,
            nationality: null,
            birthDate: null,
            isActive: true,
          } as NbaPlayer,
          last5: null,
          last10: null,
          season: seasonForSummary,
          pointsTrend: "unknown",
          dataQuality: "low",
          games: [],
          debug: { lastResponse, lastUrl },
        },
      },
      { status: 200 },
    );
  }
    // Avec /games/statistics/players, l'entrée représente un match, on construit un tableau
    const gamesRaw: ApiPlayerStatsGame[] = gamesApi.map((s: any) => {
      const stat =
        Array.isArray(s.statistics) && s.statistics.length > 0
          ? s.statistics[0]
          : s;

      const team = stat.team ?? s.team ?? stat.teams?.team ?? stat.teams ?? null;

      const points =
        stat.points?.total ??
        stat.points?.points ??
        stat.points ??
        null;

      const rebounds =
        stat.rebounds?.total ??
        stat.rebounds?.totals ??
        stat.rebounds ??
        stat.totReb ??
        stat.reb ??
        null;

      const assists =
        stat.assists?.total ??
        stat.assists ??
        stat.totAst ??
        stat.ast ??
        null;

      const minutes =
        stat.min ??
        stat.minutes ??
        stat.time?.played ??
        stat.time ??
        s.minutes ??
        null;

      return {
        game: stat.game ?? s.game,
        team,
        points,
        rebounds,
        assists,
        minutes,
      };
    });

    // On tri les games par date décroissante pour le game log
    const games = gamesRaw
      .map((g) => ({
        ...g,
        game: {
          ...g.game,
          date:
            normalizeGameDate(g.game?.date) ??
            (g.game?.date ? String(g.game.date) : ""),
        },
      }))
      .sort((a, b) => {
        const da = new Date(a.game.date).getTime() || 0;
        const db = new Date(b.game.date).getTime() || 0;
        return db - da;
      });

    // Fetch game details to identify opponent (home/away)
    const uniqueGameIds = Array.from(
      new Set(games.map((g) => g.game.id).filter(Boolean)),
    );

    const gameInfoCache = new Map<
      number,
      {
        date?: string | null;
        homeId?: number;
        homeName?: string;
        homeCode?: string;
        awayId?: number;
        awayName?: string;
        awayCode?: string;
        homeScore?: number | null;
        awayScore?: number | null;
        leagueId?: number | null;
        statusShort?: string | null;
      }
    >();

    for (const gid of uniqueGameIds) {
      try {
        // On tente plusieurs URLs pour maximiser les chances d'avoir l'info.
        // Ordre : par id seul (souvent suffisant), puis id + season complète, puis id + season + league.
        const tryUrls = [
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            return url.toString();
          })(),
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            url.searchParams.set("season", seasonForSummary);
            return url.toString();
          })(),
          (() => {
            const url = new URL("/games", API_BASE);
            url.searchParams.set("id", String(gid));
            url.searchParams.set("season", seasonForSummary);
            url.searchParams.set("league", LEAGUE_ID);
            return url.toString();
          })(),
        ];

        for (const u of tryUrls) {
          const res = await fetch(u, {
            headers: { "x-apisports-key": API_KEY },
            cache: "no-store",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as ApiGameResponse;
          const info = data.response?.[0];
          if (info) {
            const mapped = mapGameInfo(info);
            gameInfoCache.set(gid, {
              date: mapped.date,
              homeId: mapped.home.id ?? undefined,
              homeName: mapped.home.name ?? undefined,
              homeCode: mapped.home.code ?? undefined,
              awayId: mapped.away.id ?? undefined,
              awayName: mapped.away.name ?? undefined,
              awayCode: mapped.away.code ?? undefined,
              homeScore: mapped.homeScore,
              awayScore: mapped.awayScore,
              leagueId: mapped.leagueId,
              statusShort: mapped.statusShort,
            });
            break;
          }
        }
      } catch {
        // ignore individual errors
      }
    }

    const player: NbaPlayer = {
      id: gamesApi[0]?.player?.id ?? Number(playerId),
      fullName:
        gamesApi[0]?.player?.name ??
        [gamesApi[0]?.player?.firstname, gamesApi[0]?.player?.lastname]
          .filter(Boolean)
          .join(" "),
      firstName: gamesApi[0]?.player?.firstname ?? null,
      lastName: gamesApi[0]?.player?.lastname ?? null,
      teamId: gamesRaw[0]?.team?.id ?? null,
      teamName: gamesRaw[0]?.team?.name ?? null,
      teamCode: gamesRaw[0]?.team?.code ?? null,
      position: null,
      jerseyNumber: null,
      height: null,
      weight: null,
      nationality: null,
      birthDate: null,
      isActive: true,
    };

    const last5 = buildAverages(games, 5);
    const last10 = buildAverages(games, 10);
    const seasonAvg = buildAverages(games, games.length);
    const dataQuality =
      (last5?.sampleSize ?? 0) >= 3 ? "high" : (last5?.sampleSize ?? 0) >= 1 ? "medium" : "low";

    const finishedStatuses = new Set([
      "FT",
      "AOT",
      "AET",
      "AWD",
      "WO",
      "ABD",
      "CAN",
      "PEN",
      "POST",
    ]);

    let mappedGames = games.map((g) => {
      const info = gameInfoCache.get(g.game.id);
      const teamId = g.team?.id;

      const isSameTeam = (a: any, b: any) =>
        toStr(a) !== null && toStr(b) !== null && toStr(a) === toStr(b);

      let homeAway: "home" | "away" | "unknown" = "unknown";
      if (info?.homeId && teamId && isSameTeam(info.homeId, teamId)) {
        homeAway = "home";
      } else if (info?.awayId && teamId && isSameTeam(info.awayId, teamId)) {
        homeAway = "away";
      }

      let opponent = { id: null, name: null, code: null as string | null };
      if (info) {
        if (homeAway === "home") {
          opponent = {
            id: info.awayId ?? null,
            name: info.awayName ?? null,
            code: info.awayCode ?? null,
          };
        } else if (homeAway === "away") {
          opponent = {
            id: info.homeId ?? null,
            name: info.homeName ?? null,
            code: info.homeCode ?? null,
          };
        } else {
          if (info.homeId && !isSameTeam(info.homeId, teamId)) {
            opponent = {
              id: info.homeId ?? null,
              name: info.homeName ?? null,
              code: info.homeCode ?? null,
            };
          } else if (info.awayId && !isSameTeam(info.awayId, teamId)) {
            opponent = {
              id: info.awayId ?? null,
              name: info.awayName ?? null,
              code: info.awayCode ?? null,
            };
          }
        }
      }

      const homeScore = info?.homeScore ?? null;
      const awayScore = info?.awayScore ?? null;
      let result: "W" | "L" | "NA" = "NA";
      if (
        homeScore !== null &&
        awayScore !== null &&
        (homeAway === "home" || homeAway === "away")
      ) {
        const weWon =
          (homeAway === "home" && homeScore > awayScore) ||
          (homeAway === "away" && awayScore > homeScore);
        result = weWon ? "W" : "L";
      }

      const teamName = toStr(g.team?.name);
      const teamCode = toStr(g.team?.code);

      const opponentNameRaw = opponent.name;
      const opponentName =
        toStr(opponentNameRaw) ??
        toStr(opponent.code) ??
        (typeof opponent.id === "number" ? `Team ${opponent.id}` : null);
      const opponentCode = toStr(opponent.code) ?? toStr(opponentNameRaw);

      return {
        gameId: g.game.id,
        date: info?.date ?? g.game.date,
        teamId: g.team?.id ?? null,
        teamName,
        teamCode,
        opponentTeamId: opponent.id,
        opponentTeamName: opponentName,
        opponentTeamCode: opponentCode,
        homeAway,
        result,
        score:
          homeScore !== null && awayScore !== null
            ? `${homeScore}-${awayScore}`
            : null,
        scoreHome: homeScore,
        scoreAway: awayScore,
        points: g.points ?? null,
        rebounds: g.rebounds ?? null,
        assists: g.assists ?? null,
        minutes: parseMinutes(g.minutes),
        isPreseason:
          info?.leagueId && String(info.leagueId) !== String(LEAGUE_ID),
        leagueId: info?.leagueId ?? null,
        statusShort: info?.statusShort ?? null,
      };
    });

    // On ne filtre plus strictement sur un set d'IDs (différent entre v1/v2). Si l'API renvoie des jeux, on les garde.

    // Calcul des moyennes sur le set final
    const averagesSource = mappedGames.map((gm) => ({
      game: { id: gm.gameId, date: gm.date },
      team: { id: gm.teamId ?? 0, name: gm.teamName ?? "", code: gm.teamCode ?? "" },
      points: gm.points,
      rebounds: gm.rebounds,
      assists: gm.assists,
      minutes: gm.minutes,
    }));
    const avgLast5 = buildAverages(averagesSource, 5);
    const avgLast10 = buildAverages(averagesSource, 10);
    const avgSeason = buildAverages(averagesSource, averagesSource.length);

    const summary: NbaPlayerSummary = {
      player: { ...player, id: player.id ?? Number(playerId) },
      last5: avgLast5 ?? last5,
      last10: avgLast10 ?? last10,
      season: seasonForSummary,
      // @ts-expect-error extension front
      seasonAvg: avgSeason ?? seasonAvg,
      pointsTrend: computeTrend(avgLast5 ?? last5),
      dataQuality,
      // @ts-expect-error ajout custom pour le front (log minimal)
      games: mappedGames
        .map((gm) => ({ ...gm, leagueId: undefined }))
        .sort((a, b) => {
          const ta = Date.parse(a.date || "");
          const tb = Date.parse(b.date || "");
          const ka = Number.isFinite(ta) ? ta : a.gameId ?? 0;
          const kb = Number.isFinite(tb) ? tb : b.gameId ?? 0;
          return kb - ka;
        })
        .slice(0, 15),
    };

    const response = NextResponse.json({
      ok: true,
      summary,
      debug: { lastUrl, lastResponse },
    });
    if (!forceRefresh) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: response });
    }
    return response;
  } catch (err: any) {
    console.error("Unexpected error in /api/nba/players/[id]/summary:", err);
    return NextResponse.json(
      { error: "Unexpected server error", debug: { lastUrl, lastResponse, message: String(err?.message ?? err) } },
      { status: 500 },
    );
  }
}
