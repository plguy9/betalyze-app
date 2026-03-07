// app/api/nfl/defense/dvp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const API_KEY = process.env.APISPORTS_KEY;
const API_BASE =
  process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";

type PositionKey = "QB" | "RB" | "WR" | "TE";
type WindowKey = "season" | "L10" | "L5";
type ContextKey = "all" | "home" | "away";

const POSITIONS: PositionKey[] = ["QB", "RB", "WR", "TE"];
const WINDOW_KEYS: WindowKey[] = ["season", "L10", "L5"];
const CONTEXT_KEYS: ContextKey[] = ["all", "home", "away"];

type StatTotals = {
  passYds: number;
  passTD: number;
  ints: number;
  completions: number;
  attempts: number;
  rushYds: number;
  rushTD: number;
  rushAtt: number;
  rec: number;
  recYds: number;
  recTD: number;
  targets: number;
};

type PositionTotals = Record<PositionKey, StatTotals>;

type DefenseGameEntry = {
  date: number;
  context: "home" | "away";
  positions: PositionTotals;
};

type TeamMeta = { name?: string | null; abbr?: string | null };

const rosterCache = new Map<string, Map<number, string | null>>();

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePosition(raw?: any): PositionKey | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return null;
  const normalized = value.replace(/[^A-Z]/g, " ").replace(/\s+/g, " ").trim();
  const padded = ` ${normalized} `;
  const compact = normalized.replace(/\s+/g, "");
  if (
    value === "RB" ||
    padded.includes(" RB ") ||
    padded.includes(" RUNNING BACK ") ||
    padded.includes(" HALFBACK ") ||
    padded.includes(" FULLBACK ") ||
    padded.includes(" HB ") ||
    padded.includes(" FB ") ||
    compact.includes("RUNNINGBACK") ||
    compact.includes("HALFBACK") ||
    compact.includes("FULLBACK")
  ) {
    return "RB";
  }
  if (
    value === "WR" ||
    padded.includes(" WR ") ||
    padded.includes(" WIDE RECEIVER ") ||
    compact.includes("WIDERECEIVER")
  ) {
    return "WR";
  }
  if (
    value === "QB" ||
    padded.includes(" QB ") ||
    padded.includes(" QUARTERBACK ") ||
    compact.includes("QUARTERBACK")
  ) {
    return "QB";
  }
  if (
    value === "TE" ||
    padded.includes(" TE ") ||
    padded.includes(" TIGHT END ") ||
    compact.includes("TIGHTEND")
  ) {
    return "TE";
  }
  return null;
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

function parseSlashPair(value: any): [number | null, number | null] {
  if (typeof value !== "string" || !value.includes("/")) return [null, null];
  const [left, right] = value.split("/");
  return [toNumber(left), toNumber(right)];
}

function readStatValue(stats: any[], keys: string[]) {
  for (const key of keys) {
    const label = normalizeLabel(key);
    const match = stats.find(
      (s) => normalizeLabel(String(s?.name ?? s?.label ?? "")) === label,
    );
    if (match && match.value !== undefined) return match.value;
  }
  return null;
}

function initTotals(): StatTotals {
  return {
    passYds: 0,
    passTD: 0,
    ints: 0,
    completions: 0,
    attempts: 0,
    rushYds: 0,
    rushTD: 0,
    rushAtt: 0,
    rec: 0,
    recYds: 0,
    recTD: 0,
    targets: 0,
  };
}

function initPositionTotals(): PositionTotals {
  return {
    QB: initTotals(),
    RB: initTotals(),
    WR: initTotals(),
    TE: initTotals(),
  };
}

function normalizeGameDate(game: any): number {
  const raw = game?.date ?? game?.game?.date;
  if (!raw) return 0;
  if (typeof raw === "string") {
    const ts = Date.parse(raw);
    return Number.isFinite(ts) ? ts : 0;
  }
  if (typeof raw === "object") {
    if (raw.timestamp) {
      const ts = Number(raw.timestamp);
      return Number.isFinite(ts) ? ts * 1000 : 0;
    }
    if (raw.date) {
      const ts = Date.parse(String(raw.date));
      return Number.isFinite(ts) ? ts : 0;
    }
  }
  return 0;
}

function isFinishedRegularSeasonGame(game: any): boolean {
  const stage = String(game?.game?.stage ?? game?.stage ?? "").toLowerCase();
  if (stage && stage !== "regular season") return false;
  const homeScore = game?.scores?.home?.total ?? game?.game?.scores?.home?.total;
  const awayScore = game?.scores?.away?.total ?? game?.game?.scores?.away?.total;
  return homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;
}

function normalizeWindow(raw?: string | null): WindowKey {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "L10" || value === "LAST10") return "L10";
  if (value === "L5" || value === "LAST5") return "L5";
  return "season";
}

function normalizeContext(raw?: string | null): ContextKey {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "home") return "home";
  if (value === "away") return "away";
  return "all";
}

function calcFfp(position: PositionKey, totals: StatTotals, ppr = 0.5) {
  if (position === "QB") {
    return (
      totals.passYds * 0.04 +
      totals.passTD * 4 +
      totals.ints * -2 +
      totals.rushYds * 0.1 +
      totals.rushTD * 6
    );
  }
  const td = totals.rushTD + totals.recTD;
  return totals.rushYds * 0.1 + totals.recYds * 0.1 + td * 6 + totals.rec * ppr;
}

function perGameStats(totals: StatTotals, games: number) {
  if (!games) return initTotals();
  const div = (value: number) => Number((value / games).toFixed(3));
  return {
    passYds: div(totals.passYds),
    passTD: div(totals.passTD),
    ints: div(totals.ints),
    completions: div(totals.completions),
    attempts: div(totals.attempts),
    rushYds: div(totals.rushYds),
    rushTD: div(totals.rushTD),
    rushAtt: div(totals.rushAtt),
    rec: div(totals.rec),
    recYds: div(totals.recYds),
    recTD: div(totals.recTD),
    targets: div(totals.targets),
  };
}

async function fetchTeamRoster(teamId: number, season: string) {
  const key = `${teamId}::${season}`;
  const cached = rosterCache.get(key);
  if (cached) return cached;

  const url = new URL("/players", API_BASE);
  url.searchParams.set("team", String(teamId));
  url.searchParams.set("season", String(season));
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) {
    rosterCache.set(key, new Map());
    return rosterCache.get(key)!;
  }
  const json = await res.json();
  const players = Array.isArray(json?.response) ? json.response : [];
  const map = new Map<number, string | null>();
  for (const p of players) {
    const id = Number(p?.id);
    if (!Number.isFinite(id)) continue;
    map.set(id, p?.position ? String(p.position).toUpperCase() : null);
  }
  rosterCache.set(key, map);
  return map;
}

function buildTotalsFromTeamBlock(teamBlock: any, roster: Map<number, string | null>) {
  const totals = initPositionTotals();
  const groups = Array.isArray(teamBlock?.groups) ? teamBlock.groups : [];

  for (const group of groups) {
    const groupKey = normalizeLabel(String(group?.name ?? ""));
    const players = Array.isArray(group?.players) ? group.players : [];
    if (!players.length) continue;

    for (const playerEntry of players) {
      const playerId = Number(playerEntry?.player?.id ?? playerEntry?.id);
      if (!Number.isFinite(playerId)) continue;
      const rosterPos = roster.get(playerId) ?? null;
      const entryPos = playerEntry?.player?.position ?? playerEntry?.position ?? null;
      const pos = normalizePosition(rosterPos ?? entryPos);
      if (!pos) continue;

      const stats = Array.isArray(playerEntry?.statistics) ? playerEntry.statistics : [];
      const bucket = totals[pos];

      if (groupKey === "passing") {
        const compAttRaw = readStatValue(stats, ["comp/att", "comp att", "comp-att"]);
        if (compAttRaw) {
          const [comp, att] = parseSlashPair(compAttRaw);
          if (comp !== null) bucket.completions += comp;
          if (att !== null) bucket.attempts += att;
        }
        const comp =
          toNumber(readStatValue(stats, ["completions", "comp"])) ?? 0;
        const att = toNumber(readStatValue(stats, ["attempts", "att"])) ?? 0;
        bucket.completions += comp;
        bucket.attempts += att;
        bucket.passYds +=
          toNumber(readStatValue(stats, ["yards", "passing yards"])) ?? 0;
        bucket.passTD +=
          toNumber(
            readStatValue(stats, [
              "passing touch downs",
              "passing touchdowns",
              "passing td",
              "touchdowns",
              "touch downs",
            ]),
          ) ?? 0;
        bucket.ints +=
          toNumber(readStatValue(stats, ["interceptions"])) ?? 0;
      }

      if (groupKey === "rushing") {
        bucket.rushAtt +=
          toNumber(
            readStatValue(stats, [
              "total rushes",
              "rushing attempts",
              "rush attempts",
              "attempts",
            ]),
          ) ?? 0;
        bucket.rushYds +=
          toNumber(readStatValue(stats, ["yards", "rushing yards"])) ?? 0;
        bucket.rushTD +=
          toNumber(
            readStatValue(stats, [
              "rushing touch downs",
              "rushing touchdowns",
              "rushing td",
              "touchdowns",
              "touch downs",
            ]),
          ) ?? 0;
      }

      if (groupKey === "receiving") {
        bucket.targets +=
          toNumber(readStatValue(stats, ["targets", "target"])) ?? 0;
        bucket.rec +=
          toNumber(readStatValue(stats, ["total receptions", "receptions"])) ?? 0;
        bucket.recYds +=
          toNumber(readStatValue(stats, ["yards", "receiving yards"])) ?? 0;
        bucket.recTD +=
          toNumber(
            readStatValue(stats, [
              "receiving touch downs",
              "receiving touchdowns",
              "receiving td",
              "touchdowns",
              "touch downs",
            ]),
          ) ?? 0;
      }
    }
  }

  return totals;
}

async function fetchGames(season: string, league: string) {
  const url = new URL("/games", API_BASE);
  url.searchParams.set("league", league);
  url.searchParams.set("season", season);
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Games fetch failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const games = Array.isArray(json?.response) ? json.response : [];
  return games.filter(isFinishedRegularSeasonGame).sort((a: any, b: any) => {
    return normalizeGameDate(a) - normalizeGameDate(b);
  });
}

async function fetchGamePlayerStats(gameId: number) {
  const url = new URL("/games/statistics/players", API_BASE);
  url.searchParams.set("id", String(gameId));
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.response) ? json.response : [];
}

async function buildDefenseGames(season: string, league: string) {
  const games = await fetchGames(season, league);
  const defenseGames = new Map<number, DefenseGameEntry[]>();
  const teamMeta = new Map<number, TeamMeta>();

  for (const g of games) {
    const gameId = Number(g?.id ?? g?.game?.id);
    const homeId = Number(g?.teams?.home?.id ?? g?.game?.teams?.home?.id);
    const awayId = Number(g?.teams?.away?.id ?? g?.game?.teams?.away?.id);
    if (!Number.isFinite(gameId) || !Number.isFinite(homeId) || !Number.isFinite(awayId)) {
      continue;
    }

    const homeMeta = {
      name: g?.teams?.home?.name ?? g?.game?.teams?.home?.name ?? null,
      abbr: g?.teams?.home?.code ?? g?.game?.teams?.home?.code ?? null,
    };
    const awayMeta = {
      name: g?.teams?.away?.name ?? g?.game?.teams?.away?.name ?? null,
      abbr: g?.teams?.away?.code ?? g?.game?.teams?.away?.code ?? null,
    };
    teamMeta.set(homeId, { ...teamMeta.get(homeId), ...homeMeta });
    teamMeta.set(awayId, { ...teamMeta.get(awayId), ...awayMeta });

    const statsResp = await fetchGamePlayerStats(gameId);
    const teamBlocks = Array.isArray(statsResp) ? statsResp : [];
    const teamTotals = new Map<number, PositionTotals>();

    for (const block of teamBlocks) {
      const teamId = Number(block?.team?.id ?? block?.team?.id);
      if (!Number.isFinite(teamId)) continue;
      const roster = await fetchTeamRoster(teamId, season);
      const totals = buildTotalsFromTeamBlock(block, roster);
      teamTotals.set(teamId, totals);
    }

    const homeTotals = teamTotals.get(homeId) ?? initPositionTotals();
    const awayTotals = teamTotals.get(awayId) ?? initPositionTotals();
    const date = normalizeGameDate(g);

    const pushGame = (
      defenseId: number,
      positions: PositionTotals,
      context: "home" | "away",
    ) => {
      const list = defenseGames.get(defenseId) ?? [];
      list.push({ date, positions, context });
      defenseGames.set(defenseId, list);
    };

    pushGame(awayId, homeTotals, "away");
    pushGame(homeId, awayTotals, "home");
  }

  for (const [teamId, list] of defenseGames.entries()) {
    list.sort((a, b) => a.date - b.date);
    defenseGames.set(teamId, list);
  }

  return { defenseGames, teamMeta };
}

function sliceWindow(games: DefenseGameEntry[], window: WindowKey, context: ContextKey) {
  const filtered =
    context === "all" ? games : games.filter((g) => g.context === context);
  if (window === "season") return filtered;
  const count = window === "L10" ? 10 : 5;
  return filtered.slice(-count);
}

function sumTotals(games: DefenseGameEntry[], position: PositionKey) {
  const totals = initTotals();
  for (const game of games) {
    const stats = game.positions[position];
    totals.passYds += stats.passYds;
    totals.passTD += stats.passTD;
    totals.ints += stats.ints;
    totals.completions += stats.completions;
    totals.attempts += stats.attempts;
    totals.rushYds += stats.rushYds;
    totals.rushTD += stats.rushTD;
    totals.rushAtt += stats.rushAtt;
    totals.rec += stats.rec;
    totals.recYds += stats.recYds;
    totals.recTD += stats.recTD;
    totals.targets += stats.targets;
  }
  return totals;
}

async function rebuildDvp(season: string, league: string) {
  const { defenseGames, teamMeta } = await buildDefenseGames(season, league);
  const rows: Array<{
    season: string;
    window: WindowKey;
    context: ContextKey;
    teamId: number;
    teamName: string | null;
    teamAbbr: string | null;
    position: PositionKey;
    games: number;
    ffpTotal: number;
    ffpPerGame: number;
    metrics: any;
  }> = [];

  for (const [teamId, games] of defenseGames.entries()) {
    for (const window of WINDOW_KEYS) {
      for (const context of CONTEXT_KEYS) {
        const windowGames = sliceWindow(games, window, context);
        if (!windowGames.length) continue;
        const gameCount = windowGames.length;

        for (const position of POSITIONS) {
          const totals = sumTotals(windowGames, position);
          const ffpTotal = Number(calcFfp(position, totals, 0.5).toFixed(3));
          const ffpPerGame = Number((ffpTotal / gameCount).toFixed(3));
          const perGame = perGameStats(totals, gameCount);
          const meta = teamMeta.get(teamId) ?? {};

          rows.push({
            season,
            window,
            context,
            teamId,
            teamName: meta.name ?? null,
            teamAbbr: meta.abbr ?? null,
            position,
            games: gameCount,
            ffpTotal,
            ffpPerGame,
            metrics: {
              totals,
              perGame,
            },
          });
        }
      }
    }
  }

  await prisma.nflDefenseDvp.deleteMany({ where: { season } });
  if (rows.length) {
    await prisma.nflDefenseDvp.createMany({ data: rows });
  }

  return rows.length;
}

function addRanks(rows: any[]) {
  const buckets = new Map<string, any[]>();
  for (const row of rows) {
    const key = `${row.season}::${row.window}::${row.context}::${row.position}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  const ranked = rows.map((row) => ({ ...row, rank: null }));
  const index = new Map(
    ranked.map((row) => [
      `${row.season}::${row.window}::${row.context}::${row.position}::${row.teamId}`,
      row,
    ]),
  );

  for (const [key, list] of buckets.entries()) {
    const sorted = [...list].sort((a, b) => a.ffpPerGame - b.ffpPerGame);
    sorted.forEach((row, idx) => {
      const targetKey = `${row.season}::${row.window}::${row.context}::${row.position}::${row.teamId}`;
      const target = index.get(targetKey);
      if (target) target.rank = idx + 1;
    });
  }
  return ranked;
}

export async function GET(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const season = params.get("season") ?? DEFAULT_SEASON;
  const league = params.get("league") ?? DEFAULT_LEAGUE;
  const windowParam = normalizeWindow(params.get("window"));
  const positionParam = normalizePosition(params.get("position")) ?? null;
  const contextParam = normalizeContext(params.get("context"));
  const refresh = params.get("refresh") === "1";

  try {
    if (refresh) {
      const count = await rebuildDvp(season, league);
      return NextResponse.json({
        ok: true,
        season,
        rebuilt: true,
        records: count,
      });
    }

    let rows = await prisma.nflDefenseDvp.findMany({
      where: {
        season,
        window: windowParam,
        context: contextParam,
        ...(positionParam ? { position: positionParam } : {}),
      },
      orderBy: [{ teamId: "asc" }],
    });

    if (!rows.length) {
      const count = await rebuildDvp(season, league);
      rows = await prisma.nflDefenseDvp.findMany({
        where: {
          season,
          window: windowParam,
          context: contextParam,
          ...(positionParam ? { position: positionParam } : {}),
        },
        orderBy: [{ teamId: "asc" }],
      });
      return NextResponse.json({
        ok: true,
        season,
        window: windowParam,
        context: contextParam,
        position: positionParam,
        rebuilt: true,
        records: count,
        rows: addRanks(rows),
      });
    }

    return NextResponse.json({
      ok: true,
      season,
      window: windowParam,
      context: contextParam,
      position: positionParam,
      rows: addRanks(rows),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
