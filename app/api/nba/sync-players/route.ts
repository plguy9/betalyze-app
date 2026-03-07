// app/api/nba/sync-players/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  normalizeNbaSeasonLabel,
  upsertNbaPlayersForSeason,
  type NbaPlayerRecord,
} from "@/lib/nba/players-db";

const API_BASE = process.env.APISPORTS_BASKETBALL_URL;
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON = process.env.APISPORTS_BASKETBALL_SEASON ?? "2025-2026";
const SEASON = normalizeNbaSeasonLabel(RAW_SEASON);

// Même IDs que dans /api/nba/teams
const NBA_TEAM_IDS: number[] = [
  132, 133, 134, 135, 136, 137, 140, 143, 147, 148, 151, 153, 154, 159, 161, // East
  138, 139, 141, 142, 144, 145, 146, 149, 150, 152, 155, 156, 157, 158, 160, // West
];

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(
  CACHE_DIR,
  `nba-players-${SEASON.replace(/[^0-9]/g, "")}.json`
);

export async function GET() {
  try {
    if (!API_BASE || !API_KEY) {
      return NextResponse.json(
        { error: "Missing API config" },
        { status: 500 }
      );
    }

    const allPlayers: any[] = [];

    for (const teamId of NBA_TEAM_IDS) {
      const url = new URL("/players", API_BASE);
      url.searchParams.set("team", String(teamId));
      url.searchParams.set("season", SEASON);

      const res = await fetch(url.toString(), {
        headers: {
          "x-apisports-key": API_KEY!,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("API-Sports error for team", teamId, txt);
        continue;
      }

      const data = await res.json();
      const players = data.response ?? [];
      allPlayers.push(
        ...players.map((p: any) => ({ ...p, teamId }))
      );
    }

    // Mapping minimal vers NbaPlayer (on enrichira plus tard)
    const mapped: NbaPlayerRecord[] = allPlayers.map((p: any) => {
      const rawName = p.name ?? "";
      const parts = typeof rawName === "string" ? rawName.split(/\s+/).filter(Boolean) : [];
      const firstName = parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null;
      const lastName = parts.length >= 2 ? parts.slice(0, -1).join(" ") : null;
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || rawName;
      return {
        id: p.id,
        fullName,
        firstName,
        lastName,
        teamId: p.teamId ?? null,
        teamName: null,
        teamCode: null,
        position: p.position ?? null,
        jerseyNumber: p.number ? String(p.number) : null,
        age: null,
        height: null,
        weight: null,
        nationality: p.country ?? null,
        birthDate: null,
        isActive: true,
      };
    });

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      CACHE_FILE,
      JSON.stringify(
        {
          season: SEASON,
          updatedAt: new Date().toISOString(),
          count: mapped.length,
          players: mapped,
        },
        null,
        2
      ),
      "utf-8"
    );

    const dbUpserted = await upsertNbaPlayersForSeason({
      season: SEASON,
      source: "sync-players",
      players: mapped,
    }).catch(() => 0);

    return NextResponse.json(
      {
        season: SEASON,
        count: mapped.length,
        cacheFile: CACHE_FILE,
        dbUpserted,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/nba/sync-players:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
