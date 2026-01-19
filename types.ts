export enum UserRole {
  PLAYER = 'PLAYER',
  ORGANIZER = 'ORGANIZER',
  SUPERADMIN = 'SUPERADMIN'
}

export enum TournamentType {
  LEAGUE = 'LEAGUE',
  KNOCKOUT = 'KNOCKOUT'
}

export enum MatchFormat {
  SINGLES = 'SINGLES',
  DOUBLES = 'DOUBLES'
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  credits: number;
  avatar?: string;
  resetRequested?: boolean;
  password?: string;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  playerIds: string[]; 
  customPlayerNames?: string[]; // For unregistered players
}

export interface TournamentPlayer {
  id?: string; // Existing User ID
  name: string;
  username?: string;
  isRegistered: boolean;
}

export interface Tournament {
  id: string;
  uniqueId: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  type: TournamentType;
  format: MatchFormat;
  numCourts: number;
  organizerId: string;
  status: 'UPCOMING' | 'ONGOING' | 'FINISHED';
  participants: string[]; 
  isLocked: boolean;
  isPublic: boolean;
  playerLimit: number;
  scorerPin: string; 
  playerPool: TournamentPlayer[]; // Tournament-specific player roster
  rankingCriteriaOrder: RankingCriterion[];
  poster?: string; // Base64 encoded poster image
}

export type RankingCriterion = 'MATCHES_WON' | 'SETS_WON' | 'POINTS_DIFF' | 'HEAD_TO_HEAD';

export interface MatchScore {
  s1: number;
  s2: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  participants: string[]; 
  scores: MatchScore[]; 
  winnerId?: string;
  court: number;
  startTime: string;
  status: MatchStatus;
  umpireName?: string;
  pointsOption: number;
  goldenPoint: number;
  bestOf: number;
}

export interface CreditRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface JoinRequest {
  id: string;
  tournamentId: string;
  userId: string;
  username: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}