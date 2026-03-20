import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const TABLE_NAME = "nba_odds_events_cache";

type CacheEvent = Record<string, unknown>;

export type NbaOddsDailyCache = {
  dateKey: string;
  startsAfter: string | null;
  startsBefore: string | null;
  updatedAt: string | null;
  updatedAtMs: number | null;
  events: CacheEvent[];
  eventsCount: number;
  source: string | null;
};

let tableInit: Promise<void> | null = null;

async function ensureCacheTable() {
  if (tableInit) return tableInit;
  tableInit = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        create table if not exists ${TABLE_NAME} (
          date_key text primary key,
          league text not null default 'NBA',
          starts_after timestamptz,
          starts_before timestamptz,
          events jsonb not null default '[]'::jsonb,
          events_count integer not null default 0,
          source text not null default 'sportsgameodds',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists ${TABLE_NAME}_updated_idx
          on ${TABLE_NAME} (updated_at desc);
      `);
    } catch {
      // If table setup fails we still allow runtime fallback to file cache.
    }
  })();
  return tableInit;
}

export async function readNbaOddsDailyCache(
  dateKey: string,
): Promise<NbaOddsDailyCache | null> {
  const supabase = getSupabaseAdmin();
  await ensureCacheTable();

  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "date_key, starts_after, starts_before, updated_at, events, events_count, source",
      )
      .eq("date_key", dateKey)
      .maybeSingle();

    if (!error && data) {
      const rawEvents = Array.isArray(data.events)
        ? (data.events as unknown[])
        : [];
      const events = rawEvents.filter(
        (item): item is CacheEvent =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      );
      const updatedAt =
        typeof data.updated_at === "string" ? data.updated_at : null;
      const updatedAtMs = updatedAt ? Date.parse(updatedAt) : null;
      return {
        dateKey: String(data.date_key ?? dateKey),
        startsAfter:
          typeof data.starts_after === "string" ? data.starts_after : null,
        startsBefore:
          typeof data.starts_before === "string" ? data.starts_before : null,
        updatedAt,
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
        events,
        eventsCount: Number(data.events_count ?? events.length) || events.length,
        source: typeof data.source === "string" ? data.source : null,
      };
    }
  }

  type Row = {
    date_key: string;
    starts_after: string | null;
    starts_before: string | null;
    updated_at: string | null;
    events: unknown;
    events_count: number | null;
    source: string | null;
  };
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `
      select
        date_key,
        starts_after::text,
        starts_before::text,
        updated_at::text,
        events,
        events_count,
        source
      from ${TABLE_NAME}
      where date_key = $1
      limit 1
    `,
    dateKey,
  );
  const data = rows[0];
  if (!data) return null;

  const rawEvents = Array.isArray(data.events) ? data.events : [];
  const events = rawEvents.filter(
    (item): item is CacheEvent =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );
  const updatedAt = typeof data.updated_at === "string" ? data.updated_at : null;
  const updatedAtMs = updatedAt ? Date.parse(updatedAt) : null;

  return {
    dateKey: String(data.date_key ?? dateKey),
    startsAfter: typeof data.starts_after === "string" ? data.starts_after : null,
    startsBefore: typeof data.starts_before === "string" ? data.starts_before : null,
    updatedAt,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : null,
    events,
    eventsCount: Number(data.events_count ?? events.length) || events.length,
    source: typeof data.source === "string" ? data.source : null,
  };
}

export async function writeNbaOddsDailyCache(params: {
  dateKey: string;
  startsAfter?: string | null;
  startsBefore?: string | null;
  events: CacheEvent[];
  source?: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  await ensureCacheTable();

  const nowIso = new Date().toISOString();
  if (supabase) {
    const payload = {
      date_key: params.dateKey,
      league: "NBA",
      starts_after: params.startsAfter ?? null,
      starts_before: params.startsBefore ?? null,
      events: params.events,
      events_count: params.events.length,
      source: params.source ?? "sportsgameodds",
      updated_at: nowIso,
    };
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: "date_key" });
    if (!error) return true;
  }

  try {
    await prisma.$executeRawUnsafe(
      `
        insert into ${TABLE_NAME}
          (date_key, league, starts_after, starts_before, events, events_count, source, updated_at)
        values
          ($1, 'NBA', $2::timestamptz, $3::timestamptz, $4::jsonb, $5, $6, $7::timestamptz)
        on conflict (date_key) do update
          set starts_after = excluded.starts_after,
              starts_before = excluded.starts_before,
              events = excluded.events,
              events_count = excluded.events_count,
              source = excluded.source,
              updated_at = excluded.updated_at
      `,
      params.dateKey,
      params.startsAfter ?? null,
      params.startsBefore ?? null,
      JSON.stringify(params.events),
      params.events.length,
      params.source ?? "sportsgameodds",
      nowIso,
    );
    return true;
  } catch {
    return false;
  }
}

export async function purgeNbaOddsDailyCacheExcept(
  dateKeyOrKeys: string | string[],
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await ensureCacheTable();
  const keepKeys = Array.isArray(dateKeyOrKeys)
    ? dateKeyOrKeys.filter(Boolean)
    : [dateKeyOrKeys].filter(Boolean);

  if (supabase) {
    const query = supabase.from(TABLE_NAME).delete();
    if (keepKeys.length <= 1) {
      await query.neq("date_key", keepKeys[0] ?? "__none__");
      return;
    }
    const inFilter = `(${keepKeys.map((key) => `"${key}"`).join(",")})`;
    await query.not("date_key", "in", inFilter);
    return;
  }

  try {
    if (!keepKeys.length) {
      await prisma.$executeRawUnsafe(`
        delete from ${TABLE_NAME}
      `);
      return;
    }
    const placeholders = keepKeys.map((_, idx) => `$${idx + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `
        delete from ${TABLE_NAME}
        where date_key not in (${placeholders})
      `,
      ...keepKeys,
    );
  } catch {
    // ignore cleanup failures; cache write remains valid
  }
}
