#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(process.cwd(), '.env');
const hasEnvFile = fs.existsSync(envPath);

if (hasEnvFile && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.error('Impossible de charger le fichier .env :', err?.message || err);
    process.exit(1);
  }
}

const checks = [
  { key: 'DATABASE_URL', required: true, note: 'Prisma / base SQLite' },
  { key: 'APISPORTS_KEY', required: true, note: 'Cle API-Sports commune (NBA/NFL)' },
  { key: 'APISPORTS_BASKETBALL_URL', required: false, note: 'Base API basket (v1)' },
  { key: 'APISPORTS_BASKETBALL_SEASON', required: false, note: 'Saison basket ex: 2024-2025' },
  { key: 'APISPORTS_BASKETBALL_LEAGUE_ID', required: false, note: 'League ID basket' },
  { key: 'APISPORTS_NBA_URL', required: false, note: 'Base API NBA v2' },
  { key: 'APISPORTS_NBA_SEASON', required: false, note: 'Saison NBA v2 ex: 2025-2026' },
  { key: 'APISPORTS_NBA_LEAGUE_ID', required: false, note: 'League ID NBA v2' },
  { key: 'APISPORTS_NFL_URL', required: false, note: 'Base API NFL' },
  { key: 'APISPORTS_NFL_LEAGUE_ID', required: false, note: 'League ID NFL (defaut 1)' },
  { key: 'APISPORTS_NFL_SEASON', required: false, note: 'Saison NFL (2024/2025)' },
  { key: 'NEXT_PUBLIC_APISPORTS_BASKETBALL_SEASON', required: false, note: 'Saison exposee au front' },
  { key: 'THE_ODDS_API_KEY', required: false, note: 'Cle The Odds API (props joueurs)' },
  { key: 'NHL_API_URL', required: false, note: 'Base API NHL' },
];

const results = checks.map((item) => {
  const val = process.env[item.key];
  const present = typeof val === 'string' && val.trim() !== '';
  return { ...item, present };
});

const missingRequired = results.filter((r) => r.required && !r.present);
const missingOptional = results.filter((r) => !r.required && !r.present);

console.log('--- Verification .env ---');
console.log(`Fichier .env present : ${hasEnvFile ? 'oui' : 'non'}`);
console.log(`Variables trouvees   : ${results.filter((r) => r.present).length}/${checks.length}`);

if (missingRequired.length) {
  console.log('\nManquantes (obligatoires) :');
  missingRequired.forEach((r) => console.log(`- ${r.key} (${r.note})`));
}

if (missingOptional.length) {
  console.log('\nOptionnelles absentes (fallbacks utilises) :');
  missingOptional.forEach((r) => console.log(`- ${r.key} (${r.note})`));
}

console.log('\nDetail :');
results.forEach((r) => {
  const status = r.present ? 'OK   ' : r.required ? 'MANQ ' : 'AUTO ';
  console.log(`${status} ${r.key} - ${r.note}`);
});

if (missingRequired.length) {
  process.exitCode = 1;
}
