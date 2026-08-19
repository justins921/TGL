import React, { useState, useCallback, useMemo } from 'react';

// ── Player assignments by tier ──
const PLAYER_NAMES: Record<string, string> = {
  'A1': 'Jeff B', 'A2': 'Justin S', 'A3': 'Tim M', 'A4': 'John M',
  'B1': 'Joe D', 'B2': 'Mike S', 'B3': 'Lee N', 'B4': 'Tim B',
  'C1': 'Buddha', 'C2': 'Mark L', 'C3': 'Bryon A', 'C4': 'Kevin F',
  'D1': 'David L', 'D2': 'Terry S', 'D3': 'Rudy', 'D4': 'Tom K',
};

// ── Rotation schedule (fixed) ──
// Each round: 4 foursomes, each with [A, B, C, D] tier labels
const ROTATION: string[][][] = [
  // Round 1
  [['A1','B4','C3','D2'], ['A2','B3','C2','D3'], ['A3','B2','C1','D4'], ['A4','B1','C4','D1']],
  // Round 2 (quick swap F1↔F2, F3↔F4)
  [['A1','B3','C3','D3'], ['A2','B4','C2','D2'], ['A3','B1','C4','D4'], ['A4','B2','C1','D1']],
  // Round 3 (after lunch)
  [['A1','B2','C4','D3'], ['A2','B1','C1','D2'], ['A3','B4','C2','D1'], ['A4','B3','C3','D4']],
];

const HOLES_PER_ROUND = 9;
const NUM_ROUNDS = 3;
const NUM_FOURSOMES = 4;

type TournamentScores = Record<string, number>;

interface SkinResult {
  hole: number; // global hole number 1-27
  round: number;
  holeInRound: number;
  winner: number | null; // foursome index (0-3) or null if carried
  skinsWon: number; // how many skins won on this hole
  scores: (number | null)[]; // score for each foursome
  available: number; // pile available going into this hole
  capped: boolean; // true if skins were held back due to cap
}


interface Props {
  isAdmin: boolean;
}

// ── Skins calculation ──
// Each 9 is independent. Carry capped at 3, excess added immediately.
function calculateSkins(scores: TournamentScores): SkinResult[] {
  const results: SkinResult[] = [];
  let available = 1;
  let heldBack = 0;

  for (let r = 0; r < NUM_ROUNDS; r++) {

    for (let h = 0; h < HOLES_PER_ROUND; h++) {
      const globalHole = r * HOLES_PER_ROUND + h + 1;
      const foursomeScores: (number | null)[] = [];

      for (let f = 0; f < NUM_FOURSOMES; f++) {
        const key = `${r}-${f}-${h}`;
        foursomeScores.push(scores[key] !== undefined ? scores[key] : null);
      }

      const validScores = foursomeScores.filter((s): s is number => s !== null);

      if (validScores.length < NUM_FOURSOMES) {
        results.push({
          hole: globalHole, round: r, holeInRound: h,
          winner: null, skinsWon: 0, scores: foursomeScores,
          available, capped: false,
        });
        continue;
      }

      const minScore = Math.min(...validScores);
      const winnersCount = foursomeScores.filter((s) => s === minScore).length;

      if (winnersCount === 1) {
        // Sole winner gets the current pile (max 3)
        // Excess rolls into the next pile start
        const winnerIdx = foursomeScores.indexOf(minScore);
        results.push({
          hole: globalHole, round: r, holeInRound: h,
          winner: winnerIdx, skinsWon: available, scores: foursomeScores,
          available, capped: false,
        });
        available = 1 + heldBack; // excess starts next pile
        heldBack = 0;
      } else {
        // Tie — carry over but cap at 3
        if (available >= 3) {
          heldBack++;
          results.push({
            hole: globalHole, round: r, holeInRound: h,
            winner: null, skinsWon: 0, scores: foursomeScores,
            available, capped: true,
          });
        } else {
          available++;
          results.push({
            hole: globalHole, round: r, holeInRound: h,
            winner: null, skinsWon: 0, scores: foursomeScores,
            available, capped: false,
          });
        }
      }
    }

    // No reset between rounds — skins carry across all 27 holes
  }

  return results;
}

// ── Analytics: cross-tier pairing matrix ──
function buildPairingMatrix(): Record<string, Record<string, number>> {
  // For each tier pair (B-C, B-D, C-D), count how often each position pair plays together
  const tiers = ['B', 'C', 'D'];
  const positions = [1, 2, 3, 4];
  const matrix: Record<string, Record<string, number>> = {};

  // Build all labels
  for (const t1 of tiers) {
    for (const p1 of positions) {
      const label1 = `${t1}${p1}`;
      matrix[label1] = {};
      for (const t2 of tiers) {
        if (t2 <= t1) continue; // only upper triangle (B-C, B-D, C-D)
        for (const p2 of positions) {
          matrix[label1][`${t2}${p2}`] = 0;
        }
      }
    }
  }

  // Count pairings across all rounds
  for (let r = 0; r < NUM_ROUNDS; r++) {
    for (let f = 0; f < NUM_FOURSOMES; f++) {
      const foursome = ROTATION[r][f];
      // Get B, C, D members (skip A - anchored)
      const members = foursome.filter((m) => m[0] !== 'A');
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          let m1 = members[i];
          let m2 = members[j];
          // Ensure alphabetical tier order
          if (m1[0] > m2[0]) {
            [m1, m2] = [m2, m1];
          }
          if (matrix[m1] && matrix[m1][m2] !== undefined) {
            matrix[m1][m2]++;
          }
        }
      }
    }
  }

  return matrix;
}

export default function Tournament({ isAdmin }: Props) {
  const [scores, setScores] = useState<TournamentScores>(() => {
    try {
      return JSON.parse(localStorage.getItem('tgl-tournament') || '{}');
    } catch {
      return {};
    }
  });
  const [activeRound, setActiveRound] = useState(0);
  const [activeSection, setActiveSection] = useState<'schedule' | 'scoring' | 'skins' | 'analytics'>('schedule');

  const persistScores = useCallback((newScores: TournamentScores) => {
    setScores(newScores);
    localStorage.setItem('tgl-tournament', JSON.stringify(newScores));
  }, []);

  const handleScoreChange = useCallback(
    (round: number, foursome: number, hole: number, value: string) => {
      const key = `${round}-${foursome}-${hole}`;
      const newScores = { ...scores };
      if (value === '') {
        delete newScores[key];
      } else {
        const num = parseInt(value);
        if (!isNaN(num) && num >= -5 && num <= 20) {
          newScores[key] = num;
        }
      }
      persistScores(newScores);
    },
    [scores, persistScores]
  );

  const handleClearRound = useCallback(
    (round: number) => {
      const newScores = { ...scores };
      for (let f = 0; f < NUM_FOURSOMES; f++) {
        for (let h = 0; h < HOLES_PER_ROUND; h++) {
          delete newScores[`${round}-${f}-${h}`];
        }
      }
      persistScores(newScores);
    },
    [scores, persistScores]
  );

  const skinResults = useMemo(() => calculateSkins(scores), [scores]);

  // Skins leaderboard (hole wins + leftover awards)
  const skinsLeaderboard = useMemo(() => {
    const totals = [0, 0, 0, 0];
    for (const result of skinResults) {
      if (result.winner !== null) {
        totals[result.winner] += result.skinsWon;
      }
    }
    return totals;
  }, [skinResults]);

  const totalSkinsAwarded = skinsLeaderboard.reduce((a, b) => a + b, 0);

  // Individual player skins: each player gets credit for skins won
  // by their foursome during the round they were in it
  const playerSkins = useMemo(() => {
    const totals: Record<string, number> = {};
    // Initialize all players
    for (const round of ROTATION) {
      for (const foursome of round) {
        for (const player of foursome) {
          if (!totals[player]) totals[player] = 0;
        }
      }
    }
    for (const result of skinResults) {
      if (result.winner === null) continue;
      const round = result.round;
      const foursome = ROTATION[round][result.winner];
      for (const player of foursome) {
        totals[player] += result.skinsWon;
      }
    }
    return Object.entries(totals)
      .map(([name, skins]) => ({ name, skins }))
      .sort((a, b) => b.skins - a.skins || a.name.localeCompare(b.name));
  }, [skinResults]);

  const pairingMatrix = useMemo(() => buildPairingMatrix(), []);

  // Check if a round has any scores
  const roundHasScores = (round: number): boolean => {
    for (let f = 0; f < NUM_FOURSOMES; f++) {
      for (let h = 0; h < HOLES_PER_ROUND; h++) {
        if (scores[`${round}-${f}-${h}`] !== undefined) return true;
      }
    }
    return false;
  };

  // Check if a round is complete
  const roundIsComplete = (round: number): boolean => {
    for (let f = 0; f < NUM_FOURSOMES; f++) {
      for (let h = 0; h < HOLES_PER_ROUND; h++) {
        if (scores[`${round}-${f}-${h}`] === undefined) return false;
      }
    }
    return true;
  };

  return (
    <>
      <div className="banner">
        <div className="banner-icon">&#127942;</div>
        <h1>Tournament</h1>
        <p>27-Hole Scramble Skins</p>
      </div>

      <div className="page-content">
        {/* Section Tabs */}
        <div className="tourn-section-tabs">
          <button
            className={`tourn-section-tab${activeSection === 'schedule' ? ' active' : ''}`}
            onClick={() => setActiveSection('schedule')}
          >
            Schedule
          </button>
          {isAdmin && (
            <button
              className={`tourn-section-tab${activeSection === 'scoring' ? ' active' : ''}`}
              onClick={() => setActiveSection('scoring')}
            >
              Scoring
            </button>
          )}
          <button
            className={`tourn-section-tab${activeSection === 'skins' ? ' active' : ''}`}
            onClick={() => setActiveSection('skins')}
          >
            Skins
          </button>
          <button
            className={`tourn-section-tab${activeSection === 'analytics' ? ' active' : ''}`}
            onClick={() => setActiveSection('analytics')}
          >
            Analytics
          </button>
        </div>

        {/* ── Schedule Section ── */}
        {activeSection === 'schedule' && (
          <>
            {/* Round tabs */}
            <div className="tourn-round-tabs">
              {Array.from({ length: NUM_ROUNDS }, (_, r) => (
                <button
                  key={r}
                  className={`tourn-round-tab${activeRound === r ? ' active' : ''}`}
                  onClick={() => setActiveRound(r)}
                >
                  R{r + 1}
                  {roundIsComplete(r) && <span className="tourn-round-check"> &#10003;</span>}
                </button>
              ))}
            </div>

            {/* Tee-off order note */}
            <div className="tourn-teeoff-note">
              Tee-off order: F1, F2, F3, F4 &middot; Holes {activeRound * 9 + 1}-{activeRound * 9 + 9}
            </div>

            {/* Foursome cards for active round */}
            {ROTATION[activeRound].map((foursome, fIdx) => (
              <div key={fIdx} className="tourn-foursome-card">
                <div className="tourn-foursome-header">
                  <span className="tourn-foursome-title">Foursome {fIdx + 1}</span>
                  <span className="tourn-foursome-tee">Tee #{fIdx + 1}</span>
                </div>
                <div className="tourn-players-grid">
                  {foursome.map((player, pIdx) => {
                    const tier = player[0];
                    const name = PLAYER_NAMES[player];
                    return (
                      <div key={pIdx} className={`tourn-player-chip tier-${tier.toLowerCase()}`}>
                        {name ? `${name} (${player})` : player}
                      </div>
                    );
                  })}
                </div>
                {/* Show scores if they exist */}
                {(() => {
                  const holeScores: (number | null)[] = [];
                  let hasAny = false;
                  for (let h = 0; h < HOLES_PER_ROUND; h++) {
                    const s = scores[`${activeRound}-${fIdx}-${h}`];
                    if (s !== undefined) {
                      holeScores.push(s);
                      hasAny = true;
                    } else {
                      holeScores.push(null);
                    }
                  }
                  if (!hasAny) return null;
                  const total = holeScores.reduce((a, b) => a !== null && b !== null ? a + b : a, 0 as number | null);
                  return (
                    <div className="tourn-scores-preview">
                      <div className="tourn-scores-row">
                        {holeScores.map((s, h) => (
                          <div key={h} className="tourn-score-cell">
                            <span className="tourn-score-hole">{h + 1}</span>
                            <span className="tourn-score-val">{s !== null ? s : '-'}</span>
                          </div>
                        ))}
                        <div className="tourn-score-cell tourn-score-total">
                          <span className="tourn-score-hole">Tot</span>
                          <span className="tourn-score-val">
                            {holeScores.every((s) => s !== null) ? total : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </>
        )}

        {/* ── Scoring Section (Admin Only) ── */}
        {activeSection === 'scoring' && isAdmin && (
          <>
            <div className="tourn-round-tabs">
              {Array.from({ length: NUM_ROUNDS }, (_, r) => (
                <button
                  key={r}
                  className={`tourn-round-tab${activeRound === r ? ' active' : ''}`}
                  onClick={() => setActiveRound(r)}
                >
                  R{r + 1}
                  {roundIsComplete(r) && <span className="tourn-round-check"> &#10003;</span>}
                </button>
              ))}
            </div>

            <div className="card">
              <div className="card-title">Round {activeRound + 1} Scores</div>
              <div className="card-subtitle">
                Enter one scramble score per hole per foursome (Holes {activeRound * 9 + 1}-{activeRound * 9 + 9})
              </div>

              <div className="tourn-scoring-scroll">
                <table className="tourn-scoring-table">
                  <thead>
                    <tr>
                      <th className="tourn-scoring-label-col">Foursome</th>
                      {Array.from({ length: HOLES_PER_ROUND }, (_, h) => (
                        <th key={h} className="tourn-scoring-hole-col">{h + 1}</th>
                      ))}
                      <th className="tourn-scoring-total-col">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROTATION[activeRound].map((foursome, fIdx) => {
                      let total = 0;
                      let allComplete = true;
                      for (let h = 0; h < HOLES_PER_ROUND; h++) {
                        const s = scores[`${activeRound}-${fIdx}-${h}`];
                        if (s !== undefined) {
                          total += s;
                        } else {
                          allComplete = false;
                        }
                      }
                      return (
                        <React.Fragment key={fIdx}>
                          <tr>
                            <td className="tourn-scoring-label">
                              <span className="tourn-scoring-fname">F{fIdx + 1}</span>
                              <span className="tourn-scoring-fplayers">
                                {foursome.map((p) => PLAYER_NAMES[p] || p).join(', ')}
                              </span>
                            </td>
                            {Array.from({ length: HOLES_PER_ROUND }, (_, h) => {
                              const key = `${activeRound}-${fIdx}-${h}`;
                              return (
                                <td key={h}>
                                  <input
                                    className="tourn-score-input"
                                    type="number"
                                    min={-5}
                                    max={20}
                                    value={scores[key] !== undefined ? scores[key] : ''}
                                    onChange={(e) => handleScoreChange(activeRound, fIdx, h, e.target.value)}
                                  />
                                </td>
                              );
                            })}
                            <td className="tourn-scoring-total">
                              {allComplete ? total : '-'}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {roundHasScores(activeRound) && (
                <button
                  className="tourn-clear-btn"
                  onClick={() => {
                    if (confirm(`Clear all scores for Round ${activeRound + 1}?`)) {
                      handleClearRound(activeRound);
                    }
                  }}
                >
                  Clear Round {activeRound + 1}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Skins Section ── */}
        {activeSection === 'skins' && (
          <>
            {/* Skins Leaderboard */}
            <div className="card">
              <div className="card-title">Skins Leaderboard</div>
              <div className="tourn-lb-grid">
                {skinsLeaderboard
                  .map((total, idx) => ({ foursome: idx, total }))
                  .sort((a, b) => b.total - a.total)
                  .map((entry, rank) => (
                    <div
                      key={entry.foursome}
                      className={`tourn-lb-row${rank === 0 && entry.total > 0 ? ' leader' : ''}`}
                    >
                      <span className="tourn-lb-rank">{rank + 1}</span>
                      <span className="tourn-lb-name">F{entry.foursome + 1}: {PLAYER_NAMES[ROTATION[0][entry.foursome][0]] || ROTATION[0][entry.foursome][0]}</span>
                      <span className="tourn-lb-skins">{entry.total}</span>
                    </div>
                  ))}
              </div>
              <div className="tourn-lb-summary">
                {totalSkinsAwarded} of 27 skins awarded
                {skinResults.some((r) => r.winner === null && r.scores.every((s) => s !== null)) && (
                  <> &middot; {skinResults.filter((r) => r.winner === null && r.scores.every((s) => s !== null)).length} in carry</>
                )}
              </div>
            </div>

            {/* Individual Player Skins */}
            <div className="card">
              <div className="card-title">Individual Skins</div>
              <div className="tourn-lb-grid">
                {playerSkins.map((entry, rank) => (
                  <div
                    key={entry.name}
                    className={`tourn-lb-row${rank === 0 && entry.skins > 0 ? ' leader' : ''}`}
                  >
                    <span className="tourn-lb-rank">{rank + 1}</span>
                    <span className="tourn-lb-name">{PLAYER_NAMES[entry.name] || entry.name} ({entry.name})</span>
                    <span className="tourn-lb-skins">{entry.skins}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skins Detail by Round */}
            <div className="tourn-round-tabs">
              {Array.from({ length: NUM_ROUNDS }, (_, r) => (
                <button
                  key={r}
                  className={`tourn-round-tab${activeRound === r ? ' active' : ''}`}
                  onClick={() => setActiveRound(r)}
                >
                  R{r + 1}
                </button>
              ))}
            </div>

            <div className="card">
              <div className="card-title">Round {activeRound + 1} Skins</div>
              <div className="tourn-skins-scroll">
                <table className="tourn-skins-table">
                  <thead>
                    <tr>
                      <th className="tourn-skins-hole-header">Hole</th>
                      {Array.from({ length: NUM_FOURSOMES }, (_, f) => (
                        <th key={f}>F{f + 1}</th>
                      ))}
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skinResults
                      .filter((r) => r.round === activeRound)
                      .map((result) => {
                        const allScored = result.scores.every((s) => s !== null);
                        return (
                          <tr key={result.hole}>
                            <td className="tourn-skins-hole-num">{result.holeInRound + 1}</td>
                            {result.scores.map((s, f) => (
                              <td
                                key={f}
                                className={`tourn-skins-score${
                                  allScored && result.winner === f ? ' winner' : ''
                                }${
                                  allScored && s !== null && result.winner !== null && result.winner !== f
                                    ? ' loser'
                                    : ''
                                }`}
                              >
                                {s !== null ? s : '-'}
                              </td>
                            ))}
                            <td className="tourn-skins-result">
                              {!allScored ? (
                                <span className="tourn-skins-pending">--</span>
                              ) : result.winner !== null ? (
                                <span className="tourn-skins-won">
                                  F{result.winner + 1} wins {result.skinsWon}
                                </span>
                              ) : result.capped ? (
                                <span className="tourn-skins-capped">Capped (3 max)</span>
                              ) : (
                                <span className="tourn-skins-carry">Carry → {result.available}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Analytics Section ── */}
        {activeSection === 'analytics' && (
          <>
            {/* Full Schedule Overview */}
            <div className="card">
              <div className="card-title">Full Rotation Schedule</div>
              <div className="card-subtitle">
                A players anchor their foursome. B, C, D rotate each round.
              </div>
              <div className="tourn-full-schedule">
                {ROTATION.map((round, r) => (
                  <div key={r} className="tourn-full-round">
                    <div className="tourn-full-round-title">Round {r + 1}</div>
                    <div className="tourn-full-round-grid">
                      {round.map((foursome, f) => (
                        <div key={f} className="tourn-full-foursome">
                          <div className="tourn-full-foursome-name">F{f + 1}</div>
                          <div className="tourn-full-foursome-players">
                            {foursome.map((p, i) => (
                              <span key={i} className={`tourn-player-chip-sm tier-${p[0].toLowerCase()}`}>
                                {PLAYER_NAMES[p] || p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-tier pairing matrix */}
            <div className="card">
              <div className="card-title">Cross-Tier Pairing Matrix</div>
              <div className="card-subtitle">
                How often each B, C, D position plays with every other across 4 rounds. Ideal: each pair meets exactly once.
              </div>

              {/* B-C Matrix */}
              <div className="tourn-matrix-section">
                <div className="tourn-matrix-label">B &harr; C Pairings</div>
                <div className="matrix-scroll">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th className="row-header"></th>
                        {[1,2,3,4].map((c) => (
                          <th key={c} className="col-header">C{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2,3,4].map((b) => (
                        <tr key={b}>
                          <th className="row-header">B{b}</th>
                          {[1,2,3,4].map((c) => {
                            const count = pairingMatrix[`B${b}`]?.[`C${c}`] || 0;
                            return (
                              <td
                                key={c}
                                style={{
                                  background: count === 1 ? 'var(--green-50)' : count > 1 ? 'var(--danger-light)' : undefined,
                                  color: count === 1 ? 'var(--green-800)' : count > 1 ? 'var(--danger)' : 'var(--muted)',
                                }}
                              >
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

              {/* B-D Matrix */}
              <div className="tourn-matrix-section">
                <div className="tourn-matrix-label">B &harr; D Pairings</div>
                <div className="matrix-scroll">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th className="row-header"></th>
                        {[1,2,3,4].map((d) => (
                          <th key={d} className="col-header">D{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2,3,4].map((b) => (
                        <tr key={b}>
                          <th className="row-header">B{b}</th>
                          {[1,2,3,4].map((d) => {
                            const count = pairingMatrix[`B${b}`]?.[`D${d}`] || 0;
                            return (
                              <td
                                key={d}
                                style={{
                                  background: count === 1 ? 'var(--green-50)' : count > 1 ? 'var(--danger-light)' : undefined,
                                  color: count === 1 ? 'var(--green-800)' : count > 1 ? 'var(--danger)' : 'var(--muted)',
                                }}
                              >
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

              {/* C-D Matrix */}
              <div className="tourn-matrix-section">
                <div className="tourn-matrix-label">C &harr; D Pairings</div>
                <div className="matrix-scroll">
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th className="row-header"></th>
                        {[1,2,3,4].map((d) => (
                          <th key={d} className="col-header">D{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1,2,3,4].map((c) => (
                        <tr key={c}>
                          <th className="row-header">C{c}</th>
                          {[1,2,3,4].map((d) => {
                            const count = pairingMatrix[`C${c}`]?.[`D${d}`] || 0;
                            return (
                              <td
                                key={d}
                                style={{
                                  background: count === 1 ? 'var(--green-50)' : count > 1 ? 'var(--danger-light)' : undefined,
                                  color: count === 1 ? 'var(--green-800)' : count > 1 ? 'var(--danger)' : 'var(--muted)',
                                }}
                              >
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
            </div>

            {/* A-player anchor summary */}
            <div className="card">
              <div className="card-title">A-Player Anchoring</div>
              <div className="card-subtitle">
                Each A player stays in the same foursome all 4 rounds. Their teammates rotate.
              </div>
              {[1,2,3,4].map((a) => (
                <div key={a} className="tourn-anchor-block">
                  <div className="tourn-anchor-header">
                    <span className="tourn-player-chip-sm tier-a">{PLAYER_NAMES['A'+a] || 'A'+a}</span>
                    <span className="tourn-anchor-label">Foursome {a} Anchor</span>
                  </div>
                  <div className="tourn-anchor-rounds">
                    {ROTATION.map((round, r) => {
                      const foursome = round[a - 1];
                      const teammates = foursome.filter((p) => p[0] !== 'A');
                      return (
                        <div key={r} className="tourn-anchor-round">
                          <span className="tourn-anchor-round-label">R{r + 1}:</span>
                          {teammates.map((t, i) => (
                            <span key={i} className={`tourn-player-chip-sm tier-${t[0].toLowerCase()}`}>
                              {PLAYER_NAMES[t] || t}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
