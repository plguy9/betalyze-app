import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNbaSeasonLabel } from "@/lib/nba/players-db";

export const maxDuration = 300;

const DEFAULT_SEASON = normalizeNbaSeasonLabel(
  process.env.APISPORTS_BASKETBALL_SEASON ??
    process.env.APISPORTS_NBA_SEASON ??
    "2025-2026",
);
const DEFAULT_TIMEZONE = "America/Toronto";
const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 16;
const DEFAULT_TIMEOUT_MS = 25000;
const FINISHED_STATUSES = new Set(["FT", "AOT", "AET", "AWD", "WO"]);

type InternalGamesPayload = {
  ok?: boolean;
  response?: Array<{
    id?: number | string | null;
    date?: string | null;
    timestamp?: number | null;
    status?: { short?: string | null; long?: string | null } | null;
    teams?: {
      home?: { id?: number | null; name?: string | null };
      away?: { id?: number | null; name?: string | null };
    } | null;
  }>;
};

type RefreshResult = {
  playerId: number;
  ok: boolean;
  games?: number;
  status?: number;
  error?: string;
};

type RosterRefreshResult = {
  attempted: boolean;
  ok: boolean;
  status: number | null;
  count: number | null;
  dbUpserted: number | null;
  error: string | null;
};

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  maxValue: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), maxValue);
}

function torontoYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYmd(ymd: string, days: number): string {
  const ts = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(ts)) return ymd;
  const next = new Date(ts + days * 24 * 60 * 60 * 1000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function refreshPlayerSummary(
  origin: string,
  season: string,
  playerId: number,
): Promise<RefreshResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const url = new URL(`/api/nba/players/${playerId}/summary`, origin);
    url.searchParams.set("season", season);
    url.searchParams.set("refresh", "1");
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { playerId, ok: false, status: res.status };
    const payload = (await res.json().catch(() => null)) as
      | { summary?: { games?: unknown[] } }
      | null;
    const games = Array.isArray(payload?.summary?.games)
      ? payload!.summary!.games!.length
      : 0;
    return { playerId, ok: true, games };
  } catch (err) {
    const abort =
      err instanceof DOMException
        ? err.name === "AbortError"
        : String(err).toLowerCase().includes("abort");
    return {
      playerId,
      ok: false,
      error: abort ? "timeout" : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function syncPlayerTeamsFromLatestLogs(
  season: string,
  playerIds: number[],
): Promise<{ updated: number }> {
  if (!playerIds.length) return { updated: 0 };

  const rows = await prisma.$queryRaw<Array<{ player_id: number }>>(
    Prisma.sql`
      with latest_logs as (
        select distinct on (l.player_id)
          l.player_id,
          l.team_id,
          l.team_code,
          l.team_name
        from nba_player_game_logs l
        where l.season = ${season}
          and l.player_id in (${Prisma.join(playerIds.map((id) => Prisma.sql`${id}`))})
          and (
            l.team_id is not null
            or nullif(trim(coalesce(l.team_code, '')), '') is not null
          )
        order by l.player_id, l.date desc nulls last, l.game_id desc
      )
      update nba_players p
      set
        team_id = ll.team_id,
        team_code = ll.team_code,
        team_name = coalesce(ll.team_name, p.team_name),
        updated_at = now(),
        source = 'logs-refresh-yesterday'
      from latest_logs ll
      where p.season = ${season}
        and p.player_id = ll.player_id
        and (
          coalesce(p.team_id, -1) is distinct from coalesce(ll.team_id, -1)
          or coalesce(p.team_code, '') is distinct from coalesce(ll.team_code, '')
          or coalesce(p.team_name, '') is distinct from coalesce(ll.team_name, '')
          or coalesce(p.source, '') is distinct from 'logs-refresh-yesterday'
        )
      returning p.player_id
    `,
  );

  return { updated: rows.length };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const season = normalizeNbaSeasonLabel(
    req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON,
  );
  const date =
    req.nextUrl.searchParams.get("date") ?? addDaysYmd(torontoYmd(), -1);
  const concurrency = parsePositiveInt(
    req.nextUrl.searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY,
  );
  const maxPlayers = parsePositiveInt(
    req.nextUrl.searchParams.get("max"),
    5000,
    5000,
  );
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const includeDetails = req.nextUrl.searchParams.get("details") === "1";
  const refreshRoster = req.nextUrl.searchParams.get("refreshRoster") !== "0";
  const startedAt = Date.now();

  try {
    const gamesUrl = new URL("/api/nba/games", req.nextUrl.origin);
    gamesUrl.searchParams.set("date", date);
    gamesUrl.searchParams.set("season", season);
    gamesUrl.searchParams.set("timezone", DEFAULT_TIMEZONE);

    const gamesRes = await fetch(gamesUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!gamesRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load games for target date",
          status: gamesRes.status,
          date,
          season,
        },
        { status: 502 },
      );
    }

    const gamesPayload = (await gamesRes.json().catch(() => null)) as
      | InternalGamesPayload
      | null;
    const games = Array.isArray(gamesPayload?.response)
      ? gamesPayload!.response!
      : [];
    const finishedGames = games.filter((g) =>
      FINISHED_STATUSES.has(String(g?.status?.short ?? "").toUpperCase()),
    );
    const gamesForScope = finishedGames.length ? finishedGames : games;

    const teamIds = new Set<number>();
    for (const game of gamesForScope) {
      const homeId = Number(game?.teams?.home?.id ?? NaN);
      const awayId = Number(game?.teams?.away?.id ?? NaN);
      if (Number.isFinite(homeId) && homeId > 0) teamIds.add(homeId);
      if (Number.isFinite(awayId) && awayId > 0) teamIds.add(awayId);
    }

    const playerIds = new Set<number>();
    if (teamIds.size > 0) {
      const ids = Array.from(teamIds.values());
      const rows = await prisma.$queryRaw<Array<{ player_id: number }>>`
        select distinct player_id
        from nba_players
        where season = ${season}
          and team_id in (${Prisma.join(ids)})
      `;
      for (const row of rows) {
        const id = Number(row.player_id);
        if (Number.isFinite(id) && id > 0) playerIds.add(id);
      }
    }

    // Fallback safety: include players already logged on target local date.
    const logRows = await prisma.$queryRaw<Array<{ player_id: number }>>`
      select distinct player_id
      from nba_player_game_logs
      where season = ${season}
        and (date at time zone ${DEFAULT_TIMEZONE})::date = ${date}::date
    `;
    for (const row of logRows) {
      const id = Number(row.player_id);
      if (Number.isFinite(id) && id > 0) playerIds.add(id);
    }

    const allPlayerIds = Array.from(playerIds.values()).slice(0, maxPlayers);
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        mode: "dry-run",
        season,
        date,
        gamesFound: games.length,
        finishedGames: finishedGames.length,
        teamsFound: teamIds.size,
        playersTargeted: allPlayerIds.length,
        refreshRoster,
        durationMs: Date.now() - startedAt,
      });
    }

    let rosterRefreshResult: RosterRefreshResult = {
      attempted: false,
      ok: true,
      status: null,
      count: null,
      dbUpserted: null,
      error: null,
    };

    if (refreshRoster) {
      rosterRefreshResult.attempted = true;
      try {
        const syncUrl = new URL("/api/nba/sync-players-v2", req.nextUrl.origin);
        const syncRes = await fetch(syncUrl.toString(), {
          cache: "no-store",
          signal: AbortSignal.timeout(120_000),
        });
        const syncJson = (await syncRes.json().catch(() => null)) as
          | { ok?: boolean; count?: number; dbUpserted?: number; error?: string }
          | null;
        rosterRefreshResult = {
          attempted: true,
          ok: Boolean(syncRes.ok && syncJson?.ok),
          status: syncRes.status,
          count:
            typeof syncJson?.count === "number" && Number.isFinite(syncJson.count)
              ? syncJson.count
              : null,
          dbUpserted:
            typeof syncJson?.dbUpserted === "number" && Number.isFinite(syncJson.dbUpserted)
              ? syncJson.dbUpserted
              : null,
          error:
            syncRes.ok && syncJson?.ok
              ? null
              : (syncJson?.error ?? `sync-players-v2 failed (${syncRes.status})`),
        };
      } catch (err) {
        rosterRefreshResult = {
          attempted: true,
          ok: false,
          status: null,
          count: null,
          dbUpserted: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    let processed = 0;
    let success = 0;
    let failed = 0;
    const failedDetails: RefreshResult[] = [];
    const successPlayerIds: number[] = [];

    for (let i = 0; i < allPlayerIds.length; i += concurrency) {
      const slice = allPlayerIds.slice(i, i + concurrency);
      const results = await Promise.all(
        slice.map((playerId) => refreshPlayerSummary(req.nextUrl.origin, season, playerId)),
      );
      processed += results.length;
      for (const result of results) {
        if (result.ok) {
          success += 1;
          successPlayerIds.push(result.playerId);
        } else {
          failed += 1;
          if (failedDetails.length < 250) failedDetails.push(result);
        }
      }
    }

    const rosterSync = await syncPlayerTeamsFromLatestLogs(season, successPlayerIds);

    const coverageRows = await prisma.$queryRaw<
      Array<{ players: number; max_date: string | null }>
    >`
      select
        count(distinct player_id)::int as players,
        max(date)::text as max_date
      from nba_player_game_logs
      where season = ${season}
    `;

    return NextResponse.json({
      ok: true,
      mode: "refresh-yesterday",
      season,
      date,
      gamesFound: games.length,
      finishedGames: finishedGames.length,
      teamsFound: teamIds.size,
      playersTargeted: allPlayerIds.length,
      processed,
      success,
      failed,
      rosterTeamsUpdated: rosterSync.updated,
      rosterRefresh: rosterRefreshResult,
      logsPlayersCoverage: Number(coverageRows[0]?.players ?? 0),
      logsMaxDate: coverageRows[0]?.max_date ?? null,
      durationMs: Date.now() - startedAt,
      details: includeDetails ? failedDetails : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        season,
        date,
      },
      { status: 500 },
    );
  }
}
