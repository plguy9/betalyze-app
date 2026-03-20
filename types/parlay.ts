// Shared parlay contracts (v1) for front + API routes.

export type ParlaySport = "NBA";

export type ParlayLegSide = "over" | "under";

export type ParlayOddsFormat = "decimal" | "american";

export type ParlayLegSource =
  | "top_props"
  | "player_page"
  | "match_modal"
  | "alternate_lines"
  | "manual";

export type ParlayMetric =
  | "PTS"
  | "REB"
  | "AST"
  | "3PM"
  | "PRA"
  | "P+A"
  | "P+R"
  | "R+A";

// Canonical leg payload used in slip state and quote requests.
export type ParlayLegV1 = {
  legId: string;
  sport: ParlaySport;
  gameId: number | null;
  eventDate: string | null;
  playerId: number | null;
  player: string;
  market: ParlayMetric | string;
  side: ParlayLegSide;
  line: number;
  oddsDecimal: number;
  oddsAmerican: number | null;
  teamCode: string | null;
  opponentCode: string | null;
  bookmakerKey: string | null;
  bookmakerName: string | null;
  source: ParlayLegSource;
};

export type ParlayQuoteRequestV1 = {
  legs: ParlayLegV1[];
  stake: number | null;
  oddsFormat?: ParlayOddsFormat;
};

export type ParlayQuoteWarningCode =
  | "MIN_LEGS"
  | "MAX_LEGS"
  | "DUPLICATE_LEG"
  | "CONTRADICTORY_LEG"
  | "INVALID_ODDS"
  | "INVALID_LEG"
  | "INVALID_STAKE";

export type ParlayQuoteWarningV1 = {
  code: ParlayQuoteWarningCode;
  message: string;
  legIds: string[];
};

export type ParlayQuoteResponseV1 = {
  ok: boolean;
  combinedDecimal: number | null;
  combinedAmerican: number | null;
  impliedProbability: number | null;
  stake: number | null;
  payout: number | null;
  profit: number | null;
  warnings: ParlayQuoteWarningV1[];
};

export type ParlayTicketStatus = "open" | "won" | "lost" | "void";

export type ParlayTicketLeg = {
  id: string;
  ticketId: string;
  userId: number;
  gameId: number | null;
  eventDate: string | null;
  playerId: number | null;
  player: string;
  team: string | null;
  opp: string | null;
  market: string;
  side: ParlayLegSide;
  line: number;
  oddsDecimal: number;
  oddsAmerican: number | null;
  bookmaker: string | null;
  source: string | null;
  createdAt: string;
};

export type ParlayTicket = {
  id: string;
  userId: number;
  league: string;
  bookmaker: string | null;
  legsCount: number;
  combinedDecimal: number;
  combinedAmerican: number | null;
  stake: number | null;
  payout: number | null;
  profit: number | null;
  status: ParlayTicketStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  legs: ParlayTicketLeg[];
};
