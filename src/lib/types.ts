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
  scores?: Record<string, number>; // "weekIndex-playerIndex-holeIndex" -> gross strokes
  weekDates?: string[]; // ISO date string per week, editable for rain outs
  substitutions?: Record<string, string>; // "weekIndex-playerIndex" -> sub name or "Casper"
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

/** Calculate handicap from scoring average: MIN((avg - 36) * 0.7, 10), floored at 0, rounded to nearest whole number */
export function calculateHandicap(avg: number): number {
  return Math.round(Math.min(Math.max((avg - 36) * 0.7, 0), 10));
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

export const DEFAULT_ROSTER: { name: string; avg: number | null; isSub: boolean }[] = [
  { name: 'Bryon A', avg: 46.6, isSub: false },
  { name: 'Buddha', avg: 46.7, isSub: false },
  { name: 'David L', avg: 48.3, isSub: false },
  { name: 'Jeff B', avg: 44.1, isSub: false },
  { name: 'John M', avg: 46.0, isSub: false },
  { name: 'Justin S', avg: 44.9, isSub: false },
  { name: 'Mark L', avg: 47.3, isSub: false },
  { name: 'Mike S', avg: 46.1, isSub: false },
  { name: 'Rudy', avg: 49.1, isSub: false },
  { name: 'Terry S', avg: 48.6, isSub: false },
  { name: 'Tim B', avg: 47.2, isSub: false },
  { name: 'Tim M', avg: 46.1, isSub: false },
  { name: 'Tom K', avg: 51.0, isSub: true },
  { name: 'Lee N', avg: null, isSub: false },
  { name: 'Phil P', avg: null, isSub: false },
  { name: 'Joe D', avg: null, isSub: false },
  { name: 'Kevin F', avg: null, isSub: false },
  { name: 'Dan L', avg: 48.5, isSub: true },
];

export function buildDefaultProfiles(): PlayerProfile[] {
  return DEFAULT_ROSTER.map((entry, i) => ({
    id: `default-${i}`,
    name: entry.name,
    email: '',
    phone: '',
    photoUrl: '',
    handicap: entry.avg !== null ? calculateHandicap(entry.avg) : 0,
    previousSeasonAvg: entry.avg,
    isSub: entry.isSub,
    weeklyResults: [],
  }));
}
