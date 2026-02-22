'use strict';

const BASE = 'https://api.jolpi.ca/ergast/f1/';

const TEAM_COLORS = {
  red_bull:     '#3671C6', ferrari:      '#E8002D', mercedes:     '#27F4D2',
  mclaren:      '#FF8000', aston_martin: '#229971', alpine:       '#FF87BC',
  williams:     '#64C4FF', rb:           '#6692FF', haas:         '#B6BABD',
  sauber:       '#52E252', kick_sauber:  '#52E252', audi:         '#C0392B',
  renault:      '#FFF500', alphatauri:   '#5E8FAA', toro_rosso:   '#469BFF',
};

const NATIONALITY_ISO = {
  'British': 'gb', 'Dutch': 'nl', 'Mexican': 'mx', 'Monégasque': 'mc', 'Monegasque': 'mc',
  'Spanish': 'es', 'Australian': 'au', 'Finnish': 'fi', 'German': 'de', 'French': 'fr',
  'Canadian': 'ca', 'Thai': 'th', 'Danish': 'dk', 'Chinese': 'cn', 'Italian': 'it',
  'New Zealander': 'nz', 'American': 'us', 'Brazilian': 'br', 'Japanese': 'jp',
  'Belgian': 'be', 'Austrian': 'at', 'Swiss': 'ch', 'Argentine': 'ar',
  'Swedish': 'se', 'Czech': 'cz', 'Polish': 'pl', 'Portuguese': 'pt', 'Russian': 'ru',
};

const COUNTRY_ISO = {
  'Australia': 'au', 'China': 'cn', 'Japan': 'jp', 'Bahrain': 'bh',
  'Saudi Arabia': 'sa', 'USA': 'us', 'United States': 'us', 'Italy': 'it',
  'Monaco': 'mc', 'Canada': 'ca', 'Spain': 'es', 'Austria': 'at',
  'UK': 'gb', 'United Kingdom': 'gb', 'Hungary': 'hu', 'Belgium': 'be',
  'Netherlands': 'nl', 'Azerbaijan': 'az', 'Singapore': 'sg',
  'Mexico': 'mx', 'Brazil': 'br', 'UAE': 'ae', 'Qatar': 'qa', 'Abu Dhabi': 'ae',
  'France': 'fr', 'Germany': 'de', 'Russia': 'ru', 'Portugal': 'pt',
  'Turkey': 'tr', 'Vietnam': 'vn', 'Korea': 'kr', 'India': 'in',
  'Malaysia': 'my', 'South Africa': 'za', 'Argentina': 'ar', 'Sweden': 'se',
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
  paul_ricard:   { laps: 53, length: '5.842 km' },
  hockenheimring:{ laps: 67, length: '4.574 km' },
  sochi:         { laps: 53, length: '5.848 km' },
  portimao:      { laps: 66, length: '4.653 km' },
  istanbul:      { laps: 58, length: '5.338 km' },
  nurburgring:   { laps: 60, length: '5.148 km' },
  mugello:       { laps: 59, length: '5.245 km' },
  bahrain_2:     { laps: 87, length: '3.543 km' },
  sepang:        { laps: 56, length: '5.543 km' },
  yeongam:       { laps: 55, length: '5.615 km' },
  buddh:         { laps: 60, length: '5.125 km' },
};

function flagImg(code, alt) {
  return `<img class="flag-img" src="flags/${code}.png" alt="${alt}" loading="lazy">`;
}
function getFlag(country)  { const c = COUNTRY_ISO[country];   return c ? flagImg(c, country) : ''; }
function getNatFlag(nat)   { const c = NATIONALITY_ISO[nat];   return c ? flagImg(c, nat) : ''; }
function getColor(id)      { return TEAM_COLORS[id] || '#888888'; }

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  const params   = new URLSearchParams(window.location.search);
  const round    = params.get('round');
  const year     = params.get('year') || '2026';
  const apiYear  = year === '2026' ? 'current' : year;

  if (!round) {
    document.getElementById('race-name').textContent = 'No race specified';
    return;
  }

  try {
    const [raceRes, qualRes, pitRes, sprintRes] = await Promise.allSettled([
      fetchJSON(`${BASE}${apiYear}/${round}/results.json`),
      fetchJSON(`${BASE}${apiYear}/${round}/qualifying.json`),
      fetchJSON(`${BASE}${apiYear}/${round}/pitstops.json?limit=100`),
      fetchJSON(`${BASE}${apiYear}/${round}/sprint.json`),
    ]);

    const race = raceRes.status === 'fulfilled'
      ? raceRes.value.MRData?.RaceTable?.Races?.[0] : null;

    if (!race?.Results?.length) {
      document.getElementById('race-name').textContent = 'No data found';
      return;
    }

    const results    = race.Results;
    const qualifying = qualRes.status === 'fulfilled'
      ? qualRes.value.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [] : [];
    const pitStops   = pitRes.status === 'fulfilled'
      ? pitRes.value.MRData?.RaceTable?.Races?.[0]?.PitStops || [] : [];
    const sprint     = sprintRes.status === 'fulfilled'
      ? sprintRes.value.MRData?.RaceTable?.Races?.[0] : null;

    // ── Header ──
    const winner      = results[0];
    const winnerColor = getColor(winner.Constructor.constructorId);
    const circuitData = CIRCUIT_DATA[race.Circuit.circuitId] || {};
    const flag        = getFlag(race.Circuit.Location.country);

    document.title = `${race.raceName} · F1 ${year}`;
    document.getElementById('race-round').textContent   = `R${race.round}`;
    document.getElementById('race-name').innerHTML      = `${flag}${race.raceName}`;
    document.getElementById('race-subtitle').textContent =
      `${race.Circuit.circuitName} · ${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`;

    const header = document.getElementById('race-header');
    header.style.background       = `linear-gradient(135deg, #0d0d1a 0%, ${winnerColor}33 60%, ${winnerColor}55 100%)`;
    header.style.borderBottomColor = winnerColor;
    document.getElementById('race-round').style.color  = winnerColor;

    // ── Stat cards ──
    displayRaceStats(race, results, qualifying, circuitData, winnerColor);

    // ── Main results ──
    displayResults(race, results, qualifying, pitStops, sprint);

  } catch (err) {
    document.getElementById('race-name').textContent = 'Failed to load race data';
    console.error(err);
  }
}

// ─── STAT CARDS ───────────────────────────────────────────────────────────────

function displayRaceStats(race, results, qualifying, circuitData, color) {
  const container  = document.getElementById('race-stats');
  const winner     = results[0];
  const flResult   = results.find(r => r.FastestLap?.rank === '1');
  const pole       = qualifying[0];
  const raceDate   = new Date(race.date + 'T12:00:00Z');

  const stats = [
    { label: 'Date',         value: formatDate(raceDate) },
    { label: 'Winner',       value: `${winner.Driver.givenName[0]}. ${winner.Driver.familyName}` },
    { label: 'Pole',         value: pole ? `${pole.Driver.givenName[0]}. ${pole.Driver.familyName}` : '—' },
    { label: 'Fastest Lap',  value: flResult ? `${flResult.Driver.givenName[0]}. ${flResult.Driver.familyName}` : '—' },
  ];
  if (flResult?.FastestLap?.Time?.time) {
    stats.push({ label: 'FL Time', value: flResult.FastestLap.Time.time });
  }
  if (circuitData.laps)   stats.push({ label: 'Laps',   value: circuitData.laps });
  if (circuitData.length) stats.push({ label: 'Length',  value: circuitData.length });

  container.innerHTML = `
    <div class="race-stat-grid">
      ${stats.map(s => `
        <div class="race-stat-card" style="border-color:${color}30">
          <div class="race-stat-value">${s.value}</div>
          <div class="race-stat-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── RESULTS WITH TABS ────────────────────────────────────────────────────────

function displayResults(race, results, qualifying, pitStops, sprint) {
  const container = document.getElementById('race-results');
  const flDriverId = results.find(r => r.FastestLap?.rank === '1')?.Driver?.driverId;

  const tabs = [
    { label: 'Race',       content: buildRaceTab(results, flDriverId) },
    { label: 'Qualifying', content: buildQualifyingTab(qualifying) },
    { label: 'Pit Stops',  content: buildPitStopsTab(pitStops, results) },
  ];
  if (sprint?.Results?.length) {
    tabs.push({ label: 'Sprint', content: buildSprintTab(sprint.Results) });
  }

  container.innerHTML = `<div class="results-section-title">Results · ${race.season || ''}</div>`;

  const wrap = document.createElement('div');
  wrap.className = 'last-race-card';
  container.appendChild(wrap);

  buildTabs(wrap, tabs);
}

function buildRaceTab(results, flDriverId) {
  const top3 = results.slice(0, 3);

  const podiumHTML = `
    <div class="race-podium" style="padding:20px 16px 0">
      ${podiumPlace(top3[1], 2, flDriverId)}
      ${podiumPlace(top3[0], 1, flDriverId)}
      ${podiumPlace(top3[2], 3, flDriverId)}
    </div>`;

  const rowsHTML = `
    <div class="full-results" style="padding:12px 16px">
      ${results.map(r => {
        const pos     = parseInt(r.position);
        const isDNF   = r.status !== 'Finished' && !r.status.includes('Lap');
        const isFl    = r.Driver.driverId === flDriverId;
        const color   = getColor(r.Constructor.constructorId);
        const natFlag = getNatFlag(r.Driver.nationality);

        let posClass = 'none';
        if (isDNF)       posClass = 'dnf';
        else if (pos === 1) posClass = 'p1';
        else if (pos === 2) posClass = 'p2';
        else if (pos === 3) posClass = 'p3';
        else if (pos <= 10) posClass = 'pts';

        const posDisplay = isDNF ? 'DNF' : pos;
        const timeDisplay = isDNF ? r.status : (r.Time ? (pos === 1 ? r.Time.time : '+' + r.Time.time) : r.status);

        return `
          <div class="rr-row ${pos === 1 ? 'win' : ''} ${isDNF ? 'dnf' : ''}">
            <span class="rr-pos-num ${posClass}">${posDisplay}</span>
            <span class="rr-driver">${natFlag}${r.Driver.givenName[0]}. ${r.Driver.familyName}</span>
            <span class="rr-team" style="color:${color}">${r.Constructor.name}</span>
            <span class="rr-grid">P${r.grid}</span>
            <span class="rr-time">${timeDisplay}</span>
            <span class="rr-pts">${r.points} pts</span>
            ${isFl ? '<span class="rr-fl">FL</span>' : '<span></span>'}
          </div>`;
      }).join('')}
    </div>`;

  return podiumHTML + rowsHTML;
}

function podiumPlace(result, pos, flDriverId) {
  if (!result) return `<div class="rp-place p${pos}"><div class="rp-info"></div><div class="rp-block"><span class="rp-pos">${pos}</span></div></div>`;
  const color   = getColor(result.Constructor.constructorId);
  const isFl    = result.Driver.driverId === flDriverId;
  const timeStr = pos === 1 ? 'Winner' : (result.Time ? '+' + result.Time.time : result.status);
  const natFlag = getNatFlag(result.Driver.nationality);
  return `
    <div class="rp-place p${pos}" style="--team-color:${color}">
      <div class="rp-info">
        <div class="rp-driver">${natFlag}${result.Driver.givenName[0]}. ${result.Driver.familyName}${isFl ? '<span class="rr-fl">FL</span>' : ''}</div>
        <div class="rp-team" style="color:${color}">${result.Constructor.name}</div>
        <div class="rp-time">${timeStr}</div>
      </div>
      <div class="rp-block"><span class="rp-pos">${pos}</span></div>
    </div>`;
}

function buildQualifyingTab(qualifying) {
  if (!qualifying.length) return '<p class="no-data tab-no-data">No qualifying data available</p>';
  return `
    <div class="qual-results" style="padding:12px 16px">
      ${qualifying.map((q, i) => {
        const color  = getColor(q.Constructor.constructorId);
        const isPole = i === 0;
        const natFlag = getNatFlag(q.Driver.nationality);
        return `
          <div class="qual-row ${isPole ? 'pole' : ''}">
            <span class="qual-pos">${q.position}</span>
            <span class="qual-driver">${natFlag}${q.Driver.givenName[0]}. ${q.Driver.familyName}</span>
            <span class="qual-team" style="color:${color}">${q.Constructor.name}</span>
            <span class="qual-times">
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
    .sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
  return `
    <div class="full-results" style="padding:12px 16px">
      ${sorted.map((p, i) => {
        const color = colorMap[p.driverId] || '#888';
        const name  = nameMap[p.driverId]  || p.driverId;
        return `
          <div class="rr-row ${i === 0 ? 'win' : ''}">
            <span class="rr-pos-num ${i === 0 ? 'p1' : 'none'}">${i + 1}</span>
            <span class="rr-driver" style="color:${i === 0 ? color : '#fff'}">${name}</span>
            <span class="rr-team">Lap ${p.lap} &bull; Stop ${p.stop}</span>
            <span class="rr-time" style="color:${i === 0 ? '#c084fc' : ''};font-weight:${i === 0 ? 700 : 400}">${p.duration}s</span>
            ${i === 0 ? '<span class="rr-fl">FAST</span>' : '<span></span>'}
          </div>`;
      }).join('')}
    </div>`;
}

function buildSprintTab(results) {
  const flDriverId = results.find(r => r.FastestLap?.rank === '1')?.Driver?.driverId;
  return `
    <div class="full-results" style="padding:12px 16px">
      ${results.map(r => {
        const pos     = parseInt(r.position);
        const isDNF   = r.status !== 'Finished' && !r.status.includes('Lap');
        const color   = getColor(r.Constructor.constructorId);
        const natFlag = getNatFlag(r.Driver.nationality);
        const isFl    = r.Driver.driverId === flDriverId;
        let posClass  = pos <= 8 ? 'pts' : 'none';
        if (isDNF) posClass = 'dnf';
        if (pos === 1) posClass = 'p1';
        return `
          <div class="rr-row">
            <span class="rr-pos-num ${posClass}">${isDNF ? 'DNF' : pos}</span>
            <span class="rr-driver">${natFlag}${r.Driver.givenName[0]}. ${r.Driver.familyName}</span>
            <span class="rr-team" style="color:${color}">${r.Constructor.name}</span>
            <span class="rr-time">${r.Time ? (pos === 1 ? r.Time.time : '+' + r.Time.time) : r.status}</span>
            <span class="rr-pts">${r.points} pts</span>
            ${isFl ? '<span class="rr-fl">FL</span>' : '<span></span>'}
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

init();
