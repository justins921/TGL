import { supabase } from './supabase';
import { computeStats } from './scheduleEngine';
import type { SavedSchedule, ScheduleData, ScheduleStats } from './types';

const STORAGE_KEY = 'tgl-saved-schedules';

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
