import { useState, useCallback, useMemo } from 'react';
import type { PlayerProfile } from '../lib/types';

export interface AbsenceEntry {
  id: string;
  playerName: string;
  date: string; // ISO date
}

interface Props {
  players: PlayerProfile[];
  absences: AbsenceEntry[];
  onAdd: (entry: AbsenceEntry) => void;
  onRemove: (id: string) => void;
  isAdmin: boolean;
}

export default function Availability({ players, absences, onAdd, onRemove, isAdmin }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const handleAdd = useCallback(() => {
    if (!selectedPlayer || !selectedDate) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onAdd({ id, playerName: selectedPlayer, date: selectedDate });
    setSelectedPlayer('');
    setSelectedDate('');
  }, [selectedPlayer, selectedDate, onAdd]);

  const grouped = useMemo(() => {
    const map: Record<string, AbsenceEntry[]> = {};
    for (const a of absences) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [absences]);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const rosterPlayers = players.filter((p) => !p.isSub).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page-content">
      <div className="card">
        <div className="card-title">Availability</div>
        <div className="card-subtitle">Track when players will be gone</div>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 14 }}>Add Absence</div>
          <div className="avail-add-row">
            <select
              className="avail-select"
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
            >
              <option value="">Select player...</option>
              {rosterPlayers.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
            <input
              className="avail-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              className="avail-add-btn"
              onClick={handleAdd}
              disabled={!selectedPlayer || !selectedDate}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="icon">&#128197;</div>
          <h2>No Absences</h2>
          <p>{isAdmin ? 'Add dates when players will be gone' : 'No upcoming absences reported'}</p>
        </div>
      ) : (
        grouped.map(([date, entries]) => (
          <div key={date} className="card avail-date-card">
            <div className="avail-date-header">{formatDate(date)}</div>
            <div className="avail-chips">
              {entries.map((e) => (
                <span key={e.id} className="absence-chip">
                  {e.playerName}
                  {isAdmin && (
                    <button className="absence-remove" onClick={() => onRemove(e.id)}>
                      &times;
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
