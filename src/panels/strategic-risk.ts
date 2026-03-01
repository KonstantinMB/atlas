/**
 * Strategic Risk Panel
 *
 * Displays a composite Global Strategic Risk Index (GSRI) 0–100 gauge.
 * Updates dynamically from 4 live sources:
 *   - USGS earthquakes (M4.5+)
 *   - GDACS disaster alerts
 *   - Fear & Greed index (market stress)
 *   - GDELT news event tone
 *
 * Gauge redesigned: thick arc, glow, tick marks, big number, pulsed on update.
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type {
  EarthquakeEvent,
  DisasterAlert,
  UsgsDetail,
  GdacsDetail,
  FearGreedData,
  GdeltDetail,
} from '../lib/data-service';

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

interface RiskFactor {
  label: string;
  value: string;
  color: string;
  pct: number;      // 0–100, bar fill
}

interface RiskState {
  earthquakes:  EarthquakeEvent[];
  alerts:       DisasterAlert[];
  fearGreed:    number | null;   // 0-100, lower = more fear
  gdeltTone:    number | null;   // negative = bad news
  lastUpdated:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRiskLevel(score: number): RiskLevel {
  if (score >= 76) return 'CRITICAL';
  if (score >= 56) return 'HIGH';
  if (score >= 31) return 'ELEVATED';
  return 'LOW';
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH':     return '#f97316';
    case 'ELEVATED': return '#eab308';
    case 'LOW':      return '#4ade80';
  }
}

function computeRisk(state: RiskState): { score: number; factors: RiskFactor[] } {
  let score = 40; // geopolitical baseline
  const factors: RiskFactor[] = [];

  // ── Earthquake contribution (max +25) ──────────────────────────────────────
  const sig = state.earthquakes.filter(e => e.magnitude >= 4.5);
  const maxMag = sig.reduce((m, e) => Math.max(m, e.magnitude), 0);
  const quakeContrib = Math.min(sig.length * 2 + (maxMag > 6 ? (maxMag - 6) * 10 : 0), 25);
  if (quakeContrib > 0) {
    score += quakeContrib;
    factors.push({
      label: maxMag > 6
        ? `Major earthquake M${maxMag.toFixed(1)} detected`
        : `${sig.length} earthquakes M4.5+`,
      value: `+${quakeContrib}`,
      color: maxMag > 7 ? '#ef4444' : '#f97316',
      pct: (quakeContrib / 25) * 100,
    });
  }

  // ── Disaster alerts contribution (max +20) ────────────────────────────────
  if (state.alerts.length > 0) {
    const redAlerts = state.alerts.filter(a => a.severity === 'red').length;
    const alertContrib = Math.min(state.alerts.length * 4 + redAlerts * 3, 20);
    score += alertContrib;
    factors.push({
      label: `${state.alerts.length} active disaster alerts${redAlerts ? ` (${redAlerts} critical)` : ''}`,
      value: `+${alertContrib}`,
      color: redAlerts > 0 ? '#ef4444' : '#eab308',
      pct: (alertContrib / 20) * 100,
    });
  }

  // ── Market Fear & Greed contribution (max +15) ────────────────────────────
  if (state.fearGreed !== null) {
    const fear = 100 - state.fearGreed; // invert: fear = risk
    const mktContrib = Math.round((fear / 100) * 15);
    score += mktContrib;
    const label = state.fearGreed <= 25 ? 'Extreme Fear'
      : state.fearGreed <= 40 ? 'Fear'
      : state.fearGreed >= 75 ? 'Greed (low risk)'
      : 'Neutral';
    factors.push({
      label: `Market sentiment: ${label}`,
      value: `+${mktContrib}`,
      color: state.fearGreed <= 30 ? '#ef4444' : state.fearGreed <= 50 ? '#eab308' : '#4ade80',
      pct: (mktContrib / 15) * 100,
    });
  }

  // ── GDELT news tone contribution (max +10) ────────────────────────────────
  if (state.gdeltTone !== null) {
    // Tone is negative-biased; clamp to -10..0 range → 0..10 contrib
    const toneScore = Math.max(0, Math.min(10, (-state.gdeltTone) * 0.8));
    score += Math.round(toneScore);
    if (toneScore > 0) {
      factors.push({
        label: `Global news tone: ${state.gdeltTone.toFixed(1)} (negative)`,
        value: `+${Math.round(toneScore)}`,
        color: toneScore > 6 ? '#ef4444' : '#eab308',
        pct: (toneScore / 10) * 100,
      });
    }
  }

  // ── Geopolitical standing baseline ────────────────────────────────────────
  factors.push({
    label: 'Geopolitical baseline risk',
    value: '+40',
    color: '#94a3b8',
    pct: 40,
  });

  score = Math.min(100, Math.max(0, Math.round(score)));
  return { score, factors };
}

// ── SVG Gauge ─────────────────────────────────────────────────────────────────

function buildGaugeSVG(score: number, color: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;

  // Dimensions — wide semicircle with room for score text
  const W = 240, H = 158;
  const cx = 120, cy = 116, r = 90;
  const SW = 18;   // stroke width
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('style', 'max-width:260px;display:block;overflow:visible');

  // ── Defs: glow filter ────────────────────────────────────────────────────
  const defs = document.createElementNS(ns, 'defs');

  const filter = document.createElementNS(ns, 'filter');
  filter.setAttribute('id', 'gauge-glow');
  filter.setAttribute('x', '-40%'); filter.setAttribute('y', '-40%');
  filter.setAttribute('width', '180%'); filter.setAttribute('height', '180%');
  const blur = document.createElementNS(ns, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', '4');
  blur.setAttribute('result', 'coloredBlur');
  const merge = document.createElementNS(ns, 'feMerge');
  const mn1 = document.createElementNS(ns, 'feMergeNode');
  mn1.setAttribute('in', 'coloredBlur');
  const mn2 = document.createElementNS(ns, 'feMergeNode');
  mn2.setAttribute('in', 'SourceGraphic');
  merge.appendChild(mn1); merge.appendChild(mn2);
  filter.appendChild(blur); filter.appendChild(merge);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // ── Track (full grey semicircle) ─────────────────────────────────────────
  const track = document.createElementNS(ns, 'path');
  track.setAttribute('d', `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`);
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255,255,255,0.07)');
  track.setAttribute('stroke-width', String(SW));
  track.setAttribute('stroke-linecap', 'round');
  svg.appendChild(track);

  // ── Tick marks at 25, 50, 75 (small dots on the track) ───────────────────
  const TICK_R_IN  = r - SW / 2 - 4;
  const TICK_R_OUT = r + SW / 2 + 4;
  for (const pct of [25, 50, 75]) {
    const a = (pct / 100) * Math.PI;
    const tx = cx + r * Math.cos(Math.PI - a);
    const ty = cy - r * Math.sin(Math.PI - a);
    const tick = document.createElementNS(ns, 'circle');
    tick.setAttribute('cx', tx.toFixed(2));
    tick.setAttribute('cy', ty.toFixed(2));
    tick.setAttribute('r', '3');
    tick.setAttribute('fill', 'rgba(255,255,255,0.18)');
    svg.appendChild(tick);

    // Tiny label below ticks (25, 50, 75)
    const lx_inner = cx + (TICK_R_OUT + 5) * Math.cos(Math.PI - a);
    const ly_inner = cy - (TICK_R_OUT + 5) * Math.sin(Math.PI - a);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', lx_inner.toFixed(1));
    lbl.setAttribute('y', ly_inner.toFixed(1));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('dominant-baseline', 'middle');
    lbl.setAttribute('font-size', '8');
    lbl.setAttribute('fill', 'rgba(255,255,255,0.2)');
    lbl.textContent = String(pct);
    svg.appendChild(lbl);
  }

  // ── Filled arc ───────────────────────────────────────────────────────────
  if (score > 0) {
    const angle = (score / 100) * Math.PI;
    const ex = cx + r * Math.cos(Math.PI - angle);
    const ey = cy - r * Math.sin(Math.PI - angle);
    // The fill arc is always ≤ 180° (a fraction of the semicircle track),
    // so large-arc-flag must always be 0.  Using 1 here caused the arc to
    // take the long path under the track when score > 50.
    const largeArc = 0;

    // Subtle shadow arc (slightly thicker, lower opacity)
    const shadow = document.createElementNS(ns, 'path');
    shadow.setAttribute('d', `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    shadow.setAttribute('fill', 'none');
    shadow.setAttribute('stroke', color);
    shadow.setAttribute('stroke-width', String(SW + 8));
    shadow.setAttribute('stroke-linecap', 'round');
    shadow.setAttribute('opacity', '0.12');
    svg.appendChild(shadow);

    // Main arc
    const fill = document.createElementNS(ns, 'path');
    fill.setAttribute('d', `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    fill.setAttribute('fill', 'none');
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-width', String(SW));
    fill.setAttribute('stroke-linecap', 'round');
    fill.setAttribute('filter', 'url(#gauge-glow)');
    svg.appendChild(fill);

    // Bright dot at the arc tip
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', ex.toFixed(2));
    dot.setAttribute('cy', ey.toFixed(2));
    dot.setAttribute('r', String(SW / 2 + 2));
    dot.setAttribute('fill', color);
    dot.setAttribute('filter', 'url(#gauge-glow)');
    svg.appendChild(dot);

    // White inner dot
    const dotInner = document.createElementNS(ns, 'circle');
    dotInner.setAttribute('cx', ex.toFixed(2));
    dotInner.setAttribute('cy', ey.toFixed(2));
    dotInner.setAttribute('r', '3');
    dotInner.setAttribute('fill', '#ffffff');
    dotInner.setAttribute('opacity', '0.85');
    svg.appendChild(dotInner);
  }

  // ── Score number ─────────────────────────────────────────────────────────
  // Positioned well below the arc peak (cy - r) so there's clear breathing room
  const scoreText = document.createElementNS(ns, 'text');
  scoreText.setAttribute('x', String(cx));
  scoreText.setAttribute('y', String(cy - 8));
  scoreText.setAttribute('text-anchor', 'middle');
  scoreText.setAttribute('font-size', '52');
  scoreText.setAttribute('font-weight', '800');
  scoreText.setAttribute('fill', color);
  scoreText.setAttribute('font-family', 'SF Mono, Consolas, Monaco, monospace');
  scoreText.setAttribute('filter', 'url(#gauge-glow)');
  scoreText.textContent = String(score);
  svg.appendChild(scoreText);

  // "/100" label
  const subText = document.createElementNS(ns, 'text');
  subText.setAttribute('x', String(cx));
  subText.setAttribute('y', String(cy + 14));
  subText.setAttribute('text-anchor', 'middle');
  subText.setAttribute('font-size', '11');
  subText.setAttribute('fill', 'rgba(255,255,255,0.35)');
  subText.setAttribute('font-family', 'SF Mono, Consolas, Monaco, monospace');
  subText.textContent = '/ 100';
  svg.appendChild(subText);

  // Risk level badge inside arc
  const level = getRiskLevel(score);
  const lvlText = document.createElementNS(ns, 'text');
  lvlText.setAttribute('x', String(cx));
  lvlText.setAttribute('y', String(cy + 30));
  lvlText.setAttribute('text-anchor', 'middle');
  lvlText.setAttribute('font-size', '10');
  lvlText.setAttribute('font-weight', '700');
  lvlText.setAttribute('letter-spacing', '2');
  lvlText.setAttribute('fill', color);
  lvlText.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  lvlText.textContent = level;
  svg.appendChild(lvlText);

  // 0 and 100 end labels
  const startLbl = document.createElementNS(ns, 'text');
  startLbl.setAttribute('x', String(cx - r - 4));
  startLbl.setAttribute('y', String(cy + 18));
  startLbl.setAttribute('text-anchor', 'end');
  startLbl.setAttribute('font-size', '9');
  startLbl.setAttribute('fill', 'rgba(255,255,255,0.22)');
  startLbl.textContent = '0';
  svg.appendChild(startLbl);

  const endLbl = document.createElementNS(ns, 'text');
  endLbl.setAttribute('x', String(cx + r + 4));
  endLbl.setAttribute('y', String(cy + 18));
  endLbl.setAttribute('text-anchor', 'start');
  endLbl.setAttribute('font-size', '9');
  endLbl.setAttribute('fill', 'rgba(255,255,255,0.22)');
  endLbl.textContent = '100';
  svg.appendChild(endLbl);

  return svg;
}

// ── Module-level refs ─────────────────────────────────────────────────────────

let gaugeWrapEl: HTMLElement | null = null;
let factorsBodyEl: HTMLElement | null = null;
let updatedLabelEl: HTMLElement | null = null;
let lastScore = -1;

function updateDisplay(score: number, factors: RiskFactor[]): void {
  const level = getRiskLevel(score);
  const color = getRiskColor(level);

  // Rebuild the gauge SVG
  if (gaugeWrapEl) {
    gaugeWrapEl.innerHTML = '';
    gaugeWrapEl.appendChild(buildGaugeSVG(score, color));

    // Pulse animation on change
    if (lastScore !== score) {
      gaugeWrapEl.classList.remove('risk-gauge-pulse');
      void gaugeWrapEl.offsetWidth; // reflow to restart animation
      gaugeWrapEl.classList.add('risk-gauge-pulse');
      lastScore = score;
    }
  }

  // Updated label
  if (updatedLabelEl) {
    updatedLabelEl.textContent = 'Updated just now';
    updatedLabelEl.classList.add('flash');
    setTimeout(() => updatedLabelEl?.classList.remove('flash'), 1500);
  }

  // Factors list
  if (!factorsBodyEl) return;
  factorsBodyEl.innerHTML = '';

  for (const f of factors) {
    const row = document.createElement('div');
    row.className = 'risk-factor-row';

    const top = document.createElement('div');
    top.className = 'risk-factor-top';

    const dot = document.createElement('span');
    dot.className = 'risk-factor-dot';
    dot.style.background = f.color;
    dot.style.boxShadow  = `0 0 6px ${f.color}`;

    const label = document.createElement('span');
    label.className = 'risk-factor-label';
    label.textContent = f.label;

    const val = document.createElement('span');
    val.className = 'risk-factor-val';
    val.textContent = f.value;
    val.style.color = f.color;

    top.appendChild(dot);
    top.appendChild(label);
    top.appendChild(val);

    const bar = document.createElement('div');
    bar.className = 'risk-factor-bar-outer';
    const fill = document.createElement('div');
    fill.className = 'risk-factor-bar-fill';
    fill.style.width  = `${Math.min(f.pct, 100)}%`;
    fill.style.background = f.color;
    bar.appendChild(fill);

    row.appendChild(top);
    row.appendChild(bar);
    factorsBodyEl.appendChild(row);
  }
}

// ── Live state ────────────────────────────────────────────────────────────────

const state: RiskState = {
  earthquakes: [],
  alerts:      [],
  fearGreed:   null,
  gdeltTone:   null,
  lastUpdated: 0,
};

function refresh(): void {
  state.lastUpdated = Date.now();
  const { score, factors } = computeRisk(state);
  updateDisplay(score, factors);
  if (updatedLabelEl) {
    setInterval(() => {
      const ago = Math.floor((Date.now() - state.lastUpdated) / 60_000);
      if (updatedLabelEl) {
        updatedLabelEl.textContent = ago < 1
          ? 'Updated just now'
          : `Updated ${ago}m ago`;
      }
    }, 60_000);
  }
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildRiskBody(container: HTMLElement): void {
  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'risk-info-bar';

  const infoLabel = document.createElement('span');
  infoLabel.className = 'risk-info-label';
  infoLabel.textContent = 'Global Strategic Risk Index';

  const tip = document.createElement('span');
  tip.className = 'risk-info-tooltip-trigger';
  tip.textContent = 'ⓘ';
  tip.setAttribute(
    'data-tooltip',
    'GSRI (0–100) is computed from:\n• USGS earthquakes (M4.5+)\n• GDACS disaster alerts\n• Market Fear & Greed index\n• GDELT global news tone\n• Geopolitical baseline\n\nUpdates every 5 minutes.'
  );
  infoBar.appendChild(infoLabel);
  infoBar.appendChild(tip);
  container.appendChild(infoBar);

  // Gauge wrap
  const gaugeWrap = document.createElement('div');
  gaugeWrap.className = 'risk-gauge-svg-wrap';
  gaugeWrapEl = gaugeWrap;
  container.appendChild(gaugeWrap);

  // Updated timestamp
  const updatedLabel = document.createElement('div');
  updatedLabel.className = 'risk-updated-label';
  updatedLabel.textContent = 'Waiting for data…';
  updatedLabelEl = updatedLabel;
  container.appendChild(updatedLabel);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'risk-divider';
  container.appendChild(divider);

  // Factors section
  const factorsHdr = document.createElement('div');
  factorsHdr.className = 'risk-factors-label';
  factorsHdr.textContent = 'Contributing Factors';
  container.appendChild(factorsHdr);

  const factorsBody = document.createElement('div');
  factorsBody.className = 'risk-factors-body';
  factorsBodyEl = factorsBody;
  container.appendChild(factorsBody);

  // Data sources row
  const sourcesRow = document.createElement('div');
  sourcesRow.className = 'risk-data-sources';

  const sources = [
    { label: 'USGS', id: 'ds-usgs', active: false },
    { label: 'GDACS', id: 'ds-gdacs', active: false },
    { label: 'F&G', id: 'ds-fg', active: false },
    { label: 'GDELT', id: 'ds-gdelt', active: false },
  ];
  for (const s of sources) {
    const badge = document.createElement('span');
    badge.id = s.id;
    badge.className = `risk-source-badge${s.active ? ' active' : ''}`;
    badge.textContent = s.label;
    sourcesRow.appendChild(badge);
  }
  container.appendChild(sourcesRow);

  function activateSource(id: string): void {
    document.getElementById(id)?.classList.add('active');
  }

  // ── Bootstrap with initial render (shows baseline score immediately) ──────
  const { score: initScore, factors: initFactors } = computeRisk(state);
  updateDisplay(initScore, initFactors);

  // ── Live data listeners ───────────────────────────────────────────────────
  dataService.addEventListener('usgs', (e: Event) => {
    state.earthquakes = (e as CustomEvent<UsgsDetail>).detail.events;
    activateSource('ds-usgs');
    refresh();
  });

  dataService.addEventListener('gdacs', (e: Event) => {
    state.alerts = (e as CustomEvent<GdacsDetail>).detail.alerts;
    activateSource('ds-gdacs');
    refresh();
  });

  dataService.addEventListener('fear-greed', (e: Event) => {
    state.fearGreed = (e as CustomEvent<FearGreedData>).detail.value;
    activateSource('ds-fg');
    refresh();
  });

  dataService.addEventListener('gdelt', (e: Event) => {
    const events = (e as CustomEvent<GdeltDetail>).detail.events;
    if (events.length > 0) {
      const tones = events.map(ev => ev.tone).filter((t): t is number => t !== null);
      state.gdeltTone = tones.length > 0
        ? tones.reduce((a, b) => a + b, 0) / tones.length
        : null;
      activateSource('ds-gdelt');
      refresh();
    }
  });

  // Apply already-loaded data
  const usgs = dataService.getUsgs();
  if (usgs) { state.earthquakes = usgs.events; activateSource('ds-usgs'); }

  const gdacs = dataService.getGdacs();
  if (gdacs) { state.alerts = gdacs.alerts; activateSource('ds-gdacs'); }

  const fg = dataService.getFearGreed();
  if (fg) { state.fearGreed = fg.value; activateSource('ds-fg'); }

  const gdelt = dataService.getGdelt();
  if (gdelt?.events.length) {
    const tones = gdelt.events.map(ev => ev.tone).filter((t): t is number => t !== null);
    state.gdeltTone = tones.length > 0 ? tones.reduce((a, b) => a + b, 0) / tones.length : null;
    activateSource('ds-gdelt');
  }

  if (usgs || gdacs || fg || gdelt) refresh();
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initStrategicRiskPanel(): void {
  registerPanel({
    id: 'strategic-risk',
    title: 'Strategic Risk',
    defaultCollapsed: false,
    init: buildRiskBody,
  });
}
