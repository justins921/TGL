import { useMemo } from 'react';
import { HOLE_COUNT, HOLE_HANDICAPS, calculateMatchResult } from '../lib/scoring';

interface Props {
  weekIndex: number;
  playerAIndex: number;
  playerBIndex: number;
  playerAName: string;
  playerBName: string;
  handicapA: number;
  handicapB: number;
  scores: Record<string, number>;
  onScoreChange: (weekIndex: number, playerIndex: number, holeIndex: number, value: string) => void;
  isAdmin: boolean;
}

function scoreKey(week: number, player: number, hole: number): string {
  return `${week}-${player}-${hole}`;
}

export default function MatchScorecard({
  weekIndex,
  playerAIndex,
  playerBIndex,
  playerAName,
  playerBName,
  handicapA,
  handicapB,
  scores,
  onScoreChange,
  isAdmin,
}: Props) {
  const grossA: (number | undefined)[] = [];
  const grossB: (number | undefined)[] = [];
  for (let h = 0; h < HOLE_COUNT; h++) {
    const a = scores[scoreKey(weekIndex, playerAIndex, h)];
    const b = scores[scoreKey(weekIndex, playerBIndex, h)];
    grossA.push(a);
    grossB.push(b);
  }

  const result = useMemo(
    () => calculateMatchResult(grossA, grossB, handicapA, handicapB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(grossA), JSON.stringify(grossB), handicapA, handicapB]
  );

  const totalGrossA = grossA.every((v) => v !== undefined)
    ? grossA.reduce((s, v) => s + v!, 0)
    : null;
  const totalGrossB = grossB.every((v) => v !== undefined)
    ? grossB.reduce((s, v) => s + v!, 0)
    : null;

  const hasAnyScores = grossA.some((v) => v !== undefined) || grossB.some((v) => v !== undefined);

  return (
    <div className="scorecard">
      <div className="scorecard-scroll">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th className="sc-label-col">Hole</th>
              {Array.from({ length: HOLE_COUNT }, (_, h) => (
                <th key={h} className="sc-hole-col">{h + 1}</th>
              ))}
              <th className="sc-total-col">Total</th>
            </tr>
            <tr className="sc-hh-row">
              <td className="sc-label-col">HH</td>
              {HOLE_HANDICAPS.map((hh, h) => (
                <td key={h} className="sc-hole-col sc-hh">{hh}</td>
              ))}
              <td className="sc-total-col"></td>
            </tr>
          </thead>
          <tbody>
            {/* Player A scores */}
            <tr className="sc-player-row">
              <td className="sc-player-label">
                <span className={`sc-player-name${result && result.totalPointsA > result.totalPointsB ? ' sc-match-winner' : ''}`}>
                  {playerAName}
                </span>
                <span className="sc-hcp">({Math.round(handicapA * 10) / 10})</span>
              </td>
              {Array.from({ length: HOLE_COUNT }, (_, h) => (
                <td key={h} className="sc-hole-col">
                  {isAdmin ? (
                    <input
                      className="sc-score-input"
                      type="number"
                      min={1}
                      value={grossA[h] ?? ''}
                      onChange={(e) => onScoreChange(weekIndex, playerAIndex, h, e.target.value)}
                    />
                  ) : (
                    <span className="sc-score-val">{grossA[h] ?? ''}</span>
                  )}
                </td>
              ))}
              <td className="sc-total-col sc-total-val">{totalGrossA ?? ''}</td>
            </tr>
            {/* Player B scores */}
            <tr className="sc-player-row">
              <td className="sc-player-label">
                <span className={`sc-player-name${result && result.totalPointsB > result.totalPointsA ? ' sc-match-winner' : ''}`}>
                  {playerBName}
                </span>
                <span className="sc-hcp">({Math.round(handicapB * 10) / 10})</span>
              </td>
              {Array.from({ length: HOLE_COUNT }, (_, h) => (
                <td key={h} className="sc-hole-col">
                  {isAdmin ? (
                    <input
                      className="sc-score-input"
                      type="number"
                      min={1}
                      value={grossB[h] ?? ''}
                      onChange={(e) => onScoreChange(weekIndex, playerBIndex, h, e.target.value)}
                    />
                  ) : (
                    <span className="sc-score-val">{grossB[h] ?? ''}</span>
                  )}
                </td>
              ))}
              <td className="sc-total-col sc-total-val">{totalGrossB ?? ''}</td>
            </tr>

            {/* Strokes given row (only show when there's a handicap difference) */}
            {result && Math.round(handicapA) !== Math.round(handicapB) && (
              <tr className="sc-strokes-row">
                <td className="sc-label-col sc-strokes-label">Strokes</td>
                {Array.from({ length: HOLE_COUNT }, (_, h) => {
                  const sA = result.strokesGivenA[h];
                  const sB = result.strokesGivenB[h];
                  return (
                    <td key={h} className="sc-hole-col sc-stroke-cell">
                      {sA ? <span className="sc-stroke-dot" title={`${playerAName} gets a stroke`}>●</span> :
                       sB ? <span className="sc-stroke-dot" title={`${playerBName} gets a stroke`}>○</span> : ''}
                    </td>
                  );
                })}
                <td className="sc-total-col"></td>
              </tr>
            )}

            {/* Points rows */}
            {result && (
              <>
                <tr className="sc-points-row">
                  <td className="sc-label-col sc-pts-label">{playerAName.split(' ')[0]} Pts</td>
                  {result.holePointsA.map((pts, h) => (
                    <td key={h} className={`sc-hole-col sc-pts${pts === 1 ? ' sc-pts-win' : pts === 0 ? ' sc-pts-lose' : ''}`}>
                      {pts}
                    </td>
                  ))}
                  <td className={`sc-total-col sc-pts-total${result.totalPointsA > result.totalPointsB ? ' sc-pts-win' : ''}`}>
                    {result.totalPointsA}
                  </td>
                </tr>
                <tr className="sc-points-row">
                  <td className="sc-label-col sc-pts-label">{playerBName.split(' ')[0]} Pts</td>
                  {result.holePointsB.map((pts, h) => (
                    <td key={h} className={`sc-hole-col sc-pts${pts === 1 ? ' sc-pts-win' : pts === 0 ? ' sc-pts-lose' : ''}`}>
                      {pts}
                    </td>
                  ))}
                  <td className={`sc-total-col sc-pts-total${result.totalPointsB > result.totalPointsA ? ' sc-pts-win' : ''}`}>
                    {result.totalPointsB}
                  </td>
                </tr>
              </>
            )}

            {/* No scores yet hint for admin */}
            {!hasAnyScores && isAdmin && (
              <tr>
                <td colSpan={HOLE_COUNT + 2} className="sc-empty-hint">
                  Enter hole-by-hole scores above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
