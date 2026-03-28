import { useMemo } from 'react';
import type { ScheduleData, PlayerProfile } from '../lib/types';
import { HOLE_COUNT, calculateMatchResult, getWeeklyHandicap } from '../lib/scoring';

interface Props {
  scheduleData: ScheduleData | null;
  playerProfiles: PlayerProfile[];
}

interface LeaderboardEntry {
  playerIndex: number;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesTied: number;
  matchesLost: number;
  weeklyPoints: (number | null)[]; // null = bye/not played
}

export default function Leaderboard({ scheduleData, playerProfiles }: Props) {
  const entries = useMemo(() => {
    if (!scheduleData) return [];

    const scores = scheduleData.scores || {};
    const subs = scheduleData.substitutions || {};
    const numPlayers = scheduleData.players.length;
    const numWeeks = scheduleData.weeks.length;

    function getHandicap(name: string, weekIndex: number): number {
      return getWeeklyHandicap(name, weekIndex, scheduleData!, playerProfiles);
    }

    // Initialize entries
    const map: Record<number, LeaderboardEntry> = {};
    for (let i = 0; i < numPlayers; i++) {
      map[i] = {
        playerIndex: i,
        name: scheduleData.players[i],
        totalPoints: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        matchesTied: 0,
        matchesLost: 0,
        weeklyPoints: new Array(numWeeks).fill(null),
      };
    }

    // Process each week
    for (let w = 0; w < numWeeks; w++) {
      const week = scheduleData.weeks[w];

      for (const foursome of week.foursomes) {
        for (const [a, b] of foursome.matchups) {
          const subA = subs[`${w}-${a}`];
          const subB = subs[`${w}-${b}`];
          const casperA = subA === 'Casper';
          const casperB = subB === 'Casper';

          const hcpA = subA && !casperA ? getHandicap(subA, w) : getHandicap(scheduleData.players[a], w);
          const hcpB = subB && !casperB ? getHandicap(subB, w) : getHandicap(scheduleData.players[b], w);

          const grossA: (number | undefined)[] = [];
          const grossB: (number | undefined)[] = [];
          for (let h = 0; h < HOLE_COUNT; h++) {
            grossA.push(scores[`${w}-${a}-${h}`]);
            grossB.push(scores[`${w}-${b}-${h}`]);
          }

          const result = calculateMatchResult(grossA, grossB, hcpA, hcpB, casperA, casperB);
          if (!result) continue; // incomplete scores

          const ptsA = result.totalPointsA;
          const ptsB = result.totalPointsB;

          // Points go to original player
          map[a].totalPoints += ptsA;
          map[a].matchesPlayed += 1;
          map[a].weeklyPoints[w] = (map[a].weeklyPoints[w] ?? 0) + ptsA;
          if (ptsA > ptsB) map[a].matchesWon += 1;
          else if (ptsA === ptsB) map[a].matchesTied += 1;
          else map[a].matchesLost += 1;

          map[b].totalPoints += ptsB;
          map[b].matchesPlayed += 1;
          map[b].weeklyPoints[w] = (map[b].weeklyPoints[w] ?? 0) + ptsB;
          if (ptsB > ptsA) map[b].matchesWon += 1;
          else if (ptsB === ptsA) map[b].matchesTied += 1;
          else map[b].matchesLost += 1;
        }
      }
    }

    // Sort by total points descending, then wins, then matches played
    return Object.values(map)
      .filter((e) => e.matchesPlayed > 0)
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        return b.matchesPlayed - a.matchesPlayed;
      });
  }, [scheduleData, playerProfiles]);

  // Find which weeks have any results
  const weeksWithResults = useMemo(() => {
    if (!scheduleData) return [];
    const result: number[] = [];
    for (let w = 0; w < scheduleData.weeks.length; w++) {
      if (entries.some((e) => e.weeklyPoints[w] !== null)) {
        result.push(w);
      }
    }
    return result;
  }, [scheduleData, entries]);

  if (!scheduleData) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="icon">&#127942;</div>
          <h2>No Schedule Yet</h2>
          <p>The leaderboard will appear once a schedule is generated and matches are played</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="page-content">
        <div className="card">
          <div className="card-title">Leaderboard</div>
          <div className="card-subtitle">No match results yet. Scores will appear here after matches are played.</div>
        </div>
      </div>
    );
  }

  const leader = entries[0];

  return (
    <div className="page-content">
      <div className="card">
        <div className="card-title">Leaderboard</div>
        <div className="card-subtitle">
          {entries.length} players &middot; {weeksWithResults.length} week{weeksWithResults.length !== 1 ? 's' : ''} played
        </div>
      </div>

      {/* Standings table */}
      <div className="card lb-card">
        <div className="lb-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-rank-col">#</th>
                <th className="lb-name-col">Player</th>
                <th className="lb-stat-col">Pts</th>
                <th className="lb-stat-col">W</th>
                <th className="lb-stat-col">L</th>
                <th className="lb-stat-col">T</th>
                {weeksWithResults.map((w) => (
                  <th key={w} className="lb-week-col">Wk{w + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, rank) => {
                const isLeader = entry.totalPoints === leader.totalPoints;
                return (
                  <tr key={entry.playerIndex} className={`lb-row${isLeader ? ' lb-leader' : ''}`}>
                    <td className="lb-rank">{rank + 1}</td>
                    <td className="lb-name">{entry.name}</td>
                    <td className="lb-pts">{entry.totalPoints}</td>
                    <td className="lb-stat">{entry.matchesWon}</td>
                    <td className="lb-stat">{entry.matchesLost}</td>
                    <td className="lb-stat">{entry.matchesTied}</td>
                    {weeksWithResults.map((w) => (
                      <td key={w} className="lb-week-pts">
                        {entry.weeklyPoints[w] !== null ? entry.weeklyPoints[w] : '\u2014'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
