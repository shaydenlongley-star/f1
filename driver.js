'use strict';

const BASE = 'https://api.jolpi.ca/ergast/f1/';

const TEAM_COLORS = {
  red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2',
  mclaren: '#FF8000', aston_martin: '#229971', alpine: '#FF87BC',
  williams: '#64C4FF', rb: '#6692FF', haas: '#B6BABD',
  sauber: '#52E252', kick_sauber: '#52E252', audi: '#C0392B',
};

const COUNTRY_ISO = {
  'Australia': 'au', 'China': 'cn', 'Japan': 'jp', 'Bahrain': 'bh',
  'Saudi Arabia': 'sa', 'USA': 'us', 'United States': 'us', 'Italy': 'it',
  'Monaco': 'mc', 'Canada': 'ca', 'Spain': 'es', 'Austria': 'at',
  'UK': 'gb', 'United Kingdom': 'gb', 'Hungary': 'hu', 'Belgium': 'be',
  'Netherlands': 'nl', 'Azerbaijan': 'az', 'Singapore': 'sg',
  'Mexico': 'mx', 'Brazil': 'br', 'UAE': 'ae', 'Qatar': 'qa', 'Abu Dhabi': 'ae',
  // Historical seasons
  'France': 'fr', 'Germany': 'de', 'Russia': 'ru',
  'Portugal': 'pt', 'Turkey': 'tr', 'Vietnam': 'vn',
  'Korea': 'kr', 'India': 'in', 'Malaysia': 'my',
  'South Africa': 'za', 'Argentina': 'ar', 'Sweden': 'se',
};

function getColor(id) { return TEAM_COLORS[id] || '#888888'; }
function getFlag(country) {
  const c = COUNTRY_ISO[country];
  return c ? `<img class="flag-img" src="flags/${c}.png" alt="${country}" loading="lazy">` : '';
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const driverId = params.get('id');
  const year     = params.get('year') || '2025';

  if (!driverId) {
    document.getElementById('driver-name').textContent = 'No driver specified';
    return;
  }

  const apiYear = year === '2026' ? 'current' : year;

  try {
    const data = await fetch(`${BASE}${apiYear}/drivers/${driverId}/results.json?limit=30`).then(r => r.json());
    const races = data.MRData?.RaceTable?.Races || [];

    if (!races.length) {
      document.getElementById('driver-name').textContent = 'No data found';
      return;
    }

    // Get driver + team info from first race result
    const firstResult = races[0].Results[0];
    const driver      = firstResult.Driver;
    const lastTeam    = races[races.length - 1].Results[0].Constructor;
    const teamColor   = getColor(lastTeam.constructorId);

    // Update header
    document.title = `${driver.givenName} ${driver.familyName} · F1 ${year}`;
    document.getElementById('driver-number').textContent = driver.permanentNumber || '—';
    document.getElementById('driver-name').textContent = `${driver.givenName} ${driver.familyName}`;
    document.getElementById('driver-subtitle').textContent = `${lastTeam.name} · ${year} Season`;

    // Apply team colour to header
    const header = document.getElementById('driver-header');
    header.style.background = `linear-gradient(135deg, #0d0d1a 0%, ${teamColor}33 60%, ${teamColor}55 100%)`;
    header.style.borderBottomColor = teamColor;
    document.getElementById('driver-number').style.color = teamColor;
    document.getElementById('driver-number').style.opacity = '1';

    // Compute season stats
    const allResults = races.map(r => r.Results[0]);
    const totalPoints = allResults.reduce((sum, r) => sum + parseFloat(r.points || 0), 0);
    const wins    = allResults.filter(r => r.position === '1').length;
    const podiums = allResults.filter(r => parseInt(r.position) <= 3).length;
    const dnfs    = allResults.filter(r => r.status !== 'Finished' && !r.status.includes('Lap')).length;
    const positions = allResults.map(r => parseInt(r.position)).filter(p => !isNaN(p));
    const bestFinish = positions.length ? Math.min(...positions) : '—';

    displayStats({ totalPoints, wins, podiums, dnfs, bestFinish, races: races.length }, teamColor);
    displayResults(races, teamColor);

  } catch (err) {
    document.getElementById('driver-name').textContent = 'Failed to load driver data';
    console.error(err);
  }
}

const TROPHY_SVG = `<svg class="trophy-icon" xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`;

function displayStats(stats, teamColor) {
  const container = document.getElementById('driver-stats');
  const isP1 = stats.bestFinish === 1;
  const items = [
    { label: 'Points',      value: stats.totalPoints,                                        color: '#fff' },
    { label: 'Wins',        value: stats.wins,                                               color: stats.wins > 0 ? '#FFD700' : '#fff' },
    { label: 'Podiums',     value: stats.podiums,                                            color: '#fff' },
    { label: 'DNFs',        value: stats.dnfs,                                               color: '#fff' },
    { label: 'Best Finish', value: isP1 ? `${TROPHY_SVG} P1` : `P${stats.bestFinish}`,      color: isP1 ? '#FFD700' : '#fff' },
    { label: 'Races',       value: stats.races,                                              color: '#fff' },
  ];

  container.innerHTML = `
    <div class="driver-stat-grid">
      ${items.map(item => `
        <div class="driver-stat-card" style="border-color: ${teamColor}30">
          <div class="driver-stat-value" style="color: ${item.color}">${item.value}</div>
          <div class="driver-stat-label">${item.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function displayResults(races, teamColor) {
  const container = document.getElementById('driver-results');

  container.innerHTML = `
    <div class="results-section-title">Race by Race · ${races[0]?.season || ''}</div>
    <div class="race-results-table">
      ${races.map(race => {
        const r      = race.Results[0];
        const pos    = parseInt(r.position);
        const isDNF  = r.status !== 'Finished' && !r.status.includes('Lap');
        const isWin  = pos === 1;
        const hasFl  = r.FastestLap?.rank === '1';
        const flag   = getFlag(race.Circuit.Location.country);

        let posClass = 'none';
        if (isDNF)      posClass = 'dnf';
        else if (pos === 1) posClass = 'p1';
        else if (pos === 2) posClass = 'p2';
        else if (pos === 3) posClass = 'p3';
        else if (pos <= 10) posClass = 'pts';

        const posDisplay = isDNF ? 'DNF' : `P${pos}`;

        return `
          <div class="rr-row ${isWin ? 'win' : ''} ${isDNF ? 'dnf' : ''}">
            <span class="rr-round">R${race.round}</span>
            <span class="rr-race">${flag} ${race.raceName}</span>
            <span class="rr-grid">P${r.grid} →</span>
            <span class="rr-pos ${posClass}">${posDisplay}</span>
            <span class="rr-pts">${r.points} pts</span>
            ${hasFl ? '<span class="rr-fl">FL</span>' : '<span></span>'}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

init();
