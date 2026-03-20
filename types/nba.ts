// types/nba.ts — Types NBA centralisés

export type NbaConference = "East" | "West" | "N/A";

// --- Teams ---

export type NbaTeam = {
  id: number;
  name: string;
  fullName: string;
  code?: string | null;
  logo: string | null;
  conference: NbaConference;
};

export type NbaTeamsPayload = {
  season: string;
  count: number;
  conferences: { east: number; west: number; other: number };
  teams: NbaTeam[];
};

// --- Standings ---

export type NbaStandingRow = {
  teamId: number;
  name: string;
  logo: string | null;
  conference: NbaConference;
  position: number | null;
  overallRank: number;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  form: string | null;
  description: string | null;
};

export type NbaStandingsPayload = {
  season: string;
  count: number;
  updatedAt: string;
  standings: NbaStandingRow[];
};

export type NbaStandingDisplayRow = NbaStandingRow & {
  leagueRank: number;
  conferenceRank: number | null;
  formStreak: string;
  pfPerGame: number;
  paPerGame: number;
  diffPerGame: number;
};

// --- Players ---

export type NbaPlayer = {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId: number | null;
  position: string | null;
  jerseyNumber: string | null;
  nationality: string | null;
  isActive: boolean;
};

export type NbaPlayersPayload = {
  season: string;
  updatedAt: string;
  count: number;
  players: NbaPlayer[];
};

// --- Games ---

export type NbaApiGame = {
  id?: number | null;
  date?: string | null;
  time?: string | null;
  status?: { short?: string | null; long?: string | null } | null;
  league?: { id?: number | null; season?: string | null } | null;
  teams?: {
    home?: { id?: number | null; name?: string | null; logo?: string | null };
    away?: { id?: number | null; name?: string | null; logo?: string | null };
  } | null;
  scores?: {
    home?: { total?: number | null } | null;
    away?: { total?: number | null } | null;
  } | null;
};

export type NbaGamesPayload = {
  ok: boolean;
  response?: NbaApiGame[];
  errors?: Record<string, unknown> | null;
};

export type NbaOddsPayload = {
  ok: boolean;
  game: number;
  total: number | null;
  spread?: { side: "home" | "away"; line: number } | null;
  bookmaker?: { id?: number | null; name?: string | null } | null;
  cacheLayer?: "memory" | "supabase" | "file" | "network" | null;
  playerProps?: Array<{
    name: string;
    metric: string;
    line: number;
    odd: string | null;
    overOdd?: string | null;
    underOdd?: string | null;
    bookmakerName?: string | null;
  }>;
};

export type NbaGameCard = {
  id: number;
  time: string;
  away: string;
  awayName: string;
  home: string;
  homeName: string;
  total: number | null;
  spreadFavorite: string | null;
  betalyzeScore: number;
  paceTag: string;
  statusShort: string | null;
};

// --- Props ---

export type NbaTopProp = {
  id: string;
  playerId?: number | null;
  player: string;
  metric: string;
  line: number;
  side: "over" | "under";
  odds: number;
  edge: number;
  score: number;
  grade: string;
  finalScore: number;
  gameId: number | null;
  awayCode: string;
  homeCode: string;
  bookmaker: string | null;
};

export type NbaTopPropsPayload = {
  ok: boolean;
  generatedAt?: string;
  props?: Array<{
    id: string;
    playerId?: number | null;
    player: string;
    teamCode?: string | null;
    opponentCode?: string | null;
    metric: string;
    side: "over" | "under";
    line: number;
    odds: number;
    edge: number;
    score: number;
    grade: string;
    finalScore: number;
    gameId?: number | null;
    bookmaker?: string | null;
  }>;
};

// --- Defense vs Position (DvP) ---

export type NbaDvpWindow = "season" | "L10" | "L5";
export type NbaDvpPosition = "G" | "F" | "C";
export type NbaDvpContext = "all" | "home" | "away";
export type NbaDvpSortKey =
  | "btp"
  | "games"
  | "pra"
  | "points"
  | "rebounds"
  | "assists"
  | "threePointsMade"
  | "minutes"
  | "fgPct"
  | "ftPct";

export type NbaDvpStatTotals = {
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  threePointsMade: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

export type NbaDvpRow = {
  season: string;
  window: NbaDvpWindow;
  context: NbaDvpContext;
  teamId: number;
  teamName: string | null;
  teamAbbr: string | null;
  position: NbaDvpPosition;
  games: number;
  btpTotal: number;
  btpPerGame: number;
  metrics: { totals: NbaDvpStatTotals; perGame: NbaDvpStatTotals };
  rank: number | null;
};

export type NbaDvpResponse = {
  ok: boolean;
  rows?: NbaDvpRow[];
  error?: string;
};
