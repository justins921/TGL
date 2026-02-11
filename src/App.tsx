import { useState, useEffect, useCallback, useRef } from 'react';
import type { ScheduleData, SavedSchedule, PlayerProfile } from './lib/types';
import { loadSchedules, saveSchedule, deleteSchedule, loadPlayers, savePlayer, deletePlayer } from './lib/storage';
import { AuthProvider, useAuth } from './lib/auth';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';
import Compare from './components/Compare';
import Players from './components/Players';
import AdminLogin from './components/AdminLogin';

function AppContent() {
  const { isAdmin, user, signOut, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics' | 'compare' | 'players'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Load saved schedules and players on mount
  useEffect(() => {
    loadSchedules().then((schedules) => {
      setSavedSchedules(schedules);
      if (schedules.length > 0 && !scheduleData) {
        setScheduleData(schedules[0].data);
      }
    });
    loadPlayers().then(setPlayers);
  }, []);

  const handleSave = useCallback(async () => {
    if (!scheduleData) return;
    const saved = await saveSchedule(scheduleData, saveName, savedSchedules.length);
    setSavedSchedules((prev) => [saved, ...prev]);
    setSaveName('');
    setJustSaved(true);
  }, [scheduleData, saveName, savedSchedules.length]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSchedule(id);
    setSavedSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleLoad = useCallback((saved: SavedSchedule) => {
    setScheduleData(saved.data);
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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when tapping outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  const tabLabels: Record<string, string> = {
    schedule: 'Schedule',
    players: 'Players',
    analytics: 'Analytics',
    compare: 'Compare',
  };

  if (authLoading) return null;

  return (
    <div>
      {/* iOS-style top navigation bar */}
      <header className="top-bar" ref={menuRef}>
        <span className="top-bar-title">{tabLabels[activeTab]}</span>
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className={`hamburger-icon ${menuOpen ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>

        {menuOpen && (
          <div className="menu-dropdown">
            {(['schedule', 'players', 'analytics', 'compare'] as const).map((tab) => (
              <button
                key={tab}
                className={`menu-item ${activeTab === tab ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
              >
                <span className="menu-item-icon">
                  {tab === 'schedule' && '\u{1F4C5}'}
                  {tab === 'players' && '\u{1F464}'}
                  {tab === 'analytics' && '\u{1F4CA}'}
                  {tab === 'compare' && '\u{2696}'}
                </span>
                {tabLabels[tab]}
                {activeTab === tab && <span className="menu-check">{'\u{2713}'}</span>}
              </button>
            ))}
            <div className="menu-divider" />
            <button
              className="menu-item"
              onClick={() => {
                if (user) { signOut(); } else { setShowLogin(true); }
                setMenuOpen(false);
              }}
            >
              <span className="menu-item-icon">
                {user ? '\u{1F513}' : '\u{1F512}'}
              </span>
              {user ? 'Log Out' : 'Admin Login'}
            </button>
          </div>
        )}
      </header>

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
