// ── Course Configuration ──

export const HOLE_COUNT = 9;

/** Hole handicaps — lower number = harder hole = gets strokes first */
export const HOLE_HANDICAPS = [9, 17, 7, 1, 3, 13, 5, 15, 11];

/**
 * Rank of each hole by difficulty (1 = hardest).
 * Holes with lower hole-handicap values are ranked first.
 * Used to determine which holes receive strokes.
 */
const HOLE_DIFFICULTY_RANK: number[] = (() => {
  const indexed = HOLE_HANDICAPS.map((hh, i) => ({ idx: i, hh }));
  indexed.sort((a, b) => a.hh - b.hh);
  const ranks = new Array(HOLE_COUNT).fill(0);
  indexed.forEach((entry, rank) => {
    ranks[entry.idx] = rank + 1; // 1-based rank
  });
  return ranks;
})();

// ── Strokes Given ──

/**
 * Returns an array of 0 or 1 per hole indicating whether
 * `player` receives a stroke on that hole against `opponent`.
 * Only the higher-handicap player receives strokes, allocated
 * to the hardest holes first (lowest hole handicap number).
 */
export function getStrokesGiven(
  playerHandicap: number,
  opponentHandicap: number
): number[] {
  const diff = Math.round(playerHandicap - opponentHandicap);
  if (diff <= 0) return new Array(HOLE_COUNT).fill(0);

  const strokes = new Array(HOLE_COUNT).fill(0);
  for (let h = 0; h < HOLE_COUNT; h++) {
    if (HOLE_DIFFICULTY_RANK[h] <= diff) {
      strokes[h] = 1;
    }
  }
  return strokes;
}

// ── Points Calculation ──

export interface MatchResult {
  holePointsA: number[];  // points per hole for player A
  holePointsB: number[];  // points per hole for player B
  totalPointA: number;    // 10th point: 1, 0.5, or 0
  totalPointB: number;
  totalPointsA: number;   // sum of all 10 points
  totalPointsB: number;
  netScoresA: number[];   // net score per hole for player A
  netScoresB: number[];
  strokesGivenA: number[];
  strokesGivenB: number[];
}

/**
 * Calculate full match result from hole-by-hole gross scores.
 * Returns null if either player has incomplete scores.
 *
 * casperA/casperB: if true, that player is a "Casper" (no-show)
 * and all points go to 0 for both players.
 */
export function calculateMatchResult(
  grossA: (number | undefined)[],
  grossB: (number | undefined)[],
  handicapA: number,
  handicapB: number,
  casperA: boolean = false,
  casperB: boolean = false
): MatchResult | null {
  // If either is a Casper, all points are 0
  if (casperA || casperB) {
    return {
      holePointsA: new Array(HOLE_COUNT).fill(0),
      holePointsB: new Array(HOLE_COUNT).fill(0),
      totalPointA: 0,
      totalPointB: 0,
      totalPointsA: 0,
      totalPointsB: 0,
      netScoresA: new Array(HOLE_COUNT).fill(0),
      netScoresB: new Array(HOLE_COUNT).fill(0),
      strokesGivenA: getStrokesGiven(handicapA, handicapB),
      strokesGivenB: getStrokesGiven(handicapB, handicapA),
    };
  }

  // Check all scores are present
  for (let h = 0; h < HOLE_COUNT; h++) {
    if (grossA[h] === undefined || grossB[h] === undefined) return null;
  }

  const strokesA = getStrokesGiven(handicapA, handicapB);
  const strokesB = getStrokesGiven(handicapB, handicapA);

  const netA: number[] = [];
  const netB: number[] = [];
  const holePointsA: number[] = [];
  const holePointsB: number[] = [];

  for (let h = 0; h < HOLE_COUNT; h++) {
    const netScoreA = grossA[h]! - strokesA[h];
    const netScoreB = grossB[h]! - strokesB[h];
    netA.push(netScoreA);
    netB.push(netScoreB);

    if (netScoreA < netScoreB) {
      holePointsA.push(1);
      holePointsB.push(0);
    } else if (netScoreB < netScoreA) {
      holePointsA.push(0);
      holePointsB.push(1);
    } else {
      holePointsA.push(0.5);
      holePointsB.push(0.5);
    }
  }

  // 10th point: total gross strokes comparison
  const totalGrossA: number = grossA.reduce<number>((s, v) => s + (v ?? 0), 0);
  const totalGrossB: number = grossB.reduce<number>((s, v) => s + (v ?? 0), 0);
  let totalPointA: number;
  let totalPointB: number;

  if (totalGrossA < totalGrossB) {
    totalPointA = 1;
    totalPointB = 0;
  } else if (totalGrossB < totalGrossA) {
    totalPointA = 0;
    totalPointB = 1;
  } else {
    totalPointA = 0.5;
    totalPointB = 0.5;
  }

  return {
    holePointsA,
    holePointsB,
    totalPointA,
    totalPointB,
    totalPointsA: holePointsA.reduce((s, v) => s + v, 0) + totalPointA,
    totalPointsB: holePointsB.reduce((s, v) => s + v, 0) + totalPointB,
    netScoresA: netA,
    netScoresB: netB,
    strokesGivenA: strokesA,
    strokesGivenB: strokesB,
  };
}
