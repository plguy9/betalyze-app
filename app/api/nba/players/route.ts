// app/api/nba/players/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { NbaPlayer } from "@/lib/models/nba";

const API_BASE =
  process.env.APISPORTS_NBA_URL ||
  process.env.APISPORTS_BASKETBALL_URL ||
  "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON =
  process.env.APISPORTS_NBA_SEASON ||
  process.env.APISPORTS_BASKETBALL_SEASON ||
  "2025-2026";
// l'API v2 attend un entier (ex: 2025 pour 2025-2026)
const SEASON_INT =
  RAW_SEASON.match(/(\d{4})/)?.[1] ?? RAW_SEASON.replace(/[^0-9]/g, "");
const CACHE_FILE = path.join(
  process.cwd(),
  "data",
  `nba-players-nba-v2-${SEASON_INT}.json`
);
const FALLBACK_CACHE_FILE = path.join(
  process.cwd(),
  "data",
  "nba-players-20242025.json"
);

type CacheFileShape = {
  season: string;
  updatedAt: string;
  count: number;
  players: NbaPlayer[];
};

async function fetchFromNbaApi(
  params: Record<string, string>,
): Promise<NbaPlayer[] | null> {
  if (!API_BASE || !API_KEY) return null;
  const url = new URL("/players", API_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  if (!Array.isArray(data?.response)) return null;
  return data.response.map((p: any) => ({
    id: p.id,
    firstName: p.firstname ?? null,
    lastName: p.lastname ?? null,
    fullName: [p.firstname, p.lastname].filter(Boolean).join(" "),
    teamId: null,
    teamName: null,
    position: p.leagues?.standard?.pos ?? null,
    jerseyNumber: p.leagues?.standard?.jersey
      ? String(p.leagues.standard.jersey)
      : null,
    nationality: p.birth?.country ?? null,
    height: p.height?.meters ?? null,
    weight: p.weight?.kilograms ?? null,
    birthDate: p.birth?.date ?? null,
    isActive: p.leagues?.standard?.active ?? null,
  }));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const idParam = searchParams.get("id");

    // 🔹 Cas 1 : recherche texte -> API NBA v2 si dispo
    if (search && search.length >= 2) {
      const apiPlayers = await fetchFromNbaApi({
        search,
      });
      if (apiPlayers && apiPlayers.length > 0) {
        return NextResponse.json(
          {
            season: SEASON_INT,
            updatedAt: new Date().toISOString(),
            count: apiPlayers.length,
            players: apiPlayers,
          },
          { status: 200 },
        );
      }
      // sinon on continue sur le cache local
    }

    let raw: string;
    const candidateFiles = [CACHE_FILE, FALLBACK_CACHE_FILE];
    let readOk = false;
    for (const file of candidateFiles) {
      try {
        raw = await fs.readFile(file, "utf-8");
        readOk = true;
        break;
      } catch {
        // continue
      }
    }
    if (!readOk) {
      return NextResponse.json(
        {
          error:
            "Players cache not found. Run /api/nba/sync-players to generate it.",
        },
        { status: 500 }
      );
    }

    const data = JSON.parse(raw) as CacheFileShape;
    const allPlayers = data.players;

    // 🔹 Cas 2 : joueur précis par ID -> API v2 d'abord, sinon cache local
    if (idParam) {
      const apiPlayers = await fetchFromNbaApi({
        id: String(idParam),
      });
      const playerFromApi = apiPlayers?.[0] ?? null;

      const idNum = Number(idParam);
      const playerLocal = allPlayers.find((p) => p.id === idNum) ?? null;
      const player = playerFromApi ?? playerLocal ?? null;
      const payload = {
        season: data.season,
        updatedAt: data.updatedAt,
        count: player ? 1 : 0,
        players: player ? [player] : [],
        player,
      };
      return NextResponse.json(
        payload,
        { status: player ? 200 : 404 }
      );
    }

    // 🔹 Cas 3 : recherche texte (cache local) si API KO ou sans search
    let players = allPlayers;
    if (search) {
      const q = search.toLowerCase();
      players = players.filter((p) => {
        const full = (p.fullName ?? "").toLowerCase();
        const first = (p.firstName ?? "").toLowerCase();
        const last = (p.lastName ?? "").toLowerCase();
        const reversed = [last, first].filter(Boolean).join(" ").toLowerCase();
        return (
          full.includes(q) ||
          `${first} ${last}`.trim().toLowerCase().includes(q) ||
          reversed.includes(q)
        );
      });
    }

    return NextResponse.json(
      {
        season: data.season,
        updatedAt: data.updatedAt,
        count: players.length,
        players,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/nba/players:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
