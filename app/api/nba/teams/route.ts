import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.APISPORTS_BASKETBALL_URL!;
const API_KEY = process.env.APISPORTS_KEY!;
const DEFAULT_SEASON = process.env.APISPORTS_BASKETBALL_SEASON ?? '2024-2025';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FALLBACK_SEASON = '2025-2026';

// Shape réel de l'API-Sports basket pour /teams
type ApiSportsTeam = {
  id: number;
  name: string;
  logo: string | null;
  nationnal: boolean;
  country: {
    id: number;
    name: string;
    code: string;
    flag: string | null;
  };
};

type ApiSportsTeamsResponse = {
  get: string;
  parameters: Record<string, any>;
  errors: Record<string, any>;
  results: number;
  response: ApiSportsTeam[];
};

export type BetalyzeNbaTeam = {
  id: number;
  name: string;          // Hawks
  fullName: string;      // Atlanta Hawks
  code: string | null;   // ATL (on le mettra plus tard si besoin)
  city: string | null;
  logo: string | null;
  conference: 'East' | 'West' | 'N/A';
  division: string | null;
  isFranchise: boolean;
};

// Payload renvoyé à ton front
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
  { id: 132, name: 'Hawks', fullName: 'Atlanta Hawks', code: 'ATL', city: 'Atlanta', logo: 'https://media.api-sports.io/basketball/teams/132.png', conference: 'East', division: null, isFranchise: true },
  { id: 133, name: 'Celtics', fullName: 'Boston Celtics', code: 'BOS', city: 'Boston', logo: 'https://media.api-sports.io/basketball/teams/133.png', conference: 'East', division: null, isFranchise: true },
  { id: 134, name: 'Nets', fullName: 'Brooklyn Nets', code: 'BKN', city: 'Brooklyn', logo: 'https://media.api-sports.io/basketball/teams/134.png', conference: 'East', division: null, isFranchise: true },
  { id: 135, name: 'Hornets', fullName: 'Charlotte Hornets', code: 'CHA', city: 'Charlotte', logo: 'https://media.api-sports.io/basketball/teams/135.png', conference: 'East', division: null, isFranchise: true },
  { id: 136, name: 'Bulls', fullName: 'Chicago Bulls', code: 'CHI', city: 'Chicago', logo: 'https://media.api-sports.io/basketball/teams/136.png', conference: 'East', division: null, isFranchise: true },
  { id: 137, name: 'Cavaliers', fullName: 'Cleveland Cavaliers', code: 'CLE', city: 'Cleveland', logo: 'https://media.api-sports.io/basketball/teams/137.png', conference: 'East', division: null, isFranchise: true },
  { id: 140, name: 'Pistons', fullName: 'Detroit Pistons', code: 'DET', city: 'Detroit', logo: 'https://media.api-sports.io/basketball/teams/140.png', conference: 'East', division: null, isFranchise: true },
  { id: 143, name: 'Pacers', fullName: 'Indiana Pacers', code: 'IND', city: 'Indiana', logo: 'https://media.api-sports.io/basketball/teams/143.png', conference: 'East', division: null, isFranchise: true },
  { id: 147, name: 'Heat', fullName: 'Miami Heat', code: 'MIA', city: 'Miami', logo: 'https://media.api-sports.io/basketball/teams/147.png', conference: 'East', division: null, isFranchise: true },
  { id: 148, name: 'Bucks', fullName: 'Milwaukee Bucks', code: 'MIL', city: 'Milwaukee', logo: 'https://media.api-sports.io/basketball/teams/148.png', conference: 'East', division: null, isFranchise: true },
  { id: 151, name: 'Knicks', fullName: 'New York Knicks', code: 'NYK', city: 'New York', logo: 'https://media.api-sports.io/basketball/teams/151.png', conference: 'East', division: null, isFranchise: true },
  { id: 153, name: 'Magic', fullName: 'Orlando Magic', code: 'ORL', city: 'Orlando', logo: 'https://media.api-sports.io/basketball/teams/153.png', conference: 'East', division: null, isFranchise: true },
  { id: 154, name: '76ers', fullName: 'Philadelphia 76ers', code: 'PHI', city: 'Philadelphia', logo: 'https://media.api-sports.io/basketball/teams/154.png', conference: 'East', division: null, isFranchise: true },
  { id: 159, name: 'Raptors', fullName: 'Toronto Raptors', code: 'TOR', city: 'Toronto', logo: 'https://media.api-sports.io/basketball/teams/159.png', conference: 'East', division: null, isFranchise: true },
  { id: 161, name: 'Wizards', fullName: 'Washington Wizards', code: 'WAS', city: 'Washington', logo: 'https://media.api-sports.io/basketball/teams/161.png', conference: 'East', division: null, isFranchise: true },
  { id: 138, name: 'Mavericks', fullName: 'Dallas Mavericks', code: 'DAL', city: 'Dallas', logo: 'https://media.api-sports.io/basketball/teams/138.png', conference: 'West', division: null, isFranchise: true },
  { id: 139, name: 'Nuggets', fullName: 'Denver Nuggets', code: 'DEN', city: 'Denver', logo: 'https://media.api-sports.io/basketball/teams/139.png', conference: 'West', division: null, isFranchise: true },
  { id: 141, name: 'Warriors', fullName: 'Golden State Warriors', code: 'GSW', city: 'San Francisco', logo: 'https://media.api-sports.io/basketball/teams/141.png', conference: 'West', division: null, isFranchise: true },
  { id: 142, name: 'Rockets', fullName: 'Houston Rockets', code: 'HOU', city: 'Houston', logo: 'https://media.api-sports.io/basketball/teams/142.png', conference: 'West', division: null, isFranchise: true },
  { id: 144, name: 'Clippers', fullName: 'Los Angeles Clippers', code: 'LAC', city: 'Los Angeles', logo: 'https://media.api-sports.io/basketball/teams/144.png', conference: 'West', division: null, isFranchise: true },
  { id: 145, name: 'Lakers', fullName: 'Los Angeles Lakers', code: 'LAL', city: 'Los Angeles', logo: 'https://media.api-sports.io/basketball/teams/145.png', conference: 'West', division: null, isFranchise: true },
  { id: 146, name: 'Grizzlies', fullName: 'Memphis Grizzlies', code: 'MEM', city: 'Memphis', logo: 'https://media.api-sports.io/basketball/teams/146.png', conference: 'West', division: null, isFranchise: true },
  { id: 149, name: 'Timberwolves', fullName: 'Minnesota Timberwolves', code: 'MIN', city: 'Minnesota', logo: 'https://media.api-sports.io/basketball/teams/149.png', conference: 'West', division: null, isFranchise: true },
  { id: 150, name: 'Pelicans', fullName: 'New Orleans Pelicans', code: 'NOP', city: 'New Orleans', logo: 'https://media.api-sports.io/basketball/teams/150.png', conference: 'West', division: null, isFranchise: true },
  { id: 152, name: 'Thunder', fullName: 'Oklahoma City Thunder', code: 'OKC', city: 'Oklahoma City', logo: 'https://media.api-sports.io/basketball/teams/152.png', conference: 'West', division: null, isFranchise: true },
  { id: 155, name: 'Suns', fullName: 'Phoenix Suns', code: 'PHX', city: 'Phoenix', logo: 'https://media.api-sports.io/basketball/teams/155.png', conference: 'West', division: null, isFranchise: true },
  { id: 156, name: 'Trail Blazers', fullName: 'Portland Trail Blazers', code: 'POR', city: 'Portland', logo: 'https://media.api-sports.io/basketball/teams/156.png', conference: 'West', division: null, isFranchise: true },
  { id: 157, name: 'Kings', fullName: 'Sacramento Kings', code: 'SAC', city: 'Sacramento', logo: 'https://media.api-sports.io/basketball/teams/157.png', conference: 'West', division: null, isFranchise: true },
  { id: 158, name: 'Spurs', fullName: 'San Antonio Spurs', code: 'SAS', city: 'San Antonio', logo: 'https://media.api-sports.io/basketball/teams/158.png', conference: 'West', division: null, isFranchise: true },
  { id: 160, name: 'Jazz', fullName: 'Utah Jazz', code: 'UTA', city: 'Salt Lake City', logo: 'https://media.api-sports.io/basketball/teams/160.png', conference: 'West', division: null, isFranchise: true },
];

// Map ID -> Conférence (à partir de la réponse API-Sports)
const TEAM_CONFERENCE: Record<number, 'East' | 'West'> = {
  132: 'East', // Hawks
  133: 'East', // Celtics
  134: 'East', // Nets
  135: 'East', // Hornets
  136: 'East', // Bulls
  137: 'East', // Cavaliers
  140: 'East', // Pistons
  143: 'East', // Pacers
  147: 'East', // Heat
  148: 'East', // Bucks
  151: 'East', // Knicks
  153: 'East', // Magic
  154: 'East', // 76ers
  159: 'East', // Raptors
  161: 'East', // Wizards

  138: 'West', // Mavericks
  139: 'West', // Nuggets
  141: 'West', // Warriors
  142: 'West', // Rockets
  144: 'West', // Clippers
  145: 'West', // Lakers
  146: 'West', // Grizzlies
  149: 'West', // Timberwolves
  150: 'West', // Pelicans
  152: 'West', // Thunder
  155: 'West', // Suns
  156: 'West', // Blazers
  157: 'West', // Kings
  158: 'West', // Spurs
  160: 'West', // Jazz
};

// Ids des “fake teams” East / West de l’API
const FAKE_TEAMS_IDS = new Set<number>([1416, 1417]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Saison en format API-Sports basket
    const seasonParam = searchParams.get('season') ?? DEFAULT_SEASON;
    const season = seasonParam;
    const cacheKey = `season:${season}`;

    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, { status: 200 });
    }

    const conferencesCountFallback = FALLBACK_TEAMS.reduce(
      (acc, t) => {
        if (t.conference === 'East') acc.east += 1;
        else if (t.conference === 'West') acc.west += 1;
        else acc.other += 1;
        return acc;
      },
      { east: 0, west: 0, other: 0 },
    );
    const fallbackPayload: BetalyzeNbaTeamsPayload = {
      season: season ?? FALLBACK_SEASON,
      count: FALLBACK_TEAMS.length,
      conferences: conferencesCountFallback,
      teams: FALLBACK_TEAMS,
    };

    if (!API_BASE_URL || !API_KEY) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    // https://v1.basketball.api-sports.io/teams?league=12&season=2023-2024
    const url = new URL('/teams', API_BASE_URL);
    url.searchParams.set('league', '12'); // 12 = NBA
    url.searchParams.set('season', season);

    const headers: Record<string, string> = {
      'x-apisports-key': API_KEY,
    };

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      next: { revalidate: 60 * 60 }, // cache 1h
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('NBA API error:', res.status, text);
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    const data = (await res.json()) as ApiSportsTeamsResponse;
    if (!Array.isArray(data.response) || data.response.length === 0) {
      memoryCache.set(cacheKey, { ts: Date.now(), payload: fallbackPayload });
      return NextResponse.json(fallbackPayload, { status: 200 });
    }

    // On vire les "teams" East/West (1416, 1417) et on map en format Betalyze
    const mapped: BetalyzeNbaTeam[] = data.response
      .filter((team) => !FAKE_TEAMS_IDS.has(team.id))
      .map((team) => {
        const conference = TEAM_CONFERENCE[team.id] ?? 'N/A';

        // L’API ne donne pas explicitement city / code → on met city à null pour l’instant
        const city = null;
        const fullName = team.name; // ex. "Atlanta Hawks" déjà complet
        const logoUrl =
          team.logo ??
          `https://media.api-sports.io/basketball/teams/${team.id}.png`;

        return {
          id: team.id,
          name: team.name,
          fullName,
          code: null,         // à enrichir plus tard si tu veux
          city,
          logo: logoUrl,
          conference,
          division: null,     // à enrichir plus tard
          isFranchise: true,
        };
      });

    // tri : East → West → N/A, puis fullName
    const sortOrder: Record<BetalyzeNbaTeam['conference'], number> = {
      East: 0,
      West: 1,
      'N/A': 2,
    };

    mapped.sort((a, b) => {
      const confDiff = sortOrder[a.conference] - sortOrder[b.conference];
      if (confDiff !== 0) return confDiff;
      return a.fullName.localeCompare(b.fullName);
    });

    const conferencesCount = mapped.reduce(
      (acc, t) => {
        if (t.conference === 'East') acc.east += 1;
        else if (t.conference === 'West') acc.west += 1;
        else acc.other += 1;
        return acc;
      },
      { east: 0, west: 0, other: 0 },
    );

    const payload: BetalyzeNbaTeamsPayload = {
      season,
      count: mapped.length,
      conferences: conferencesCount,
      teams: mapped,
    };

    memoryCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error('Unexpected error in /api/nba/teams:', err);
    const conferencesCount = FALLBACK_TEAMS.reduce(
      (acc, t) => {
        if (t.conference === 'East') acc.east += 1;
        else if (t.conference === 'West') acc.west += 1;
        else acc.other += 1;
        return acc;
      },
      { east: 0, west: 0, other: 0 },
    );
    const payload: BetalyzeNbaTeamsPayload = {
      season: FALLBACK_SEASON,
      count: FALLBACK_TEAMS.length,
      conferences: conferencesCount,
      teams: FALLBACK_TEAMS,
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
