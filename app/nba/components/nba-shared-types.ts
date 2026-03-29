// Shared types for NBA page components

export type BetalyzeNbaTeam = {
  id: number;
  name: string;
  fullName: string;
  code?: string | null;
  logo: string | null;
  conference: "East" | "West" | "N/A";
};

export type BetalyzeNbaTeamsPayload = {
  season: string;
  count: number;
  conferences: { east: number; west: number; other: number };
  teams: BetalyzeNbaTeam[];
};

export type NbaStandingConference = "East" | "West" | "N/A";

export type NbaStandingRow = {
  teamId: number;
  code?: string | null;
  name: string;
  logo: string | null;
  conference: NbaStandingConference;
  position: number | null;
  overallRank: number;
  wins: number;
  losses: number;
  games: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  pointsAllowedPerGame?: number | null;
  reboundsPerGame?: number | null;
  assistsPerGame?: number | null;
  threesMadePerGame?: number | null;
  turnoversPerGame?: number | null;
  stealsPerGame?: number | null;
  blocksPerGame?: number | null;
  fgPct?: number | null;
  tpPct?: number | null;
  ftPct?: number | null;
  reboundsAllowedPerGame?: number | null;
  assistsAllowedPerGame?: number | null;
  threesAllowedPerGame?: number | null;
  fgPctAllowed?: number | null;
  ftPctAllowed?: number | null;
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

export type NbaPlayer = {
  id: number;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  teamId: number | null;
  teamCode?: string | null;
  teamName?: string | null;
  position: string | null;
  jerseyNumber: string | null;
  nationality: string | null;
  isActive: boolean;
};

export type PlayersResponse = {
  season: string;
  updatedAt: string;
  count: number;
  players: NbaPlayer[];
};

export type ApiGame = {
  id?: number | null;
  date?: string | null;
  time?: string | null;
  status?: { short?: string | null; long?: string | null } | null;
  league?: { id?: number | null; season?: string | null } | null;
  teams?: {
    home?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      code?: string | null;
    };
    away?: {
      id?: number | null;
      name?: string | null;
      logo?: string | null;
      code?: string | null;
    };
  } | null;
  scores?: {
    home?: { total?: number | null } | null;
    away?: { total?: number | null } | null;
  } | null;
};

export type GamesApiPayload = {
  ok: boolean;
  response?: ApiGame[];
  errors?: Record<string, unknown> | null;
};

export type OddsApiPayload = {
  ok: boolean;
  game: number;
  total: number | null;
  openingTotal?: number | null;
  spread?: { side: "home" | "away"; line: number } | null;
  openingSpread?: { side: "home" | "away"; line: number } | null;
  moneyline?: {
    home: number | null;
    away: number | null;
    homeOpen?: number | null;
    awayOpen?: number | null;
  } | null;
  bookmaker?: { id?: number | null; name?: string | null } | null;
  cacheLayer?: "memory" | "supabase" | "file" | "network" | null;
  playerProps?: Array<{
    name: string;
    metric: string;
    line: number;
    odd: string | null;
    overOdd?: string | null;
    underOdd?: string | null;
    isAlternate?: boolean | null;
    bookmakerName?: string | null;
  }>;
};

export type NbaGameCard = {
  id: number;
  dateIso: string | null;
  time: string;
  awayId: number | null;
  away: string;
  awayName: string;
  awayLogo: string | null;
  homeId: number | null;
  home: string;
  homeName: string;
  homeLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  total: number | null;
  openingTotal: number | null;
  marketSource: "odds" | "scores" | "none";
  spreadLine: number | null;
  spreadSide: "home" | "away" | null;
  openingSpreadLine: number | null;
  openingSpreadSide: "home" | "away" | null;
  moneylineHome: number | null;
  moneylineAway: number | null;
  openingMoneylineHome: number | null;
  openingMoneylineAway: number | null;
  spreadFavorite: string | null;
  bookmakerName: string | null;
  betalyzeScore: number;
  paceTag: string;
  statusShort: string | null;
};

export type NbaTopProp = {
  id: string;
  playerId?: number | null;
  player: string;
  teamCode?: string | null;
  opponentCode?: string | null;
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
  hitRate?: number | null;
  hitRateL5?: number | null;
  hitRateL10?: number | null;
  restDaysEdge?: number | null;
  splitEdge?: number | null;
  dvpRank?: number | null;
  dvpTotalTeams?: number | null;
  dvpMetricFlag?: "weakness" | "strength" | "neutral" | null;
  dvpValue?: number | null;
  dvpPosition?: string | null;
};

export type NbaTopPropsApiPayload = {
  ok: boolean;
  cached?: boolean;
  mode?: "default" | "alternates_best";
  generatedAt?: string;
  date?: string;
  season?: string;
  events?: number;
  propsAnalyzed?: number;
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
    hitRate?: number;
    hitRateL5?: number;
    hitRateL10?: number;
    hitRateL20?: number;
    seasonHitRate?: number;
    impliedProbability?: number;
    modelEdge?: number;
    dvpScore?: number;
    dvpRank?: number | null;
    dvpTotalTeams?: number | null;
    dvpMetricFlag?: "weakness" | "strength" | "neutral" | null;
    dvpValue?: number | null;
    dvpPosition?: string | null;
    consistencyScore?: number;
    recommendationScore?: number;
    recommendationTag?: "SAFE" | "BALANCED" | "AGGRESSIVE" | "LONGSHOT";
    score: number;
    grade: string;
    finalScore: number;
    gameId?: number | null;
    bookmaker?: string | null;
  }>;
};

export type NbaJournalEntry = {
  id: string;
  createdAt: string;
  eventDate: string | null;
  league: string;
  player: string;
  team: string | null;
  opp: string | null;
  prop: string;
  side: "all" | "over" | "under";
  odds: number | null;
  edgePct: number | null;
  score: number | null;
  grade: string | null;
  result: "W" | "L" | "V";
  stakeMode: "pct" | "cash";
  stakePct: number | null;
  stakeCash: number | null;
  clv: number | null;
  bookmaker: string | null;
};

export type NbaJournalApiPayload = {
  ok: boolean;
  count?: number;
  generatedAt?: string;
  entries?: NbaJournalEntry[];
  error?: string;
};

export type NbaDvpWindow = "season" | "L10" | "L5";
export type NbaDvpPosition = "G" | "F" | "C";
export type NbaDvpContext = "all" | "home" | "away";
export type NbaDvpSortKey =
  | "btp" | "games" | "pra" | "points" | "rebounds" | "assists"
  | "threePointsMade" | "minutes" | "fgPct" | "ftPct";

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
