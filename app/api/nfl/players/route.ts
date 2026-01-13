// app/api/nfl/players/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";
const DEFAULT_TEAM = process.env.APISPORTS_NFL_TEAM_ID ?? null;
// Cache conservé 24h, mais invalidé dès qu'on passe une fenêtre de flush (ci-dessous).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Fenêtres de flush après les slates NFL : 16h15 (après matchs 13h), 20h00 (après 16h),
// 00h00 (après le match de 20h). Heure locale du serveur.
const FLUSH_WINDOWS: Array<{ h: number; m: number }> = [
  { h: 16, m: 15 },
  { h: 20, m: 0 },
  { h: 0, m: 0 },
];

type CacheEntry = {
  expiresAt: number;
  flushAt: number;
  data: ApiPlayer[];
};

const cache = new Map<string, CacheEntry>();

function nextFlushTs(now: number) {
  const candidates: number[] = [];
  for (const w of FLUSH_WINDOWS) {
    const d = new Date(now);
    d.setHours(w.h, w.m, 0, 0);
    if (d.getTime() > now) {
      candidates.push(d.getTime());
    }
  }
  if (candidates.length === 0) {
    // demain, première fenêtre
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(FLUSH_WINDOWS[0].h, FLUSH_WINDOWS[0].m, 0, 0);
    candidates.push(d.getTime());
  }
  return Math.min(...candidates);
}

function cacheKey(season: string, team: string | number) {
  return `${season}::${team}`;
}

type ApiPlayer = {
  id?: number;
  name?: string;
  age?: number | null;
  height?: string | null;
  weight?: string | null;
  college?: string | null;
  group?: string | null;
  position?: string | null;
  number?: number | string | null;
  salary?: string | null;
  experience?: number | null;
  image?: string | null;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const season = searchParams.get("season") ?? DEFAULT_SEASON;
  const team = searchParams.get("team") ?? DEFAULT_TEAM;
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const positionsParam = searchParams.get("positions");

  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  if (!team) {
    return NextResponse.json(
      { error: "Missing team parameter (team=teamId)" },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const key = cacheKey(season, team);
    const flushAt = nextFlushTs(now);
    const cached = cache.get(key);
    if (cached && now < cached.expiresAt && now < cached.flushAt) {
      const filtered = search
        ? cached.data.filter((p) => (p.name ?? "").toLowerCase().includes(search))
        : cached.data;
      return NextResponse.json({
        ok: true,
        season,
        team,
        count: filtered.length,
        players: filtered,
        cached: true,
      });
    }

    const url = new URL("/players", API_BASE);
    url.searchParams.set("team", String(team));
    url.searchParams.set("season", String(season));

    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream players error", status: res.status, body: txt || json },
        { status: 502 },
      );
    }

    const players: ApiPlayer[] = Array.isArray(json?.response) ? json.response : [];
    const mapped = players
      .map((p) => ({
        id: p.id ?? null,
        name: p.name ?? null,
        position: p.position ?? null,
        number: p.number ?? null,
        age: p.age ?? null,
        height: p.height ?? null,
        weight: p.weight ?? null,
        college: p.college ?? null,
        group: p.group ?? null,
        experience: p.experience ?? null,
        image: p.image ?? null,
      }))
      .filter((p) => p.id !== null);

    // Filtrage pour les paris : ne garder que les postes utiles, exclure practice squad / IR
    const allowedPositions = positionsParam
      ? positionsParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : ["QB", "RB", "WR", "TE", "K"];
    const excludedGroups = new Set<string>([
      "Practice Squad",
      "Injured Reserve",
      "Injured Reserve Or O",
      "Reserve",
      "Out",
    ]);

    const filteredByPos = mapped.filter((p) => {
      const pos = (p.position ?? "").toUpperCase();
      if (!allowedPositions.includes(pos)) return false;
      const grp = p.group ?? "";
      if (grp && excludedGroups.has(grp)) return false;
      return true;
    });

    cache.set(key, {
      data: filteredByPos,
      expiresAt: now + CACHE_TTL_MS,
      flushAt,
    });

    const filtered = search
      ? filteredByPos.filter((p) => (p.name ?? "").toLowerCase().includes(search))
      : filteredByPos;

    return NextResponse.json({
      ok: true,
      season,
      team,
      count: filtered.length,
      players: filtered,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
