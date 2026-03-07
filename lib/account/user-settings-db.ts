import { prisma } from "@/lib/prisma";

const TABLE_NAME = "app_user_settings";
const DEFAULT_BOOKMAKER = "fanduel";
const DEFAULT_ODDS_FORMAT = "decimal";
const DEFAULT_STAKE_MODE = "pct";
const DEFAULT_STAKE_PCT = 0.5;
const DEFAULT_STAKE_CASH = 10;
const DEFAULT_TIMEZONE = "America/Toronto";
const DEFAULT_JOURNAL_BALANCE = 5000;

export type OddsFormat = "decimal" | "american";
export type StakeMode = "pct" | "cash";

export type AppUserSettings = {
  userId: number;
  defaultBookmaker: string;
  oddsFormat: OddsFormat;
  stakeMode: StakeMode;
  stakePct: number;
  stakeCash: number;
  timezone: string;
  journalBalance: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type SettingsRow = {
  user_id: number | string | bigint;
  default_bookmaker: string | null;
  odds_format: string | null;
  stake_mode: string | null;
  stake_pct: number | string | null;
  stake_cash: number | string | null;
  timezone: string | null;
  journal_balance: number | string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

let initPromise: Promise<void> | null = null;

function toInt(value: number | string | bigint): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(value: number | string | null | undefined, fallback: number): number {
  const n = Number(value ?? NaN);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(value: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeBookmaker(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return normalized || DEFAULT_BOOKMAKER;
}

function normalizeOddsFormat(value: string | null | undefined): OddsFormat {
  const normalized = String(value ?? "").toLowerCase();
  return normalized === "american" ? "american" : "decimal";
}

function normalizeStakeMode(value: string | null | undefined): StakeMode {
  const normalized = String(value ?? "").toLowerCase();
  return normalized === "cash" ? "cash" : "pct";
}

function mapRow(row: SettingsRow): AppUserSettings {
  return {
    userId: toInt(row.user_id),
    defaultBookmaker: normalizeBookmaker(row.default_bookmaker),
    oddsFormat: normalizeOddsFormat(row.odds_format),
    stakeMode: normalizeStakeMode(row.stake_mode),
    stakePct: toNum(row.stake_pct, DEFAULT_STAKE_PCT),
    stakeCash: toNum(row.stake_cash, DEFAULT_STAKE_CASH),
    timezone: String(row.timezone ?? DEFAULT_TIMEZONE),
    journalBalance: toNum(row.journal_balance, DEFAULT_JOURNAL_BALANCE),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function ensureUserSettingsTable() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      create table if not exists ${TABLE_NAME} (
        user_id bigint primary key references app_users(id) on delete cascade,
        default_bookmaker text not null default '${DEFAULT_BOOKMAKER}',
        odds_format text not null default '${DEFAULT_ODDS_FORMAT}',
        stake_mode text not null default '${DEFAULT_STAKE_MODE}',
        stake_pct numeric not null default ${DEFAULT_STAKE_PCT},
        stake_cash numeric not null default ${DEFAULT_STAKE_CASH},
        timezone text not null default '${DEFAULT_TIMEZONE}',
        journal_balance numeric not null default ${DEFAULT_JOURNAL_BALANCE},
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
  })();
  return initPromise;
}

async function createDefaultForUser(userId: number): Promise<AppUserSettings> {
  const rows = await prisma.$queryRaw<SettingsRow[]>`
    insert into app_user_settings (
      user_id,
      default_bookmaker,
      odds_format,
      stake_mode,
      stake_pct,
      stake_cash,
      timezone,
      journal_balance,
      created_at,
      updated_at
    ) values (
      ${userId},
      ${DEFAULT_BOOKMAKER},
      ${DEFAULT_ODDS_FORMAT},
      ${DEFAULT_STAKE_MODE},
      ${DEFAULT_STAKE_PCT},
      ${DEFAULT_STAKE_CASH},
      ${DEFAULT_TIMEZONE},
      ${DEFAULT_JOURNAL_BALANCE},
      now(),
      now()
    )
    on conflict (user_id) do update
      set updated_at = now()
    returning
      user_id,
      default_bookmaker,
      odds_format,
      stake_mode,
      stake_pct,
      stake_cash,
      timezone,
      journal_balance,
      created_at,
      updated_at
  `;
  return mapRow(rows[0]);
}

export async function getOrCreateUserSettings(userId: number): Promise<AppUserSettings> {
  await ensureUserSettingsTable();
  const rows = await prisma.$queryRaw<SettingsRow[]>`
    select
      user_id,
      default_bookmaker,
      odds_format,
      stake_mode,
      stake_pct,
      stake_cash,
      timezone,
      journal_balance,
      created_at,
      updated_at
    from app_user_settings
    where user_id = ${userId}
    limit 1
  `;
  if (rows.length) return mapRow(rows[0]);
  return createDefaultForUser(userId);
}

export async function updateUserSettings(
  userId: number,
  patch: Partial<{
    defaultBookmaker: string;
    oddsFormat: OddsFormat;
    stakeMode: StakeMode;
    stakePct: number;
    stakeCash: number;
    timezone: string;
    journalBalance: number;
  }>,
): Promise<AppUserSettings> {
  const current = await getOrCreateUserSettings(userId);
  const next = {
    defaultBookmaker: normalizeBookmaker(patch.defaultBookmaker ?? current.defaultBookmaker),
    oddsFormat: normalizeOddsFormat(patch.oddsFormat ?? current.oddsFormat),
    stakeMode: normalizeStakeMode(patch.stakeMode ?? current.stakeMode),
    stakePct: toNum(patch.stakePct, current.stakePct),
    stakeCash: toNum(patch.stakeCash, current.stakeCash),
    timezone: String(patch.timezone ?? current.timezone ?? DEFAULT_TIMEZONE),
    journalBalance: toNum(patch.journalBalance, current.journalBalance),
  };

  const rows = await prisma.$queryRaw<SettingsRow[]>`
    update app_user_settings
    set
      default_bookmaker = ${next.defaultBookmaker},
      odds_format = ${next.oddsFormat},
      stake_mode = ${next.stakeMode},
      stake_pct = ${next.stakePct},
      stake_cash = ${next.stakeCash},
      timezone = ${next.timezone},
      journal_balance = ${next.journalBalance},
      updated_at = now()
    where user_id = ${userId}
    returning
      user_id,
      default_bookmaker,
      odds_format,
      stake_mode,
      stake_pct,
      stake_cash,
      timezone,
      journal_balance,
      created_at,
      updated_at
  `;
  if (rows.length) return mapRow(rows[0]);
  return getOrCreateUserSettings(userId);
}

export async function adjustUserJournalBalance(params: {
  userId: number;
  direction: "add" | "withdraw";
  amount: number;
}): Promise<{ ok: boolean; settings: AppUserSettings; error?: string }> {
  const settings = await getOrCreateUserSettings(params.userId);
  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, settings, error: "Montant invalide." };
  }
  const nextBalance =
    params.direction === "add"
      ? settings.journalBalance + amount
      : settings.journalBalance - amount;
  if (nextBalance < 0) {
    return { ok: false, settings, error: "Fonds insuffisants." };
  }
  const updated = await updateUserSettings(params.userId, {
    journalBalance: Number(nextBalance.toFixed(2)),
  });
  return { ok: true, settings: updated };
}

