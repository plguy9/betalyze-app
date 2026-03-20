import { NextResponse } from "next/server";
import {
  normalizeNbaSeasonLabel,
  readNbaPlayerByIdFromDb,
  readNbaPlayersFromDb,
  type NbaPlayerRecord,
} from "@/lib/nba/players-db";

type NbaPlayer = NbaPlayerRecord;

const RAW_SEASON = process.env.APISPORTS_NBA_SEASON || "2025";
const SEASON_CANONICAL = normalizeNbaSeasonLabel(RAW_SEASON);

function filterPlayersBySearch(players: NbaPlayer[], search: string): NbaPlayer[] {
  if (!search) return players;
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const q = normalize(search);
  if (!q) return players;
  return players.filter((p) => {
    const fullRaw = p.fullName ?? "";
    let firstRaw = p.firstName ?? "";
    let lastRaw = p.lastName ?? "";
    if ((!firstRaw || !lastRaw) && fullRaw) {
      const parts = fullRaw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const derivedFirst = parts[parts.length - 1];
        const derivedLast = parts.slice(0, -1).join(" ");
        if (!firstRaw) firstRaw = derivedFirst;
        if (!lastRaw) lastRaw = derivedLast;
      }
    }
    const full = normalize(fullRaw);
    const first = normalize(firstRaw);
    const last = normalize(lastRaw);
    const normalOrder = normalize(`${first} ${last}`);
    const reversed = normalize([last, first].filter(Boolean).join(" "));
    return full.includes(q) || normalOrder.includes(q) || reversed.includes(q);
  });
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function profileQualityScore(player: NbaPlayer): number {
  let score = 0;
  if (player.teamCode) score += 5;
  if (player.teamName) score += 2;
  const teamId = Number(player.teamId ?? NaN);
  if (Number.isFinite(teamId)) {
    if (teamId > 0) score += 4;
    if (teamId === 0) score -= 3;
  }
  if (player.birthDate) score += 2;
  if (player.position && player.position.length <= 3) score += 1;
  if (player.jerseyNumber) score += 1;
  if (player.nationality) score += 1;
  if (player.age && player.age > 0) score += 1;
  if (player.isActive === true) score += 1;
  return score;
}

function dedupeByProfile(players: NbaPlayer[]): NbaPlayer[] {
  const bestByKey = new Map<string, { player: NbaPlayer; score: number }>();
  for (const player of players) {
    const id = Number(player.id ?? NaN);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name = normalizeToken(
      player.fullName || [player.firstName, player.lastName].filter(Boolean).join(" "),
    );
    const key = name || `id:${id}`;
    const score = profileQualityScore(player);
    const previous = bestByKey.get(key);
    if (!previous || score > previous.score) {
      bestByKey.set(key, { player: { ...player, id }, score });
    }
  }
  return Array.from(bestByKey.values()).map((entry) => entry.player);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const idParam = searchParams.get("id");

    const dbPlayers = await readNbaPlayersFromDb(SEASON_CANONICAL).catch(() => []);
    if (!dbPlayers.length) {
      return NextResponse.json(
        {
          error: "Players not found. Run /api/nba/sync-players-v2 to populate Supabase.",
        },
        { status: 500 },
      );
    }

    const seasonUsed = SEASON_CANONICAL;
    const updatedAtUsed = new Date().toISOString();

    if (idParam) {
      const idNum = Number(idParam);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
      }

      const player =
        (await readNbaPlayerByIdFromDb(SEASON_CANONICAL, idNum).catch(() => null)) ??
        dbPlayers.find((p) => Number(p.id) === idNum) ??
        null;

      const payload = {
        season: seasonUsed,
        updatedAt: updatedAtUsed,
        count: player ? 1 : 0,
        players: player ? [player] : [],
        player,
      };
      return NextResponse.json(payload, { status: player ? 200 : 404 });
    }

    let players = dbPlayers;
    if (search) {
      players = filterPlayersBySearch(players, search);
      players = dedupeByProfile(players);
    }

    return NextResponse.json(
      {
        season: seasonUsed,
        updatedAt: updatedAtUsed,
        count: players.length,
        players,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Error in /api/nba/players:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
