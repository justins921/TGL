import { useState, useEffect, useCallback } from 'react';
import type { ScheduleData, SavedSchedule } from './lib/types';
import { computeStats } from './lib/scheduleEngine';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';

const STORAGE_KEY = 'tgl-saved-schedules';

function loadSaved(): SavedSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>(loadSaved);
  const [saveName, setSaveName] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSchedules));
  }, [savedSchedules]);

  const handleSave = useCallback(() => {
    if (!scheduleData) return;
    const name = saveName.trim() || `Schedule ${savedSchedules.length + 1}`;
    const saved: SavedSchedule = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      savedAt: new Date().toLocaleString(),
      data: scheduleData,
      stats: computeStats(scheduleData),
    };
    setSavedSchedules((prev) => [saved, ...prev]);
    setSaveName('');
    setJustSaved(true);
  }, [scheduleData, saveName, savedSchedules.length]);

  const handleDelete = useCallback((id: string) => {
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
      ) : (
        <Analytics scheduleData={scheduleData} />
      )}
    </div>
  );
}

export default App;
