import { useState, useEffect, useCallback } from 'react';
import type { ScheduleData, SavedSchedule } from './lib/types';
import { loadSchedules, saveSchedule, deleteSchedule } from './lib/storage';
import { AuthProvider, useAuth } from './lib/auth';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';
import Compare from './components/Compare';
import AdminLogin from './components/AdminLogin';

function AppContent() {
  const { isAdmin, user, signOut, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics' | 'compare'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Load saved schedules on mount
  useEffect(() => {
    loadSchedules().then((schedules) => {
      setSavedSchedules(schedules);
      // Auto-load the most recent saved schedule for public viewers
      if (schedules.length > 0 && !scheduleData) {
        setScheduleData(schedules[0].data);
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
        <button
          className="tab-btn admin-btn"
          onClick={() => (user ? signOut() : setShowLogin(true))}
        >
          {user ? <>&#128275; Logout</> : <>&#128274; Admin</>}
        </button>
      </nav>

      {/* Persistent save bar - admin only */}
      {isAdmin && scheduleData && (
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
