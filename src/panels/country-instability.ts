/**
 * Country Instability Panel
 * Displays Country Instability Index (CII) rankings.
 * Shows mock data on load; updates to live CII scores when the intelligence engine fires.
 */

import { registerPanel } from './panel-manager';
import { ciiEngine } from '../intelligence/instability';

type Trend = '↑' | '↓' | '→';

interface InstabilityEntry {
  rank: number;
  country: string;
  region: string;
  score: number;
  trend: Trend;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const ISO2_TO_NAME: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola', AR: 'Argentina',
  AM: 'Armenia', AU: 'Australia', AZ: 'Azerbaijan', BH: 'Bahrain', BD: 'Bangladesh',
  BY: 'Belarus', BO: 'Bolivia', BR: 'Brazil', BF: 'Burkina Faso', BI: 'Burundi',
  CM: 'Cameroon', CF: 'C. African Rep.', TD: 'Chad', CL: 'Chile', CN: 'China',
  CO: 'Colombia', CD: 'DR Congo', CR: 'Costa Rica', CU: 'Cuba', CY: 'Cyprus',
  EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', ET: 'Ethiopia', FJ: 'Fiji',
  FR: 'France', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece',
  GT: 'Guatemala', GN: 'Guinea', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras',
  IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IL: 'Israel',
  IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan',
  KE: 'Kenya', KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KG: 'Kyrgyzstan',
  LA: 'Laos', LB: 'Lebanon', LY: 'Libya', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaysia', ML: 'Mali', MX: 'Mexico', MD: 'Moldova', MN: 'Mongolia',
  MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NP: 'Nepal', NI: 'Nicaragua',
  NE: 'Niger', NG: 'Nigeria', PK: 'Pakistan', PA: 'Panama', PY: 'Paraguay',
  PE: 'Peru', PH: 'Philippines', QA: 'Qatar', RU: 'Russia', SA: 'Saudi Arabia',
  SN: 'Senegal', SO: 'Somalia', ZA: 'South Africa', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan', TH: 'Thailand',
  TT: 'Trinidad', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan', UA: 'Ukraine',
  UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen',
  ZM: 'Zambia', ZW: 'Zimbabwe', US: 'United States', GB: 'United Kingdom',
};

const ISO2_TO_REGION: Record<string, string> = {
  AF: 'C. Asia', AL: 'Europe', DZ: 'N. Africa', AO: 'S. Africa', AR: 'S. America',
  AM: 'Caucasus', AZ: 'Caucasus', BH: 'Middle East', BD: 'S. Asia', BY: 'E. Europe',
  BO: 'S. America', BR: 'S. America', BF: 'W. Africa', CM: 'W. Africa', CF: 'C. Africa',
  TD: 'C. Africa', CL: 'S. America', CN: 'E. Asia', CO: 'S. America', CD: 'C. Africa',
  CU: 'Caribbean', EC: 'S. America', EG: 'N. Africa', ET: 'E. Africa', GH: 'W. Africa',
  GT: 'C. America', GN: 'W. Africa', HT: 'Caribbean', HN: 'C. America', IN: 'S. Asia',
  ID: 'SE Asia', IR: 'Middle East', IQ: 'Middle East', IL: 'Middle East',
  JP: 'E. Asia', JO: 'Middle East', KZ: 'C. Asia', KE: 'E. Africa', KP: 'E. Asia',
  KR: 'E. Asia', KW: 'Middle East', KG: 'C. Asia', LA: 'SE Asia', LB: 'Middle East',
  LY: 'N. Africa', ML: 'W. Africa', MX: 'N. America', MM: 'SE Asia', MA: 'N. Africa',
  MZ: 'E. Africa', NP: 'S. Asia', NI: 'C. America', NE: 'W. Africa', NG: 'W. Africa',
  PK: 'S. Asia', PE: 'S. America', PH: 'SE Asia', QA: 'Middle East', RU: 'E. Europe',
  SA: 'Middle East', SO: 'E. Africa', ZA: 'S. Africa', LK: 'S. Asia', SD: 'E. Africa',
  SY: 'Middle East', TW: 'E. Asia', TH: 'SE Asia', TN: 'N. Africa', TR: 'Middle East',
  UA: 'E. Europe', UZ: 'C. Asia', VE: 'S. America', VN: 'SE Asia', YE: 'Middle East',
  ZW: 'S. Africa', US: 'N. America', GB: 'W. Europe',
};

// ── Fallback mock data (shown while intelligence engine warms up) ──────────────

const MOCK_DATA: InstabilityEntry[] = [
  { rank: 1, country: 'Syria',       region: 'Middle East', score: 89.2, trend: '↑' },
  { rank: 2, country: 'Sudan',       region: 'Africa',      score: 84.7, trend: '↑' },
  { rank: 3, country: 'Yemen',       region: 'Middle East', score: 82.1, trend: '→' },
  { rank: 4, country: 'Myanmar',     region: 'SE Asia',     score: 78.4, trend: '↑' },
  { rank: 5, country: 'Haiti',       region: 'Caribbean',   score: 75.3, trend: '↑' },
  { rank: 6, country: 'Mali',        region: 'W. Africa',   score: 71.9, trend: '→' },
  { rank: 7, country: 'Afghanistan', region: 'C. Asia',     score: 70.2, trend: '↓' },
  { rank: 8, country: 'Ethiopia',    region: 'E. Africa',   score: 68.8, trend: '↑' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScoreClass(score: number): string {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function getTrendClass(trend: Trend): string {
  if (trend === '↑') return 'trend-up';
  if (trend === '↓') return 'trend-down';
  return 'trend-neutral';
}

function trendArrow(trend: 'rising' | 'falling' | 'stable'): Trend {
  if (trend === 'rising') return '↑';
  if (trend === 'falling') return '↓';
  return '→';
}

function buildInstabilityItem(entry: InstabilityEntry): HTMLElement {
  const el = document.createElement('div');
  el.className = 'instability-item';

  const rank = document.createElement('span');
  rank.className = 'instability-rank';
  rank.textContent = String(entry.rank);

  const countryBlock = document.createElement('div');
  countryBlock.className = 'instability-country';

  const name = document.createElement('div');
  name.className = 'instability-name';
  name.textContent = entry.country;

  const region = document.createElement('div');
  region.className = 'instability-region';
  region.textContent = entry.region;

  countryBlock.appendChild(name);
  countryBlock.appendChild(region);

  const scoreEl = document.createElement('span');
  scoreEl.className = `instability-score ${getScoreClass(entry.score)} mono`;
  scoreEl.textContent = entry.score.toFixed(1);

  const trendEl = document.createElement('span');
  trendEl.className = `instability-trend ${getTrendClass(entry.trend)}`;
  trendEl.textContent = entry.trend;

  el.appendChild(rank);
  el.appendChild(countryBlock);
  el.appendChild(scoreEl);
  el.appendChild(trendEl);

  return el;
}

function renderList(listEl: HTMLElement, entries: InstabilityEntry[]): void {
  listEl.innerHTML = '';
  entries.forEach(entry => listEl.appendChild(buildInstabilityItem(entry)));
}

// ── Panel init ────────────────────────────────────────────────────────────────

function buildInstabilityBody(container: HTMLElement): void {
  // Column headers
  const header = document.createElement('div');
  header.className = 'instability-col-header';

  const rankLabel = document.createElement('span');
  rankLabel.textContent = '#';
  const countryLabel = document.createElement('span');
  countryLabel.textContent = 'Country';
  const scoreLabel = document.createElement('span');
  scoreLabel.textContent = 'CII';
  const trendLabel = document.createElement('span');
  trendLabel.textContent = '';

  header.appendChild(rankLabel);
  header.appendChild(countryLabel);
  header.appendChild(scoreLabel);
  header.appendChild(trendLabel);
  container.appendChild(header);

  // Status bar (last computed timestamp)
  const statusBar = document.createElement('div');
  statusBar.className = 'instability-status';
  statusBar.style.cssText = 'font-size:10px;color:var(--text-muted);padding:2px 8px 4px;';
  statusBar.textContent = 'Showing baseline data — live scores loading…';
  container.appendChild(statusBar);

  // Data list
  const list = document.createElement('div');
  list.className = 'instability-list';
  renderList(list, MOCK_DATA);
  container.appendChild(list);

  // ── Listen for live CII updates ─────────────────────────────────────────────
  let lastComputedAt = 0;

  window.addEventListener('cii-updated', () => {
    const top8 = ciiEngine.getTopN(8);
    if (top8.length === 0) return; // keep mock until we have real data

    lastComputedAt = Date.now();

    const entries: InstabilityEntry[] = top8.map((s, i) => ({
      rank: i + 1,
      country: ISO2_TO_NAME[s.country] ?? s.country,
      region: ISO2_TO_REGION[s.country] ?? s.country,
      score: s.score,
      trend: trendArrow(s.trend),
    }));

    renderList(list, entries);
    statusBar.textContent = `Live • Last computed: just now`;
  });

  // Keep the "X seconds ago" label ticking
  setInterval(() => {
    if (lastComputedAt === 0) return;
    const secs = Math.round((Date.now() - lastComputedAt) / 1000);
    statusBar.textContent = `Live • Last computed: ${secs}s ago`;
  }, 5_000);
}

export function initInstabilityPanel(): void {
  registerPanel({
    id: 'country-instability',
    title: 'Country Instability Index',
    defaultCollapsed: true,
    init: buildInstabilityBody,
  });
}
