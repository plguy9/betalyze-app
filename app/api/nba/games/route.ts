// app/api/nba/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readNbaOddsDailyCache } from "@/lib/supabase/nba-odds-cache";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_BASKETBALL_URL ||
  process.env.APISPORTS_NBA_URL ||
  "https://v1.basketball.api-sports.io";
const RAW_DEFAULT_SEASON =
  process.env.APISPORTS_BASKETBALL_SEASON ||
  process.env.APISPORTS_NBA_SEASON ||
  "2025-2026";
const DEFAULT_LEAGUE =
  process.env.APISPORTS_BASKETBALL_LEAGUE_ID ??
  process.env.APISPORTS_NBA_LEAGUE_ID ??
  "12";
const DEFAULT_TIMEZONE = "America/Toronto";
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

type SgoEvent = {
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

function mapSgoEventToGame(event: SgoEvent) {
  const startsAt = String(event?.status?.startsAt ?? "").trim();
  const ts = Date.parse(startsAt);
  if (!Number.isFinite(ts)) return null;

  const homeCode = String(event?.teams?.home?.names?.short ?? "").trim().toUpperCase();
  const awayCode = String(event?.teams?.away?.names?.short ?? "").trim().toUpperCase();
  const homeId = TEAM_ID_BY_CODE[homeCode] ?? null;
  const awayId = TEAM_ID_BY_CODE[awayCode] ?? null;
  const eventId = String(event?.eventID ?? "").trim();
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
    status: {
      short: statusShort,
      long: event?.status?.displayLong ?? (ended ? "Finished" : "Scheduled"),
    },
    venue: {
      name: event?.info?.venue?.name ?? null,
      city: event?.info?.venue?.city ?? null,
    },
    teams: {
      home: {
        id: homeId,
        name: event?.teams?.home?.names?.long ?? null,
        logo: null,
      },
      away: {
        id: awayId,
        name: event?.teams?.away?.names?.long ?? null,
        logo: null,
      },
    },
  };
}

async function loadSgoFallbackGames(params: {
  team?: string | null;
  date?: string | null;
}): Promise<
  Array<{
    id: number;
    date: string;
    timestamp: number;
    timezone: string;
    status: { short: string; long: string | null };
    venue: { name: string | null; city: string | null };
    teams: {
      home: { id: number | null; name: string | null; logo: null };
      away: { id: number | null; name: string | null; logo: null };
    };
  }>
> {
  const requestedTeamId = Number(params.team ?? NaN);
  const today = torontoTodayYmd();
  const days = params.date
    ? [params.date]
    : Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i));
  const all: Array<{
    id: number;
    date: string;
    timestamp: number;
    timezone: string;
    status: { short: string; long: string | null };
    venue: { name: string | null; city: string | null };
    teams: {
      home: { id: number | null; name: string | null; logo: null };
      away: { id: number | null; name: string | null; logo: null };
    };
  }> = [];

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

function normalizeSeason(input: string | null): string | null {
  if (!input) return null;
  const year = input.match(/(\d{4})/)?.[1];
  if (year) return `${year}-${Number(year) + 1}`;
  const digits = input.replace(/[^0-9]/g, "");
  return digits || input;
}

function inferSeasonFromDate(date: string | null): string | null {
  if (!date) return null;
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function uniqueSeasons(raw: string | null): string[] {
  const normalized = normalizeSeason(raw);
  const seasons = new Set<string>();
  if (normalized) seasons.add(normalized);
  if (raw && raw !== normalized) seasons.add(raw);
  return Array.from(seasons);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = params.get("id");
  const team = params.get("team");
  const date = params.get("date");
  const status = params.get("status");
  const h2h = params.get("h2h");
  const timezone = params.get("timezone") ?? (date ? DEFAULT_TIMEZONE : null);
  const live = params.get("live");
  const leagueParam = params.get("league");
  const seasonParam = params.get("season");

  const league = leagueParam ?? DEFAULT_LEAGUE;
  const rawSeason = seasonParam ?? RAW_DEFAULT_SEASON;
  const inferredSeason = seasonParam ? null : inferSeasonFromDate(date);
  const seasonInput = inferredSeason ?? rawSeason;

  const includeLeague = Boolean(leagueParam) || !id;
  const includeSeason = Boolean(seasonParam || inferredSeason) || (!id && !date);
  const seasonsToTry = includeSeason ? uniqueSeasons(seasonInput) : [""];

  let lastError: { status: number; body: string } | null = null;

  for (const season of seasonsToTry) {
    if (!API_KEY) {
      const fallback = await loadSgoFallbackGames({ team, date });
      return NextResponse.json(
        {
          ok: true,
          season: includeSeason ? season : null,
          league: includeLeague ? league : null,
          response: fallback,
          errors: { apisports: "missing_key", fallback: "sportsgameodds-cache" },
          results: fallback.length,
        },
        { status: 200 },
      );
    }

    const url = new URL("/games", API_BASE);
    if (includeLeague && league) url.searchParams.set("league", league);
    if (includeSeason && season) url.searchParams.set("season", season);
    if (id) url.searchParams.set("id", id);
    if (team) url.searchParams.set("team", team);
    if (date) url.searchParams.set("date", date);
    if (status) url.searchParams.set("status", status);
    if (h2h) url.searchParams.set("h2h", h2h);
    if (timezone) url.searchParams.set("timezone", timezone);
    if (live) url.searchParams.set("live", live);

    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      lastError = { status: res.status, body: txt };
      continue;
    }

    const json = await res.json();
    const upstreamResponse = Array.isArray(json?.response) ? json.response : [];
    if (upstreamResponse.length === 0 && (team || date)) {
      const fallback = await loadSgoFallbackGames({ team, date });
      if (fallback.length > 0) {
        return NextResponse.json(
          {
            ok: true,
            season: includeSeason ? season : null,
            league: includeLeague ? league : null,
            response: fallback,
            errors: json?.errors ?? null,
            results: fallback.length,
          },
          { status: 200 },
        );
      }
    }
    return NextResponse.json(
      {
        ok: true,
        season: includeSeason ? season : null,
        league: includeLeague ? league : null,
        response: upstreamResponse,
        errors: json?.errors ?? null,
        results: json?.results ?? null,
      },
      { status: 200 },
    );
  }

  if (team || date) {
    const fallback = await loadSgoFallbackGames({ team, date });
    if (fallback.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          season: includeSeason ? seasonInput : null,
          league: includeLeague ? league : null,
          response: fallback,
          errors: { upstream: lastError?.body ?? "Upstream error", fallback: "sportsgameodds-cache" },
          results: fallback.length,
        },
        { status: 200 },
      );
    }
  }

  return NextResponse.json(
    {
      error: "Upstream error",
      status: lastError?.status ?? 502,
      body: lastError?.body ?? "",
    },
    { status: 502 },
  );
}
