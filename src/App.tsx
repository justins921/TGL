import { useState, useEffect, useCallback, useRef } from 'react';
import { buildDefaultProfiles, calculateHandicap } from './lib/types';
import type { ScheduleData, SavedSchedule, PlayerProfile } from './lib/types';
import { loadSchedules, saveSchedule, updateSchedule, deleteSchedule, loadPlayers, savePlayer, deletePlayer } from './lib/storage';
import { computeStats } from './lib/scheduleEngine';
import { AuthProvider, useAuth } from './lib/auth';

// Fix player profiles with missing/incorrect previous season averages
const PROFILE_AVG_FIXES: Record<string, number> = {
  'Joe D': 46.0,
  'Kevin F': 47.4,
  'Phil P': 46.0,
};

function computeSubAverage(playerName: string, scheduleData: ScheduleData | null): number | null {
  if (!scheduleData) return null;
  const scores = scheduleData.scores || {};
  const subs = scheduleData.substitutions || {};
  const totals: number[] = [];

  for (let w = 0; w < scheduleData.weeks.length; w++) {
    for (let pi = 0; pi < scheduleData.players.length; pi++) {
      if (subs[`${w}-${pi}`] !== playerName) continue;
      let total = 0;
      let complete = true;
      for (let h = 0; h < 9; h++) {
        const s = scores[`${w}-${pi}-${h}`];
        if (s === undefined) { complete = false; break; }
        total += s;
      }
      if (complete) totals.push(total);
    }
  }
  if (totals.length === 0) return null;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

function migratePlayerProfiles(
  loaded: PlayerProfile[],
  saveFn: (p: PlayerProfile) => void,
  scheduleData: ScheduleData | null
): PlayerProfile[] {
  let changed = false;
  const updated = loaded.map((p) => {
    // Fixed averages for known players
    const correctAvg = PROFILE_AVG_FIXES[p.name];
    if (correctAvg !== undefined && p.previousSeasonAvg !== correctAvg) {
      changed = true;
      const fixed = {
        ...p,
        previousSeasonAvg: correctAvg,
        handicap: calculateHandicap(correctAvg),
      };
      saveFn(fixed);
      return fixed;
    }
    // Compute average from sub appearances for subs with no previous avg
    if (p.isSub && p.previousSeasonAvg === null) {
      const subAvg = computeSubAverage(p.name, scheduleData);
      if (subAvg !== null) {
        changed = true;
        const rounded = Math.round(subAvg * 10) / 10;
        const fixed = {
          ...p,
          previousSeasonAvg: rounded,
          handicap: calculateHandicap(rounded),
        };
        saveFn(fixed);
        return fixed;
      }
    }
    return p;
  });
  return changed ? updated : loaded;
}
function migrateScheduleData(data: ScheduleData): ScheduleData {
  const leeIdx = data.players.indexOf('Lee N');
  const tomSubIdx = data.subs.indexOf('Tom K');
  if (leeIdx === -1 || tomSubIdx === -1) return data;

  const newPlayers = [...data.players];
  newPlayers[leeIdx] = 'Tom K';
  const newSubs = [...data.subs];
  newSubs[tomSubIdx] = 'Lee N';
  return { ...data, players: newPlayers, subs: newSubs };
}
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';
import Compare from './components/Compare';
import Players from './components/Players';
import Leaderboard from './components/Leaderboard';
import AdminLogin from './components/AdminLogin';

type Tab = 'schedule' | 'leaderboard' | 'analytics' | 'compare' | 'players';

const ALL_TABS: { id: Tab; label: string; icon: string; adminOnly: boolean }[] = [
  { id: 'schedule', label: 'Schedule', icon: '\u{1F4C5}', adminOnly: false },
  { id: 'leaderboard', label: 'Standings', icon: '\u{1F3C6}', adminOnly: false },
  { id: 'players', label: 'Players', icon: '\u{1F464}', adminOnly: false },
  { id: 'analytics', label: 'Analytics', icon: '\u{1F4CA}', adminOnly: false },
  { id: 'compare', label: 'Compare', icon: '\u2696', adminOnly: true },
];

function AppContent() {
  const { isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  // Load saved schedules and players on mount
  useEffect(() => {
    Promise.all([loadSchedules(), loadPlayers()]).then(([schedules, loaded]) => {
      const migratedSchedules = schedules.map((s) => ({ ...s, data: migrateScheduleData(s.data) }));
      setSavedSchedules(migratedSchedules);
      const activeData = migratedSchedules.length > 0 ? migratedSchedules[0].data : null;
      if (activeData && !scheduleData) {
        setScheduleData(activeData);
        setActiveScheduleId(migratedSchedules[0].id);
      }

      if (loaded.length === 0) {
        const defaults = buildDefaultProfiles();
        setPlayers(defaults);
        defaults.forEach((p) => savePlayer(p));
      } else {
        const migrated = migratePlayerProfiles(loaded, savePlayer, activeData);
        setPlayers(migrated);
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!scheduleData) return;
    const saved = await saveSchedule(scheduleData, saveName, savedSchedules.length);
    setSavedSchedules((prev) => [saved, ...prev]);
    setActiveScheduleId(saved.id);
    setSaveName('');
    setJustSaved(true);
  }, [scheduleData, saveName, savedSchedules.length]);

  const handleQuickSave = useCallback(async () => {
    if (!scheduleData || !activeScheduleId) return;
    await updateSchedule(activeScheduleId, scheduleData);
    setSavedSchedules((prev) =>
      prev.map((s) => s.id === activeScheduleId ? { ...s, data: scheduleData, stats: computeStats(scheduleData) } : s)
    );
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }, [scheduleData, activeScheduleId]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSchedule(id);
    setSavedSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleLoad = useCallback((saved: SavedSchedule) => {
    setScheduleData(saved.data);
    setActiveScheduleId(saved.id);
    setActiveTab('schedule');
    setJustSaved(false);
  }, []);

  const handleNewSchedule = useCallback(() => {
    setJustSaved(false);
  }, []);

  const handleSavePlayer = useCallback(async (player: PlayerProfile) => {
    await savePlayer(player);
    setPlayers((prev) => {
      const idx = prev.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = player;
        return next;
      }
      return [...prev, player];
    });
  }, []);

  const handleDeletePlayer = useCallback(async (id: string) => {
    await deletePlayer(id);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleTabSelect = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const visibleTabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);
  const activeLabel = visibleTabs.find((t) => t.id === activeTab);

  return (
    <div>
      <nav className="nav-bar" ref={menuRef}>
        <div className="nav-brand">
          <span className="nav-brand-icon">&#9971;</span>
          <span className="nav-brand-text">TGL</span>
        </div>

        <div className="nav-active-label">{activeLabel?.icon} {activeLabel?.label}</div>

        <div className="nav-right">
          <button
            className="nav-admin-btn"
            onClick={() => (isAdmin ? signOut() : setShowLogin(true))}
          >
            {isAdmin ? '\u{1F513} Logout' : '\u{1F512} Admin'}
          </button>
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span className={`hamburger-icon${menuOpen ? ' open' : ''}`}>
              <span /><span /><span />
            </span>
          </button>
        </div>

        {menuOpen && (
          <div className="nav-menu">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-menu-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => handleTabSelect(tab.id)}
              >
                <span className="nav-menu-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
            <div className="nav-menu-divider" />
            <button
              className="nav-menu-item nav-menu-admin"
              onClick={() => {
                setMenuOpen(false);
                if (isAdmin) signOut();
                else setShowLogin(true);
              }}
            >
              <span className="nav-menu-icon">{isAdmin ? '\u{1F513}' : '\u{1F512}'}</span>
              {isAdmin ? 'Logout' : 'Admin Login'}
            </button>
          </div>
        )}
      </nav>

      {/* Persistent save bar - admin only */}
      {isAdmin && scheduleData && activeTab !== 'players' && (
        <div className={`save-strip ${justSaved ? 'saved' : ''}`}>
          {justSaved ? (
            <div className="save-strip-success">
              <span className="save-check">&#10003;</span>
              <span>Saved!</span>
            </div>
          ) : activeScheduleId ? (
            <div className="save-strip-row">
              <button className="save-strip-btn" onClick={handleQuickSave}>
                Save
              </button>
            </div>
          ) : (
            <div className="save-strip-row">
              <input
                className="save-strip-input"
                placeholder="Name (optional)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button className="save-strip-btn" onClick={handleSave}>
                Save Schedule
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' ? (
        <Schedule
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          savedSchedules={savedSchedules}
          onDelete={handleDelete}
          onLoad={handleLoad}
          onNewSchedule={handleNewSchedule}
          onSave={handleQuickSave}
          isAdmin={isAdmin}
          playerProfiles={players}
        />
      ) : activeTab === 'leaderboard' ? (
        <Leaderboard
          scheduleData={scheduleData}
          playerProfiles={players}
        />
      ) : activeTab === 'players' ? (
        <Players
          players={players}
          onSave={handleSavePlayer}
          onDelete={handleDeletePlayer}
          isAdmin={isAdmin}
          scheduleData={scheduleData}
        />
      ) : activeTab === 'analytics' ? (
        <Analytics scheduleData={scheduleData} />
      ) : (
        <Compare
          savedSchedules={savedSchedules}
          onLoad={handleLoad}
          onDelete={handleDelete}
          isAdmin={isAdmin}
        />
      )}

      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
