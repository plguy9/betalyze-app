// app/api/nfl/odds/route.ts
import { NextRequest, NextResponse } from "next/server";

const ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const EVENTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_REGIONS = "us";
const DEFAULT_MARKETS = [
  "player_pass_yds",
  "player_rush_yds",
  "player_reception_yds",
  "player_receptions",
  "player_pass_tds",
].join(",");

type CacheEntry = {
  data: any;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const eventsCache = new Map<string, CacheEntry>();

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function filterOutcomesByPlayer(payload: any, playerName: string) {
  const needle = normalizeText(playerName);
  if (!needle) return payload;

  const nameTokens = needle.split(" ").filter(Boolean);
  const first = nameTokens[0] ?? "";
  const last = nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : "";
  const first3 = first ? first.slice(0, 3) : "";
  const first4 = first ? first.slice(0, 4) : "";
  const initial = first ? first.slice(0, 1) : "";
  const playerNeedles = new Set<string>();
  if (first && last) {
    playerNeedles.add(`${first} ${last}`);
    if (first4 && first4 !== first) playerNeedles.add(`${first4} ${last}`);
    if (first3 && first3 !== first && first3 !== first4) {
      playerNeedles.add(`${first3} ${last}`);
    }
    if (initial) playerNeedles.add(`${initial} ${last}`);
  } else if (first) {
    playerNeedles.add(first);
  }

  const matchesPlayer = (outcome: any) => {
    const desc = normalizeText(String(outcome?.description ?? ""));
    const name = normalizeText(String(outcome?.name ?? ""));
    const text = `${desc} ${name}`.trim();
    if (!text) return false;
    if (text.includes(needle)) return true;
    for (const candidate of playerNeedles) {
      if (candidate && text.includes(candidate)) return true;
    }
    return false;
  };

  const filterEvent = (event: any) => {
    if (!event || !Array.isArray(event.bookmakers)) return event;
    const bookmakers = event.bookmakers
      .map((book: any) => {
        const markets = (book.markets ?? [])
          .map((market: any) => {
            const outcomes = (market.outcomes ?? []).filter(matchesPlayer);
            if (!outcomes.length) return null;
            return { ...market, outcomes };
          })
          .filter(Boolean);
        if (!markets.length) return null;
        return { ...book, markets };
      })
      .filter(Boolean);
    return { ...event, bookmakers };
  };

  if (Array.isArray(payload)) {
    return payload.map((event) => filterEvent(event));
  }
  return filterEvent(payload);
}

function teamsMatch(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

async function resolveEventId(home: string, away: string) {
  const cacheKey = "americanfootball_nfl";
  const cached = eventsCache.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    const found = (cached.data ?? []).find(
      (event: any) =>
        teamsMatch(event?.home_team, home) && teamsMatch(event?.away_team, away),
    );
    return found?.id ?? null;
  }

  const eventsUrl = new URL("sports/americanfootball_nfl/events", `${ODDS_API_BASE}/`);
  eventsUrl.searchParams.set("apiKey", ODDS_API_KEY!);
  const res = await fetch(eventsUrl.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(json)) return null;
  eventsCache.set(cacheKey, { data: json, expiresAt: now + EVENTS_CACHE_TTL_MS });
  const found = json.find(
    (event: any) =>
      teamsMatch(event?.home_team, home) && teamsMatch(event?.away_team, away),
  );
  return found?.id ?? null;
}

export async function GET(req: NextRequest) {
  if (!ODDS_API_KEY) {
    return NextResponse.json({ error: "Missing Odds API key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const eventIdParam = params.get("eventId");
  const home = params.get("home");
  const away = params.get("away");
  const markets = params.get("markets") ?? DEFAULT_MARKETS;
  const regions = params.get("regions") ?? DEFAULT_REGIONS;
  const bookmakers = params.get("bookmakers");
  const oddsFormat = params.get("oddsFormat") ?? "american";
  const player = params.get("player");
  const refresh = params.get("refresh") === "1";

  let eventId = eventIdParam;
  if (!eventId) {
    if (!home || !away) {
      return NextResponse.json(
        { error: "Missing eventId or home/away parameters" },
        { status: 400 },
      );
    }
    eventId = await resolveEventId(home, away);
  }

  if (!eventId) {
    return NextResponse.json(
      { error: "Event not found for provided teams" },
      { status: 404 },
    );
  }

  const cacheKey = [
    eventId,
    regions,
    markets,
    bookmakers ?? "",
    oddsFormat,
  ].join("::");

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!refresh && cached && now < cached.expiresAt) {
    const filtered = player ? filterOutcomesByPlayer(cached.data, player) : cached.data;
    return NextResponse.json({
      ok: true,
      cached: true,
      eventId,
      home,
      away,
      markets,
      regions,
      bookmakers,
      oddsFormat,
      data: filtered,
    });
  }

  const url = new URL(
    `sports/americanfootball_nfl/events/${eventId}/odds`,
    `${ODDS_API_BASE}/`,
  );
  url.searchParams.set("apiKey", ODDS_API_KEY);
  url.searchParams.set("regions", regions);
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", oddsFormat);
  if (bookmakers) url.searchParams.set("bookmakers", bookmakers);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream odds error", status: res.status, body: txt || json },
        { status: 502 },
      );
    }

    cache.set(cacheKey, { data: json, expiresAt: now + CACHE_TTL_MS });

    const filtered = player ? filterOutcomesByPlayer(json, player) : json;
    return NextResponse.json({
      ok: true,
      cached: false,
      eventId,
      home,
      away,
      markets,
      regions,
      bookmakers,
      oddsFormat,
      data: filtered,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
