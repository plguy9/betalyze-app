// lib/models/nba.ts

/**
 * Représentation simplifiée d'une équipe NBA pour Betalyze.
 * Source : API-Sports /teams (via notre API interne /api/nba/teams).
 */
export interface NbaTeam {
  id: number;              // ID équipe (API-Sports)
  name: string;            // Nom complet (ex: "Los Angeles Lakers")
  code: string;            // Code court (ex: "LAL")
  logo: string | null;     // URL du logo
  country?: string | null; // Optionnel (pas vital pour Betalyze)
}

/**
 * Positions simplifiées pour Betalyze.
 * On garde du texte libre pour être flexible (ex: "G-F").
 */
export type NbaPosition = "G" | "F" | "C" | string;

/**
 * Informations de base d'un joueur NBA.
 * Source : API-Sports /players (via /api/nba/players).
 */
export interface NbaPlayer {
  id: number;           // ID joueur (API-Sports)
  fullName: string;     // "LeBron James"
  firstName: string;    // "LeBron"
  lastName: string;     // "James"
  teamId: number;       // Référence vers NbaTeam.id
  teamName: string;     // "Los Angeles Lakers"
  teamCode: string;     // "LAL"
  position: NbaPosition;// "F", "G", "C", "G-F", etc.

  jerseyNumber?: number | null;
  height?: string | null;  // ex: "6-9"
  weight?: string | null;  // ex: "250 lbs"
  nationality?: string | null;
  birthDate?: string | null; // format ISO ou "YYYY-MM-DD"
  isActive?: boolean;        // si on arrive à déduire l'info
}

/**
 * Statut d'un match pour affichage.
 */
export type NbaGameStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "cancelled"
  | "postponed"
  | "unknown";

/**
 * Résultat du match du point de vue d'une équipe ou d'un joueur.
 */
export type NbaGameResult = "W" | "L" | "NA";

/**
 * Représentation d'un match NBA (sans les stats joueurs).
 * Source : API-Sports /games.
 */
export interface NbaGame {
  id: number;               // ID du game (API-Sports)
  date: string;             // ISO string
  leagueId: number;         // ID ligue (NBA)
  season: string;           // "2024-2025"

  homeTeamId: number;
  homeTeamName: string;
  homeTeamCode: string;

  awayTeamId: number;
  awayTeamName: string;
  awayTeamCode: string;

  homeScore: number | null;
  awayScore: number | null;

  status: NbaGameStatus;
}

/**
 * Statistiques d'un joueur sur un match donné.
 * C'est LE coeur de l'analyse Betalyze NBA v1.
 */
export interface NbaPlayerGameStats {
  gameId: number;       // Référence vers NbaGame.id
  playerId: number;     // Référence vers NbaPlayer.id

  date: string;         // Date du match (ISO)
  season: string;       // Saison "2024-2025"

  teamId: number;       // Équipe du joueur pour ce match
  teamName: string;
  teamCode: string;

  opponentTeamId: number;
  opponentTeamName: string;
  opponentTeamCode: string;

  isHome: boolean;      // true si le joueur jouait à domicile
  result: NbaGameResult;// "W" / "L" / "NA" si inconnu

  // --- Stats principales ---
  minutes: number | null;   // en minutes (ex: 34.5)
  points: number | null;
  rebounds: number | null;
  assists: number | null;

  // Volume de tirs
  fieldGoalsMade: number | null;     // FGM
  fieldGoalsAttempted: number | null;// FGA
  threePointsMade: number | null;    // 3PM
  threePointsAttempted: number | null;// 3PA

  // Contrôle / erreurs
  turnovers: number | null;

  // Stats additionnelles potentielles (optionnelles pour v1)
  steals?: number | null;
  blocks?: number | null;
  fouls?: number | null;
}

/**
 * Moyennes et dérivés sur une fenêtre de matchs (ex: 5 derniers, 10 derniers).
 */
export interface NbaPlayerAveragesWindow {
  sampleSize: number; // nombre de matchs utilisés

  points: number | null;
  rebounds: number | null;
  assists: number | null;
  minutes: number | null;

  fieldGoalsAttempted: number | null;
  threePointsAttempted: number | null;
  turnovers: number | null;

  // Volatilité (écart-type simple) sur certains indicateurs
  pointsStdDev?: number | null;
  minutesStdDev?: number | null;
}

/**
 * Tendance d'un joueur sur une période récente.
 */
export type NbaTrend = "up" | "flat" | "down" | "unknown";

/**
 * Résumé statistique d'un joueur pour l'analyse Betalyze v1.
 * C'est ce que renverra l'endpoint /api/nba/players/:id/summary.
 */
export interface NbaPlayerSummary {
  player: NbaPlayer;

  // Moyennes sur différentes fenêtres
  last5: NbaPlayerAveragesWindow | null;
  last10: NbaPlayerAveragesWindow | null;
  season?: NbaPlayerAveragesWindow | null; // si on utilise /players/statistics

  // Tendance globale sur les points (peut être étendu à d'autres métriques)
  pointsTrend: NbaTrend;

  // Indique si les données sont fiables (assez de matchs, etc.)
  dataQuality: "low" | "medium" | "high";
}

/**
 * Score Betalyze pour un joueur sur un type de prop donné.
 * Ex: Points, Rebonds, Assists, ou P+R+A.
 */
export type NbaBetalyzeMetric =
  | "points"
  | "rebounds"
  | "assists"
  | "pra"; // Points+Rebounds+Assists

export type NbaBetalyzeScoreConfidence = "low" | "medium" | "high" | "very_high";

export interface NbaBetalyzeScore {
  playerId: number;
  metric: NbaBetalyzeMetric;     // ex: "points"
  targetLine?: number | null;    // ex: 24.5 pts (si on a l'info plus tard)
  score: number;                 // 0 à 100
  confidence: NbaBetalyzeScoreConfidence;

  // Explications humaines pour l'utilisateur
  reasons: string[];             // ex: ["3/5 derniers > ligne", "matchup favorable vs SG"]

  // Données de support (optionnelles)
  last5?: NbaPlayerAveragesWindow | null;
  last10?: NbaPlayerAveragesWindow | null;
}

/**
 * Résultat d'une analyse complète Betalyze pour un joueur NBA.
 * Peut être utilisé comme "payload final" sur la page /nba/players/[id].
 */
export interface NbaPlayerAnalysis {
  summary: NbaPlayerSummary;
  scores: NbaBetalyzeScore[]; // ex: [score points, score pra, etc.]

  // Informations supplémentaires sur le matchup du jour
  matchupInfo?: {
    opponentTeamId: number;
    opponentTeamName: string;
    opponentTeamCode: string;
    // Plus tard : stats défensives vs position, pace, etc.
  } | null;
}