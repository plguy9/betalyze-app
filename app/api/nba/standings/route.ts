import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const API_BASE =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ?? "2025";
const CACHE_TTL_MS = 30 * 60 * 1000;

type NbaStandingConference = "East" | "West" | "N/A";

type NbaStandingRow = {
  teamId: number;
  code: string | null;
  name: string;
  logo: string | null;
  conference: NbaStandingConference;
  position: number | null;
  overallRank: number;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  pointsAllowedPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  threesMadePerGame: number | null;
  turnoversPerGame: number | null;
  stealsPerGame: number | null;
  blocksPerGame: number | null;
  fgPct: number | null;
  tpPct: number | null;
  ftPct: number | null;
  reboundsAllowedPerGame: number | null;
  assistsAllowedPerGame: number | null;
  threesAllowedPerGame: number | null;
  fgPctAllowed: number | null;
  ftPctAllowed: number | null;
  form: string | null;
  description: string | null;
};

type NbaStandingsPayload = {
  season: string;
  count: number;
  updatedAt: string;
  standings: NbaStandingRow[];
};

// v2 NBA response shape
type ApiStandingItemV2 = {
  team?: { id?: number | string | null; name?: string | null; code?: string | null; logo?: string | null } | null;
  conference?: { name?: string | null; rank?: number | string | null; win?: number | string | null; loss?: number | string | null } | null;
  win?: { total?: number | string | null; percentage?: number | string | null } | null;
  loss?: { total?: number | string | null; percentage?: number | string | null } | null;
  streak?: number | string | null;
  gamesBehind?: string | null;
  winStreak?: boolean | null;
};

type ParsedRowsV2 = {
  rows: NbaStandingRow[];
  v2TeamIdByInternalId: Map<number, number>;
};

type TeamStatsPerGame = {
  pointsForPerGame: number | null;
  pointsAgainstPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  threesMadePerGame: number | null;
  turnoversPerGame: number | null;
  stealsPerGame: number | null;
  blocksPerGame: number | null;
  fgPct: number | null;
  tpPct: number | null;
  ftPct: number | null;
};

type TeamDefensiveStatsPerGame = {
  pointsAllowedPerGame: number | null;
  reboundsAllowedPerGame: number | null;
  assistsAllowedPerGame: number | null;
  threesAllowedPerGame: number | null;
  fgPctAllowed: number | null;
  ftPctAllowed: number | null;
};

type TeamDefenseAggRow = {
  team_code: string | null;
  games: number | null;
  opp_points: Prisma.Decimal | number | string | null;
  opp_rebounds: Prisma.Decimal | number | string | null;
  opp_assists: Prisma.Decimal | number | string | null;
  opp_threes: Prisma.Decimal | number | string | null;
  opp_fgm: Prisma.Decimal | number | string | null;
  opp_fga: Prisma.Decimal | number | string | null;
  opp_ftm: Prisma.Decimal | number | string | null;
  opp_fta: Prisma.Decimal | number | string | null;
};

// Maps v2 team code → v1 team ID (for backward compatibility with front-end)
const V1_ID_BY_CODE: Record<string, number> = {
  ATL: 132, BOS: 133, BKN: 134, CHA: 135, CHI: 136, CLE: 137, DET: 140,
  IND: 143, MIA: 147, MIL: 148, NYK: 151, ORL: 153, PHI: 154, TOR: 159, WAS: 161,
  DAL: 138, DEN: 139, GSW: 141, HOU: 142, LAC: 144, LAL: 145, MEM: 146,
  MIN: 149, NOP: 150, OKC: 152, PHX: 155, POR: 156, SAC: 157, SAS: 158, UTA: 160,
};
const V1_TEAM_ID_SET = new Set<number>(Object.values(V1_ID_BY_CODE));
const FINISHED_GAME_STATUSES = ["FT", "AOT", "AET", "AWD", "WO", "3"] as const;

const memoryCache = new Map<string, { ts: number; payload: NbaStandingsPayload }>();

function normalizeSeason(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return value;
  return String(year);
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toFiniteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildSeasonAliases(input: string): string[] {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  const year = raw.match(/(\d{4})/)?.[1] ?? null;
  const span = year ? `${year}-${Number(year) + 1}` : null;
  return Array.from(new Set([raw, year, span].filter(Boolean) as string[]));
}

function toConferenceV2(confName: string | null | undefined): NbaStandingConference {
  const normalized = String(confName ?? "").toLowerCase();
  if (normalized === "east") return "East";
  if (normalized === "west") return "West";
  return "N/A";
}

function resolveStableLogo(teamId: number, fallbackLogo: string | null | undefined): string | null {
  if (V1_TEAM_ID_SET.has(teamId)) {
    return `https://media.api-sports.io/basketball/teams/${teamId}.png`;
  }
  return fallbackLogo ?? null;
}

function buildFormFromV2Streak(
  streakRaw: unknown,
  winStreakRaw: unknown,
): string | null {
  const streakNum = toNumber(streakRaw, NaN);
  if (Number.isFinite(streakNum) && streakNum > 0 && typeof winStreakRaw === "boolean") {
    const count = Math.max(1, Math.min(20, Math.round(streakNum)));
    return (winStreakRaw ? "W" : "L").repeat(count);
  }

  const streakText = String(streakRaw ?? "").trim().toUpperCase();
  const wlCountMatch = streakText.match(/^([WL])\s*(\d{1,2})$/);
  if (wlCountMatch) {
    const count = Math.max(1, Math.min(20, Number(wlCountMatch[2])));
    return wlCountMatch[1].repeat(count);
  }

  const compact = streakText.replace(/[^WL]/g, "");
  return compact || null;
}

async function fetchTeamStatsPerGameV2(teamV2Id: number, season: string): Promise<TeamStatsPerGame | null> {
  const url = new URL("/teams/statistics", API_BASE);
  url.searchParams.set("id", String(teamV2Id));
  url.searchParams.set("season", season);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY! },
      cache: "no-store",
    });
    if (!res.ok) {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 120));
      continue;
    }

    const json = await res.json();
    const payload = json?.response?.[0] ?? null;
    const games = toNumber(payload?.games, NaN);
    const points = toNumber(payload?.points, NaN);
    const plusMinus = toNumber(payload?.plusMinus, NaN);
    if (!Number.isFinite(games) || games <= 0 || !Number.isFinite(points)) return null;

    const toPerGame = (raw: unknown): number | null => {
      const n = toNumber(raw, NaN);
      if (!Number.isFinite(n)) return null;
      return n / games;
    };
    const toPct = (raw: unknown): number | null => {
      const n = toNumber(raw, NaN);
      return Number.isFinite(n) ? n : null;
    };

    const pointsForPerGame = points / games;
    const pointDiffPerGame = Number.isFinite(plusMinus) ? plusMinus / games : null;
    const pointsAgainstPerGame =
      pointDiffPerGame !== null ? pointsForPerGame - pointDiffPerGame : null;
    return {
      pointsForPerGame,
      pointsAgainstPerGame,
      reboundsPerGame: toPerGame(payload?.totReb),
      assistsPerGame: toPerGame(payload?.assists),
      threesMadePerGame: toPerGame(payload?.tpm),
      turnoversPerGame: toPerGame(payload?.turnovers),
      stealsPerGame: toPerGame(payload?.steals),
      blocksPerGame: toPerGame(payload?.blocks),
      fgPct: toPct(payload?.fgp),
      tpPct: toPct(payload?.tpp),
      ftPct: toPct(payload?.ftp),
    };
  }

  return null;
}

async function fetchV2StatsByTeamId(
  v2TeamIds: number[],
  season: string,
): Promise<Map<number, TeamStatsPerGame>> {
  const ids = Array.from(new Set(v2TeamIds.filter((id) => Number.isFinite(id) && id > 0)));
  const out = new Map<number, TeamStatsPerGame>();
  for (const id of ids) {
    try {
      const stats = await fetchTeamStatsPerGameV2(id, season);
      if (stats) out.set(id, stats);
    } catch {
      // Keep standings available even if one team stats call fails.
    }
    // Avoid upstream burst limits.
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return out;
}

async function fetchDefensiveStatsByTeamCodeFromLogs(
  seasonInput: string,
): Promise<Map<string, TeamDefensiveStatsPerGame>> {
  const aliases = buildSeasonAliases(seasonInput);
  if (!aliases.length) return new Map();

  const rows = await prisma.$queryRaw<TeamDefenseAggRow[]>(
    Prisma.sql`
      select
        upper(opponent_team_code) as team_code,
        count(distinct game_id)::int as games,
        sum(coalesce(points, 0)) as opp_points,
        sum(coalesce(rebounds, 0)) as opp_rebounds,
        sum(coalesce(assists, 0)) as opp_assists,
        sum(coalesce(three_points_made, 0)) as opp_threes,
        sum(coalesce(field_goals_made, 0)) as opp_fgm,
        sum(coalesce(field_goals_attempted, 0)) as opp_fga,
        sum(coalesce(free_throws_made, 0)) as opp_ftm,
        sum(coalesce(free_throws_attempted, 0)) as opp_fta
      from nba_player_game_logs
      where season in (${Prisma.join(aliases.map((a) => Prisma.sql`${a}`))})
        and coalesce(is_preseason, false) = false
        and opponent_team_code is not null
        and btrim(opponent_team_code) <> ''
        and (status_short is null or upper(status_short) in (${Prisma.join(FINISHED_GAME_STATUSES.map((s) => Prisma.sql`${s}`))}))
      group by upper(opponent_team_code)
    `,
  );

  const out = new Map<string, TeamDefensiveStatsPerGame>();
  for (const row of rows) {
    const code = String(row.team_code ?? "").trim().toUpperCase();
    const games = Number(row.games ?? 0);
    if (!code || !Number.isFinite(games) || games <= 0) continue;

    const oppPoints = toFiniteOrNull(row.opp_points);
    const oppReb = toFiniteOrNull(row.opp_rebounds);
    const oppAst = toFiniteOrNull(row.opp_assists);
    const oppThrees = toFiniteOrNull(row.opp_threes);
    const oppFgm = toFiniteOrNull(row.opp_fgm);
    const oppFga = toFiniteOrNull(row.opp_fga);
    const oppFtm = toFiniteOrNull(row.opp_ftm);
    const oppFta = toFiniteOrNull(row.opp_fta);

    out.set(code, {
      pointsAllowedPerGame: oppPoints !== null ? oppPoints / games : null,
      reboundsAllowedPerGame: oppReb !== null ? oppReb / games : null,
      assistsAllowedPerGame: oppAst !== null ? oppAst / games : null,
      threesAllowedPerGame: oppThrees !== null ? oppThrees / games : null,
      fgPctAllowed:
        oppFga !== null && oppFga > 0 && oppFgm !== null
          ? (oppFgm / oppFga) * 100
          : null,
      ftPctAllowed:
        oppFta !== null && oppFta > 0 && oppFtm !== null
          ? (oppFtm / oppFta) * 100
          : null,
    });
  }

  return out;
}

function parseRowsV2(json: unknown): ParsedRowsV2 {
  const payload = json as { response?: unknown };
  const items = Array.isArray(payload?.response) ? payload.response : [];
  const conferenceOrder: Record<NbaStandingConference, number> = { East: 0, West: 1, "N/A": 2 };
  const v2TeamIdByInternalId = new Map<number, number>();

  const rows = (items as ApiStandingItemV2[])
    .filter(Boolean)
    .map((row) => {
      const code = String(row.team?.code ?? "").toUpperCase();
      const v2TeamId = toNumber(row.team?.id, NaN);
      const teamId = V1_ID_BY_CODE[code] ?? toNumber(row.team?.id);
      if (Number.isFinite(v2TeamId) && Number.isFinite(teamId) && teamId > 0) {
        v2TeamIdByInternalId.set(teamId, v2TeamId);
      }
      const wins = toNumber(row.win?.total);
      const losses = toNumber(row.loss?.total);
      const games = wins + losses;
      const winPctRaw = toNumber(row.win?.percentage, NaN);
      const winPct = Number.isFinite(winPctRaw) && winPctRaw > 0 ? winPctRaw : games > 0 ? wins / games : 0;
      const conference = toConferenceV2(row.conference?.name);
      const position = toNumber(row.conference?.rank, NaN);
      return {
        teamId,
        code: code || null,
        name: String(row.team?.name ?? "Team"),
        logo: resolveStableLogo(teamId, row.team?.logo),
        conference,
        position: Number.isFinite(position) ? position : null,
        overallRank: 0,
        wins,
        losses,
        games,
        winPct,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        pointsAllowedPerGame: null,
        reboundsPerGame: null,
        assistsPerGame: null,
        threesMadePerGame: null,
        turnoversPerGame: null,
        stealsPerGame: null,
        blocksPerGame: null,
        fgPct: null,
        tpPct: null,
        ftPct: null,
        reboundsAllowedPerGame: null,
        assistsAllowedPerGame: null,
        threesAllowedPerGame: null,
        fgPctAllowed: null,
        ftPctAllowed: null,
        form: buildFormFromV2Streak(row.streak, row.winStreak),
        description: null,
      } as NbaStandingRow;
    })
    .sort((a, b) => {
      const confDiff = conferenceOrder[a.conference] - conferenceOrder[b.conference];
      if (confDiff !== 0) return confDiff;
      const posA = a.position ?? Number.MAX_SAFE_INTEGER;
      const posB = b.position ?? Number.MAX_SAFE_INTEGER;
      if (posA !== posB) return posA - posB;
      return b.winPct - a.winPct;
    })
    .map((row, index) => ({ ...row, overallRank: index + 1 }));

  return { rows, v2TeamIdByInternalId };
}

function extractQuotaErrorMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;
  const message = (errors as { requests?: unknown }).requests;
  if (typeof message !== "string") return null;
  const normalized = message.toLowerCase();
  if (normalized.includes("request limit")) return message;
  if (normalized.includes("reached the request limit")) return message;
  return null;
}

export async function GET(req: NextRequest) {
  const seasonParam = req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON;
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const season = normalizeSeason(seasonParam);
  const cacheKey = `season:${season}`;
  const cached = memoryCache.get(cacheKey);
  const cachedCount = cached ? Number(cached.payload?.count ?? 0) : 0;
  if (
    !forceRefresh &&
    cached &&
    Date.now() - cached.ts < CACHE_TTL_MS &&
    cachedCount > 0
  ) {
    return NextResponse.json(cached.payload, { status: 200 });
  }

  if (!API_BASE || !API_KEY) {
    return NextResponse.json({ error: "Missing API config" }, { status: 500 });
  }

  try {
    const url = new URL("/standings", API_BASE);
    url.searchParams.set("league", "standard");
    url.searchParams.set("season", season);
    const res = await fetch(url.toString(), {
      headers: { "x-apisports-key": API_KEY },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream standings error", status: res.status, body },
        { status: 502 },
      );
    }

    const json = await res.json();
    const quotaError = extractQuotaErrorMessage(
      (json as { errors?: unknown } | null)?.errors,
    );
    if (quotaError) {
      if (cached && cachedCount > 0) {
        return NextResponse.json(
          {
            ...cached.payload,
            stale: true,
            staleReason: "quota_limit",
            upstreamError: quotaError,
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        {
          error: "Upstream quota reached",
          season,
          upstreamError: quotaError,
        },
        { status: 429 },
      );
    }

    const parsed = parseRowsV2(json);
    let rows = parsed.rows;

    const statsByV2Id = await fetchV2StatsByTeamId(
      Array.from(parsed.v2TeamIdByInternalId.values()),
      season,
    );
    const defenseByCode = await fetchDefensiveStatsByTeamCodeFromLogs(season);
    rows = rows.map((row) => {
      const v2TeamId = parsed.v2TeamIdByInternalId.get(row.teamId);
      const stats = v2TeamId ? statsByV2Id.get(v2TeamId) : null;
      const defense =
        row.code && defenseByCode.has(String(row.code).toUpperCase())
          ? defenseByCode.get(String(row.code).toUpperCase()) ?? null
          : null;

      if (!stats && !defense) return row;

      const pointsFor = stats?.pointsForPerGame !== null && stats?.pointsForPerGame !== undefined
        ? stats.pointsForPerGame * row.games
        : row.pointsFor;
      const pointsAgainst = stats?.pointsAgainstPerGame !== null && stats?.pointsAgainstPerGame !== undefined
        ? stats.pointsAgainstPerGame * row.games
        : row.pointsAgainst;
      const pointsAllowedPerGame =
        defense?.pointsAllowedPerGame ?? (row.games > 0 ? pointsAgainst / row.games : null);
      return {
        ...row,
        pointsFor,
        pointsAgainst,
        pointDiff: pointsFor - pointsAgainst,
        pointsAllowedPerGame,
        reboundsPerGame: stats?.reboundsPerGame ?? row.reboundsPerGame,
        assistsPerGame: stats?.assistsPerGame ?? row.assistsPerGame,
        threesMadePerGame: stats?.threesMadePerGame ?? row.threesMadePerGame,
        turnoversPerGame: stats?.turnoversPerGame ?? row.turnoversPerGame,
        stealsPerGame: stats?.stealsPerGame ?? row.stealsPerGame,
        blocksPerGame: stats?.blocksPerGame ?? row.blocksPerGame,
        fgPct: stats?.fgPct ?? row.fgPct,
        tpPct: stats?.tpPct ?? row.tpPct,
        ftPct: stats?.ftPct ?? row.ftPct,
        reboundsAllowedPerGame: defense?.reboundsAllowedPerGame ?? row.reboundsAllowedPerGame,
        assistsAllowedPerGame: defense?.assistsAllowedPerGame ?? row.assistsAllowedPerGame,
        threesAllowedPerGame: defense?.threesAllowedPerGame ?? row.threesAllowedPerGame,
        fgPctAllowed: defense?.fgPctAllowed ?? row.fgPctAllowed,
        ftPctAllowed: defense?.ftPctAllowed ?? row.ftPctAllowed,
      };
    });

    const payload: NbaStandingsPayload = {
      season,
      count: rows.length,
      updatedAt: new Date().toISOString(),
      standings: rows,
    };

    memoryCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Unexpected error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
