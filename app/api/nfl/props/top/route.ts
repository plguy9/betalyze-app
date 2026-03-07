// app/api/nfl/props/top/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ODDS_API_KEY = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.APISPORTS_KEY;
const API_BASE = process.env.APISPORTS_NFL_URL ?? "https://v1.american-football.api-sports.io";
const DEFAULT_LEAGUE = process.env.APISPORTS_NFL_LEAGUE_ID ?? "1";
const DEFAULT_SEASON = process.env.APISPORTS_NFL_SEASON ?? "2025";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const cache = new Map<string, { data: any; expiresAt: number }>();

const MARKETS = [
  "player_pass_yds",
  "player_pass_tds",
  "player_pass_completions",
  "player_pass_attempts",
  "player_pass_longest_completion",
  "player_pass_interceptions",
  "player_rush_yds",
  "player_rush_longest",
  "player_reception_yds",
  "player_receptions",
  "player_reception_longest",
  "player_reception_tds",
  "player_rush_tds",
].join(",");

type DvpWindow = "season" | "L10" | "L5";
type DvpPosition = "QB" | "RB" | "WR" | "TE";
type DvpStatTotals = {
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
type DvpRow = {
  teamId: number;
  position: DvpPosition;
  games: number;
  metrics: { perGame: DvpStatTotals };
};
type MetricKey =
  | "passYds"
  | "passTD"
  | "completions"
  | "attempts"
  | "passLong"
  | "ints"
  | "rushYds"
  | "rushTD"
  | "rushLng"
  | "rec"
  | "recYds"
  | "recTD"
  | "recLng";

type PlayerAgg = {
  playerId: number;
  name: string;
  teamId: number;
  position: DvpPosition | null;
  games: number;
  totals: Record<MetricKey, number>;
  values: Record<MetricKey, number[]>;
};

const metricKeys: MetricKey[] = [
  "passYds",
  "passTD",
  "completions",
  "attempts",
  "passLong",
  "ints",
  "rushYds",
  "rushTD",
  "rushLng",
  "rec",
  "recYds",
  "recTD",
  "recLng",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function parseSlashPair(value: any): [number | null, number | null] {
  if (typeof value !== "string" || !value.includes("/")) return [null, null];
  const [left, right] = value.split("/");
  return [toNumber(left), toNumber(right)];
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pctHit(values: number[], line: number) {
  if (!values.length) return 0;
  const hit = values.filter((v) => v >= line).length;
  return Math.round((hit / values.length) * 100);
}

function normalizePosition(raw?: string | null): DvpPosition | null {
  if (!raw) return null;
  const value = raw.toUpperCase();
  if (value.includes("QB")) return "QB";
  if (value.includes("RB") || value.includes("FB")) return "RB";
  if (value.includes("TE")) return "TE";
  if (value.includes("WR")) return "WR";
  return null;
}

function gradeFromScore(score: number) {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

function marketToMetric(market: string): MetricKey | null {
  if (market === "player_pass_yds") return "passYds";
  if (market === "player_pass_tds") return "passTD";
  if (market === "player_pass_completions") return "completions";
  if (market === "player_pass_attempts") return "attempts";
  if (market === "player_pass_longest_completion") return "passLong";
  if (market === "player_pass_interceptions") return "ints";
  if (market === "player_rush_yds") return "rushYds";
  if (market === "player_rush_tds") return "rushTD";
  if (market === "player_rush_longest") return "rushLng";
  if (market === "player_receptions") return "rec";
  if (market === "player_reception_yds") return "recYds";
  if (market === "player_reception_tds") return "recTD";
  if (market === "player_reception_longest") return "recLng";
  return null;
}

function metricToDvpKey(metric: MetricKey): keyof DvpStatTotals | null {
  if (metric === "passYds") return "passYds";
  if (metric === "passTD") return "passTD";
  if (metric === "completions") return "completions";
  if (metric === "attempts") return "attempts";
  if (metric === "passLong") return "passYds";
  if (metric === "ints") return "ints";
  if (metric === "rushYds") return "rushYds";
  if (metric === "rushTD") return "rushTD";
  if (metric === "rushLng") return "rushYds";
  if (metric === "rec") return "rec";
  if (metric === "recYds") return "recYds";
  if (metric === "recTD") return "recTD";
  if (metric === "recLng") return "recYds";
  return null;
}

const UPCOMING_WINDOW_DAYS = 7;

async function fetchOddsEvents() {
  const url = new URL("sports/americanfootball_nfl/events", `${ODDS_API_BASE}/`);
  url.searchParams.set("apiKey", ODDS_API_KEY!);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Odds events error: ${res.status} ${txt}`);
  }
  return res.json();
}

async function fetchOddsForEvent(eventId: string) {
  const url = new URL(
    `sports/americanfootball_nfl/events/${eventId}/odds`,
    `${ODDS_API_BASE}/`,
  );
  url.searchParams.set("apiKey", ODDS_API_KEY!);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", MARKETS);
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("bookmakers", "draftkings");
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Odds event error: ${res.status} ${txt}`);
  }
  return res.json();
}

async function fetchTeams(season: string, league: string) {
  const url = new URL("/teams", API_BASE);
  url.searchParams.set("league", league);
  url.searchParams.set("season", season);
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.response) ? json.response : [];
}

async function fetchRoster(teamId: number, season: string) {
  const url = new URL("/players", API_BASE);
  url.searchParams.set("team", String(teamId));
  url.searchParams.set("season", season);
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.response) ? json.response : [];
}

async function fetchGames(season: string, league: string) {
  const url = new URL("/games", API_BASE);
  url.searchParams.set("league", league);
  url.searchParams.set("season", season);
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.response) ? json.response : [];
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

function collectPlayerGroups(teamBlock: any) {
  const groups = Array.isArray(teamBlock?.groups) ? teamBlock.groups : [];
  const playersMap = new Map<number, Record<string, Record<string, any>>>();

  for (const group of groups) {
    const groupKey = normalizeLabel(String(group?.name ?? ""));
    const players = Array.isArray(group?.players) ? group.players : [];
    for (const playerEntry of players) {
      const pid = Number(playerEntry?.player?.id ?? playerEntry?.id);
      if (!Number.isFinite(pid)) continue;
      const bucket = playersMap.get(pid) ?? {};
      const stats = playerEntry?.statistics ?? [];
      const groupBucket = bucket[groupKey] ?? {};
      for (const stat of stats) {
        const label = normalizeLabel(String(stat?.name ?? stat?.label ?? ""));
        if (!label) continue;
        groupBucket[label] = stat?.value ?? stat?.stat ?? null;
      }
      bucket[groupKey] = groupBucket;
      playersMap.set(pid, bucket);
    }
  }
  return playersMap;
}

function findStat(groups: Record<string, Record<string, any>>, group: string, keys: string[]) {
  const g = groups[normalizeLabel(group)];
  if (!g) return null;
  for (const key of keys) {
    const label = normalizeLabel(key);
    if (label in g) return g[label];
  }
  return null;
}

function initAgg(): PlayerAgg {
  const totals = {} as Record<MetricKey, number>;
  const values = {} as Record<MetricKey, number[]>;
  metricKeys.forEach((k) => {
    totals[k] = 0;
    values[k] = [];
  });
  return {
    playerId: 0,
    name: "",
    teamId: 0,
    position: null,
    games: 0,
    totals,
    values,
  };
}

function addAlias(map: Map<string, { id: number; name: string; position: DvpPosition | null }>, name: string, entry: { id: number; name: string; position: DvpPosition | null }) {
  const norm = normalizeText(name);
  if (!norm || map.has(norm)) return;
  map.set(norm, entry);
}

function buildNameAliases(name: string) {
  const cleaned = normalizeText(name);
  if (!cleaned) return [];
  const parts = cleaned.split(" ");
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const aliases = new Set<string>();
  aliases.add(cleaned);
  if (first && last) {
    aliases.add(`${first} ${last}`);
    aliases.add(`${first[0]} ${last}`);
    aliases.add(`${first.slice(0, 3)} ${last}`);
  }
  return Array.from(aliases);
}

export async function GET(req: NextRequest) {
  if (!ODDS_API_KEY) {
    return NextResponse.json({ error: "Missing Odds API key" }, { status: 500 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing API-Sports key" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  const season = params.get("season") ?? DEFAULT_SEASON;
  const league = params.get("league") ?? DEFAULT_LEAGUE;
  const refresh = params.get("refresh") === "1";
  const cacheKey = `${season}::${league}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!refresh && cached && now < cached.expiresAt) {
    return NextResponse.json({ ok: true, cached: true, ...cached.data });
  }

  try {
    const events = await fetchOddsEvents();
    const upcomingRaw = Array.isArray(events) ? events : [];
    const nowTs = Date.now();
    const cutoffTs = nowTs + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const upcoming = upcomingRaw.filter((event: any) => {
      const rawTime = event?.commence_time ?? event?.commenceTime ?? null;
      const ts = rawTime ? Date.parse(String(rawTime)) : NaN;
      if (!Number.isFinite(ts)) return false;
      return ts >= nowTs - 6 * 60 * 60 * 1000 && ts <= cutoffTs;
    });
    if (!upcoming.length) {
      return NextResponse.json({ ok: true, cached: false, props: [], events: 0 });
    }

    const teams = await fetchTeams(season, league);
    const teamByName = new Map<string, { id: number; name: string; abbr?: string | null }>();
    for (const t of teams) {
      const team = t?.team ?? t;
      const id = Number(team?.id);
      if (!Number.isFinite(id)) continue;
      const name = String(team?.name ?? "");
      const abbr = team?.code ?? team?.abbreviation ?? null;
      const normalized = normalizeText(name);
      if (normalized) teamByName.set(normalized, { id, name, abbr });
      if (abbr) teamByName.set(normalizeText(String(abbr)), { id, name, abbr });
    }

    const matchups = upcoming
      .map((event: any) => {
        const homeName = String(event?.home_team ?? "");
        const awayName = String(event?.away_team ?? "");
        const home = teamByName.get(normalizeText(homeName));
        const away = teamByName.get(normalizeText(awayName));
        if (!home || !away) return null;
        return {
          eventId: String(event?.id),
          home,
          away,
        };
      })
      .filter(Boolean) as Array<{
      eventId: string;
      home: { id: number; name: string; abbr?: string | null };
      away: { id: number; name: string; abbr?: string | null };
    }>;

    const teamIds = Array.from(
      new Set(matchups.flatMap((m) => [m.home.id, m.away.id])),
    );

    const rosterByTeam = new Map<
      number,
      Map<string, { id: number; name: string; position: DvpPosition | null }>
    >();
    const rosterById = new Map<number, { id: number; name: string; position: DvpPosition | null; teamId: number }>();
    for (const teamId of teamIds) {
      const roster = await fetchRoster(teamId, season);
      const map = new Map<string, { id: number; name: string; position: DvpPosition | null }>();
      for (const p of roster) {
        const pid = Number(p?.id);
        if (!Number.isFinite(pid)) continue;
        const name = String(p?.name ?? "");
        const position = normalizePosition(p?.position ?? null);
        const entry = { id: pid, name, position };
        for (const alias of buildNameAliases(name)) {
          addAlias(map, alias, entry);
        }
        rosterById.set(pid, { ...entry, teamId });
      }
      rosterByTeam.set(teamId, map);
    }

    const games = await fetchGames(season, league);
    const teamGames = new Map<number, any[]>();
    for (const g of games) {
      const stageRaw = g?.game?.stage ?? g?.stage ?? "";
      const stage = String(stageRaw).toLowerCase();
      if (stage && stage !== "regular season") continue;
      const homeScore = g?.scores?.home?.total ?? g?.game?.scores?.home?.total;
      const awayScore = g?.scores?.away?.total ?? g?.game?.scores?.away?.total;
      if (homeScore == null || awayScore == null) continue;
      const homeId = Number(g?.teams?.home?.id ?? g?.game?.teams?.home?.id);
      const awayId = Number(g?.teams?.away?.id ?? g?.game?.teams?.away?.id);
      if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;
      const dateRaw = g?.game?.date?.timestamp ?? g?.date?.timestamp ?? g?.game?.date?.date ?? g?.date;
      const date = typeof dateRaw === "number" ? dateRaw : Date.parse(String(dateRaw || ""));
      const record = { id: Number(g?.id ?? g?.game?.id), date };
      const listHome = teamGames.get(homeId) ?? [];
      listHome.push(record);
      teamGames.set(homeId, listHome);
      const listAway = teamGames.get(awayId) ?? [];
      listAway.push(record);
      teamGames.set(awayId, listAway);
    }

    const gameIds = new Set<number>();
    for (const teamId of teamIds) {
      const list = teamGames.get(teamId) ?? [];
      list.sort((a, b) => a.date - b.date);
      const last10 = list.slice(-10);
      last10.forEach((g) => {
        if (Number.isFinite(g.id)) gameIds.add(g.id);
      });
    }

    const playerAgg = new Map<number, PlayerAgg>();
    const gameIdList = Array.from(gameIds.values());
    for (const gameId of gameIdList) {
      const statsResp = await fetchGamePlayerStats(gameId);
      for (const teamBlock of statsResp ?? []) {
        const teamId = Number(teamBlock?.team?.id ?? teamBlock?.team?.id);
        const playerGroups = collectPlayerGroups(teamBlock);
        for (const [pid, groups] of playerGroups.entries()) {
          const base = playerAgg.get(pid) ?? initAgg();
          base.playerId = pid;
          base.teamId = teamId;
          const rosterEntry = rosterById.get(pid);
          if (rosterEntry?.name) base.name = rosterEntry.name;
          if (rosterEntry?.position) base.position = rosterEntry.position;
          base.games += 1;

          const compAttRaw = findStat(groups, "passing", ["comp att", "comp/att"]);
          let passCmp = toNumber(findStat(groups, "passing", ["completions", "comp"])) ?? 0;
          let passAtt = toNumber(findStat(groups, "passing", ["attempts", "att"])) ?? 0;
          if (compAttRaw) {
            const [comp, att] = parseSlashPair(compAttRaw);
            if (comp !== null) passCmp = comp;
            if (att !== null) passAtt = att;
          }
          const passYds = toNumber(findStat(groups, "passing", ["yards", "passing yards"])) ?? 0;
          const passTd =
            toNumber(
              findStat(groups, "passing", [
                "passing touch downs",
                "passing touchdowns",
                "passing td",
                "touch downs",
                "touchdowns",
              ]),
            ) ?? 0;
          const passInt = toNumber(findStat(groups, "passing", ["interceptions"])) ?? 0;
          const passLng =
            toNumber(findStat(groups, "passing", ["longest pass", "longest"])) ?? 0;

          const rushAtt =
            toNumber(
              findStat(groups, "rushing", ["total rushes", "rushing attempts", "attempts"]),
            ) ?? 0;
          const rushYds =
            toNumber(findStat(groups, "rushing", ["yards", "rushing yards"])) ?? 0;
          const rushTd =
            toNumber(
              findStat(groups, "rushing", [
                "rushing touch downs",
                "rushing touchdowns",
                "rushing td",
                "touch downs",
                "touchdowns",
              ]),
            ) ?? 0;
          const rushLng =
            toNumber(findStat(groups, "rushing", ["longest rush", "longest"])) ?? 0;

          const rec =
            toNumber(
              findStat(groups, "receiving", ["total receptions", "receptions"]),
            ) ?? 0;
          const targets = toNumber(findStat(groups, "receiving", ["targets"])) ?? 0;
          const recYds =
            toNumber(findStat(groups, "receiving", ["yards", "receiving yards"])) ?? 0;
          const recTd =
            toNumber(
              findStat(groups, "receiving", [
                "receiving touch downs",
                "receiving touchdowns",
                "receiving td",
                "touch downs",
                "touchdowns",
              ]),
            ) ?? 0;
          const recLng =
            toNumber(findStat(groups, "receiving", ["longest reception", "longest"])) ??
            0;

          const metrics: Record<MetricKey, number> = {
            passYds,
            passTD: passTd,
            completions: passCmp,
            attempts: passAtt,
            passLong: passLng,
            ints: passInt,
            rushYds,
            rushTD: rushTd,
            rushLng,
            rec,
            recYds,
            recTD: recTd,
            recLng,
          };

          metricKeys.forEach((key) => {
            const val = Number(metrics[key] ?? 0);
            base.totals[key] += val;
            base.values[key].push(val);
          });

          playerAgg.set(pid, base);
        }
      }
    }

    const dvpRows = await prisma.nflDefenseDvp.findMany({
      where: { season, window: "L10" as DvpWindow, context: "all" },
      select: { teamId: true, position: true, games: true, metrics: true },
    });
    const dvpByPosition = new Map<
      DvpPosition,
      {
        rows: DvpRow[];
        byTeam: Map<number, DvpRow>;
        leagueAvg: DvpStatTotals;
        ranks: Record<keyof DvpStatTotals, Map<number, number>>;
      }
    >();

    for (const row of dvpRows as any[]) {
      const pos = row.position as DvpPosition;
      const entry = dvpByPosition.get(pos) ?? {
        rows: [],
        byTeam: new Map(),
        leagueAvg: {
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
        },
        ranks: {
          passYds: new Map(),
          passTD: new Map(),
          ints: new Map(),
          completions: new Map(),
          attempts: new Map(),
          rushYds: new Map(),
          rushTD: new Map(),
          rushAtt: new Map(),
          rec: new Map(),
          recYds: new Map(),
          recTD: new Map(),
          targets: new Map(),
        },
      };
      entry.rows.push(row as DvpRow);
      entry.byTeam.set(Number(row.teamId), row as DvpRow);
      dvpByPosition.set(pos, entry);
    }

    for (const entry of dvpByPosition.values()) {
      const totals = {
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
      let totalGames = 0;
      for (const row of entry.rows) {
        const per = row.metrics?.perGame;
        if (!per) continue;
        const games = Number(row.games) || 0;
        const weight = games > 0 ? games : 1;
        totalGames += weight;
        totals.passYds += (per.passYds ?? 0) * weight;
        totals.passTD += (per.passTD ?? 0) * weight;
        totals.ints += (per.ints ?? 0) * weight;
        totals.completions += (per.completions ?? 0) * weight;
        totals.attempts += (per.attempts ?? 0) * weight;
        totals.rushYds += (per.rushYds ?? 0) * weight;
        totals.rushTD += (per.rushTD ?? 0) * weight;
        totals.rushAtt += (per.rushAtt ?? 0) * weight;
        totals.rec += (per.rec ?? 0) * weight;
        totals.recYds += (per.recYds ?? 0) * weight;
        totals.recTD += (per.recTD ?? 0) * weight;
        totals.targets += (per.targets ?? 0) * weight;
      }
      if (totalGames) {
        entry.leagueAvg = {
          passYds: totals.passYds / totalGames,
          passTD: totals.passTD / totalGames,
          ints: totals.ints / totalGames,
          completions: totals.completions / totalGames,
          attempts: totals.attempts / totalGames,
          rushYds: totals.rushYds / totalGames,
          rushTD: totals.rushTD / totalGames,
          rushAtt: totals.rushAtt / totalGames,
          rec: totals.rec / totalGames,
          recYds: totals.recYds / totalGames,
          recTD: totals.recTD / totalGames,
          targets: totals.targets / totalGames,
        };
      }
      (Object.keys(entry.ranks) as Array<keyof DvpStatTotals>).forEach((key) => {
        const sorted = [...entry.rows]
          .map((row) => ({
            teamId: row.teamId,
            value: row.metrics?.perGame?.[key],
          }))
          .filter((r) => Number.isFinite(r.value ?? NaN))
          .sort((a, b) => Number(a.value) - Number(b.value));
        sorted.forEach((row, idx) => {
          entry.ranks[key].set(row.teamId, idx + 1);
        });
      });
    }

    const props: any[] = [];
    for (const match of matchups) {
      const odds = await fetchOddsForEvent(match.eventId);
      const book = odds?.bookmakers?.[0];
      const markets = Array.isArray(book?.markets) ? book.markets : [];
      for (const market of markets) {
        const metric = marketToMetric(String(market?.key ?? ""));
        if (!metric) continue;
        const outcomes = Array.isArray(market?.outcomes) ? market.outcomes : [];
        const bySide: Record<string, any> = {};
        for (const outcome of outcomes) {
          const side = String(outcome?.name ?? "").toLowerCase();
          const playerName = String(outcome?.description ?? "");
          if (!playerName || (side !== "over" && side !== "under")) continue;
          bySide[side] = outcome;
        }
        if (!bySide.over && !bySide.under) continue;
        const playerName = String(bySide.over?.description ?? bySide.under?.description ?? "");
        if (!playerName) continue;
        const homeRoster = rosterByTeam.get(match.home.id);
        const awayRoster = rosterByTeam.get(match.away.id);
        const normName = normalizeText(playerName);
        const homeHit = homeRoster?.get(normName);
        const awayHit = awayRoster?.get(normName);
        const selected =
          homeHit && awayHit ? null : homeHit ? { player: homeHit, teamId: match.home.id, oppId: match.away.id } : awayHit ? { player: awayHit, teamId: match.away.id, oppId: match.home.id } : null;
        if (!selected) continue;
        const agg = playerAgg.get(selected.player.id);
        if (!agg || !agg.values[metric]?.length) continue;
        const line = toNumber(bySide.over?.point ?? bySide.under?.point ?? null);
        if (!Number.isFinite(line ?? NaN)) continue;
        const values = agg.values[metric];
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        const hitPct = pctHit(values, line as number);
        const dvpPos = selected.player.position;
        const dvpEntry = dvpPos ? dvpByPosition.get(dvpPos) : null;
        const dvpKey = metricToDvpKey(metric);
        const dvpRow = dvpEntry?.byTeam.get(selected.oppId);
        const dvpRank = dvpKey ? dvpEntry?.ranks[dvpKey]?.get(selected.oppId) ?? null : null;
        const leagueAvg = dvpKey ? dvpEntry?.leagueAvg[dvpKey] ?? null : null;
        const oppVal = dvpKey ? dvpRow?.metrics?.perGame?.[dvpKey] ?? null : null;
        const dvpDelta =
          Number.isFinite(oppVal ?? NaN) && Number.isFinite(leagueAvg ?? NaN) && leagueAvg
            ? (Number(oppVal) - Number(leagueAvg)) / Number(leagueAvg)
            : null;
        const dvpFlag = dvpDelta !== null ? (dvpDelta >= 0.07 ? "weakness" : dvpDelta <= -0.07 ? "strength" : "neutral") : "neutral";

        const lineEdge = line > 0 ? clamp(((avg - line!) / line!) * 40, -20, 20) : 0;
        const hitEdge = clamp(((hitPct / 100) - 0.5) * 40, -20, 20);
        const rankEdge =
          dvpRank && dvpEntry?.rows.length
            ? clamp(
                ((dvpRank - (dvpEntry.rows.length + 1) / 2) / ((dvpEntry.rows.length - 1) / 2)) *
                  20,
                -20,
                20,
              )
            : 0;
        const strengthEdge = dvpFlag === "weakness" ? 8 : dvpFlag === "strength" ? -8 : 0;
        const score = Math.round(clamp(50 + lineEdge + hitEdge + rankEdge + strengthEdge, 0, 100));
        const overProb = score / 100;
        const underProb = 1 - overProb;
        const overPrice = toNumber(bySide.over?.price ?? null);
        const underPrice = toNumber(bySide.under?.price ?? null);
        const impliedOver = overPrice ? 1 / overPrice : null;
        const impliedUnder = underPrice ? 1 / underPrice : null;
        const edgeOver =
          impliedOver !== null ? Number((overProb - impliedOver).toFixed(4)) : null;
        const edgeUnder =
          impliedUnder !== null ? Number((underProb - impliedUnder).toFixed(4)) : null;
        const pick =
          edgeOver !== null && edgeUnder !== null
            ? edgeOver >= edgeUnder
              ? { side: "over", edge: edgeOver, price: overPrice }
              : { side: "under", edge: edgeUnder, price: underPrice }
            : edgeOver !== null
              ? { side: "over", edge: edgeOver, price: overPrice }
              : edgeUnder !== null
                ? { side: "under", edge: edgeUnder, price: underPrice }
                : null;
        if (!pick) continue;
        const finalScore = Number((score + pick.edge * 100).toFixed(2));

        props.push({
          playerId: agg.playerId,
          player: agg.name || playerName,
          teamId: selected.teamId,
          opponentId: selected.oppId,
          position: dvpPos,
          market: market?.key,
          metric,
          side: pick.side,
          line,
          odds: pick.price,
          score,
          grade: gradeFromScore(score),
          edge: pick.edge,
          finalScore,
          dvpRank,
          dvpCount: dvpEntry?.rows.length ?? null,
          dvpFlag,
        });
      }
    }

    const topProps = props
      .filter((p) => p.edge !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.edge ?? 0) - (a.edge ?? 0);
      })
      .slice(0, 10);

    const payload = {
      generatedAt: new Date().toISOString(),
      events: matchups.length,
      markets: MARKETS.split(","),
      props: topProps,
    };

    cache.set(cacheKey, { data: payload, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json({ ok: true, cached: false, ...payload });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
