// app/api/nfl/players/search/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PARTIAL_TTL_MS = 10 * 60 * 1000; // 10m si index incomplet
const MIN_PLAYER_COUNT = 400;

type TeamSummary = {
  id: number;
  name: string;
  code: string | null;
  logo: string | null;
};

type PlayerEntry = {
  id: number;
  name: string;
  position: string | null;
  number: number | string | null;
  image: string | null;
  team: TeamSummary;
};

type CacheEntry = {
  expiresAt: number;
  players: PlayerEntry[];
  partial: boolean;
};

const cache = new Map<string, CacheEntry>();

function normalizeQuery(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeQuery(value).split(" ").filter(Boolean);
}

function dedupePlayers(list: PlayerEntry[]) {
  const seen = new Set<number>();
  return list.filter((player) => {
    if (seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTeams(season: string, league: string): Promise<TeamSummary[]> {
  const url = new URL("/teams", API_BASE);
  url.searchParams.set("season", season);
  url.searchParams.set("league", league);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return [];

  return (json?.response ?? [])
    .map((team: any) => ({
      id: Number(team?.id ?? team?.team?.id),
      name: team?.name ?? team?.team?.name ?? "",
      code: team?.code ?? team?.team?.code ?? null,
      logo: team?.logo ?? team?.team?.logo ?? null,
    }))
    .filter((team: TeamSummary) => Number.isFinite(team.id) && team.name);
}

const ALLOWED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const EXCLUDED_GROUPS = new Set([
  "Practice Squad",
  "Injured Reserve",
  "Injured Reserve Or O",
  "Reserve",
  "Out",
]);

async function fetchPlayersForTeam(
  team: TeamSummary,
  season: string,
): Promise<{ players: PlayerEntry[]; ok: boolean; status: number }> {
  const url = new URL("/players", API_BASE);
  url.searchParams.set("team", String(team.id));
  url.searchParams.set("season", season);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { players: [], ok: false, status: res.status };

  const list = Array.isArray(json?.response) ? json.response : [];
  const filtered: PlayerEntry[] = [];
  for (const player of list) {
    const id = Number(player?.id);
    if (!Number.isFinite(id)) continue;
    const name = player?.name ?? "";
    if (!name) continue;
    const position = player?.position ?? null;
    const pos = String(position ?? "").toUpperCase();
    if (!ALLOWED_POSITIONS.has(pos)) continue;
    const group = player?.group ?? "";
    if (group && EXCLUDED_GROUPS.has(group)) continue;
    filtered.push({
      id,
      name,
      position,
      number: player?.number ?? null,
      image: player?.image ?? null,
      team,
    });
  }
  return { players: filtered, ok: true, status: res.status };
}

async function buildPlayersIndex(season: string, league: string) {
  const teams = await fetchTeams(season, league);
  if (!teams.length) return { players: [], failedTeams: teams.length };

  const players: PlayerEntry[] = [];
  let failedTeams = 0;

  for (const team of teams) {
    const first = await fetchPlayersForTeam(team, season).catch(() => ({
      players: [],
      ok: false,
      status: 0,
    }));
    let result = first;
    if (!result.ok) {
      const retryable = [429, 500, 502, 503, 504].includes(result.status);
      if (retryable) {
        await sleep(300);
        result = await fetchPlayersForTeam(team, season).catch(() => ({
          players: [],
          ok: false,
          status: 0,
        }));
      }
    }

    if (result.ok) {
      players.push(...result.players);
    } else {
      failedTeams += 1;
    }
    await sleep(120);
  }

  return { players: dedupePlayers(players), failedTeams };
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const query = params.get("q") ?? "";
  const season = params.get("season") ?? DEFAULT_SEASON;
  const league = params.get("league") ?? DEFAULT_LEAGUE;
  const limit = Number(params.get("limit") ?? 12);
  const refresh = params.get("refresh") === "1";

  const needle = normalizeQuery(query);
  const tokens = tokenize(query);
  if (needle.length < 2 || tokens.length === 0) {
    return NextResponse.json({ ok: true, query, players: [] });
  }

  const cacheKey = `${season}::${league}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  let players: PlayerEntry[] = [];

  const cacheUsable = cached && now < cached.expiresAt && cached.players.length > 0;
  if (!refresh && cacheUsable) {
    players = cached.players;
  } else {
    const built = await buildPlayersIndex(season, league);
    players = dedupePlayers(built.players);
    const partial =
      built.failedTeams > 0 || (players.length > 0 && players.length < MIN_PLAYER_COUNT);
    if (players.length > 0) {
      cache.set(cacheKey, {
        players,
        partial,
        expiresAt: now + (partial ? PARTIAL_TTL_MS : CACHE_TTL_MS),
      });
    }
  }

  let matches = players
    .map((player) => {
      const nameNorm = normalizeQuery(player.name);
      if (!tokens.every((token) => nameNorm.includes(token))) return null;
      const nameTokens = nameNorm.split(" ").filter(Boolean);
      let score = 3;
      if (nameNorm === needle) score = 0;
      else if (nameNorm.startsWith(needle)) score = 1;
      else if (nameTokens.some((token) => token.startsWith(needle))) score = 2;
      return { player, score, nameNorm };
    })
    .filter(
      (
        entry,
      ): entry is { player: PlayerEntry; score: number; nameNorm: string } =>
        Boolean(entry),
    )
    .sort((a, b) => {
      const diff = (a?.score ?? 0) - (b?.score ?? 0);
      if (diff !== 0) return diff;
      const lenDiff = (a?.nameNorm.length ?? 0) - (b?.nameNorm.length ?? 0);
      if (lenDiff !== 0) return lenDiff;
      return (a?.player.name ?? "").localeCompare(b?.player.name ?? "");
    })
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 12)
    .map((entry) => entry.player);

  if (
    matches.length === 0 &&
    cached?.partial &&
    !refresh &&
    players.length < MIN_PLAYER_COUNT
  ) {
    const rebuilt = await buildPlayersIndex(season, league);
    if (rebuilt.players.length > 0) {
      const partial =
        rebuilt.failedTeams > 0 ||
        (rebuilt.players.length > 0 && rebuilt.players.length < MIN_PLAYER_COUNT);
      cache.set(cacheKey, {
        players: rebuilt.players,
        partial,
        expiresAt: now + (partial ? PARTIAL_TTL_MS : CACHE_TTL_MS),
      });
      matches = dedupePlayers(rebuilt.players)
        .map((player) => {
          const nameNorm = normalizeQuery(player.name);
          if (!tokens.every((token) => nameNorm.includes(token))) return null;
          const nameTokens = nameNorm.split(" ").filter(Boolean);
          let score = 3;
          if (nameNorm === needle) score = 0;
          else if (nameNorm.startsWith(needle)) score = 1;
          else if (nameTokens.some((token) => token.startsWith(needle))) score = 2;
          return { player, score, nameNorm };
        })
        .filter(
          (
            entry,
          ): entry is { player: PlayerEntry; score: number; nameNorm: string } =>
            Boolean(entry),
        )
        .sort((a, b) => {
          const diff = a.score - b.score;
          if (diff !== 0) return diff;
          const lenDiff = a.nameNorm.length - b.nameNorm.length;
          if (lenDiff !== 0) return lenDiff;
          return a.player.name.localeCompare(b.player.name);
        })
        .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 12)
        .map((entry) => entry.player);
    }
  }

  return NextResponse.json({
    ok: true,
    query,
    season,
    league,
    count: matches.length,
    players: matches,
    cached: Boolean(cached && now < cached.expiresAt && !refresh),
  });
}
