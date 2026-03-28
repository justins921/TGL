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
  /** Sub or Casper for player A: sub name, "Casper", or undefined */
  subA?: string;
  /** Sub or Casper for player B: sub name, "Casper", or undefined */
  subB?: string;
  /** Handicap of the sub playing for A (if subA is a sub name, not Casper) */
  subHandicapA?: number;
  /** Handicap of the sub playing for B (if subB is a sub name, not Casper) */
  subHandicapB?: number;
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
  subA,
  subB,
  subHandicapA,
  subHandicapB,
  scores,
  onScoreChange,
  isAdmin,
}: Props) {
  const casperA = subA === 'Casper';
  const casperB = subB === 'Casper';

  // Use sub's handicap when a sub is playing (not Casper)
  const effectiveHcpA = subA && !casperA && subHandicapA !== undefined ? subHandicapA : handicapA;
  const effectiveHcpB = subB && !casperB && subHandicapB !== undefined ? subHandicapB : handicapB;

  // Display name: "Original (Sub: Dan L)" or "Original (Casper)"
  const displayA = subA ? `${playerAName}` : playerAName;
  const displayB = subB ? `${playerBName}` : playerBName;
  const subLabelA = casperA ? 'Casper' : subA ? `Sub: ${subA}` : null;
  const subLabelB = casperB ? 'Casper' : subB ? `Sub: ${subB}` : null;

  const grossA: (number | undefined)[] = [];
  const grossB: (number | undefined)[] = [];
  for (let h = 0; h < HOLE_COUNT; h++) {
    const a = scores[scoreKey(weekIndex, playerAIndex, h)];
    const b = scores[scoreKey(weekIndex, playerBIndex, h)];
    grossA.push(a);
    grossB.push(b);
  }

  const result = useMemo(
    () => calculateMatchResult(grossA, grossB, effectiveHcpA, effectiveHcpB, casperA, casperB),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(grossA), JSON.stringify(grossB), effectiveHcpA, effectiveHcpB, casperA, casperB]
  );

  const totalGrossA = grossA.every((v) => v !== undefined)
    ? grossA.reduce((s, v) => s + v!, 0)
    : null;
  const totalGrossB = grossB.every((v) => v !== undefined)
    ? grossB.reduce((s, v) => s + v!, 0)
    : null;

  const hasAnyScores = grossA.some((v) => v !== undefined) || grossB.some((v) => v !== undefined);

  // Points label uses original player name (they get the points)
  const ptsLabelA = playerAName.split(' ')[0];
  const ptsLabelB = playerBName.split(' ')[0];

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
            <tr className={`sc-player-row${casperA ? ' sc-casper-row' : ''}`}>
              <td className="sc-player-label">
                <span className={`sc-player-name${result && result.totalPointsA > result.totalPointsB ? ' sc-match-winner' : ''}`}>
                  {displayA}
                </span>
                <span className="sc-hcp">({Math.round(effectiveHcpA * 10) / 10})</span>
                {subLabelA && (
                  <span className={`sc-sub-badge${casperA ? ' sc-casper-badge' : ''}`}>
                    {subLabelA}
                  </span>
                )}
              </td>
              {Array.from({ length: HOLE_COUNT }, (_, h) => (
                <td key={h} className="sc-hole-col">
                  {casperA ? (
                    <span className="sc-casper-x">&mdash;</span>
                  ) : isAdmin ? (
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
              <td className="sc-total-col sc-total-val">
                {casperA ? '\u2014' : totalGrossA ?? ''}
              </td>
            </tr>
            {/* Player B scores */}
            <tr className={`sc-player-row${casperB ? ' sc-casper-row' : ''}`}>
              <td className="sc-player-label">
                <span className={`sc-player-name${result && result.totalPointsB > result.totalPointsA ? ' sc-match-winner' : ''}`}>
                  {displayB}
                </span>
                <span className="sc-hcp">({Math.round(effectiveHcpB * 10) / 10})</span>
                {subLabelB && (
                  <span className={`sc-sub-badge${casperB ? ' sc-casper-badge' : ''}`}>
                    {subLabelB}
                  </span>
                )}
              </td>
              {Array.from({ length: HOLE_COUNT }, (_, h) => (
                <td key={h} className="sc-hole-col">
                  {casperB ? (
                    <span className="sc-casper-x">&mdash;</span>
                  ) : isAdmin ? (
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
              <td className="sc-total-col sc-total-val">
                {casperB ? '\u2014' : totalGrossB ?? ''}
              </td>
            </tr>

            {/* Strokes given row (hide for Casper matches) */}
            {result && !casperA && !casperB && Math.round(effectiveHcpA) !== Math.round(effectiveHcpB) && (
              <tr className="sc-strokes-row">
                <td className="sc-label-col sc-strokes-label">Strokes</td>
                {Array.from({ length: HOLE_COUNT }, (_, h) => {
                  const sA = result.strokesGivenA[h];
                  const sB = result.strokesGivenB[h];
                  return (
                    <td key={h} className="sc-hole-col sc-stroke-cell">
                      {sA ? <span className="sc-stroke-dot" title={`${subA || playerAName} gets a stroke`}>&#9679;</span> :
                       sB ? <span className="sc-stroke-dot" title={`${subB || playerBName} gets a stroke`}>&#9675;</span> : ''}
                    </td>
                  );
                })}
                <td className="sc-total-col"></td>
              </tr>
            )}

            {/* Points rows — always show original player name (they get the points) */}
            {result && (
              <>
                <tr className="sc-points-row">
                  <td className="sc-label-col sc-pts-label">{ptsLabelA} Pts</td>
                  {casperA || casperB ? (
                    <td colSpan={HOLE_COUNT} className="sc-casper-pts-cell">
                      {casperA ? 'Casper' : casperB ? 'vs Casper' : ''}
                    </td>
                  ) : (
                    result.holePointsA.map((pts, h) => (
                      <td key={h} className={`sc-hole-col sc-pts${pts === 1 ? ' sc-pts-win' : pts === 0 ? ' sc-pts-lose' : ''}`}>
                        {pts}
                      </td>
                    ))
                  )}
                  <td className={`sc-total-col sc-pts-total${result.totalPointsA > result.totalPointsB ? ' sc-pts-win' : ''}`}>
                    {result.totalPointsA}
                  </td>
                </tr>
                <tr className="sc-points-row">
                  <td className="sc-label-col sc-pts-label">{ptsLabelB} Pts</td>
                  {casperA || casperB ? (
                    <td colSpan={HOLE_COUNT} className="sc-casper-pts-cell">
                      {casperB ? 'Casper' : casperA ? 'vs Casper' : ''}
                    </td>
                  ) : (
                    result.holePointsB.map((pts, h) => (
                      <td key={h} className={`sc-hole-col sc-pts${pts === 1 ? ' sc-pts-win' : pts === 0 ? ' sc-pts-lose' : ''}`}>
                        {pts}
                      </td>
                    ))
                  )}
                  <td className={`sc-total-col sc-pts-total${result.totalPointsB > result.totalPointsA ? ' sc-pts-win' : ''}`}>
                    {result.totalPointsB}
                  </td>
                </tr>
              </>
            )}

            {/* No scores yet hint for admin */}
            {!hasAnyScores && !casperA && !casperB && isAdmin && (
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
