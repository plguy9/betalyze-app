import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const TABLE_NAME = "nba_top_props_daily_cache";

type CachePayload = Record<string, unknown>;

export type NbaTopPropsDailyCache = {
  cacheKey: string;
  dateKey: string;
  gameId: number | null;
  timezone: string;
  season: string | null;
  generatedAt: string | null;
  updatedAt: string | null;
  updatedAtMs: number | null;
  payload: CachePayload;
  propsCount: number;
  source: string | null;
};

let tableInit: Promise<void> | null = null;

function buildCacheKey(params: {
  dateKey: string;
  gameId?: number | null;
  timezone?: string;
}) {
  const tz = String(params.timezone ?? "America/Toronto").trim() || "America/Toronto";
  const gamePart =
    typeof params.gameId === "number" && Number.isFinite(params.gameId)
      ? String(Math.trunc(params.gameId))
      : "all";
  return `${params.dateKey}:${gamePart}:${tz}`;
}

async function ensureCacheTable() {
  if (tableInit) return tableInit;
  tableInit = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        create table if not exists ${TABLE_NAME} (
          cache_key text primary key,
          date_key text not null,
          game_id integer,
          timezone text not null default 'America/Toronto',
          season text,
          generated_at timestamptz,
          payload jsonb not null default '{}'::jsonb,
          props_count integer not null default 0,
          source text not null default 'computed',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists ${TABLE_NAME}_date_idx
          on ${TABLE_NAME} (date_key, updated_at desc);
      `);
    } catch {
      // Table creation failure should not crash API routes.
    }
  })();
  return tableInit;
}

export async function readNbaTopPropsDailyCache(params: {
  dateKey: string;
  gameId?: number | null;
  timezone?: string;
}): Promise<NbaTopPropsDailyCache | null> {
  const supabase = getSupabaseAdmin();
  await ensureCacheTable();

  const cacheKey = buildCacheKey(params);
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "cache_key, date_key, game_id, timezone, season, generated_at, updated_at, payload, props_count, source",
      )
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (!error && data) {
      const payload =
        data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
          ? (data.payload as CachePayload)
          : {};
      const updatedAt = typeof data.updated_at === "string" ? data.updated_at : null;
      const updatedAtMs = updatedAt ? Date.parse(updatedAt) : null;
      return {
        cacheKey: String(data.cache_key ?? cacheKey),
        dateKey: String(data.date_key ?? params.dateKey),
        gameId: Number.isFinite(Number(data.game_id ?? NaN)) ? Number(data.game_id) : null,
        timezone:
          typeof data.timezone === "string" && data.timezone.trim().length > 0
            ? data.timezone
            : "America/Toronto",
        season: typeof data.season === "string" ? data.season : null,
        generatedAt:
          typeof data.generated_at === "string" ? data.generated_at : null,
        updatedAt,
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
        payload,
        propsCount: Number(data.props_count ?? 0) || 0,
        source: typeof data.source === "string" ? data.source : null,
      };
    }
  }

  type Row = {
    cache_key: string;
    date_key: string;
    game_id: number | null;
    timezone: string | null;
    season: string | null;
    generated_at: string | null;
    updated_at: string | null;
    payload: unknown;
    props_count: number | null;
    source: string | null;
  };

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `
      select
        cache_key,
        date_key,
        game_id,
        timezone,
        season,
        generated_at::text,
        updated_at::text,
        payload,
        props_count,
        source
      from ${TABLE_NAME}
      where cache_key = $1
      limit 1
    `,
    cacheKey,
  );
  const data = rows[0];
  if (!data) return null;

  const payload =
    data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
      ? (data.payload as CachePayload)
      : {};
  const updatedAt = typeof data.updated_at === "string" ? data.updated_at : null;
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : null;

  return {
    cacheKey: String(data.cache_key ?? cacheKey),
    dateKey: String(data.date_key ?? params.dateKey),
    gameId: Number.isFinite(Number(data.game_id ?? NaN)) ? Number(data.game_id) : null,
    timezone:
      typeof data.timezone === "string" && data.timezone.trim().length > 0
        ? data.timezone
        : "America/Toronto",
    season: typeof data.season === "string" ? data.season : null,
    generatedAt: typeof data.generated_at === "string" ? data.generated_at : null,
    updatedAt,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
    payload,
    propsCount: Number(data.props_count ?? 0) || 0,
    source: typeof data.source === "string" ? data.source : null,
  };
}

export async function writeNbaTopPropsDailyCache(params: {
  dateKey: string;
  gameId?: number | null;
  timezone?: string;
  season?: string | null;
  generatedAt?: string | null;
  payload: CachePayload;
  source?: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  await ensureCacheTable();

  const cacheKey = buildCacheKey(params);
  const nowIso = new Date().toISOString();
  const timezone = String(params.timezone ?? "America/Toronto").trim() || "America/Toronto";
  const gameId =
    typeof params.gameId === "number" && Number.isFinite(params.gameId)
      ? Math.trunc(params.gameId)
      : null;
  const propsCount = Array.isArray(params.payload.props) ? params.payload.props.length : 0;
  const generatedAt =
    typeof params.generatedAt === "string" && params.generatedAt.trim().length > 0
      ? params.generatedAt
      : null;

  if (supabase) {
    const payload = {
      cache_key: cacheKey,
      date_key: params.dateKey,
      game_id: gameId,
      timezone,
      season: params.season ?? null,
      generated_at: generatedAt,
      payload: params.payload,
      props_count: propsCount,
      source: params.source ?? "computed",
      updated_at: nowIso,
    };
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: "cache_key" });
    if (!error) return true;
  }

  try {
    await prisma.$executeRawUnsafe(
      `
        insert into ${TABLE_NAME}
          (cache_key, date_key, game_id, timezone, season, generated_at, payload, props_count, source, updated_at)
        values
          ($1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb, $8, $9, $10::timestamptz)
        on conflict (cache_key) do update
          set date_key = excluded.date_key,
              game_id = excluded.game_id,
              timezone = excluded.timezone,
              season = excluded.season,
              generated_at = excluded.generated_at,
              payload = excluded.payload,
              props_count = excluded.props_count,
              source = excluded.source,
              updated_at = excluded.updated_at
      `,
      cacheKey,
      params.dateKey,
      gameId,
      timezone,
      params.season ?? null,
      generatedAt,
      JSON.stringify(params.payload),
      propsCount,
      params.source ?? "computed",
      nowIso,
    );
    return true;
  } catch {
    return false;
  }
}
