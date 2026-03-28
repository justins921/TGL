import { useState, useCallback } from 'react';
import { calculateHandicap } from '../lib/types';
import type { PlayerProfile, WeeklyResult } from '../lib/types';

const MAX_HANDICAP = 10;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function emptyPlayer(isSub: boolean): PlayerProfile {
  return {
    id: genId(),
    name: '',
    email: '',
    phone: '',
    photoUrl: '',
    handicap: 0,
    previousSeasonAvg: null,
    isSub,
    weeklyResults: [],
  };
}

interface Props {
  players: PlayerProfile[];
  onSave: (player: PlayerProfile) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}

export default function Players({ players, onSave, onDelete, isAdmin }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlayerProfile | null>(null);
  const [filter, setFilter] = useState<'all' | 'roster' | 'subs'>('all');

  const regulars = players.filter((p) => !p.isSub);
  const subs = players.filter((p) => p.isSub);
  const filtered =
    filter === 'roster' ? regulars : filter === 'subs' ? subs : players;

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const startAdd = useCallback((isSub: boolean) => {
    const p = emptyPlayer(isSub);
    setDraft(p);
    setEditingId(p.id);
  }, []);

  const startEdit = useCallback((player: PlayerProfile) => {
    setDraft({ ...player, weeklyResults: [...player.weeklyResults] });
    setEditingId(player.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setDraft(null);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!draft || !draft.name.trim()) return;
    const clamped = {
      ...draft,
      name: draft.name.trim(),
      handicap: Math.min(MAX_HANDICAP, Math.max(0, draft.handicap)),
    };
    onSave(clamped);
    setDraft(null);
    setEditingId(null);
  }, [draft, onSave]);

  const updateDraft = useCallback(
    (updates: Partial<PlayerProfile>) => {
      setDraft((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    []
  );

  const addWeeklyResult = useCallback(() => {
    if (!draft) return;
    const nextWeek =
      draft.weeklyResults.length > 0
        ? Math.max(...draft.weeklyResults.map((r) => r.week)) + 1
        : 1;
    setDraft({
      ...draft,
      weeklyResults: [...draft.weeklyResults, { week: nextWeek, score: 0 }],
    });
  }, [draft]);

  const updateWeeklyResult = useCallback(
    (index: number, updates: Partial<WeeklyResult>) => {
      if (!draft) return;
      const results = [...draft.weeklyResults];
      results[index] = { ...results[index], ...updates };
      setDraft({ ...draft, weeklyResults: results });
    },
    [draft]
  );

  const removeWeeklyResult = useCallback(
    (index: number) => {
      if (!draft) return;
      setDraft({
        ...draft,
        weeklyResults: draft.weeklyResults.filter((_, i) => i !== index),
      });
    },
    [draft]
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>
          Player Directory
        </div>
        <div className="card-subtitle" style={{ marginTop: 0 }}>
          {regulars.length} players &middot; {subs.length} subs
        </div>

        {/* Filter chips */}
        <div className="pd-filters">
          {(['all', 'roster', 'subs'] as const).map((f) => (
            <button
              key={f}
              className={`pd-filter-chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'roster' ? 'Roster' : 'Subs'}
            </button>
          ))}
        </div>

        {/* Admin: add buttons */}
        {isAdmin && (
          <div className="pd-add-row">
            <button className="pd-add-btn" onClick={() => startAdd(false)}>
              + Add Player
            </button>
            <button
              className="pd-add-btn outline"
              onClick={() => startAdd(true)}
            >
              + Add Sub
            </button>
          </div>
        )}
      </div>

      {/* Editing / Adding card */}
      {draft && editingId && (
        <div className="card pd-edit-card">
          <div className="card-title">
            {players.find((p) => p.id === editingId)
              ? 'Edit Player'
              : draft.isSub
              ? 'New Substitute'
              : 'New Player'}
          </div>

          <div className="pd-form-field">
            <label>Name *</label>
            <input
              className="name-input"
              placeholder="Full name"
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </div>

          <div className="pd-form-row">
            <div className="pd-form-field">
              <label>Email</label>
              <input
                className="name-input"
                type="email"
                placeholder="email@example.com"
                value={draft.email}
                onChange={(e) => updateDraft({ email: e.target.value })}
              />
            </div>
            <div className="pd-form-field">
              <label>Phone</label>
              <input
                className="name-input"
                type="tel"
                placeholder="(555) 123-4567"
                value={draft.phone}
                onChange={(e) => updateDraft({ phone: e.target.value })}
              />
            </div>
          </div>

          <div className="pd-form-field">
            <label>Photo URL</label>
            <input
              className="name-input"
              placeholder="https://..."
              value={draft.photoUrl}
              onChange={(e) => updateDraft({ photoUrl: e.target.value })}
            />
          </div>

          <div className="pd-form-row">
            <div className="pd-form-field">
              <label>
                Handicap (0-{MAX_HANDICAP})
                {draft.previousSeasonAvg !== null && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.85em', opacity: 0.7 }}>
                    {' '}&mdash; auto-calculated from avg
                  </span>
                )}
              </label>
              <input
                className="name-input"
                type="number"
                min={0}
                max={MAX_HANDICAP}
                step="0.1"
                value={Math.round(draft.handicap * 10) / 10}
                readOnly={draft.previousSeasonAvg !== null}
                style={draft.previousSeasonAvg !== null ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                onChange={(e) => {
                  if (draft.previousSeasonAvg !== null) return;
                  const val = parseFloat(e.target.value) || 0;
                  updateDraft({
                    handicap: Math.min(MAX_HANDICAP, Math.max(0, val)),
                  });
                }}
              />
            </div>
            <div className="pd-form-field">
              <label>Prev. Season Avg</label>
              <input
                className="name-input"
                type="number"
                placeholder="e.g. 82"
                value={draft.previousSeasonAvg ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const avg = raw === '' ? null : parseFloat(raw) || 0;
                  updateDraft({
                    previousSeasonAvg: avg,
                    handicap: avg !== null ? calculateHandicap(avg) : draft.handicap,
                  });
                }}
              />
            </div>
          </div>

          <div className="pd-form-field">
            <label className="pd-checkbox-label">
              <input
                type="checkbox"
                checked={draft.isSub}
                onChange={(e) => updateDraft({ isSub: e.target.checked })}
              />
              Substitute player
            </label>
          </div>

          {/* Weekly Results */}
          <div className="pd-results-section">
            <div className="pd-results-header">
              <label>Weekly Results</label>
              <button className="pd-result-add-btn" onClick={addWeeklyResult}>
                + Week
              </button>
            </div>
            {draft.weeklyResults.map((r, i) => (
              <div key={i} className="pd-result-row">
                <span className="pd-result-label">Wk {r.week}</span>
                <input
                  className="pd-result-input"
                  type="number"
                  value={r.score || ''}
                  placeholder="Score"
                  onChange={(e) =>
                    updateWeeklyResult(i, {
                      score: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <button
                  className="sub-remove-btn"
                  onClick={() => removeWeeklyResult(i)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <div className="pd-edit-actions">
            <button className="pd-save-btn" onClick={handleSave} disabled={!draft.name.trim()}>
              Save
            </button>
            <button className="pd-cancel-btn" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Player list */}
      {sorted.length === 0 && !draft && (
        <div className="empty-state">
          <div className="icon">&#128100;</div>
          <h2>No Players Yet</h2>
          <p>
            {isAdmin
              ? 'Add players and subs to build your directory'
              : 'The league admin will add players soon'}
          </p>
        </div>
      )}

      {sorted.map((player) => {
        if (player.id === editingId) return null; // hide card while editing
        return (
          <PlayerCard
            key={player.id}
            player={player}
            isAdmin={isAdmin}
            onEdit={() => startEdit(player)}
            onDelete={() => onDelete(player.id)}
          />
        );
      })}
    </div>
  );
}

function PlayerCard({
  player,
  isAdmin,
  onEdit,
  onDelete,
}: {
  player: PlayerProfile;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const avg =
    player.weeklyResults.length > 0
      ? (
          player.weeklyResults.reduce((s, r) => s + r.score, 0) /
          player.weeklyResults.length
        ).toFixed(1)
      : null;

  return (
    <div className="card pd-player-card">
      <div className="pd-player-header" onClick={() => setExpanded(!expanded)}>
        <div className="pd-avatar">
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} />
          ) : (
            <span className="pd-avatar-initial">
              {player.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="pd-player-info">
          <div className="pd-player-name">
            {player.name}
            {player.isSub && <span className="pd-sub-badge">SUB</span>}
          </div>
          <div className="pd-player-meta">
            HCP {Math.round(player.handicap * 10) / 10}
            {avg && <> &middot; Avg {avg}</>}
            {player.previousSeasonAvg !== null && (
              <> &middot; Prev {player.previousSeasonAvg}</>
            )}
          </div>
        </div>
        <span className="pd-chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {expanded && (
        <div className="pd-player-details">
          {player.email && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Email</span>
              <span className="pd-detail-value">{player.email}</span>
            </div>
          )}
          {player.phone && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Phone</span>
              <span className="pd-detail-value">{player.phone}</span>
            </div>
          )}
          <div className="pd-detail-row">
            <span className="pd-detail-label">Handicap</span>
            <span className="pd-detail-value">{Math.round(player.handicap * 10) / 10}</span>
          </div>
          {player.previousSeasonAvg !== null && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Prev. Season Avg</span>
              <span className="pd-detail-value">{player.previousSeasonAvg}</span>
            </div>
          )}

          {/* Weekly Results */}
          {player.weeklyResults.length > 0 && (
            <div className="pd-results-table">
              <div className="pd-detail-label" style={{ marginBottom: 6 }}>
                Weekly Scores
              </div>
              <div className="pd-scores-grid">
                {player.weeklyResults.map((r, i) => (
                  <div key={i} className="pd-score-chip">
                    <span className="pd-score-week">Wk {r.week}</span>
                    <span className="pd-score-val">{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="pd-card-actions">
              <button className="pd-edit-btn" onClick={onEdit}>
                Edit
              </button>
              <button className="pd-delete-btn" onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
