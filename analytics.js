const noData = document.getElementById('noData');
const analyticsContent = document.getElementById('analyticsContent');
const playerSelect = document.getElementById('playerSelect');
const weeklyTableBody = document.querySelector('#weeklyTable tbody');
const foursomeFrequency = document.getElementById('foursomeFrequency');
const matchupFrequency = document.getElementById('matchupFrequency');
const matrixTableHead = document.querySelector('#matrixTable thead');
const matrixTableBody = document.querySelector('#matrixTable tbody');

let scheduleData = null;

function loadSchedule() {
  const raw = localStorage.getItem('tgl_schedule');
  if (!raw) return null;
  return JSON.parse(raw);
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// Pre-compute all analytics data
function computeAnalytics(data) {
  const { weeks, players } = data;
  const numPlayers = players.length;

  // Per-player per-week: who is their 1v1 opponent, who are their foursome mates
  // playerWeekly[playerIdx] = [{ week, opponent, partners, bye }]
  const playerWeekly = Array.from({ length: numPlayers }, () => []);

  // Foursome pair count
  const foursomePairCount = {};
  // Matchup pair count
  const matchupPairCount = {};

  for (let w = 0; w < weeks.length; w++) {
    const weekData = weeks[w];
    const byeSet = new Set(weekData.byePlayers);

    // Mark bye players
    for (const p of weekData.byePlayers) {
      playerWeekly[p].push({ week: w + 1, opponent: null, partners: [], bye: true });
    }

    for (const foursome of weekData.foursomes) {
      const groupSet = new Set(foursome.players);

      // Build a map: player -> opponent in this foursome
      const opponentMap = {};
      for (const [a, b] of foursome.matchups) {
        opponentMap[a] = b;
        opponentMap[b] = a;

        // Track matchup frequency
        const key = pairKey(a, b);
        matchupPairCount[key] = (matchupPairCount[key] || 0) + 1;
      }

      // Track foursome frequency
      for (let i = 0; i < foursome.players.length; i++) {
        for (let j = i + 1; j < foursome.players.length; j++) {
          const key = pairKey(foursome.players[i], foursome.players[j]);
          foursomePairCount[key] = (foursomePairCount[key] || 0) + 1;
        }
      }

      // Record per-player weekly data
      for (const p of foursome.players) {
        const partners = foursome.players.filter(x => x !== p && x !== opponentMap[p]);
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

function init() {
  scheduleData = loadSchedule();
  if (!scheduleData) {
    noData.classList.remove('hidden');
    analyticsContent.classList.add('hidden');
    return;
  }

  noData.classList.add('hidden');
  analyticsContent.classList.remove('hidden');

  const { players } = scheduleData;

  // Populate player dropdown
  playerSelect.innerHTML = '';
  players.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    playerSelect.appendChild(opt);
  });

  const analytics = computeAnalytics(scheduleData);

  playerSelect.addEventListener('change', () => {
    renderPlayerView(parseInt(playerSelect.value), scheduleData, analytics);
  });

  // Render full matrix (doesn't change with player selection)
  renderFullMatrix(scheduleData, analytics);

  // Render first player
  renderPlayerView(0, scheduleData, analytics);
}

function renderPlayerView(playerIdx, data, analytics) {
  const { players } = data;
  const { playerWeekly, foursomePairCount, matchupPairCount } = analytics;

  // Weekly breakdown table
  weeklyTableBody.innerHTML = '';
  const weeklyData = playerWeekly[playerIdx];

  // Sort by week number
  const sorted = [...weeklyData].sort((a, b) => a.week - b.week);

  for (const entry of sorted) {
    const tr = document.createElement('tr');

    const weekTd = document.createElement('td');
    weekTd.textContent = `Week ${entry.week}`;
    tr.appendChild(weekTd);

    const oppTd = document.createElement('td');
    if (entry.bye) {
      oppTd.innerHTML = '<span class="bye-indicator">BYE</span>';
    } else {
      oppTd.textContent = players[entry.opponent];
    }
    tr.appendChild(oppTd);

    const partnersTd = document.createElement('td');
    if (entry.bye) {
      partnersTd.textContent = '—';
    } else {
      partnersTd.textContent = entry.partners.map(p => players[p]).join(', ');
    }
    tr.appendChild(partnersTd);

    weeklyTableBody.appendChild(tr);
  }

  // Foursome frequency
  foursomeFrequency.innerHTML = '';
  const foursomeEntries = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerIdx) continue;
    const key = pairKey(playerIdx, i);
    foursomeEntries.push({ player: i, count: foursomePairCount[key] || 0 });
  }
  foursomeEntries.sort((a, b) => b.count - a.count);

  const maxFoursome = Math.max(...foursomeEntries.map(e => e.count), 1);
  for (const entry of foursomeEntries) {
    const div = document.createElement('div');
    div.className = 'freq-bar';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'freq-name';
    nameSpan.textContent = players[entry.player];

    const barOuter = document.createElement('div');
    barOuter.className = 'freq-bar-outer';

    const barInner = document.createElement('div');
    barInner.className = 'freq-bar-inner';
    barInner.style.width = `${(entry.count / maxFoursome) * 100}%`;

    const countSpan = document.createElement('span');
    countSpan.className = 'freq-count';
    countSpan.textContent = entry.count;

    barOuter.appendChild(barInner);
    div.appendChild(nameSpan);
    div.appendChild(barOuter);
    div.appendChild(countSpan);
    foursomeFrequency.appendChild(div);
  }

  // Matchup frequency
  matchupFrequency.innerHTML = '';
  const matchupEntries = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerIdx) continue;
    const key = pairKey(playerIdx, i);
    matchupEntries.push({ player: i, count: matchupPairCount[key] || 0 });
  }
  matchupEntries.sort((a, b) => b.count - a.count);

  const maxMatchup = Math.max(...matchupEntries.map(e => e.count), 1);
  for (const entry of matchupEntries) {
    const div = document.createElement('div');
    div.className = 'freq-bar';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'freq-name';
    nameSpan.textContent = players[entry.player];

    const barOuter = document.createElement('div');
    barOuter.className = 'freq-bar-outer';

    const barInner = document.createElement('div');
    barInner.className = 'freq-bar-inner matchup-bar';
    barInner.style.width = `${(entry.count / maxMatchup) * 100}%`;

    const countSpan = document.createElement('span');
    countSpan.className = 'freq-count';
    countSpan.textContent = entry.count;

    barOuter.appendChild(barInner);
    div.appendChild(nameSpan);
    div.appendChild(barOuter);
    div.appendChild(countSpan);
    matchupFrequency.appendChild(div);
  }
}

function renderFullMatrix(data, analytics) {
  const { players } = data;
  const { foursomePairCount } = analytics;
  const n = players.length;

  // Header row
  matrixTableHead.innerHTML = '';
  const headerRow = document.createElement('tr');
  const cornerTh = document.createElement('th');
  cornerTh.textContent = '';
  headerRow.appendChild(cornerTh);

  for (let i = 0; i < n; i++) {
    const th = document.createElement('th');
    th.className = 'matrix-header';
    th.textContent = players[i];
    headerRow.appendChild(th);
  }
  matrixTableHead.appendChild(headerRow);

  // Find max for color scaling
  let maxCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = pairKey(i, j);
      const count = foursomePairCount[key] || 0;
      if (count > maxCount) maxCount = count;
    }
  }

  // Body rows
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
        td.className += ' matrix-diagonal';
      } else {
        const key = pairKey(i, j);
        const count = foursomePairCount[key] || 0;
        td.textContent = count;

        // Color intensity based on count
        if (maxCount > 0) {
          const intensity = count / maxCount;
          const r = Math.round(240 - intensity * 195);
          const g = Math.round(247 - intensity * 150);
          const b = Math.round(238 - intensity * 200);
          td.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
          if (intensity > 0.7) {
            td.style.color = '#fff';
          }
        }
      }

      tr.appendChild(td);
    }

    matrixTableBody.appendChild(tr);
  }
}

init();
