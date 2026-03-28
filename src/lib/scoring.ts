// ── Course Configuration ──

export const HOLE_COUNT = 9;

/** Hole handicaps — lower number = harder hole = gets strokes first */
export const HOLE_HANDICAPS = [9, 17, 7, 1, 3, 13, 5, 15, 11];

import { calculateHandicap } from './types';
import type { ScheduleData, PlayerProfile } from './types';

// ── Dynamic Handicap ──

/**
 * Compute a player's handicap for a given week.
 * - Week 0 (first week): based on previous season average only
 * - Week 1+: previous season avg + all completed weekly scores averaged together
 * - Previous season avg counts as one data point alongside weekly scores
 * - If no previous season avg and no scores: handicap = 0
 */
export function getWeeklyHandicap(
  playerName: string,
  weekIndex: number,
  scheduleData: ScheduleData,
  playerProfiles: PlayerProfile[]
): number {
  const profile = playerProfiles.find((p) => p.name === playerName);
  if (!profile) return 0;

  // Find this player's index in the schedule
  const playerIdx = scheduleData.players.indexOf(playerName);
  if (playerIdx === -1) return profile.handicap;

  const scores = scheduleData.scores || {};
  const subs = scheduleData.substitutions || {};

  // Collect all gross totals from weeks BEFORE this one
  const weeklyTotals: number[] = [];
  for (let w = 0; w < weekIndex && w < scheduleData.weeks.length; w++) {
    // Skip if this player was subbed out or Casper this week
    const sub = subs[`${w}-${playerIdx}`];
    if (sub) continue; // sub played or Casper — don't count toward handicap

    // Check if all 9 holes have scores for this week
    const holeScores: number[] = [];
    let complete = true;
    for (let h = 0; h < HOLE_COUNT; h++) {
      const s = scores[`${w}-${playerIdx}-${h}`];
      if (s === undefined) {
        complete = false;
        break;
      }
      holeScores.push(s);
    }
    if (complete) {
      weeklyTotals.push(holeScores.reduce((a, b) => a + b, 0));
    }
  }

  // Build the data points: previous season avg (if exists) + weekly scores
  const dataPoints: number[] = [];
  if (profile.previousSeasonAvg !== null) {
    dataPoints.push(profile.previousSeasonAvg);
  }
  dataPoints.push(...weeklyTotals);

  if (dataPoints.length === 0) return profile.handicap;

  const avg = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
  return calculateHandicap(avg);
}

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
 * Casper scoring: when a real player faces a no-show,
 * they receive 6 + (40 + handicap - gross) * 0.5 total points.
 */
function casperPoints(handicap: number, totalGross: number): number {
  return 6 + (40 + handicap - totalGross) * 0.5;
}

/**
 * Calculate full match result from hole-by-hole gross scores.
 * Returns null if either player has incomplete scores (unless Casper).
 *
 * casperA/casperB: if true, that player is a "Casper" (no-show).
 * - Both Casper → both get 0
 * - One Casper → Casper gets 0, real player gets 6 + (40 + hcp - gross) * 0.5
 */
export function calculateMatchResult(
  grossA: (number | undefined)[],
  grossB: (number | undefined)[],
  handicapA: number,
  handicapB: number,
  casperA: boolean = false,
  casperB: boolean = false
): MatchResult | null {
  const emptyStrokes = new Array(HOLE_COUNT).fill(0);

  // Both Casper → all zeros
  if (casperA && casperB) {
    return {
      holePointsA: new Array(HOLE_COUNT).fill(0),
      holePointsB: new Array(HOLE_COUNT).fill(0),
      totalPointA: 0,
      totalPointB: 0,
      totalPointsA: 0,
      totalPointsB: 0,
      netScoresA: new Array(HOLE_COUNT).fill(0),
      netScoresB: new Array(HOLE_COUNT).fill(0),
      strokesGivenA: emptyStrokes,
      strokesGivenB: emptyStrokes,
    };
  }

  // One Casper → real player gets casper points, Casper gets 0
  if (casperA || casperB) {
    const realGross = casperA ? grossB : grossA;
    const realHcp = casperA ? handicapB : handicapA;

    // Need the real player's scores to calculate
    const totalGross = realGross.reduce<number>((s, v) => s + (v ?? 0), 0);
    const allFilled = realGross.every((v) => v !== undefined);
    if (!allFilled) return null;

    const realTotal = casperPoints(realHcp, totalGross);
    return {
      holePointsA: new Array(HOLE_COUNT).fill(0),
      holePointsB: new Array(HOLE_COUNT).fill(0),
      totalPointA: casperA ? 0 : realTotal,
      totalPointB: casperB ? 0 : realTotal,
      totalPointsA: casperA ? 0 : realTotal,
      totalPointsB: casperB ? 0 : realTotal,
      netScoresA: new Array(HOLE_COUNT).fill(0),
      netScoresB: new Array(HOLE_COUNT).fill(0),
      strokesGivenA: emptyStrokes,
      strokesGivenB: emptyStrokes,
    };
  }

  // Normal match — check all scores are present
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

  // 10th point: total NET strokes comparison (gross - handicap)
  const totalGrossA: number = grossA.reduce<number>((s, v) => s + (v ?? 0), 0);
  const totalGrossB: number = grossB.reduce<number>((s, v) => s + (v ?? 0), 0);
  const totalNetA = totalGrossA - handicapA;
  const totalNetB = totalGrossB - handicapB;
  let totalPointA: number;
  let totalPointB: number;

  if (totalNetA < totalNetB) {
    totalPointA = 1;
    totalPointB = 0;
  } else if (totalNetB < totalNetA) {
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
