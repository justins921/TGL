import type {
  ScheduleResult,
  ScheduleData,
  ScheduleStats,
  AnalyticsData,
  WeekData,
} from './types';

// ── Utility ──

function shuffle(array: number[]): number[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// Penalty for a single pair's foursome count being outside [2,4]
function outlierPenalty(count: number): number {
  if (count < 2) return (2 - count) * (2 - count) * 10;
  if (count > 4) return (count - 4) * (count - 4) * 50;
  return 0;
}

// ── Enumerate all ways to group matches into foursomes ──
// Given 2k matches, returns all ways to pair them into k foursomes.
// Each "foursome" is 2 matches (4 distinct players).
type Match = [number, number];
type FoursomeGroup = [Match, Match];

function enumerateGroupings(matches: Match[]): FoursomeGroup[][] {
  if (matches.length === 0) return [[]];
  if (matches.length === 2) return [[[matches[0], matches[1]]]];

  const result: FoursomeGroup[][] = [];
  const first = matches[0];

  for (let i = 1; i < matches.length; i++) {
    const partner = matches[i];
    const remaining = matches.filter((_, j) => j !== 0 && j !== i);
    const subGroupings = enumerateGroupings(remaining);
    for (const sub of subGroupings) {
      result.push([[first, partner] as FoursomeGroup, ...sub]);
    }
  }

  return result;
}

// ── Round-Robin Construction ──
// For n players where n ≡ 1 (mod 4) and numWeeks = n:
// Uses the polygon method to guarantee every pair plays exactly once.
// Then optimizes foursome groupings for balance.

function generateRoundRobin(
  numPlayers: number,
  _numWeeks: number,
  assignedByes: Record<number, number[]>
): ScheduleResult {
  const n = numPlayers; // numWeeks === numPlayers for round-robin
  const halfN = (n - 1) / 2;

  // Step 1: Generate round-robin rounds using polygon method
  // Round r: player r has bye; matches: (r+k) vs (r-k) mod n, k=1..halfN
  const rrRounds: { bye: number; matches: Match[] }[] = [];
  for (let r = 0; r < n; r++) {
    const matches: Match[] = [];
    for (let k = 1; k <= halfN; k++) {
      matches.push([(r + k) % n, ((r - k) % n + n) % n]);
    }
    rrRounds.push({ bye: r, matches });
  }

  // Step 2: Map rounds to weeks, respecting assigned byes
  // Round r has player r as bye. If user assigned player p to week w,
  // place round p at week w.
  const weekToRound: number[] = new Array(n).fill(-1);
  const usedRounds = new Set<number>();

  for (const [wStr, players] of Object.entries(assignedByes)) {
    const w = parseInt(wStr);
    if (w < n && players.length >= 1) {
      const p = players[0];
      if (p < n && !usedRounds.has(p) && weekToRound[w] === -1) {
        weekToRound[w] = p;
        usedRounds.add(p);
      }
    }
  }

  // Fill remaining weeks with unused rounds (shuffled for variety between runs)
  const unusedRounds: number[] = [];
  for (let r = 0; r < n; r++) {
    if (!usedRounds.has(r)) unusedRounds.push(r);
  }
  for (let i = unusedRounds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unusedRounds[i], unusedRounds[j]] = [unusedRounds[j], unusedRounds[i]];
  }
  let uIdx = 0;
  for (let w = 0; w < n; w++) {
    if (weekToRound[w] === -1) {
      weekToRound[w] = unusedRounds[uIdx++];
    }
  }

  // Step 3: Greedy foursome grouping
  // For each week, evaluate all possible match groupings and pick the one
  // that best balances foursome pair counts toward the [2,4] range.
  const foursomeCount: Record<string, number> = {};
  const byeCount = new Array(n).fill(0);

  // Pre-compute all grouping options per week
  const allGroupings: FoursomeGroup[][][] = [];
  for (let w = 0; w < n; w++) {
    const round = rrRounds[weekToRound[w]];
    allGroupings.push(enumerateGroupings(round.matches));
  }

  // Score a grouping candidate: lower = better
  function scoreGrouping(grouping: FoursomeGroup[]): number {
    let primary = 0;
    let secondary = 0;
    for (const [m1, m2] of grouping) {
      const members = [m1[0], m1[1], m2[0], m2[1]];
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const c = (foursomeCount[pairKey(members[i], members[j])] || 0) + 1;
          primary += outlierPenalty(c);
          secondary += c * c; // tiebreaker: prefer spread
        }
      }
    }
    return primary * 10000 + secondary;
  }

  // Apply a grouping: add its foursome pairs to foursomeCount
  function applyGrouping(grouping: FoursomeGroup[], delta: number): void {
    for (const [m1, m2] of grouping) {
      const members = [m1[0], m1[1], m2[0], m2[1]];
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const key = pairKey(members[i], members[j]);
          foursomeCount[key] = (foursomeCount[key] || 0) + delta;
        }
      }
    }
  }

  // Initial greedy pass
  const currentGrouping: FoursomeGroup[][] = [];

  for (let w = 0; w < n; w++) {
    const groupings = allGroupings[w];
    let bestGrouping = groupings[0];
    let bestScore = Infinity;

    for (const grouping of groupings) {
      const score = scoreGrouping(grouping);
      if (score < bestScore) {
        bestScore = score;
        bestGrouping = grouping;
      }
    }

    currentGrouping.push(bestGrouping);
    applyGrouping(bestGrouping, +1);
    byeCount[rrRounds[weekToRound[w]].bye]++;
  }

  // Step 4: Global repair - re-evaluate each week's grouping repeatedly
  for (let pass = 0; pass < 20; pass++) {
    let improved = false;

    for (let w = 0; w < n; w++) {
      // Remove current grouping
      applyGrouping(currentGrouping[w], -1);

      // Evaluate all groupings
      const groupings = allGroupings[w];
      let bestGrouping = currentGrouping[w];
      let bestScore = Infinity;

      for (const grouping of groupings) {
        const score = scoreGrouping(grouping);
        if (score < bestScore) {
          bestScore = score;
          bestGrouping = grouping;
        }
      }

      if (bestGrouping !== currentGrouping[w]) {
        improved = true;
        currentGrouping[w] = bestGrouping;
      }

      // Re-add (possibly updated) grouping
      applyGrouping(currentGrouping[w], +1);
    }

    if (!improved) break;
  }

  // Step 5: Build final week data
  const matchupCount: Record<string, number> = {};
  const weeks: WeekData[] = [];

  for (let w = 0; w < n; w++) {
    const round = rrRounds[weekToRound[w]];
    const weekData: WeekData = { foursomes: [], byePlayers: [round.bye] };

    for (const [m1, m2] of currentGrouping[w]) {
      const players = [m1[0], m1[1], m2[0], m2[1]];
      const matchups: [number, number][] = [m1, m2];

      for (const [a, b] of matchups) {
        const key = pairKey(a, b);
        matchupCount[key] = (matchupCount[key] || 0) + 1;
      }

      weekData.foursomes.push({ players, matchups });
    }

    weeks.push(weekData);
  }

  return { weeks, foursomeCount, matchupCount, byeCount };
}

// ── Heuristic Approach (fallback for non-standard configurations) ──

function generateHeuristic(
  numPlayers: number,
  numWeeks: number,
  assignedByes: Record<number, number[]>
): ScheduleResult {
  const foursomeCount: Record<string, number> = {};
  const byeCount = new Array(numPlayers).fill(0);

  function getFoursomeCount(a: number, b: number): number {
    return foursomeCount[pairKey(a, b)] || 0;
  }

  function scoreFoursomes(foursomes: number[][]): number {
    let penalty = 0;
    for (const group of foursomes) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const after = getFoursomeCount(group[i], group[j]) + 1;
          if (after > 4) penalty += (after - 4) * (after - 4) * 50;
          if (after > 3) penalty += 5;
        }
      }
    }
    const allActive = foursomes.flat();
    const grouped = new Set<string>();
    for (const group of foursomes) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          grouped.add(pairKey(group[i], group[j]));
        }
      }
    }
    for (let i = 0; i < allActive.length; i++) {
      for (let j = i + 1; j < allActive.length; j++) {
        const key = pairKey(allActive[i], allActive[j]);
        if (!grouped.has(key)) {
          const count = getFoursomeCount(allActive[i], allActive[j]);
          if (count === 0) penalty += 8;
          else if (count < 2) penalty += 3;
        }
      }
    }
    return penalty;
  }

  function optimizeSwapsFoursome(foursomes: number[][]): number[][] {
    let currentScore = scoreFoursomes(foursomes);
    let improved = true;
    let passes = 0;

    while (improved && passes < 30) {
      improved = false;
      passes++;
      for (let f1 = 0; f1 < foursomes.length; f1++) {
        for (let f2 = f1 + 1; f2 < foursomes.length; f2++) {
          for (let p1 = 0; p1 < 4; p1++) {
            for (let p2 = 0; p2 < 4; p2++) {
              const tmp = foursomes[f1][p1];
              foursomes[f1][p1] = foursomes[f2][p2];
              foursomes[f2][p2] = tmp;

              const newScore = scoreFoursomes(foursomes);
              if (newScore < currentScore) {
                currentScore = newScore;
                improved = true;
              } else {
                foursomes[f2][p2] = foursomes[f1][p1];
                foursomes[f1][p1] = tmp;
              }
            }
          }
        }
      }
    }
    return foursomes;
  }

  // Phase 1: Assign foursomes per week
  const weekAssignments: { groups: number[][]; byePlayers: number[] }[] = [];

  for (let w = 0; w < numWeeks; w++) {
    let byePlayers: number[] = [];
    if (assignedByes[w] && assignedByes[w].length > 0) {
      byePlayers = [...assignedByes[w]];
    }

    let activePlayers: number[] = [];
    for (let i = 0; i < numPlayers; i++) {
      if (!byePlayers.includes(i)) activePlayers.push(i);
    }

    while (activePlayers.length % 4 !== 0 && activePlayers.length > 4) {
      const candidates = [...activePlayers].sort((a, b) => {
        if (byeCount[a] !== byeCount[b]) return byeCount[a] - byeCount[b];
        return Math.random() - 0.5;
      });
      const byePlayer = candidates[0];
      byePlayers.push(byePlayer);
      activePlayers = activePlayers.filter((p) => p !== byePlayer);
    }

    byePlayers.forEach((p) => {
      byeCount[p]++;
    });

    const numFoursomes = Math.floor(activePlayers.length / 4);
    let bestArrangement: number[][] | null = null;
    let bestScore = Infinity;

    for (let t = 0; t < 2000; t++) {
      const shuffled = shuffle(activePlayers);
      const foursomes: number[][] = [];
      for (let g = 0; g < numFoursomes; g++) {
        foursomes.push(shuffled.slice(g * 4, g * 4 + 4));
      }
      const score = scoreFoursomes(foursomes);
      if (score < bestScore) {
        bestScore = score;
        bestArrangement = foursomes.map((g) => [...g]);
      }
      if (score === 0) break;
    }

    bestArrangement = optimizeSwapsFoursome(bestArrangement!);

    for (const group of bestArrangement) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = pairKey(group[i], group[j]);
          foursomeCount[key] = (foursomeCount[key] || 0) + 1;
        }
      }
    }

    weekAssignments.push({ groups: bestArrangement, byePlayers });
  }

  // Phase 2: Global foursome repair
  for (let pass = 0; pass < 25; pass++) {
    let improved = false;
    for (let w = 0; w < numWeeks; w++) {
      const groups = weekAssignments[w].groups;
      for (let f1 = 0; f1 < groups.length; f1++) {
        for (let f2 = f1 + 1; f2 < groups.length; f2++) {
          for (let p1 = 0; p1 < 4; p1++) {
            for (let p2 = 0; p2 < 4; p2++) {
              const a = groups[f1][p1];
              const b = groups[f2][p2];
              const othersF1: number[] = [];
              for (let k = 0; k < 4; k++) {
                if (k !== p1) othersF1.push(groups[f1][k]);
              }
              const othersF2: number[] = [];
              for (let k = 0; k < 4; k++) {
                if (k !== p2) othersF2.push(groups[f2][k]);
              }

              let delta = 0;
              for (const x of othersF1) {
                delta +=
                  outlierPenalty((foursomeCount[pairKey(a, x)] || 0) - 1) -
                  outlierPenalty(foursomeCount[pairKey(a, x)] || 0);
                delta +=
                  outlierPenalty((foursomeCount[pairKey(b, x)] || 0) + 1) -
                  outlierPenalty(foursomeCount[pairKey(b, x)] || 0);
              }
              for (const x of othersF2) {
                delta +=
                  outlierPenalty((foursomeCount[pairKey(b, x)] || 0) - 1) -
                  outlierPenalty(foursomeCount[pairKey(b, x)] || 0);
                delta +=
                  outlierPenalty((foursomeCount[pairKey(a, x)] || 0) + 1) -
                  outlierPenalty(foursomeCount[pairKey(a, x)] || 0);
              }

              if (delta < 0) {
                groups[f1][p1] = b;
                groups[f2][p2] = a;
                for (const x of othersF1) {
                  foursomeCount[pairKey(a, x)] = (foursomeCount[pairKey(a, x)] || 0) - 1;
                  foursomeCount[pairKey(b, x)] = (foursomeCount[pairKey(b, x)] || 0) + 1;
                }
                for (const x of othersF2) {
                  foursomeCount[pairKey(b, x)] = (foursomeCount[pairKey(b, x)] || 0) - 1;
                  foursomeCount[pairKey(a, x)] = (foursomeCount[pairKey(a, x)] || 0) + 1;
                }
                improved = true;
              }
            }
          }
        }
      }
    }
    if (!improved) break;
  }

  // Phase 3: Assign matchup pairings greedily
  const matchupCount: Record<string, number> = {};
  const weeks: WeekData[] = [];

  for (const wa of weekAssignments) {
    const weekData: WeekData = { foursomes: [], byePlayers: wa.byePlayers };
    for (const group of wa.groups) {
      const pairings: [number, number][][] = [
        [[group[0], group[1]], [group[2], group[3]]],
        [[group[0], group[2]], [group[1], group[3]]],
        [[group[0], group[3]], [group[1], group[2]]],
      ];
      let bestPairing = pairings[0];
      let bestScore = Infinity;
      for (const pairing of pairings) {
        let score = 0;
        for (const [a, b] of pairing) {
          const c = matchupCount[pairKey(a, b)] || 0;
          score += c * c * 10 + c;
        }
        if (score < bestScore) {
          bestScore = score;
          bestPairing = pairing;
        }
      }
      weekData.foursomes.push({ players: group, matchups: bestPairing });
      for (const [a, b] of bestPairing) {
        const key = pairKey(a, b);
        matchupCount[key] = (matchupCount[key] || 0) + 1;
      }
    }
    weeks.push(weekData);
  }

  return { weeks, foursomeCount, matchupCount, byeCount };
}

// ── Main Generation ──

function generateOneSchedule(
  numPlayers: number,
  numWeeks: number,
  assignedByes: Record<number, number[]>
): ScheduleResult {
  // Use round-robin for perfect 1v1 when conditions allow:
  // - n ≡ 1 (mod 4) ensures (n-1) active players form exact foursomes
  // - numWeeks === numPlayers ensures exactly 1 bye per player
  if (numPlayers >= 5 && numPlayers % 4 === 1 && numWeeks === numPlayers) {
    return generateRoundRobin(numPlayers, numWeeks, assignedByes);
  }
  return generateHeuristic(numPlayers, numWeeks, assignedByes);
}

// ── Public API ──

export function generateSchedule(
  players: string[],
  numWeeks: number,
  assignedByes: Record<number, number[]>,
  subs: string[] = []
): ScheduleData {
  const numPlayers = players.length;

  if (numPlayers < 4) {
    throw new Error('You need at least 4 players.');
  }

  let bestResult: ScheduleResult | null = null;
  let bestOverallScore = Infinity;
  const fullRuns = 10;

  for (let run = 0; run < fullRuns; run++) {
    const result = generateOneSchedule(numPlayers, numWeeks, assignedByes);

    let matchupRepeats = 0;
    let unplayedPairs = 0;
    let foursomeOutliers = 0;
    for (let i = 0; i < numPlayers; i++) {
      for (let j = i + 1; j < numPlayers; j++) {
        const mc = result.matchupCount[pairKey(i, j)] || 0;
        if (mc > 1) matchupRepeats += mc - 1;
        if (mc === 0) unplayedPairs++;
        const fc = result.foursomeCount[pairKey(i, j)] || 0;
        if (fc < 2 || fc > 4) foursomeOutliers++;
      }
    }
    const score =
      matchupRepeats * 100000 +
      unplayedPairs * 10000 +
      foursomeOutliers * 100;

    if (score < bestOverallScore) {
      bestOverallScore = score;
      bestResult = result;
    }
  }

  return {
    weeks: bestResult!.weeks,
    players,
    subs,
    foursomeCount: bestResult!.foursomeCount,
    matchupCount: bestResult!.matchupCount,
    byeCount: bestResult!.byeCount,
  };
}

export function computeStats(data: ScheduleData): ScheduleStats {
  const { players, foursomeCount, matchupCount, byeCount } = data;
  const numPlayers = players.length;
  const matchupCounts: number[] = [];
  const foursomeCounts: number[] = [];

  for (let i = 0; i < numPlayers; i++) {
    for (let j = i + 1; j < numPlayers; j++) {
      const key = pairKey(i, j);
      matchupCounts.push(matchupCount[key] || 0);
      foursomeCounts.push(foursomeCount[key] || 0);
    }
  }

  return {
    totalPairs: matchupCounts.length,
    pairsExactlyOnce: matchupCounts.filter((c) => c === 1).length,
    matchupMin: Math.min(...matchupCounts),
    matchupMax: Math.max(...matchupCounts),
    foursomeMin: Math.min(...foursomeCounts),
    foursomeMax: Math.max(...foursomeCounts),
    byeMin: Math.min(...byeCount),
    byeMax: Math.max(...byeCount),
  };
}

export function computeAnalytics(data: ScheduleData): AnalyticsData {
  const { weeks, players } = data;
  const numPlayers = players.length;
  const playerWeekly = Array.from({ length: numPlayers }, () => [] as any[]);
  const foursomePairCount: Record<string, number> = {};
  const matchupPairCount: Record<string, number> = {};

  for (let w = 0; w < weeks.length; w++) {
    const weekData = weeks[w];

    for (const p of weekData.byePlayers) {
      playerWeekly[p].push({ week: w + 1, opponent: null, partners: [], bye: true });
    }

    for (const foursome of weekData.foursomes) {
      const opponentMap: Record<number, number> = {};
      for (const [a, b] of foursome.matchups) {
        opponentMap[a] = b;
        opponentMap[b] = a;
        const key = pairKey(a, b);
        matchupPairCount[key] = (matchupPairCount[key] || 0) + 1;
      }

      for (let i = 0; i < foursome.players.length; i++) {
        for (let j = i + 1; j < foursome.players.length; j++) {
          const key = pairKey(foursome.players[i], foursome.players[j]);
          foursomePairCount[key] = (foursomePairCount[key] || 0) + 1;
        }
      }

      for (const p of foursome.players) {
        const partners = foursome.players.filter(
          (x) => x !== p && x !== opponentMap[p]
        );
        playerWeekly[p].push({
          week: w + 1,
          opponent: opponentMap[p],
          partners,
          bye: false,
        });
      }
    }
  }

  return { playerWeekly, foursomePairCount, matchupPairCount };
}

export { pairKey };
