export interface Foursome {
  players: number[];
  matchups: [number, number][];
}

export interface WeekData {
  foursomes: Foursome[];
  byePlayers: number[];
}

export interface ScheduleResult {
  weeks: WeekData[];
  foursomeCount: Record<string, number>;
  matchupCount: Record<string, number>;
  byeCount: number[];
}

export interface ScheduleData {
  weeks: WeekData[];
  players: string[];
  subs: string[];
  foursomeCount: Record<string, number>;
  matchupCount: Record<string, number>;
  byeCount: number[];
}

export interface PlayerWeekEntry {
  week: number;
  opponent: number | null;
  partners: number[];
  bye: boolean;
}

export interface AnalyticsData {
  playerWeekly: PlayerWeekEntry[][];
  foursomePairCount: Record<string, number>;
  matchupPairCount: Record<string, number>;
}

export interface ScheduleStats {
  totalPairs: number;
  pairsExactlyOnce: number;
  matchupMin: number;
  matchupMax: number;
  foursomeMin: number;
  foursomeMax: number;
  byeMin: number;
  byeMax: number;
}

export interface SavedSchedule {
  id: string;
  name: string;
  savedAt: string;
  data: ScheduleData;
  stats: ScheduleStats;
}

export interface WeeklyResult {
  week: number;
  score: number;
}

/** Calculate handicap from previous season average: MIN((avg - 36) * 0.7, 10), floored at 0 */
export function calculateHandicap(previousSeasonAvg: number): number {
  return Math.min(Math.max((previousSeasonAvg - 36) * 0.7, 0), 10);
}

export interface PlayerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  handicap: number;           // 0-10 max
  previousSeasonAvg: number | null;
  isSub: boolean;
  weeklyResults: WeeklyResult[];
}
