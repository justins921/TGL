import { sql } from './neon';
import { computeStats } from './scheduleEngine';
import type { SavedSchedule, ScheduleData, ScheduleStats, PlayerProfile } from './types';

const STORAGE_KEY = 'tgl-saved-schedules';
const PLAYERS_KEY = 'tgl-players';

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

// ── Row mappers ──

interface ScheduleRow {
  id: string;
  name: string;
  saved_at: string;
  data: ScheduleData;
  stats: ScheduleStats;
}

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

function rowToSaved(row: ScheduleRow): SavedSchedule {
  return {
    id: row.id,
    name: row.name,
    savedAt: new Date(row.saved_at).toLocaleString(),
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
  };
}

function rowToPlayer(row: PlayerRow): PlayerProfile {
  const results = typeof row.weekly_results === 'string'
    ? JSON.parse(row.weekly_results)
    : row.weekly_results;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photo_url,
    handicap: Number(row.handicap),
    previousSeasonAvg: row.previous_season_avg !== null ? Number(row.previous_season_avg) : null,
    isSub: row.is_sub,
    weeklyResults: results || [],
  };
}

// ══════════════════════════════════════
// ── Schedules ──
// ══════════════════════════════════════

export async function loadSchedules(): Promise<SavedSchedule[]> {
  if (!sql) return localLoad();

  try {
    const rows = await sql`SELECT * FROM schedules ORDER BY saved_at DESC`;
    return (rows as ScheduleRow[]).map(rowToSaved);
  } catch (e) {
    console.warn('Database load failed, falling back to localStorage:', e);
    return localLoad();
  }
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

  if (!sql) {
    const current = localLoad();
    localSave([saved, ...current]);
    return saved;
  }

  try {
    await sql`INSERT INTO schedules (id, name, saved_at, data, stats)
              VALUES (${id}, ${displayName}, ${savedAt}, ${JSON.stringify(scheduleData)}, ${JSON.stringify(stats)})`;
  } catch (e) {
    console.warn('Database save failed, falling back to localStorage:', e);
    const current = localLoad();
    localSave([saved, ...current]);
  }

  return saved;
}

export async function updateSchedule(id: string, scheduleData: ScheduleData): Promise<void> {
  const stats = computeStats(scheduleData);

  if (!sql) {
    const current = localLoad();
    localSave(current.map((s) =>
      s.id === id ? { ...s, data: scheduleData, stats } : s
    ));
    return;
  }

  try {
    await sql`UPDATE schedules SET data = ${JSON.stringify(scheduleData)}, stats = ${JSON.stringify(stats)} WHERE id = ${id}`;
  } catch (e) {
    console.warn('Database update failed, falling back to localStorage:', e);
    const current = localLoad();
    localSave(current.map((s) =>
      s.id === id ? { ...s, data: scheduleData, stats } : s
    ));
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!sql) {
    const current = localLoad();
    localSave(current.filter((s) => s.id !== id));
    return;
  }

  try {
    await sql`DELETE FROM schedules WHERE id = ${id}`;
  } catch (e) {
    console.warn('Database delete failed, falling back to localStorage:', e);
    const current = localLoad();
    localSave(current.filter((s) => s.id !== id));
  }
}

// ══════════════════════════════════════
// ── Players ──
// ══════════════════════════════════════

export async function loadPlayers(): Promise<PlayerProfile[]> {
  if (!sql) return localLoadPlayers();

  try {
    const rows = await sql`SELECT * FROM players ORDER BY name ASC`;
    return (rows as PlayerRow[]).map(rowToPlayer);
  } catch (e) {
    console.warn('Database players load failed, falling back to localStorage:', e);
    return localLoadPlayers();
  }
}

export async function savePlayer(player: PlayerProfile): Promise<void> {
  if (!sql) {
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

  try {
    await sql`INSERT INTO players (id, name, email, phone, photo_url, handicap, previous_season_avg, is_sub, weekly_results)
              VALUES (${player.id}, ${player.name}, ${player.email}, ${player.phone}, ${player.photoUrl},
                      ${player.handicap}, ${player.previousSeasonAvg}, ${player.isSub}, ${JSON.stringify(player.weeklyResults)})
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                photo_url = EXCLUDED.photo_url,
                handicap = EXCLUDED.handicap,
                previous_season_avg = EXCLUDED.previous_season_avg,
                is_sub = EXCLUDED.is_sub,
                weekly_results = EXCLUDED.weekly_results`;
  } catch (e) {
    console.warn('Database player save failed, falling back to localStorage:', e);
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
  if (!sql) {
    const current = localLoadPlayers();
    localSavePlayers(current.filter((p) => p.id !== id));
    return;
  }

  try {
    await sql`DELETE FROM players WHERE id = ${id}`;
  } catch (e) {
    console.warn('Database player delete failed, falling back to localStorage:', e);
    const current = localLoadPlayers();
    localSavePlayers(current.filter((p) => p.id !== id));
  }
}
