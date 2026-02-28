/**
 * Strategic Risk Panel
 * Displays a composite global risk gauge (0–100) with contributing factors.
 * Shows mock score initially; updates with live USGS + GDACS data when available.
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { EarthquakeEvent, DisasterAlert, UsgsDetail, GdacsDetail } from '../lib/data-service';

type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

interface RiskFactor {
  label: string;
  color: string;
}

const INITIAL_SCORE = 62;

const INITIAL_FACTORS: RiskFactor[] = [
  { label: '3 active conflict zones', color: 'var(--status-critical)' },
  { label: 'Market volatility elevated', color: 'var(--status-medium)' },
  { label: '2 military exercises active', color: 'var(--status-high)' },
];

// ── Risk helpers ───────────────────────────────────────────────────────────────

function getRiskLevel(score: number): RiskLevel {
  if (score >= 76) return 'CRITICAL';
  if (score >= 56) return 'HIGH';
  if (score >= 31) return 'ELEVATED';
  return 'LOW';
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'var(--status-critical)';
    case 'HIGH':     return 'var(--status-high)';
    case 'ELEVATED': return 'var(--status-medium)';
    case 'LOW':      return 'var(--status-low)';
  }
}

function computeRiskScore(
  earthquakes: EarthquakeEvent[],
  alerts: DisasterAlert[]
): { score: number; factors: RiskFactor[] } {
  let score = 50; // base
  const factors: RiskFactor[] = [];

  // Earthquake contribution
  if (earthquakes.length >= 5) {
    score += 10;
    factors.push({
      label: `${earthquakes.length} active earthquakes (M4.5+)`,
      color: 'var(--status-high)',
    });
  }

  const maxMag = earthquakes.reduce((m, e) => Math.max(m, e.magnitude), 0);
  if (maxMag > 7) {
    score += 15;
    factors.push({
      label: `Major earthquake M${maxMag.toFixed(1)} detected`,
      color: 'var(--status-critical)',
    });
  } else if (maxMag > 6) {
    score += 8;
    factors.push({
      label: `Strong earthquake M${maxMag.toFixed(1)} detected`,
      color: 'var(--status-high)',
    });
  }

  // Disaster alerts contribution (capped at +20)
  const alertContrib = Math.min(alerts.length * 5, 20);
  if (alerts.length > 0) {
    score += alertContrib;
    const redAlerts = alerts.filter((a) => a.severity === 'red').length;
    factors.push({
      label: `${alerts.length} active disaster alerts${redAlerts > 0 ? ` (${redAlerts} critical)` : ''}`,
      color: redAlerts > 0 ? 'var(--status-critical)' : 'var(--status-medium)',
    });
  }

  // Add standing factors that always apply
  factors.push({ label: 'Geopolitical baseline risk', color: 'var(--status-medium)' });

  score = Math.min(100, Math.max(0, score));
  return { score, factors };
}

// ── SVG gauge ─────────────────────────────────────────────────────────────────

function buildGaugeSVG(score: number, color: string): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', '0 0 120 70');
  svg.setAttribute('xmlns', ns);
  svg.style.width = '100%';
  svg.style.maxWidth = '180px';
  svg.style.overflow = 'visible';

  // Background arc (grey track)
  const track = document.createElementNS(ns, 'path');
  track.setAttribute('d', 'M 10 65 A 50 50 0 0 1 110 65');
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255,255,255,0.08)');
  track.setAttribute('stroke-width', '8');
  track.setAttribute('stroke-linecap', 'round');
  svg.appendChild(track);

  // Filled arc proportional to score (0–100 maps to 0–π)
  const angle = (score / 100) * Math.PI;
  const cx = 60, cy = 65, r = 50;
  const x = cx + r * Math.cos(Math.PI - angle);
  const y = cy - r * Math.sin(Math.PI - angle);
  const largeArc = angle > Math.PI / 2 ? 1 : 0;

  const fill = document.createElementNS(ns, 'path');
  fill.setAttribute('d', `M 10 65 A 50 50 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', color);
  fill.setAttribute('stroke-width', '8');
  fill.setAttribute('stroke-linecap', 'round');
  svg.appendChild(fill);

  // Score label
  const scoreText = document.createElementNS(ns, 'text');
  scoreText.setAttribute('x', '60');
  scoreText.setAttribute('y', '62');
  scoreText.setAttribute('text-anchor', 'middle');
  scoreText.setAttribute('font-size', '18');
  scoreText.setAttribute('font-weight', '700');
  scoreText.setAttribute('fill', color);
  scoreText.setAttribute('font-family', 'SF Mono, Monaco, monospace');
  scoreText.textContent = String(score);
  svg.appendChild(scoreText);

  // Min/max labels
  const minLabel = document.createElementNS(ns, 'text');
  minLabel.setAttribute('x', '8');
  minLabel.setAttribute('y', '70');
  minLabel.setAttribute('text-anchor', 'middle');
  minLabel.setAttribute('font-size', '8');
  minLabel.setAttribute('fill', 'rgba(255,255,255,0.3)');
  minLabel.textContent = '0';
  svg.appendChild(minLabel);

  const maxLabel = document.createElementNS(ns, 'text');
  maxLabel.setAttribute('x', '112');
  maxLabel.setAttribute('y', '70');
  maxLabel.setAttribute('text-anchor', 'middle');
  maxLabel.setAttribute('font-size', '8');
  maxLabel.setAttribute('fill', 'rgba(255,255,255,0.3)');
  maxLabel.textContent = '100';
  svg.appendChild(maxLabel);

  return svg as unknown as SVGElement;
}

// ── Module-level references for live updates ──────────────────────────────────

let gaugeWrapEl: HTMLElement | null = null;
let levelDisplayEl: HTMLElement | null = null;
let barFillEl: HTMLElement | null = null;
let factorsListEl: HTMLElement | null = null;

function updateRiskDisplay(score: number, factors: RiskFactor[]): void {
  const level = getRiskLevel(score);
  const color = getRiskColor(level);

  if (gaugeWrapEl) {
    gaugeWrapEl.innerHTML = '';
    gaugeWrapEl.appendChild(buildGaugeSVG(score, color));
  }

  if (levelDisplayEl) {
    levelDisplayEl.textContent = level;
    levelDisplayEl.style.color = color;
  }

  if (barFillEl) {
    barFillEl.style.width = `${score}%`;
    barFillEl.style.background = color;
  }

  if (factorsListEl) {
    factorsListEl.innerHTML = '';
    factors.forEach(({ label, color: dotColor }) => {
      const row = document.createElement('div');
      row.className = 'risk-factor';

      const dot = document.createElement('span');
      dot.className = 'risk-factor-dot';
      dot.style.background = dotColor;

      const text = document.createElement('span');
      text.textContent = label;

      row.appendChild(dot);
      row.appendChild(text);
      factorsListEl!.appendChild(row);
    });
  }
}

// Accumulate data from both sources before recomputing
let latestEarthquakes: EarthquakeEvent[] = [];
let latestAlerts: DisasterAlert[] = [];

function recomputeAndUpdate(): void {
  const { score, factors } = computeRiskScore(latestEarthquakes, latestAlerts);
  updateRiskDisplay(score, factors);
}

// ── Panel body ─────────────────────────────────────────────────────────────────

function buildRiskBody(container: HTMLElement): void {
  const level = getRiskLevel(INITIAL_SCORE);
  const color = getRiskColor(level);

  // Info bar with tooltip explaining the index
  const infoBar = document.createElement('div');
  infoBar.className = 'risk-info-bar';

  const infoLabel = document.createElement('span');
  infoLabel.className = 'risk-info-label';
  infoLabel.textContent = 'Global Strategic Risk Index';

  const tooltipTrigger = document.createElement('span');
  tooltipTrigger.className = 'risk-info-tooltip-trigger';
  tooltipTrigger.textContent = 'ⓘ';
  tooltipTrigger.setAttribute(
    'data-tooltip',
    'The Global Strategic Risk Index (GSRI) is a composite 0-100 score computed from:\n• Active USGS earthquakes (M4.5+)\n• GDACS disaster alerts\n• Active conflict zones in intelligence feed\n• Market volatility indicators\n\nUpdated every 5 minutes from live data feeds.'
  );

  infoBar.appendChild(infoLabel);
  infoBar.appendChild(tooltipTrigger);
  container.appendChild(infoBar);

  const wrapper = document.createElement('div');
  wrapper.className = 'risk-gauge-container';

  // SVG gauge
  const gaugeWrap = document.createElement('div');
  gaugeWrap.className = 'risk-gauge-svg-wrap';
  gaugeWrap.appendChild(buildGaugeSVG(INITIAL_SCORE, color));
  gaugeWrapEl = gaugeWrap;
  wrapper.appendChild(gaugeWrap);

  // Risk level label
  const levelDisplay = document.createElement('div');
  levelDisplay.className = 'risk-level-display';
  levelDisplay.textContent = level;
  levelDisplay.style.color = color;
  levelDisplayEl = levelDisplay;
  wrapper.appendChild(levelDisplay);

  // Subtitle
  const subtitle = document.createElement('div');
  subtitle.className = 'risk-subtitle';
  subtitle.textContent = 'Global Strategic Risk Index';
  wrapper.appendChild(subtitle);

  // Horizontal bar
  const bar = document.createElement('div');
  bar.className = 'risk-bar';

  const barFill = document.createElement('div');
  barFill.className = 'risk-bar-fill';
  barFill.style.width = `${INITIAL_SCORE}%`;
  barFill.style.background = color;
  bar.appendChild(barFill);
  barFillEl = barFill;
  wrapper.appendChild(bar);

  // Contributing factors
  const factorsLabel = document.createElement('div');
  factorsLabel.className = 'risk-factors-label';
  factorsLabel.textContent = 'Contributing Factors';
  wrapper.appendChild(factorsLabel);

  const factors = document.createElement('div');
  factors.className = 'risk-factors';
  factorsListEl = factors;

  INITIAL_FACTORS.forEach(({ label, color: dotColor }) => {
    const row = document.createElement('div');
    row.className = 'risk-factor';

    const dot = document.createElement('span');
    dot.className = 'risk-factor-dot';
    dot.style.background = dotColor;

    const text = document.createElement('span');
    text.textContent = label;

    row.appendChild(dot);
    row.appendChild(text);
    factors.appendChild(row);
  });

  wrapper.appendChild(factors);
  container.appendChild(wrapper);

  // Data sources badge row
  const sourcesRow = document.createElement('div');
  sourcesRow.className = 'risk-data-sources';

  const dataSources: Array<{ label: string; active: boolean }> = [
    { label: 'USGS', active: true },
    { label: 'GDACS', active: true },
    { label: 'ACLED', active: false },
    { label: 'MARKET', active: true },
  ];

  dataSources.forEach(({ label, active }) => {
    const badge = document.createElement('span');
    badge.className = `risk-source-badge${active ? ' active' : ''}`;
    badge.textContent = label;
    sourcesRow.appendChild(badge);
  });

  container.appendChild(sourcesRow);

  // ── Live data listeners ──────────────────────────────────────────────────────

  dataService.addEventListener('usgs', (e: Event) => {
    const { detail } = e as CustomEvent<UsgsDetail>;
    latestEarthquakes = detail.events;
    recomputeAndUpdate();
  });

  dataService.addEventListener('gdacs', (e: Event) => {
    const { detail } = e as CustomEvent<GdacsDetail>;
    latestAlerts = detail.alerts;
    recomputeAndUpdate();
  });

  // Apply pre-loaded data if available
  const existingUsgs = dataService.getUsgs();
  if (existingUsgs) {
    latestEarthquakes = existingUsgs.events;
    recomputeAndUpdate();
  }

  const existingGdacs = dataService.getGdacs();
  if (existingGdacs) {
    latestAlerts = existingGdacs.alerts;
    recomputeAndUpdate();
  }
}

export function initStrategicRiskPanel(): void {
  registerPanel({
    id: 'strategic-risk',
    title: 'Strategic Risk',
    defaultCollapsed: false,
    init: buildRiskBody,
  });
}
