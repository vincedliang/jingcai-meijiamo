export type PickChoice = "home" | "draw" | "away";
export type MatchPhase = "group" | "round16" | "quarter" | "semi" | "third" | "final";
export type MatchStatus = "scheduled" | "live" | "finished";

export interface Friend {
  id: string;
  displayName: string;
  color: string;
  isAdmin?: boolean;
}

export interface Match {
  id: string;
  matchNo: number;
  phase: MatchPhase;
  kickoffAt: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  winner: PickChoice | null;
  sourceUpdatedAt?: string | null;
}

export interface Pick {
  id: string;
  userId: string;
  matchId: string;
  choice: PickChoice;
  lockedAt: string;
}

export interface FeaturedMatch {
  matchId: string;
  selectedBy: string | null;
  selectedAt: string;
}

export interface Standing {
  userId: string;
  displayName: string;
  wrong: number;
  points: number;
  played: number;
  rank: number;
}

export interface DaySummary {
  dateKey: string;
  dayNo: number;
  matches: Match[];
}
