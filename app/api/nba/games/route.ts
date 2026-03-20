// app/api/nba/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readNbaOddsDailyCache } from "@/lib/supabase/nba-odds-cache";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const RAW_DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON || "2025";
const DEFAULT_LEAGUE_RAW =
  process.env.APISPORTS_NBA_LEAGUE_ID ?? "standard";
const DEFAULT_TIMEZONE = "America/Toronto";
const INTERNAL_NBA_LEAGUE_ID = 12;

const TEAM_ID_BY_CODE: Record<string, number> = {
  ATL: 132,
  BOS: 133,
  BKN: 134,
  CHA: 135,
  CHI: 136,
  CLE: 137,
  DAL: 138,
  DEN: 139,
  DET: 140,
  GSW: 141,
  HOU: 142,
  IND: 143,
  LAC: 144,
  LAL: 145,
  MEM: 146,
  MIA: 147,
  MIL: 148,
  MIN: 149,
  NOP: 150,
  NYK: 151,
  OKC: 152,
  ORL: 153,
  PHI: 154,
  PHX: 155,
  POR: 156,
  SAC: 157,
  SAS: 158,
  TOR: 159,
  UTA: 160,
  WAS: 161,
};

const TEAM_CODE_BY_NAME: Record<string, string> = {
  "atlanta hawks": "ATL",
  "boston celtics": "BOS",
  "brooklyn nets": "BKN",
  "charlotte hornets": "CHA",
  "chicago bulls": "CHI",
  "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL",
  "denver nuggets": "DEN",
  "detroit pistons": "DET",
  "golden state warriors": "GSW",
  "houston rockets": "HOU",
  "indiana pacers": "IND",
  "los angeles clippers": "LAC",
  "la clippers": "LAC",
  "los angeles lakers": "LAL",
  "la lakers": "LAL",
  "memphis grizzlies": "MEM",
  "miami heat": "MIA",
  "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN",
  "new orleans pelicans": "NOP",
  "new york knicks": "NYK",
  "oklahoma city thunder": "OKC",
  "orlando magic": "ORL",
  "philadelphia 76ers": "PHI",
  "philly 76ers": "PHI",
  "phoenix suns": "PHX",
  "portland trail blazers": "POR",
  "sacramento kings": "SAC",
  "san antonio spurs": "SAS",
  "toronto raptors": "TOR",
  "utah jazz": "UTA",
  "washington wizards": "WAS",
};

type SgoEvent = {
  id?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  eventID?: string;
  status?: {
    startsAt?: string;
    started?: boolean;
    ended?: boolean;
    completed?: boolean;
    cancelled?: boolean;
    displayShort?: string;
    displayLong?: string;
  } | null;
  teams?: {
    home?: {
      names?: { long?: string; short?: string } | null;
    } | null;
    away?: {
      names?: { long?: string; short?: string } | null;
    } | null;
  } | null;
  info?: {
    venue?: {
      name?: string;
      city?: string;
    } | null;
  } | null;
};

type CanonicalGame = {
  id: number;
  date: string | null;
  timestamp: number | null;
  timezone: string;
  stage: number | string | null;
  status: {
    short: string | null;
    long: string | null;
  };
  league: {
    id: number | null;
    name: string | null;
    code: string | null;
    season: string | null;
  } | null;
  venue: {
    name: string | null;
    city: string | null;
  };
  teams: {
    home: { id: number | null; name: string | null; logo: string | null; code: string | null };
    away: { id: number | null; name: string | null; logo: string | null; code: string | null };
  };
  scores: {
    home: { total: number | null };
    away: { total: number | null };
  };
};

function torontoTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const ts = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(ts)) return ymd;
  const d = new Date(ts + days * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stableIntFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringSafe(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toNumberSafe(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLeague(value: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "standard";

  const lower = raw.toLowerCase();
  if (lower === "nba" || lower === "12") return "standard";
  return lower;
}

function normalizeSeason(input: string | null): string | null {
  if (!input) return null;
  const year = input.match(/(\d{4})/)?.[1];
  if (!year) return input;
  return year;
}

function inferSeasonFromDate(date: string | null): string | null {
  if (!date) return null;
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return String(startYear);
}

function uniqueSeasons(raw: string | null): string[] {
  const seasons = new Set<string>();
  if (!raw) return [];

  const normalized = normalizeSeason(raw);
  if (normalized) seasons.add(normalized);
  const trimmed = raw.trim();
  if (trimmed && trimmed !== normalized) seasons.add(trimmed);

  const year = trimmed.match(/(\d{4})/)?.[1];
  if (year) {
    seasons.add(year);
  }

  return Array.from(seasons).filter(Boolean);
}

function normalizeDate(rawDate: unknown): string | null {
  if (typeof rawDate === "string") return rawDate;
  const dateObj = toRecord(rawDate);
  if (!dateObj) return null;
  return toStringSafe(dateObj.start) ?? toStringSafe(dateObj.date);
}

function normalizeStatusShort(rawShort: unknown): string | null {
  if (typeof rawShort === "string") return rawShort.toUpperCase();
  if (typeof rawShort === "number") {
    if (rawShort === 1) return "NS";
    if (rawShort === 2) return "LIVE";
    if (rawShort === 3) return "FT";
    return String(rawShort);
  }
  return null;
}

function pickScore(value: unknown): number | null {
  const direct = toNumberSafe(value);
  if (direct !== null) return direct;
  const obj = toRecord(value);
  if (!obj) return null;
  return (
    toNumberSafe(obj.total) ??
    toNumberSafe(obj.points) ??
    toNumberSafe(obj.score) ??
    toNumberSafe(obj.win)
  );
}

function normalizeLeagueMeta(rawGame: Record<string, unknown>) {
  const rawLeague = rawGame.league;
  const topSeason = toStringSafe(rawGame.season);

  if (typeof rawLeague === "string") {
    const code = rawLeague.trim().toLowerCase() || null;
    return {
      id: code === "standard" ? INTERNAL_NBA_LEAGUE_ID : null,
      name: rawLeague,
      code,
      season: topSeason,
    };
  }

  const leagueObj = toRecord(rawLeague);
  if (!leagueObj) {
    return {
      id: INTERNAL_NBA_LEAGUE_ID,
      name: null,
      code: null,
      season: topSeason,
    };
  }

  const code =
    toStringSafe(leagueObj.code)?.toLowerCase() ??
    toStringSafe(leagueObj.league)?.toLowerCase() ??
    toStringSafe(leagueObj.type)?.toLowerCase() ??
    toStringSafe(leagueObj.name)?.toLowerCase() ??
    null;
  const id =
    toNumberSafe(leagueObj.id) ??
    ((!code || code === "standard")
      ? INTERNAL_NBA_LEAGUE_ID
      : null);

  return {
    id,
    name: toStringSafe(leagueObj.name) ?? toStringSafe(leagueObj.type) ?? null,
    code,
    season: toStringSafe(leagueObj.season) ?? topSeason,
  };
}

function normalizeApiGame(raw: unknown): CanonicalGame | null {
  const game = toRecord(raw);
  if (!game) return null;

  const gameId = toNumberSafe(game.id);
  if (!gameId || gameId <= 0) return null;

  const teamsObj = toRecord(game.teams) ?? {};
  const homeTeam = toRecord(teamsObj.home) ?? {};
  const awayTeam =
    toRecord(teamsObj.away) ?? toRecord(teamsObj.visitors) ?? {};

  const scoresObj = toRecord(game.scores) ?? {};
  const homeScore = pickScore(scoresObj.home);
  const awayScore = pickScore(scoresObj.away ?? scoresObj.visitors);

  const statusObj = toRecord(game.status) ?? {};
  const short = normalizeStatusShort(statusObj.short);
  const long = toStringSafe(statusObj.long);

  const date = normalizeDate(game.date);
  const ts = date ? Date.parse(date) : NaN;

  return {
    id: gameId,
    date,
    timestamp: Number.isFinite(ts) ? Math.floor(ts / 1000) : null,
    timezone: toStringSafe(game.timezone) ?? "UTC",
    stage: toNumberSafe(game.stage) ?? toStringSafe(game.stage) ?? null,
    status: {
      short,
      long: long ?? (short === "FT" ? "Finished" : short === "LIVE" ? "In Play" : "Scheduled"),
    },
    league: normalizeLeagueMeta(game),
    venue: {
      name: toStringSafe(toRecord(game.arena)?.name) ?? toStringSafe(toRecord(game.venue)?.name) ?? null,
      city: toStringSafe(toRecord(game.arena)?.city) ?? toStringSafe(toRecord(game.venue)?.city) ?? null,
    },
    teams: {
      home: {
        id: toNumberSafe(homeTeam.id),
        name: toStringSafe(homeTeam.name) ?? toStringSafe(homeTeam.nickname),
        logo: toStringSafe(homeTeam.logo),
        code: toStringSafe(homeTeam.code)?.toUpperCase() ?? null,
      },
      away: {
        id: toNumberSafe(awayTeam.id),
        name: toStringSafe(awayTeam.name) ?? toStringSafe(awayTeam.nickname),
        logo: toStringSafe(awayTeam.logo),
        code: toStringSafe(awayTeam.code)?.toUpperCase() ?? null,
      },
    },
    scores: {
      home: { total: homeScore },
      away: { total: awayScore },
    },
  };
}

function mapSgoEventToGame(event: SgoEvent): CanonicalGame | null {
  const startsAt = String(event?.status?.startsAt ?? event?.commence_time ?? "").trim();
  const ts = Date.parse(startsAt);
  if (!Number.isFinite(ts)) return null;

  const homeLong = String(
    event?.teams?.home?.names?.long ?? event?.home_team ?? "",
  ).trim();
  const awayLong = String(
    event?.teams?.away?.names?.long ?? event?.away_team ?? "",
  ).trim();
  const homeCodeRaw = String(event?.teams?.home?.names?.short ?? "").trim().toUpperCase();
  const awayCodeRaw = String(event?.teams?.away?.names?.short ?? "").trim().toUpperCase();
  const homeCode =
    homeCodeRaw ||
    TEAM_CODE_BY_NAME[homeLong.toLowerCase()] ||
    "";
  const awayCode =
    awayCodeRaw ||
    TEAM_CODE_BY_NAME[awayLong.toLowerCase()] ||
    "";
  const homeId = TEAM_ID_BY_CODE[homeCode] ?? null;
  const awayId = TEAM_ID_BY_CODE[awayCode] ?? null;
  const eventId = String(event?.eventID ?? event?.id ?? "").trim();
  const id = stableIntFromString(eventId || `${homeCode}-${awayCode}-${startsAt}`);
  const ended = Boolean(event?.status?.ended || event?.status?.completed);
  const started = Boolean(event?.status?.started);
  const cancelled = Boolean(event?.status?.cancelled);
  const statusShort = cancelled ? "CANC" : ended ? "FT" : started ? "LIVE" : "NS";

  return {
    id,
    date: startsAt,
    timestamp: Math.floor(ts / 1000),
    timezone: "UTC",
    stage: null,
    status: {
      short: statusShort,
      long: event?.status?.displayLong ?? (ended ? "Finished" : "Scheduled"),
    },
    league: {
      id: INTERNAL_NBA_LEAGUE_ID,
      name: "NBA",
      code: "standard",
      season: null,
    },
    venue: {
      name: event?.info?.venue?.name ?? null,
      city: event?.info?.venue?.city ?? null,
    },
    teams: {
      home: {
        id: homeId,
        name: homeLong || null,
        logo: null,
        code: homeCode || null,
      },
      away: {
        id: awayId,
        name: awayLong || null,
        logo: null,
        code: awayCode || null,
      },
    },
    scores: {
      home: { total: null },
      away: { total: null },
    },
  };
}

async function loadSgoFallbackGames(params: {
  team?: string | null;
  date?: string | null;
}): Promise<CanonicalGame[]> {
  const requestedTeamId = Number(params.team ?? NaN);
  const today = torontoTodayYmd();
  const days = params.date
    ? [params.date]
    : Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i));
  const all: CanonicalGame[] = [];

  for (const day of days) {
    const cached = await readNbaOddsDailyCache(day).catch(() => null);
    const events = Array.isArray(cached?.events) ? (cached?.events as unknown[]) : [];
    for (const raw of events) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const mapped = mapSgoEventToGame(raw as SgoEvent);
      if (!mapped) continue;
      if (Number.isFinite(requestedTeamId)) {
        const homeId = Number(mapped?.teams?.home?.id ?? NaN);
        const awayId = Number(mapped?.teams?.away?.id ?? NaN);
        if (homeId !== requestedTeamId && awayId !== requestedTeamId) continue;
      }
      all.push(mapped);
    }
  }

  return all.sort((a, b) => Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0));
}

function toYmdInTimezone(dateIso: string | null | undefined, tz: string): string | null {
  const raw = String(dateIso ?? "").trim();
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function dedupeAndSortGames(games: CanonicalGame[]): CanonicalGame[] {
  const byId = new Map<number, CanonicalGame>();
  const quality = (game: CanonicalGame) => {
    let score = 0;
    if (game.date) score += 1;
    if (game.status?.short === "LIVE" || game.status?.short === "FT") score += 1;
    if (
      Number.isFinite(game.scores?.home?.total ?? NaN) ||
      Number.isFinite(game.scores?.away?.total ?? NaN)
    ) {
      score += 1;
    }
    return score;
  };

  for (const game of games) {
    const prev = byId.get(game.id);
    if (!prev || quality(game) >= quality(prev)) {
      byId.set(game.id, game);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0),
  );
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = params.get("id");
  const team = params.get("team");
  const date = params.get("date");
  const status = params.get("status");
  const h2h = params.get("h2h");
  const timezone = params.get("timezone");
  const live = params.get("live");
  const leagueParam = params.get("league");
  const seasonParam = params.get("season");

  const league = normalizeLeague(leagueParam ?? DEFAULT_LEAGUE_RAW);
  const rawSeason = seasonParam ?? RAW_DEFAULT_SEASON;
  const inferredSeason = seasonParam ? null : inferSeasonFromDate(date);
  const seasonInput = inferredSeason ?? rawSeason;

  const includeLeague = Boolean(leagueParam) || !id;
  const includeSeason = Boolean(seasonParam || inferredSeason) || (!id && !date);
  const seasonsToTry = includeSeason ? uniqueSeasons(seasonInput) : [""];

  let lastError: { status: number; body: string } | null = null;

  for (const seasonCandidate of seasonsToTry) {
    const season = includeSeason ? normalizeSeason(seasonCandidate) : null;

    if (!API_KEY) {
      const fallback = await loadSgoFallbackGames({ team, date });
      return NextResponse.json(
        {
          ok: true,
          season,
          league: includeLeague ? league : null,
          response: fallback,
          errors: { apisports: "missing_key", fallback: "odds-cache" },
          results: fallback.length,
        },
        { status: 200 },
      );
    }

    const fetchUpstreamGames = async (queryDate: string | null) => {
      const url = new URL("/games", API_BASE);
      if (includeLeague && league) url.searchParams.set("league", league);
      if (includeSeason && season) url.searchParams.set("season", season);
      if (id) url.searchParams.set("id", id);
      if (team) url.searchParams.set("team", team);
      if (queryDate) url.searchParams.set("date", queryDate);
      else if (date) url.searchParams.set("date", date);
      if (status) url.searchParams.set("status", status);
      if (h2h) url.searchParams.set("h2h", h2h);
      if (live) url.searchParams.set("live", live);

      const res = await fetch(url.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastError = { status: res.status, body: txt };
        return { ok: false as const, response: [] as CanonicalGame[], errors: null as unknown, results: 0 };
      }

      const json = (await res.json().catch(() => null)) as {
        response?: unknown[];
        errors?: unknown;
        results?: number;
      } | null;
      const upstreamResponse = Array.isArray(json?.response) ? json.response : [];
      const normalizedResponse = upstreamResponse
        .map((game) => normalizeApiGame(game))
        .filter((game): game is CanonicalGame => Boolean(game));
      return {
        ok: true as const,
        response: normalizedResponse,
        errors: json?.errors ?? null,
        results: json?.results ?? normalizedResponse.length,
      };
    };

    // NBA v2: `date` is effectively UTC on upstream.
    // Build local-day slate by querying adjacent UTC dates then filtering in target timezone.
    if (date && !id) {
      const targetTz = timezone || DEFAULT_TIMEZONE;
      const nearbyDates = [addDaysYmd(date, -1), date, addDaysYmd(date, 1)];
      const bucket: CanonicalGame[] = [];
      let mergedErrors: unknown = null;

      for (const queryDate of nearbyDates) {
        const result = await fetchUpstreamGames(queryDate);
        if (!result.ok) continue;
        bucket.push(...result.response);
        if (mergedErrors === null) mergedErrors = result.errors;
      }

      const deduped = dedupeAndSortGames(bucket);
      const localDay = deduped.filter((game) => toYmdInTimezone(game.date, targetTz) === date);
      const responseGames = localDay.length ? localDay : deduped;

      if (responseGames.length === 0 && (team || date)) {
        const fallback = await loadSgoFallbackGames({ team, date });
        if (fallback.length > 0) {
          return NextResponse.json(
            {
              ok: true,
              season,
              league: includeLeague ? league : null,
              response: fallback,
              errors: mergedErrors,
              results: fallback.length,
            },
            { status: 200 },
          );
        }
      }

      if (responseGames.length > 0) {
        return NextResponse.json(
          {
            ok: true,
            season,
            league: includeLeague ? league : null,
            response: responseGames,
            errors: mergedErrors,
            results: responseGames.length,
          },
          { status: 200 },
        );
      }

      continue;
    }

    const result = await fetchUpstreamGames(null);
    if (!result.ok) continue;
    const normalizedResponse = result.response;

    if (normalizedResponse.length === 0 && (team || date)) {
      const fallback = await loadSgoFallbackGames({ team, date });
      if (fallback.length > 0) {
        return NextResponse.json(
          {
            ok: true,
            season,
            league: includeLeague ? league : null,
            response: fallback,
            errors: result.errors,
            results: fallback.length,
          },
          { status: 200 },
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        season,
        league: includeLeague ? league : null,
        response: normalizedResponse,
        errors: result.errors,
        results: result.results,
      },
      { status: 200 },
    );
  }

  const upstreamError = lastError as { status: number; body: string } | null;

  if (team || date) {
    const fallback = await loadSgoFallbackGames({ team, date });
    if (fallback.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          season: includeSeason ? seasonInput : null,
          league: includeLeague ? league : null,
          response: fallback,
          errors: { upstream: upstreamError?.body ?? "Upstream error", fallback: "odds-cache" },
          results: fallback.length,
        },
        { status: 200 },
      );
    }
  }

  return NextResponse.json(
    {
      error: "Upstream error",
      status: upstreamError?.status ?? 502,
      body: upstreamError?.body ?? "",
    },
    { status: 502 },
  );
}
