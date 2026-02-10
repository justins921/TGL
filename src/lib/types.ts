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
