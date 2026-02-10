import { useState, useCallback } from 'react';
import { generateSchedule, computeStats } from '../lib/scheduleEngine';
import type { ScheduleData, SavedSchedule } from '../lib/types';

const DEFAULT_PLAYERS = [
  'Bryon A', 'Buddha', 'David L', 'Jeff B', 'John M', 'Justin S',
  'Mark L', 'Mike S', 'Rudy', 'Terry S', 'Tim B', 'Tim M',
  'Tom K', 'Lee N', 'Kevin F', 'Joe D', 'Phil P',
];

interface Props {
  scheduleData: ScheduleData | null;
  setScheduleData: (data: ScheduleData) => void;
  savedSchedules: SavedSchedule[];
  onDelete: (id: string) => void;
  onLoad: (saved: SavedSchedule) => void;
  onNewSchedule: () => void;
}

export default function Schedule({
  scheduleData,
  setScheduleData,
  savedSchedules,
  onDelete,
  onLoad,
  onNewSchedule,
}: Props) {
  const [numPlayers, setNumPlayers] = useState('17');
  const [numWeeks, setNumWeeks] = useState('17');
  const [playerNames, setPlayerNames] = useState<string[]>([...DEFAULT_PLAYERS]);
  const [byeAssignments, setByeAssignments] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  const playerCount = parseInt(numPlayers) || 0;
  const weekCount = parseInt(numWeeks) || 0;

  const handlePlayerCountChange = useCallback((val: string) => {
    setNumPlayers(val);
    const count = parseInt(val) || 0;
    setPlayerNames((prev) =>
      Array.from({ length: count }, (_, i) => prev[i] || '')
    );
    setByeAssignments({});
  }, []);

  const handlePlayerNameChange = useCallback((index: number, name: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }, []);

  const handleByeChange = useCallback((playerIndex: number, weekStr: string) => {
    setByeAssignments((prev) => {
      const next = { ...prev };
      if (weekStr === '') {
        delete next[playerIndex];
      } else {
        next[playerIndex] = weekStr;
      }
      return next;
    });
  }, []);

  const getDisplayName = (index: number) =>
    playerNames[index]?.trim() || `Player ${index + 1}`;

  const handleGenerate = useCallback(() => {
    if (playerCount < 4) return;
    setIsGenerating(true);

    setTimeout(() => {
      try {
        const players = Array.from({ length: playerCount }, (_, i) =>
          playerNames[i]?.trim() || `Player ${i + 1}`
        );

        const assignedByes: Record<number, number[]> = {};
        Object.entries(byeAssignments).forEach(([playerIdx, weekStr]) => {
          const week = parseInt(weekStr);
          if (week && week >= 1 && week <= weekCount) {
            const wIdx = week - 1;
            if (!assignedByes[wIdx]) assignedByes[wIdx] = [];
            assignedByes[wIdx].push(parseInt(playerIdx));
          }
        });

        const data = generateSchedule(players, weekCount, assignedByes);
        setScheduleData(data);
        setShowSetup(false);
        onNewSchedule();
      } catch (e: any) {
        alert(e.message);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [playerCount, weekCount, playerNames, byeAssignments, setScheduleData, onNewSchedule]);

  const stats = scheduleData ? computeStats(scheduleData) : null;

  return (
    <>
      {/* Banner */}
      <div className="banner">
        <div className="banner-icon">&#127942;</div>
        <h1>Tuesday Golf League</h1>
        <p>Schedule Generator</p>
      </div>

      <div className="page-content">
        {showSetup ? (
          <>
            {/* League Setup */}
            <div className="card">
              <div className="card-title">League Setup</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Players</label>
                  <input
                    className="form-input"
                    type="number"
                    value={numPlayers}
                    onChange={(e) => handlePlayerCountChange(e.target.value)}
                    min={4}
                    max={99}
                  />
                </div>
                <div className="form-group">
                  <label>Weeks</label>
                  <input
                    className="form-input"
                    type="number"
                    value={numWeeks}
                    onChange={(e) => setNumWeeks(e.target.value)}
                    min={1}
                    max={52}
                  />
                </div>
              </div>
            </div>

            {/* Player Names */}
            {playerCount > 0 && (
              <div className="card">
                <div className="card-title">Player Names</div>
                <div className="player-name-grid">
                  {Array.from({ length: playerCount }, (_, i) => (
                    <div key={i} className="player-name-row">
                      <span className="player-number">{i + 1}</span>
                      <input
                        className="name-input"
                        placeholder={`Player ${i + 1}`}
                        value={playerNames[i] || ''}
                        onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bye Week Assignments */}
            {playerCount > 0 && weekCount > 0 && (
              <div className="card">
                <div className="card-title">Bye Week Assignments</div>
                <div className="card-subtitle">
                  Pre-assign bye weeks for players who know they'll be gone
                </div>
                {Array.from({ length: playerCount }, (_, i) => (
                  <div key={i} className="bye-row">
                    <span className="bye-name">{getDisplayName(i)}</span>
                    <input
                      className="bye-input"
                      placeholder="Week #"
                      value={byeAssignments[i] || ''}
                      onChange={(e) => handleByeChange(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Generate Button */}
            <button
              className="generate-btn"
              onClick={handleGenerate}
              disabled={playerCount < 4 || isGenerating}
            >
              {isGenerating ? (
                <span className="spinner" />
              ) : (
                <>&#9889; Generate Schedule</>
              )}
            </button>

            {/* Saved Schedules */}
            {savedSchedules.length > 0 && (
              <div className="card">
                <div className="card-title">Saved Schedules</div>
                {savedSchedules.map((saved) => (
                  <SavedScheduleRow
                    key={saved.id}
                    saved={saved}
                    onLoad={onLoad}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="card">
                <div className="card-title">Schedule Summary</div>
                <div className="stats-grid">
                  <div className="stat-chip">
                    <div className="stat-value">
                      {stats.pairsExactlyOnce}/{stats.totalPairs}
                    </div>
                    <div className="stat-label">Unique 1v1</div>
                  </div>
                  <div className="stat-chip">
                    <div className="stat-value">
                      {stats.matchupMin}-{stats.matchupMax}
                    </div>
                    <div className="stat-label">1v1 Range</div>
                  </div>
                  <div className="stat-chip">
                    <div className="stat-value">
                      {stats.foursomeMin}-{stats.foursomeMax}
                    </div>
                    <div className="stat-label">Foursome Range</div>
                  </div>
                  <div className="stat-chip">
                    <div className="stat-value">
                      {stats.byeMin}-{stats.byeMax}
                    </div>
                    <div className="stat-label">Byes/Player</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="action-row">
              <button
                className="action-btn primary"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <span className="spinner" />
                ) : (
                  <>&#8635; Regenerate</>
                )}
              </button>
              <button
                className="action-btn secondary"
                onClick={() => setShowSetup(true)}
              >
                &#9998; Edit Setup
              </button>
            </div>

            {/* Saved Schedules */}
            {savedSchedules.length > 0 && (
              <div className="card">
                <div className="card-title">Saved Schedules</div>
                {savedSchedules.map((saved) => (
                  <SavedScheduleRow
                    key={saved.id}
                    saved={saved}
                    onLoad={onLoad}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}

            {/* Weekly Schedule */}
            {scheduleData?.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week-card">
                <div className="week-header">
                  <div className="week-title">Week {weekIndex + 1}</div>
                  {week.byePlayers.length > 0 && (
                    <span className="bye-tag">
                      Bye: {week.byePlayers.map((i) => scheduleData.players[i]).join(', ')}
                    </span>
                  )}
                </div>

                {week.foursomes.map((foursome, fIdx) => (
                  <div key={fIdx} className="foursome-card">
                    <div className="foursome-title">Foursome {fIdx + 1}</div>
                    {foursome.matchups.map(([a, b], mIdx) => (
                      <div key={mIdx} className="matchup-row">
                        <div className="match-label">Match {mIdx + 1}</div>
                        <div className="match-players">
                          <span className="player-name">{scheduleData.players[a]}</span>
                          <span className="vs-badge">VS</span>
                          <span className="player-name">{scheduleData.players[b]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function SavedScheduleRow({
  saved,
  onLoad,
  onDelete,
}: {
  saved: SavedSchedule;
  onLoad: (s: SavedSchedule) => void;
  onDelete: (id: string) => void;
}) {
  const { stats } = saved;
  return (
    <div className="saved-row">
      <div className="saved-info">
        <div className="saved-name">{saved.name}</div>
        <div className="saved-meta">
          {saved.savedAt} &middot; {stats.pairsExactlyOnce}/{stats.totalPairs} unique 1v1
          &middot; Foursome {stats.foursomeMin}-{stats.foursomeMax}
        </div>
      </div>
      <div className="saved-actions">
        <button className="saved-load-btn" onClick={() => onLoad(saved)}>
          Load
        </button>
        <button className="saved-delete-btn" onClick={() => onDelete(saved.id)}>
          &times;
        </button>
      </div>
    </div>
  );
}
