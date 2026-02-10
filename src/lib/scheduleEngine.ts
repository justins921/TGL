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

// ── Core Schedule Generation ──

function generateOneSchedule(
  numPlayers: number,
  numWeeks: number,
  assignedByes: Record<number, number[]>
): ScheduleResult {
  const foursomeCount: Record<string, number> = {};
  const matchupCount: Record<string, number> = {};
  const byeCount = new Array(numPlayers).fill(0);

  function getFoursomeCount(a: number, b: number): number {
    return foursomeCount[pairKey(a, b)] || 0;
  }

  function getMatchupCount(a: number, b: number): number {
    return matchupCount[pairKey(a, b)] || 0;
  }

  function scoreFoursomes(foursomes: number[][]): number {
    let penalty = 0;
    for (const group of foursomes) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const after = getFoursomeCount(group[i], group[j]) + 1;
          if (after > 4) penalty += (after - 4) * (after - 4) * 50;
        }
      }
    }
    const grouped = new Set<string>();
    for (const group of foursomes) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          grouped.add(pairKey(group[i], group[j]));
        }
      }
    }
    const allActive = foursomes.flat();
    for (let i = 0; i < allActive.length; i++) {
      for (let j = i + 1; j < allActive.length; j++) {
        const key = pairKey(allActive[i], allActive[j]);
        if (!grouped.has(key)) {
          const count = getFoursomeCount(allActive[i], allActive[j]);
          if (count < 2) penalty += (2 - count) * 3;
        }
      }
    }
    return penalty;
  }

  function scoreMatchups(foursomes: number[][]): number {
    let penalty = 0;
    for (const group of foursomes) {
      const pairings: [number, number][][] = [
        [[group[0], group[1]], [group[2], group[3]]],
        [[group[0], group[2]], [group[1], group[3]]],
        [[group[0], group[3]], [group[1], group[2]]],
      ];
      let best = Infinity;
      for (const pairing of pairings) {
        let s = 0;
        for (const [a, b] of pairing) {
          s += getMatchupCount(a, b);
        }
        best = Math.min(best, s);
      }
      penalty += best;
    }
    return penalty;
  }

  function optimizeSwaps(foursomes: number[][]): number[][] {
    let currentMatchup = scoreMatchups(foursomes);
    let currentFoursome = scoreFoursomes(foursomes);
    let improved = true;
    let passes = 0;

    while (improved && passes < 20) {
      improved = false;
      passes++;
      for (let f1 = 0; f1 < foursomes.length; f1++) {
        for (let f2 = f1 + 1; f2 < foursomes.length; f2++) {
          for (let p1 = 0; p1 < 4; p1++) {
            for (let p2 = 0; p2 < 4; p2++) {
              const tmp = foursomes[f1][p1];
              foursomes[f1][p1] = foursomes[f2][p2];
              foursomes[f2][p2] = tmp;

              const newMatchup = scoreMatchups(foursomes);
              const newFoursome = scoreFoursomes(foursomes);

              const isBetter =
                newMatchup < currentMatchup ||
                (newMatchup === currentMatchup && newFoursome < currentFoursome);

              if (isBetter) {
                currentMatchup = newMatchup;
                currentFoursome = newFoursome;
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

  const weeks: WeekData[] = [];

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
    let bestMatchupPenalty = Infinity;
    let bestFoursomePenalty = Infinity;

    for (let t = 0; t < 1500; t++) {
      const shuffled = shuffle(activePlayers);
      const foursomes: number[][] = [];
      for (let g = 0; g < numFoursomes; g++) {
        foursomes.push(shuffled.slice(g * 4, g * 4 + 4));
      }

      const mp = scoreMatchups(foursomes);
      const fp = scoreFoursomes(foursomes);

      const isBetter =
        mp < bestMatchupPenalty ||
        (mp === bestMatchupPenalty && fp < bestFoursomePenalty);

      if (isBetter) {
        bestMatchupPenalty = mp;
        bestFoursomePenalty = fp;
        bestArrangement = foursomes.map((g) => [...g]);
      }
      if (mp === 0 && fp === 0) break;
    }

    bestArrangement = optimizeSwaps(bestArrangement!);

    const weekData: WeekData = { foursomes: [], byePlayers };

    for (const group of bestArrangement) {
      const pairings: [number, number][][] = [
        [[group[0], group[1]], [group[2], group[3]]],
        [[group[0], group[2]], [group[1], group[3]]],
        [[group[0], group[3]], [group[1], group[2]]],
      ];

      let bestPairing = pairings[0];
      let bestPScore = Infinity;
      for (const pairing of pairings) {
        let pScore = 0;
        for (const [a, b] of pairing) {
          pScore += getMatchupCount(a, b);
        }
        if (pScore < bestPScore) {
          bestPScore = pScore;
          bestPairing = pairing;
        }
      }

      weekData.foursomes.push({ players: group, matchups: bestPairing });

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = pairKey(group[i], group[j]);
          foursomeCount[key] = (foursomeCount[key] || 0) + 1;
        }
      }
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
  const fullRuns = 5;

  for (let run = 0; run < fullRuns; run++) {
    const result = generateOneSchedule(numPlayers, numWeeks, assignedByes);
    let outliers = 0;
    for (let i = 0; i < numPlayers; i++) {
      for (let j = i + 1; j < numPlayers; j++) {
        const c = result.foursomeCount[pairKey(i, j)] || 0;
        if (c < 2 || c > 4) outliers++;
      }
    }
    let matchupRepeats = 0;
    for (let i = 0; i < numPlayers; i++) {
      for (let j = i + 1; j < numPlayers; j++) {
        const c = result.matchupCount[pairKey(i, j)] || 0;
        if (c > 1) matchupRepeats += c - 1;
      }
    }
    const score = matchupRepeats * 10000 + outliers;
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
