import { useState } from 'react';
import type { SavedSchedule } from '../lib/types';

interface Props {
  savedSchedules: SavedSchedule[];
  onLoad: (saved: SavedSchedule) => void;
  onDelete: (id: string) => void;
}

export default function Compare({ savedSchedules, onLoad, onDelete }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (savedSchedules.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">&#9878;</div>
        <h2>No Saved Schedules</h2>
        <p>Generate and save schedules on the Schedule tab to compare them here</p>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(savedSchedules.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selected = savedSchedules.filter((s) => selectedIds.has(s.id));

  return (
    <div className="page-content">
      {/* Selection Card */}
      <div className="card">
        <div className="card-title">Select Schedules to Compare</div>
        <div className="card-subtitle">
          Tap schedules to select them, then compare stats side-by-side
        </div>

        <div className="compare-select-actions">
          <button className="compare-select-btn" onClick={selectAll}>
            Select All
          </button>
          {selectedIds.size > 0 && (
            <button className="compare-select-btn muted" onClick={clearSelection}>
              Clear
            </button>
          )}
        </div>

        {savedSchedules.map((saved) => {
          const isSelected = selectedIds.has(saved.id);
          return (
            <div
              key={saved.id}
              className={`compare-row${isSelected ? ' selected' : ''}`}
              onClick={() => toggleSelect(saved.id)}
            >
              <div className="compare-checkbox">
                {isSelected ? '\u2611' : '\u2610'}
              </div>
              <div className="compare-row-info">
                <div className="saved-name">{saved.name}</div>
                <div className="saved-meta">{saved.savedAt}</div>
              </div>
              <div className="compare-row-actions">
                <button
                  className="saved-load-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoad(saved);
                  }}
                >
                  Use
                </button>
                <button
                  className="saved-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(saved.id);
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.delete(saved.id);
                      return next;
                    });
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      {selected.length >= 2 && (
        <div className="card">
          <div className="card-title">
            Comparing {selected.length} Schedules
          </div>
          <div className="compare-table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="compare-metric-header">Metric</th>
                  {selected.map((s) => (
                    <th key={s.id} className="compare-schedule-header">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="compare-metric">Unique 1v1 Pairs</td>
                  {selected.map((s) => (
                    <CompareCell
                      key={s.id}
                      value={s.stats.pairsExactlyOnce}
                      best={Math.max(...selected.map((x) => x.stats.pairsExactlyOnce))}
                      higherIsBetter
                    />
                  ))}
                </tr>
                <tr>
                  <td className="compare-metric">Total Pairs</td>
                  {selected.map((s) => (
                    <td key={s.id} className="compare-value">
                      {s.stats.totalPairs}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-metric">1v1 Coverage</td>
                  {selected.map((s) => {
                    const pct = s.stats.totalPairs > 0
                      ? Math.round((s.stats.pairsExactlyOnce / s.stats.totalPairs) * 100)
                      : 0;
                    const bestPct = Math.max(
                      ...selected.map((x) =>
                        x.stats.totalPairs > 0
                          ? Math.round((x.stats.pairsExactlyOnce / x.stats.totalPairs) * 100)
                          : 0
                      )
                    );
                    return (
                      <CompareCell
                        key={s.id}
                        value={pct}
                        best={bestPct}
                        higherIsBetter
                        suffix="%"
                      />
                    );
                  })}
                </tr>
                <tr>
                  <td className="compare-metric">1v1 Range</td>
                  {selected.map((s) => {
                    const range = s.stats.matchupMax - s.stats.matchupMin;
                    const bestRange = Math.min(
                      ...selected.map((x) => x.stats.matchupMax - x.stats.matchupMin)
                    );
                    return (
                      <td
                        key={s.id}
                        className={`compare-value${range === bestRange ? ' best' : ''}`}
                      >
                        {s.stats.matchupMin}-{s.stats.matchupMax}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="compare-metric">Foursome Range</td>
                  {selected.map((s) => {
                    const range = s.stats.foursomeMax - s.stats.foursomeMin;
                    const bestRange = Math.min(
                      ...selected.map((x) => x.stats.foursomeMax - x.stats.foursomeMin)
                    );
                    return (
                      <td
                        key={s.id}
                        className={`compare-value${range === bestRange ? ' best' : ''}`}
                      >
                        {s.stats.foursomeMin}-{s.stats.foursomeMax}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="compare-metric">Byes / Player</td>
                  {selected.map((s) => {
                    const range = s.stats.byeMax - s.stats.byeMin;
                    const bestRange = Math.min(
                      ...selected.map((x) => x.stats.byeMax - x.stats.byeMin)
                    );
                    return (
                      <td
                        key={s.id}
                        className={`compare-value${range === bestRange ? ' best' : ''}`}
                      >
                        {s.stats.byeMin}-{s.stats.byeMax}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="compare-metric">Players</td>
                  {selected.map((s) => (
                    <td key={s.id} className="compare-value">
                      {s.data.players.length}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-metric">Weeks</td>
                  {selected.map((s) => (
                    <td key={s.id} className="compare-value">
                      {s.data.weeks.length}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="compare-metric">Subs</td>
                  {selected.map((s) => (
                    <td key={s.id} className="compare-value">
                      {s.data.subs.length > 0
                        ? s.data.subs.join(', ')
                        : '\u2014'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Use This buttons */}
          <div className="compare-use-row">
            {selected.map((s) => (
              <button
                key={s.id}
                className="compare-use-btn"
                onClick={() => onLoad(s)}
              >
                Use "{s.name}"
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.length === 1 && (
        <div className="card">
          <div className="card-subtitle" style={{ marginTop: 0 }}>
            Select at least 2 schedules to see a side-by-side comparison
          </div>
        </div>
      )}
    </div>
  );
}

function CompareCell({
  value,
  best,
  higherIsBetter,
  suffix = '',
}: {
  value: number;
  best: number;
  higherIsBetter: boolean;
  suffix?: string;
}) {
  const isBest = higherIsBetter ? value === best : value === best;
  return (
    <td className={`compare-value${isBest ? ' best' : ''}`}>
      {value}{suffix}
    </td>
  );
}
