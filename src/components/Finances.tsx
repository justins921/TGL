import { useState, useCallback, useMemo } from 'react';
import type { PlayerProfile, ScheduleData } from '../lib/types';
import SpinWheel from './SpinWheel';

// ── Data types ──

interface WeekFinance {
  id: string;
  date: string;
  weekLabel: string;
  front9Winner: string;
  back9Winner: string;
  fiftyFiftyEnabled: boolean;
  fiftyFiftyWinner: string;
  fiftyFiftyAmount: number;
  hotHole: number | null;
  hotHoleWinner: string;
  fines: Record<string, number>;
  payments: Record<string, { front9: boolean; back9: boolean; fiftyFifty: boolean; hotHole: boolean }>;
}

interface FinancesData {
  weeks: WeekFinance[];
}

interface Props {
  isAdmin: boolean;
  players: PlayerProfile[];
  scheduleData: ScheduleData | null;
}

const STORAGE_KEY = 'tgl-finances';

function loadFinances(): FinancesData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { weeks: [] };
}

function saveFinances(data: FinancesData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function emptyWeek(weekLabel: string): WeekFinance {
  return {
    id: generateId(),
    date: new Date().toISOString().slice(0, 10),
    weekLabel,
    front9Winner: '',
    back9Winner: '',
    fiftyFiftyEnabled: true,
    fiftyFiftyWinner: '',
    fiftyFiftyAmount: 0,
    hotHole: null,
    hotHoleWinner: '',
    fines: {},
    payments: {},
  };
}

const HOT_HOLE_SEGMENTS = [
  '1 or 10', '2 or 11', '3 or 12', '4 or 13', '5 or 14',
  '6 or 15', '7 or 16', '8 or 17', '9 or 18',
];

type Section = 'entry' | 'summary' | 'checklist' | 'randomizers';

export default function Finances({ isAdmin, players, scheduleData: _scheduleData }: Props) {
  const [data, setData] = useState<FinancesData>(loadFinances);
  const [activeSection, setActiveSection] = useState<Section>('entry');
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(
    () => data.weeks.length > 0 ? data.weeks[data.weeks.length - 1].id : null
  );
  const [justSaved, setJustSaved] = useState(false);
  const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set());
  const [hotHoleResult, setHotHoleResult] = useState<string | null>(null);
  const [fiftyFiftyResult, setFiftyFiftyResult] = useState<string | null>(null);

  // Derive player name list (non-subs only for fines/payments)
  const playerNames = useMemo(() => {
    return players
      .filter((p) => !p.isSub)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => p.name);
  }, [players]);

  // All players including subs for 50/50 wheel
  const allPlayerNames = useMemo(() => {
    return players
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => p.name);
  }, [players]);

  // Sub names for default exclusion
  const subNames = useMemo(() => {
    return new Set(players.filter((p) => p.isSub).map((p) => p.name));
  }, [players]);

  // Initialize excluded with subs on first render
  const [excludeInitialized, setExcludeInitialized] = useState(false);
  if (!excludeInitialized && subNames.size > 0) {
    setExcludedPlayers(new Set(subNames));
    setExcludeInitialized(true);
  }

  // Guest players added for 50/50
  const [guestPlayers, setGuestPlayers] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState('');

  // All names for 50/50 wheel (players + guests, minus excluded)
  const fiftyFiftyAllNames = useMemo(() => {
    return [...allPlayerNames, ...guestPlayers];
  }, [allPlayerNames, guestPlayers]);

  const fiftyFiftyPlayers = useMemo(() => {
    return fiftyFiftyAllNames.filter((n) => !excludedPlayers.has(n));
  }, [fiftyFiftyAllNames, excludedPlayers]);

  // Derive foursome options from schedule data
  const foursomeOptions = useMemo(() => {
    const base = ['F1', 'F2', 'F3', 'F4', 'Push'];
    return base;
  }, []);

  const selectedWeek = useMemo(
    () => data.weeks.find((w) => w.id === selectedWeekId) || null,
    [data.weeks, selectedWeekId]
  );

  // ── Persist helper ──
  const persist = useCallback((next: FinancesData) => {
    setData(next);
    saveFinances(next);
  }, []);

  // ── Week CRUD ──
  const handleAddWeek = useCallback(() => {
    const label = `Week ${data.weeks.length + 1}`;
    const week = emptyWeek(label);
    const next = { weeks: [...data.weeks, week] };
    persist(next);
    setSelectedWeekId(week.id);
  }, [data, persist]);

  const handleDeleteWeek = useCallback(() => {
    if (!selectedWeekId) return;
    if (!confirm('Delete this week? This cannot be undone.')) return;
    const next = { weeks: data.weeks.filter((w) => w.id !== selectedWeekId) };
    persist(next);
    setSelectedWeekId(next.weeks.length > 0 ? next.weeks[next.weeks.length - 1].id : null);
  }, [data, selectedWeekId, persist]);

  // ── Field updaters ──
  const updateWeek = useCallback((id: string, patch: Partial<WeekFinance>) => {
    const next = {
      weeks: data.weeks.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    };
    persist(next);
  }, [data, persist]);

  const handleSave = useCallback(() => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }, []);

  // ── Payment toggle ──
  const togglePayment = useCallback(
    (weekId: string, playerName: string, field: 'front9' | 'back9' | 'fiftyFifty' | 'hotHole') => {
      const week = data.weeks.find((w) => w.id === weekId);
      if (!week) return;
      const current = week.payments[playerName] || { front9: false, back9: false, fiftyFifty: false, hotHole: false };
      updateWeek(weekId, {
        payments: {
          ...week.payments,
          [playerName]: { ...current, [field]: !current[field] },
        },
      });
    },
    [data, updateWeek]
  );

  // ── Summary computations ──
  const finesLeaderboard = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const w of data.weeks) {
      for (const [name, amount] of Object.entries(w.fines)) {
        if (amount > 0) {
          totals[name] = (totals[name] || 0) + amount;
        }
      }
    }
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({ name, total }));
  }, [data.weeks]);

  const fiftyFiftyHistory = useMemo(() => {
    return data.weeks
      .filter((w) => w.fiftyFiftyEnabled && w.fiftyFiftyWinner)
      .map((w) => ({ weekLabel: w.weekLabel, date: w.date, winner: w.fiftyFiftyWinner, amount: w.fiftyFiftyAmount }));
  }, [data.weeks]);

  const winCounts = useMemo(() => {
    const front9: Record<string, number> = {};
    const back9: Record<string, number> = {};
    for (const w of data.weeks) {
      if (w.front9Winner && w.front9Winner !== 'Push') {
        front9[w.front9Winner] = (front9[w.front9Winner] || 0) + 1;
      }
      if (w.back9Winner && w.back9Winner !== 'Push') {
        back9[w.back9Winner] = (back9[w.back9Winner] || 0) + 1;
      }
    }
    return { front9, back9 };
  }, [data.weeks]);

  const pushPotTotal = useMemo(() => {
    let total = 0;
    const playerCount = playerNames.length || 16;
    for (const w of data.weeks) {
      if (w.front9Winner === 'Push') total += 5 * playerCount;
      if (w.back9Winner === 'Push') total += 5 * playerCount;
    }
    return total;
  }, [data.weeks, playerNames.length]);

  const totalFines = useMemo(() => {
    return finesLeaderboard.reduce((sum, e) => sum + e.total, 0);
  }, [finesLeaderboard]);

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // ── Sections ──
  const sections: { id: Section; label: string }[] = [
    { id: 'entry', label: 'Weekly Entry' },
    { id: 'summary', label: 'Summary' },
    { id: 'checklist', label: 'Payments' },
    { id: 'randomizers', label: 'Randomizers' },
  ];

  return (
    <div className="page-content">
      {/* Header card */}
      <div className="card">
        <div className="card-title">Finances</div>
        <div className="card-subtitle">Track weekly bets, fines, and payments</div>
      </div>

      {/* Section tabs */}
      <div className="tourn-section-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`tourn-section-tab${activeSection === s.id ? ' active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ════════════════ Weekly Entry ════════════════ */}
      {activeSection === 'entry' && (
        <>
          {/* Week selector */}
          <div className="card">
            <div className="fin-week-selector">
              <select
                className="avail-select"
                value={selectedWeekId || ''}
                onChange={(e) => setSelectedWeekId(e.target.value || null)}
              >
                <option value="">Select a week...</option>
                {data.weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.weekLabel} - {formatDate(w.date)}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <div className="fin-week-actions">
                  <button className="fin-add-week-btn" onClick={handleAddWeek}>
                    + Add Week
                  </button>
                  {selectedWeekId && (
                    <button className="fin-delete-week-btn" onClick={handleDeleteWeek}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedWeek ? (
            <>
              {/* Week details form */}
              <div className="card">
                <div className="card-title" style={{ fontSize: 14 }}>Week Details</div>
                <div className="fin-form-grid">
                  {/* Week Label */}
                  <div className="fin-field">
                    <label>Week Label</label>
                    {isAdmin ? (
                      <input
                        className="fin-input"
                        value={selectedWeek.weekLabel}
                        onChange={(e) => updateWeek(selectedWeek.id, { weekLabel: e.target.value })}
                      />
                    ) : (
                      <div className="fin-value">{selectedWeek.weekLabel}</div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="fin-field">
                    <label>Date</label>
                    {isAdmin ? (
                      <input
                        className="fin-input"
                        type="date"
                        value={selectedWeek.date}
                        onChange={(e) => updateWeek(selectedWeek.id, { date: e.target.value })}
                      />
                    ) : (
                      <div className="fin-value">{formatDate(selectedWeek.date)}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Front 9 / Back 9 */}
              <div className="card">
                <div className="card-title" style={{ fontSize: 14 }}>Best Ball Results</div>
                <div className="fin-form-grid">
                  <div className="fin-field">
                    <label>Front 9 Winner ($5/player)</label>
                    {isAdmin ? (
                      <div className="fin-combo">
                        <select
                          className="avail-select"
                          value={foursomeOptions.includes(selectedWeek.front9Winner) ? selectedWeek.front9Winner : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') return;
                            updateWeek(selectedWeek.id, { front9Winner: e.target.value });
                          }}
                        >
                          <option value="">Select...</option>
                          {foursomeOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                          <option value="__custom__">Custom...</option>
                        </select>
                        {!foursomeOptions.includes(selectedWeek.front9Winner) && selectedWeek.front9Winner !== '' && (
                          <input
                            className="fin-input"
                            placeholder="Custom team name"
                            value={selectedWeek.front9Winner}
                            onChange={(e) => updateWeek(selectedWeek.id, { front9Winner: e.target.value })}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="fin-value">{selectedWeek.front9Winner || '-'}</div>
                    )}
                  </div>

                  <div className="fin-field">
                    <label>Back 9 Winner ($5/player)</label>
                    {isAdmin ? (
                      <div className="fin-combo">
                        <select
                          className="avail-select"
                          value={foursomeOptions.includes(selectedWeek.back9Winner) ? selectedWeek.back9Winner : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') return;
                            updateWeek(selectedWeek.id, { back9Winner: e.target.value });
                          }}
                        >
                          <option value="">Select...</option>
                          {foursomeOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                          <option value="__custom__">Custom...</option>
                        </select>
                        {!foursomeOptions.includes(selectedWeek.back9Winner) && selectedWeek.back9Winner !== '' && (
                          <input
                            className="fin-input"
                            placeholder="Custom team name"
                            value={selectedWeek.back9Winner}
                            onChange={(e) => updateWeek(selectedWeek.id, { back9Winner: e.target.value })}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="fin-value">{selectedWeek.back9Winner || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 50/50 */}
              <div className="card">
                <div className="card-title" style={{ fontSize: 14 }}>50/50 ($10/player)</div>
                {isAdmin ? (
                  <>
                    <label className="fin-toggle-label">
                      <input
                        type="checkbox"
                        checked={selectedWeek.fiftyFiftyEnabled}
                        onChange={(e) => updateWeek(selectedWeek.id, { fiftyFiftyEnabled: e.target.checked })}
                      />
                      <span>50/50 active this week</span>
                    </label>
                    {selectedWeek.fiftyFiftyEnabled && (
                      <div className="fin-form-grid" style={{ marginTop: 12 }}>
                        <div className="fin-field">
                          <label>Winner</label>
                          <select
                            className="avail-select"
                            value={selectedWeek.fiftyFiftyWinner}
                            onChange={(e) => updateWeek(selectedWeek.id, { fiftyFiftyWinner: e.target.value })}
                          >
                            <option value="">Select player...</option>
                            {playerNames.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div className="fin-field">
                          <label>Amount Won</label>
                          <div className="fin-dollar-input">
                            <span className="fin-dollar-sign">$</span>
                            <input
                              className="fin-input"
                              type="number"
                              min={0}
                              value={selectedWeek.fiftyFiftyAmount || ''}
                              onChange={(e) => updateWeek(selectedWeek.id, { fiftyFiftyAmount: Number(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="fin-readonly-row">
                      <span className="fin-readonly-label">Status:</span>
                      <span>{selectedWeek.fiftyFiftyEnabled ? 'Active' : 'Not this week'}</span>
                    </div>
                    {selectedWeek.fiftyFiftyEnabled && (
                      <>
                        <div className="fin-readonly-row">
                          <span className="fin-readonly-label">Winner:</span>
                          <span>{selectedWeek.fiftyFiftyWinner || '-'}</span>
                        </div>
                        <div className="fin-readonly-row">
                          <span className="fin-readonly-label">Amount:</span>
                          <span>${selectedWeek.fiftyFiftyAmount}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Hot Hole */}
              <div className="card">
                <div className="card-title" style={{ fontSize: 14 }}>Hot Hole ($1/player)</div>
                {isAdmin ? (
                  <div className="fin-form-grid">
                    <div className="fin-field">
                      <label>Hole Number</label>
                      <select
                        className="avail-select"
                        value={selectedWeek.hotHole ?? ''}
                        onChange={(e) => updateWeek(selectedWeek.id, { hotHole: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">None</option>
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
                          <option key={h} value={h}>Hole {h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="fin-field">
                      <label>Winning Team</label>
                      <select
                        className="avail-select"
                        value={selectedWeek.hotHoleWinner}
                        onChange={(e) => updateWeek(selectedWeek.id, { hotHoleWinner: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {['F1', 'F2', 'F3', 'F4'].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="fin-readonly-row">
                      <span className="fin-readonly-label">Hole:</span>
                      <span>{selectedWeek.hotHole ? `Hole ${selectedWeek.hotHole}` : '-'}</span>
                    </div>
                    <div className="fin-readonly-row">
                      <span className="fin-readonly-label">Winner:</span>
                      <span>{selectedWeek.hotHoleWinner || '-'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Fines */}
              <div className="card">
                <div className="card-title" style={{ fontSize: 14 }}>Fines</div>
                <div className="card-subtitle">Dollar amounts for each player this week</div>
                <div className="fin-fines-list">
                  {playerNames.map((name) => (
                    <div key={name} className="fin-fine-row">
                      <span className="fin-fine-name">{name}</span>
                      {isAdmin ? (
                        <div className="fin-dollar-input fin-dollar-sm">
                          <span className="fin-dollar-sign">$</span>
                          <input
                            className="fin-input fin-fine-input"
                            type="number"
                            min={0}
                            value={selectedWeek.fines[name] || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateWeek(selectedWeek.id, {
                                fines: { ...selectedWeek.fines, [name]: val },
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <span className={`fin-fine-amount${(selectedWeek.fines[name] || 0) > 0 ? ' has-fine' : ''}`}>
                          {(selectedWeek.fines[name] || 0) > 0 ? `$${selectedWeek.fines[name]}` : '-'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Save button (admin) */}
              {isAdmin && (
                <button
                  className="generate-btn"
                  onClick={handleSave}
                  style={justSaved ? { background: 'linear-gradient(135deg, var(--green-700), var(--green-600))' } : undefined}
                >
                  {justSaved ? 'Saved!' : 'Save Week'}
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="icon">&#128176;</div>
              <h2>No Week Selected</h2>
              <p>{isAdmin ? 'Add a week to start tracking finances' : 'No financial data has been entered yet'}</p>
            </div>
          )}
        </>
      )}

      {/* ════════════════ Summary / Totals ════════════════ */}
      {activeSection === 'summary' && (
        <>
          {/* Pot & totals */}
          <div className="card">
            <div className="card-title" style={{ fontSize: 14 }}>Season Totals</div>
            <div className="stats-grid">
              <div className="stat-chip">
                <div className="stat-value">${pushPotTotal}</div>
                <div className="stat-label">Push Pot</div>
              </div>
              <div className="stat-chip fin-stat-fines">
                <div className="stat-value fin-fines-value">${totalFines}</div>
                <div className="stat-label">Total Fines</div>
              </div>
              <div className="stat-chip">
                <div className="stat-value">{data.weeks.length}</div>
                <div className="stat-label">Weeks Played</div>
              </div>
              <div className="stat-chip">
                <div className="stat-value">{fiftyFiftyHistory.length}</div>
                <div className="stat-label">50/50 Draws</div>
              </div>
            </div>
          </div>

          {/* Fines Leaderboard */}
          <div className="card">
            <div className="card-title" style={{ fontSize: 14 }}>Fines Leaderboard</div>
            {finesLeaderboard.length === 0 ? (
              <div className="fin-empty-hint">No fines recorded yet</div>
            ) : (
              <div className="fin-lb-list">
                {finesLeaderboard.map((entry, i) => (
                  <div key={entry.name} className={`fin-lb-row${i === 0 ? ' leader' : ''}`}>
                    <span className="fin-lb-rank">{i + 1}</span>
                    <span className="fin-lb-name">{entry.name}</span>
                    <span className="fin-lb-amount">${entry.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Front 9 / Back 9 Win Counts */}
          <div className="card">
            <div className="card-title" style={{ fontSize: 14 }}>Best Ball Wins</div>
            <div className="fin-wins-grid">
              <div className="fin-wins-col">
                <div className="fin-wins-header">Front 9</div>
                {Object.entries(winCounts.front9)
                  .sort(([, a], [, b]) => b - a)
                  .map(([team, count]) => (
                    <div key={team} className="fin-wins-row">
                      <span className="fin-wins-team">{team}</span>
                      <span className="fin-wins-count">{count}</span>
                    </div>
                  ))}
                {Object.keys(winCounts.front9).length === 0 && (
                  <div className="fin-empty-hint">No wins yet</div>
                )}
              </div>
              <div className="fin-wins-col">
                <div className="fin-wins-header">Back 9</div>
                {Object.entries(winCounts.back9)
                  .sort(([, a], [, b]) => b - a)
                  .map(([team, count]) => (
                    <div key={team} className="fin-wins-row">
                      <span className="fin-wins-team">{team}</span>
                      <span className="fin-wins-count">{count}</span>
                    </div>
                  ))}
                {Object.keys(winCounts.back9).length === 0 && (
                  <div className="fin-empty-hint">No wins yet</div>
                )}
              </div>
            </div>
          </div>

          {/* 50/50 History */}
          <div className="card">
            <div className="card-title" style={{ fontSize: 14 }}>50/50 History</div>
            {fiftyFiftyHistory.length === 0 ? (
              <div className="fin-empty-hint">No 50/50 winners yet</div>
            ) : (
              <div className="fin-fifty-list">
                {fiftyFiftyHistory.map((h, i) => (
                  <div key={i} className="fin-fifty-row">
                    <div className="fin-fifty-week">
                      <span className="fin-fifty-label">{h.weekLabel}</span>
                      <span className="fin-fifty-date">{formatDate(h.date)}</span>
                    </div>
                    <div className="fin-fifty-winner">{h.winner}</div>
                    <div className="fin-fifty-amount">${h.amount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════ Payment Checklist ════════════════ */}
      {activeSection === 'checklist' && (
        <>
          {/* Week selector for checklist */}
          <div className="card">
            <div className="fin-week-selector">
              <select
                className="avail-select"
                value={selectedWeekId || ''}
                onChange={(e) => setSelectedWeekId(e.target.value || null)}
              >
                <option value="">Select a week...</option>
                {data.weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.weekLabel} - {formatDate(w.date)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedWeek ? (
            <>
              <div className="card fin-checklist-card">
                <div className="fin-checklist-header">
                  <div className="card-title" style={{ fontSize: 14, marginBottom: 0 }}>
                    {selectedWeek.weekLabel} - {formatDate(selectedWeek.date)}
                  </div>
                  <button className="fin-print-btn no-print" onClick={() => window.print()}>
                    Print
                  </button>
                </div>
                <div className="fin-checklist-scroll">
                  <table className="fin-checklist-table">
                    <thead>
                      <tr>
                        <th className="fin-cl-name-col">Player</th>
                        <th className="fin-cl-col">Front 9<br /><span className="fin-cl-amount">$5</span></th>
                        <th className="fin-cl-col">Back 9<br /><span className="fin-cl-amount">$5</span></th>
                        <th className="fin-cl-col">50/50<br /><span className="fin-cl-amount">$10</span></th>
                        <th className="fin-cl-col">Hot Hole<br /><span className="fin-cl-amount">$1</span></th>
                        <th className="fin-cl-col">Fines</th>
                        <th className="fin-cl-col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerNames.map((name) => {
                        const pay = selectedWeek.payments[name] || { front9: false, back9: false, fiftyFifty: false, hotHole: false };
                        const fine = selectedWeek.fines[name] || 0;
                        const totalOwed = 5 + 5 + (selectedWeek.fiftyFiftyEnabled ? 10 : 0) + 1 + fine;
                        return (
                          <tr key={name}>
                            <td className="fin-cl-name">{name}</td>
                            <td className="fin-cl-check">
                              {isAdmin ? (
                                <input
                                  type="checkbox"
                                  className="fin-checkbox"
                                  checked={pay.front9}
                                  onChange={() => togglePayment(selectedWeek.id, name, 'front9')}
                                />
                              ) : (
                                <span className={pay.front9 ? 'fin-paid' : 'fin-unpaid'}>
                                  {pay.front9 ? '✓' : '✗'}
                                </span>
                              )}
                            </td>
                            <td className="fin-cl-check">
                              {isAdmin ? (
                                <input
                                  type="checkbox"
                                  className="fin-checkbox"
                                  checked={pay.back9}
                                  onChange={() => togglePayment(selectedWeek.id, name, 'back9')}
                                />
                              ) : (
                                <span className={pay.back9 ? 'fin-paid' : 'fin-unpaid'}>
                                  {pay.back9 ? '✓' : '✗'}
                                </span>
                              )}
                            </td>
                            <td className="fin-cl-check">
                              {selectedWeek.fiftyFiftyEnabled ? (
                                isAdmin ? (
                                  <input
                                    type="checkbox"
                                    className="fin-checkbox"
                                    checked={pay.fiftyFifty}
                                    onChange={() => togglePayment(selectedWeek.id, name, 'fiftyFifty')}
                                  />
                                ) : (
                                  <span className={pay.fiftyFifty ? 'fin-paid' : 'fin-unpaid'}>
                                    {pay.fiftyFifty ? '✓' : '✗'}
                                  </span>
                                )
                              ) : (
                                <span className="fin-na">-</span>
                              )}
                            </td>
                            <td className="fin-cl-check">
                              {isAdmin ? (
                                <input
                                  type="checkbox"
                                  className="fin-checkbox"
                                  checked={pay.hotHole}
                                  onChange={() => togglePayment(selectedWeek.id, name, 'hotHole')}
                                />
                              ) : (
                                <span className={pay.hotHole ? 'fin-paid' : 'fin-unpaid'}>
                                  {pay.hotHole ? '✓' : '✗'}
                                </span>
                              )}
                            </td>
                            <td className={`fin-cl-fine${fine > 0 ? ' has-fine' : ''}`}>
                              {fine > 0 ? `$${fine}` : '-'}
                            </td>
                            <td className="fin-cl-total">${totalOwed}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="icon">&#128203;</div>
              <h2>No Week Selected</h2>
              <p>Select a week to view the payment checklist</p>
            </div>
          )}
        </>
      )}

      {/* ════════════════ Randomizers ════════════════ */}
      {activeSection === 'randomizers' && (
        <>
          {/* Hot Hole Wheel */}
          <div className="card">
            <SpinWheel
              title="Hot Hole"
              segments={HOT_HOLE_SEGMENTS}
              onResult={(seg) => {
                const [front, back] = seg.split(' or ');
                setHotHoleResult(`Hole ${front} or Hole ${back}`);
              }}
            />
            {hotHoleResult && (
              <div className="spin-detail-result">{hotHoleResult}</div>
            )}
          </div>

          {/* 50/50 Wheel */}
          <div className="card">
            <div className="spin-player-filter">
              <div className="spin-filter-title">Players in the draw:</div>
              <div className="spin-filter-list">
                {fiftyFiftyAllNames.map((name) => (
                  <label key={name} className="spin-filter-item">
                    <input
                      type="checkbox"
                      checked={!excludedPlayers.has(name)}
                      onChange={() => {
                        setExcludedPlayers((prev) => {
                          const next = new Set(prev);
                          if (next.has(name)) next.delete(name);
                          else next.add(name);
                          return next;
                        });
                        setFiftyFiftyResult(null);
                      }}
                    />
                    <span>{name}{subNames.has(name) ? ' (sub)' : ''}{guestPlayers.includes(name) ? ' (guest)' : ''}</span>
                  </label>
                ))}
              </div>
              <div className="spin-add-guest">
                <input
                  className="spin-guest-input"
                  type="text"
                  placeholder="Add guest..."
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGuestName.trim()) {
                      setGuestPlayers((prev) => [...prev, newGuestName.trim()]);
                      setNewGuestName('');
                    }
                  }}
                />
                <button
                  className="spin-guest-btn"
                  disabled={!newGuestName.trim()}
                  onClick={() => {
                    if (newGuestName.trim()) {
                      setGuestPlayers((prev) => [...prev, newGuestName.trim()]);
                      setNewGuestName('');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            <SpinWheel
              title="50/50 Draw"
              segments={fiftyFiftyPlayers}
              onResult={(seg) => setFiftyFiftyResult(seg)}
            />
            {fiftyFiftyResult && (
              <div className="spin-detail-result spin-winner">
                Winner: {fiftyFiftyResult}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
