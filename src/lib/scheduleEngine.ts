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

// ── Core Schedule Generation ──
// Split into 3 phases:
// Phase 1: Assign foursomes per week (greedy + local swap)
// Phase 2: Global foursome repair (swap across all weeks)
// Phase 3: Assign 1v1 matchups (greedy, given fixed foursomes)

function generateOneSchedule(
  numPlayers: number,
  numWeeks: number,
  assignedByes: Record<number, number[]>
): ScheduleResult {
  const foursomeCount: Record<string, number> = {};
  const byeCount = new Array(numPlayers).fill(0);

  function getFoursomeCount(a: number, b: number): number {
    return foursomeCount[pairKey(a, b)] || 0;
  }

  // Score foursome grouping for a set of foursomes (lower = better)
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
    // Reward grouping underrepresented pairs
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

  // Local swap optimizer (foursome balance only)
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

  // ── Phase 1: Assign foursomes per week ──
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

    // Random search: score by foursome balance only
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

    // Local swap optimizer
    bestArrangement = optimizeSwapsFoursome(bestArrangement!);

    // Update global foursome counts
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

  // ── Phase 2: Global foursome repair ──
  // Try swapping players between foursomes in each week to improve
  // global foursome balance. Accept swaps that reduce total outlier penalty.

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

              // Compute delta in global outlier penalty
              const othersF1: number[] = [];
              for (let k = 0; k < 4; k++) {
                if (k !== p1) othersF1.push(groups[f1][k]);
              }
              const othersF2: number[] = [];
              for (let k = 0; k < 4; k++) {
                if (k !== p2) othersF2.push(groups[f2][k]);
              }

              let delta = 0;

              // a leaves F1, b joins F1
              for (const x of othersF1) {
                const keyAX = pairKey(a, x);
                const oldAX = foursomeCount[keyAX] || 0;
                delta += outlierPenalty(oldAX - 1) - outlierPenalty(oldAX);

                const keyBX = pairKey(b, x);
                const oldBX = foursomeCount[keyBX] || 0;
                delta += outlierPenalty(oldBX + 1) - outlierPenalty(oldBX);
              }

              // b leaves F2, a joins F2
              for (const x of othersF2) {
                const keyBX = pairKey(b, x);
                const oldBX = foursomeCount[keyBX] || 0;
                delta += outlierPenalty(oldBX - 1) - outlierPenalty(oldBX);

                const keyAX = pairKey(a, x);
                const oldAX = foursomeCount[keyAX] || 0;
                delta += outlierPenalty(oldAX + 1) - outlierPenalty(oldAX);
              }

              if (delta < 0) {
                // Accept swap
                groups[f1][p1] = b;
                groups[f2][p2] = a;

                // Update foursomeCount
                for (const x of othersF1) {
                  const keyAX = pairKey(a, x);
                  foursomeCount[keyAX] = (foursomeCount[keyAX] || 0) - 1;
                  const keyBX = pairKey(b, x);
                  foursomeCount[keyBX] = (foursomeCount[keyBX] || 0) + 1;
                }
                for (const x of othersF2) {
                  const keyBX = pairKey(b, x);
                  foursomeCount[keyBX] = (foursomeCount[keyBX] || 0) - 1;
                  const keyAX = pairKey(a, x);
                  foursomeCount[keyAX] = (foursomeCount[keyAX] || 0) + 1;
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

  // ── Phase 3: Assign 1v1 matchups greedily ──
  // Given fixed foursome assignments, pick the best 1v1 pairings
  // across all weeks to maximize matchup coverage.
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

      // Pick pairing that best uses unplayed pairs
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

// ── Public API ──

export function generateSchedule(
  players: string[],
  numWeeks: number,
  assignedByes: Record<number, number[]>
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

    // Score: prioritize matchup uniqueness, then foursome balance
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
    // Heavily penalize foursome outliers (especially 5+) and matchup repeats
    const score =
      matchupRepeats * 10000 +
      unplayedPairs * 1000 +
      foursomeOutliers * 5000;

    if (score < bestOverallScore) {
      bestOverallScore = score;
      bestResult = result;
    }
  }

  return {
    weeks: bestResult!.weeks,
    players,
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
