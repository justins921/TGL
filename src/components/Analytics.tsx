import { useState } from 'react';
import { computeAnalytics, pairKey } from '../lib/scheduleEngine';
import type { ScheduleData, AnalyticsData } from '../lib/types';

interface Props {
  scheduleData: ScheduleData | null;
}

export default function Analytics({ scheduleData }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  if (!scheduleData) {
    return (
      <div className="empty-state">
        <div className="icon">&#128202;</div>
        <h2>No Schedule Yet</h2>
        <p>Generate a schedule on the Schedule tab to view analytics</p>
      </div>
    );
  }

  const analytics = computeAnalytics(scheduleData);
  const { players } = scheduleData;

  return (
    <div className="page-content">
      {/* Player Selector */}
      <div className="card">
        <div className="card-title">Player View</div>
        <div className="picker" onClick={() => setShowPicker(!showPicker)}>
          <span>{players[selectedPlayer]}</span>
          <span>{showPicker ? '\u25B2' : '\u25BC'}</span>
        </div>
        {showPicker && (
          <div className="picker-dropdown">
            {players.map((name, i) => (
              <div
                key={i}
                className={`picker-option ${i === selectedPlayer ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedPlayer(i);
                  setShowPicker(false);
                }}
              >
                {name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Breakdown */}
      <WeeklyTable
        playerIdx={selectedPlayer}
        analytics={analytics}
        players={players}
      />

      {/* 1v1 Matchup Frequency */}
      <FrequencyBars
        title="1v1 Matchup Frequency"
        playerIdx={selectedPlayer}
        players={players}
        pairCount={analytics.matchupPairCount}
        colorClass="green"
      />

      {/* Foursome Frequency */}
      <FrequencyBars
        title="Foursome Frequency"
        playerIdx={selectedPlayer}
        players={players}
        pairCount={analytics.foursomePairCount}
        colorClass="light-green"
      />

      {/* Foursome Matrix */}
      <FoursomeMatrix
        players={players}
        pairCount={analytics.foursomePairCount}
      />
    </div>
  );
}

function WeeklyTable({
  playerIdx,
  analytics,
  players,
}: {
  playerIdx: number;
  analytics: AnalyticsData;
  players: string[];
}) {
  const entries = [...analytics.playerWeekly[playerIdx]].sort(
    (a, b) => a.week - b.week
  );

  return (
    <div className="card">
      <div className="card-title">Weekly Breakdown</div>
      <table className="weekly-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Opponent</th>
            <th>Partners</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={idx}>
              <td>Wk {entry.week}</td>
              <td>
                {entry.bye ? (
                  <span className="bye-badge">BYE</span>
                ) : (
                  players[entry.opponent!]
                )}
              </td>
              <td>
                {entry.bye
                  ? '\u2014'
                  : entry.partners.map((p) => players[p]).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrequencyBars({
  title,
  playerIdx,
  players,
  pairCount,
  colorClass,
}: {
  title: string;
  playerIdx: number;
  players: string[];
  pairCount: Record<string, number>;
  colorClass: string;
}) {
  const entries: { player: number; count: number }[] = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerIdx) continue;
    entries.push({ player: i, count: pairCount[pairKey(playerIdx, i)] || 0 });
  }
  entries.sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map((e) => e.count), 1);

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {entries.map((entry) => {
        const pct = (entry.count / max) * 100;
        return (
          <div key={entry.player} className="freq-row">
            <span className="freq-name">{players[entry.player]}</span>
            <div className="freq-track">
              <div
                className={`freq-fill ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="freq-val">{entry.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function FoursomeMatrix({
  players,
  pairCount,
}: {
  players: string[];
  pairCount: Record<string, number>;
}) {
  const shortName = (name: string) =>
    name.length <= 6 ? name : name.slice(0, 5) + '.';

  return (
    <div className="card">
      <div className="card-title">Foursome Matrix</div>
      <div className="card-subtitle">
        Red = outside ideal range (2-4), Green = ideal
      </div>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th></th>
              {players.map((name, j) => (
                <th key={j} className="col-header">
                  {shortName(name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((name, i) => (
              <tr key={i}>
                <th className="row-header">{shortName(name)}</th>
                {players.map((_, j) => {
                  if (i === j) {
                    return (
                      <td key={j} className="diag">
                        &mdash;
                      </td>
                    );
                  }
                  const count = pairCount[pairKey(i, j)] || 0;
                  let bg: string;
                  let color: string;

                  if (count < 2 || count > 4) {
                    const severity =
                      count < 2 ? 2 - count : count - 4;
                    const lightness = Math.max(50, 85 - severity * 15);
                    bg = `hsl(0, 65%, ${lightness}%)`;
                    color = lightness < 65 ? '#fff' : '#7f1d1d';
                  } else {
                    const t = (count - 2) / 2;
                    bg = `hsl(140, ${35 + t * 25}%, ${88 - t * 20}%)`;
                    color = '#1B5E20';
                  }

                  return (
                    <td key={j} style={{ backgroundColor: bg, color }}>
                      {count}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
