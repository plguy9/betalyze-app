import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  nbaSeasonAliases,
  normalizeNbaSeasonLabel,
  readNbaPlayerIdsFromDb,
} from "@/lib/nba/players-db";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_SEASON = normalizeNbaSeasonLabel(
  process.env.APISPORTS_BASKETBALL_SEASON ??
  process.env.APISPORTS_NBA_SEASON ??
  "2025-2026",
);
const MAX_LIMIT = 30;
const MAX_CHUNK = 100;
const DEFAULT_CONCURRENCY = 6;
const MAX_CONCURRENCY = 12;
const PLAYER_REFRESH_TIMEOUT_MS = 25_000;

type CachedPlayersFile = {
  season?: string;
  players?: Array<{ id?: number | string | null }>;
};

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? 10);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function parseChunk(raw: string | null): number {
  const n = Number(raw ?? MAX_LIMIT);
  if (!Number.isFinite(n) || n <= 0) return MAX_LIMIT;
  return Math.min(MAX_CHUNK, Math.floor(n));
}

function parseConcurrency(raw: string | null): number {
  const n = Number(raw ?? DEFAULT_CONCURRENCY);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.floor(n));
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function loadPlayerIdsFromCache(season: string): Promise<number[]> {
  const files = await fs.readdir(DATA_DIR).catch(() => []);
  const aliases = nbaSeasonAliases(season).map((s) => s.replace(/[^0-9]/g, ""));

  const candidates = files
    .filter((f) => /^nba-players-.*\.json$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const preferred = candidates.filter((file) =>
    aliases.some((alias) => alias && file.includes(alias)),
  );
  const target = (preferred.length ? preferred : candidates).at(-1);
  if (!target) return [];

  const fullPath = path.join(DATA_DIR, target);
  const raw = await fs.readFile(fullPath, "utf8");
  const parsed = JSON.parse(raw) as CachedPlayersFile;
  const ids = new Set<number>();
  for (const p of parsed.players ?? []) {
    const id = Number(p?.id ?? NaN);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return Array.from(ids.values());
}

async function loadPlayerIds(season: string): Promise<{
  ids: number[];
  source: "db" | "file" | "none";
}> {
  const dbIds = await readNbaPlayerIdsFromDb(season).catch(() => []);
  if (dbIds.length) return { ids: dbIds, source: "db" };
  const fileIds = await loadPlayerIdsFromCache(season).catch(() => []);
  if (fileIds.length) return { ids: fileIds, source: "file" };
  return { ids: [], source: "none" };
}

type ProcessedPlayerResult = {
  playerId: number;
  ok: boolean;
  games?: number;
  status?: number;
  error?: string;
};

async function refreshPlayerSummary(
  origin: string,
  season: string,
  playerId: number,
): Promise<ProcessedPlayerResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLAYER_REFRESH_TIMEOUT_MS);
  try {
    const url = new URL(`/api/nba/players/${playerId}/summary`, origin);
    url.searchParams.set("season", season);
    url.searchParams.set("refresh", "1");

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      return { playerId, ok: false, status: res.status };
    }
    const payload = (await res.json().catch(() => null)) as
      | { summary?: { games?: unknown[] } }
      | null;
    const games = Array.isArray(payload?.summary?.games)
      ? payload!.summary!.games!.length
      : 0;
    return { playerId, ok: true, games };
  } catch (err) {
    const isAbortError =
      err instanceof DOMException
        ? err.name === "AbortError"
        : String(err).toLowerCase().includes("abort");
    return {
      playerId,
      ok: false,
      error: isAbortError ? "timeout" : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const season = normalizeNbaSeasonLabel(
    req.nextUrl.searchParams.get("season") ?? DEFAULT_SEASON,
  );
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const chunk = parseChunk(req.nextUrl.searchParams.get("chunk"));
  const concurrency = parseConcurrency(req.nextUrl.searchParams.get("concurrency"));
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  const force = req.nextUrl.searchParams.get("force") === "1";
  const runAll = req.nextUrl.searchParams.get("all") === "1";
  const includeDetails = req.nextUrl.searchParams.get("details") === "1";

  try {
    const startedAt = Date.now();
    const { ids: allPlayerIds, source: playerSource } = await loadPlayerIds(season);
    if (!allPlayerIds.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No players found in DB/file. Run /api/nba/sync-players-v2 first.",
        },
        { status: 400 },
      );
    }

    const existingRows = await prisma.$queryRaw<{ player_id: number }[]>`
      select distinct player_id
      from nba_player_game_logs
      where season = ${season}
    `;
    const existing = new Set(existingRows.map((r) => Number(r.player_id)));

    const sourceIds = force
      ? allPlayerIds
      : allPlayerIds.filter((id) => !existing.has(id));
    const batch = sourceIds.slice(offset, offset + limit);

    if (runAll) {
      let cursor = offset;
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalFailed = 0;
      const failedDetails: ProcessedPlayerResult[] = [];
      const batchSummaries: Array<{
        offset: number;
        size: number;
        success: number;
        failed: number;
      }> = [];

      while (cursor < sourceIds.length) {
        const currentBatch = sourceIds.slice(cursor, cursor + chunk);
        let batchSuccess = 0;
        let batchFailed = 0;

        for (let i = 0; i < currentBatch.length; i += concurrency) {
          const slice = currentBatch.slice(i, i + concurrency);
          const results = await Promise.all(
            slice.map((playerId) => refreshPlayerSummary(req.nextUrl.origin, season, playerId)),
          );
          totalProcessed += results.length;
          for (const result of results) {
            if (result.ok) {
              totalSuccess += 1;
              batchSuccess += 1;
            } else {
              totalFailed += 1;
              batchFailed += 1;
              if (failedDetails.length < 300) failedDetails.push(result);
            }
          }
        }

        batchSummaries.push({
          offset: cursor,
          size: currentBatch.length,
          success: batchSuccess,
          failed: batchFailed,
        });
        cursor += currentBatch.length;
      }

      const savedCountAll = await prisma.$queryRaw<{ count: number }[]>`
        select count(*)::int as count
        from nba_player_game_logs
        where season = ${season}
      `;

      return NextResponse.json({
        ok: true,
        mode: "all",
        season,
        force,
        totalPlayersInCache: allPlayerIds.length,
        playerSource,
        playersAlreadyWithLogs: existing.size,
        candidates: sourceIds.length,
        processed: totalProcessed,
        success: totalSuccess,
        failed: totalFailed,
        offsetStart: offset,
        chunk,
        concurrency,
        batches: batchSummaries.length,
        batchSummaries,
        rowsInDbForSeason: savedCountAll[0]?.count ?? 0,
        durationMs: Date.now() - startedAt,
        failedDetails,
      });
    }

    const processed: ProcessedPlayerResult[] = [];
    for (const playerId of batch) {
      processed.push(await refreshPlayerSummary(req.nextUrl.origin, season, playerId));
    }

    const savedCount = await prisma.$queryRaw<{ count: number }[]>`
      select count(*)::int as count
      from nba_player_game_logs
      where season = ${season}
    `;

    return NextResponse.json({
      ok: true,
      mode: "batch",
      season,
      force,
      totalPlayersInCache: allPlayerIds.length,
      playerSource,
      playersAlreadyWithLogs: existing.size,
      candidates: sourceIds.length,
      processed: batch.length,
      success: processed.filter((p) => p.ok).length,
      failed: processed.filter((p) => !p.ok).length,
      offset,
      limit,
      nextOffset: offset + batch.length < sourceIds.length ? offset + batch.length : null,
      rowsInDbForSeason: savedCount[0]?.count ?? 0,
      details: includeDetails ? processed : undefined,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
