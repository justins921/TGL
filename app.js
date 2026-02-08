const numPlayersInput = document.getElementById('numPlayers');
const numWeeksInput = document.getElementById('numWeeks');
const groupSizeSelect = document.getElementById('groupSize');
const playerNamesContainer = document.getElementById('playerNames');
const generateBtn = document.getElementById('generateBtn');
const scheduleOutput = document.getElementById('scheduleOutput');
const scheduleContent = document.getElementById('scheduleContent');
const printBtn = document.getElementById('printBtn');

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
    playerNamesContainer.appendChild(input);
  }
}

function getPlayerNames() {
  const inputs = playerNamesContainer.querySelectorAll('input');
  return Array.from(inputs).map((input, i) =>
    input.value.trim() || `Player ${i + 1}`
  );
}

// Fisher-Yates shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSchedule() {
  const players = getPlayerNames();
  const numWeeks = parseInt(numWeeksInput.value);
  const groupSize = parseInt(groupSizeSelect.value);
  const numPlayers = players.length;

  if (numPlayers < groupSize) {
    alert(`You need at least ${groupSize} players to form a group.`);
    return;
  }

  // Track how many times each pair has played together
  const pairCount = {};
  function pairKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }
  function getPairCount(a, b) {
    return pairCount[pairKey(a, b)] || 0;
  }
  function incrementPairs(group) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i], group[j]);
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  }

  // Score a grouping: lower is better (minimize repeat pairings)
  function scoreGrouping(groups) {
    let score = 0;
    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          score += getPairCount(group[i], group[j]);
        }
      }
    }
    return score;
  }

  // Build groups from an ordered list of player indices
  function buildGroups(ordered) {
    const groups = [];
    let idx = 0;
    const fullGroups = Math.floor(numPlayers / groupSize);
    const remainder = numPlayers % groupSize;

    for (let g = 0; g < fullGroups; g++) {
      groups.push(ordered.slice(idx, idx + groupSize));
      idx += groupSize;
    }

    // Distribute remaining players into existing groups
    if (remainder > 0 && groups.length > 0) {
      const leftover = ordered.slice(idx);
      for (let r = 0; r < leftover.length; r++) {
        groups[r % groups.length].push(leftover[r]);
      }
    } else if (remainder > 0) {
      groups.push(ordered.slice(idx));
    }

    return groups;
  }

  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    // Try multiple random shuffles and pick the best one
    let bestGroups = null;
    let bestScore = Infinity;
    const attempts = 100;

    for (let t = 0; t < attempts; t++) {
      const shuffled = shuffle([...Array(numPlayers).keys()]);
      const groups = buildGroups(shuffled);
      const score = scoreGrouping(groups);
      if (score < bestScore) {
        bestScore = score;
        bestGroups = groups;
      }
      if (score === 0) break;
    }

    // Record the pairings for this week
    for (const group of bestGroups) {
      incrementPairs(group);
    }

    weeks.push(bestGroups);
  }

  renderSchedule(weeks, players);
}

function renderSchedule(weeks, players) {
  scheduleContent.innerHTML = '';
  scheduleOutput.classList.remove('hidden');

  weeks.forEach((groups, weekIndex) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week';

    const weekTitle = document.createElement('h3');
    weekTitle.textContent = `Week ${weekIndex + 1}`;
    weekDiv.appendChild(weekTitle);

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'groups';

    groups.forEach((group, groupIndex) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'group';

      const groupTitle = document.createElement('h4');
      groupTitle.textContent = `Group ${groupIndex + 1}`;
      groupDiv.appendChild(groupTitle);

      const list = document.createElement('ul');
      group.forEach(playerIndex => {
        const li = document.createElement('li');
        li.textContent = players[playerIndex];
        list.appendChild(li);
      });
      groupDiv.appendChild(list);
      groupsContainer.appendChild(groupDiv);
    });

    weekDiv.appendChild(groupsContainer);
    scheduleContent.appendChild(weekDiv);
  });

  scheduleOutput.scrollIntoView({ behavior: 'smooth' });
}

// Event listeners
numPlayersInput.addEventListener('change', renderPlayerInputs);
numPlayersInput.addEventListener('input', renderPlayerInputs);
generateBtn.addEventListener('click', generateSchedule);
printBtn.addEventListener('click', () => window.print());

// Initialize
renderPlayerInputs();
