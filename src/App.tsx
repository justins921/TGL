import { useState, useEffect, useCallback } from 'react';
import type { ScheduleData, SavedSchedule } from './lib/types';
import { loadSchedules, saveSchedule, deleteSchedule } from './lib/storage';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';
import Compare from './components/Compare';

function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics' | 'compare'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Load saved schedules on mount (works with both Supabase and localStorage)
  useEffect(() => {
    loadSchedules().then(setSavedSchedules);
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
      </nav>

      {/* Persistent save bar - visible on any tab when there's schedule data */}
      {scheduleData && (
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
        />
      ) : activeTab === 'analytics' ? (
        <Analytics scheduleData={scheduleData} />
      ) : (
        <Compare
          savedSchedules={savedSchedules}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default App;
