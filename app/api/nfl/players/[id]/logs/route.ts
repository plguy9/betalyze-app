// app/api/nfl/players/[id]/logs/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";

type CacheEntry = {
  data: any;
  expiresAt: number;
  flushAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FLUSH_WINDOWS: Array<{ h: number; m: number }> = [
  { h: 16, m: 15 },
  { h: 20, m: 0 },
  { h: 0, m: 0 },
];
const cache = new Map<string, CacheEntry>();

function nextFlushTs(now: number) {
  const candidates: number[] = [];
  for (const w of FLUSH_WINDOWS) {
    const d = new Date(now);
    d.setHours(w.h, w.m, 0, 0);
    if (d.getTime() > now) candidates.push(d.getTime());
  }
  if (candidates.length === 0) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(FLUSH_WINDOWS[0].h, FLUSH_WINDOWS[0].m, 0, 0);
    candidates.push(d.getTime());
  }
  return Math.min(...candidates);
}

function cacheKey(playerId: number, season: string, teamId: number) {
  return `${playerId}::${season}::${teamId}`;
}

function toNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type GroupStats = Record<string, Record<string, any>>;

function normalizeGameDate(game: any): string {
  const raw = game?.date ?? game?.game?.date;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    if (raw.date) return String(raw.date);
    if (raw.start) return String(raw.start);
    if (raw.timestamp) {
      const ts = Number(raw.timestamp);
      if (Number.isFinite(ts)) return new Date(ts * 1000).toISOString();
    }
  }
  return String(raw);
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function collectPlayerGroupStats(statsResp: any[], playerId: number) {
  const groups: GroupStats = {};
  let teamId: number | null = null;

  for (const teamBlock of statsResp ?? []) {
    const groupList = teamBlock?.groups ?? [];
    const blockTeamId = teamBlock?.team?.id;
    for (const group of groupList) {
      const players = group?.players ?? [];
      const playerEntry = players.find(
        (p: any) => Number(p?.player?.id ?? p?.id) === playerId,
      );
      if (!playerEntry) continue;
      if (teamId === null && blockTeamId != null) {
        teamId = Number(blockTeamId) || null;
      }
      const groupKey = normalizeLabel(group?.name ?? "");
      if (!groupKey) continue;
      const bucket = groups[groupKey] ?? {};
      const stats = playerEntry?.statistics ?? [];
      for (const stat of stats) {
        const label = normalizeLabel(stat?.name ?? stat?.label ?? "");
        if (!label) continue;
        bucket[label] = stat?.value ?? stat?.stat ?? null;
      }
      groups[groupKey] = bucket;
    }
  }

  return { groups, teamId };
}

function findStat(groups: GroupStats, group: string, keys: string[]) {
  const g = groups[normalizeLabel(group)];
  if (!g) return null;
  for (const key of keys) {
    const label = normalizeLabel(key);
    if (label in g) return g[label];
  }
  return null;
}

function parseSlashPair(value: any): [number | null, number | null] {
  if (typeof value !== "string" || !value.includes("/")) return [null, null];
  const [left, right] = value.split("/");
  return [toNumber(left), toNumber(right)];
}

async function resolveTeamId(playerId: number, season: string, league: string) {
  const tryUrls: URL[] = [];
  // Essais /players avec id et player, avec/sans league
  for (const param of ["id", "player"]) {
    const u1 = new URL("/players", API_BASE);
    u1.searchParams.set(param, String(playerId));
    u1.searchParams.set("season", String(season));
    const u2 = new URL(u1.toString());
    u1.searchParams.set("league", String(league));
    tryUrls.push(u1, u2);
  }
  // Essais /players/statistics avec id/player, avec/sans league
  for (const param of ["id", "player"]) {
    const u1 = new URL("/players/statistics", API_BASE);
    u1.searchParams.set(param, String(playerId));
    u1.searchParams.set("season", String(season));
    const u2 = new URL(u1.toString());
    u1.searchParams.set("league", String(league));
    tryUrls.push(u1, u2);
  }

  for (const url of tryUrls) {
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY! },
      cache: "no-store",
    }).catch(() => null as any);
    if (!res?.ok) continue;
    const json = await res.json().catch(() => null);
    const first = Array.isArray(json?.response) ? json.response[0] : null;
    const teamId =
      first?.team?.id ??
      first?.teams?.[0]?.team?.id ??
      first?.statistics?.[0]?.team?.id ??
      null;
    if (teamId) return Number(teamId) || null;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params?: { id?: string | string[] } | Promise<{ id?: string | string[] }> },
) {
  const resolvedParams = await params;
  const rawIdParam = Array.isArray(resolvedParams?.id)
    ? resolvedParams?.id[0]
    : resolvedParams?.id;
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "players");
  const rawIdPath = idx >= 0 ? segments[idx + 1] : null;
  const rawId = rawIdParam ?? rawIdPath;
  const playerId = Number(rawId);

  const search = req.nextUrl.searchParams;
  const season = search.get("season") ?? DEFAULT_SEASON;
  const league = search.get("league") ?? DEFAULT_LEAGUE;
  let teamIdParam = search.get("team");
  const limitParam = search.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(18, Number(limitParam))) : null;
  const refresh = search.get("refresh") === "1";

  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "Missing or invalid player id" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }
  // Si team absent, on tente de le déduire via /players/statistics. Si toujours rien, fallback Bills=20.
  if (!teamIdParam) {
    const inferred = await resolveTeamId(playerId, season, league);
    teamIdParam = String(inferred ?? 20); // fallback Bills=20
  }

  const teamId = Number(teamIdParam);
  const now = Date.now();
  const key = cacheKey(playerId, season, teamId);
  const flushAt = nextFlushTs(now);
  const cached = cache.get(key);
  if (!refresh && cached && now < cached.expiresAt && now < cached.flushAt) {
    return NextResponse.json({ ok: true, season, playerId, logs: cached.data, cached: true });
  }
  // Forcer un refresh supprime l'entrée de cache précédente
  if (refresh) {
    cache.delete(key);
  }

  try {
    // 1) Liste des matchs de l'équipe
    const gamesUrl = new URL("/games", API_BASE);
    gamesUrl.searchParams.set("league", league);
    gamesUrl.searchParams.set("season", season);
    gamesUrl.searchParams.set("team", String(teamId));
    const gamesRes = await fetch(gamesUrl.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    if (!gamesRes.ok) {
      const txt = await gamesRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream games error", status: gamesRes.status, body: txt },
        { status: 502 },
      );
    }
    const gamesJson = await gamesRes.json();
    const games = Array.isArray(gamesJson?.response) ? gamesJson.response : [];

    const regularSeasonGames = games.filter((g) => {
      const stageRaw = g?.game?.stage ?? g?.stage ?? "";
      const stage = String(stageRaw).toLowerCase();
      if (stage && stage !== "regular season") return false;
      const homeScore = g?.scores?.home?.total ?? g?.game?.scores?.home?.total;
      const awayScore = g?.scores?.away?.total ?? g?.game?.scores?.away?.total;
      return homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;
    });

    // Trie par date
    regularSeasonGames.sort((a, b) => {
      const da = new Date(normalizeGameDate(a)).getTime();
      const db = new Date(normalizeGameDate(b)).getTime();
      return da - db;
    });

    const selectedGames = limit ? regularSeasonGames.slice(-limit) : regularSeasonGames;
    const logs: any[] = [];

    for (const g of selectedGames) {
      const gameId = g?.id ?? g?.game?.id;
      if (!gameId) continue;

      const statsUrl = new URL("/games/statistics/players", API_BASE);
      statsUrl.searchParams.set("id", String(gameId));
      const statsRes = await fetch(statsUrl.toString(), {
        headers: { "x-apisports-key": API_KEY },
        cache: "no-store",
      });
      let playerGroups: GroupStats = {};
      let statsTeamId: number | null = null;
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        const statsResp = Array.isArray(statsJson?.response) ? statsJson.response : [];
        const parsed = collectPlayerGroupStats(statsResp, playerId);
        playerGroups = parsed.groups;
        statsTeamId = parsed.teamId;
      }
      const hasStats = Object.keys(playerGroups).length > 0;

      const compAttRaw = findStat(playerGroups, "passing", ["comp att", "comp/att"]);
      let passCmp = toNumber(findStat(playerGroups, "passing", ["completions", "comp"])) ?? 0;
      let passAtt = toNumber(findStat(playerGroups, "passing", ["attempts", "att"])) ?? 0;
      if (compAttRaw) {
        const [comp, att] = parseSlashPair(compAttRaw);
        if (comp !== null) passCmp = comp;
        if (att !== null) passAtt = att;
      }

      const passYds =
        toNumber(findStat(playerGroups, "passing", ["yards", "passing yards"])) ?? 0;
      const passTd =
        toNumber(
          findStat(playerGroups, "passing", [
            "passing touch downs",
            "passing touchdowns",
            "passing td",
            "touch downs",
            "touchdowns",
          ]),
        ) ?? 0;
      const passInt =
        toNumber(findStat(playerGroups, "passing", ["interceptions"])) ?? 0;
      const passLng =
        toNumber(findStat(playerGroups, "passing", ["longest pass", "longest"])) ??
        null;
      const sacks = toNumber(findStat(playerGroups, "passing", ["sacks"])) ?? 0;
      const ratingRaw = toNumber(findStat(playerGroups, "passing", ["rating"]));
      const passAvg = toNumber(findStat(playerGroups, "passing", ["average"]));

      const rushAtt =
        toNumber(
          findStat(playerGroups, "rushing", ["total rushes", "rushing attempts", "attempts"]),
        ) ?? 0;
      const rushYds =
        toNumber(findStat(playerGroups, "rushing", ["yards", "rushing yards"])) ?? 0;
      const rushTd =
        toNumber(
          findStat(playerGroups, "rushing", [
            "rushing touch downs",
            "rushing touchdowns",
            "rushing td",
            "touch downs",
            "touchdowns",
          ]),
        ) ?? 0;
      const rushLng =
        toNumber(findStat(playerGroups, "rushing", ["longest rush", "longest"])) ??
        null;
      const rushAvg = toNumber(findStat(playerGroups, "rushing", ["average"]));

      const recTgts =
        toNumber(findStat(playerGroups, "receiving", ["targets"])) ?? 0;
      const rec =
        toNumber(
          findStat(playerGroups, "receiving", ["total receptions", "receptions"]),
        ) ?? 0;
      const recYds =
        toNumber(findStat(playerGroups, "receiving", ["yards", "receiving yards"])) ?? 0;
      const recAvg = toNumber(findStat(playerGroups, "receiving", ["average"]));
      const recTd =
        toNumber(
          findStat(playerGroups, "receiving", [
            "receiving touch downs",
            "receiving touchdowns",
            "receiving td",
            "touch downs",
            "touchdowns",
          ]),
        ) ?? 0;
      const recLng =
        toNumber(findStat(playerGroups, "receiving", ["longest reception", "longest"])) ??
        null;

      const fum = toNumber(findStat(playerGroups, "fumbles", ["total", "fumbles"])) ?? 0;
      const fumLost = toNumber(findStat(playerGroups, "fumbles", ["lost"])) ?? 0;
      const ff = toNumber(findStat(playerGroups, "defensive", ["ff", "forced fumbles"])) ?? 0;
      const kb = toNumber(findStat(playerGroups, "defensive", ["blocked kicks", "blocked kick"])) ?? 0;

      const ypa = passAtt ? passYds / passAtt : passAvg ?? null;
      const rAvg = rushAtt ? rushYds / rushAtt : rushAvg ?? null;
      const passerRating =
        ratingRaw ??
        (passAtt > 0
          ? Math.max(
              0,
              Math.min(
                158.3,
                ((passCmp / passAtt - 0.3) * 5 +
                  ((passYds / passAtt - 3) * 0.25) +
                  (passTd / passAtt) * 20 +
                  2.375 -
                  (passInt / passAtt) * 25) *
                  100 /
                  6,
              ),
            )
          : 0);

      const effectiveTeamId = statsTeamId ?? teamId;
      const homeTeamId = g?.teams?.home?.id ?? g?.game?.teams?.home?.id;
      const awayTeamId = g?.teams?.away?.id ?? g?.game?.teams?.away?.id;
      const homeScore = g?.scores?.home?.total ?? g?.game?.scores?.home?.total;
      const awayScore = g?.scores?.away?.total ?? g?.game?.scores?.away?.total;
      const isHome = homeTeamId === effectiveTeamId;
      const oppTeam =
        isHome
          ? g?.teams?.away?.name ?? g?.game?.teams?.away?.name ?? "OPP"
          : g?.teams?.home?.name ?? g?.game?.teams?.home?.name ?? "OPP";
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;
      const result =
        typeof teamScore === "number" && typeof oppScore === "number"
          ? teamScore > oppScore
            ? `W ${teamScore}-${oppScore}`
            : teamScore < oppScore
              ? `L ${teamScore}-${oppScore}`
              : `T ${teamScore}-${oppScore}`
          : g?.scores?.home?.total != null
            ? "—"
            : "—";

      logs.push({
        week: g?.week?.current ?? g?.week ?? g?.game?.week ?? logs.length + 1,
        date: normalizeGameDate(g),
        homeAway: isHome ? "vs" : "@",
        opp: oppTeam,
        result,
        dnp: !hasStats,
        cmp: passCmp,
        att: passAtt,
        yds: passYds,
        avg: ypa ?? 0,
        td: passTd,
        ints: passInt,
        lng: passLng ?? 0,
        sack: sacks,
        rtg: passerRating ? Number(passerRating.toFixed(1)) : 0,
        car: rushAtt,
        rushYds,
        rushAvg: rAvg ?? 0,
        rushTd,
        rushLng: rushLng ?? 0,
        rec,
        tgts: recTgts,
        recYds,
        recAvg: recAvg ?? (rec ? recYds / rec : null),
        recTd,
        recLng: recLng ?? 0,
        fum,
        lst: fumLost,
        ff,
        kb,
      });
    }

    cache.set(key, { data: logs, expiresAt: now + CACHE_TTL_MS, flushAt });

    return NextResponse.json({ ok: true, season, playerId, logs, cached: false });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
