// ── DOM Elements ──
const numPlayersInput = document.getElementById('numPlayers');
const numWeeksInput = document.getElementById('numWeeks');
const playerNamesContainer = document.getElementById('playerNames');
const byeAssignmentsContainer = document.getElementById('byeAssignments');
const generateBtn = document.getElementById('generateBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const resultsSection = document.getElementById('results');
const scheduleContent = document.getElementById('scheduleContent');
const scheduleSummary = document.getElementById('scheduleSummary');
const printBtn = document.getElementById('printBtn');
const playerSelect = document.getElementById('playerSelect');
const weeklyTableBody = document.querySelector('#weeklyTable tbody');
const foursomeFrequency = document.getElementById('foursomeFrequency');
const matchupFrequency = document.getElementById('matchupFrequency');
const matrixTableHead = document.querySelector('#matrixTable thead');
const matrixTableBody = document.querySelector('#matrixTable tbody');

// Store last generated data for analytics
let lastScheduleData = null;

// ── Tabs ──
document.querySelectorAll('.tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Render player name inputs ──
function renderPlayerInputs() {
  const count = parseInt(numPlayersInput.value) || 0;
  const existing = playerNamesContainer.querySelectorAll('input');
  const existingValues = Array.from(existing).map(input => input.value);

  playerNamesContainer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Player ${i + 1}`;
    input.value = existingValues[i] || '';
    input.className = 'player-input';
    input.dataset.index = i;
    playerNamesContainer.appendChild(input);
  }

  renderByeAssignments();
}

// ── Render bye week assignment dropdowns ──
function renderByeAssignments() {
  const count = parseInt(numPlayersInput.value) || 0;
  const weeks = parseInt(numWeeksInput.value) || 0;
  const existingSelects = byeAssignmentsContainer.querySelectorAll('select');
  const existingValues = Array.from(existingSelects).map(s => s.value);

  byeAssignmentsContainer.innerHTML = '';
  if (count <= 0 || weeks <= 0) return;

  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'bye-row';

    const label = document.createElement('span');
    label.className = 'bye-label';
    label.textContent = getPlayerDisplayName(i);
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'bye-select';
    select.dataset.playerIndex = i;

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'No assigned bye';
    select.appendChild(noneOpt);

    for (let w = 1; w <= weeks; w++) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = `Week ${w}`;
      select.appendChild(opt);
    }

    if (existingValues[i]) select.value = existingValues[i];

    row.appendChild(select);
    byeAssignmentsContainer.appendChild(row);
  }
}

function getPlayerDisplayName(index) {
  const inputs = playerNamesContainer.querySelectorAll('input');
  if (inputs[index] && inputs[index].value.trim()) return inputs[index].value.trim();
  return `Player ${index + 1}`;
}

function getPlayerNames() {
  const inputs = playerNamesContainer.querySelectorAll('input');
  return Array.from(inputs).map((input, i) => input.value.trim() || `Player ${i + 1}`);
}

function getByeAssignments() {
  const selects = byeAssignmentsContainer.querySelectorAll('select');
  const byes = {};
  selects.forEach(s => {
    const week = parseInt(s.value);
    const playerIdx = parseInt(s.dataset.playerIndex);
    if (week) {
      if (!byes[week - 1]) byes[week - 1] = [];
      byes[week - 1].push(playerIdx);
    }
  });
  return byes;
}

// ── Utility ──
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// ── Schedule Generation ──
function generateSchedule() {
  const players = getPlayerNames();
  const numWeeks = parseInt(numWeeksInput.value);
  const numPlayers = players.length;
  const assignedByes = getByeAssignments();

  if (numPlayers < 4) {
    alert('You need at least 4 players.');
    return;
  }

  const foursomeCount = {};
  const matchupCount = {};
  const byeCount = new Array(numPlayers).fill(0);

  function getFoursomeCount(a, b) { return foursomeCount[pairKey(a, b)] || 0; }
  function getMatchupCount(a, b) { return matchupCount[pairKey(a, b)] || 0; }

  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    // Start with admin-assigned byes
    let byePlayers = [];
    if (assignedByes[w] && assignedByes[w].length > 0) {
      byePlayers = [...assignedByes[w]];
    }

    let activePlayers = [];
    for (let i = 0; i < numPlayers; i++) {
      if (!byePlayers.includes(i)) activePlayers.push(i);
    }

    // Need active count divisible by 4 — give byes to players with FEWEST byes
    while (activePlayers.length % 4 !== 0 && activePlayers.length > 4) {
      const candidates = [...activePlayers].sort((a, b) => {
        if (byeCount[a] !== byeCount[b]) return byeCount[a] - byeCount[b];
        return Math.random() - 0.5;
      });
      const byePlayer = candidates[0];
      byePlayers.push(byePlayer);
      activePlayers = activePlayers.filter(p => p !== byePlayer);
    }

    byePlayers.forEach(p => { byeCount[p]++; });

    const numActive = activePlayers.length;
    const numFoursomes = Math.floor(numActive / 4);

    // Hierarchical scoring: 1v1 uniqueness is a hard priority,
    // then among solutions with no repeats, optimize foursome balance
    let bestArrangement = null;
    let bestMatchupPenalty = Infinity;
    let bestFoursomePenalty = Infinity;
    const attempts = 2000;

    for (let t = 0; t < attempts; t++) {
      const shuffled = shuffle(activePlayers);
      const foursomes = [];
      for (let g = 0; g < numFoursomes; g++) {
        foursomes.push(shuffled.slice(g * 4, g * 4 + 4));
      }

      let matchupPenalty = 0;
      let foursomePenalty = 0;

      for (const group of foursomes) {
        // Foursome balance: penalize deviation from even distribution
        // Use cubic penalty so high counts are punished much harder
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const count = getFoursomeCount(group[i], group[j]);
            foursomePenalty += count * count * count;
          }
        }

        // 1v1 matchup: find the best pairing within this foursome
        const pairings = [
          [[group[0], group[1]], [group[2], group[3]]],
          [[group[0], group[2]], [group[1], group[3]]],
          [[group[0], group[3]], [group[1], group[2]]],
        ];

        let bestPairingScore = Infinity;
        for (const pairing of pairings) {
          let pScore = 0;
          for (const [a, b] of pairing) {
            const mc = getMatchupCount(a, b);
            if (mc > 0) pScore += mc;
          }
          bestPairingScore = Math.min(bestPairingScore, pScore);
        }
        matchupPenalty += bestPairingScore;
      }

      // Hierarchical comparison: matchup repeats always trump foursome balance
      const isBetter = matchupPenalty < bestMatchupPenalty ||
        (matchupPenalty === bestMatchupPenalty && foursomePenalty < bestFoursomePenalty);

      if (isBetter) {
        bestMatchupPenalty = matchupPenalty;
        bestFoursomePenalty = foursomePenalty;
        bestArrangement = foursomes;
      }
      if (matchupPenalty === 0 && foursomePenalty === 0) break;
    }

    // Assign 1v1 matchups within each foursome
    const weekData = { foursomes: [], byePlayers };

    for (const group of bestArrangement) {
      const pairings = [
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

      // Update tracking
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

  // Store for analytics
  lastScheduleData = { weeks, players, foursomeCount, matchupCount, byeCount };

  renderSchedule(weeks, players, numPlayers, foursomeCount, matchupCount, byeCount);
  renderAnalytics();
}

// ── Render Schedule ──
function renderSchedule(weeks, players, numPlayers, foursomeCount, matchupCount, byeCount) {
  scheduleContent.innerHTML = '';
  resultsSection.classList.remove('hidden');
  renderSummary(players, numPlayers, foursomeCount, matchupCount, byeCount);

  weeks.forEach((weekData, weekIndex) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week-card card fade-in';
    weekDiv.style.animationDelay = `${weekIndex * 0.03}s`;

    const weekHeader = document.createElement('div');
    weekHeader.className = 'week-header';

    const weekTitle = document.createElement('div');
    weekTitle.className = 'week-title';
    weekTitle.innerHTML = `<span class="week-num">Week ${weekIndex + 1}</span>`;

    if (weekData.byePlayers.length > 0) {
      const byeNames = weekData.byePlayers.map(i => players[i]).join(', ');
      weekTitle.innerHTML += `<span class="bye-tag">Bye: ${byeNames}</span>`;
    }

    weekHeader.appendChild(weekTitle);
    weekDiv.appendChild(weekHeader);

    const foursomesContainer = document.createElement('div');
    foursomesContainer.className = 'foursomes';

    weekData.foursomes.forEach((foursome, fIdx) => {
      const fDiv = document.createElement('div');
      fDiv.className = 'foursome';

      const fTitle = document.createElement('div');
      fTitle.className = 'foursome-title';
      fTitle.textContent = `Foursome ${fIdx + 1}`;
      fDiv.appendChild(fTitle);

      foursome.matchups.forEach(([a, b], mIdx) => {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'matchup';

        matchDiv.innerHTML = `
          <span class="matchup-label">Match ${mIdx + 1}</span>
          <div class="matchup-players">
            <span class="player-name">${players[a]}</span>
            <span class="vs-badge">VS</span>
            <span class="player-name">${players[b]}</span>
          </div>
        `;

        fDiv.appendChild(matchDiv);
      });

      foursomesContainer.appendChild(fDiv);
    });

    weekDiv.appendChild(foursomesContainer);
    scheduleContent.appendChild(weekDiv);
  });

  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// ── Summary ──
function renderSummary(players, numPlayers, foursomeCount, matchupCount, byeCount) {
  const matchupCounts = [];
  const foursomeCounts = [];
  for (let i = 0; i < numPlayers; i++) {
    for (let j = i + 1; j < numPlayers; j++) {
      const key = pairKey(i, j);
      matchupCounts.push(matchupCount[key] || 0);
      foursomeCounts.push(foursomeCount[key] || 0);
    }
  }

  const totalPairs = matchupCounts.length;
  const pairsExactlyOnce = matchupCounts.filter(c => c === 1).length;
  const matchupMin = Math.min(...matchupCounts);
  const matchupMax = Math.max(...matchupCounts);
  const foursomeMin = Math.min(...foursomeCounts);
  const foursomeMax = Math.max(...foursomeCounts);
  const byeMin = Math.min(...byeCount);
  const byeMax = Math.max(...byeCount);

  scheduleSummary.innerHTML = `
    <div class="stat-chip">
      <strong>${pairsExactlyOnce}/${totalPairs}</strong> unique 1v1 matchups
    </div>
    <div class="stat-chip">
      <strong>${matchupMin}-${matchupMax}</strong> 1v1 range
    </div>
    <div class="stat-chip">
      <strong>${foursomeMin}-${foursomeMax}</strong> foursome range
    </div>
    <div class="stat-chip">
      <strong>${byeMin}-${byeMax}</strong> byes per player
    </div>
  `;
}

// ── Analytics ──
function renderAnalytics() {
  if (!lastScheduleData) return;
  const { weeks, players } = lastScheduleData;
  const numPlayers = players.length;

  // Populate player dropdown
  playerSelect.innerHTML = '';
  players.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    playerSelect.appendChild(opt);
  });

  // Pre-compute analytics
  const playerWeekly = Array.from({ length: numPlayers }, () => []);
  const foursomePairCount = {};
  const matchupPairCount = {};

  for (let w = 0; w < weeks.length; w++) {
    const weekData = weeks[w];

    for (const p of weekData.byePlayers) {
      playerWeekly[p].push({ week: w + 1, opponent: null, partners: [], bye: true });
    }

    for (const foursome of weekData.foursomes) {
      const opponentMap = {};
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
        const partners = foursome.players.filter(x => x !== p && x !== opponentMap[p]);
        playerWeekly[p].push({ week: w + 1, opponent: opponentMap[p], partners, bye: false });
      }
    }
  }

  const analyticsData = { playerWeekly, foursomePairCount, matchupPairCount };

  renderPlayerView(0, analyticsData);
  renderFullMatrix(analyticsData);

  playerSelect.onchange = () => {
    renderPlayerView(parseInt(playerSelect.value), analyticsData);
  };
}

function renderPlayerView(playerIdx, analytics) {
  const { players } = lastScheduleData;
  const { playerWeekly, foursomePairCount, matchupPairCount } = analytics;

  // Weekly table
  weeklyTableBody.innerHTML = '';
  const sorted = [...playerWeekly[playerIdx]].sort((a, b) => a.week - b.week);

  for (const entry of sorted) {
    const tr = document.createElement('tr');

    const weekTd = document.createElement('td');
    weekTd.textContent = `Week ${entry.week}`;

    const oppTd = document.createElement('td');
    if (entry.bye) {
      oppTd.innerHTML = '<span class="badge badge-bye">BYE</span>';
    } else {
      oppTd.textContent = players[entry.opponent];
    }

    const partnersTd = document.createElement('td');
    partnersTd.textContent = entry.bye ? '—' : entry.partners.map(p => players[p]).join(', ');

    tr.appendChild(weekTd);
    tr.appendChild(oppTd);
    tr.appendChild(partnersTd);
    weeklyTableBody.appendChild(tr);
  }

  // Matchup frequency bars
  renderFreqBars(matchupFrequency, playerIdx, players, matchupPairCount, 'matchup');

  // Foursome frequency bars
  renderFreqBars(foursomeFrequency, playerIdx, players, foursomePairCount, 'foursome');
}

function renderFreqBars(container, playerIdx, players, pairCount, type) {
  container.innerHTML = '';
  const entries = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerIdx) continue;
    entries.push({ player: i, count: pairCount[pairKey(playerIdx, i)] || 0 });
  }
  entries.sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map(e => e.count), 1);

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'freq-row';

    const pct = (entry.count / max) * 100;
    row.innerHTML = `
      <span class="freq-name">${players[entry.player]}</span>
      <div class="freq-track">
        <div class="freq-fill ${type}" style="width:${pct}%"></div>
      </div>
      <span class="freq-val">${entry.count}</span>
    `;
    container.appendChild(row);
  }
}

function renderFullMatrix(analytics) {
  const { players } = lastScheduleData;
  const { foursomePairCount } = analytics;
  const n = players.length;

  matrixTableHead.innerHTML = '';
  const headerRow = document.createElement('tr');
  headerRow.appendChild(document.createElement('th'));

  for (let i = 0; i < n; i++) {
    const th = document.createElement('th');
    th.className = 'matrix-col-header';
    th.textContent = players[i];
    headerRow.appendChild(th);
  }
  matrixTableHead.appendChild(headerRow);

  let maxCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const count = foursomePairCount[pairKey(i, j)] || 0;
      if (count > maxCount) maxCount = count;
    }
  }

  matrixTableBody.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.className = 'matrix-row-header';
    nameTd.textContent = players[i];
    tr.appendChild(nameTd);

    for (let j = 0; j < n; j++) {
      const td = document.createElement('td');
      td.className = 'matrix-cell';

      if (i === j) {
        td.textContent = '—';
        td.classList.add('matrix-diag');
      } else {
        const count = foursomePairCount[pairKey(i, j)] || 0;
        td.textContent = count;
        if (maxCount > 0) {
          const t = count / maxCount;
          // Green gradient
          const bg = `hsl(140, ${30 + t * 50}%, ${95 - t * 45}%)`;
          td.style.backgroundColor = bg;
          if (t > 0.75) td.style.color = '#fff';
        }
      }
      tr.appendChild(td);
    }
    matrixTableBody.appendChild(tr);
  }
}

// ── Update bye labels ──
function updateByeLabels() {
  byeAssignmentsContainer.querySelectorAll('.bye-label').forEach((label, i) => {
    label.textContent = getPlayerDisplayName(i);
  });
}

// ── Event Listeners ──
numPlayersInput.addEventListener('change', renderPlayerInputs);
numPlayersInput.addEventListener('input', renderPlayerInputs);
numWeeksInput.addEventListener('change', renderByeAssignments);
numWeeksInput.addEventListener('input', renderByeAssignments);
playerNamesContainer.addEventListener('input', updateByeLabels);
generateBtn.addEventListener('click', generateSchedule);
regenerateBtn.addEventListener('click', generateSchedule);
printBtn.addEventListener('click', () => window.print());

// ── Initialize ──
renderPlayerInputs();
