import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  readNbaOddsDailyCache,
  writeNbaOddsDailyCache,
} from "@/lib/supabase/nba-odds-cache";

const SGO_API_KEY = process.env.SPORTSGAMEODDS_API_KEY;
const SGO_API_BASE =
  process.env.SPORTSGAMEODDS_API_URL || "https://api.sportsgameodds.com/v2";
const SGO_NBA_LEAGUE = "NBA";
const SGO_CACHE_DIR = path.join(process.cwd(), ".cache");

type SgoEvent = Record<string, unknown>;

function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function cacheFilePath(dateKey: string) {
  return path.join(SGO_CACHE_DIR, `nba-events-${dateKey}.json`);
}

async function fetchSgoEventsWindow(
  startsAfterIso: string,
  startsBeforeIso: string,
): Promise<SgoEvent[]> {
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
      headers: { "X-API-Key": SGO_API_KEY! },
      cache: "no-store",
    });
    if (!res.ok) break;
    const json = (await res.json().catch(() => null)) as
      | { data?: SgoEvent[]; nextCursor?: string | null }
      | null;
    const batch = Array.isArray(json?.data) ? json.data : [];
    events.push(...batch);
    cursor = json?.nextCursor ? String(json.nextCursor) : null;
    if (!cursor) break;
  }
  return events;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${cronSecret}`;
    if (auth !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!SGO_API_KEY) {
    return NextResponse.json(
      { error: "Missing SPORTSGAMEODDS_API_KEY" },
      { status: 500 },
    );
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const now = new Date();
  const dateKey = getUtcDateKey(now);
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
        source: supabaseCache.source ?? "sportsgameodds",
      });
    }

    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as { ts?: number; events?: SgoEvent[] };
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

  const startsAfter = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const startsBefore = new Date(now.getTime() + 60 * 60 * 60 * 1000).toISOString();
  const events = await fetchSgoEventsWindow(startsAfter, startsBefore);

  await fs.mkdir(SGO_CACHE_DIR, { recursive: true });
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
    source: "sportsgameodds",
  });

  return NextResponse.json({
    ok: true,
    cached: false,
    dateKey,
    events: events.length,
    startsAfter,
    startsBefore,
    storage: savedToSupabase ? "supabase+file" : "file",
  });
}
