import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.APISPORTS_BASKETBALL_URL;
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON = process.env.APISPORTS_BASKETBALL_SEASON ?? "2025-2026";
const CACHE_TTL_MS = 30 * 60 * 1000;

type NbaStandingConference = "East" | "West" | "N/A";

type NbaStandingRow = {
  teamId: number;
  name: string;
  logo: string | null;
  conference: NbaStandingConference;
  position: number | null;
  overallRank: number;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  form: string | null;
  description: string | null;
};

type NbaStandingsPayload = {
  season: string;
  count: number;
  updatedAt: string;
  standings: NbaStandingRow[];
};

type ApiStandingItem = {
  position?: number | string | null;
  stage?: string | null;
  group?: { name?: string | null } | null;
  team?: { id?: number | string | null; name?: string | null; logo?: string | null } | null;
  games?: {
    played?: number | string | null;
    win?: { total?: number | string | null; percentage?: number | string | null } | null;
    lose?: { total?: number | string | null; percentage?: number | string | null } | null;
  } | null;
  points?: { for?: number | string | null; against?: number | string | null } | null;
  form?: string | null;
  description?: string | null;
};

const memoryCache = new Map<string, { ts: number; payload: NbaStandingsPayload }>();

function normalizeSeason(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return value;
  return `${year}-${year + 1}`;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toConference(groupName: string | null | undefined): NbaStandingConference {
  const normalized = String(groupName ?? "").toLowerCase();
  if (normalized.includes("eastern")) return "East";
  if (normalized.includes("western")) return "West";
  return "N/A";
}

function parseRows(json: unknown): ApiStandingItem[] {
  const payload = json as { response?: unknown };
  const groups = Array.isArray(payload?.response) ? payload.response : [];
  const flattened = groups.flatMap((entry: unknown) =>
    Array.isArray(entry) ? entry : [entry],
  );
  return flattened.filter(Boolean) as ApiStandingItem[];
}

export async function GET(req: NextRequest) {
  const seasonParam = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const season = normalizeSeason(seasonParam);
  const cacheKey = `season:${season}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, { status: 200 });
  }

  if (!API_BASE || !API_KEY) {
    return NextResponse.json({ error: "Missing API config" }, { status: 500 });
  }

  try {
    const url = new URL("/standings", API_BASE);
    url.searchParams.set("league", "12");
    url.searchParams.set("season", season);
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream standings error", status: res.status, body },
        { status: 502 },
      );
    }

    const json = await res.json();
    const rawRows = parseRows(json);

    const regularRows = rawRows.filter((row) =>
      String(row.stage ?? "").toLowerCase().includes("regular"),
    );
    const baseRows = regularRows.length ? regularRows : rawRows;
    const conferenceRows = baseRows.filter((row) =>
      String(row.group?.name ?? "").toLowerCase().includes("conference"),
    );
    const candidateRows = conferenceRows.length ? conferenceRows : baseRows;

    const byTeam = new Map<number, ApiStandingItem>();
    const rowScore = (row: ApiStandingItem) => {
      const group = String(row.group?.name ?? "").toLowerCase();
      const stage = String(row.stage ?? "").toLowerCase();
      const isConference = group.includes("conference") ? 2 : 0;
      const isRegular = stage.includes("regular") ? 1 : 0;
      return isConference + isRegular;
    };

    for (const row of candidateRows) {
      const teamId = toNumber(row.team?.id, NaN);
      if (!Number.isFinite(teamId)) continue;
      const prev = byTeam.get(teamId);
      if (!prev || rowScore(row) >= rowScore(prev)) {
        byTeam.set(teamId, row);
      }
    }

    const conferenceOrder: Record<NbaStandingConference, number> = {
      East: 0,
      West: 1,
      "N/A": 2,
    };

    const rows = Array.from(byTeam.values())
      .map((row) => {
        const wins = toNumber(row.games?.win?.total);
        const losses = toNumber(row.games?.lose?.total);
        const games = toNumber(row.games?.played, wins + losses);
        const winPctRaw = toNumber(row.games?.win?.percentage, NaN);
        const winPct =
          Number.isFinite(winPctRaw) && winPctRaw > 0
            ? winPctRaw
            : games > 0
              ? wins / games
              : 0;
        const pointsFor = toNumber(row.points?.for);
        const pointsAgainst = toNumber(row.points?.against);
        const conference = toConference(row.group?.name ?? null);
        return {
          teamId: toNumber(row.team?.id),
          name: String(row.team?.name ?? "Team"),
          logo: row.team?.logo ?? null,
          conference,
          position: Number.isFinite(toNumber(row.position, NaN))
            ? toNumber(row.position)
            : null,
          overallRank: 0,
          wins,
          losses,
          games,
          winPct,
          pointsFor,
          pointsAgainst,
          pointDiff: pointsFor - pointsAgainst,
          form: row.form ?? null,
          description: row.description ?? null,
        } as NbaStandingRow;
      })
      .sort((a, b) => {
        const confDiff = conferenceOrder[a.conference] - conferenceOrder[b.conference];
        if (confDiff !== 0) return confDiff;
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        if (a.winPct !== b.winPct) return b.winPct - a.winPct;
        return a.name.localeCompare(b.name);
      })
      .map((row, index) => ({ ...row, overallRank: index + 1 }));

    const payload: NbaStandingsPayload = {
      season,
      count: rows.length,
      updatedAt: new Date().toISOString(),
      standings: rows,
    };

    memoryCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Unexpected error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
