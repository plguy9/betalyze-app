import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const TABLE_NAME = "nba_bet_journal_entries";
const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 500;

export type BetJournalSide = "all" | "over" | "under";
export type BetJournalResult = "W" | "L" | "V";
export type BetJournalTone = "red" | "blue" | "green" | "purple" | "orange" | "neutral";
export type BetJournalStakeMode = "pct" | "cash";

export type BetJournalEntry = {
  id: string;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
  eventDate: string | null;
  league: string;
  player: string;
  team: string | null;
  opp: string | null;
  prop: string;
  side: BetJournalSide;
  odds: number | null;
  tag: string | null;
  edgePct: number | null;
  score: number | null;
  grade: string | null;
  result: BetJournalResult;
  stakeMode: BetJournalStakeMode;
  stakePct: number | null;
  stakeCash: number | null;
  clv: number | null;
  note: string | null;
  tone: BetJournalTone;
  bookmaker: string | null;
};

export type CreateBetJournalInput = {
  userId?: number | null;
  league?: string | null;
  player: string;
  prop: string;
  team?: string | null;
  opp?: string | null;
  side?: BetJournalSide | null;
  odds?: number | null;
  tag?: string | null;
  edgePct?: number | null;
  score?: number | null;
  grade?: string | null;
  result?: BetJournalResult | null;
  stakeMode?: BetJournalStakeMode | null;
  stakePct?: number | null;
  stakeCash?: number | null;
  clv?: number | null;
  note?: string | null;
  tone?: BetJournalTone | null;
  bookmaker?: string | null;
  eventDate?: string | null;
};

export type UpdateBetJournalInput = {
  userId: number;
  id: string;
  league?: string | null;
  player?: string | null;
  prop?: string | null;
  team?: string | null;
  opp?: string | null;
  side?: BetJournalSide | null;
  odds?: number | null;
  tag?: string | null;
  edgePct?: number | null;
  score?: number | null;
  grade?: string | null;
  result?: BetJournalResult | null;
  stakeMode?: BetJournalStakeMode | null;
  stakePct?: number | null;
  stakeCash?: number | null;
  clv?: number | null;
  note?: string | null;
  tone?: BetJournalTone | null;
  bookmaker?: string | null;
  eventDate?: string | null;
};

let tableInit: Promise<void> | null = null;
let seedInit: Promise<void> | null = null;

type RawEntry = {
  id: string;
  user_id: number | string | null;
  created_at: string | null;
  updated_at: string | null;
  event_date: string | null;
  league: string | null;
  player: string | null;
  team: string | null;
  opp: string | null;
  prop: string | null;
  side: string | null;
  odds: number | string | null;
  tag: string | null;
  edge_pct: number | string | null;
  score: number | string | null;
  grade: string | null;
  result: string | null;
  stake_mode: string | null;
  stake_pct: number | string | null;
  stake_cash: number | string | null;
  clv: number | string | null;
  note: string | null;
  tone: string | null;
  bookmaker: string | null;
};

function normalizeSide(input: string | null | undefined): BetJournalSide {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "over" || raw === "o") return "over";
  if (raw === "under" || raw === "u") return "under";
  return "all";
}

function normalizeResult(input: string | null | undefined): BetJournalResult {
  const raw = String(input ?? "").trim().toUpperCase();
  if (raw === "W") return "W";
  if (raw === "L") return "L";
  return "V";
}

function normalizeTone(input: string | null | undefined): BetJournalTone {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "red" || raw === "blue" || raw === "green" || raw === "purple" || raw === "orange") {
    return raw;
  }
  return "neutral";
}

function normalizeStakeMode(input: string | null | undefined): BetJournalStakeMode {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "cash") return "cash";
  return "pct";
}

function asNumber(input: number | string | null | undefined): number | null {
  const value = Number(input ?? NaN);
  return Number.isFinite(value) ? value : null;
}

function mapRawEntry(row: RawEntry): BetJournalEntry {
  const userIdValue = Number(row.user_id ?? NaN);
  return {
    id: String(row.id),
    userId: Number.isFinite(userIdValue) ? Math.trunc(userIdValue) : null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    eventDate: row.event_date,
    league: row.league ?? "NBA",
    player: row.player ?? "Player",
    team: row.team ?? null,
    opp: row.opp ?? null,
    prop: row.prop ?? "Prop",
    side: normalizeSide(row.side),
    odds: asNumber(row.odds),
    tag: row.tag ?? null,
    edgePct: asNumber(row.edge_pct),
    score: asNumber(row.score),
    grade: row.grade ?? null,
    result: normalizeResult(row.result),
    stakeMode: normalizeStakeMode(row.stake_mode),
    stakePct: asNumber(row.stake_pct),
    stakeCash: asNumber(row.stake_cash),
    clv: asNumber(row.clv),
    note: row.note ?? null,
    tone: normalizeTone(row.tone),
    bookmaker: row.bookmaker ?? null,
  };
}

function inferSideFromProp(prop: string): BetJournalSide {
  const normalized = prop.toLowerCase();
  if (/\s[o]\s/.test(normalized) || /\sover\b/.test(normalized)) return "over";
  if (/\s[u]\s/.test(normalized) || /\sunder\b/.test(normalized)) return "under";
  return "all";
}

const seedEntries: CreateBetJournalInput[] = [
  {
    player: "Onyeka Okongwu",
    league: "NBA",
    team: "ATL",
    opp: "PHI",
    prop: "3PT O 1.5",
    odds: 1.6,
    tag: "Opp PHI",
    edgePct: 17.5,
    score: 100,
    grade: "A+",
    result: "W",
    stakePct: 0.5,
    clv: 0.6,
    note: "Reason: matchup + minutes trend; got good CLV.",
    tone: "red",
    bookmaker: "FanDuel",
  },
  {
    player: "Jalen Johnson",
    league: "NBA",
    team: "ATL",
    opp: "PHI",
    prop: "AST O 8.5",
    odds: 1.89,
    tag: "Opp PHI",
    edgePct: 17.1,
    score: 99,
    grade: "A+",
    result: "L",
    stakePct: 0.5,
    clv: 0.2,
    note: "Reason: usage spike; missed by 1.",
    tone: "red",
    bookmaker: "FanDuel",
  },
  {
    player: "Jarace Walker",
    league: "NBA",
    team: "IND",
    opp: "WAS",
    prop: "3PT O 1.5",
    odds: 1.53,
    tag: "Opp WAS",
    edgePct: 4.6,
    score: 96,
    grade: "A+",
    result: "W",
    stakePct: 0.5,
    clv: 0.3,
    note: "Reason: clean look; line moved.",
    tone: "blue",
    bookmaker: "FanDuel",
  },
  {
    player: "Josh Giddey",
    league: "NBA",
    team: "CHI",
    opp: "TOR",
    prop: "AST O 6.5",
    odds: 2.0,
    tag: "Opp TOR",
    edgePct: 20.0,
    score: 95,
    grade: "A+",
    result: "V",
    stakePct: 0.5,
    clv: 0.0,
    note: "Voided.",
    tone: "red",
    bookmaker: "FanDuel",
  },
  {
    player: "Russell Westbrook",
    league: "NBA",
    team: "SAC",
    opp: "ORL",
    prop: "3PT O 1.5",
    odds: 1.63,
    tag: "Opp ORL",
    edgePct: 8.6,
    score: 95,
    grade: "A+",
    result: "W",
    stakePct: 0.5,
    clv: 0.4,
    note: "Reason: volume + pace.",
    tone: "purple",
    bookmaker: "FanDuel",
  },
  {
    player: "Neemias Queta",
    league: "NBA",
    team: "BOS",
    opp: "GSW",
    prop: "REB O 6.5",
    odds: 1.88,
    tag: "Opp GSW",
    edgePct: 16.8,
    score: 92,
    grade: "A+",
    result: "L",
    stakePct: 0.5,
    clv: -0.1,
    note: "Reason: rebound chances; foul trouble.",
    tone: "green",
    bookmaker: "FanDuel",
  },
];

async function ensureTable() {
  if (tableInit) return tableInit;
  tableInit = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        create table if not exists ${TABLE_NAME} (
          id text primary key,
          user_id bigint,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          event_date date,
          league text not null default 'NBA',
          player text not null,
          team text,
          opp text,
          prop text not null,
          side text not null default 'all',
          odds numeric,
          tag text,
          edge_pct numeric,
          score integer,
          grade text,
          result text not null default 'V',
          stake_mode text not null default 'pct',
          stake_pct numeric,
          stake_cash numeric,
          clv numeric,
          note text,
          tone text not null default 'neutral',
          bookmaker text
        );
      `);
      await prisma.$executeRawUnsafe(`
        alter table ${TABLE_NAME}
        add column if not exists user_id bigint;
      `);
      await prisma.$executeRawUnsafe(`
        alter table ${TABLE_NAME}
        add column if not exists stake_mode text not null default 'pct';
      `);
      await prisma.$executeRawUnsafe(`
        alter table ${TABLE_NAME}
        add column if not exists stake_cash numeric;
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists ${TABLE_NAME}_created_idx
        on ${TABLE_NAME} (created_at desc);
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists ${TABLE_NAME}_side_idx
        on ${TABLE_NAME} (side);
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists ${TABLE_NAME}_user_idx
        on ${TABLE_NAME} (user_id);
      `);
    } catch {
      // keep runtime resilient: API can still return empty payload
    }
  })();
  return tableInit;
}

async function insertEntry(input: CreateBetJournalInput): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  await ensureTable();

  const nowIso = new Date().toISOString();
  const normalizedUserId = Number(input.userId ?? NaN);
  const row = {
    id: crypto.randomUUID(),
    user_id: Number.isFinite(normalizedUserId) && normalizedUserId > 0 ? Math.trunc(normalizedUserId) : null,
    created_at: nowIso,
    updated_at: nowIso,
    event_date: input.eventDate ?? null,
    league: input.league ?? "NBA",
    player: String(input.player).trim(),
    team: input.team ?? null,
    opp: input.opp ?? null,
    prop: String(input.prop).trim(),
    side: normalizeSide(input.side ?? inferSideFromProp(input.prop)),
    odds: input.odds ?? null,
    tag: input.tag ?? null,
    edge_pct: input.edgePct ?? null,
    score: input.score ?? null,
    grade: input.grade ?? null,
    result: normalizeResult(input.result ?? "V"),
    stake_mode: normalizeStakeMode(input.stakeMode),
    stake_pct: input.stakePct ?? null,
    stake_cash: input.stakeCash ?? null,
    clv: input.clv ?? null,
    note: input.note ?? null,
    tone: normalizeTone(input.tone),
    bookmaker: input.bookmaker ?? null,
  };

  if (!row.player || !row.prop) return false;

  if (supabase) {
    const { error } = await supabase.from(TABLE_NAME).insert(row);
    if (!error) return true;
  }

  try {
    await prisma.$executeRawUnsafe(
      `
        insert into ${TABLE_NAME}
          (id, user_id, created_at, updated_at, event_date, league, player, team, opp, prop, side, odds, tag, edge_pct, score, grade, result, stake_mode, stake_pct, stake_cash, clv, note, tone, bookmaker)
        values
          ($1, $2::bigint, $3::timestamptz, $4::timestamptz, $5::date, $6, $7, $8, $9, $10, $11, $12::numeric, $13, $14::numeric, $15::int, $16, $17, $18, $19::numeric, $20::numeric, $21::numeric, $22, $23, $24)
        on conflict (id) do nothing
      `,
      row.id,
      row.user_id,
      row.created_at,
      row.updated_at,
      row.event_date,
      row.league,
      row.player,
      row.team,
      row.opp,
      row.prop,
      row.side,
      row.odds,
      row.tag,
      row.edge_pct,
      row.score,
      row.grade,
      row.result,
      row.stake_mode,
      row.stake_pct,
      row.stake_cash,
      row.clv,
      row.note,
      row.tone,
      row.bookmaker,
    );
    return true;
  } catch {
    return false;
  }
}

async function ensureSeedData() {
  if (seedInit) return seedInit;
  seedInit = (async () => {
    const supabase = getSupabaseAdmin();
    await ensureTable();

    if (supabase) {
      const { count, error } = await supabase
        .from(TABLE_NAME)
        .select("id", { count: "exact", head: true });
      if (!error && Number(count ?? 0) > 0) return;
      if (!error) {
        for (const entry of seedEntries) {
          await insertEntry(entry);
        }
        return;
      }
    }

    try {
      const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
        `select count(*)::int as count from ${TABLE_NAME}`,
      );
      if (Number(rows[0]?.count ?? 0) > 0) return;
      for (const entry of seedEntries) {
        await insertEntry(entry);
      }
    } catch {
      // ignore seeding errors
    }
  })();
  return seedInit;
}

export async function listNbaBetJournalEntries(params?: {
  userId?: number | null;
  q?: string | null;
  view?: BetJournalSide | null;
  limit?: number | null;
}): Promise<BetJournalEntry[]> {
  const supabase = getSupabaseAdmin();
  await ensureSeedData();
  const normalizedUserId = Number(params?.userId ?? NaN);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    return [];
  }
  const userId = Math.trunc(normalizedUserId);

  const rawLimit = Number(params?.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)))
    : DEFAULT_LIMIT;
  const q = String(params?.q ?? "")
    .trim()
    .toLowerCase();
  const view = normalizeSide(params?.view ?? "all");

  let rows: RawEntry[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "id, user_id, created_at, updated_at, event_date, league, player, team, opp, prop, side, odds, tag, edge_pct, score, grade, result, stake_mode, stake_pct, stake_cash, clv, note, tone, bookmaker",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_LIMIT);

    if (!error && Array.isArray(data)) {
      rows = data as RawEntry[];
    }
  }

  if (!rows.length) {
    try {
      rows = await prisma.$queryRawUnsafe<RawEntry[]>(
        `
          select
            id,
            user_id,
            created_at::text,
            updated_at::text,
            event_date::text,
            league,
            player,
            team,
            opp,
            prop,
            side,
            odds,
            tag,
            edge_pct,
            score,
            grade,
            result,
            stake_mode,
            stake_pct,
            stake_cash,
            clv,
            note,
            tone,
            bookmaker
          from ${TABLE_NAME}
          where user_id = $1
          order by created_at desc
          limit ${MAX_LIMIT}
        `,
        userId,
      );
    } catch {
      rows = [];
    }
  }

  const mapped = rows.map(mapRawEntry);
  const filtered = mapped.filter((entry) => {
    if (view !== "all" && entry.side !== view) return false;
    if (!q) return true;
    const haystack = [
      entry.id,
      entry.player,
      entry.team ?? "",
      entry.opp ?? "",
      entry.prop,
      entry.note ?? "",
      entry.bookmaker ?? "",
      entry.tag ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return filtered.slice(0, limit);
}

export async function createNbaBetJournalEntry(
  input: CreateBetJournalInput,
): Promise<BetJournalEntry | null> {
  await ensureTable();
  const normalizedUserId = Number(input.userId ?? NaN);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;
  const ok = await insertEntry(input);
  if (!ok) return null;
  const latest = await listNbaBetJournalEntries({
    userId: Math.trunc(normalizedUserId),
    limit: 1,
  });
  return latest[0] ?? null;
}

async function getNbaBetJournalEntryById(params: {
  userId: number;
  id: string;
}): Promise<BetJournalEntry | null> {
  const supabase = getSupabaseAdmin();
  const { userId } = params;
  const id = String(params.id ?? "").trim();
  if (!id) return null;

  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "id, user_id, created_at, updated_at, event_date, league, player, team, opp, prop, side, odds, tag, edge_pct, score, grade, result, stake_mode, stake_pct, stake_cash, clv, note, tone, bookmaker",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .limit(1);
    if (!error && Array.isArray(data) && data[0]) {
      return mapRawEntry(data[0] as RawEntry);
    }
  }

  try {
    const rows = await prisma.$queryRawUnsafe<RawEntry[]>(
      `
        select
          id,
          user_id,
          created_at::text,
          updated_at::text,
          event_date::text,
          league,
          player,
          team,
          opp,
          prop,
          side,
          odds,
          tag,
          edge_pct,
          score,
          grade,
          result,
          stake_mode,
          stake_pct,
          stake_cash,
          clv,
          note,
          tone,
          bookmaker
        from ${TABLE_NAME}
        where id = $1 and user_id = $2::bigint
        limit 1
      `,
      id,
      userId,
    );
    if (rows[0]) return mapRawEntry(rows[0]);
  } catch {
    return null;
  }
  return null;
}

export async function updateNbaBetJournalEntry(
  input: UpdateBetJournalInput,
): Promise<BetJournalEntry | null> {
  await ensureTable();

  const normalizedUserId = Number(input.userId ?? NaN);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;
  const userId = Math.trunc(normalizedUserId);
  const id = String(input.id ?? "").trim();
  if (!id) return null;

  const current = await getNbaBetJournalEntryById({ userId, id });
  if (!current) return null;

  const league =
    input.league === undefined ? current.league : String(input.league ?? "").trim() || "NBA";
  const player =
    input.player === undefined ? current.player : String(input.player ?? "").trim();
  const prop = input.prop === undefined ? current.prop : String(input.prop ?? "").trim();

  if (!player || !prop) return null;

  const team =
    input.team === undefined ? current.team : String(input.team ?? "").trim() || null;
  const opp = input.opp === undefined ? current.opp : String(input.opp ?? "").trim() || null;
  const side = input.side === undefined ? current.side : normalizeSide(input.side);
  const odds = input.odds === undefined ? current.odds : asNumber(input.odds);
  const tag = input.tag === undefined ? current.tag : String(input.tag ?? "").trim() || null;
  const edgePct = input.edgePct === undefined ? current.edgePct : asNumber(input.edgePct);
  const score = input.score === undefined ? current.score : asNumber(input.score);
  const grade =
    input.grade === undefined ? current.grade : String(input.grade ?? "").trim() || null;
  const result = input.result === undefined ? current.result : normalizeResult(input.result);
  const stakeMode =
    input.stakeMode === undefined ? current.stakeMode : normalizeStakeMode(input.stakeMode);
  const stakePct = input.stakePct === undefined ? current.stakePct : asNumber(input.stakePct);
  const stakeCash = input.stakeCash === undefined ? current.stakeCash : asNumber(input.stakeCash);
  const clv = input.clv === undefined ? current.clv : asNumber(input.clv);
  const note = input.note === undefined ? current.note : String(input.note ?? "").trim() || null;
  const tone = input.tone === undefined ? current.tone : normalizeTone(input.tone);
  const bookmaker =
    input.bookmaker === undefined ? current.bookmaker : String(input.bookmaker ?? "").trim() || null;
  const eventDate =
    input.eventDate === undefined ? current.eventDate : String(input.eventDate ?? "").trim() || null;
  const updatedAt = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        updated_at: updatedAt,
        event_date: eventDate,
        league,
        player,
        team,
        opp,
        prop,
        side,
        odds,
        tag,
        edge_pct: edgePct,
        score,
        grade,
        result,
        stake_mode: stakeMode,
        stake_pct: stakePct,
        stake_cash: stakeCash,
        clv,
        note,
        tone,
        bookmaker,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select(
        "id, user_id, created_at, updated_at, event_date, league, player, team, opp, prop, side, odds, tag, edge_pct, score, grade, result, stake_mode, stake_pct, stake_cash, clv, note, tone, bookmaker",
      )
      .limit(1);

    if (!error && Array.isArray(data) && data[0]) {
      return mapRawEntry(data[0] as RawEntry);
    }
  }

  try {
    await prisma.$executeRawUnsafe(
      `
        update ${TABLE_NAME}
        set
          updated_at = $1::timestamptz,
          event_date = $2::date,
          league = $3,
          player = $4,
          team = $5,
          opp = $6,
          prop = $7,
          side = $8,
          odds = $9::numeric,
          tag = $10,
          edge_pct = $11::numeric,
          score = $12::int,
          grade = $13,
          result = $14,
          stake_mode = $15,
          stake_pct = $16::numeric,
          stake_cash = $17::numeric,
          clv = $18::numeric,
          note = $19,
          tone = $20,
          bookmaker = $21
        where id = $22 and user_id = $23::bigint
      `,
      updatedAt,
      eventDate,
      league,
      player,
      team,
      opp,
      prop,
      side,
      odds,
      tag,
      edgePct,
      score,
      grade,
      result,
      stakeMode,
      stakePct,
      stakeCash,
      clv,
      note,
      tone,
      bookmaker,
      id,
      userId,
    );
  } catch {
    return null;
  }

  return getNbaBetJournalEntryById({ userId, id });
}

export async function updateNbaBetJournalEntryResult(input: {
  userId: number;
  id: string;
  result: BetJournalResult;
}): Promise<BetJournalEntry | null> {
  return updateNbaBetJournalEntry({
    userId: input.userId,
    id: input.id,
    result: input.result,
  });
}

export async function deleteNbaBetJournalEntry(input: {
  userId: number;
  id: string;
}): Promise<boolean> {
  await ensureTable();
  const normalizedUserId = Number(input.userId ?? NaN);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return false;
  const userId = Math.trunc(normalizedUserId);
  const id = String(input.id ?? "").trim();
  if (!id) return false;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .limit(1);
    if (!error && Array.isArray(data)) {
      return data.length > 0;
    }
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `
        delete from ${TABLE_NAME}
        where id = $1 and user_id = $2::bigint
        returning id
      `,
      id,
      userId,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function deleteAllNbaBetJournalEntries(input: {
  userId: number;
}): Promise<number> {
  await ensureTable();
  const normalizedUserId = Number(input.userId ?? NaN);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return 0;
  const userId = Math.trunc(normalizedUserId);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (!error && Array.isArray(data)) {
      return data.length;
    }
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `
        delete from ${TABLE_NAME}
        where user_id = $1::bigint
        returning id
      `,
      userId,
    );
    return rows.length;
  } catch {
    return 0;
  }
}
