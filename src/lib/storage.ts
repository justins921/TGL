import { supabase } from './supabase';
import { computeStats } from './scheduleEngine';
import type { SavedSchedule, ScheduleData, ScheduleStats, PlayerProfile } from './types';

const STORAGE_KEY = 'tgl-saved-schedules';
const PLAYERS_KEY = 'tgl-players';

// ── Database row shape ──

interface ScheduleRow {
  id: string;
  name: string;
  saved_at: string;
  data: ScheduleData;
  stats: ScheduleStats;
}

// ── Local Storage helpers ──

function localLoad(): SavedSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function localSave(schedules: SavedSchedule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

// ── Public API ──

export async function loadSchedules(): Promise<SavedSchedule[]> {
  if (!supabase) return localLoad();

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('saved_at', { ascending: false });

  if (error) {
    console.warn('Supabase load failed, falling back to localStorage:', error.message);
    return localLoad();
  }

  return (data as ScheduleRow[]).map(rowToSaved);
}

export async function saveSchedule(
  scheduleData: ScheduleData,
  name: string,
  existingCount: number
): Promise<SavedSchedule> {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const displayName = name.trim() || `Schedule ${existingCount + 1}`;
  const savedAt = new Date().toISOString();
  const stats = computeStats(scheduleData);

  const saved: SavedSchedule = {
    id,
    name: displayName,
    savedAt: new Date(savedAt).toLocaleString(),
    data: scheduleData,
    stats,
  };

  if (!supabase) {
    const current = localLoad();
    localSave([saved, ...current]);
    return saved;
  }

  const { error } = await supabase.from('schedules').insert({
    id,
    name: displayName,
    saved_at: savedAt,
    data: scheduleData,
    stats,
  });

  if (error) {
    console.warn('Supabase save failed, falling back to localStorage:', error.message);
    const current = localLoad();
    localSave([saved, ...current]);
  }

  return saved;
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!supabase) {
    const current = localLoad();
    localSave(current.filter((s) => s.id !== id));
    return;
  }

  const { error } = await supabase.from('schedules').delete().eq('id', id);

  if (error) {
    console.warn('Supabase delete failed, falling back to localStorage:', error.message);
    const current = localLoad();
    localSave(current.filter((s) => s.id !== id));
  }
}

// ── Helpers ──

function rowToSaved(row: ScheduleRow): SavedSchedule {
  return {
    id: row.id,
    name: row.name,
    savedAt: new Date(row.saved_at).toLocaleString(),
    data: row.data,
    stats: row.stats,
  };
}

// ══════════════════════════════════════
// ── Players ──
// ══════════════════════════════════════

interface PlayerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo_url: string;
  handicap: number;
  previous_season_avg: number | null;
  is_sub: boolean;
  weekly_results: { week: number; score: number }[];
}

function localLoadPlayers(): PlayerProfile[] {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function localSavePlayers(players: PlayerProfile[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
}

export async function loadPlayers(): Promise<PlayerProfile[]> {
  if (!supabase) return localLoadPlayers();

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.warn('Supabase players load failed, falling back to localStorage:', error.message);
    return localLoadPlayers();
  }

  return (data as PlayerRow[]).map(rowToPlayer);
}

export async function savePlayer(player: PlayerProfile): Promise<void> {
  if (!supabase) {
    const current = localLoadPlayers();
    const idx = current.findIndex((p) => p.id === player.id);
    if (idx >= 0) {
      current[idx] = player;
    } else {
      current.push(player);
    }
    localSavePlayers(current);
    return;
  }

  const { error } = await supabase.from('players').upsert(playerToRow(player));

  if (error) {
    console.warn('Supabase player save failed, falling back to localStorage:', error.message);
    const current = localLoadPlayers();
    const idx = current.findIndex((p) => p.id === player.id);
    if (idx >= 0) {
      current[idx] = player;
    } else {
      current.push(player);
    }
    localSavePlayers(current);
  }
}

export async function deletePlayer(id: string): Promise<void> {
  if (!supabase) {
    const current = localLoadPlayers();
    localSavePlayers(current.filter((p) => p.id !== id));
    return;
  }

  const { error } = await supabase.from('players').delete().eq('id', id);

  if (error) {
    console.warn('Supabase player delete failed, falling back to localStorage:', error.message);
    const current = localLoadPlayers();
    localSavePlayers(current.filter((p) => p.id !== id));
  }
}

function rowToPlayer(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photo_url,
    handicap: row.handicap,
    previousSeasonAvg: row.previous_season_avg,
    isSub: row.is_sub,
    weeklyResults: row.weekly_results || [],
  };
}

function playerToRow(p: PlayerProfile): PlayerRow {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    photo_url: p.photoUrl,
    handicap: p.handicap,
    previous_season_avg: p.previousSeasonAvg,
    is_sub: p.isSub,
    weekly_results: p.weeklyResults,
  };
}
