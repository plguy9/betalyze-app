import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type {
  ParlayLegSide,
  ParlayLegV1,
  ParlayTicket,
  ParlayTicketLeg,
  ParlayTicketStatus,
} from "@/types/parlay";

const TICKETS_TABLE = "nba_parlay_tickets";
const LEGS_TABLE = "nba_parlay_legs";
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

let tablesInit: Promise<void> | null = null;

type RawTicketRow = {
  id: string;
  user_id: number | string;
  league: string | null;
  bookmaker: string | null;
  legs_count: number | string | null;
  combined_decimal: number | string | null;
  combined_american: number | string | null;
  stake: number | string | null;
  payout: number | string | null;
  profit: number | string | null;
  status: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RawLegRow = {
  id: string;
  ticket_id: string;
  user_id: number | string;
  game_id: number | string | null;
  event_date: string | null;
  player_id: number | string | null;
  player: string | null;
  team: string | null;
  opp: string | null;
  market: string | null;
  side: string | null;
  line: number | string | null;
  odds_decimal: number | string | null;
  odds_american: number | string | null;
  bookmaker: string | null;
  source: string | null;
  created_at: string | null;
};

export type CreateParlayTicketInput = {
  userId: number;
  league?: string | null;
  bookmaker?: string | null;
  legs: ParlayLegV1[];
  combinedDecimal: number;
  combinedAmerican?: number | null;
  stake?: number | null;
  payout?: number | null;
  profit?: number | null;
  status?: ParlayTicketStatus | null;
  note?: string | null;
};

function asNumber(value: unknown): number | null {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.trunc(n);
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeStatus(value: unknown): ParlayTicketStatus {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "won") return "won";
  if (raw === "lost") return "lost";
  if (raw === "void") return "void";
  return "open";
}

function normalizeSide(value: unknown): ParlayLegSide {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "under" ? "under" : "over";
}

function mapTicketRow(row: RawTicketRow): ParlayTicket {
  return {
    id: String(row.id),
    userId: asInt(row.user_id) ?? 0,
    league: String(row.league ?? "NBA"),
    bookmaker: row.bookmaker ?? null,
    legsCount: asInt(row.legs_count) ?? 0,
    combinedDecimal: asNumber(row.combined_decimal) ?? 1,
    combinedAmerican: asInt(row.combined_american),
    stake: asNumber(row.stake),
    payout: asNumber(row.payout),
    profit: asNumber(row.profit),
    status: normalizeStatus(row.status),
    note: row.note ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    legs: [],
  };
}

function mapLegRow(row: RawLegRow): ParlayTicketLeg {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    userId: asInt(row.user_id) ?? 0,
    gameId: asInt(row.game_id),
    eventDate: row.event_date,
    playerId: asInt(row.player_id),
    player: String(row.player ?? "Player"),
    team: row.team ?? null,
    opp: row.opp ?? null,
    market: String(row.market ?? "PTS"),
    side: normalizeSide(row.side),
    line: asNumber(row.line) ?? 0,
    oddsDecimal: asNumber(row.odds_decimal) ?? 1,
    oddsAmerican: asInt(row.odds_american),
    bookmaker: row.bookmaker ?? null,
    source: row.source ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function ensureParlayTables() {
  if (tablesInit) return tablesInit;
  tablesInit = (async () => {
    await prisma.$executeRawUnsafe(`
      create table if not exists ${TICKETS_TABLE} (
        id text primary key,
        user_id bigint not null,
        league text not null default 'NBA',
        bookmaker text,
        legs_count integer not null default 0,
        combined_decimal numeric not null,
        combined_american integer,
        stake numeric,
        payout numeric,
        profit numeric,
        status text not null default 'open',
        note text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
    await prisma.$executeRawUnsafe(`
      create index if not exists ${TICKETS_TABLE}_user_created_idx
      on ${TICKETS_TABLE} (user_id, created_at desc);
    `);

    await prisma.$executeRawUnsafe(`
      create table if not exists ${LEGS_TABLE} (
        id text primary key,
        ticket_id text not null references ${TICKETS_TABLE}(id) on delete cascade,
        user_id bigint not null,
        game_id bigint,
        event_date date,
        player_id bigint,
        player text not null,
        team text,
        opp text,
        market text not null,
        side text not null,
        line numeric not null,
        odds_decimal numeric not null,
        odds_american integer,
        bookmaker text,
        source text,
        created_at timestamptz not null default now()
      );
    `);
    await prisma.$executeRawUnsafe(`
      create index if not exists ${LEGS_TABLE}_ticket_idx
      on ${LEGS_TABLE} (ticket_id);
    `);
    await prisma.$executeRawUnsafe(`
      create index if not exists ${LEGS_TABLE}_user_created_idx
      on ${LEGS_TABLE} (user_id, created_at desc);
    `);
  })();
  return tablesInit;
}

export async function listNbaParlayTickets(params: {
  userId: number;
  limit?: number;
}): Promise<ParlayTicket[]> {
  await ensureParlayTables();
  const limitRaw = Number(params.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limitRaw)))
    : DEFAULT_LIMIT;

  const ticketRows = await prisma.$queryRawUnsafe<RawTicketRow[]>(
    `
      select
        id,
        user_id,
        league,
        bookmaker,
        legs_count,
        combined_decimal,
        combined_american,
        stake,
        payout,
        profit,
        status,
        note,
        created_at::text,
        updated_at::text
      from ${TICKETS_TABLE}
      where user_id = $1
      order by created_at desc
      limit $2
    `,
    params.userId,
    limit,
  );

  const tickets = ticketRows.map(mapTicketRow);
  if (!tickets.length) return tickets;

  const ids = tickets.map((ticket) => ticket.id);
  const placeholders = ids.map((_, idx) => `$${idx + 2}`).join(", ");
  const legRows = await prisma.$queryRawUnsafe<RawLegRow[]>(
    `
      select
        id,
        ticket_id,
        user_id,
        game_id,
        event_date::text,
        player_id,
        player,
        team,
        opp,
        market,
        side,
        line,
        odds_decimal,
        odds_american,
        bookmaker,
        source,
        created_at::text
      from ${LEGS_TABLE}
      where user_id = $1
        and ticket_id in (${placeholders})
      order by created_at asc
    `,
    params.userId,
    ...ids,
  );
  const legsByTicket = new Map<string, ParlayTicketLeg[]>();
  for (const row of legRows) {
    const leg = mapLegRow(row);
    const list = legsByTicket.get(leg.ticketId) ?? [];
    list.push(leg);
    legsByTicket.set(leg.ticketId, list);
  }
  return tickets.map((ticket) => ({
    ...ticket,
    legs: legsByTicket.get(ticket.id) ?? [],
  }));
}

export async function updateNbaParlayTicketStatus(params: {
  ticketId: string;
  userId: number;
  status: ParlayTicketStatus;
}): Promise<boolean> {
  await ensureParlayTables();
  try {
    const result = await prisma.$executeRawUnsafe(
      `update ${TICKETS_TABLE} set status = $1, updated_at = now() where id = $2 and user_id = $3`,
      params.status,
      params.ticketId,
      params.userId,
    );
    return Number(result) > 0;
  } catch {
    return false;
  }
}

export async function createNbaParlayTicket(input: CreateParlayTicketInput): Promise<ParlayTicket | null> {
  await ensureParlayTables();
  if (!Array.isArray(input.legs) || input.legs.length < 2) return null;
  const userId = Math.trunc(Number(input.userId));
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const combinedDecimal = Number(input.combinedDecimal);
  if (!Number.isFinite(combinedDecimal) || combinedDecimal <= 1) return null;

  const ticketId = randomUUID();
  const legs = input.legs.slice(0, 10);
  const legsCount = legs.length;
  const combinedAmerican = asInt(input.combinedAmerican);
  const stake = asNumber(input.stake);
  const payout = asNumber(input.payout);
  const profit = asNumber(input.profit);
  const status = normalizeStatus(input.status);
  const league = String(input.league ?? "NBA").trim() || "NBA";
  const bookmaker = input.bookmaker ? String(input.bookmaker).trim() : null;
  const note = input.note ? String(input.note).trim() : null;
  const nowIso = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        insert into ${TICKETS_TABLE}
          (
            id, user_id, league, bookmaker, legs_count, combined_decimal, combined_american,
            stake, payout, profit, status, note, created_at, updated_at
          )
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $13::timestamptz)
      `,
      ticketId,
      userId,
      league,
      bookmaker,
      legsCount,
      round(combinedDecimal, 4),
      combinedAmerican,
      stake,
      payout,
      profit,
      status,
      note,
      nowIso,
    );

    for (const leg of legs) {
      const legId = randomUUID();
      await tx.$executeRawUnsafe(
        `
          insert into ${LEGS_TABLE}
            (
              id, ticket_id, user_id, game_id, event_date, player_id, player,
              team, opp, market, side, line, odds_decimal, odds_american,
              bookmaker, source, created_at
            )
          values
            (
              $1, $2, $3, $4, $5::date, $6, $7,
              $8, $9, $10, $11, $12, $13, $14,
              $15, $16, $17::timestamptz
            )
        `,
        legId,
        ticketId,
        userId,
        leg.gameId,
        leg.eventDate,
        leg.playerId,
        String(leg.player),
        leg.teamCode,
        leg.opponentCode,
        String(leg.market),
        leg.side,
        round(Number(leg.line), 2),
        round(Number(leg.oddsDecimal), 4),
        leg.oddsAmerican,
        leg.bookmakerName ?? leg.bookmakerKey ?? null,
        leg.source ?? null,
        nowIso,
      );
    }
  });

  const tickets = await listNbaParlayTickets({ userId, limit: 1 });
  return tickets.find((ticket) => ticket.id === ticketId) ?? null;
}
