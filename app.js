// ── DOM Elements ──
const numPlayersInput = document.getElementById('numPlayers');
const numWeeksInput = document.getElementById('numWeeks');
const playerNamesContainer = document.getElementById('playerNames');
const byeAssignmentsContainer = document.getElementById('byeAssignments');
const generateBtn = document.getElementById('generateBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const scheduleOutput = document.getElementById('scheduleOutput');
const scheduleContent = document.getElementById('scheduleContent');
const scheduleSummary = document.getElementById('scheduleSummary');
const printBtn = document.getElementById('printBtn');

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

    if (existingValues[i]) {
      select.value = existingValues[i];
    }

    row.appendChild(select);
    byeAssignmentsContainer.appendChild(row);
  }
}

function getPlayerDisplayName(index) {
  const inputs = playerNamesContainer.querySelectorAll('input');
  if (inputs[index] && inputs[index].value.trim()) {
    return inputs[index].value.trim();
  }
  return `Player ${index + 1}`;
}

function getPlayerNames() {
  const inputs = playerNamesContainer.querySelectorAll('input');
  return Array.from(inputs).map((input, i) =>
    input.value.trim() || `Player ${i + 1}`
  );
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

  // Track how many times each pair has been in the same foursome
  const foursomeCount = {};
  // Track how many times each pair has played 1v1
  const matchupCount = {};
  // Track bye counts per player
  const byeCount = new Array(numPlayers).fill(0);

  function getFoursomeCount(a, b) {
    return foursomeCount[pairKey(a, b)] || 0;
  }
  function getMatchupCount(a, b) {
    return matchupCount[pairKey(a, b)] || 0;
  }

  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    // Determine who has a bye this week
    let byePlayers = [];

    if (assignedByes[w] && assignedByes[w].length > 0) {
      byePlayers = [...assignedByes[w]];
    }

    // Figure out how many active players we have and how many byes we need
    let activePlayers = [];
    for (let i = 0; i < numPlayers; i++) {
      if (!byePlayers.includes(i)) {
        activePlayers.push(i);
      }
    }

    // We need active player count to be divisible by 4
    // Add more byes if needed (pick players with fewest byes who aren't already on bye)
    while (activePlayers.length % 4 !== 0 && activePlayers.length > 4) {
      // Sort active players by bye count (ascending), pick the one with fewest byes
      // to keep it balanced — but actually pick the one who has had the most play
      // to be fair, give byes to those with fewest byes
      const candidates = [...activePlayers].sort((a, b) => {
        if (byeCount[a] !== byeCount[b]) return byeCount[b] - byeCount[a];
        return Math.random() - 0.5;
      });
      const byePlayer = candidates[0];
      byePlayers.push(byePlayer);
      activePlayers = activePlayers.filter(p => p !== byePlayer);
    }

    // If somehow we have fewer than 4 active players, handle with ghost
    const numActive = activePlayers.length;
    const numFoursomes = Math.floor(numActive / 4);
    const ghostsNeeded = (numFoursomes * 4) - numActive;

    // Update bye counts
    byePlayers.forEach(p => { byeCount[p]++; });

    // Try many random arrangements and pick the best one
    let bestArrangement = null;
    let bestScore = Infinity;
    const attempts = 500;

    for (let t = 0; t < attempts; t++) {
      const shuffled = shuffle(activePlayers);
      const foursomes = [];

      for (let g = 0; g < numFoursomes; g++) {
        const group = shuffled.slice(g * 4, g * 4 + 4);
        foursomes.push(group);
      }

      // Score this arrangement
      let score = 0;

      for (const group of foursomes) {
        // Penalize repeat foursome pairings — want even distribution
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const count = getFoursomeCount(group[i], group[j]);
            score += count * count; // Quadratic penalty to strongly discourage imbalance
          }
        }

        // Find the best 1v1 pairing within this foursome
        // There are 3 ways to split 4 players into 2 matchups:
        // [0v1, 2v3], [0v2, 1v3], [0v3, 1v2]
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
            pScore += mc * mc;
          }
          bestPairingScore = Math.min(bestPairingScore, pScore);
        }
        score += bestPairingScore * 10; // Weight matchup uniqueness heavily
      }

      if (score < bestScore) {
        bestScore = score;
        bestArrangement = foursomes;
      }
      if (score === 0) break;
    }

    // Now assign 1v1 matchups within each foursome
    const weekData = {
      foursomes: [],
      byePlayers: byePlayers,
      ghostsUsed: ghostsNeeded > 0,
    };

    for (const group of bestArrangement) {
      const pairings = [
        [[group[0], group[1]], [group[2], group[3]]],
        [[group[0], group[2]], [group[1], group[3]]],
        [[group[0], group[3]], [group[1], group[2]]],
      ];

      // Pick the pairing that minimizes repeat 1v1s
      let bestPairing = pairings[0];
      let bestPScore = Infinity;
      for (const pairing of pairings) {
        let pScore = 0;
        for (const [a, b] of pairing) {
          pScore += getMatchupCount(a, b) * getMatchupCount(a, b);
        }
        if (pScore < bestPScore) {
          bestPScore = pScore;
          bestPairing = pairing;
        }
      }

      // Record this foursome
      weekData.foursomes.push({
        players: group,
        matchups: bestPairing,
      });

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

  renderSchedule(weeks, players, numPlayers, foursomeCount, matchupCount, byeCount);
}

// ── Render Schedule ──
function renderSchedule(weeks, players, numPlayers, foursomeCount, matchupCount, byeCount) {
  scheduleContent.innerHTML = '';
  scheduleSummary.innerHTML = '';
  scheduleOutput.classList.remove('hidden');

  // Summary stats
  renderSummary(players, numPlayers, foursomeCount, matchupCount, byeCount);

  weeks.forEach((weekData, weekIndex) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week';

    const weekHeader = document.createElement('div');
    weekHeader.className = 'week-header';

    const weekTitle = document.createElement('h3');
    weekTitle.textContent = `Week ${weekIndex + 1}`;
    weekHeader.appendChild(weekTitle);

    if (weekData.byePlayers.length > 0) {
      const byeTag = document.createElement('span');
      byeTag.className = 'bye-tag';
      const byeNames = weekData.byePlayers.map(i => players[i]).join(', ');
      byeTag.textContent = `Bye: ${byeNames}`;
      weekHeader.appendChild(byeTag);
    }

    weekDiv.appendChild(weekHeader);

    const foursomesContainer = document.createElement('div');
    foursomesContainer.className = 'foursomes';

    weekData.foursomes.forEach((foursome, fIdx) => {
      const fDiv = document.createElement('div');
      fDiv.className = 'foursome';

      const fTitle = document.createElement('h4');
      fTitle.textContent = `Foursome ${fIdx + 1}`;
      fDiv.appendChild(fTitle);

      // Render the two 1v1 matchups
      foursome.matchups.forEach(([a, b], mIdx) => {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'matchup';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'matchup-label';
        labelSpan.textContent = `Match ${mIdx + 1}`;
        matchDiv.appendChild(labelSpan);

        const vsSpan = document.createElement('span');
        vsSpan.className = 'matchup-vs';
        vsSpan.innerHTML = `<strong>${players[a]}</strong> <span class="vs">vs</span> <strong>${players[b]}</strong>`;
        matchDiv.appendChild(vsSpan);

        fDiv.appendChild(matchDiv);
      });

      foursomesContainer.appendChild(fDiv);
    });

    weekDiv.appendChild(foursomesContainer);
    scheduleContent.appendChild(weekDiv);
  });

  scheduleOutput.scrollIntoView({ behavior: 'smooth' });
}

// ── Summary stats ──
function renderSummary(players, numPlayers, foursomeCount, matchupCount, byeCount) {
  // Matchup distribution: how many times each pair plays 1v1
  const matchupCounts = [];
  const foursomeCounts = [];
  for (let i = 0; i < numPlayers; i++) {
    for (let j = i + 1; j < numPlayers; j++) {
      const key = pairKey(i, j);
      matchupCounts.push(matchupCount[key] || 0);
      foursomeCounts.push(foursomeCount[key] || 0);
    }
  }

  const matchupMax = Math.max(...matchupCounts);
  const matchupMin = Math.min(...matchupCounts);
  const foursomeMax = Math.max(...foursomeCounts);
  const foursomeMin = Math.min(...foursomeCounts);
  const byeMax = Math.max(...byeCount);
  const byeMin = Math.min(...byeCount);

  const totalPairs = matchupCounts.length;
  const pairsWithExactlyOne = matchupCounts.filter(c => c === 1).length;

  let html = '<div class="summary-grid">';
  html += `<div class="summary-stat">
    <span class="stat-value">${pairsWithExactlyOne}/${totalPairs}</span>
    <span class="stat-label">pairs play 1v1 exactly once</span>
  </div>`;
  html += `<div class="summary-stat">
    <span class="stat-value">${matchupMin}–${matchupMax}</span>
    <span class="stat-label">1v1 matchup range per pair</span>
  </div>`;
  html += `<div class="summary-stat">
    <span class="stat-value">${foursomeMin}–${foursomeMax}</span>
    <span class="stat-label">foursome sharing range per pair</span>
  </div>`;
  html += `<div class="summary-stat">
    <span class="stat-value">${byeMin}–${byeMax}</span>
    <span class="stat-label">bye week range per player</span>
  </div>`;
  html += '</div>';

  scheduleSummary.innerHTML = html;
}

// ── Update bye labels when player names change ──
function updateByeLabels() {
  const labels = byeAssignmentsContainer.querySelectorAll('.bye-label');
  labels.forEach((label, i) => {
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
