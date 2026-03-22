import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TEAM_CODE_BY_ID } from "@/lib/nba/constants";
import {
  purgeNbaOddsDailyCacheExcept,
  readNbaOddsDailyCache,
  writeNbaOddsDailyCache,
} from "@/lib/supabase/nba-odds-cache";

const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = process.env.ODDS_API_URL || "https://api.the-odds-api.com/v4";
const THE_ODDS_NBA_SPORT = "basketball_nba";
const THE_ODDS_BOOKMAKERS = "draftkings,fanduel,betmgm,bet365,williamhill_us,fanatics";
const THE_ODDS_DEFAULT_MARKETS = [
  "player_points",
  "player_points_alternate",
  "player_rebounds",
  "player_rebounds_alternate",
  "player_assists",
  "player_assists_alternate",
  "player_points_rebounds_assists",
  "player_points_rebounds_assists_alternate",
  "player_threes",
  "player_threes_alternate",
].join(",");
const CACHE_DIR = process.env.VERCEL ? "/tmp/.cache" : path.join(process.cwd(), ".cache");
const QUERY_TIMEZONE = "America/Toronto";

type TheOddsOutcome = {
  name?: string | null;
  description?: string | null;
  point?: number | null;
  price?: number | null;
};

type TheOddsMarket = {
  key?: string | null;
  outcomes?: TheOddsOutcome[] | null;
};

type TheOddsBookmaker = {
  key?: string | null;
  title?: string | null;
  markets?: TheOddsMarket[] | null;
};

type TheOddsEvent = {
  id?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  commence_time?: string | null;
  bookmakers?: TheOddsBookmaker[] | null;
};

type CachedOddsEvent = {
  id: string;
  eventID: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: TheOddsBookmaker[];
  status: { startsAt: string; cancelled: boolean };
  teams: {
    home: { teamID: string | null; names: { long: string; short: string | null } };
    away: { teamID: string | null; names: { long: string; short: string | null } };
  };
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

const TEAM_ID_BY_CODE = Object.entries(TEAM_CODE_BY_ID).reduce<Record<string, string>>(
  (acc, [id, code]) => {
    acc[code] = id;
    return acc;
  },
  {},
);

function getDateKeyInTimezone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysDateKey(dateKey: string, days: number) {
  const ts = Date.parse(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(ts) || !Number.isFinite(days)) return dateKey;
  const shifted = new Date(ts + days * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function cacheFilePath(dateKey: string) {
  return path.join(CACHE_DIR, `nba-events-${dateKey}.json`);
}

function getInternalAuthHeader(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return auth ? ({ authorization: auth } as Record<string, string>) : undefined;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTeamCodeByName(rawName: string | null | undefined): string | null {
  const key = normalizeText(rawName);
  return key ? TEAM_CODE_BY_NAME[key] ?? null : null;
}

function toCachedOddsEvent(raw: TheOddsEvent): CachedOddsEvent | null {
  const id = String(raw.id ?? "").trim();
  const homeTeam = String(raw.home_team ?? "").trim();
  const awayTeam = String(raw.away_team ?? "").trim();
  const startsAt = String(raw.commence_time ?? "").trim();
  if (!id || !homeTeam || !awayTeam || !startsAt) return null;

  const homeCode = resolveTeamCodeByName(homeTeam);
  const awayCode = resolveTeamCodeByName(awayTeam);

  return {
    id,
    eventID: id,
    home_team: homeTeam,
    away_team: awayTeam,
    commence_time: startsAt,
    bookmakers: Array.isArray(raw.bookmakers) ? raw.bookmakers : [],
    status: {
      startsAt,
      cancelled: false,
    },
    teams: {
      home: {
        teamID: homeCode ? TEAM_ID_BY_CODE[homeCode] ?? null : null,
        names: { long: homeTeam, short: homeCode },
      },
      away: {
        teamID: awayCode ? TEAM_ID_BY_CODE[awayCode] ?? null : null,
        names: { long: awayTeam, short: awayCode },
      },
    },
  };
}

function hasPlayerPropsInBook(book: TheOddsBookmaker): boolean {
  return (book.markets ?? []).some((market) => {
    const key = String(market?.key ?? "").trim().toLowerCase();
    if (!key.startsWith("player_")) return false;
    return (market.outcomes ?? []).some((outcome) => {
      const name = String(outcome?.description ?? "").trim();
      const point = Number(outcome?.point ?? NaN);
      return Boolean(name) && Number.isFinite(point);
    });
  });
}

function hasAnyPlayerProps(bookmakers: TheOddsBookmaker[] | null | undefined): boolean {
  return Array.isArray(bookmakers) && bookmakers.some((book) => hasPlayerPropsInBook(book));
}

function shouldPreserveCachedBookmakers(startsAtIso: string | null | undefined, nowMs: number) {
  const ts = Date.parse(String(startsAtIso ?? ""));
  if (!Number.isFinite(ts)) return false;
  // Keep cached props close to tipoff and during game window to avoid
  // losing markets when upstream temporarily drops live props.
  const maxBeforeTipoffMs = 2 * 60 * 60 * 1000;
  const maxAfterTipoffMs = 6 * 60 * 60 * 1000;
  return ts >= nowMs - maxAfterTipoffMs && ts <= nowMs + maxBeforeTipoffMs;
}

async function fetchTheOddsEventsWindow(
  targetDateKey: string,
): Promise<CachedOddsEvent[]> {
  const url = new URL(`sports/${THE_ODDS_NBA_SPORT}/events`, `${THE_ODDS_API_BASE}/`);
  url.searchParams.set("apiKey", THE_ODDS_API_KEY!);
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`The Odds /odds failed (${res.status}): ${body.slice(0, 240)}`);
  }

  const allEvents = (await res.json().catch(() => null)) as TheOddsEvent[] | null;
  const events = Array.isArray(allEvents)
    ? allEvents.filter((event) => {
        const raw = String(event?.commence_time ?? "").trim();
        if (!raw) return false;
        const ts = Date.parse(raw);
        if (!Number.isFinite(ts)) return false;
        const torontoDate = getDateKeyInTimezone(new Date(ts), QUERY_TIMEZONE);
        return torontoDate === targetDateKey;
      })
    : null;
  if (!Array.isArray(events) || events.length === 0) return [];

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const fetchTheOddsEventOdds = async (
    eventId: string,
    attempt = 0,
  ): Promise<TheOddsBookmaker[]> => {
    const oddsUrl = new URL(
      `sports/${THE_ODDS_NBA_SPORT}/events/${eventId}/odds`,
      `${THE_ODDS_API_BASE}/`,
    );
    oddsUrl.searchParams.set("apiKey", THE_ODDS_API_KEY!);
    oddsUrl.searchParams.set("bookmakers", THE_ODDS_BOOKMAKERS);
    oddsUrl.searchParams.set("markets", THE_ODDS_DEFAULT_MARKETS);
    oddsUrl.searchParams.set("oddsFormat", "decimal");
    oddsUrl.searchParams.set("dateFormat", "iso");

    const oddsRes = await fetch(oddsUrl.toString(), { cache: "no-store" });
    if (oddsRes.status === 429 && attempt < 4) {
      await sleep(700 * (attempt + 1));
      return fetchTheOddsEventOdds(eventId, attempt + 1);
    }
    if (!oddsRes.ok) {
      const body = await oddsRes.text().catch(() => "");
      throw new Error(
        `The Odds /events/{id}/odds failed (${oddsRes.status}): ${body.slice(0, 240)}`,
      );
    }
    const payload = (await oddsRes.json().catch(() => null)) as TheOddsEvent | null;
    return Array.isArray(payload?.bookmakers) ? payload.bookmakers : [];
  };

  const withOdds: CachedOddsEvent[] = [];
  for (const event of events) {
    const eventId = String(event?.id ?? "").trim();
    if (!eventId) continue;
    const bookmakers = await fetchTheOddsEventOdds(eventId);
    const mapped = toCachedOddsEvent({ ...event, bookmakers });
    if (mapped) withOdds.push(mapped);
    await sleep(250);
  }

  return withOdds;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  let isAuthorizedCron = false;
  if (cronSecret) {
    const expected = `Bearer ${cronSecret}`;
    isAuthorizedCron = auth === expected;
    if (!isAuthorizedCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!THE_ODDS_API_KEY) {
    return NextResponse.json(
      { error: "Missing THE_ODDS_API_KEY (or ODDS_API_KEY)" },
      { status: 500 },
    );
  }

  // Daily cron should always refresh upstream data, even if cache exists.
  const refresh =
    req.nextUrl.searchParams.get("refresh") === "1" || isAuthorizedCron;
  const skipTopProps = req.nextUrl.searchParams.get("skipTopProps") === "1";
  const skipLogs = req.nextUrl.searchParams.get("skipLogs") === "1";
  const now = new Date();
  const dateKey = getDateKeyInTimezone(now, QUERY_TIMEZONE);
  const file = cacheFilePath(dateKey);

  if (!refresh) {
    const supabaseCache = await readNbaOddsDailyCache(dateKey);
    if (supabaseCache) {
      return NextResponse.json({
        ok: true,
        cached: true,
        storage: "supabase",
        dateKey,
        events: supabaseCache.eventsCount,
        ts: supabaseCache.updatedAt,
        source: supabaseCache.source ?? "the-odds-api",
      });
    }

    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as { ts?: number; events?: CachedOddsEvent[] };
      if (Array.isArray(parsed?.events)) {
        return NextResponse.json({
          ok: true,
          cached: true,
          storage: "file",
          dateKey,
          events: parsed.events.length,
          ts: parsed.ts ?? null,
        });
      }
    } catch {
      // cache miss
    }
  }

  let events: CachedOddsEvent[] = [];
  try {
    events = await fetchTheOddsEventsWindow(dateKey);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "The Odds events sync failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
  let preservedFromCache = 0;
  const previousEventById = new Map<string, CachedOddsEvent>();
  const preserveSourceKeys = [dateKey, addDaysDateKey(dateKey, -1)];
  await Promise.all(
    preserveSourceKeys.map(async (key) => {
      const cache = await readNbaOddsDailyCache(key).catch(() => null);
      if (!cache || !Array.isArray(cache.events)) return;
      for (const raw of cache.events) {
        const mapped = toCachedOddsEvent(raw as TheOddsEvent);
        if (!mapped?.id) continue;
        const prev = previousEventById.get(mapped.id);
        if (!prev || hasAnyPlayerProps(mapped.bookmakers)) {
          previousEventById.set(mapped.id, mapped);
        }
      }
    }),
  );
  if (events.length > 0 && previousEventById.size > 0) {
    const nowMs = Date.now();
    events = events.map((event) => {
      if (!event?.id) return event;
      if (hasAnyPlayerProps(event.bookmakers)) return event;
      if (!shouldPreserveCachedBookmakers(event.commence_time, nowMs)) return event;
      const prev = previousEventById.get(event.id);
      if (!prev || !hasAnyPlayerProps(prev.bookmakers)) return event;
      preservedFromCache += 1;
      return {
        ...event,
        bookmakers: prev.bookmakers,
      };
    });
  }
  const startsAfter =
    events.length > 0
      ? events
          .map((event) => String(event.commence_time ?? ""))
          .filter(Boolean)
          .sort()[0] ?? null
      : null;
  const startsBefore =
    events.length > 0
      ? events
          .map((event) => String(event.commence_time ?? ""))
          .filter(Boolean)
          .sort()
          .slice(-1)[0] ?? null
      : null;

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify({ ts: Date.now(), dateKey, startsAfter, startsBefore, events }),
    "utf8",
  );
  const savedToSupabase = await writeNbaOddsDailyCache({
    dateKey,
    startsAfter,
    startsBefore,
    events: events as Record<string, unknown>[],
    source: "the-odds-api",
  });
  if (savedToSupabase && events.length > 0) {
    await purgeNbaOddsDailyCacheExcept([dateKey, addDaysDateKey(dateKey, -1)]);
  }

  let topPropsSync: {
    attempted: boolean;
    ok: boolean;
    status: number | null;
    props: number | null;
    error: string | null;
  } = {
    attempted: false,
    ok: false,
    status: null,
    props: null,
    error: null,
  };
  if (!skipTopProps) {
    try {
      const topPropsUrl = new URL("/api/nba/props/top", req.nextUrl.origin);
      topPropsUrl.searchParams.set("date", dateKey);
      topPropsUrl.searchParams.set("refresh", "1");
      topPropsSync.attempted = true;
      const topPropsRes = await fetch(topPropsUrl.toString(), { cache: "no-store" });
      const topPropsJson = (await topPropsRes.json().catch(() => null)) as
        | { props?: unknown; message?: unknown; error?: unknown }
        | null;
      topPropsSync = {
        attempted: true,
        ok: topPropsRes.ok,
        status: topPropsRes.status,
        props: Array.isArray(topPropsJson?.props) ? topPropsJson.props.length : null,
        error:
          topPropsRes.ok
            ? null
            : typeof topPropsJson?.message === "string"
              ? topPropsJson.message
              : typeof topPropsJson?.error === "string"
                ? topPropsJson.error
                : `top props sync failed (${topPropsRes.status})`,
      };
    } catch (err) {
      topPropsSync = {
        attempted: true,
        ok: false,
        status: null,
        props: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  let logsRefreshSync: {
    attempted: boolean;
    ok: boolean;
    status: number | null;
    date: string | null;
    processed: number | null;
    success: number | null;
    failed: number | null;
    error: string | null;
  } = {
    attempted: false,
    ok: false,
    status: null,
    date: null,
    processed: null,
    success: null,
    failed: null,
    error: null,
  };
  if (!skipLogs) {
    try {
      const logsUrl = new URL("/api/nba/logs/refresh-yesterday", req.nextUrl.origin);
      logsUrl.searchParams.set("refreshRoster", "0");
      logsUrl.searchParams.set("concurrency", "12");
      logsRefreshSync.attempted = true;
      const internalAuthHeader = getInternalAuthHeader(req);
      const logsRes = await fetch(logsUrl.toString(), {
        cache: "no-store",
        ...(internalAuthHeader ? { headers: internalAuthHeader } : {}),
      });
      const logsJson = (await logsRes.json().catch(() => null)) as
        | {
            date?: unknown;
            processed?: unknown;
            success?: unknown;
            failed?: unknown;
            error?: unknown;
          }
        | null;
      logsRefreshSync = {
        attempted: true,
        ok: logsRes.ok,
        status: logsRes.status,
        date: typeof logsJson?.date === "string" ? logsJson.date : null,
        processed:
          typeof logsJson?.processed === "number" && Number.isFinite(logsJson.processed)
            ? logsJson.processed
            : null,
        success:
          typeof logsJson?.success === "number" && Number.isFinite(logsJson.success)
            ? logsJson.success
            : null,
        failed:
          typeof logsJson?.failed === "number" && Number.isFinite(logsJson.failed)
            ? logsJson.failed
            : null,
        error:
          logsRes.ok
            ? null
            : typeof logsJson?.error === "string"
              ? logsJson.error
              : `logs refresh failed (${logsRes.status})`,
      };
    } catch (err) {
      logsRefreshSync = {
        attempted: true,
        ok: false,
        status: null,
        date: null,
        processed: null,
        success: null,
        failed: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    cached: false,
    dateKey,
    events: events.length,
    startsAfter,
    startsBefore,
    preservedFromCache,
    source: "the-odds-api",
    storage: savedToSupabase ? "supabase+file" : "file",
    topPropsSync,
    logsRefreshSync,
  });
}
