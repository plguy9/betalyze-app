// app/api/nba/odds/route.ts
// Data-source boundary:
// - This route is for odds/bookmakers only (SportsGameOdds/TheOdds).
// - Do not use this route as source of truth for NBA stats/logs/standings.
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  readNbaOddsDailyCache,
  writeNbaOddsDailyCache,
} from "@/lib/supabase/nba-odds-cache";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_BASKETBALL_URL || "https://v1.basketball.api-sports.io";
const SGO_API_KEY = process.env.SPORTSGAMEODDS_API_KEY;
const SGO_API_BASE =
  process.env.SPORTSGAMEODDS_API_URL || "https://api.sportsgameodds.com/v2";
const SGO_NBA_LEAGUE = "NBA";
const SGO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SGO_CACHE_DIR = path.join(process.cwd(), ".cache");
const sgoMemoryCache = new Map<string, { ts: number; events: SgoEvent[] }>();
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = process.env.ODDS_API_URL || "https://api.the-odds-api.com/v4";
const THE_ODDS_NBA_SPORT = "basketball_nba";
const THE_ODDS_REGIONS = "us";
const THE_ODDS_DEFAULT_MARKETS = [
  "totals",
  "spreads",
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
  "player_points_assists",
  "player_points_rebounds",
  "player_rebounds_assists",
].join(",");

type OddsValue = {
  value?: string | null;
  odd?: string | number | null;
};

type OddsBet = {
  id?: number | null;
  name?: string | null;
  values?: OddsValue[] | null;
};

type OddsBookmaker = {
  id?: number | null;
  name?: string | null;
  bets?: OddsBet[] | null;
};

type OddsResponse = {
  response?: Array<{
    bookmakers?: OddsBookmaker[];
  }>;
};

type OddsEnvelope = OddsResponse & {
  errors?: Record<string, unknown> | null;
  results?: number;
};

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
  bookmakers?: TheOddsBookmaker[] | null;
};

type SgoBookData = {
  odds?: string | number | null;
  overUnder?: string | number | null;
  available?: boolean | null;
};

type SgoOdd = {
  oddID?: string | null;
  statID?: string | null;
  statEntityID?: string | null;
  periodID?: string | null;
  betTypeID?: string | null;
  sideID?: string | null;
  bookOverUnder?: string | number | null;
  bookOdds?: string | number | null;
  byBookmaker?: Record<string, SgoBookData> | null;
};

type SgoEvent = {
  eventID?: string | null;
  teams?: {
    home?: { names?: { long?: string | null; short?: string | null } | null } | null;
    away?: { names?: { long?: string | null; short?: string | null } | null } | null;
  } | null;
  status?: { startsAt?: string | null } | null;
  players?: Record<
    string,
    { playerID?: string | null; teamID?: string | null; name?: string | null }
  > | null;
  odds?: Record<string, SgoOdd> | null;
};

type PlayerProp = {
  name: string;
  metric: string;
  line: number;
  odd: string | null;
  overOdd?: string | null;
  underOdd?: string | null;
  teamCode?: string | null;
  opponentCode?: string | null;
  bookmakerId?: number | null;
  bookmakerName?: string | null;
};

type BookmakerOption = {
  key: string;
  name: string;
};

type OddsCacheLayer = "memory" | "supabase" | "file" | "network";

const PRIMARY_BOOKMAKER_PRIORITY = [
  "fanduel",
  "draftkings",
  "betmgm",
  "caesars",
  "pointsbet",
  "bet365",
  "pinnacle",
  "william hill",
  "unibet",
];

function normalizeBookmakerName(name: string | null | undefined) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactBookmakerName(name: string | null | undefined) {
  return normalizeBookmakerName(name).replace(/\s+/g, "");
}

function bookmakerPriority(name: string | null | undefined) {
  const normalized = normalizeBookmakerName(name);
  const idx = PRIMARY_BOOKMAKER_PRIORITY.findIndex((candidate) =>
    normalized.includes(candidate),
  );
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
}

function parseNumberFromValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function dedupeBookmakerOptions(options: BookmakerOption[]): BookmakerOption[] {
  const seen = new Set<string>();
  const out: BookmakerOption[] = [];
  for (const option of options) {
    const key = normalizeBookmakerToken(option.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name: option.name || option.key });
  }
  return out;
}

function pickBookmaker(
  bookmakers: OddsBookmaker[],
  desiredId?: string | null,
): OddsBookmaker | null {
  if (!bookmakers.length) return null;
  if (desiredId) {
    const byId = bookmakers.find(
      (b) => String(b.id ?? "") === String(desiredId),
    );
    if (byId) return byId;
    const byName = bookmakers.find((b) =>
      normalizeBookmakerName(b.name).includes(normalizeBookmakerName(desiredId)),
    );
    if (byName) return byName;
  }
  const propMarkets = new Set([
    "Player Points",
    "Player Assists",
    "Player Rebounds",
    "Player Three Point shots made",
    "Player 3-Point Field Goals Made",
    "Player 3 points made",
    "Player Points, Assists and Rebounds",
    "Player Points and Assists",
    "Player Points and Rebounds",
    "Player Points Milestones",
  ]);
  const withProps = bookmakers.filter((b) =>
    (b.bets ?? []).some((bet) => propMarkets.has(bet.name ?? "")),
  );
  const primaryWithProps = withProps
    .filter((b) => Number.isFinite(bookmakerPriority(b.name)))
    .sort((a, b) => bookmakerPriority(a.name) - bookmakerPriority(b.name));
  if (primaryWithProps.length) return primaryWithProps[0];

  const primaryAny = bookmakers
    .filter((b) => Number.isFinite(bookmakerPriority(b.name)))
    .sort((a, b) => bookmakerPriority(a.name) - bookmakerPriority(b.name));
  if (primaryAny.length) return primaryAny[0];

  return withProps[0] ?? bookmakers[0] ?? null;
}

function pickBookmakerStrict(
  bookmakers: OddsBookmaker[],
  desiredId?: string | null,
): OddsBookmaker | null {
  if (!bookmakers.length || !desiredId) return null;
  const byId = bookmakers.find((b) => String(b.id ?? "") === String(desiredId));
  if (byId) return byId;
  const desiredName = normalizeBookmakerName(desiredId);
  if (!desiredName) return null;
  const desiredCompact = compactBookmakerName(desiredId);
  const byName = bookmakers.find((b) =>
    normalizeBookmakerName(b.name).includes(desiredName) ||
    compactBookmakerName(b.name).includes(desiredCompact),
  );
  return byName ?? null;
}

function metricFromBetName(rawName: string | null | undefined): string | null {
  const name = String(rawName ?? "").toLowerCase();
  if (!name) return null;
  if (name.includes("player points, assists and rebounds")) return "PRA";
  if (name.includes("player points and assists")) return "P+A";
  if (name.includes("player points and rebounds")) return "P+R";
  if (name.includes("player points")) return "Points";
  if (name.includes("player assists")) return "Assists";
  if (name.includes("player rebounds")) return "Rebounds";
  if (name.includes("three point") || name.includes("3-point") || name.includes("3 points")) {
    return "3PM";
  }
  return null;
}

function hasPlayerProps(bookmaker: OddsBookmaker): boolean {
  return (bookmaker.bets ?? []).some((bet) => metricFromBetName(bet.name) !== null);
}

function extractTotal(bets: OddsBet[]): number | null {
  const target =
    bets.find((b) => (b.name ?? "").toLowerCase() === "over/under") ??
    bets.find((b) => (b.name ?? "").toLowerCase().includes("over/under"));
  if (!target?.values?.length) return null;

  const counts = new Map<number, { count: number; bestOdd: number }>();
  for (const v of target.values) {
    const line = parseNumberFromValue(v.value ?? null);
    if (line === null) continue;
    const odd = Number(v.odd);
    const entry = counts.get(line) ?? { count: 0, bestOdd: Number.POSITIVE_INFINITY };
    entry.count += 1;
    if (Number.isFinite(odd)) {
      const gap = Math.abs(odd - 1.9);
      const bestGap = Math.abs(entry.bestOdd - 1.9);
      if (gap < bestGap) entry.bestOdd = odd;
    }
    counts.set(line, entry);
  }

  if (!counts.size) return null;
  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    const gapA = Math.abs(a[1].bestOdd - 1.9);
    const gapB = Math.abs(b[1].bestOdd - 1.9);
    return gapA - gapB;
  });
  return sorted[0][0] ?? null;
}

function extractSpread(
  bets: OddsBet[],
): { side: "home" | "away"; line: number } | null {
  const target = bets.find((b) =>
    ["asian handicap", "handicap result"].some((n) =>
      (b.name ?? "").toLowerCase().includes(n),
    ),
  );
  if (!target?.values?.length) return null;

  const candidates: Array<{ side: "home" | "away"; line: number; odd: number }> = [];
  for (const v of target.values) {
    const raw = v.value ?? "";
    const match = raw.match(/(home|away)\s*([+-]?[0-9]+(?:\.[0-9]+)?)/i);
    if (!match) continue;
    const side = match[1].toLowerCase() === "home" ? "home" : "away";
    const line = Number(match[2]);
    if (!Number.isFinite(line)) continue;
    const odd = Number(v.odd);
    candidates.push({ side, line, odd });
  }

  if (!candidates.length) return null;
  const preferred =
    candidates.filter((c) => c.line < 0).length > 0
      ? candidates.filter((c) => c.line < 0)
      : candidates;
  preferred.sort((a, b) => {
    const gapA = Number.isFinite(a.odd) ? Math.abs(a.odd - 1.9) : 0;
    const gapB = Number.isFinite(b.odd) ? Math.abs(b.odd - 1.9) : 0;
    return gapA - gapB;
  });
  return { side: preferred[0].side, line: preferred[0].line };
}

function extractPlayerPropsFromBets(bets: OddsBet[]): PlayerProp[] {
  const map = new Map<string, PlayerProp>();
  for (const bet of bets) {
    const metric = metricFromBetName(bet.name);
    if (!metric || !bet?.values?.length) continue;
    for (const v of bet.values) {
      const raw = String(v.value ?? "");
      const odd = v.odd !== null && v.odd !== undefined ? String(v.odd) : null;
      const overUnderMatch = raw.match(
        /^(.+?)\s*-\s*(Over|Under)\s*([0-9]+(?:\.[0-9]+)?)/i,
      );
      if (overUnderMatch) {
        const name = overUnderMatch[1].trim();
        const side = overUnderMatch[2].toLowerCase();
        const line = Number(overUnderMatch[3]);
        if (!Number.isFinite(line)) continue;
        const key = `${metric}::${name.toLowerCase()}::${line}`;
        const current = map.get(key) ?? {
          name,
          metric,
          line,
          odd: null,
          overOdd: null,
          underOdd: null,
          teamCode: null,
          opponentCode: null,
        };
        if (side === "over") current.overOdd = odd;
        if (side === "under") current.underOdd = odd;
        current.odd = current.overOdd ?? current.underOdd ?? odd;
        map.set(key, current);
        continue;
      }

      const milestoneMatch = raw.match(/^(.+?)\s*-\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (milestoneMatch) {
        const name = milestoneMatch[1].trim();
        const line = Number(milestoneMatch[2]);
        if (!Number.isFinite(line)) continue;
        const key = `${metric}::${name.toLowerCase()}::${line}`;
        const current = map.get(key) ?? {
          name,
          metric,
          line,
          odd: null,
          overOdd: null,
          underOdd: null,
          teamCode: null,
          opponentCode: null,
        };
        current.overOdd = current.overOdd ?? odd;
        current.odd = current.odd ?? odd;
        map.set(key, current);
      }
    }
  }

  return Array.from(map.values());
}

function extractPlayerProps(bookmakers: OddsBookmaker[]): PlayerProp[] {
  if (!bookmakers.length) return [];

  const sortedBooks = bookmakers
    .map((book, idx) => ({ book, idx }))
    .sort((a, b) => {
      const pa = bookmakerPriority(a.book.name);
      const pb = bookmakerPriority(b.book.name);
      if (pa !== pb) return pa - pb;
      return a.idx - b.idx;
    })
    .map((x) => x.book);

  const propBooks = sortedBooks.filter(hasPlayerProps);
  const booksToScan = propBooks.length ? propBooks : sortedBooks;

  const merged = new Map<string, PlayerProp>();
  for (const book of booksToScan) {
    const props = extractPlayerPropsFromBets(book.bets ?? []);
    for (const prop of props) {
      const key = `${prop.metric}::${normalizePlayerName(prop.name)}::${prop.line}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          ...prop,
          bookmakerId: book.id ?? null,
          bookmakerName: book.name ?? null,
        });
        continue;
      }
      if (!existing.overOdd && prop.overOdd) existing.overOdd = prop.overOdd;
      if (!existing.underOdd && prop.underOdd) existing.underOdd = prop.underOdd;
      if (!existing.odd && prop.odd) existing.odd = prop.odd;
    }
  }

  return Array.from(merged.values());
}

function normalizePlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumericId(value: string | null | undefined): boolean {
  return /^\d+$/.test(String(value ?? ""));
}

async function fetchOddsEnvelope(
  game: string,
  bookmakerId?: string | null,
): Promise<
  | { ok: true; payload: OddsEnvelope; bookmakers: OddsBookmaker[] }
  | { ok: false; status: number; body: string }
> {
  const url = new URL("/odds", API_BASE);
  url.searchParams.set("game", game);
  if (bookmakerId && isNumericId(bookmakerId)) {
    url.searchParams.set("bookmaker", bookmakerId);
  }

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: txt };
  }

  const payload = (await res.json()) as OddsEnvelope;
  const bookmakers = payload.response?.[0]?.bookmakers ?? [];
  return { ok: true, payload, bookmakers };
}

async function resolveBookmakerIdByName(
  requestedName: string,
): Promise<string | null> {
  const desiredNorm = normalizeBookmakerName(requestedName);
  const desiredCompact = compactBookmakerName(requestedName);
  if (!desiredNorm || !desiredCompact) return null;

  try {
    const url = new URL("/bookmakers", API_BASE);
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY! },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      response?: Array<{ id?: number | null; name?: string | null }>;
    };
    const items = payload.response ?? [];
    if (!items.length) return null;

    const scored = items
      .map((item) => {
        const norm = normalizeBookmakerName(item.name);
        const compact = compactBookmakerName(item.name);
        let score = 0;
        if (compact === desiredCompact) score += 100;
        if (norm === desiredNorm) score += 80;
        if (compact.includes(desiredCompact)) score += 40;
        if (desiredCompact.includes(compact)) score += 20;
        if (norm.includes(desiredNorm)) score += 30;
        if (desiredNorm.includes(norm)) score += 10;
        if (Number.isFinite(bookmakerPriority(item.name))) score += 5;
        return { id: item.id, score };
      })
      .filter((x) => x.id != null && x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;
    return String(scored[0].id);
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBookmakerToken(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function americanToDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === "EVEN" || upper === "EV") return 2;

  const num = Number(raw);
  if (!Number.isFinite(num)) return null;

  // Explicit American format (+117 / -110)
  if (/^[+-]\d+(\.\d+)?$/.test(raw)) {
    if (num > 0) return Number((1 + num / 100).toFixed(2));
    if (num < 0) return Number((1 + 100 / Math.abs(num)).toFixed(2));
    return null;
  }

  // Heuristic fallback:
  // - large magnitudes are American-like
  // - small positive values are already decimal odds
  if (num >= 100 || num <= -100) {
    if (num > 0) return Number((1 + num / 100).toFixed(2));
    return Number((1 + 100 / Math.abs(num)).toFixed(2));
  }
  if (num > 1) return Number(num.toFixed(2));
  return null;
}

function metricFromSgoStatId(raw: string | null | undefined): string | null {
  const statId = String(raw ?? "").toLowerCase();
  if (!statId) return null;
  if (statId === "points") return "Points";
  if (statId === "rebounds") return "Rebounds";
  if (statId === "assists") return "Assists";
  if (statId === "threepointersmade") return "3PM";
  if (statId === "points+rebounds+assists") return "PRA";
  if (statId === "points+assists") return "P+A";
  if (statId === "points+rebounds") return "P+R";
  if (statId === "rebounds+assists") return "R+A";
  return null;
}

function displayNameFromPlayerId(playerId: string): string {
  return playerId
    .replace(/_NBA$/i, "")
    .replace(/_\d+$/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function formatBookDisplayName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/^Draftkings$/i, "DraftKings")
    .replace(/^Fanduel$/i, "FanDuel")
    .replace(/^Betmgm$/i, "BetMGM")
    .replace(/^Espnbet$/i, "ESPNBet");
}

function pickSgoBookmaker(
  event: SgoEvent,
  requestedBookmaker?: string | null,
): {
  selectedBook: string | null;
  selectionMode: "requested" | "fallback" | "auto";
  availableBookmakers: BookmakerOption[];
} {
  const desired = normalizeBookmakerToken(requestedBookmaker);
  const priority = ["fanduel", "draftkings", "betmgm", "caesars", "espnbet", "bet365"];

  const availableBookmakers = dedupeBookmakerOptions(
    Object.values(event.odds ?? {}).flatMap((odd) => {
      if (odd.periodID !== "game" || odd.betTypeID !== "ou") return [];
      if (!metricFromSgoStatId(odd.statID)) return [];
      if (!odd.statEntityID || ["all", "home", "away"].includes(odd.statEntityID)) return [];
      return Object.entries(odd.byBookmaker ?? {})
        .filter(([, bookData]) => Boolean(bookData?.available))
        .map(([book]) => ({
          key: normalizeBookmakerToken(book),
          name: formatBookDisplayName(book),
        }));
    }),
  );
  const availableBookKeys = new Set(availableBookmakers.map((book) => book.key));

  if (!availableBookKeys.size) {
    return {
      selectedBook: null,
      selectionMode: requestedBookmaker ? "requested" : "auto",
      availableBookmakers,
    };
  }
  if (desired && availableBookKeys.has(desired)) {
    return { selectedBook: desired, selectionMode: "requested", availableBookmakers };
  }
  for (const book of priority) {
    if (availableBookKeys.has(book)) {
      return {
        selectedBook: book,
        selectionMode: requestedBookmaker ? "fallback" : "auto",
        availableBookmakers,
      };
    }
  }
  const first = Array.from(availableBookKeys)[0] ?? null;
  return {
    selectedBook: first,
    selectionMode: requestedBookmaker ? "fallback" : "auto",
    availableBookmakers,
  };
}

async function fetchSgoEventsWindow(
  startsAfterIso: string,
  startsBeforeIso: string,
): Promise<SgoEvent[]> {
  if (!SGO_API_KEY) return [];
  const events: SgoEvent[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const url = new URL("/events", `${SGO_API_BASE}/`);
    url.searchParams.set("leagueID", SGO_NBA_LEAGUE);
    url.searchParams.set("oddsAvailable", "true");
    url.searchParams.set("startsAfter", startsAfterIso);
    url.searchParams.set("startsBefore", startsBeforeIso);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { "X-API-Key": SGO_API_KEY },
      cache: "no-store",
    });
    if (!res.ok) break;
    const json = (await res.json().catch(() => null)) as
      | { data?: SgoEvent[]; nextCursor?: string | null }
      | null;
    const batch = Array.isArray(json?.data) ? json!.data! : [];
    events.push(...batch);
    cursor = json?.nextCursor ? String(json.nextCursor) : null;
    if (!cursor) break;
  }
  return events;
}

function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sgoCacheFilePath(dateKey: string) {
  return path.join(SGO_CACHE_DIR, `nba-events-${dateKey}.json`);
}

async function readSgoCacheFromDisk(dateKey: string): Promise<SgoEvent[] | null> {
  try {
    const file = sgoCacheFilePath(dateKey);
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { ts?: number; events?: SgoEvent[] };
    if (!Array.isArray(parsed?.events)) return null;
    if (Date.now() - Number(parsed?.ts ?? 0) > SGO_CACHE_TTL_MS) return null;
    return parsed.events;
  } catch {
    return null;
  }
}

async function writeSgoCacheToDisk(dateKey: string, events: SgoEvent[]) {
  try {
    await fs.mkdir(SGO_CACHE_DIR, { recursive: true });
    const file = sgoCacheFilePath(dateKey);
    await fs.writeFile(
      file,
      JSON.stringify({ ts: Date.now(), dateKey, events }),
      "utf8",
    );
  } catch {
    // ignore cache write errors
  }
}

async function fetchSgoEventsDailyCached(
  refresh: boolean,
  startsAfterIso: string,
  startsBeforeIso: string,
  allowNetwork = true,
): Promise<{ events: SgoEvent[]; cacheLayer: OddsCacheLayer }> {
  const dateKey = getUtcDateKey();
  const mem = sgoMemoryCache.get(dateKey);
  if (!refresh && mem && Date.now() - mem.ts < SGO_CACHE_TTL_MS) {
    return { events: mem.events, cacheLayer: "memory" };
  }

  if (!refresh) {
    const supabaseCache = await readNbaOddsDailyCache(dateKey);
    if (supabaseCache) {
      const events = supabaseCache.events as SgoEvent[];
      if (events.length > 0) {
        sgoMemoryCache.set(dateKey, {
          ts: supabaseCache.updatedAtMs ?? Date.now(),
          events,
        });
        await writeSgoCacheToDisk(dateKey, events);
        return { events, cacheLayer: "supabase" };
      }
    }
  }

  if (!refresh) {
    const disk = await readSgoCacheFromDisk(dateKey);
    if (disk) {
      sgoMemoryCache.set(dateKey, { ts: Date.now(), events: disk });
      return { events: disk, cacheLayer: "file" };
    }
  }

  if (!allowNetwork) {
    return { events: [], cacheLayer: "file" };
  }

  const events = await fetchSgoEventsWindow(startsAfterIso, startsBeforeIso);
  sgoMemoryCache.set(dateKey, { ts: Date.now(), events });
  await Promise.allSettled([
    writeSgoCacheToDisk(dateKey, events),
    writeNbaOddsDailyCache({
      dateKey,
      startsAfter: startsAfterIso,
      startsBefore: startsBeforeIso,
      events: events as Record<string, unknown>[],
      source: "sportsgameodds",
    }),
  ]);
  return { events, cacheLayer: "network" };
}

async function fetchSgoOddsForMatch(
  home: string,
  away: string,
  requestedBookmaker?: string | null,
): Promise<{
  ok: boolean;
  source: "sportsgameodds";
  cacheLayer: OddsCacheLayer;
  bookmaker: { id: null; name: string | null } | null;
  availableBookmakers: BookmakerOption[];
  selectionMode: "requested" | "fallback" | "auto";
  playerProps: PlayerProp[];
  total: number | null;
  spread: { side: "home" | "away"; line: number } | null;
} | null> {
  if (!SGO_API_KEY) return null;
  if (!home || !away) return null;
  const now = new Date();
  const startsAfter = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const startsBefore = new Date(now.getTime() + 120 * 60 * 60 * 1000).toISOString();
  // Sync-only mode:
  // API reads daily cache layers only (memory/supabase/file). No direct SGO network fetch here.
  const { events, cacheLayer } = await fetchSgoEventsDailyCached(
    false,
    startsAfter,
    startsBefore,
    false,
  );
  if (!events.length) return null;

  let event = events.find((e) => {
    const eh = e.teams?.home?.names?.long ?? "";
    const ea = e.teams?.away?.names?.long ?? "";
    return teamsMatch(eh, home) && teamsMatch(ea, away);
  });
  if (!event) {
    event = events.find((e) => {
      const eh = e.teams?.home?.names?.long ?? "";
      const ea = e.teams?.away?.names?.long ?? "";
      return teamsMatch(eh, away) && teamsMatch(ea, home);
    });
  }
  if (!event) return null;

  const { selectedBook, selectionMode, availableBookmakers } = pickSgoBookmaker(
    event,
    requestedBookmaker,
  );
  if (!selectedBook) {
    return {
      ok: true,
      source: "sportsgameodds",
      cacheLayer,
      bookmaker: null,
      availableBookmakers,
      selectionMode,
      playerProps: [],
      total: null,
      spread: null,
    };
  }

  const displayBook = formatBookDisplayName(selectedBook);
  const homeTeamId = String(event.teams?.home?.teamID ?? "");
  const awayTeamId = String(event.teams?.away?.teamID ?? "");
  const homeCode = String(event.teams?.home?.names?.short ?? "")
    .trim()
    .toUpperCase();
  const awayCode = String(event.teams?.away?.names?.short ?? "")
    .trim()
    .toUpperCase();
  const propsMap = new Map<string, PlayerProp>();
  let total: number | null = null;

  for (const odd of Object.values(event.odds ?? {})) {
    if (odd.periodID !== "game" || odd.betTypeID !== "ou") continue;
    const bookDataRaw = odd.byBookmaker?.[selectedBook];
    if (!bookDataRaw || !bookDataRaw.available) continue;
    const side = String(odd.sideID ?? "").toLowerCase();
    if (side !== "over" && side !== "under") continue;
    const lineNum = parseNumberFromValue(
      String(bookDataRaw.overUnder ?? odd.bookOverUnder ?? ""),
    );
    if (lineNum === null) continue;
    const oddNum =
      americanToDecimal(bookDataRaw.odds) ?? americanToDecimal(odd.bookOdds) ?? null;
    const oddTxt = oddNum !== null ? oddNum.toFixed(2) : null;

    const statEntityId = String(odd.statEntityID ?? "");
    const metric = metricFromSgoStatId(odd.statID);
    if (!metric) {
      if (statEntityId.toLowerCase() === "all" && String(odd.statID ?? "").toLowerCase() === "points") {
        total = lineNum;
      }
      continue;
    }
    if (!statEntityId || ["all", "home", "away"].includes(statEntityId.toLowerCase())) continue;

    const player = event.players?.[statEntityId];
    const playerName = player?.name?.trim() || displayNameFromPlayerId(statEntityId);
    const playerTeamId = String(player?.teamID ?? "");
    let teamCode: string | null = null;
    let opponentCode: string | null = null;
    if (playerTeamId && homeTeamId && awayTeamId && homeCode && awayCode) {
      if (playerTeamId === homeTeamId) {
        teamCode = homeCode;
        opponentCode = awayCode;
      } else if (playerTeamId === awayTeamId) {
        teamCode = awayCode;
        opponentCode = homeCode;
      }
    }
    const key = `${metric}::${normalizePlayerName(playerName)}::${lineNum}`;
    const current = propsMap.get(key) ?? {
      name: playerName,
      metric,
      line: lineNum,
      odd: null,
      overOdd: null,
      underOdd: null,
      teamCode,
      opponentCode,
      bookmakerId: null,
      bookmakerName: displayBook,
    };
    if (side === "over") current.overOdd = oddTxt;
    if (side === "under") current.underOdd = oddTxt;
    current.odd = current.overOdd ?? current.underOdd ?? oddTxt;
    propsMap.set(key, current);
  }

  return {
    ok: true,
    source: "sportsgameodds",
    cacheLayer,
    bookmaker: { id: null, name: displayBook },
    availableBookmakers,
    selectionMode,
    playerProps: Array.from(propsMap.values()),
    total,
    spread: null,
  };
}

function getTheOddsAvailableBookmakers(books: TheOddsBookmaker[]): BookmakerOption[] {
  const withProps = books.filter(hasTheOddsPlayerProps);
  return dedupeBookmakerOptions(
    withProps.map((book) => ({
      key: normalizeBookmakerKey(book.key ?? book.title),
      name: String(book.title ?? book.key ?? "").trim(),
    })),
  );
}

function getApiSportsAvailableBookmakers(books: OddsBookmaker[]): BookmakerOption[] {
  const withProps = books.filter(hasPlayerProps);
  return dedupeBookmakerOptions(
    withProps.map((book) => ({
      key: book.id !== null && book.id !== undefined ? String(book.id) : compactBookmakerName(book.name),
      name: String(book.name ?? "").trim(),
    })),
  );
}

function normalizeBookmakerKey(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function teamsMatch(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function formatDecimalOdd(value: number | null | undefined): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function metricFromTheOddsMarketKey(rawKey: string | null | undefined): string | null {
  const key = String(rawKey ?? "").toLowerCase();
  if (!key) return null;
  if (key === "player_points") return "Points";
  if (key === "player_rebounds") return "Rebounds";
  if (key === "player_assists") return "Assists";
  if (key === "player_threes") return "3PM";
  if (key === "player_points_rebounds_assists") return "PRA";
  if (key === "player_points_assists") return "P+A";
  if (key === "player_points_rebounds") return "P+R";
  if (key === "player_rebounds_assists") return "R+A";
  return null;
}

function hasTheOddsPlayerProps(book: TheOddsBookmaker): boolean {
  return (book.markets ?? []).some((market) =>
    Boolean(metricFromTheOddsMarketKey(market.key)),
  );
}

function pickTheOddsBookmaker(
  books: TheOddsBookmaker[],
  requestedBookmaker?: string | null,
): TheOddsBookmaker | null {
  if (!books.length) return null;

  const requested = normalizeBookmakerKey(requestedBookmaker);
  if (requested) {
    const exact = books.find((book) => normalizeBookmakerKey(book.key) === requested);
    if (exact) return exact;
    const byTitle = books.find(
      (book) => normalizeBookmakerKey(book.title).includes(requested),
    );
    if (byTitle) return byTitle;
  }

  const withProps = books.filter(hasTheOddsPlayerProps);
  const source = withProps.length ? withProps : books;
  const priority = [
    "fanduel",
    "draftkings",
    "betmgm",
    "betrivers",
    "caesars",
    "bet365",
    "pinnacle",
  ];
  const ranked = source
    .map((book) => {
      const key = normalizeBookmakerKey(book.key ?? book.title);
      const idx = priority.findIndex((k) => key.includes(k));
      return { book, rank: idx >= 0 ? idx : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.rank - b.rank);
  return ranked[0]?.book ?? source[0] ?? null;
}

function extractPlayerPropsFromTheOddsBook(book: TheOddsBookmaker): PlayerProp[] {
  const merged = new Map<string, PlayerProp>();
  for (const market of book.markets ?? []) {
    const metric = metricFromTheOddsMarketKey(market.key);
    if (!metric) continue;
    for (const outcome of market.outcomes ?? []) {
      const name = String(outcome.description ?? "").trim();
      if (!name) continue;
      const line = Number(outcome.point);
      if (!Number.isFinite(line)) continue;
      const side = String(outcome.name ?? "").toLowerCase();
      const odd = formatDecimalOdd(outcome.price);
      const key = `${metric}::${normalizePlayerName(name)}::${line}`;
      const current = merged.get(key) ?? {
        name,
        metric,
        line,
        odd: null,
        overOdd: null,
        underOdd: null,
        bookmakerId: null,
        bookmakerName: book.title ?? book.key ?? null,
      };
      if (side.includes("over")) current.overOdd = odd;
      if (side.includes("under")) current.underOdd = odd;
      current.odd = current.overOdd ?? current.underOdd ?? current.odd ?? odd;
      merged.set(key, current);
    }
  }
  return Array.from(merged.values());
}

function extractTotalFromTheOddsBook(book: TheOddsBookmaker): number | null {
  const market = (book.markets ?? []).find((m) => String(m.key ?? "") === "totals");
  if (!market?.outcomes?.length) return null;
  const counts = new Map<number, { count: number; bestGap: number }>();
  for (const outcome of market.outcomes) {
    const line = Number(outcome.point);
    if (!Number.isFinite(line)) continue;
    const price = Number(outcome.price);
    const gap = Number.isFinite(price) ? Math.abs(price - 1.9) : 9;
    const prev = counts.get(line) ?? { count: 0, bestGap: 9 };
    prev.count += 1;
    prev.bestGap = Math.min(prev.bestGap, gap);
    counts.set(line, prev);
  }
  if (!counts.size) return null;
  return Array.from(counts.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[1].bestGap - b[1].bestGap;
  })[0][0];
}

function extractSpreadFromTheOddsBook(
  book: TheOddsBookmaker,
  event: TheOddsEvent,
): { side: "home" | "away"; line: number } | null {
  const market = (book.markets ?? []).find((m) => String(m.key ?? "") === "spreads");
  if (!market?.outcomes?.length) return null;
  const options: Array<{ side: "home" | "away"; line: number; gap: number }> = [];
  for (const outcome of market.outcomes) {
    const line = Number(outcome.point);
    if (!Number.isFinite(line)) continue;
    const name = String(outcome.name ?? "");
    let side: "home" | "away" = "home";
    if (teamsMatch(name, event.away_team)) side = "away";
    if (teamsMatch(name, event.home_team)) side = "home";
    const price = Number(outcome.price);
    const gap = Number.isFinite(price) ? Math.abs(price - 1.9) : 9;
    options.push({ side, line, gap });
  }
  if (!options.length) return null;
  const preferred = options.some((o) => o.line < 0)
    ? options.filter((o) => o.line < 0)
    : options;
  preferred.sort((a, b) => a.gap - b.gap);
  return { side: preferred[0].side, line: preferred[0].line };
}

async function resolveTheOddsEventId(
  home: string,
  away: string,
): Promise<{ eventId: string; home: string; away: string } | null> {
  if (!THE_ODDS_API_KEY || !home || !away) return null;
  const url = new URL(`sports/${THE_ODDS_NBA_SPORT}/events`, `${THE_ODDS_API_BASE}/`);
  url.searchParams.set("apiKey", THE_ODDS_API_KEY);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const events = (await res.json().catch(() => null)) as TheOddsEvent[] | null;
  if (!Array.isArray(events)) return null;
  const direct = events.find(
    (e) => teamsMatch(e.home_team, home) && teamsMatch(e.away_team, away),
  );
  if (direct?.id) {
    return {
      eventId: String(direct.id),
      home: String(direct.home_team ?? home),
      away: String(direct.away_team ?? away),
    };
  }
  const reversed = events.find(
    (e) => teamsMatch(e.home_team, away) && teamsMatch(e.away_team, home),
  );
  if (reversed?.id) {
    return {
      eventId: String(reversed.id),
      home: String(reversed.home_team ?? home),
      away: String(reversed.away_team ?? away),
    };
  }
  return null;
}

async function fetchTheOddsEventOdds(
  eventId: string,
  bookmaker?: string | null,
): Promise<TheOddsEvent | null> {
  if (!THE_ODDS_API_KEY || !eventId) return null;
  const url = new URL(
    `sports/${THE_ODDS_NBA_SPORT}/events/${eventId}/odds`,
    `${THE_ODDS_API_BASE}/`,
  );
  url.searchParams.set("apiKey", THE_ODDS_API_KEY);
  url.searchParams.set("regions", THE_ODDS_REGIONS);
  url.searchParams.set("markets", THE_ODDS_DEFAULT_MARKETS);
  url.searchParams.set("oddsFormat", "decimal");
  if (bookmaker) {
    const normalized = normalizeBookmakerKey(bookmaker);
    if (normalized) url.searchParams.set("bookmakers", normalized);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as TheOddsEvent | null;
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const game = params.get("game");
  const bookmaker = params.get("bookmaker");
  const home = params.get("home");
  const away = params.get("away");

  const emptyOdds = (reason?: string) =>
    NextResponse.json(
      {
        ok: true,
        game: game ? Number(game) : null,
        bookmaker: null,
        availableBookmakers: [],
        total: null,
        spread: null,
        playerProps: [],
        requestedBookmaker: bookmaker ?? null,
        resolvedBookmakerId: null,
        selectionMode: bookmaker ? "requested" : "auto",
        source: "none",
        cacheLayer: "network",
        reason: reason ?? null,
      },
      { status: 200 },
    );

  if (!game && !(home && away)) {
    return NextResponse.json({ error: "Missing game id" }, { status: 400 });
  }

  try {
    if (home && away && SGO_API_KEY) {
      const sgo = await fetchSgoOddsForMatch(home, away, bookmaker);
      if (sgo) {
        return NextResponse.json(
          {
            ok: sgo.ok,
            game: game ? Number(game) : null,
            bookmaker: sgo.bookmaker,
            availableBookmakers: sgo.availableBookmakers,
            total: sgo.total,
            spread: sgo.spread,
            playerProps: sgo.playerProps,
            requestedBookmaker: bookmaker ?? null,
            resolvedBookmakerId: null,
            selectionMode: sgo.selectionMode,
            source: sgo.source,
            cacheLayer: sgo.cacheLayer,
          },
          { status: 200 },
        );
      }
      return emptyOdds("SGO cache miss (sync quotidienne requise)");
    }

    if (home && away && THE_ODDS_API_KEY) {
      const resolvedEvent = await resolveTheOddsEventId(home, away);
      if (resolvedEvent?.eventId) {
        let selectionMode: "requested" | "fallback" | "auto" = bookmaker
          ? "requested"
          : "auto";
        let eventOdds = await fetchTheOddsEventOdds(resolvedEvent.eventId, bookmaker);
        let selectedBook = pickTheOddsBookmaker(
          eventOdds?.bookmakers ?? [],
          bookmaker,
        );

        // If requested bookmaker has no market for this event, retry without lock.
        if (bookmaker && (!selectedBook || !hasTheOddsPlayerProps(selectedBook))) {
          const fallbackOdds = await fetchTheOddsEventOdds(resolvedEvent.eventId, null);
          if (fallbackOdds?.bookmakers?.length) {
            eventOdds = fallbackOdds;
            selectedBook = pickTheOddsBookmaker(fallbackOdds.bookmakers, null);
            selectionMode = "fallback";
          }
        }

        if (eventOdds && selectedBook) {
          const availableBookmakers = getTheOddsAvailableBookmakers(
            eventOdds.bookmakers ?? [],
          );
          const playerProps = extractPlayerPropsFromTheOddsBook(selectedBook);
          const total = extractTotalFromTheOddsBook(selectedBook);
          const spread = extractSpreadFromTheOddsBook(selectedBook, {
            home_team: resolvedEvent.home,
            away_team: resolvedEvent.away,
          });
          return NextResponse.json(
            {
              ok: true,
              game: game ? Number(game) : null,
              bookmaker: {
                id: null,
                name: selectedBook.title ?? selectedBook.key ?? null,
              },
              availableBookmakers,
              total,
              spread,
              playerProps,
              requestedBookmaker: bookmaker ?? null,
              resolvedBookmakerId: null,
              selectionMode,
              source: "the-odds-api",
              cacheLayer: "network",
            },
            { status: 200 },
          );
        }
      }
    }

    if (!game) {
      return emptyOdds("match_not_found_for_home_away");
    }
    if (!API_KEY) {
      return emptyOdds("apisports_key_missing");
    }

    const firstFetch = await fetchOddsEnvelope(
      game,
      bookmaker && isNumericId(bookmaker) ? bookmaker : null,
    );
    if (!firstFetch.ok) {
      return NextResponse.json(
        {
          error: "Upstream odds error",
          status: firstFetch.status,
          body: firstFetch.body,
        },
        { status: 502 },
      );
    }

    let workingPayload = firstFetch.payload;
    let workingBookmakers = firstFetch.bookmakers;
    let selectionMode: "auto" | "requested" | "resolved-id" | "fallback" =
      bookmaker ? "requested" : "auto";
    let resolvedBookmakerId: string | null = null;

    let selected = bookmaker
      ? pickBookmakerStrict(workingBookmakers, bookmaker)
      : pickBookmaker(workingBookmakers, bookmaker);

    // Name-based bookmaker selection can miss aliases upstream.
    // Resolve bookmaker id and refetch /odds scoped by that id.
    if (bookmaker && !selected && !isNumericId(bookmaker)) {
      resolvedBookmakerId = await resolveBookmakerIdByName(bookmaker);
      if (resolvedBookmakerId) {
        const byIdFetch = await fetchOddsEnvelope(game, resolvedBookmakerId);
        if (byIdFetch.ok) {
          if (byIdFetch.bookmakers.length > 0) {
            workingPayload = byIdFetch.payload;
            workingBookmakers = byIdFetch.bookmakers;
          }
          selected =
            pickBookmakerStrict(byIdFetch.bookmakers, resolvedBookmakerId) ??
            pickBookmakerStrict(byIdFetch.bookmakers, bookmaker);
          if (selected && byIdFetch.bookmakers.length > 0) {
            selectionMode = "resolved-id";
          }
        }
      }
    }

    // Keep odds visible if requested bookmaker has no active market.
    if (bookmaker && !selected) {
      selected = pickBookmaker(workingBookmakers, null);
      if (selected) selectionMode = "fallback";
    }

    const bets = selected?.bets ?? [];
    const total = extractTotal(bets);
    const spread = extractSpread(bets);
    const playerProps = bookmaker
      ? extractPlayerProps(selected ? [selected] : [])
      : extractPlayerProps(workingBookmakers);
    const availableBookmakers = getApiSportsAvailableBookmakers(workingBookmakers);

    return NextResponse.json(
      {
        ok: true,
        game: Number(game),
        bookmaker: selected
          ? { id: selected.id ?? null, name: selected.name ?? null }
          : null,
        availableBookmakers,
        total,
        spread,
        playerProps,
        requestedBookmaker: bookmaker ?? null,
        resolvedBookmakerId,
        selectionMode,
        errors: workingPayload.errors ?? null,
        results: workingPayload.results ?? null,
        source: "apisports",
        cacheLayer: "network",
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Unexpected error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
