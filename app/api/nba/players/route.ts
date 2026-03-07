// app/api/nba/players/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  normalizeNbaSeasonLabel,
  readNbaPlayerByIdFromDb,
  readNbaPlayersFromDb,
  upsertNbaPlayersForSeason,
  type NbaPlayerRecord,
} from "@/lib/nba/players-db";

type NbaPlayer = NbaPlayerRecord;

const API_BASE =
  process.env.APISPORTS_BASKETBALL_URL ||
  process.env.APISPORTS_NBA_URL ||
  "https://v1.basketball.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const RAW_SEASON =
  process.env.APISPORTS_BASKETBALL_SEASON ||
  process.env.APISPORTS_NBA_SEASON ||
  "2025-2026";
const IS_BASKETBALL_V1 = API_BASE.includes("basketball");
// l'API v2 attend un entier (ex: 2025 pour 2025-2026)
const SEASON_INT =
  RAW_SEASON.match(/(\d{4})/)?.[1] ?? RAW_SEASON.replace(/[^0-9]/g, "");
const SEASON_LABEL = IS_BASKETBALL_V1 ? RAW_SEASON : SEASON_INT;
const SEASON_CANONICAL = normalizeNbaSeasonLabel(RAW_SEASON);
const SEASON_KEY = RAW_SEASON.replace(/[^0-9]/g, "");
const CACHE_FILE_V1 = path.join(
  process.cwd(),
  "data",
  `nba-players-${SEASON_KEY}.json`,
);
const CACHE_FILE_V2 = path.join(
  process.cwd(),
  "data",
  `nba-players-nba-v2-${SEASON_INT}.json`,
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

function dedupePlayers(players: NbaPlayer[]): NbaPlayer[] {
  const seen = new Set<number>();
  const unique: NbaPlayer[] = [];
  for (const p of players) {
    const id = typeof p.id === "number" ? p.id : Number(p.id);
    if (!Number.isFinite(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push({ ...p, id });
  }
  return unique;
}

async function loadCachePlayers(): Promise<{
  data: CacheFileShape;
  players: NbaPlayer[];
} | null> {
  let raw: string | null = null;
  const candidateFiles = IS_BASKETBALL_V1
    ? [CACHE_FILE_V1, FALLBACK_CACHE_FILE, CACHE_FILE_V2]
    : [CACHE_FILE_V2, FALLBACK_CACHE_FILE, CACHE_FILE_V1];
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
  if (!readOk || !raw) return null;
  const data = JSON.parse(raw) as CacheFileShape;
  const players = dedupePlayers(data.players);
  return { data, players };
}

async function loadDbPlayers(): Promise<NbaPlayer[]> {
  return readNbaPlayersFromDb(SEASON_CANONICAL);
}

async function fetchFromNbaApi(
  params: Record<string, string>,
): Promise<NbaPlayer[] | null> {
  if (!API_BASE || !API_KEY) return null;
  const url = new URL("/players", API_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  if (!Array.isArray(data?.response)) return null;
  const mapped = data.response.map((p: any) => {
    if (IS_BASKETBALL_V1) {
      const rawName = p.name ?? "";
      const parts =
        typeof rawName === "string" ? rawName.split(/\s+/).filter(Boolean) : [];
      const firstName = parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null;
      const lastName =
        parts.length >= 2 ? parts.slice(0, -1).join(" ") : null;
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || rawName;
      return {
        id: p.id,
        firstName,
        lastName,
        fullName,
        teamId: null,
        teamName: null,
        teamCode: null,
        position: p.position ?? null,
        jerseyNumber: p.number ? String(p.number) : null,
        age: typeof p.age === "number" ? p.age : null,
        nationality: p.country ?? null,
        height: null,
        weight: null,
        birthDate: null,
        isActive: null,
      };
    }
    return {
      id: p.id,
      firstName: p.firstname ?? null,
      lastName: p.lastname ?? null,
      fullName: [p.firstname, p.lastname].filter(Boolean).join(" ") || `Player ${p.id}`,
      teamId: null,
      teamName: null,
      teamCode: null,
      position: p.leagues?.standard?.pos ?? null,
      jerseyNumber: p.leagues?.standard?.jersey
        ? String(p.leagues.standard.jersey)
        : null,
      age: null,
      nationality: p.birth?.country ?? null,
      height: p.height?.meters ?? null,
      weight: p.weight?.kilograms ?? null,
      birthDate: p.birth?.date ?? null,
      isActive: p.leagues?.standard?.active ?? null,
    };
  });
  return dedupePlayers(mapped);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const idParam = searchParams.get("id");
    const forceRefresh = searchParams.get("refresh") === "1";
    const dbPlayers = await loadDbPlayers().catch(() => []);
    const cache = dbPlayers.length ? null : await loadCachePlayers();
    const cachedPlayers = dbPlayers.length ? dbPlayers : cache?.players ?? [];
    const seasonUsed = dbPlayers.length
      ? SEASON_CANONICAL
      : (cache?.data.season ?? SEASON_LABEL);
    const updatedAtUsed = dbPlayers.length
      ? new Date().toISOString()
      : (cache?.data.updatedAt ?? new Date().toISOString());
    const cacheById = new Map<number, NbaPlayer>();
    cachedPlayers.forEach((p) => {
      const id = Number(p.id);
      if (Number.isFinite(id)) cacheById.set(id, p);
    });

    // 🔹 Cas 1 : recherche texte -> API si dispo
    if (search && search.length >= 2) {
      const localResults = filterPlayersBySearch(cachedPlayers, search);
      if (localResults.length > 0 && !forceRefresh) {
        return NextResponse.json(
          {
            season: seasonUsed,
            updatedAt: updatedAtUsed,
            count: localResults.length,
            players: localResults,
          },
          { status: 200 },
        );
      }

      const apiPlayers = await fetchFromNbaApi({ search });
      if (apiPlayers && apiPlayers.length > 0) {
        if (cacheById.size > 0) {
          const merged = apiPlayers.map((p) => {
            const local = cacheById.get(Number(p.id));
            if (!local) return p;
            return {
              ...local,
              ...p,
              teamId: local.teamId ?? p.teamId ?? null,
              teamName: local.teamName ?? p.teamName ?? null,
              teamCode: local.teamCode ?? p.teamCode ?? null,
              position: p.position ?? local.position ?? null,
              jerseyNumber: p.jerseyNumber ?? local.jerseyNumber ?? null,
              nationality: p.nationality ?? local.nationality ?? null,
              age: p.age ?? local.age ?? null,
              height: p.height ?? local.height ?? null,
              weight: p.weight ?? local.weight ?? null,
            };
          });
          const filtered = merged.filter((p) => cacheById.has(Number(p.id)));
          const finalList = filtered.length > 0 ? filtered : merged;
          void upsertNbaPlayersForSeason({
            season: RAW_SEASON,
            source: "players-search",
            players: finalList,
          }).catch(() => {});
          return NextResponse.json(
            {
              season: seasonUsed,
              updatedAt: new Date().toISOString(),
              count: finalList.length,
              players: finalList,
            },
            { status: 200 },
          );
        }
        return NextResponse.json(
          {
            season: seasonUsed,
            updatedAt: new Date().toISOString(),
            count: apiPlayers.length,
            players: apiPlayers,
          },
          { status: 200 },
        );
      }
      // sinon on continue sur le cache local
    }

    if (!cachedPlayers.length) {
      return NextResponse.json(
        {
          error:
            "Players not found. Run /api/nba/sync-players-v2 to populate Supabase.",
        },
        { status: 500 }
      );
    }

    const allPlayers = cachedPlayers;

    // 🔹 Cas 2 : joueur précis par ID -> API v2 d'abord, sinon cache local
    if (idParam) {
      const idNum = Number(idParam);
      const playerFromDb =
        Number.isFinite(idNum) && idNum > 0
          ? await readNbaPlayerByIdFromDb(RAW_SEASON, idNum).catch(() => null)
          : null;
      if (playerFromDb && !forceRefresh) {
        const payload = {
          season: seasonUsed,
          updatedAt: updatedAtUsed,
          count: 1,
          players: [playerFromDb],
          player: playerFromDb,
        };
        return NextResponse.json(payload, { status: 200 });
      }
      const apiPlayers = await fetchFromNbaApi({
        id: String(idParam),
      });
      const playerFromApi = apiPlayers?.[0] ?? null;

      const playerLocal =
        playerFromDb ?? allPlayers.find((p) => Number(p.id) === idNum) ?? null;
      const mergedPlayer =
        playerFromApi && playerLocal
          ? {
              ...playerLocal,
              ...playerFromApi,
              teamId: playerFromApi.teamId ?? playerLocal.teamId ?? null,
              teamName: playerFromApi.teamName ?? playerLocal.teamName ?? null,
              teamCode: playerFromApi.teamCode ?? playerLocal.teamCode ?? null,
              position: playerFromApi.position ?? playerLocal.position ?? null,
              jerseyNumber:
                playerFromApi.jerseyNumber ?? playerLocal.jerseyNumber ?? null,
              nationality:
                playerFromApi.nationality ?? playerLocal.nationality ?? null,
              age: playerFromApi.age ?? playerLocal.age ?? null,
              height: playerFromApi.height ?? playerLocal.height ?? null,
              weight: playerFromApi.weight ?? playerLocal.weight ?? null,
            }
          : playerFromApi ?? playerLocal ?? null;
      const player = mergedPlayer;
      if (player) {
        void upsertNbaPlayersForSeason({
          season: RAW_SEASON,
          source: "players-id",
          players: [player],
        }).catch(() => {});
      }
      const payload = {
        season: seasonUsed,
        updatedAt: updatedAtUsed,
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
      players = filterPlayersBySearch(players, search);
    }

    return NextResponse.json(
      {
        season: seasonUsed,
        updatedAt: updatedAtUsed,
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
