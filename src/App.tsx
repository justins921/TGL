import { useState } from 'react';
import type { ScheduleData } from './lib/types';
import Schedule from './components/Schedule';
import Analytics from './components/Analytics';

function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'analytics'>('schedule');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);

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
        <Schedule scheduleData={scheduleData} setScheduleData={setScheduleData} />
      ) : (
        <Analytics scheduleData={scheduleData} />
      )}
    </div>
  );
}

export default App;
