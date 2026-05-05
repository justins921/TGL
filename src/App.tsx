import { useState, useEffect, useCallback, useRef } from 'react';
import { buildDefaultProfiles } from './lib/types';
import type { ScheduleData, SavedSchedule, PlayerProfile } from './lib/types';
import { loadSchedules, saveSchedule, updateSchedule, deleteSchedule, loadPlayers, savePlayer, deletePlayer } from './lib/storage';
import { computeStats } from './lib/scheduleEngine';
import { AuthProvider, useAuth } from './lib/auth';

// One-time migration: swap Tom K (injured) ↔ Lee N (returning) in schedule data
function migrateScheduleData(data: ScheduleData): ScheduleData {
  const tomIdx = data.players.indexOf('Tom K');
  const leeSubIdx = data.subs.indexOf('Lee N');
  if (tomIdx === -1 || leeSubIdx === -1) return data; // already migrated or different roster

  const newPlayers = [...data.players];
  newPlayers[tomIdx] = 'Lee N';
  const newSubs = [...data.subs];
  newSubs[leeSubIdx] = 'Tom K';
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
    loadSchedules().then((schedules) => {
      const migrated = schedules.map((s) => ({ ...s, data: migrateScheduleData(s.data) }));
      setSavedSchedules(migrated);
      if (migrated.length > 0 && !scheduleData) {
        setScheduleData(migrated[0].data);
        setActiveScheduleId(migrated[0].id);
      }
    });
    loadPlayers().then((loaded) => {
      if (loaded.length === 0) {
        const defaults = buildDefaultProfiles();
        setPlayers(defaults);
        defaults.forEach((p) => savePlayer(p));
      } else {
        setPlayers(loaded);
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

  // Auto-save schedule changes (scores, subs, dates, foursome swaps)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!scheduleData || !activeScheduleId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      updateSchedule(activeScheduleId, scheduleData);
      setSavedSchedules((prev) =>
        prev.map((s) => s.id === activeScheduleId ? { ...s, data: scheduleData, stats: computeStats(scheduleData) } : s)
      );
    }, 1000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
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
              <span>Schedule saved!</span>
              <button
                className="save-another-btn"
                onClick={() => setJustSaved(false)}
              >
                Save Another Copy
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
