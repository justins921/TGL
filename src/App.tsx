import { useState, useEffect, useCallback } from 'react';
import { buildDefaultProfiles } from './lib/types';
import type { ScheduleData, SavedSchedule, PlayerProfile } from './lib/types';
import { loadSchedules, saveSchedule, deleteSchedule, loadPlayers, savePlayer, deletePlayer } from './lib/storage';
import { AuthProvider, useAuth } from './lib/auth';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';
import Compare from './components/Compare';
import Players from './components/Players';
import Leaderboard from './components/Leaderboard';
import AdminLogin from './components/AdminLogin';

function AppContent() {
  const { isAdmin, user, signOut, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'leaderboard' | 'analytics' | 'compare' | 'players'>('schedule');
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

  if (authLoading) return null;

  return (
    <div>
      <nav className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          &#128197; Schedule
        </button>
        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          &#127942; Standings
        </button>
        <button
          className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          &#128100; Players
        </button>
        {isAdmin && (
          <>
            <button
              className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              &#128202; Analytics
            </button>
            <button
              className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              &#9878; Compare
            </button>
          </>
        )}
        <button
          className="tab-btn admin-btn"
          onClick={() => (user ? signOut() : setShowLogin(true))}
        >
          {user ? <>&#128275; Logout</> : <>&#128274; Admin</>}
        </button>
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
