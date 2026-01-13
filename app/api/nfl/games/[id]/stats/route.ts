// app/api/nfl/games/[id]/stats/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE = process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } },
) {
  const rawIdParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "games");
  const rawIdPath = idx >= 0 ? segments[idx + 1] : null;
  const rawId = rawIdParam ?? rawIdPath;
  const gameId = Number(rawId);

  if (!Number.isFinite(gameId)) {
    return NextResponse.json({ error: "Missing or invalid game id" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    const url = new URL("/games/statistics", API_BASE);
    url.searchParams.set("id", String(gameId));
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
      gameId,
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
