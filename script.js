'use strict';

const BASE = 'https://api.jolpi.ca/ergast/f1/';

const TEAM_COLORS = {
  red_bull:     '#3671C6',
  ferrari:      '#E8002D',
  mercedes:     '#27F4D2',
  mclaren:      '#FF8000',
  aston_martin: '#229971',
  alpine:       '#FF87BC',
  williams:     '#64C4FF',
  rb:           '#6692FF',
  haas:         '#B6BABD',
  sauber:       '#52E252',
  kick_sauber:  '#52E252',
  audi:         '#C0392B',
  renault:      '#FFF500',
  alphatauri:   '#5E8FAA',
  toro_rosso:   '#469BFF',
};

const FLAGS = {
  'Australia': '🇦🇺', 'China': '🇨🇳', 'Japan': '🇯🇵',
  'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦', 'USA': '🇺🇸',
  'United States': '🇺🇸', 'Italy': '🇮🇹', 'Monaco': '🇲🇨',
  'Canada': '🇨🇦', 'Spain': '🇪🇸', 'Austria': '🇦🇹',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'Hungary': '🇭🇺',
  'Belgium': '🇧🇪', 'Netherlands': '🇳🇱', 'Azerbaijan': '🇦🇿',
  'Singapore': '🇸🇬', 'Mexico': '🇲🇽', 'Brazil': '🇧🇷',
  'UAE': '🇦🇪', 'Qatar': '🇶🇦', 'Abu Dhabi': '🇦🇪',
};

function getFlag(c) { return FLAGS[c] || '🏁'; }
function getColor(id) { return TEAM_COLORS[id] || '#888888'; }

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSessionTime(date, time) {
  if (!date || !time) return '—';
  return new Date(`${date}T${time}`).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  // Phase 1: check what year has data and load 2026 schedule
  const [rawSchedule, raw2026Standings] = await Promise.allSettled([
    fetchJSON(`${BASE}current.json?limit=30`),
    fetchJSON(`${BASE}current/driverStandings.json`),
  ]);

  const races2026 = rawSchedule.status === 'fulfilled'
    ? rawSchedule.value.MRData?.RaceTable?.Races || [] : [];

  const has2026Data = raw2026Standings.status === 'fulfilled' &&
    (raw2026Standings.value.MRData?.StandingsTable?.StandingsLists || []).length > 0;

  const dataYear  = has2026Data ? 'current' : '2025';
  const yearLabel = has2026Data ? '2026' : '2025';

  // Phase 2: get the right schedule for form/standings year
  let dataRaces = races2026;
  if (!has2026Data) {
    const raw2025 = await fetchJSON(`${BASE}2025.json?limit=30`).catch(() => null);
    dataRaces = raw2025?.MRData?.RaceTable?.Races || [];
  }

  // Render schedule + next race immediately with 2026 data (or 2025 fallback)
  const calendarRaces = races2026.length > 0 ? races2026 : dataRaces;
  displayNextRace(calendarRaces);
  displaySchedule(calendarRaces);

  // Find last 5 completed rounds in the data year for form
  const now = new Date();
  const completedRounds = dataRaces
    .filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now)
    .map(r => r.round);
  const last5 = completedRounds.slice(-5);

  // Phase 3: parallel fetch of all results data
  const results = await Promise.allSettled([
    fetchJSON(`${BASE}${dataYear}/driverStandings.json`),
    fetchJSON(`${BASE}${dataYear}/constructorStandings.json`),
    fetchJSON(`${BASE}${dataYear}/last/results.json`),
    fetchJSON(`${BASE}${dataYear}/last/qualifying.json`),
    fetchJSON(`${BASE}${dataYear}/last/pitstops.json?limit=100`),
    fetchJSON(`${BASE}${dataYear}/last/sprint.json`),
    ...last5.map(r => fetchJSON(`${BASE}${dataYear}/${r}/results.json`)),
  ]);

  const [driverRes, ctorRes, lastRaceRes, qualRes, pitRes, sprintRes, ...formRoundRes] = results;

  const drivers      = driverRes.status === 'fulfilled' ? driverRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [] : [];
  const constructors = ctorRes.status === 'fulfilled'   ? ctorRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [] : [];
  const lastRace     = lastRaceRes.status === 'fulfilled' ? lastRaceRes.value.MRData?.RaceTable?.Races?.[0] || null : null;
  const qualifying   = qualRes.status === 'fulfilled'   ? qualRes.value.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [] : [];
  const pitStops     = pitRes.status === 'fulfilled'    ? pitRes.value.MRData?.RaceTable?.Races?.[0]?.PitStops || [] : [];
  const sprintRace   = sprintRes.status === 'fulfilled' ? sprintRes.value.MRData?.RaceTable?.Races?.[0] || null : null;

  const formRaces = formRoundRes
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.MRData?.RaceTable?.Races?.[0])
    .filter(Boolean);
  const formMap = buildFormMap(formRaces);

  displayStatsBar(drivers, dataRaces, yearLabel, has2026Data);

  if (lastRace) {
    displayLastRace(lastRace, qualifying, pitStops, sprintRace);
  } else {
    document.getElementById('last-race').innerHTML = '<p class="no-data">No race results available yet</p>';
  }

  displayDriverStandings(drivers, formMap, yearLabel);
  displayConstructorStandings(constructors);
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function displayStatsBar(drivers, races, yearLabel, isLive) {
  const container = document.getElementById('stats-bar');
  if (!container) return;

  const now = new Date();
  const completed = races.filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now).length;
  const total = races.length;
  const leader = drivers[0];
  const second = drivers[1];

  const fillerNote = !isLive ? `<div class="stats-filler-note">Showing ${yearLabel} season data · 2026 season begins soon</div>` : '';

  container.innerHTML = `
    ${fillerNote}
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">Season</span>
        <span class="stat-value">${yearLabel}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">Rounds</span>
        <span class="stat-value">${completed}/${total || '—'}</span>
      </div>
      ${leader ? `
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">Championship Leader</span>
        <span class="stat-value">${leader.Driver.familyName} <span class="stat-pts">${leader.points} pts</span></span>
      </div>
      ${second ? `
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">Lead</span>
        <span class="stat-value">+${parseFloat(leader.points) - parseFloat(second.points)} pts</span>
      </div>` : ''}
      ` : ''}
    </div>
  `;
}

// ─── NEXT RACE HERO ───────────────────────────────────────────────────────────

function displayNextRace(races) {
  const container = document.getElementById('next-race');
  const now = new Date();
  const nextRace = races.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);

  if (!nextRace) {
    container.innerHTML = races.length === 0
      ? '<p class="no-data">Season schedule not yet available</p>'
      : '<p class="no-data">The season is complete</p>';
    return;
  }

  const raceDate = new Date(`${nextRace.date}T${nextRace.time || '12:00:00Z'}`);
  const flag = getFlag(nextRace.Circuit.Location.country);
  const isSprint = !!nextRace.Sprint;

  // Build session schedule
  const sessions = [];
  if (nextRace.FirstPractice)  sessions.push({ name: isSprint ? 'FP1' : 'FP1',    ...nextRace.FirstPractice });
  if (nextRace.SecondPractice) sessions.push({ name: isSprint ? 'Sprint Quali' : 'FP2', ...nextRace.SecondPractice });
  if (nextRace.ThirdPractice)  sessions.push({ name: 'FP3',    ...nextRace.ThirdPractice });
  if (nextRace.Sprint)         sessions.push({ name: 'Sprint',  ...nextRace.Sprint });
  if (nextRace.Qualifying)     sessions.push({ name: 'Qualifying', ...nextRace.Qualifying });
  sessions.push({ name: 'Race', date: nextRace.date, time: nextRace.time || '12:00:00Z', isRace: true });

  const sessionHTML = sessions.map(s => `
    <div class="session-row ${s.isRace ? 'session-race' : ''}">
      <span class="session-name">${s.name}</span>
      <span class="session-datetime">${formatSessionTime(s.date, s.time)}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="next-race-card">
      <img src="f1-abu-dhabi-gp-2017-f1-logo-6614911.jpg" alt="" class="next-race-logo-watermark" aria-hidden="true">
      <div class="next-race-label">NEXT RACE &middot; ROUND ${nextRace.round}</div>
      <div class="next-race-name">${flag} ${nextRace.raceName}</div>
      <div class="next-race-circuit">${nextRace.Circuit.circuitName} &bull; ${nextRace.Circuit.Location.locality}, ${nextRace.Circuit.Location.country}</div>
      <div class="next-race-date">${formatDate(raceDate)}</div>
      <div class="next-race-body">
        <div class="countdown" id="countdown"></div>
        ${sessions.length > 1 ? `<div class="session-list">${sessionHTML}</div>` : ''}
      </div>
    </div>
  `;

  function tick() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const diff = raceDate - new Date();
    if (diff <= 0) { el.textContent = 'Race underway!'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `
      <div class="cd-block"><span class="cd-num">${d}</span><span class="cd-label">days</span></div>
      <div class="cd-sep">:</div>
      <div class="cd-block"><span class="cd-num">${String(h).padStart(2,'0')}</span><span class="cd-label">hrs</span></div>
      <div class="cd-sep">:</div>
      <div class="cd-block"><span class="cd-num">${String(m).padStart(2,'0')}</span><span class="cd-label">min</span></div>
      <div class="cd-sep">:</div>
      <div class="cd-block"><span class="cd-num">${String(s).padStart(2,'0')}</span><span class="cd-label">sec</span></div>
    `;
  }
  tick();
  setInterval(tick, 1000);
}

// ─── LAST RACE ────────────────────────────────────────────────────────────────

function displayLastRace(race, qualifying, pitStops, sprintRace) {
  const container = document.getElementById('last-race');
  const results = race.Results || [];
  if (!results.length) {
    container.innerHTML = '<p class="no-data">No results available</p>';
    return;
  }

  const flag = getFlag(race.Circuit.Location.country);

  // Find fastest lap holder
  const flResult = results.find(r => r.FastestLap?.rank === '1');
  const flDriverId = flResult?.Driver?.driverId;

  const tabs = [
    { label: 'Race',       content: buildRaceTab(results, flDriverId) },
    { label: 'Qualifying', content: buildQualifyingTab(qualifying) },
    { label: 'Pit Stops',  content: buildPitStopsTab(pitStops, results) },
  ];
  if (sprintRace?.Results?.length) {
    tabs.push({ label: 'Sprint', content: buildSprintTab(sprintRace) });
  }

  container.innerHTML = `
    <div class="last-race-card">
      <div class="race-header">
        <div class="race-title">${flag} ${race.raceName}</div>
        <div class="race-subtitle">${formatDate(new Date(race.date + 'T12:00:00Z'))} &bull; ${race.Circuit.circuitName}</div>
      </div>
      <div id="last-race-tabs"></div>
    </div>
  `;

  buildTabs(document.getElementById('last-race-tabs'), tabs);
}

function buildRaceTab(results, flDriverId) {
  const top3 = results.slice(0, 3);
  const rest  = results.slice(3, 10);

  const podiumHTML = `
    <div class="podium">
      ${podiumPlace(top3[1], 2, flDriverId)}
      ${podiumPlace(top3[0], 1, flDriverId)}
      ${podiumPlace(top3[2], 3, flDriverId)}
    </div>
  `;

  const listHTML = `
    <div class="results-list">
      ${rest.map(r => {
        const color = getColor(r.Constructor.constructorId);
        const isFl  = r.Driver.driverId === flDriverId;
        return `
          <div class="result-row">
            <span class="result-pos">${r.position}</span>
            <span class="result-name">${r.Driver.givenName[0]}. ${r.Driver.familyName}</span>
            <span class="result-team" style="color:${color}">${r.Constructor.name}</span>
            <span class="result-time ${isFl ? 'fl-time' : ''}">${r.Time ? r.Time.time : r.status}${isFl ? ' ⬡' : ''}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return podiumHTML + listHTML;
}

function podiumPlace(result, pos, flDriverId) {
  if (!result) return `<div class="podium-place p${pos}"><div class="podium-info"></div><div class="podium-block"><span class="podium-pos">${pos}</span></div></div>`;
  const color = getColor(result.Constructor.constructorId);
  const isFl  = result.Driver.driverId === flDriverId;
  const timeStr = pos === 1 ? 'Winner' : (result.Time ? '+' + result.Time.time : result.status);
  return `
    <div class="podium-place p${pos}" style="--team-color:${color}">
      <div class="podium-info">
        <div class="podium-driver">${result.Driver.givenName[0]}. ${result.Driver.familyName}${isFl ? '<span class="fl-badge">FL</span>' : ''}</div>
        <div class="podium-team" style="color:${color}">${result.Constructor.name}</div>
        <div class="podium-time">${timeStr}</div>
      </div>
      <div class="podium-block"><span class="podium-pos">${pos}</span></div>
    </div>
  `;
}

function buildQualifyingTab(qualifying) {
  if (!qualifying.length) return '<p class="no-data tab-no-data">No qualifying data available</p>';

  const poleTime = qualifying[0]?.Q3 || qualifying[0]?.Q2 || qualifying[0]?.Q1 || '';

  return `
    <div class="quali-table">
      ${qualifying.map((q, i) => {
        const color = getColor(q.Constructor.constructorId);
        const bestTime = q.Q3 || q.Q2 || q.Q1 || '—';
        const isPole = i === 0;
        return `
          <div class="result-row">
            <span class="result-pos">${q.position}</span>
            <span class="result-name">${q.Driver.givenName[0]}. ${q.Driver.familyName}</span>
            <span class="result-team" style="color:${color}">${q.Constructor.name}</span>
            <span class="quali-times">
              ${q.Q1 ? `<span class="qt q1">${q.Q1}</span>` : ''}
              ${q.Q2 ? `<span class="qt q2">${q.Q2}</span>` : ''}
              ${q.Q3 ? `<span class="qt q3 ${isPole ? 'pole' : ''}">${q.Q3}</span>` : ''}
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildPitStopsTab(pitStops, results) {
  if (!pitStops.length) return '<p class="no-data tab-no-data">No pit stop data available</p>';

  // Build driver name map
  const nameMap = {};
  results.forEach(r => { nameMap[r.Driver.driverId] = `${r.Driver.givenName[0]}. ${r.Driver.familyName}`; });
  const colorMap = {};
  results.forEach(r => { colorMap[r.Driver.driverId] = getColor(r.Constructor.constructorId); });

  // Sort by duration, take top 10
  const sorted = [...pitStops]
    .filter(p => parseFloat(p.duration) > 0)
    .sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration))
    .slice(0, 10);

  return `
    <div class="pitstop-table">
      <div class="pitstop-header">
        <span>Driver</span>
        <span>Lap</span>
        <span>Stop</span>
        <span>Duration</span>
      </div>
      ${sorted.map((p, i) => {
        const color = colorMap[p.driverId] || '#888';
        const name  = nameMap[p.driverId] || p.driverId;
        return `
          <div class="pitstop-row ${i === 0 ? 'fastest-stop' : ''}">
            <span class="result-name" style="color: ${i === 0 ? color : '#fff'}">${name}</span>
            <span class="pitstop-lap">Lap ${p.lap}</span>
            <span class="pitstop-stop">Stop ${p.stop}</span>
            <span class="pitstop-duration ${i === 0 ? 'best' : ''}">${p.duration}s</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function buildSprintTab(sprintRace) {
  const results = sprintRace.Results || [];
  return `
    <div class="results-list">
      ${results.slice(0, 8).map(r => {
        const color = getColor(r.Constructor.constructorId);
        return `
          <div class="result-row">
            <span class="result-pos">${r.position}</span>
            <span class="result-name">${r.Driver.givenName[0]}. ${r.Driver.familyName}</span>
            <span class="result-team" style="color:${color}">${r.Constructor.name}</span>
            <span class="result-time">${r.Time ? r.Time.time : r.status}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── TAB SYSTEM ───────────────────────────────────────────────────────────────

function buildTabs(container, tabs) {
  const barEl = document.createElement('div');
  barEl.className = 'tab-bar';

  const contentEl = document.createElement('div');
  contentEl.className = 'tab-content-area';

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (i === 0 ? ' active' : '');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      barEl.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      contentEl.innerHTML = tab.content;
    });
    barEl.appendChild(btn);
  });

  contentEl.innerHTML = tabs[0].content;
  container.appendChild(barEl);
  container.appendChild(contentEl);
}

// ─── FORM GUIDE ───────────────────────────────────────────────────────────────

function buildFormMap(races) {
  const map = {};
  races.forEach(race => {
    (race.Results || []).forEach(r => {
      const id = r.Driver.driverId;
      if (!map[id]) map[id] = [];
      const pos = parseInt(r.position);
      const isDNF = r.status !== 'Finished' && !r.status.includes('Lap');
      map[id].push({ pos, isDNF });
    });
  });
  return map;
}

function formDotsHTML(driverId, formMap) {
  const results = formMap[driverId] || [];
  if (!results.length) return '';
  return `<div class="form-dots">${results.map(r => {
    let cls = 'none', title = `P${r.pos}`;
    if (r.isDNF)     { cls = 'dnf';    title = 'DNF'; }
    else if (r.pos === 1) { cls = 'win'; title = 'Win'; }
    else if (r.pos <= 10) { cls = 'pts'; title = `P${r.pos}`; }
    return `<span class="form-dot ${cls}" title="${title}"></span>`;
  }).join('')}</div>`;
}

// ─── DRIVER STANDINGS ─────────────────────────────────────────────────────────

function displayDriverStandings(drivers, formMap, yearLabel) {
  const container = document.getElementById('driver-standings');
  if (!drivers.length) {
    container.innerHTML = '<p class="no-data">Standings will appear after the first race</p>';
    return;
  }

  const leaderPts = parseFloat(drivers[0].points);
  const secondPts = drivers[1] ? parseFloat(drivers[1].points) : leaderPts;
  const maxPts    = leaderPts || 1;

  container.innerHTML = `
    <div class="standings-table">
      ${drivers.map((d, i) => {
        const color  = getColor(d.Constructors[0].constructorId);
        const pct    = Math.round((parseFloat(d.points) / maxPts) * 100);
        const myPts  = parseFloat(d.points);
        const gap    = i === 0
          ? `+${leaderPts - secondPts} over P2`
          : `−${leaderPts - myPts} pts`;
        const driverId = d.Driver.driverId;
        return `
          <div class="standing-row ${i === 0 ? 'leader' : ''}"
               style="border-left:3px solid ${color}; background:linear-gradient(90deg,${color}18 0%,transparent 100%);">
            <span class="s-pos">${d.position}</span>
            <div class="s-info">
              <a href="driver.html?id=${driverId}&year=${yearLabel}" class="s-name">${d.Driver.givenName} ${d.Driver.familyName}</a>
              <div class="s-meta-row">
                <span class="s-team" style="color:${color}">${d.Constructors[0].name}</span>
                <span class="s-gap">${gap}</span>
              </div>
              ${formDotsHTML(driverId, formMap)}
              <div class="s-bar-track"><div class="s-bar-fill" style="width:${pct}%;background:${color}"></div></div>
            </div>
            <div class="s-right">
              <span class="s-pts">${d.points}</span>
              <span class="s-pts-label">pts</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── CONSTRUCTOR STANDINGS ────────────────────────────────────────────────────

function displayConstructorStandings(constructors) {
  const container = document.getElementById('constructor-standings');
  if (!constructors.length) {
    container.innerHTML = '<p class="no-data">Standings will appear after the first race</p>';
    return;
  }
  const maxPts = parseFloat(constructors[0].points) || 1;
  container.innerHTML = `
    <div class="constructor-list">
      ${constructors.map((c, i) => {
        const color = getColor(c.Constructor.constructorId);
        const pct   = Math.round((parseFloat(c.points) / maxPts) * 100);
        return `
          <div class="constructor-row">
            <span class="s-pos" style="color:${color}">${c.position}</span>
            <div class="constructor-info">
              <div class="constructor-name">${c.Constructor.name}</div>
              <div class="constructor-bar-track">
                <div class="constructor-bar-fill" style="width:${pct}%;background:${color}"></div>
              </div>
            </div>
            <div class="s-right">
              <span class="s-pts">${c.points}</span>
              <span class="s-pts-label">pts</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── RACE SCHEDULE ────────────────────────────────────────────────────────────

function displaySchedule(races) {
  const container = document.getElementById('schedule');
  if (!races.length) {
    container.innerHTML = '<p class="no-data">Schedule not yet available</p>';
    return;
  }
  const now = new Date();
  const nextRace = races.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);
  const nextRound = nextRace?.round;

  container.innerHTML = races.map(r => {
    const raceDate = new Date(`${r.date}T${r.time || '12:00:00Z'}`);
    const isPast   = raceDate < now;
    const isNext   = r.round === nextRound;
    const flag     = getFlag(r.Circuit.Location.country);
    const isSprint = !!r.Sprint;
    return `
      <div class="schedule-row ${isPast ? 'past' : ''} ${isNext ? 'next' : ''}">
        <div class="schedule-round">R${r.round}</div>
        <div class="schedule-info">
          <div class="schedule-name">${flag} ${r.raceName}${isSprint ? '<span class="schedule-sprint">Sprint</span>' : ''}</div>
          <div class="schedule-circuit">${r.Circuit.circuitName}</div>
        </div>
        <div class="schedule-date">${formatDate(raceDate)}</div>
      </div>
    `;
  }).join('');
}

// ─── LOGO TRANSPARENCY ───────────────────────────────────────────────────────

async function makeLogoTransparent() {
  const logos = document.querySelectorAll('.f1-logo-img');
  if (!logos.length) return;

  const src = logos[0];
  if (!src.complete || !src.naturalWidth) {
    await new Promise(resolve => { src.onload = resolve; });
  }

  const canvas = document.createElement('canvas');
  canvas.width  = src.naturalWidth;
  canvas.height = src.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);

  const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Remove near-white / light-grey background pixels
    if (r > 200 && g > 200 && b > 200) {
      // Soft edge: partially transparent based on how white the pixel is
      const whiteness = (r + g + b) / (3 * 255);
      data[i + 3] = Math.round((1 - whiteness) * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  const dataURL = canvas.toDataURL('image/png');
  logos.forEach(l => { l.src = dataURL; });
}

init().then(() => makeLogoTransparent());
