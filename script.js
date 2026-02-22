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

const NATIONALITY_ISO = {
  'British':       'gb', 'Dutch':        'nl', 'Mexican':      'mx',
  'Monégasque':    'mc', 'Monegasque':   'mc', 'Spanish':      'es',
  'Australian':    'au', 'Finnish':      'fi', 'German':       'de',
  'French':        'fr', 'Canadian':     'ca', 'Thai':         'th',
  'Danish':        'dk', 'Chinese':      'cn', 'Italian':      'it',
  'New Zealander': 'nz', 'American':     'us', 'Brazilian':    'br',
  'Japanese':      'jp', 'Belgian':      'be', 'Austrian':     'at',
  'Swiss':         'ch', 'Argentine':    'ar', 'Swedish':      'se',
  'Czech':         'cz', 'Polish':       'pl', 'Portuguese':   'pt',
  'Russian':       'ru',
};

const CIRCUIT_DATA = {
  albert_park:   { laps: 58, length: '5.278 km' },
  bahrain:       { laps: 57, length: '5.412 km' },
  jeddah:        { laps: 50, length: '6.174 km' },
  suzuka:        { laps: 53, length: '5.807 km' },
  shanghai:      { laps: 56, length: '5.451 km' },
  miami:         { laps: 57, length: '5.412 km' },
  imola:         { laps: 63, length: '4.909 km' },
  monaco:        { laps: 78, length: '3.337 km' },
  villeneuve:    { laps: 70, length: '4.361 km' },
  catalunya:     { laps: 66, length: '4.657 km' },
  red_bull_ring: { laps: 71, length: '4.318 km' },
  silverstone:   { laps: 52, length: '5.891 km' },
  hungaroring:   { laps: 70, length: '4.381 km' },
  spa:           { laps: 44, length: '7.004 km' },
  zandvoort:     { laps: 72, length: '4.259 km' },
  monza:         { laps: 53, length: '5.793 km' },
  baku:          { laps: 51, length: '6.003 km' },
  marina_bay:    { laps: 62, length: '5.063 km' },
  americas:      { laps: 56, length: '5.513 km' },
  rodriguez:     { laps: 71, length: '4.304 km' },
  interlagos:    { laps: 71, length: '4.309 km' },
  vegas:         { laps: 50, length: '6.120 km' },
  losail:        { laps: 57, length: '5.380 km' },
  yas_marina:    { laps: 58, length: '5.281 km' },
};

const COUNTRY_ISO = {
  'Australia': 'au', 'China': 'cn', 'Japan': 'jp',
  'Bahrain': 'bh', 'Saudi Arabia': 'sa', 'USA': 'us',
  'United States': 'us', 'Italy': 'it', 'Monaco': 'mc',
  'Canada': 'ca', 'Spain': 'es', 'Austria': 'at',
  'UK': 'gb', 'United Kingdom': 'gb', 'Hungary': 'hu',
  'Belgium': 'be', 'Netherlands': 'nl', 'Azerbaijan': 'az',
  'Singapore': 'sg', 'Mexico': 'mx', 'Brazil': 'br',
  'UAE': 'ae', 'Qatar': 'qa', 'Abu Dhabi': 'ae',
};

// ─── GLOBALS ──────────────────────────────────────────────────────────────────

let chartInstance    = null;
let selectedYear     = null;   // null = 2026 auto-detect; '2018'–'2025' = historical
let countdownTimer   = null;   // setInterval handle for the countdown

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function flagImg(code, alt) {
  return `<img class="flag-img" src="flags/${code}.png" alt="${alt}" loading="lazy">`;
}
function getFlag(country)  { const c = COUNTRY_ISO[country];    return c ? flagImg(c, country) : ''; }
function getNatFlag(nat)   { const c = NATIONALITY_ISO[nat];    return c ? flagImg(c, nat) : ''; }
function getColor(id)      { return TEAM_COLORS[id] || '#888888'; }

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

// ─── YEAR PICKER ──────────────────────────────────────────────────────────────

function renderYearPicker() {
  const wrap = document.getElementById('year-picker-wrap');
  if (!wrap) return;
  const years = ['2026','2025','2024','2023','2022','2021','2020','2019','2018'];
  wrap.innerHTML = `
    <div class="year-picker">
      ${years.map(y => {
        const isActive = selectedYear === null ? y === '2026' : y === selectedYear;
        return `<button class="year-pill${isActive ? ' active' : ''}" data-year="${y}">${y}</button>`;
      }).join('')}
    </div>
  `;
  wrap.querySelectorAll('.year-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const y = btn.dataset.year;
      selectedYear = (y === '2026') ? null : y;
      renderYearPicker();
      resetUI();
      init(selectedYear);
    });
  });
}

// ─── RESET UI (for year switching) ────────────────────────────────────────────

function resetUI() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (chartInstance)  { chartInstance.destroy(); chartInstance = null; }

  // Remove scroll-fade classes so initScrollAnimations() re-applies them
  document.querySelectorAll('section').forEach(s => s.classList.remove('scroll-fade', 'visible'));

  document.getElementById('stats-bar').innerHTML         = '<div class="skeleton-stats"></div>';
  document.getElementById('next-race').innerHTML         = '<div class="skeleton-hero"></div>';
  document.getElementById('last-race').innerHTML         = '<div class="skeleton-card"></div>';
  document.getElementById('driver-standings').innerHTML  = `
    <div class="skeleton-table">
      <div class="skeleton-row skeleton-header"></div>
      <div class="skeleton-row"></div><div class="skeleton-row"></div>
      <div class="skeleton-row"></div><div class="skeleton-row"></div>
    </div>`;
  document.getElementById('constructor-standings').innerHTML = `
    <div class="skeleton-table">
      <div class="skeleton-row skeleton-header"></div>
      <div class="skeleton-row"></div><div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>`;
  document.getElementById('schedule').innerHTML          = `
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>`;
  document.getElementById('trend-container').innerHTML   = '<div class="skeleton-trend"></div>';

  const displayYear = selectedYear || '2026';
  const schedHeading = document.getElementById('schedule-heading');
  if (schedHeading) schedHeading.textContent = `${displayYear} Race Calendar`;
  const subtitle = document.getElementById('season-subtitle');
  if (subtitle) subtitle.textContent = `${displayYear} World Championship`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init(forceYear = null) {

  // ── HISTORICAL YEAR PATH ──────────────────────────────────────────────────
  if (forceYear) {
    const raw = await fetchJSON(`${BASE}${forceYear}.json?limit=30`).catch(() => null);
    const races = raw?.MRData?.RaceTable?.Races || [];

    displaySchedule(races);

    const now = new Date();
    const completedRounds = races
      .filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now)
      .map(r => r.round);
    const last5 = completedRounds.slice(-5);

    const results = await Promise.allSettled([
      fetchJSON(`${BASE}${forceYear}/driverStandings.json`),
      fetchJSON(`${BASE}${forceYear}/constructorStandings.json`),
      fetchJSON(`${BASE}${forceYear}/last/results.json`),
      fetchJSON(`${BASE}${forceYear}/last/qualifying.json`),
      fetchJSON(`${BASE}${forceYear}/last/pitstops.json?limit=100`),
      fetchJSON(`${BASE}${forceYear}/last/sprint.json`),
      ...last5.map(r => fetchJSON(`${BASE}${forceYear}/${r}/results.json`)),
    ]);

    const [driverRes, ctorRes, lastRaceRes, qualRes, pitRes, sprintRes, ...formRoundRes] = results;

    const drivers      = driverRes.status === 'fulfilled'   ? driverRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [] : [];
    const constructors = ctorRes.status === 'fulfilled'     ? ctorRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [] : [];
    const lastRace     = lastRaceRes.status === 'fulfilled' ? lastRaceRes.value.MRData?.RaceTable?.Races?.[0] || null : null;
    const qualifying   = qualRes.status === 'fulfilled'     ? qualRes.value.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [] : [];
    const pitStops     = pitRes.status === 'fulfilled'      ? pitRes.value.MRData?.RaceTable?.Races?.[0]?.PitStops || [] : [];
    const sprintRace   = sprintRes.status === 'fulfilled'   ? sprintRes.value.MRData?.RaceTable?.Races?.[0] || null : null;
    const formRaces    = formRoundRes.filter(r => r.status === 'fulfilled').map(r => r.value.MRData?.RaceTable?.Races?.[0]).filter(Boolean);
    const formMap      = buildFormMap(formRaces);

    displayStatsBar(drivers, races, forceYear);
    displaySeasonComplete(drivers, constructors, forceYear);

    const lastRaceHeading = document.getElementById('last-race-heading');
    if (lastRaceHeading) lastRaceHeading.textContent = 'Final Race Result';

    if (lastRace) displayLastRace(lastRace, qualifying, pitStops, sprintRace);
    else document.getElementById('last-race').innerHTML = '<p class="no-data">No race results available</p>';

    displayDriverStandings(drivers, formMap, forceYear);
    displayConstructorStandings(constructors, drivers);
    fetchAndDisplayTrend(forceYear);
    initScrollAnimations();
    return;
  }

  // ── LIVE / AUTO-DETECT PATH ───────────────────────────────────────────────

  // Restore last-race heading if coming back from a historical year
  const lastRaceHeading = document.getElementById('last-race-heading');
  if (lastRaceHeading) lastRaceHeading.textContent = 'Last Race Result';

  // Phase 1: fetch 2026 schedule
  const rawSchedule = await fetchJSON(`${BASE}current.json?limit=30`).catch(() => null);
  const races2026   = rawSchedule?.MRData?.RaceTable?.Races || [];

  const dataYear    = 'current';
  const yearLabel   = '2026';
  const dataRaces   = races2026;
  const calendarRaces = races2026;
  const now = new Date();
  const nextRace = calendarRaces.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);
  const circuitId = nextRace?.Circuit?.circuitId;

  displayNextRace(calendarRaces);
  displaySchedule(calendarRaces);

  const completedRounds = dataRaces
    .filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now)
    .map(r => r.round);
  const last5 = completedRounds.slice(-5);

  // Phase 3: parallel fetch
  const results = await Promise.allSettled([
    fetchJSON(`${BASE}${dataYear}/driverStandings.json`),
    fetchJSON(`${BASE}${dataYear}/constructorStandings.json`),
    fetchJSON(`${BASE}${dataYear}/last/results.json`),
    fetchJSON(`${BASE}${dataYear}/last/qualifying.json`),
    fetchJSON(`${BASE}${dataYear}/last/pitstops.json?limit=100`),
    fetchJSON(`${BASE}${dataYear}/last/sprint.json`),
    circuitId
      ? fetchJSON(`${BASE}2025/circuits/${circuitId}/results.json?limit=1`)
      : Promise.reject('no circuit'),
    ...last5.map(r => fetchJSON(`${BASE}${dataYear}/${r}/results.json`)),
  ]);

  const [driverRes, ctorRes, lastRaceRes, qualRes, pitRes, sprintRes, circuitInfoRes, ...formRoundRes] = results;

  const drivers      = driverRes.status === 'fulfilled'   ? driverRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [] : [];
  const constructors = ctorRes.status === 'fulfilled'     ? ctorRes.value.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [] : [];
  const lastRace     = lastRaceRes.status === 'fulfilled' ? lastRaceRes.value.MRData?.RaceTable?.Races?.[0] || null : null;
  const qualifying   = qualRes.status === 'fulfilled'     ? qualRes.value.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [] : [];
  const pitStops     = pitRes.status === 'fulfilled'      ? pitRes.value.MRData?.RaceTable?.Races?.[0]?.PitStops || [] : [];
  const sprintRace   = sprintRes.status === 'fulfilled'   ? sprintRes.value.MRData?.RaceTable?.Races?.[0] || null : null;
  const circuitRace  = circuitInfoRes.status === 'fulfilled' ? circuitInfoRes.value.MRData?.RaceTable?.Races?.[0] || null : null;

  const formRaces = formRoundRes
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.MRData?.RaceTable?.Races?.[0])
    .filter(Boolean);
  const formMap = buildFormMap(formRaces);

  displayStatsBar(drivers, dataRaces, yearLabel);

  if (lastRace) displayLastRace(lastRace, qualifying, pitStops, sprintRace);
  else document.getElementById('last-race').innerHTML = '<p class="no-data">No race results available yet</p>';

  displayDriverStandings(drivers, formMap, yearLabel);
  displayConstructorStandings(constructors, drivers);

  if (circuitId) updateCircuitInfo(circuitId, circuitRace);

  fetchAndDisplayTrend(dataYear);
  initScrollAnimations();
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function displayStatsBar(drivers, races, yearLabel) {
  const container = document.getElementById('stats-bar');
  if (!container) return;

  const now = new Date();
  const completed = races.filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now).length;
  const total  = races.length;
  const leader = drivers[0];
  const second = drivers[1];

  container.innerHTML = `
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
  const flag     = getFlag(nextRace.Circuit.Location.country);
  const isSprint = !!nextRace.Sprint;

  const sessions = [];
  if (nextRace.FirstPractice)  sessions.push({ name: isSprint ? 'FP1' : 'FP1',           ...nextRace.FirstPractice });
  if (nextRace.SecondPractice) sessions.push({ name: isSprint ? 'Sprint Quali' : 'FP2',   ...nextRace.SecondPractice });
  if (nextRace.ThirdPractice)  sessions.push({ name: 'FP3',                               ...nextRace.ThirdPractice });
  if (nextRace.Sprint)         sessions.push({ name: 'Sprint',                            ...nextRace.Sprint });
  if (nextRace.Qualifying)     sessions.push({ name: 'Qualifying',                        ...nextRace.Qualifying });
  sessions.push({ name: 'Race', date: nextRace.date, time: nextRace.time || '12:00:00Z', isRace: true });

  const sessionHTML = sessions.map(s => `
    <div class="session-row ${s.isRace ? 'session-race' : ''}">
      <span class="session-name">${s.name}</span>
      <span class="session-datetime">${formatSessionTime(s.date, s.time)}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="next-race-card">
      <div class="next-race-label">NEXT RACE &middot; ROUND ${nextRace.round}</div>
      <div class="next-race-name">${flag}${nextRace.raceName}</div>
      <div class="next-race-circuit">${nextRace.Circuit.circuitName} &bull; ${nextRace.Circuit.Location.locality}, ${nextRace.Circuit.Location.country}</div>
      <div class="next-race-date">${formatDate(raceDate)}</div>
      <div class="next-race-body">
        <div class="countdown" id="countdown">
          <div class="cd-block"><span class="cd-num" id="cdv-d">—</span><span class="cd-label">days</span></div>
          <div class="cd-sep">:</div>
          <div class="cd-block"><span class="cd-num" id="cdv-h">—</span><span class="cd-label">hrs</span></div>
          <div class="cd-sep">:</div>
          <div class="cd-block"><span class="cd-num" id="cdv-m">—</span><span class="cd-label">min</span></div>
          <div class="cd-sep">:</div>
          <div class="cd-block"><span class="cd-num" id="cdv-s">—</span><span class="cd-label">sec</span></div>
        </div>
        ${sessions.length > 1 ? `<div class="session-list">${sessionHTML}</div>` : ''}
      </div>
      <div id="circuit-info-block"></div>
    </div>
  `;

  function updateCdVal(id, newVal) {
    const el = document.getElementById(id);
    if (!el || el.textContent === newVal) return;
    el.textContent = newVal;
    el.classList.remove('tick');
    void el.offsetWidth;
    el.classList.add('tick');
  }

  function tick() {
    const diff = raceDate - new Date();
    if (diff <= 0) {
      const el = document.getElementById('countdown');
      if (el) el.innerHTML = '<span class="cd-live">Race underway!</span>';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    updateCdVal('cdv-d', String(d));
    updateCdVal('cdv-h', String(h).padStart(2, '0'));
    updateCdVal('cdv-m', String(m).padStart(2, '0'));
    updateCdVal('cdv-s', String(s).padStart(2, '0'));
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ─── SEASON COMPLETE (historical year champion card) ──────────────────────────

function displaySeasonComplete(drivers, constructors, year) {
  const container = document.getElementById('next-race');
  const champion  = drivers[0];
  const ctorChamp = constructors[0];

  if (!champion) {
    container.innerHTML = `<div class="champion-card"><div class="champion-label">${year} Season Complete</div></div>`;
    return;
  }

  const color   = getColor(champion.Constructors[0].constructorId);
  const natFlag = getNatFlag(champion.Driver.nationality);

  container.innerHTML = `
    <div class="champion-card" style="--champ-color:${color}">
      <div class="champion-label">${year} WORLD CHAMPION</div>
      <div class="champion-name">${natFlag}${champion.Driver.givenName} ${champion.Driver.familyName}</div>
      <div class="champion-team" style="color:${color}">${champion.Constructors[0].name} &bull; ${champion.wins} wins</div>
      <div class="champion-pts">${champion.points} <span class="champion-pts-label">pts</span></div>
      ${ctorChamp ? `<div class="champion-ctor">Constructors: ${ctorChamp.Constructor.name} &bull; ${ctorChamp.points} pts</div>` : ''}
    </div>
  `;
}

// ─── CIRCUIT INFO ──────────────────────────────────────────────────────────────

function updateCircuitInfo(circuitId, circuitRace) {
  const block = document.getElementById('circuit-info-block');
  if (!block) return;
  const data       = CIRCUIT_DATA[circuitId] || {};
  const lastResult = circuitRace?.Results?.[0];
  const lastWinner = lastResult ? `${lastResult.Driver.givenName[0]}. ${lastResult.Driver.familyName}` : null;
  const lastTeam   = lastResult?.Constructor?.name || null;
  const stats      = [];
  if (data.laps)   stats.push({ label: 'Race Laps',   value: data.laps });
  if (data.length) stats.push({ label: 'Lap Length',   value: data.length });
  if (lastWinner)  stats.push({ label: '2025 Winner',  value: lastWinner });
  if (lastTeam)    stats.push({ label: 'Team',          value: lastTeam });
  if (!stats.length) return;
  block.innerHTML = `
    <div class="circuit-info">
      ${stats.map(s => `
        <div class="circuit-stat">
          <span class="circuit-stat-value">${s.value}</span>
          <span class="circuit-stat-label">${s.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── LAST RACE ────────────────────────────────────────────────────────────────

function displayLastRace(race, qualifying, pitStops, sprintRace) {
  const container = document.getElementById('last-race');
  const results   = race.Results || [];
  if (!results.length) {
    container.innerHTML = '<p class="no-data">No results available</p>';
    return;
  }
  const flag       = getFlag(race.Circuit.Location.country);
  const flResult   = results.find(r => r.FastestLap?.rank === '1');
  const flDriverId = flResult?.Driver?.driverId;
  const tabs = [
    { label: 'Race',       content: buildRaceTab(results, flDriverId) },
    { label: 'Qualifying', content: buildQualifyingTab(qualifying) },
    { label: 'Pit Stops',  content: buildPitStopsTab(pitStops, results) },
  ];
  if (sprintRace?.Results?.length) tabs.push({ label: 'Sprint', content: buildSprintTab(sprintRace) });
  container.innerHTML = `
    <div class="last-race-card">
      <div class="race-header">
        <div class="race-title">${flag}${race.raceName}</div>
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
          </div>`;
      }).join('')}
    </div>
  `;
  return podiumHTML + listHTML;
}

function podiumPlace(result, pos, flDriverId) {
  if (!result) return `<div class="podium-place p${pos}"><div class="podium-info"></div><div class="podium-block"><span class="podium-pos">${pos}</span></div></div>`;
  const color   = getColor(result.Constructor.constructorId);
  const isFl    = result.Driver.driverId === flDriverId;
  const timeStr = pos === 1 ? 'Winner' : (result.Time ? '+' + result.Time.time : result.status);
  return `
    <div class="podium-place p${pos}" style="--team-color:${color}">
      <div class="podium-info">
        <div class="podium-driver">${result.Driver.givenName[0]}. ${result.Driver.familyName}${isFl ? '<span class="fl-badge">FL</span>' : ''}</div>
        <div class="podium-team" style="color:${color}">${result.Constructor.name}</div>
        <div class="podium-time">${timeStr}</div>
      </div>
      <div class="podium-block"><span class="podium-pos">${pos}</span></div>
    </div>`;
}

function buildQualifyingTab(qualifying) {
  if (!qualifying.length) return '<p class="no-data tab-no-data">No qualifying data available</p>';
  return `
    <div class="quali-table">
      ${qualifying.map((q, i) => {
        const color  = getColor(q.Constructor.constructorId);
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
          </div>`;
      }).join('')}
    </div>`;
}

function buildPitStopsTab(pitStops, results) {
  if (!pitStops.length) return '<p class="no-data tab-no-data">No pit stop data available</p>';
  const nameMap  = {};
  const colorMap = {};
  results.forEach(r => {
    nameMap[r.Driver.driverId]  = `${r.Driver.givenName[0]}. ${r.Driver.familyName}`;
    colorMap[r.Driver.driverId] = getColor(r.Constructor.constructorId);
  });
  const sorted = [...pitStops]
    .filter(p => parseFloat(p.duration) > 0)
    .sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration))
    .slice(0, 10);
  return `
    <div class="pitstop-table">
      <div class="pitstop-header">
        <span>Driver</span><span>Lap</span><span>Stop</span><span>Duration</span>
      </div>
      ${sorted.map((p, i) => {
        const color = colorMap[p.driverId] || '#888';
        const name  = nameMap[p.driverId] || p.driverId;
        return `
          <div class="pitstop-row ${i === 0 ? 'fastest-stop' : ''}">
            <span class="result-name" style="color:${i === 0 ? color : '#fff'}">${name}</span>
            <span class="pitstop-lap">Lap ${p.lap}</span>
            <span class="pitstop-stop">Stop ${p.stop}</span>
            <span class="pitstop-duration ${i === 0 ? 'best' : ''}">${p.duration}s</span>
          </div>`;
      }).join('')}
    </div>`;
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
          </div>`;
      }).join('')}
    </div>`;
}

// ─── TAB SYSTEM ───────────────────────────────────────────────────────────────

function buildTabs(container, tabs) {
  const barEl     = document.createElement('div');
  barEl.className = 'tab-bar';
  const contentEl     = document.createElement('div');
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
      const id  = r.Driver.driverId;
      if (!map[id]) map[id] = [];
      const pos   = parseInt(r.position);
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
    if (r.isDNF)          { cls = 'dnf'; title = 'DNF'; }
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
        const color    = getColor(d.Constructors[0].constructorId);
        const pct      = Math.round((parseFloat(d.points) / maxPts) * 100);
        const myPts    = parseFloat(d.points);
        const gap      = i === 0 ? `+${leaderPts - secondPts} over P2` : `−${leaderPts - myPts} pts`;
        const driverId = d.Driver.driverId;
        const natFlag  = getNatFlag(d.Driver.nationality);
        return `
          <div class="standing-row ${i === 0 ? 'leader' : ''}"
               style="border-left:3px solid ${color};background:linear-gradient(90deg,${color}18 0%,transparent 100%)">
            <span class="s-pos">${d.position}</span>
            <div class="s-info">
              <a href="driver.html?id=${driverId}&year=${yearLabel}" class="s-name">${natFlag}${d.Driver.givenName} ${d.Driver.familyName}</a>
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
          </div>`;
      }).join('')}
    </div>`;
}

// ─── CONSTRUCTOR STANDINGS ────────────────────────────────────────────────────

function displayConstructorStandings(constructors, drivers) {
  const container = document.getElementById('constructor-standings');
  if (!constructors.length) {
    container.innerHTML = '<p class="no-data">Standings will appear after the first race</p>';
    return;
  }
  const ctorDrivers = {};
  (drivers || []).forEach(d => {
    const id = d.Constructors[0].constructorId;
    if (!ctorDrivers[id]) ctorDrivers[id] = [];
    ctorDrivers[id].push(d);
  });
  const maxPts = parseFloat(constructors[0].points) || 1;
  container.innerHTML = `
    <div class="constructor-list">
      ${constructors.map(c => {
        const color     = getColor(c.Constructor.constructorId);
        const pct       = Math.round((parseFloat(c.points) / maxPts) * 100);
        const teammates = ctorDrivers[c.Constructor.constructorId] || [];
        const d1 = teammates[0];
        const d2 = teammates[1];
        let h2hHTML = '';
        if (d1 && d2) {
          const pts1  = parseFloat(d1.points);
          const pts2  = parseFloat(d2.points);
          const total = pts1 + pts2 || 1;
          const pct1  = Math.round((pts1 / total) * 100);
          const code1 = d1.Driver.code || d1.Driver.familyName.slice(0, 3).toUpperCase();
          const code2 = d2.Driver.code || d2.Driver.familyName.slice(0, 3).toUpperCase();
          h2hHTML = `
            <div class="h2h-bar">
              <div class="h2h-drivers">
                <span>${code1} <span class="h2h-pts">${d1.points}</span></span>
                <span><span class="h2h-pts">${d2.points}</span> ${code2}</span>
              </div>
              <div class="h2h-track">
                <div class="h2h-left" style="width:${pct1}%;background:${color}"></div>
                <div class="h2h-right" style="background:${color}"></div>
              </div>
            </div>`;
        }
        return `
          <div class="constructor-row" style="border-top:2px solid ${color}">
            <span class="s-pos" style="color:${color}">${c.position}</span>
            <div class="constructor-info">
              <div class="constructor-name">${c.Constructor.name}</div>
              ${h2hHTML}
              <div class="constructor-bar-track">
                <div class="constructor-bar-fill" style="width:${pct}%;background:${color}"></div>
              </div>
            </div>
            <div class="s-right">
              <span class="s-pts">${c.points}</span>
              <span class="s-pts-label">pts</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── RACE SCHEDULE ────────────────────────────────────────────────────────────

function displaySchedule(races) {
  const container = document.getElementById('schedule');
  if (!races.length) {
    container.innerHTML = '<p class="no-data">Schedule not yet available</p>';
    return;
  }
  const now       = new Date();
  const nextRace  = races.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);
  const nextRound = nextRace?.round;
  const completed = races.filter(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) < now).length;
  const total     = races.length;
  const pct       = Math.round((completed / total) * 100);

  const progressHTML = `
    <div class="season-progress">
      <div class="season-progress-label">Round ${completed} of ${total} completed</div>
      <div class="season-progress-track">
        <div class="season-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  const rowsHTML = races.map(r => {
    const raceDate = new Date(`${r.date}T${r.time || '12:00:00Z'}`);
    const isPast   = raceDate < now;
    const isNext   = r.round === nextRound;
    const flag     = getFlag(r.Circuit.Location.country);
    const isSprint = !!r.Sprint;
    return `
      <div class="schedule-row ${isPast ? 'past' : ''} ${isNext ? 'next' : ''}">
        <div class="schedule-round">R${r.round}</div>
        <div class="schedule-info">
          <div class="schedule-name">${flag}${r.raceName}${isSprint ? '<span class="schedule-sprint">Sprint</span>' : ''}</div>
          <div class="schedule-circuit">${r.Circuit.circuitName}</div>
        </div>
        <div class="schedule-date">${formatDate(raceDate)}</div>
      </div>`;
  }).join('');

  container.innerHTML = progressHTML + rowsHTML;
}

// ─── POINTS TREND CHART ───────────────────────────────────────────────────────

async function fetchAndDisplayTrend(apiYear) {
  const container = document.getElementById('trend-container');
  try {
    const data  = await fetchJSON(`${BASE}${apiYear}/results.json?limit=500`);
    const races = data.MRData?.RaceTable?.Races || [];
    if (!races.length) {
      container.innerHTML = '<p class="no-data">No completed races yet this season</p>';
      return;
    }
    displayPointsTrend(races);
  } catch (e) {
    container.innerHTML = '<p class="no-data">Could not load trend data</p>';
    console.error(e);
  }
}

function displayPointsTrend(races) {
  // ── First pass: discover all drivers ──
  const driverMeta   = {}; // id → { name, color }
  const driverTotals = {}; // id → [cumulative pts array]
  races.forEach(race => {
    (race.Results || []).forEach(r => {
      const id = r.Driver.driverId;
      if (!driverMeta[id]) {
        driverMeta[id]   = {
          name:  `${r.Driver.familyName}`,
          color: getColor(r.Constructor.constructorId),
        };
        driverTotals[id] = [];
      }
    });
  });

  // ── Second pass: compute cumulative points per round ──
  const running = {};
  races.forEach(race => {
    (race.Results || []).forEach(r => {
      const id = r.Driver.driverId;
      running[id] = (running[id] || 0) + parseFloat(r.points || 0);
    });
    Object.keys(driverTotals).forEach(id => {
      driverTotals[id].push(running[id] || 0);
    });
  });

  // ── Sort by final points, take top 8 ──
  const top8 = Object.entries(driverTotals)
    .map(([id, arr]) => ({ id, arr, final: arr[arr.length - 1] || 0 }))
    .sort((a, b) => b.final - a.final)
    .slice(0, 8);

  const labels = races.map(r => `R${r.round}`);

  // ── Destroy old chart, inject fresh canvas ──
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const container = document.getElementById('trend-container');
  container.innerHTML = '<canvas id="trend-chart"></canvas>';
  const ctx = document.getElementById('trend-chart');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: top8.map(d => ({
        label:            driverMeta[d.id].name,
        data:             d.arr,
        borderColor:      driverMeta[d.id].color,
        backgroundColor:  driverMeta[d.id].color + '18',
        pointBackgroundColor: driverMeta[d.id].color,
        borderWidth:      2,
        pointRadius:      3,
        pointHoverRadius: 6,
        tension:          0.3,
        fill:             false,
      })),
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color:    'rgba(255,255,255,0.6)',
            font:     { family: 'Inter', size: 11 },
            boxWidth: 12,
            padding:  16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10,10,15,0.95)',
          borderColor:     'rgba(255,255,255,0.1)',
          borderWidth:     1,
          titleColor:      '#ffffff',
          bodyColor:       'rgba(255,255,255,0.7)',
          titleFont:       { family: 'Oswald', size: 13 },
          bodyFont:        { family: 'Inter',  size: 11 },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} pts`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.35)', font: { family: 'Inter', size: 10 } },
        },
        y: {
          grid:  { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.35)', font: { family: 'Inter', size: 10 } },
          title: {
            display: true,
            text:    'Championship Points',
            color:   'rgba(255,255,255,0.25)',
            font:    { family: 'Inter', size: 10 },
          },
        },
      },
    },
  });
}

// ─── SCROLL ANIMATIONS ────────────────────────────────────────────────────────

function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;
  const sections = document.querySelectorAll('section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.04 });
  setTimeout(() => {
    sections.forEach(s => { s.classList.add('scroll-fade'); observer.observe(s); });
  }, 80);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

renderYearPicker();
init();
