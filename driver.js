'use strict';

const BASE = 'https://api.jolpi.ca/ergast/f1/';

const TEAM_COLORS = {
  red_bull: '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2',
  mclaren: '#FF8000', aston_martin: '#229971', alpine: '#FF87BC',
  williams: '#64C4FF', rb: '#6692FF', haas: '#B6BABD',
  sauber: '#52E252', kick_sauber: '#52E252', audi: '#C0392B',
};

const FLAGS = {
  'Australia': '🇦🇺', 'China': '🇨🇳', 'Japan': '🇯🇵', 'Bahrain': '🇧🇭',
  'Saudi Arabia': '🇸🇦', 'USA': '🇺🇸', 'United States': '🇺🇸', 'Italy': '🇮🇹',
  'Monaco': '🇲🇨', 'Canada': '🇨🇦', 'Spain': '🇪🇸', 'Austria': '🇦🇹',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'Hungary': '🇭🇺', 'Belgium': '🇧🇪',
  'Netherlands': '🇳🇱', 'Azerbaijan': '🇦🇿', 'Singapore': '🇸🇬',
  'Mexico': '🇲🇽', 'Brazil': '🇧🇷', 'UAE': '🇦🇪', 'Qatar': '🇶🇦', 'Abu Dhabi': '🇦🇪',
};

function getColor(id) { return TEAM_COLORS[id] || '#888888'; }
function getFlag(c) { return FLAGS[c] || '🏁'; }

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

function displayStats(stats, teamColor) {
  const container = document.getElementById('driver-stats');
  const items = [
    { label: 'Points',      value: stats.totalPoints },
    { label: 'Wins',        value: stats.wins },
    { label: 'Podiums',     value: stats.podiums },
    { label: 'DNFs',        value: stats.dnfs },
    { label: 'Best Finish', value: stats.bestFinish === 1 ? '🏆 P1' : `P${stats.bestFinish}` },
    { label: 'Races',       value: stats.races },
  ];

  container.innerHTML = `
    <div class="driver-stat-grid">
      ${items.map(item => `
        <div class="driver-stat-card" style="border-color: ${teamColor}30">
          <div class="driver-stat-value" style="color: ${item.label === 'Wins' && item.value > 0 ? '#FFD700' : '#fff'}">${item.value}</div>
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
