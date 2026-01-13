// app/api/nfl/games/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE = process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = "2025";

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const season = params.get("season") ?? DEFAULT_SEASON;
  const league = params.get("league") ?? DEFAULT_LEAGUE;
  const week = params.get("week");
  const team = params.get("team");
  const status = params.get("status");

  try {
    const url = new URL("/games", API_BASE);
    url.searchParams.set("league", league);
    url.searchParams.set("season", season);
    if (week) url.searchParams.set("week", week);
    if (team) url.searchParams.set("team", team);
    if (status) url.searchParams.set("status", status);

    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream error", status: res.status, body: txt },
        { status: 502 },
      );
    }

    const json = await res.json();
    return NextResponse.json({
      ok: true,
      season,
      league,
      response: json?.response ?? [],
      errors: json?.errors ?? null,
      results: json?.results ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
