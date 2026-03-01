/**
 * Performance Panel — Phase 4e Part 3
 *
 * Equity curve SVG + drawdown chart + full metrics table + monthly heatmap
 * + per-strategy breakdown + CSV export.
 *
 * Data sources (priority order):
 *   1. 'trading:performance' → PerformanceMetrics (StateSync, live)
 *   2. portfolioManager.getSnapshot() + getEquityCurve() (on panel init)
 *   3. Synthetic 252-day mock curve (always shown immediately)
 *
 * Charts are pure SVG — no external chart library.
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { portfolioManager } from '../trading/engine/portfolio-manager';
import { calculatePerformance } from '../trading/engine/performance';
import type { PerformanceMetrics, StrategyStats } from '../trading/engine/performance';
import type { EquityPoint } from '../trading/engine/portfolio-manager';

// ── Seeded PRNG (LCG) for deterministic mock data ─────────────────────────────

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

function boxMuller(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Mock curve generation (252 trading days) ─────────────────────────────────

interface MockCurve {
  atlas: EquityPoint[];
  spy: number[];             // SPY level values parallel to atlas
}

function genMockCurve(): MockCurve {
  const rng   = makeLcg(0xdeadbeef);
  const DAYS  = 252;
  const now   = Date.now();
  const start = now - DAYS * 24 * 3600 * 1000;

  const atlas: EquityPoint[] = [];
  const spy:   number[]      = [];

  let atlasVal  = 1_000_000;
  let spyVal    = 1_000_000;
  let realized  = 0;

  for (let i = 0; i < DAYS; i++) {
    const z1 = boxMuller(rng);
    const z2 = 0.65 * z1 + 0.35 * boxMuller(rng); // correlated but not identical

    atlasVal *= (1 + 0.00055 + 0.012 * z1);   // ~14% annual, 19% vol
    spyVal   *= (1 + 0.00038 + 0.009 * z2);   // ~10% annual, 14% vol

    // Simulate some realized gains building up
    if (i % 30 === 29) {
      const chunk = (atlasVal - 1_000_000 - realized) * 0.25;
      realized += chunk;
    }

    atlas.push({
      timestamp:    start + i * 24 * 3600 * 1000,
      totalValue:   atlasVal,
      cash:         atlasVal * 0.18,
      unrealizedPnl: atlasVal - 1_000_000 - realized,
      realizedPnl:  realized,
    });
    spy.push(spyVal);
  }

  return { atlas, spy };
}

// ── SVG chart helpers ──────────────────────────────────────────────────────────

interface Margin { top: number; right: number; bottom: number; left: number }

interface PlotPoint { x: number; y: number }

function mapToSvg(
  values: number[],
  timestamps: number[],
  vb: { w: number; h: number },
  m: Margin,
  yMin: number,
  yMax: number
): PlotPoint[] {
  const n     = values.length;
  if (n === 0) return [];
  const tMin  = timestamps[0]!;
  const tMax  = timestamps[n - 1]!;
  const tRange = Math.max(tMax - tMin, 1);
  const yRange = Math.max(yMax - yMin, 1);
  const plotW  = vb.w - m.left - m.right;
  const plotH  = vb.h - m.top  - m.bottom;

  return values.map((v, i) => ({
    x: m.left + ((timestamps[i]! - tMin) / tRange) * plotW,
    y: m.top  + (1 - (v - yMin) / yRange) * plotH,
  }));
}

function svgLine(pts: PlotPoint[]): string {
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function svgArea(pts: PlotPoint[], baseline: number): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  const last  = pts[pts.length - 1]!;
  return `${svgLine(pts)} L${last.x.toFixed(1)},${baseline.toFixed(1)} L${first.x.toFixed(1)},${baseline.toFixed(1)} Z`;
}

// ── Compute drawdown series ────────────────────────────────────────────────────

function computeDrawdown(values: number[]): number[] {
  let hwm = values[0] ?? 0;
  return values.map(v => {
    hwm = Math.max(hwm, v);
    return hwm > 0 ? (v - hwm) / hwm : 0;   // negative or zero
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function navFmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function dp(v: number, d = 2): string { return isFinite(v) ? v.toFixed(d) : '—'; }
function pct(v: number, sign = true): string {
  const p = (v * 100).toFixed(1) + '%';
  return sign ? (v >= 0 ? '+' : '') + p : p;
}
function monthLabel(key: string): string {
  const [, mm] = key.split('-');
  return MONTHS[(parseInt(mm ?? '1', 10) - 1) % 12] ?? key;
}
function heatColor(ret: number): string {
  if (ret >  0.04) return 'rgba(74,222,128,0.80)';
  if (ret >  0.02) return 'rgba(74,222,128,0.50)';
  if (ret >  0.005)return 'rgba(74,222,128,0.25)';
  if (ret > -0.005)return 'rgba(148,163,184,0.12)';
  if (ret > -0.02) return 'rgba(248,113,113,0.30)';
  if (ret > -0.04) return 'rgba(248,113,113,0.55)';
  return 'rgba(248,113,113,0.80)';
}

// ── Period filter ─────────────────────────────────────────────────────────────

type Period = '1M' | '3M' | '6M' | '1Y' | 'ALL';
const PERIOD_DAYS: Record<Period, number> = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252, 'ALL': Infinity };

function slicePeriod(atlas: EquityPoint[], spy: number[], period: Period): { atlas: EquityPoint[]; spy: number[] } {
  const days = PERIOD_DAYS[period];
  if (!isFinite(days)) return { atlas, spy };
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const idx = atlas.findIndex(p => p.timestamp >= cutoff);
  if (idx <= 0) return { atlas, spy };
  return { atlas: atlas.slice(idx), spy: spy.slice(idx) };
}

// ── Compute subset metrics ─────────────────────────────────────────────────────

function subsetMetrics(curve: EquityPoint[]): {
  sharpe: number; sortino: number; maxDD: number; totalReturn: number;
} {
  const RF_DAILY = 0.045 / 252;
  if (curve.length < 2) return { sharpe: 0, sortino: 0, maxDD: 0, totalReturn: 0 };

  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1]!.totalValue;
    const curr = curve[i]!.totalValue;
    if (prev > 0) returns.push((curr - prev) / prev);
  }

  const n    = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const excess = mean - RF_DAILY;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(n - 1, 1);
  const sd   = Math.sqrt(variance);
  const downReturns = returns.filter(r => r < RF_DAILY);
  const downVar = downReturns.length > 0
    ? downReturns.reduce((s, r) => s + (r - RF_DAILY) ** 2, 0) / downReturns.length
    : 0;
  const downSd = Math.sqrt(downVar);

  const sharpe  = sd > 0 ? (excess / sd) * Math.sqrt(252) : 0;
  const sortino = downSd > 0 ? (excess / downSd) * Math.sqrt(252) : 0;

  const drawdowns = computeDrawdown(curve.map(p => p.totalValue));
  const maxDD = Math.abs(Math.min(...drawdowns, 0));

  const first = curve[0]!.totalValue;
  const last  = curve[curve.length - 1]!.totalValue;
  const totalReturn = first > 0 ? (last - first) / first : 0;

  return { sharpe, sortino, maxDD, totalReturn };
}

// ── Module-level state ────────────────────────────────────────────────────────

const MOCK = genMockCurve();

let currentAtlas: EquityPoint[] = MOCK.atlas;
let currentSpy:   number[]      = MOCK.spy;
let currentMetrics: PerformanceMetrics | null = null;
let activePeriod: Period = '1Y';
let isLive = false;

// DOM refs
let chartSvgEl: SVGSVGElement | null          = null;
let ddSvgEl: SVGSVGElement | null             = null;
let tooltipEl: HTMLElement | null             = null;
let periodRowEl: HTMLElement | null           = null;
let metricsBodyEl: HTMLElement | null         = null;
let heatmapEl: HTMLElement | null             = null;
let stratTableEl: HTMLElement | null          = null;
let liveTagEl: HTMLElement | null             = null;
let summaryBarEl: HTMLElement | null          = null;

// ── SVG chart builder ─────────────────────────────────────────────────────────

const VB = { w: 420, h: 140 };
const MARGIN: Margin = { top: 10, right: 8, bottom: 28, left: 46 };
const DD_VB = { w: 420, h: 52 };
const DD_M: Margin  = { top: 4, right: 8, bottom: 14, left: 46 };

function rebuildChart(): void {
  if (!chartSvgEl || !ddSvgEl) return;

  const { atlas, spy } = slicePeriod(currentAtlas, currentSpy, activePeriod);
  if (atlas.length < 2) return;

  const timestamps = atlas.map(p => p.timestamp);
  const atlasVals  = atlas.map(p => p.totalValue);
  const spyVals    = spy.slice(-atlas.length);

  // Normalise SPY to same starting value as YC Hedge Fund for visual comparison
  const atlasStart = atlasVals[0]!;
  const spyStart   = spyVals[0] ?? atlasStart;
  const spyNorm    = spyVals.map(v => (v / spyStart) * atlasStart);

  const allVals  = [...atlasVals, ...spyNorm];
  const yMin     = Math.min(...allVals) * 0.995;
  const yMax     = Math.max(...allVals) * 1.005;

  const atlasPts = mapToSvg(atlasVals, timestamps, VB, MARGIN, yMin, yMax);
  const spyPts   = mapToSvg(spyNorm, timestamps, VB, MARGIN, yMin, yMax);

  const baseline = MARGIN.top + (VB.h - MARGIN.top - MARGIN.bottom);

  // ── Equity SVG ──────────────────────────────────────────────────────────────
  const gradId   = 'perf-atlas-grad';
  chartSvgEl.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#4ade80" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#4ade80" stop-opacity="0.01"/>
      </linearGradient>
    </defs>

    <!-- Y-axis labels -->
    <text x="${(MARGIN.left - 4).toFixed(0)}" y="${(MARGIN.top).toFixed(0)}"
      class="perf-axis-label" text-anchor="end">${navFmt(yMax)}</text>
    <text x="${(MARGIN.left - 4).toFixed(0)}" y="${baseline.toFixed(0)}"
      class="perf-axis-label" text-anchor="end">${navFmt(yMin)}</text>

    <!-- Zero baseline -->
    <line x1="${MARGIN.left}" y1="${baseline.toFixed(0)}"
          x2="${(VB.w - MARGIN.right).toFixed(0)}" y2="${baseline.toFixed(0)}"
          class="perf-axis-line"/>

    <!-- YC Hedge Fund gradient fill -->
    <path d="${svgArea(atlasPts, baseline)}"
          fill="url(#${gradId})" class="perf-area-atlas"/>

    <!-- SPY dotted line -->
    <path d="${svgLine(spyPts)}"
          class="perf-line-spy" fill="none"/>

    <!-- YC Hedge Fund line -->
    <path d="${svgLine(atlasPts)}"
          class="perf-line-atlas" fill="none"/>

    <!-- X-axis time labels -->
    ${buildXLabels(timestamps, VB, MARGIN)}

    <!-- Invisible hit target for tooltip -->
    <rect x="${MARGIN.left}" y="${MARGIN.top}"
          width="${VB.w - MARGIN.left - MARGIN.right}"
          height="${VB.h - MARGIN.top - MARGIN.bottom}"
          fill="transparent" class="perf-hit-area"
          data-count="${atlas.length}"/>

    <!-- Legend -->
    <g transform="translate(${MARGIN.left + 4},${MARGIN.top + 4})">
      <line x1="0" y1="5" x2="18" y2="5" stroke="#4ade80" stroke-width="1.5"/>
      <text x="22" y="8.5" class="perf-legend-label">YC Hedge Fund</text>
      <line x1="60" y1="5" x2="78" y2="5" stroke="#94a3b8" stroke-width="1"
            stroke-dasharray="3,2"/>
      <text x="82" y="8.5" class="perf-legend-label spy">SPY</text>
    </g>
  `;

  // Store data for tooltip lookup
  chartSvgEl.dataset.atlasJson  = JSON.stringify(atlasVals.map((v, i) => ({ t: timestamps[i], v })));
  chartSvgEl.dataset.spyJson    = JSON.stringify(spyNorm);

  // ── Drawdown SVG ────────────────────────────────────────────────────────────
  const ddValues = computeDrawdown(atlasVals);
  const ddMin    = Math.min(...ddValues, -0.002);
  const ddPts    = mapToSvg(ddValues, timestamps, DD_VB, DD_M, ddMin, 0);
  const ddBase   = DD_M.top; // zero line is at top of plot area

  ddSvgEl.innerHTML = `
    <defs>
      <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f87171" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#f87171" stop-opacity="0.45"/>
      </linearGradient>
    </defs>

    <text x="${MARGIN.left - 4}" y="${DD_M.top + 8}"
      class="perf-axis-label" text-anchor="end">0%</text>
    <text x="${MARGIN.left - 4}"
          y="${(DD_VB.h - DD_M.bottom).toFixed(0)}"
          class="perf-axis-label" text-anchor="end">${pct(ddMin, false)}</text>

    <line x1="${DD_M.left}" y1="${ddBase}"
          x2="${DD_VB.w - DD_M.right}" y2="${ddBase}"
          class="perf-axis-line"/>

    <path d="${svgArea(ddPts, DD_VB.h - DD_M.bottom)}"
          fill="url(#dd-grad)" class="perf-area-dd"/>
    <path d="${svgLine(ddPts)}"
          class="perf-line-dd" fill="none"/>

    ${buildXLabels(timestamps, DD_VB, DD_M)}
  `;
}

function buildXLabels(timestamps: number[], vb: { w: number; h: number }, m: Margin): string {
  const n      = timestamps.length;
  if (n < 2) return '';
  const tMin   = timestamps[0]!;
  const tMax   = timestamps[n - 1]!;
  const tRange = tMax - tMin || 1;
  const plotW  = vb.w - m.left - m.right;
  const y      = vb.h - m.bottom + 10;

  // Pick ~4 label positions
  const tickCount = 4;
  const labels: string[] = [];

  for (let k = 0; k <= tickCount; k++) {
    const ts  = tMin + (k / tickCount) * tRange;
    const x   = m.left + ((ts - tMin) / tRange) * plotW;
    const d   = new Date(ts);
    const lbl = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    labels.push(`<text x="${x.toFixed(1)}" y="${y}"
      class="perf-axis-label" text-anchor="middle">${lbl}</text>`);
  }
  return labels.join('\n');
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function attachTooltip(container: HTMLElement): void {
  const svg = container.querySelector<SVGSVGElement>('.perf-chart-svg');
  if (!svg || !tooltipEl) return;

  svg.addEventListener('mousemove', (e: MouseEvent) => {
    const raw = svg.dataset.atlasJson;
    const spyRaw = svg.dataset.spyJson;
    if (!raw || !tooltipEl) return;

    const data: Array<{ t: number; v: number }> = JSON.parse(raw);
    const spyData: number[] = JSON.parse(spyRaw ?? '[]');
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(Math.max(Math.round(xRatio * (data.length - 1)), 0), data.length - 1);
    const pt  = data[idx];
    if (!pt) return;

    const spyVal = spyData[idx] ?? 0;
    const d      = new Date(pt.t);
    const dateStr = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    const pnl    = pt.v - 1_000_000;

    tooltipEl.innerHTML = `
      <div class="perf-tt-date">${dateStr}</div>
      <div class="perf-tt-row"><span>YC Hedge Fund NAV</span><strong>${navFmt(pt.v)}</strong></div>
      <div class="perf-tt-row"><span>P&L</span><strong class="${pnl >= 0 ? 'profit' : 'loss'}">${pnl >= 0 ? '+' : ''}${navFmt(pnl)}</strong></div>
      ${spyVal > 0 ? `<div class="perf-tt-row"><span>SPY (norm)</span><strong>${navFmt(spyVal)}</strong></div>` : ''}
    `;

    const leftPx = e.clientX - rect.left;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = leftPx > rect.width / 2
      ? `${leftPx - tooltipEl.offsetWidth - 8}px`
      : `${leftPx + 12}px`;
    tooltipEl.style.top  = '8px';
  });

  svg.addEventListener('mouseleave', () => {
    if (tooltipEl) tooltipEl.style.display = 'none';
  });
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function renderSummaryBar(): void {
  if (!summaryBarEl) return;
  const { atlas } = slicePeriod(currentAtlas, currentSpy, activePeriod);
  if (atlas.length < 2) return;
  const first = atlas[0]!.totalValue;
  const last  = atlas[atlas.length - 1]!.totalValue;
  const ret   = (last - first) / first;
  const spy   = currentSpy.slice(-atlas.length);
  const spyFirst = spy[0] ?? first;
  const spyLast  = spy[spy.length - 1] ?? spyFirst;
  const spyRet   = (spyLast - spyFirst) / spyFirst;

  summaryBarEl.innerHTML = `
    <span class="perf-summary-nav">${navFmt(last)}</span>
    <span class="perf-summary-return ${ret >= 0 ? 'profit' : 'loss'}">${pct(ret)}</span>
    <span class="perf-summary-sep">vs</span>
    <span class="perf-summary-spy ${spyRet >= 0 ? 'profit' : 'loss'}">SPY ${pct(spyRet)}</span>
    <span class="perf-summary-alpha ${ret - spyRet >= 0 ? 'profit' : 'loss'}">α ${pct(ret - spyRet)}</span>
  `;
}

// ── Metrics table ─────────────────────────────────────────────────────────────

interface PeriodMetrics {
  sharpe: number;
  sortino: number;
  maxDD: number;
  winRate: number;
  profitFactor: number;
  alpha: number;
  calmar: number;
  totalReturn: number;
}

function buildPeriodMetrics(period: Period, full: PerformanceMetrics | null): PeriodMetrics {
  if (!full) {
    // Compute from mock equity curve
    const { atlas } = slicePeriod(currentAtlas, currentSpy, period);
    const sub = subsetMetrics(atlas);
    return {
      sharpe: sub.sharpe,
      sortino: sub.sortino,
      maxDD: sub.maxDD,
      winRate: 0,
      profitFactor: 0,
      alpha: 0,
      calmar: sub.maxDD > 0 ? (sub.totalReturn / sub.maxDD) : 0,
      totalReturn: sub.totalReturn,
    };
  }

  if (period === 'ALL') {
    return {
      sharpe: full.sharpeInception,
      sortino: full.sortinoInception,
      maxDD: full.maxDrawdown,
      winRate: full.winRate,
      profitFactor: full.profitFactor,
      alpha: full.alpha,
      calmar: full.calmar,
      totalReturn: full.totalReturn,
    };
  }

  if (period === '1M') {
    return {
      sharpe: full.sharpe30d,
      sortino: full.sortino30d,
      maxDD: full.maxDrawdown,
      winRate: full.winRate,
      profitFactor: full.profitFactor,
      alpha: full.alpha,
      calmar: full.calmar,
      totalReturn: full.totalReturn,
    };
  }

  if (period === '3M') {
    return {
      sharpe: full.sharpe90d,
      sortino: full.sortino30d, // best available
      maxDD: full.maxDrawdown,
      winRate: full.winRate,
      profitFactor: full.profitFactor,
      alpha: full.alpha,
      calmar: full.calmar,
      totalReturn: full.totalReturn,
    };
  }

  // 6M, 1Y — compute from curve slice
  const { atlas } = slicePeriod(currentAtlas, currentSpy, period);
  const sub = subsetMetrics(atlas);
  return {
    sharpe: sub.sharpe,
    sortino: sub.sortino,
    maxDD: sub.maxDD,
    winRate: full.winRate,
    profitFactor: full.profitFactor,
    alpha: full.alpha,
    calmar: sub.maxDD > 0 ? (sub.totalReturn / sub.maxDD) : 0,
    totalReturn: sub.totalReturn,
  };
}

function renderMetricsTable(): void {
  if (!metricsBodyEl) return;

  const p30  = buildPeriodMetrics('1M',  currentMetrics);
  const p90  = buildPeriodMetrics('3M',  currentMetrics);
  const pAll = buildPeriodMetrics('ALL', currentMetrics);

  const rows: Array<{ label: string; v30: string; v90: string; vAll: string; cls?: string }> = [
    {
      label: 'Sharpe',
      v30: dp(p30.sharpe), v90: dp(p90.sharpe), vAll: dp(pAll.sharpe),
      cls: pAll.sharpe >= 1 ? 'profit' : pAll.sharpe < 0 ? 'loss' : '',
    },
    {
      label: 'Sortino',
      v30: dp(p30.sortino), v90: dp(p90.sortino), vAll: dp(pAll.sortino),
      cls: pAll.sortino >= 1 ? 'profit' : pAll.sortino < 0 ? 'loss' : '',
    },
    {
      label: 'Calmar',
      v30: dp(p30.calmar), v90: dp(p90.calmar), vAll: dp(pAll.calmar),
      cls: pAll.calmar >= 1 ? 'profit' : '',
    },
    {
      label: 'Max DD',
      v30: pct(-p30.maxDD), v90: pct(-p90.maxDD), vAll: pct(-pAll.maxDD),
      cls: 'loss',
    },
    {
      label: 'Win Rate',
      v30: pct(p30.winRate, false), v90: pct(p90.winRate, false), vAll: pct(pAll.winRate, false),
      cls: pAll.winRate >= 0.5 ? 'profit' : 'loss',
    },
    {
      label: 'Prof. Factor',
      v30: dp(p30.profitFactor), v90: dp(p90.profitFactor), vAll: dp(pAll.profitFactor),
      cls: pAll.profitFactor >= 1 ? 'profit' : 'loss',
    },
    {
      label: 'Alpha',
      v30: pct(p30.alpha), v90: pct(p90.alpha), vAll: pct(pAll.alpha),
      cls: pAll.alpha >= 0 ? 'profit' : 'loss',
    },
    {
      label: 'Return',
      v30: pct(p30.totalReturn), v90: pct(p90.totalReturn), vAll: pct(pAll.totalReturn),
      cls: pAll.totalReturn >= 0 ? 'profit' : 'loss',
    },
  ];

  metricsBodyEl.innerHTML = rows.map(r => `
    <div class="perf-metric-row">
      <span class="perf-metric-label">${r.label}</span>
      <span class="perf-metric-val">${r.v30}</span>
      <span class="perf-metric-val">${r.v90}</span>
      <span class="perf-metric-val ${r.cls ?? ''}">${r.vAll}</span>
    </div>
  `).join('');
}

// ── Monthly heatmap ───────────────────────────────────────────────────────────

function renderHeatmap(): void {
  if (!heatmapEl) return;

  // Build monthly returns from current atlas curve
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const pt of currentAtlas) {
    const d   = new Date(pt.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ex  = byMonth.get(key);
    if (!ex) byMonth.set(key, { first: pt.totalValue, last: pt.totalValue });
    else ex.last = pt.totalValue;
  }

  // Override with live metrics if available
  const monthly: Record<string, number> = {};
  if (currentMetrics?.monthlyReturns && Object.keys(currentMetrics.monthlyReturns).length > 0) {
    Object.assign(monthly, currentMetrics.monthlyReturns);
  } else {
    for (const [k, { first, last }] of byMonth) {
      monthly[k] = first > 0 ? (last - first) / first : 0;
    }
  }

  const sortedKeys = Object.keys(monthly).sort().slice(-15); // last 15 months max

  heatmapEl.innerHTML = '';
  for (const key of sortedKeys) {
    const ret  = monthly[key] ?? 0;
    const cell = document.createElement('div');
    cell.className = 'perf-heat-cell';
    cell.style.background = heatColor(ret);
    cell.title = `${key}: ${pct(ret)}`;
    cell.innerHTML = `
      <span class="perf-heat-month">${monthLabel(key)}</span>
      <span class="perf-heat-val ${ret >= 0 ? 'profit' : 'loss'}">${pct(ret, true)}</span>
    `;
    heatmapEl.appendChild(cell);
  }
}

// ── Strategy breakdown ────────────────────────────────────────────────────────

const STRATEGY_DISPLAY: Record<string, string> = {
  geopolitical: 'Geopolitical',
  GEOPOLITICAL: 'Geopolitical',
  sentiment:    'Sentiment',
  SENTIMENT:    'Sentiment',
  momentum:     'Momentum',
  MOMENTUM:     'Momentum',
  macro:        'Macro',
  MACRO:        'Macro',
  'cross-asset':'Cross-Asset',
};

function renderStrategyTable(byStrategy: Record<string, StrategyStats>): void {
  if (!stratTableEl) return;
  stratTableEl.innerHTML = '';

  const entries = Object.values(byStrategy)
    .sort((a, b) => b.totalPnl - a.totalPnl);

  if (entries.length === 0) {
    // Use synthetic breakdown from mock data
    const mock: StrategyStats[] = [
      { strategy: 'Geopolitical', trades: 34,  winRate: 0.62, totalPnl: 12500, avgPnl: 368,  sharpe: 1.82 },
      { strategy: 'Sentiment',    trades: 87,  winRate: 0.58, totalPnl:  8400, avgPnl:  97,  sharpe: 1.31 },
      { strategy: 'Macro',        trades: 12,  winRate: 0.50, totalPnl:  4200, avgPnl: 350,  sharpe: 0.74 },
      { strategy: 'Cross-Asset',  trades: 23,  winRate: 0.52, totalPnl:  2100, avgPnl:  91,  sharpe: 1.08 },
      { strategy: 'Momentum',     trades: 142, winRate: 0.56, totalPnl:  6700, avgPnl:  47,  sharpe: 0.91 },
    ];
    for (const s of mock) appendStratRow(s);
    return;
  }

  for (const s of entries) appendStratRow(s);
}

function appendStratRow(s: StrategyStats): void {
  if (!stratTableEl) return;
  const name   = STRATEGY_DISPLAY[s.strategy] ?? s.strategy;
  const isPos  = s.totalPnl >= 0;
  const row    = document.createElement('div');
  row.className = 'perf-strat-row';
  row.innerHTML = `
    <span class="perf-strat-name">${name}</span>
    <span class="perf-strat-trades">${s.trades}</span>
    <span class="perf-strat-wr">${pct(s.winRate, false)}</span>
    <span class="perf-strat-pnl ${isPos ? 'profit' : 'loss'}">${isPos ? '+' : ''}$${Math.abs(s.totalPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
    <span class="perf-strat-sharpe">${dp(s.sharpe)}</span>
  `;
  stratTableEl.appendChild(row);
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(): void {
  const { atlas, spy } = slicePeriod(currentAtlas, currentSpy, activePeriod);
  const lines: string[] = [
    'Date,YC Hedge Fund NAV,YC Hedge Fund Return %,SPY (normalised),SPY Return %,Drawdown %',
  ];

  const atlasStart = atlas[0]?.totalValue ?? 1_000_000;
  const spyStart   = spy[0] ?? atlasStart;

  const dd = computeDrawdown(atlas.map(p => p.totalValue));

  atlas.forEach((pt, i) => {
    const d = new Date(pt.timestamp);
    const dateStr = d.toISOString().split('T')[0];
    const spyNorm = spy[i] != null ? (spy[i]! / spyStart) * atlasStart : '';
    const atlasRet = atlasStart > 0 ? ((pt.totalValue - atlasStart) / atlasStart * 100).toFixed(4) : '';
    const spyRet   = spyStart > 0 && spy[i] != null ? ((spy[i]! - spyStart) / spyStart * 100).toFixed(4) : '';
    const ddPct    = (dd[i]! * 100).toFixed(4);
    lines.push(`${dateStr},${pt.totalValue.toFixed(2)},${atlasRet},${spyNorm ? Number(spyNorm).toFixed(2) : ''},${spyRet},${ddPct}`);
  });

  // Metrics section
  if (currentMetrics) {
    lines.push('');
    lines.push('METRICS,,,,');
    lines.push(`Sharpe (30d),${dp(currentMetrics.sharpe30d)},,,,`);
    lines.push(`Sharpe (90d),${dp(currentMetrics.sharpe90d)},,,,`);
    lines.push(`Sharpe (inception),${dp(currentMetrics.sharpeInception)},,,,`);
    lines.push(`Sortino (inception),${dp(currentMetrics.sortinoInception)},,,,`);
    lines.push(`Max Drawdown,${pct(currentMetrics.maxDrawdown)},,,,`);
    lines.push(`Win Rate,${pct(currentMetrics.winRate)},,,,`);
    lines.push(`Profit Factor,${dp(currentMetrics.profitFactor)},,,,`);
    lines.push(`Alpha,${pct(currentMetrics.alpha)},,,,`);
    lines.push(`Calmar,${dp(currentMetrics.calmar)},,,,`);
    lines.push(`Total Trades,${currentMetrics.totalTrades},,,,`);
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `yc-hedge-fund-performance-${activePeriod}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Full refresh ──────────────────────────────────────────────────────────────

function refresh(): void {
  rebuildChart();
  renderSummaryBar();
  renderMetricsTable();
  renderHeatmap();
  renderStrategyTable(currentMetrics?.byStrategy ?? {});
}

// ── Panel builder ─────────────────────────────────────────────────────────────

function buildBody(container: HTMLElement): void {

  // ── Period selector + export ───────────────────────────────────────────────
  const topRow = document.createElement('div');
  topRow.className = 'perf-top-row';

  periodRowEl = document.createElement('div');
  periodRowEl.className = 'perf-period-row';

  const periods: Period[] = ['1M', '3M', '6M', '1Y', 'ALL'];
  for (const p of periods) {
    const btn = document.createElement('button');
    btn.className = `perf-period-btn ${p === activePeriod ? 'active' : ''}`;
    btn.textContent = p;
    btn.addEventListener('click', () => {
      activePeriod = p;
      periodRowEl!.querySelectorAll('.perf-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refresh();
    });
    periodRowEl.appendChild(btn);
  }

  liveTagEl = document.createElement('span');
  liveTagEl.className = 'perf-live-tag';
  liveTagEl.textContent = 'MOCK';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'perf-export-btn';
  exportBtn.title = 'Download CSV';
  exportBtn.textContent = '↓ CSV';
  exportBtn.addEventListener('click', exportCsv);

  topRow.appendChild(periodRowEl);
  topRow.appendChild(liveTagEl);
  topRow.appendChild(exportBtn);
  container.appendChild(topRow);

  // ── Summary bar ────────────────────────────────────────────────────────────
  summaryBarEl = document.createElement('div');
  summaryBarEl.className = 'perf-summary-bar';
  container.appendChild(summaryBarEl);

  // ── Equity curve chart ─────────────────────────────────────────────────────
  const chartSection = document.createElement('div');
  chartSection.className = 'perf-chart-section';

  const chartHdr = document.createElement('div');
  chartHdr.className = 'perf-section-header';
  chartHdr.textContent = 'EQUITY CURVE';

  const chartWrap = document.createElement('div');
  chartWrap.className = 'perf-chart-wrap';
  chartWrap.style.position = 'relative';

  chartSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chartSvgEl.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  chartSvgEl.setAttribute('preserveAspectRatio', 'none');
  chartSvgEl.setAttribute('class', 'perf-chart-svg');

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'perf-chart-tooltip';
  tooltipEl.style.display = 'none';

  chartWrap.appendChild(chartSvgEl);
  chartWrap.appendChild(tooltipEl);
  chartSection.appendChild(chartHdr);
  chartSection.appendChild(chartWrap);

  // ── Drawdown chart ─────────────────────────────────────────────────────────
  const ddHdr = document.createElement('div');
  ddHdr.className = 'perf-section-header perf-dd-header';
  ddHdr.textContent = 'DRAWDOWN';

  ddSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ddSvgEl.setAttribute('viewBox', `0 0 ${DD_VB.w} ${DD_VB.h}`);
  ddSvgEl.setAttribute('preserveAspectRatio', 'none');
  ddSvgEl.setAttribute('class', 'perf-dd-svg');

  chartSection.appendChild(ddHdr);
  chartSection.appendChild(ddSvgEl);
  container.appendChild(chartSection);

  // Attach tooltip after DOM insertion
  requestAnimationFrame(() => attachTooltip(chartWrap));

  // ── Metrics table ──────────────────────────────────────────────────────────
  const metricsSection = document.createElement('div');
  metricsSection.className = 'perf-metrics-section';

  const metricsHdr = document.createElement('div');
  metricsHdr.className = 'perf-metrics-header';
  metricsHdr.innerHTML = `
    <span class="perf-metric-label">METRICS</span>
    <span class="perf-metric-col">30d</span>
    <span class="perf-metric-col">90d</span>
    <span class="perf-metric-col">ALL</span>
  `;

  metricsBodyEl = document.createElement('div');
  metricsBodyEl.className = 'perf-metrics-body';

  metricsSection.appendChild(metricsHdr);
  metricsSection.appendChild(metricsBodyEl);
  container.appendChild(metricsSection);

  // ── Monthly heatmap ────────────────────────────────────────────────────────
  const heatSection = document.createElement('div');
  heatSection.className = 'perf-heat-section';

  const heatHdr = document.createElement('div');
  heatHdr.className = 'perf-section-header';
  heatHdr.textContent = 'MONTHLY RETURNS';

  heatmapEl = document.createElement('div');
  heatmapEl.className = 'perf-heatmap';

  heatSection.appendChild(heatHdr);
  heatSection.appendChild(heatmapEl);
  container.appendChild(heatSection);

  // ── Strategy breakdown ─────────────────────────────────────────────────────
  const stratSection = document.createElement('div');
  stratSection.className = 'perf-strat-section';

  const stratHdr = document.createElement('div');
  stratHdr.className = 'perf-strat-header';
  stratHdr.innerHTML = `
    <span class="perf-strat-name">STRATEGY</span>
    <span class="perf-strat-trades">Trades</span>
    <span class="perf-strat-wr">Win%</span>
    <span class="perf-strat-pnl">P&L</span>
    <span class="perf-strat-sharpe">Sharpe</span>
  `;

  stratTableEl = document.createElement('div');
  stratTableEl.className = 'perf-strat-body';

  stratSection.appendChild(stratHdr);
  stratSection.appendChild(stratTableEl);
  container.appendChild(stratSection);

  // ── Event subscriptions ────────────────────────────────────────────────────

  window.addEventListener('trading:performance', (e: Event) => {
    const metrics = (e as CustomEvent<PerformanceMetrics>).detail;
    if (!metrics) return;

    currentMetrics = metrics;

    // Merge live equity curve into display data
    if (metrics.dailyEquityCurve.length > 5) {
      currentAtlas = metrics.dailyEquityCurve;
      // Regenerate SPY parallel series to match length
      const liveRng = makeLcg(0xcafe);
      let spyVal = 1_000_000;
      currentSpy = currentAtlas.map(() => {
        spyVal *= (1 + 0.00038 + 0.009 * boxMuller(liveRng));
        return spyVal;
      });
      isLive = true;
      if (liveTagEl) { liveTagEl.textContent = 'LIVE'; liveTagEl.className = 'perf-live-tag live'; }
    }

    refresh();
  });

  // Try to bootstrap from live portfolioManager immediately
  const snap       = portfolioManager.getSnapshot();
  const liveEquity = portfolioManager.getEquityCurve();
  if (liveEquity.length > 5 && snap.closedTradeCount > 0) {
    try {
      currentMetrics = calculatePerformance(snap, liveEquity);
      currentAtlas   = liveEquity;
      const bootRng  = makeLcg(0xbabe);
      let spyVal     = 1_000_000;
      currentSpy     = currentAtlas.map(() => {
        spyVal *= (1 + 0.00038 + 0.009 * boxMuller(bootRng));
        return spyVal;
      });
      isLive = true;
      if (liveTagEl) { liveTagEl.textContent = 'LIVE'; liveTagEl.className = 'perf-live-tag live'; }
    } catch {
      // Fall back to mock — no action needed
    }
  }

  // ── Initial render ─────────────────────────────────────────────────────────
  refresh();
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initPerformancePanel(): void {
  registerPanel({
    id: 'performance',
    title: 'Performance',
    badge: 'METRICS',
    badgeClass: 'mock',
    defaultCollapsed: true,
    init: buildBody,
  });
}
