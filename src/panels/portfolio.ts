/**
 * Portfolio Panel — Phase 4e Part 2
 *
 * Subscribes to:
 *   'trading:portfolio'  → PortfolioSnapshot (from StateSync / new engine)
 *   'trading:riskStatus' → { cbState, dailyPnLPct, drawdownPct, ... }
 *   'portfolio-updated'  → PortfolioState (legacy engine fallback)
 *   'price-feed-updated' → price tick for flash animation
 *
 * Sections:
 *   1. NAV header — total value, daily P&L, circuit breaker badge
 *   2. Positions table — compact rows with fill-bar, click → detail popup
 *   3. Exposure + Risk — Long/Short/Cash bars + heat gauge + DD bar
 *   4. Sector mini-donut SVG
 *   5. Closed trades list (last 10)
 *   6. Flatten All emergency button
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { tradingEngine } from '../trading/engine';
import { portfolioManager } from '../trading/engine/portfolio-manager';
import type { PortfolioSnapshot, ManagedPosition, ClosedTrade } from '../trading/engine/portfolio-manager';
import type { Fill } from '../trading/engine/paper-broker';

// ── Sector & colour maps ──────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  USO: 'Energy',   XLE: 'Energy',   VDE: 'Energy',   XOP: 'Energy', OIH: 'Energy',
  QQQ: 'Tech',     XLK: 'Tech',     SMH: 'Tech',      SOXL: 'Tech', ARKK: 'Tech',
  TLT: 'Bonds',    IEF: 'Bonds',    BND: 'Bonds',     AGG: 'Bonds', LQD: 'Bonds',
  GLD: 'Metals',   IAU: 'Metals',   GDX: 'Metals',    GDXJ: 'Metals', SLV: 'Metals',
  SPY: 'Equity',   DIA: 'Equity',   IWM: 'Equity',    VOO: 'Equity',
  EEM: 'EM',       VWO: 'EM',       FXI: 'EM',        KWEB: 'EM',
  XLF: 'Finance',  KRE: 'Finance',  XLV: 'Health',
  JETS: 'Transport', XLI: 'Industry',
  UNG: 'Energy',   CORN: 'Commodity', DBA: 'Commodity',
};

const SECTOR_COLORS: Record<string, string> = {
  Energy:    '#f97316',
  Tech:      '#3b82f6',
  Bonds:     '#22c55e',
  Metals:    '#eab308',
  Equity:    '#8b5cf6',
  EM:        '#14b8a6',
  Finance:   '#06b6d4',
  Health:    '#ec4899',
  Transport: '#64748b',
  Industry:  '#94a3b8',
  Commodity: '#a78bfa',
  Other:     '#475569',
};

function getSector(symbol: string): string {
  return SECTOR_MAP[symbol] ?? 'Other';
}

// ── Circuit breaker badge ─────────────────────────────────────────────────────

const CB_COLORS: Record<string, string> = {
  GREEN: '#4ade80', YELLOW: '#eab308', RED: '#f87171', BLACK: '#94a3b8',
};
const CB_LABELS: Record<string, string> = {
  GREEN: '● GREEN', YELLOW: '◐ YELLOW', RED: '◉ RED', BLACK: '◼ BLACK',
};

// ── Formatters ────────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdP = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function $$(v: number): string { return usd.format(v); }
function $$p(v: number): string { return usdP.format(v); }
function sign(v: number, decimals = 0): string {
  const abs = Math.abs(v);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals });
  return (v >= 0 ? '+' : '-') + fmt.format(abs).replace('$', '$');
}
function pct(v: number, showSign = true): string {
  const p = (v * 100).toFixed(2) + '%';
  return showSign ? (v >= 0 ? '+' : '') + p : p;
}
function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

// ── SVG Sector Donut ─────────────────────────────────────────────────────────

function buildSectorSvg(sectors: Map<string, number>): SVGSVGElement {
  const total = [...sectors.values()].reduce((a, b) => a + b, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('width', '80');
  svg.setAttribute('height', '80');

  const CX = 40, CY = 40, R = 34, IR = 18;

  if (total === 0) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(CX));
    circle.setAttribute('cy', String(CY));
    circle.setAttribute('r', String(R));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'rgba(148,163,184,0.15)');
    circle.setAttribute('stroke-width', '16');
    svg.appendChild(circle);
    return svg;
  }

  let angle = -Math.PI / 2;

  for (const [name, value] of sectors) {
    if (value <= 0) continue;
    const sweep = (value / total) * Math.PI * 2;
    const endAngle = angle + sweep;
    const large = sweep > Math.PI ? 1 : 0;

    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const x3 = CX + IR * Math.cos(endAngle);
    const y3 = CY + IR * Math.sin(endAngle);
    const x4 = CX + IR * Math.cos(angle);
    const y4 = CY + IR * Math.sin(angle);

    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${IR} ${IR} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', SECTOR_COLORS[name] ?? '#475569');
    path.setAttribute('stroke', '#0a0f0a');
    path.setAttribute('stroke-width', '1.5');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${name}: ${((value / total) * 100).toFixed(1)}%`;
    path.appendChild(title);

    svg.appendChild(path);
    angle = endAngle;
  }

  return svg;
}

// ── Sector breakdown from positions ──────────────────────────────────────────

function computeSectors(positions: ManagedPosition[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const pos of positions) {
    const sec = getSector(pos.symbol);
    map.set(sec, (map.get(sec) ?? 0) + Math.abs(pos.marketValue));
  }
  return map;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

let navValueEl: HTMLElement | null = null;
let navDailyEl: HTMLElement | null = null;
let cbBadgeEl: HTMLElement | null = null;
let navTotalPnlEl: HTMLElement | null = null;
let posHeaderEl: HTMLElement | null = null;
let posTableBodyEl: HTMLElement | null = null;
let longBarEl: HTMLElement | null = null;
let shortBarEl: HTMLElement | null = null;
let cashBarEl: HTMLElement | null = null;
let longLblEl: HTMLElement | null = null;
let shortLblEl: HTMLElement | null = null;
let cashLblEl: HTMLElement | null = null;
let heatFillEl: HTMLElement | null = null;
let heatLblEl: HTMLElement | null = null;
let ddFillEl: HTMLElement | null = null;
let ddLblEl: HTMLElement | null = null;
let betaLblEl: HTMLElement | null = null;
let varLblEl: HTMLElement | null = null;
let sectorPieWrapEl: HTMLElement | null = null;
let sectorLegendEl: HTMLElement | null = null;
let tradesBodyEl: HTMLElement | null = null;

let lastNav = 0;

// ── Risk status (from trading:riskStatus) ─────────────────────────────────────

interface RiskStatus {
  cbState: string;
  canTrade: boolean;
  positionSizeMultiplier: number;
  dailyPnLPct: number;
  drawdownPct: number;
}

let currentRiskStatus: RiskStatus = {
  cbState: 'GREEN',
  canTrade: true,
  positionSizeMultiplier: 1,
  dailyPnLPct: 0,
  drawdownPct: 0,
};

// ── Position detail popup ─────────────────────────────────────────────────────

function buildPositionDetailPopup(pos: ManagedPosition, totalValue: number): HTMLElement {
  const isLong = pos.direction === 'LONG';
  const isProfit = pos.unrealizedPnl >= 0;
  const posSize = totalValue > 0 ? Math.abs(pos.marketValue) / totalValue : 0;

  const slPrice = isLong
    ? pos.avgCostPrice * (1 - pos.stopLossPct)
    : pos.avgCostPrice * (1 + pos.stopLossPct);
  const tpPrice = isLong
    ? pos.avgCostPrice * (1 + pos.takeProfitPct)
    : pos.avgCostPrice * (1 - pos.takeProfitPct);

  const overlay = document.createElement('div');
  overlay.className = 'port-detail-overlay';
  overlay.innerHTML = `
    <div class="port-detail-card">
      <div class="port-detail-header">
        <div class="port-detail-title">
          <span class="port-dir-badge ${isLong ? 'long' : 'short'}">${isLong ? '▲' : '▼'} ${pos.direction}</span>
          <span class="port-detail-symbol">${pos.symbol}</span>
          <span class="port-detail-strategy">${pos.strategy}</span>
        </div>
        <button class="port-detail-close">✕</button>
      </div>

      <div class="port-detail-pnl ${isProfit ? 'profit' : 'loss'}">
        <span class="port-detail-pnl-val">${sign(pos.unrealizedPnl, 2)}</span>
        <span class="port-detail-pnl-pct">${pct(pos.unrealizedPnlPct)}</span>
      </div>

      <div class="port-detail-grid">
        <div class="port-detail-cell">
          <span class="port-detail-label">Quantity</span>
          <span class="port-detail-val">${pos.quantity.toLocaleString()}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Avg Entry</span>
          <span class="port-detail-val">${$$p(pos.avgCostPrice)}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Current</span>
          <span class="port-detail-val ${isProfit ? 'profit' : 'loss'}">${$$p(pos.currentPrice)}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Market Val</span>
          <span class="port-detail-val">${$$(pos.marketValue)}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Stop Loss</span>
          <span class="port-detail-val loss">${$$p(slPrice)}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Take Profit</span>
          <span class="port-detail-val profit">${$$p(tpPrice)}</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Size</span>
          <span class="port-detail-val">${(posSize * 100).toFixed(1)}% NAV</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">Opened</span>
          <span class="port-detail-val">${timeAgo(pos.openedAt)} ago</span>
        </div>
        <div class="port-detail-cell">
          <span class="port-detail-label">SL %</span>
          <span class="port-detail-val">${(pos.stopLossPct * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div class="port-detail-actions">
        <button class="port-flatten-btn" data-symbol="${pos.symbol}">
          Flatten ${pos.symbol} at Market
        </button>
        <button class="port-detail-close-btn">Cancel</button>
      </div>
    </div>
  `;

  overlay.querySelector('.port-detail-close')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('.port-detail-close-btn')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('.port-flatten-btn')!.addEventListener('click', () => {
    flattenPosition(pos.symbol);
    overlay.remove();
  });

  return overlay;
}

// ── Flatten helpers ───────────────────────────────────────────────────────────

function flattenPosition(symbol: string): void {
  // Try new engine first (portfolioManager)
  const pos = portfolioManager.getPosition(symbol);
  if (pos) {
    const fill: Fill = {
      id: `fill-manual-${Date.now()}`,
      orderId: `manual-${Date.now()}`,
      symbol,
      side: pos.direction === 'LONG' ? 'SELL' : 'BUY',
      fillPrice: pos.currentPrice,
      fillQuantity: pos.quantity,
      totalQuantity: pos.quantity,
      filledAt: Date.now(),
      isPartial: false,
      slippageBps: 0,
    };
    portfolioManager.closePosition(symbol, fill, 'manual');
    showToast(`Flattened ${symbol} at ${$$p(pos.currentPrice)}`);
    return;
  }
  // Legacy engine fallback
  const closed = tradingEngine.closePosition(symbol, 'manual');
  if (closed) {
    showToast(`Closed ${symbol}: ${sign(closed.pnl ?? 0, 2)}`);
  }
}

function flattenAll(): void {
  const snap = portfolioManager.getSnapshot();
  const symbols = snap.positions.map(p => p.symbol);

  if (symbols.length === 0) {
    // Try legacy engine
    const state = tradingEngine.getState();
    const legacySymbols = Array.from(state.positions.keys());
    if (legacySymbols.length === 0) {
      showToast('No open positions to flatten');
      return;
    }
    for (const sym of legacySymbols) tradingEngine.closePosition(sym, 'manual');
    showToast(`Flattened all ${legacySymbols.length} positions`);
    return;
  }

  for (const pos of snap.positions) {
    const fill: Fill = {
      id: `fill-all-${Date.now()}-${pos.symbol}`,
      orderId: `manual-all-${Date.now()}`,
      symbol: pos.symbol,
      side: pos.direction === 'LONG' ? 'SELL' : 'BUY',
      fillPrice: pos.currentPrice,
      fillQuantity: pos.quantity,
      totalQuantity: pos.quantity,
      filledAt: Date.now(),
      isPartial: false,
      slippageBps: 0,
    };
    portfolioManager.closePosition(pos.symbol, fill, 'manual');
  }
  showToast(`⚡ Flattened all ${symbols.length} positions`);
}

// ── Render snapshot ───────────────────────────────────────────────────────────

function renderSnapshot(snap: PortfolioSnapshot): void {
  // NAV value with flash
  if (navValueEl) {
    if (lastNav !== 0 && snap.totalValue !== lastNav) {
      const cls = snap.totalValue > lastNav ? 'flash-up' : 'flash-down';
      navValueEl.classList.add(cls);
      setTimeout(() => navValueEl?.classList.remove(cls), 600);
    }
    navValueEl.textContent = $$(snap.totalValue);
    lastNav = snap.totalValue;
  }

  // Daily P&L
  if (navDailyEl) {
    navDailyEl.textContent = `${sign(snap.dailyPnl, 0)} (${pct(snap.dailyPnl / snap.startingCapital)})`;
    navDailyEl.className = `port-daily-pnl ${snap.dailyPnl >= 0 ? 'profit' : 'loss'}`;
  }

  // Total P&L
  if (navTotalPnlEl) {
    navTotalPnlEl.textContent = `Total: ${sign(snap.totalPnl, 0)} (${pct(snap.totalPnlPct)})`;
    navTotalPnlEl.className = `port-total-pnl ${snap.totalPnl >= 0 ? 'profit' : 'loss'}`;
  }

  // Positions
  renderPositionsTable(snap);

  // Exposure bars
  const total = snap.totalValue;
  const longPct  = total > 0 ? snap.longExposure  / total : 0;
  const shortPct = total > 0 ? snap.shortExposure / total : 0;
  const cashPct  = total > 0 ? snap.cash          / total : 1;

  if (longBarEl)  longBarEl.style.width  = `${Math.min(longPct  * 100, 100).toFixed(1)}%`;
  if (shortBarEl) shortBarEl.style.width = `${Math.min(shortPct * 100, 100).toFixed(1)}%`;
  if (cashBarEl)  cashBarEl.style.width  = `${Math.min(cashPct  * 100, 100).toFixed(1)}%`;
  if (longLblEl)  longLblEl.textContent  = `Long ${(longPct  * 100).toFixed(0)}%`;
  if (shortLblEl) shortLblEl.textContent = `Short ${(shortPct * 100).toFixed(0)}%`;
  if (cashLblEl)  cashLblEl.textContent  = `Cash ${(cashPct  * 100).toFixed(0)}%`;

  // Beta estimate (crude: net exposure / starting capital)
  const beta = (snap.netExposure / snap.startingCapital).toFixed(2);
  if (betaLblEl) betaLblEl.textContent = beta;

  // VaR 95% (simple 2% of gross exposure)
  const var95 = -(snap.grossExposure * 0.02);
  if (varLblEl) varLblEl.textContent = sign(var95, 1);

  // Sector pie
  if (sectorPieWrapEl && sectorLegendEl) {
    const sectors = computeSectors(snap.positions);
    sectorPieWrapEl.innerHTML = '';
    sectorPieWrapEl.appendChild(buildSectorSvg(sectors));
    renderSectorLegend(sectorLegendEl, sectors, snap.grossExposure);
  }

  // Closed trades
  renderClosedTrades(snap.closedTrades);
}

function renderPositionsTable(snap: PortfolioSnapshot): void {
  if (!posTableBodyEl || !posHeaderEl) return;

  posHeaderEl.textContent = `POSITIONS (${snap.openPositionCount} open)`;
  posTableBodyEl.innerHTML = '';

  if (snap.positions.length === 0) {
    const legacy = tradingEngine.getState();
    const legacyPositions = Array.from(legacy.positions.values());
    if (legacyPositions.length > 0) {
      // Fall back to rendering legacy positions
      renderLegacyPositions(legacyPositions, snap.totalValue);
      return;
    }
    posTableBodyEl.innerHTML = `
      <div class="port-empty">
        <div class="port-empty-icon">📊</div>
        <div class="port-empty-title">No open positions yet</div>
        <div class="port-empty-steps">
          <div class="port-empty-step">
            <span class="port-empty-step-num">1</span>
            <span>Scroll up to <strong>SIGNALS</strong></span>
          </div>
          <div class="port-empty-step">
            <span class="port-empty-step-num">2</span>
            <span>Click <strong>Paper Trade</strong> on any signal</span>
          </div>
          <div class="port-empty-step">
            <span class="port-empty-step-num">3</span>
            <span>Position appears here instantly</span>
          </div>
        </div>
        <div class="port-empty-auto">
          Or enable <strong>Auto-trade</strong> in the Signals panel to execute automatically
        </div>
      </div>
    `;
    return;
  }

  const sorted = [...snap.positions]
    .filter(p => p && typeof p.direction === 'string' && typeof p.marketValue === 'number')
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));

  for (const pos of sorted) {
    posTableBodyEl.appendChild(buildPositionRow(pos, snap.totalValue));
  }
}

function buildPositionRow(pos: ManagedPosition, totalValue: number): HTMLElement {
  const isLong    = pos.direction === 'LONG';
  const isProfit  = pos.unrealizedPnl >= 0;
  const sizePct   = totalValue > 0 ? Math.abs(pos.marketValue) / totalValue : 0;
  const displayQty = isLong ? `+${pos.quantity}` : `-${pos.quantity}`;

  const row = document.createElement('div');
  row.className = `port-pos-row ${isLong ? 'pos-long' : 'pos-short'}`;
  row.title = `${pos.strategy} · opened ${timeAgo(pos.openedAt)} ago`;

  row.innerHTML = `
    <div class="port-pos-sym">${pos.symbol}</div>
    <div class="port-pos-qty">${displayQty}</div>
    <div class="port-pos-pnl ${isProfit ? 'profit' : 'loss'}">${sign(pos.unrealizedPnl, 0)}</div>
    <div class="port-pos-bar-cell">
      <div class="port-pos-bar-outer">
        <div class="port-pos-bar-fill ${isLong ? 'long' : 'short'}"
             style="width:${Math.min(sizePct * 100, 100).toFixed(1)}%"></div>
      </div>
      <span class="port-pos-size-pct">${(sizePct * 100).toFixed(1)}%</span>
    </div>
    <button class="port-pos-flatten" title="Flatten position">✕</button>
  `;

  row.querySelector('.port-pos-flatten')!.addEventListener('click', e => {
    e.stopPropagation();
    flattenPosition(pos.symbol);
  });

  row.addEventListener('click', () => {
    document.querySelector('.port-detail-overlay')?.remove();
    document.body.appendChild(buildPositionDetailPopup(pos, totalValue));
  });

  return row;
}

function renderLegacyPositions(positions: Array<{ symbol: string; direction: string; quantity: number; unrealizedPnl: number; marketValue: number; avgEntryPrice: number; currentPrice: number }>, totalValue: number): void {
  if (!posTableBodyEl) return;
  posTableBodyEl.innerHTML = '';
  for (const pos of positions) {
    // Skip malformed positions from stale localStorage
    if (!pos || typeof pos.direction !== 'string' || typeof pos.marketValue !== 'number') continue;
    const isLong   = pos.direction === 'LONG';
    const isProfit = pos.unrealizedPnl >= 0;
    const sizePct  = totalValue > 0 ? Math.abs(pos.marketValue) / totalValue : 0;

    const row = document.createElement('div');
    row.className = `port-pos-row ${isLong ? 'pos-long' : 'pos-short'}`;
    row.innerHTML = `
      <div class="port-pos-sym">${pos.symbol}</div>
      <div class="port-pos-qty">${isLong ? '+' : '-'}${pos.quantity}</div>
      <div class="port-pos-pnl ${isProfit ? 'profit' : 'loss'}">${sign(pos.unrealizedPnl, 0)}</div>
      <div class="port-pos-bar-cell">
        <div class="port-pos-bar-outer">
          <div class="port-pos-bar-fill ${isLong ? 'long' : 'short'}" style="width:${Math.min(sizePct * 100, 100).toFixed(1)}%"></div>
        </div>
        <span class="port-pos-size-pct">${(sizePct * 100).toFixed(1)}%</span>
      </div>
      <button class="port-pos-flatten" title="Flatten">✕</button>
    `;
    row.querySelector('.port-pos-flatten')!.addEventListener('click', e => {
      e.stopPropagation();
      flattenPosition(pos.symbol);
    });
    posTableBodyEl.appendChild(row);
  }
}

function renderRiskStatus(rs: RiskStatus): void {
  if (cbBadgeEl) {
    cbBadgeEl.textContent = CB_LABELS[rs.cbState] ?? rs.cbState;
    cbBadgeEl.style.color = CB_COLORS[rs.cbState] ?? '#94a3b8';
    cbBadgeEl.className = `port-cb-badge cb-${rs.cbState.toLowerCase()}`;
  }

  // Heat gauge — positionSizeMultiplier inverse maps to heat (1.0 = no heat, 0.5 = high heat)
  const heat = 1 - (rs.positionSizeMultiplier ?? 1);
  const heatPct = Math.min(heat * 100, 100);
  if (heatFillEl) {
    heatFillEl.style.width = `${heatPct}%`;
    heatFillEl.style.background = heatPct < 40 ? '#4ade80' : heatPct < 70 ? '#eab308' : '#f87171';
  }
  if (heatLblEl) {
    const heatVal = (heat * 0.8).toFixed(2); // scale to 0.8 max
    heatLblEl.textContent = `${heatVal} / 0.80`;
  }

  // Drawdown bar
  const ddPct = Math.min(rs.drawdownPct * 100, 15);
  const ddMax = 15;
  if (ddFillEl) {
    ddFillEl.style.width = `${(ddPct / ddMax) * 100}%`;
    ddFillEl.style.background = ddPct < 7 ? '#4ade80' : ddPct < 12 ? '#eab308' : '#f87171';
  }
  if (ddLblEl) {
    ddLblEl.textContent = `${rs.drawdownPct.toFixed(1)}% / ${ddMax}%`;
  }
}

function renderSectorLegend(el: HTMLElement, sectors: Map<string, number>, gross: number): void {
  el.innerHTML = '';
  const entries = [...sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [name, val] of entries) {
    const p = gross > 0 ? (val / gross) * 100 : 0;
    const item = document.createElement('div');
    item.className = 'port-sector-item';
    item.innerHTML = `
      <span class="port-sector-dot" style="background:${SECTOR_COLORS[name] ?? '#475569'}"></span>
      <span class="port-sector-name">${name}</span>
      <span class="port-sector-pct">${p.toFixed(0)}%</span>
    `;
    el.appendChild(item);
  }
}

function renderClosedTrades(trades: ClosedTrade[]): void {
  if (!tradesBodyEl) return;
  tradesBodyEl.innerHTML = '';

  const recent = [...trades].sort((a, b) => b.closedAt - a.closedAt).slice(0, 10);

  if (recent.length === 0) {
    tradesBodyEl.innerHTML = `<div class="port-trades-empty">No closed trades yet</div>`;
    return;
  }

  for (const t of recent) {
    const isProfit = t.realizedPnl >= 0;
    const row = document.createElement('div');
    row.className = 'port-trade-row';
    row.innerHTML = `
      <span class="port-trade-dir ${t.direction.toLowerCase()}">${t.direction === 'LONG' ? '▲' : '▼'}</span>
      <span class="port-trade-sym">${t.symbol}</span>
      <span class="port-trade-strat">${t.strategy.slice(0, 3).toUpperCase()}</span>
      <span class="port-trade-pnl ${isProfit ? 'profit' : 'loss'}">${sign(t.realizedPnl, 0)}</span>
      <span class="port-trade-reason">${t.closeReason}</span>
      <span class="port-trade-age">${timeAgo(t.closedAt)}ago</span>
    `;
    tradesBodyEl.appendChild(row);
  }
}

// ── Legacy engine fallback renderer ───────────────────────────────────────────

function renderLegacyState(): void {
  const state = tradingEngine.getState();
  const positions = Array.from(state.positions.values());
  const totalValue = state.totalValue;

  if (navValueEl) navValueEl.textContent = $$(totalValue);
  if (navDailyEl) {
    navDailyEl.textContent = `${sign(state.dailyPnl, 0)} (${pct(state.dailyPnl / 1_000_000)})`;
    navDailyEl.className = `port-daily-pnl ${state.dailyPnl >= 0 ? 'profit' : 'loss'}`;
  }
  const totalPnl = totalValue - 1_000_000;
  if (navTotalPnlEl) {
    navTotalPnlEl.textContent = `Total: ${sign(totalPnl, 0)} (${pct(totalPnl / 1_000_000)})`;
    navTotalPnlEl.className = `port-total-pnl ${totalPnl >= 0 ? 'profit' : 'loss'}`;
  }
  if (posHeaderEl) posHeaderEl.textContent = `POSITIONS (${positions.length} open)`;
  if (posTableBodyEl) {
    renderLegacyPositions(positions, totalValue);
  }
}

// ── Panel builder ─────────────────────────────────────────────────────────────

function buildPortfolioBody(container: HTMLElement): void {

  // ── 1. NAV Header ─────────────────────────────────────────────────────────
  const navSection = document.createElement('div');
  navSection.className = 'port-nav-section';
  navSection.innerHTML = `
    <div class="port-nav-row">
      <div class="port-nav-left">
        <div class="port-nav-label">NET ASSET VALUE</div>
        <div class="port-nav-value" id="port-nav-value">$1,000,000</div>
        <div class="port-daily-pnl" id="port-daily-pnl">+$0 (+0.00%)</div>
        <div class="port-total-pnl" id="port-total-pnl">Total: +$0 (+0.00%)</div>
      </div>
      <div class="port-nav-right">
        <div class="port-cb-badge" id="port-cb-badge">● GREEN</div>
      </div>
    </div>
  `;

  navValueEl   = navSection.querySelector('#port-nav-value');
  navDailyEl   = navSection.querySelector('#port-daily-pnl');
  navTotalPnlEl = navSection.querySelector('#port-total-pnl');
  cbBadgeEl    = navSection.querySelector('#port-cb-badge');

  container.appendChild(navSection);

  // ── 2. Positions table ────────────────────────────────────────────────────
  const posSection = document.createElement('div');
  posSection.className = 'port-pos-section';

  posHeaderEl = document.createElement('div');
  posHeaderEl.className = 'port-section-header';
  posHeaderEl.textContent = 'POSITIONS (0 open)';

  const posTable = document.createElement('div');
  posTable.className = 'port-pos-table';

  const thead = document.createElement('div');
  thead.className = 'port-pos-thead';
  thead.innerHTML = `
    <span>Symbol</span>
    <span>Qty</span>
    <span>P&L</span>
    <span>Size</span>
    <span></span>
  `;

  posTableBodyEl = document.createElement('div');
  posTableBodyEl.className = 'port-pos-tbody';

  posTable.appendChild(thead);
  posTable.appendChild(posTableBodyEl);
  posSection.appendChild(posHeaderEl);
  posSection.appendChild(posTable);
  container.appendChild(posSection);

  // ── 3. Exposure + Risk ────────────────────────────────────────────────────
  const riskSection = document.createElement('div');
  riskSection.className = 'port-risk-section';

  // Exposure column
  const expCol = document.createElement('div');
  expCol.className = 'port-exp-col';
  expCol.innerHTML = `
    <div class="port-subsection-title">EXPOSURE</div>
    <div class="port-exp-row">
      <span class="port-exp-label" id="port-long-lbl">Long 0%</span>
      <div class="port-exp-bar-outer"><div class="port-exp-bar-fill long" id="port-long-bar" style="width:0%"></div></div>
    </div>
    <div class="port-exp-row">
      <span class="port-exp-label" id="port-short-lbl">Short 0%</span>
      <div class="port-exp-bar-outer"><div class="port-exp-bar-fill short" id="port-short-bar" style="width:0%"></div></div>
    </div>
    <div class="port-exp-row">
      <span class="port-exp-label" id="port-cash-lbl">Cash 100%</span>
      <div class="port-exp-bar-outer"><div class="port-exp-bar-fill cash" id="port-cash-bar" style="width:100%"></div></div>
    </div>
  `;

  longBarEl   = expCol.querySelector('#port-long-bar');
  shortBarEl  = expCol.querySelector('#port-short-bar');
  cashBarEl   = expCol.querySelector('#port-cash-bar');
  longLblEl   = expCol.querySelector('#port-long-lbl');
  shortLblEl  = expCol.querySelector('#port-short-lbl');
  cashLblEl   = expCol.querySelector('#port-cash-lbl');

  // Risk column
  const riskCol = document.createElement('div');
  riskCol.className = 'port-risk-col';
  riskCol.innerHTML = `
    <div class="port-subsection-title">RISK STATUS</div>
    <div class="port-risk-row">
      <span class="port-risk-label">Heat</span>
      <div class="port-gauge-outer"><div class="port-gauge-fill" id="port-heat-fill" style="width:0%"></div></div>
      <span class="port-risk-val" id="port-heat-lbl">0.00 / 0.80</span>
    </div>
    <div class="port-risk-row">
      <span class="port-risk-label">DD</span>
      <div class="port-gauge-outer"><div class="port-gauge-fill" id="port-dd-fill" style="width:0%"></div></div>
      <span class="port-risk-val" id="port-dd-lbl">0.0% / 15%</span>
    </div>
    <div class="port-risk-kv">
      <span class="port-risk-label">Beta</span>
      <span class="port-risk-val" id="port-beta-lbl">0.00</span>
    </div>
    <div class="port-risk-kv">
      <span class="port-risk-label">VaR95</span>
      <span class="port-risk-val loss" id="port-var-lbl">—</span>
    </div>
  `;

  heatFillEl = riskCol.querySelector('#port-heat-fill');
  heatLblEl  = riskCol.querySelector('#port-heat-lbl');
  ddFillEl   = riskCol.querySelector('#port-dd-fill');
  ddLblEl    = riskCol.querySelector('#port-dd-lbl');
  betaLblEl  = riskCol.querySelector('#port-beta-lbl');
  varLblEl   = riskCol.querySelector('#port-var-lbl');

  riskSection.appendChild(expCol);
  riskSection.appendChild(riskCol);
  container.appendChild(riskSection);

  // ── 4. Sector donut ───────────────────────────────────────────────────────
  const sectorSection = document.createElement('div');
  sectorSection.className = 'port-sector-section';

  const sectorHdr = document.createElement('div');
  sectorHdr.className = 'port-section-header';
  sectorHdr.textContent = 'SECTOR ALLOCATION';

  const sectorBody = document.createElement('div');
  sectorBody.className = 'port-sector-body';

  sectorPieWrapEl = document.createElement('div');
  sectorPieWrapEl.className = 'port-sector-pie';
  sectorPieWrapEl.appendChild(buildSectorSvg(new Map()));

  sectorLegendEl = document.createElement('div');
  sectorLegendEl.className = 'port-sector-legend';
  sectorLegendEl.innerHTML = `<div class="port-sector-empty">No positions</div>`;

  sectorBody.appendChild(sectorPieWrapEl);
  sectorBody.appendChild(sectorLegendEl);
  sectorSection.appendChild(sectorHdr);
  sectorSection.appendChild(sectorBody);
  container.appendChild(sectorSection);

  // ── 5. Closed trades ──────────────────────────────────────────────────────
  const tradesSection = document.createElement('div');
  tradesSection.className = 'port-trades-section';

  const tradesHdr = document.createElement('div');
  tradesHdr.className = 'port-section-header';
  tradesHdr.textContent = 'RECENT TRADES';

  tradesBodyEl = document.createElement('div');
  tradesBodyEl.className = 'port-trades-body';
  tradesBodyEl.innerHTML = `<div class="port-trades-empty">No closed trades yet</div>`;

  tradesSection.appendChild(tradesHdr);
  tradesSection.appendChild(tradesBodyEl);
  container.appendChild(tradesSection);

  // ── 6. Emergency controls ─────────────────────────────────────────────────
  const emergencyRow = document.createElement('div');
  emergencyRow.className = 'port-emergency-row';

  const flattenAllBtn = document.createElement('button');
  flattenAllBtn.className = 'port-flatten-all-btn';
  flattenAllBtn.innerHTML = '⚡ Flatten All';
  flattenAllBtn.addEventListener('click', () => {
    const snap = portfolioManager.getSnapshot();
    const count = snap.positions.length || tradingEngine.getState().positions.size;
    if (count === 0) { showToast('No open positions'); return; }
    if (!confirm(`Close all ${count} position(s) at market? This cannot be undone.`)) return;
    flattenAll();
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'port-reset-btn';
  resetBtn.textContent = 'Reset Portfolio';
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset portfolio to $1,000,000? All positions and trades will be lost.')) return;
    tradingEngine.resetPortfolio();
    portfolioManager.reset();
    lastNav = 0;
    showToast('Portfolio reset to $1,000,000');
  });

  emergencyRow.appendChild(flattenAllBtn);
  emergencyRow.appendChild(resetBtn);
  container.appendChild(emergencyRow);

  // ── 7. Event subscriptions ────────────────────────────────────────────────

  // Primary: new engine PortfolioSnapshot
  window.addEventListener('trading:portfolio', (e: Event) => {
    const snap = (e as CustomEvent<PortfolioSnapshot>).detail;
    if (snap) renderSnapshot(snap);
  });

  // Primary: risk status
  window.addEventListener('trading:riskStatus', (e: Event) => {
    const rs = (e as CustomEvent<RiskStatus>).detail;
    if (rs) {
      currentRiskStatus = rs;
      renderRiskStatus(rs);
    }
  });

  // Legacy fallback: old engine portfolio-updated
  window.addEventListener('portfolio-updated', () => {
    renderLegacyState();
  });

  // Price feed tick → re-render positions
  window.addEventListener('price-feed-updated', () => {
    const snap = portfolioManager.getSnapshot();
    if (snap.openPositionCount > 0) {
      renderSnapshot(snap);
    } else {
      renderLegacyState();
    }
  });

  // ── 8. Initial render ─────────────────────────────────────────────────────
  const initSnap = portfolioManager.getSnapshot();
  if (initSnap.totalValue > 0) {
    renderSnapshot(initSnap);
  } else {
    renderLegacyState();
  }
  renderRiskStatus(currentRiskStatus);

  // Clock tick to keep "age" labels fresh
  setInterval(() => {
    if (posTableBodyEl) {
      const snap = portfolioManager.getSnapshot();
      if (snap.openPositionCount > 0) renderPositionsTable(snap);
    }
  }, 60_000);
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initPortfolioPanel(): void {
  registerPanel({
    id: 'portfolio',
    title: 'Portfolio & Positions',
    badge: 'PAPER',
    badgeClass: 'mock',
    defaultCollapsed: false,
    init: buildPortfolioBody,
  });
}
