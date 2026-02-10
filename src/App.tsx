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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSchedules));
  }, [savedSchedules]);

  const handleSave = useCallback((name: string) => {
    if (!scheduleData) return;
    const saved: SavedSchedule = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      savedAt: new Date().toLocaleString(),
      data: scheduleData,
      stats: computeStats(scheduleData),
    };
    setSavedSchedules((prev) => [saved, ...prev]);
  }, [scheduleData]);

  const handleDelete = useCallback((id: string) => {
    setSavedSchedules((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleLoad = useCallback((saved: SavedSchedule) => {
    setScheduleData(saved.data);
    setActiveTab('schedule');
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

      {activeTab === 'schedule' ? (
        <Schedule
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          savedSchedules={savedSchedules}
          onSave={handleSave}
          onDelete={handleDelete}
          onLoad={handleLoad}
        />
      ) : (
        <Analytics scheduleData={scheduleData} />
      )}
    </div>
  );
}

export default App;
