import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.APISPORTS_NBA_URL || "https://v2.nba.api-sports.io";
const API_KEY = process.env.APISPORTS_KEY;
const DEFAULT_SEASON =
  process.env.APISPORTS_NBA_SEASON ?? "2025";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FALLBACK_SEASON = "2025";

// Shape API-Sports NBA v2 (/teams)
type ApiSportsTeamV2 = {
  id?: number;
  name?: string;
  nickname?: string;
  code?: string;
  city?: string;
  logo?: string | null;
  nbaFranchise?: boolean;
  leagues?: {
    standard?: {
      conference?: string | null;
      division?: string | null;
    } | null;
  } | null;
};

type ApiSportsTeamsResponse = {
  get?: string;
  parameters?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  results?: number;
  response?: unknown[];
};

export type BetalyzeNbaTeam = {
  id: number;
  name: string; // Hawks
  fullName: string; // Atlanta Hawks
  code: string | null; // ATL
  city: string | null;
  logo: string | null;
  conference: "East" | "West" | "N/A";
  division: string | null;
  isFranchise: boolean;
};

export type BetalyzeNbaTeamsPayload = {
  season: string;
  count: number;
  conferences: {
    east: number;
    west: number;
    other: number;
  };
  teams: BetalyzeNbaTeam[];
};

const memoryCache = new Map<string, { ts: number; payload: BetalyzeNbaTeamsPayload }>();

const FALLBACK_TEAMS: BetalyzeNbaTeam[] = [
  { id: 132, name: "Hawks", fullName: "Atlanta Hawks", code: "ATL", city: "Atlanta", logo: "https://media.api-sports.io/basketball/teams/132.png", conference: "East", division: null, isFranchise: true },
  { id: 133, name: "Celtics", fullName: "Boston Celtics", code: "BOS", city: "Boston", logo: "https://media.api-sports.io/basketball/teams/133.png", conference: "East", division: null, isFranchise: true },
  { id: 134, name: "Nets", fullName: "Brooklyn Nets", code: "BKN", city: "Brooklyn", logo: "https://media.api-sports.io/basketball/teams/134.png", conference: "East", division: null, isFranchise: true },
  { id: 135, name: "Hornets", fullName: "Charlotte Hornets", code: "CHA", city: "Charlotte", logo: "https://media.api-sports.io/basketball/teams/135.png", conference: "East", division: null, isFranchise: true },
  { id: 136, name: "Bulls", fullName: "Chicago Bulls", code: "CHI", city: "Chicago", logo: "https://media.api-sports.io/basketball/teams/136.png", conference: "East", division: null, isFranchise: true },
  { id: 137, name: "Cavaliers", fullName: "Cleveland Cavaliers", code: "CLE", city: "Cleveland", logo: "https://media.api-sports.io/basketball/teams/137.png", conference: "East", division: null, isFranchise: true },
  { id: 140, name: "Pistons", fullName: "Detroit Pistons", code: "DET", city: "Detroit", logo: "https://media.api-sports.io/basketball/teams/140.png", conference: "East", division: null, isFranchise: true },
  { id: 143, name: "Pacers", fullName: "Indiana Pacers", code: "IND", city: "Indiana", logo: "https://media.api-sports.io/basketball/teams/143.png", conference: "East", division: null, isFranchise: true },
  { id: 147, name: "Heat", fullName: "Miami Heat", code: "MIA", city: "Miami", logo: "https://media.api-sports.io/basketball/teams/147.png", conference: "East", division: null, isFranchise: true },
  { id: 148, name: "Bucks", fullName: "Milwaukee Bucks", code: "MIL", city: "Milwaukee", logo: "https://media.api-sports.io/basketball/teams/148.png", conference: "East", division: null, isFranchise: true },
  { id: 151, name: "Knicks", fullName: "New York Knicks", code: "NYK", city: "New York", logo: "https://media.api-sports.io/basketball/teams/151.png", conference: "East", division: null, isFranchise: true },
  { id: 153, name: "Magic", fullName: "Orlando Magic", code: "ORL", city: "Orlando", logo: "https://media.api-sports.io/basketball/teams/153.png", conference: "East", division: null, isFranchise: true },
  { id: 154, name: "76ers", fullName: "Philadelphia 76ers", code: "PHI", city: "Philadelphia", logo: "https://media.api-sports.io/basketball/teams/154.png", conference: "East", division: null, isFranchise: true },
  { id: 159, name: "Raptors", fullName: "Toronto Raptors", code: "TOR", city: "Toronto", logo: "https://media.api-sports.io/basketball/teams/159.png", conference: "East", division: null, isFranchise: true },
  { id: 161, name: "Wizards", fullName: "Washington Wizards", code: "WAS", city: "Washington", logo: "https://media.api-sports.io/basketball/teams/161.png", conference: "East", division: null, isFranchise: true },
  { id: 138, name: "Mavericks", fullName: "Dallas Mavericks", code: "DAL", city: "Dallas", logo: "https://media.api-sports.io/basketball/teams/138.png", conference: "West", division: null, isFranchise: true },
  { id: 139, name: "Nuggets", fullName: "Denver Nuggets", code: "DEN", city: "Denver", logo: "https://media.api-sports.io/basketball/teams/139.png", conference: "West", division: null, isFranchise: true },
  { id: 141, name: "Warriors", fullName: "Golden State Warriors", code: "GSW", city: "San Francisco", logo: "https://media.api-sports.io/basketball/teams/141.png", conference: "West", division: null, isFranchise: true },
  { id: 142, name: "Rockets", fullName: "Houston Rockets", code: "HOU", city: "Houston", logo: "https://media.api-sports.io/basketball/teams/142.png", conference: "West", division: null, isFranchise: true },
  { id: 144, name: "Clippers", fullName: "Los Angeles Clippers", code: "LAC", city: "Los Angeles", logo: "https://media.api-sports.io/basketball/teams/144.png", conference: "West", division: null, isFranchise: true },
  { id: 145, name: "Lakers", fullName: "Los Angeles Lakers", code: "LAL", city: "Los Angeles", logo: "https://media.api-sports.io/basketball/teams/145.png", conference: "West", division: null, isFranchise: true },
  { id: 146, name: "Grizzlies", fullName: "Memphis Grizzlies", code: "MEM", city: "Memphis", logo: "https://media.api-sports.io/basketball/teams/146.png", conference: "West", division: null, isFranchise: true },
  { id: 149, name: "Timberwolves", fullName: "Minnesota Timberwolves", code: "MIN", city: "Minnesota", logo: "https://media.api-sports.io/basketball/teams/149.png", conference: "West", division: null, isFranchise: true },
  { id: 150, name: "Pelicans", fullName: "New Orleans Pelicans", code: "NOP", city: "New Orleans", logo: "https://media.api-sports.io/basketball/teams/150.png", conference: "West", division: null, isFranchise: true },
  { id: 152, name: "Thunder", fullName: "Oklahoma City Thunder", code: "OKC", city: "Oklahoma City", logo: "https://media.api-sports.io/basketball/teams/152.png", conference: "West", division: null, isFranchise: true },
  { id: 155, name: "Suns", fullName: "Phoenix Suns", code: "PHX", city: "Phoenix", logo: "https://media.api-sports.io/basketball/teams/155.png", conference: "West", division: null, isFranchise: true },
  { id: 156, name: "Trail Blazers", fullName: "Portland Trail Blazers", code: "POR", city: "Portland", logo: "https://media.api-sports.io/basketball/teams/156.png", conference: "West", division: null, isFranchise: true },
  { id: 157, name: "Kings", fullName: "Sacramento Kings", code: "SAC", city: "Sacramento", logo: "https://media.api-sports.io/basketball/teams/157.png", conference: "West", division: null, isFranchise: true },
  { id: 158, name: "Spurs", fullName: "San Antonio Spurs", code: "SAS", city: "San Antonio", logo: "https://media.api-sports.io/basketball/teams/158.png", conference: "West", division: null, isFranchise: true },
  { id: 160, name: "Jazz", fullName: "Utah Jazz", code: "UTA", city: "Salt Lake City", logo: "https://media.api-sports.io/basketball/teams/160.png", conference: "West", division: null, isFranchise: true },
];

// Codes officiels NBA par ID API-Sports interne Betalyze
const CODE_BY_TEAM_ID: Record<number, string> = {
  132: "ATL",
  133: "BOS",
  134: "BKN",
  135: "CHA",
  136: "CHI",
  137: "CLE",
  140: "DET",
  143: "IND",
  147: "MIA",
  148: "MIL",
  151: "NYK",
  153: "ORL",
  154: "PHI",
  159: "TOR",
  161: "WAS",
  138: "DAL",
  139: "DEN",
  141: "GSW",
  142: "HOU",
  144: "LAC",
  145: "LAL",
  146: "MEM",
  149: "MIN",
  150: "NOP",
  152: "OKC",
  155: "PHX",
  156: "POR",
  157: "SAC",
  158: "SAS",
  160: "UTA",
};

const TEAM_ID_BY_CODE = Object.entries(CODE_BY_TEAM_ID).reduce(
  (acc, [id, code]) => {
    acc[code] = Number(id);
    return acc;
  },
  {} as Record<string, number>,
);

const VALID_DIVISIONS = new Set([
  "Atlantic",
  "Central",
  "Southeast",
  "Northwest",
  "Pacific",
  "Southwest",
]);

const KNOWN_TEAM_ID_SET = new Set<number>(
  Object.keys(CODE_BY_TEAM_ID).map(Number).filter(Number.isFinite),
);

function normalizeSeason(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return value;
  return String(year);
}

function conferenceFromV2(raw: string | null | undefined): "East" | "West" | "N/A" {
  const val = String(raw ?? "").trim().toLowerCase();
  if (val === "east") return "East";
  if (val === "west") return "West";
  return "N/A";
}

function resolveStableLogo(teamId: number, fallbackLogo: string | null | undefined): string | null {
  if (KNOWN_TEAM_ID_SET.has(teamId)) {
    return `https://media.api-sports.io/basketball/teams/${teamId}.png`;
  }
  return fallbackLogo ?? null;
}

function buildConferencesCount(teams: BetalyzeNbaTeam[]) {
  return teams.reduce(
    (acc, t) => {
      if (t.conference === "East") acc.east += 1;
      else if (t.conference === "West") acc.west += 1;
      else acc.other += 1;
      return acc;
    },
    { east: 0, west: 0, other: 0 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season") ?? DEFAULT_SEASON;
    const forceRefresh = searchParams.get("refresh") === "1";
    const season = normalizeSeason(seasonParam);
    const cacheKey = `season:${season}`;

    const cached = memoryCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, { status: 200 });
    }

    const fallbackPayload: BetalyzeNbaTeamsPayload = {
      season: season ?? FALLBACK_SEASON,
      count: FALLBACK_TEAMS.length,
      conferences: buildConferencesCount(FALLBACK_TEAMS),
      teams: FALLBACK_TEAMS,
    };

    if (!API_BASE_URL || !API_KEY) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    const url = new URL("/teams", API_BASE_URL);
    url.searchParams.set("league", "standard");
    url.searchParams.set("season", season);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
      },
      next: { revalidate: 60 * 60 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("NBA API error:", res.status, text);
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    const data = (await res.json()) as ApiSportsTeamsResponse;
    const rows = Array.isArray(data.response) ? data.response : [];
    if (!rows.length) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    const mappedRaw: BetalyzeNbaTeam[] = [];
    for (const team of rows as ApiSportsTeamV2[]) {
      if (!team || team.nbaFranchise !== true) continue;

      const code = String(team.code ?? "").trim().toUpperCase();
      const betalyzeId = TEAM_ID_BY_CODE[code] ?? null;
      if (!betalyzeId) continue;

      const conference = conferenceFromV2(team.leagues?.standard?.conference);
      if (conference === "N/A") continue;
      const division = team.leagues?.standard?.division ?? null;
      if (!division || !VALID_DIVISIONS.has(division)) continue;

      const fullName =
        String(team.name ?? "").trim() ||
        String(team.nickname ?? "").trim() ||
        `Team ${betalyzeId}`;
      const shortName = String(team.nickname ?? "").trim() || fullName;

      mappedRaw.push({
        id: betalyzeId,
        name: shortName,
        fullName,
        code: code || null,
        city: String(team.city ?? "").trim() || null,
        logo: resolveStableLogo(betalyzeId, team.logo),
        conference,
        division,
        isFranchise: true,
      });
    }

    // Some v2 feeds can expose duplicate aliases for a franchise code.
    // Keep one row per internal team id, preferring the most complete label.
    const qualityScore = (team: BetalyzeNbaTeam) => {
      let score = 0;
      if (team.division) score += 2;
      if (team.city) score += 1;
      if (/team\\s+/i.test(team.fullName)) score -= 2;
      score += team.fullName.length / 100;
      return score;
    };
    const byId = new Map<number, BetalyzeNbaTeam>();
    for (const team of mappedRaw) {
      const prev = byId.get(team.id);
      if (!prev || qualityScore(team) >= qualityScore(prev)) {
        byId.set(team.id, team);
      }
    }
    const mapped = Array.from(byId.values());

    if (!mapped.length) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    const sortOrder: Record<BetalyzeNbaTeam["conference"], number> = {
      East: 0,
      West: 1,
      "N/A": 2,
    };

    mapped.sort((a, b) => {
      const confDiff = sortOrder[a.conference] - sortOrder[b.conference];
      if (confDiff !== 0) return confDiff;
      return a.fullName.localeCompare(b.fullName);
    });

    const payload: BetalyzeNbaTeamsPayload = {
      season,
      count: mapped.length,
      conferences: buildConferencesCount(mapped),
      teams: mapped,
    };

    memoryCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in /api/nba/teams:", err);
    const payload: BetalyzeNbaTeamsPayload = {
      season: FALLBACK_SEASON,
      count: FALLBACK_TEAMS.length,
      conferences: buildConferencesCount(FALLBACK_TEAMS),
      teams: FALLBACK_TEAMS,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
