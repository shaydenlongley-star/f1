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
  'Australia':      '🇦🇺',
  'China':          '🇨🇳',
  'Japan':          '🇯🇵',
  'Bahrain':        '🇧🇭',
  'Saudi Arabia':   '🇸🇦',
  'USA':            '🇺🇸',
  'United States':  '🇺🇸',
  'Italy':          '🇮🇹',
  'Monaco':         '🇲🇨',
  'Canada':         '🇨🇦',
  'Spain':          '🇪🇸',
  'Austria':        '🇦🇹',
  'UK':             '🇬🇧',
  'United Kingdom': '🇬🇧',
  'Hungary':        '🇭🇺',
  'Belgium':        '🇧🇪',
  'Netherlands':    '🇳🇱',
  'Azerbaijan':     '🇦🇿',
  'Singapore':      '🇸🇬',
  'Mexico':         '🇲🇽',
  'Brazil':         '🇧🇷',
  'UAE':            '🇦🇪',
  'Qatar':          '🇶🇦',
  'Abu Dhabi':      '🇦🇪',
};

function getFlag(country) {
  return FLAGS[country] || '🏁';
}

function getColor(constructorId) {
  return TEAM_COLORS[constructorId] || '#888888';
}

function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  const [scheduleRes, driverRes, ctorRes, lastRaceRes] = await Promise.allSettled([
    fetchJSON(`${BASE}current.json?limit=30`),
    fetchJSON(`${BASE}current/driverStandings.json`),
    fetchJSON(`${BASE}current/constructorStandings.json`),
    fetchJSON(`${BASE}current/last/results.json`),
  ]);

  // Schedule
  let races = [];
  if (scheduleRes.status === 'fulfilled') {
    races = scheduleRes.value.MRData?.RaceTable?.Races || [];
  }
  displayNextRace(races);
  displaySchedule(races);

  // Driver standings
  if (driverRes.status === 'fulfilled') {
    const lists = driverRes.value.MRData?.StandingsTable?.StandingsLists || [];
    displayDriverStandings(lists[0]?.DriverStandings || []);
  } else {
    displayDriverStandings([]);
  }

  // Constructor standings
  if (ctorRes.status === 'fulfilled') {
    const lists = ctorRes.value.MRData?.StandingsTable?.StandingsLists || [];
    displayConstructorStandings(lists[0]?.ConstructorStandings || []);
  } else {
    displayConstructorStandings([]);
  }

  // Last race — if current year has no races yet, fall back to 2025
  if (lastRaceRes.status === 'fulfilled') {
    const lastRaces = lastRaceRes.value.MRData?.RaceTable?.Races || [];
    if (lastRaces.length > 0) {
      displayLastRace(lastRaces[0]);
    } else {
      try {
        const prev = await fetchJSON(`${BASE}2025/last/results.json`);
        const prevRaces = prev.MRData?.RaceTable?.Races || [];
        if (prevRaces.length > 0) {
          displayLastRace(prevRaces[0]);
        } else {
          document.getElementById('last-race').innerHTML = '<p class="no-data">No race results available yet</p>';
        }
      } catch {
        document.getElementById('last-race').innerHTML = '<p class="no-data">No race results available yet</p>';
      }
    }
  } else {
    document.getElementById('last-race').innerHTML = '<p class="no-data">Failed to load race data</p>';
  }
}

// ─── NEXT RACE HERO ───────────────────────────────────────────────────────────

function displayNextRace(races) {
  const container = document.getElementById('next-race');
  const now = new Date();
  const nextRace = races.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);

  if (!nextRace) {
    container.innerHTML = races.length === 0
      ? '<p class="no-data">2026 season schedule not yet available</p>'
      : '<p class="no-data">The 2026 season is complete</p>';
    return;
  }

  const raceDate = new Date(`${nextRace.date}T${nextRace.time || '12:00:00Z'}`);
  const flag = getFlag(nextRace.Circuit.Location.country);

  container.innerHTML = `
    <div class="next-race-card">
      <div class="next-race-label">NEXT RACE &middot; ROUND ${nextRace.round}</div>
      <div class="next-race-name">${flag} ${nextRace.raceName}</div>
      <div class="next-race-circuit">${nextRace.Circuit.circuitName} &bull; ${nextRace.Circuit.Location.locality}, ${nextRace.Circuit.Location.country}</div>
      <div class="next-race-date">${formatDate(raceDate)}</div>
      <div class="countdown" id="countdown"></div>
    </div>
  `;

  function tick() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const diff = raceDate - new Date();
    if (diff <= 0) {
      el.textContent = 'Race underway!';
      return;
    }
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

function displayLastRace(race) {
  const container = document.getElementById('last-race');
  const results = race.Results || [];
  if (!results.length) {
    container.innerHTML = '<p class="no-data">No results available</p>';
    return;
  }

  const top3 = results.slice(0, 3);
  const rest = results.slice(3, 10);
  const flag = getFlag(race.Circuit.Location.country);

  container.innerHTML = `
    <div class="last-race-card">
      <div class="race-header">
        <div class="race-title">${flag} ${race.raceName}</div>
        <div class="race-subtitle">${formatDate(new Date(race.date + 'T12:00:00Z'))}</div>
      </div>
      <div class="podium">
        ${podiumPlace(top3[1], 2)}
        ${podiumPlace(top3[0], 1)}
        ${podiumPlace(top3[2], 3)}
      </div>
      <div class="results-list">
        ${rest.map(r => {
          const color = getColor(r.Constructor.constructorId);
          return `
            <div class="result-row">
              <span class="result-pos">${r.position}</span>
              <span class="result-name">${r.Driver.givenName[0]}. ${r.Driver.familyName}</span>
              <span class="result-team" style="color: ${color}">${r.Constructor.name}</span>
              <span class="result-time">${r.Time ? r.Time.time : r.status}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function podiumPlace(result, pos) {
  if (!result) {
    return `<div class="podium-place p${pos}"><div class="podium-info"></div><div class="podium-block"><span class="podium-pos">${pos}</span></div></div>`;
  }
  const color = getColor(result.Constructor.constructorId);
  const timeStr = pos === 1
    ? 'Winner'
    : (result.Time ? '+' + result.Time.time : result.status);

  return `
    <div class="podium-place p${pos}" style="--team-color: ${color}">
      <div class="podium-info">
        <div class="podium-driver">${result.Driver.givenName[0]}. ${result.Driver.familyName}</div>
        <div class="podium-team" style="color: ${color}">${result.Constructor.name}</div>
        <div class="podium-time">${timeStr}</div>
      </div>
      <div class="podium-block">
        <span class="podium-pos">${pos}</span>
      </div>
    </div>
  `;
}

// ─── DRIVER STANDINGS ─────────────────────────────────────────────────────────

function displayDriverStandings(drivers) {
  const container = document.getElementById('driver-standings');
  if (!drivers.length) {
    container.innerHTML = '<p class="no-data">Standings will appear after the first race</p>';
    return;
  }

  const maxPts = parseFloat(drivers[0].points) || 1;

  container.innerHTML = `
    <div class="standings-table">
      ${drivers.map((d, i) => {
        const color = getColor(d.Constructors[0].constructorId);
        const pct = Math.round((parseFloat(d.points) / maxPts) * 100);
        return `
          <div class="standing-row ${i === 0 ? 'leader' : ''}"
               style="border-left: 3px solid ${color}; background: linear-gradient(90deg, ${color}18 0%, transparent 100%);">
            <span class="s-pos">${d.position}</span>
            <div class="s-info">
              <div class="s-name">${d.Driver.givenName} ${d.Driver.familyName}</div>
              <div class="s-team" style="color: ${color}">${d.Constructors[0].name}</div>
              <div class="s-bar-track">
                <div class="s-bar-fill" style="width: ${pct}%; background: ${color};"></div>
              </div>
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
        const pct = Math.round((parseFloat(c.points) / maxPts) * 100);
        return `
          <div class="constructor-row">
            <span class="s-pos" style="color: ${color}">${c.position}</span>
            <div class="constructor-info">
              <div class="constructor-name">${c.Constructor.name}</div>
              <div class="constructor-bar-track">
                <div class="constructor-bar-fill" style="width: ${pct}%; background: ${color};"></div>
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
    container.innerHTML = '<p class="no-data">2026 schedule not yet available</p>';
    return;
  }

  const now = new Date();
  const nextRace = races.find(r => new Date(`${r.date}T${r.time || '12:00:00Z'}`) > now);
  const nextRound = nextRace?.round;

  container.innerHTML = races.map(r => {
    const raceDate = new Date(`${r.date}T${r.time || '12:00:00Z'}`);
    const isPast = raceDate < now;
    const isNext = r.round === nextRound;
    const flag = getFlag(r.Circuit.Location.country);
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

init();
