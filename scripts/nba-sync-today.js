#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ORIGIN = "http://localhost:3000";
const DEFAULT_TIMEZONE = "America/Toronto";

function loadEnvIfPresent() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  if (typeof process.loadEnvFile !== "function") return;
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.error("[nba:sync-today] Impossible de charger .env:", err?.message || err);
    process.exit(1);
  }
}

function torontoYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      out[arg.slice(2)] = "1";
      continue;
    }
    out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

function seasonCandidates(rawSeason) {
  const list = [];
  if (rawSeason && rawSeason.trim()) list.push(rawSeason.trim());
  const fromRawYear = (rawSeason || "").match(/(\d{4})/)?.[1] || null;
  if (fromRawYear) {
    list.push(fromRawYear);
    list.push(`${fromRawYear}-${Number(fromRawYear) + 1}`);
  }
  return Array.from(new Set(list.filter(Boolean)));
}

async function callSync({
  origin,
  date,
  season,
  concurrency,
  max,
  refreshRoster,
  details,
  dry,
  timeoutMs,
  authHeader,
}) {
  const url = new URL("/api/nba/logs/refresh-yesterday", origin);
  url.searchParams.set("date", date);
  if (season) url.searchParams.set("season", season);
  if (concurrency) url.searchParams.set("concurrency", String(concurrency));
  if (max) url.searchParams.set("max", String(max));
  if (typeof refreshRoster === "string") url.searchParams.set("refreshRoster", refreshRoster);
  if (details) url.searchParams.set("details", "1");
  if (dry) url.searchParams.set("dry", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    console.log(`[nba:sync-today] season=${season} en cours... ${elapsedSec}s`);
  }, 10_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: authHeader,
      cache: "no-store",
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body: json, url: url.toString() };
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeout);
  }
}

async function main() {
  loadEnvIfPresent();
  const args = parseArgs(process.argv.slice(2));

  const origin = (args.origin || process.env.APP_ORIGIN || DEFAULT_ORIGIN).trim();
  const date = (args.date || torontoYmd()).trim();
  const configuredSeason =
    args.season ||
    process.env.APISPORTS_NBA_SEASON ||
    "2025";
  const concurrency = Number(args.concurrency || 12);
  const max = Number(args.max || 5000);
  const refreshRoster = args.refreshRoster ?? "1";
  const details = args.details === "1";
  const dry = args.dry === "1";
  const timeoutMs = Number(args.timeoutMs || 300000);
  const secret = process.env.CRON_SECRET;
  const authHeader = secret ? { authorization: `Bearer ${secret}` } : {};

  const candidates = seasonCandidates(configuredSeason);
  if (!candidates.length) candidates.push("2025");

  console.log(`[nba:sync-today] Date: ${date} (${DEFAULT_TIMEZONE})`);
  console.log(`[nba:sync-today] Origin: ${origin}`);
  console.log(`[nba:sync-today] Saisons candidates: ${candidates.join(", ")}`);

  let lastResult = null;
  for (const season of candidates) {
    const result = await callSync({
      origin,
      date,
      season,
      concurrency,
      max,
      refreshRoster,
      details,
      dry,
      timeoutMs,
      authHeader,
    });
    lastResult = result;

    const body = result.body || {};
    const playersTargeted = Number(body.playersTargeted ?? 0);
    console.log(
      `[nba:sync-today] season=${season} status=${result.status} targeted=${playersTargeted} success=${Number(body.success ?? 0)} failed=${Number(body.failed ?? 0)}`,
    );

    if (!result.ok) continue;
    if (dry) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: "dry-run",
            season,
            date,
            playersTargeted,
            gamesFound: Number(body.gamesFound ?? 0),
            teamsFound: Number(body.teamsFound ?? 0),
            endpoint: result.url,
          },
          null,
          2,
        ),
      );
      return;
    }
    if (playersTargeted > 0 || candidates.length === 1) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            season,
            date,
            playersTargeted,
            processed: Number(body.processed ?? 0),
            success: Number(body.success ?? 0),
            failed: Number(body.failed ?? 0),
            durationMs: Number(body.durationMs ?? 0),
            gamesFound: Number(body.gamesFound ?? 0),
            teamsFound: Number(body.teamsFound ?? 0),
            logsMaxDate: body.logsMaxDate ?? null,
            logsPlayersCoverage: Number(body.logsPlayersCoverage ?? 0),
            endpoint: result.url,
          },
          null,
          2,
        ),
      );
      return;
    }
  }

  const message = lastResult?.body?.error || `sync failed (${lastResult?.status ?? "unknown"})`;
  console.error("[nba:sync-today] Echec:", message);
  if (lastResult?.body) {
    console.error(JSON.stringify(lastResult.body, null, 2));
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[nba:sync-today] Erreur:", err?.message || err);
  process.exit(1);
});
