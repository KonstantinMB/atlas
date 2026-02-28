/**
 * Portfolio Panel — Live Paper Trading Dashboard
 * Single source of truth: tradingEngine.getState()
 * Updates on: 'portfolio-updated', 'price-feed-updated'
 */

import { registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { tradingEngine } from '../trading/engine';
import type { PortfolioState, Position, Trade, Signal } from '../trading/engine';

const STARTING_CAPITAL = 1_000_000;
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function fmtUsd(v: number): string { return usdFmt.format(v); }
function fmtSign(v: number): string { return (v >= 0 ? '+' : '') + usdFmt.format(v); }
function fmtPct(v: number): string { return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%'; }
function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
let portfolioValueEl: HTMLElement | null = null;
let totalPnlEl: HTMLElement | null = null;
let cashEl: HTMLElement | null = null;
let posCountEl: HTMLElement | null = null;
let dayPnlEl: HTMLElement | null = null;
let maxDdEl: HTMLElement | null = null;
let priceFeedEl: HTMLElement | null = null;
let positionsListEl: HTMLElement | null = null;
let tradesListEl: HTMLElement | null = null;

let lastDisplayedValue = 0;

// ── Render ────────────────────────────────────────────────────────────────────

function renderState(state: PortfolioState): void {
  const totalPnl = state.totalValue - STARTING_CAPITAL;
  const totalPnlPct = totalPnl / STARTING_CAPITAL;

  if (portfolioValueEl) {
    const changed = lastDisplayedValue !== 0 && state.totalValue !== lastDisplayedValue;
    portfolioValueEl.textContent = fmtUsd(state.totalValue);
    if (changed) {
      const cls = state.totalValue > lastDisplayedValue ? 'flash-up' : 'flash-down';
      portfolioValueEl.classList.add(cls);
      setTimeout(() => portfolioValueEl?.classList.remove(cls), 600);
    }
    lastDisplayedValue = state.totalValue;
  }

  if (totalPnlEl) {
    totalPnlEl.textContent = `${fmtSign(totalPnl)} (${fmtPct(totalPnlPct)})`;
    totalPnlEl.className = `portfolio-pnl ${totalPnl >= 0 ? 'positive' : 'negative'}`;
  }

  if (cashEl) cashEl.textContent = fmtUsd(state.cash);
  if (posCountEl) posCountEl.textContent = String(state.positions.size);

  if (dayPnlEl) {
    dayPnlEl.textContent = fmtSign(state.dailyPnl);
    dayPnlEl.style.color = state.dailyPnl >= 0 ? '#4ade80' : '#f87171';
  }

  if (maxDdEl) {
    maxDdEl.textContent = `${(state.maxDrawdown * 100).toFixed(2)}%`;
  }

  renderPositions(state);
  renderTrades(state);
}

function renderPositions(state: PortfolioState): void {
  if (!positionsListEl) return;
  positionsListEl.innerHTML = '';

  const positions = Array.from(state.positions.values());
  if (positions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-positions';
    empty.textContent = 'No open positions — signals will auto-execute when generated';
    positionsListEl.appendChild(empty);
    return;
  }

  positions.forEach(pos => positionsListEl!.appendChild(buildPositionCard(pos, state)));
}

function buildPositionCard(pos: Position, state: PortfolioState): HTMLElement {
  const card = document.createElement('div');
  card.className = 'position-card';

  const header = document.createElement('div');
  header.className = 'pos-header';

  const left = document.createElement('div');
  left.className = 'pos-left';

  const sym = document.createElement('span');
  sym.className = 'pos-symbol';
  sym.textContent = pos.symbol;

  const dir = document.createElement('span');
  dir.className = `pos-direction ${pos.direction.toLowerCase()}`;
  dir.textContent = pos.direction;

  const age = document.createElement('span');
  age.className = 'pos-age';
  age.textContent = timeAgo(pos.openedAt);

  left.appendChild(sym);
  left.appendChild(dir);
  left.appendChild(age);

  const isPos = pos.unrealizedPnl >= 0;
  const pnlEl = document.createElement('span');
  pnlEl.className = `pos-pnl ${isPos ? 'positive' : 'negative'}`;
  pnlEl.textContent = `${fmtSign(pos.unrealizedPnl)} (${fmtPct(pos.unrealizedPnlPct)})`;

  header.appendChild(left);
  header.appendChild(pnlEl);
  card.appendChild(header);

  const priceRow = document.createElement('div');
  priceRow.className = 'pos-price-row';
  priceRow.innerHTML = `
    <span class="pos-price-label">Entry</span>
    <span class="pos-price-value">${usdPrecise.format(pos.avgEntryPrice)}</span>
    <span class="pos-price-arrow">→</span>
    <span class="pos-price-label">Now</span>
    <span class="pos-price-value ${isPos ? 'positive' : 'negative'}">${usdPrecise.format(pos.currentPrice)}</span>
    <span class="pos-qty">${pos.quantity.toLocaleString()} shares</span>
  `;
  card.appendChild(priceRow);

  const trade = state.openTrades.find(t => t.symbol === pos.symbol && t.status === 'OPEN');
  if (trade) {
    const slPrice = pos.direction === 'LONG'
      ? trade.entryPrice * (1 - trade.stopLossPct)
      : trade.entryPrice * (1 + trade.stopLossPct);
    const tpPrice = pos.direction === 'LONG'
      ? trade.entryPrice * (1 + trade.takeProfitPct)
      : trade.entryPrice * (1 - trade.takeProfitPct);

    const levelsRow = document.createElement('div');
    levelsRow.className = 'pos-levels-row';
    levelsRow.innerHTML = `
      <span class="pos-sl">SL ${usdPrecise.format(slPrice)}</span>
      <span class="pos-tp">TP ${usdPrecise.format(tpPrice)}</span>
    `;
    card.appendChild(levelsRow);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'pos-close-btn';
  closeBtn.textContent = 'Close Position';
  closeBtn.addEventListener('click', () => {
    const closed = tradingEngine.closePosition(pos.symbol, 'manual');
    if (closed) {
      showToast(`✓ Closed ${pos.symbol}: ${fmtSign(closed.pnl ?? 0)}`);
    }
  });
  card.appendChild(closeBtn);

  return card;
}

function renderTrades(state: PortfolioState): void {
  if (!tradesListEl) return;
  tradesListEl.innerHTML = '';

  const allClosed = [...state.closedTrades]
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
    .slice(0, 10);

  if (allClosed.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-positions';
    empty.style.padding = '0.5rem 1rem';
    empty.textContent = 'No closed trades yet.';
    tradesListEl.appendChild(empty);
    return;
  }

  allClosed.forEach(t => tradesListEl!.appendChild(buildTradeRow(t)));
}

function buildTradeRow(trade: Trade): HTMLElement {
  const row = document.createElement('div');
  row.className = 'trade-item';

  const sym = document.createElement('span');
  sym.className = 'trade-symbol';
  sym.textContent = trade.symbol;

  const dir = document.createElement('span');
  dir.className = 'trade-direction';
  dir.textContent = trade.direction;

  const strat = document.createElement('span');
  strat.className = 'trade-strategy';
  strat.textContent = trade.strategy.toUpperCase().slice(0, 3);

  const isPos = (trade.pnl ?? 0) >= 0;
  const pnl = document.createElement('span');
  pnl.className = `trade-pnl ${isPos ? 'positive' : 'negative'}`;
  pnl.textContent = fmtSign(trade.pnl ?? 0);

  const date = document.createElement('span');
  date.className = 'trade-date';
  date.textContent = trade.closedAt ? timeAgo(trade.closedAt) : '—';

  row.appendChild(sym);
  row.appendChild(dir);
  row.appendChild(strat);
  row.appendChild(pnl);
  row.appendChild(date);
  return row;
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildPortfolioBody(container: HTMLElement): void {
  // ── Header metrics ──────────────────────────────────────────────────────
  const summary = document.createElement('div');
  summary.className = 'portfolio-summary';

  const totalSection = document.createElement('div');
  totalSection.className = 'portfolio-total';

  const lbl = document.createElement('div');
  lbl.className = 'portfolio-label';
  lbl.textContent = 'Portfolio Value';

  portfolioValueEl = document.createElement('div');
  portfolioValueEl.className = 'portfolio-value';

  totalPnlEl = document.createElement('div');
  totalPnlEl.className = 'portfolio-pnl';

  priceFeedEl = document.createElement('div');
  priceFeedEl.className = 'price-feed-indicator';
  priceFeedEl.innerHTML = '<span class="pf-dot"></span><span class="pf-label">Waiting for price feed…</span>';

  totalSection.appendChild(lbl);
  totalSection.appendChild(portfolioValueEl);
  totalSection.appendChild(totalPnlEl);
  totalSection.appendChild(priceFeedEl);
  summary.appendChild(totalSection);

  // Stats grid
  const statsGrid = document.createElement('div');
  statsGrid.className = 'portfolio-stats-grid';

  const statDefs: Array<{ label: string; ref: (el: HTMLElement) => void }> = [
    { label: 'Cash',      ref: el => { cashEl = el; } },
    { label: 'Positions', ref: el => { posCountEl = el; } },
    { label: 'Day P&L',   ref: el => { dayPnlEl = el; } },
    { label: 'Max DD',    ref: el => { maxDdEl = el; } },
  ];

  statDefs.forEach(({ label, ref }) => {
    const stat = document.createElement('div');
    stat.className = 'portfolio-stat';

    const sl = document.createElement('span');
    sl.className = 'portfolio-stat-label';
    sl.textContent = label;

    const sv = document.createElement('span');
    sv.className = 'portfolio-stat-value';
    ref(sv);

    stat.appendChild(sl);
    stat.appendChild(sv);
    statsGrid.appendChild(stat);
  });

  summary.appendChild(statsGrid);
  container.appendChild(summary);

  // ── Open Positions ──────────────────────────────────────────────────────
  const posSection = document.createElement('div');
  posSection.className = 'portfolio-positions';

  const posHdr = document.createElement('div');
  posHdr.className = 'positions-header';
  posHdr.textContent = 'Open Positions';

  positionsListEl = document.createElement('div');
  positionsListEl.className = 'positions-list';

  posSection.appendChild(posHdr);
  posSection.appendChild(positionsListEl);
  container.appendChild(posSection);

  // ── Closed Trades ───────────────────────────────────────────────────────
  const tradesHdr = document.createElement('div');
  tradesHdr.className = 'recent-trades-header';
  tradesHdr.textContent = 'Trade History';
  container.appendChild(tradesHdr);

  tradesListEl = document.createElement('div');
  tradesListEl.className = 'trades-list';
  container.appendChild(tradesListEl);

  // ── Reset button ────────────────────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className = 'portfolio-reset-btn';
  resetBtn.textContent = 'Reset Portfolio';
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset portfolio to $1,000,000?')) return;
    tradingEngine.resetPortfolio();
    lastDisplayedValue = 0;
    showToast('Portfolio reset to $1,000,000');
  });
  container.appendChild(resetBtn);

  // ── Initial render from engine ──────────────────────────────────────────
  renderState(tradingEngine.getState());

  // ── Event listeners ─────────────────────────────────────────────────────
  window.addEventListener('portfolio-updated', (e: Event) => {
    const state = (e as CustomEvent<PortfolioState>).detail;
    if (state) renderState(state);
  });

  window.addEventListener('price-feed-updated', (e: Event) => {
    const detail = (e as CustomEvent<{ source: string; count: number; at: number }>).detail;
    if (!priceFeedEl) return;
    priceFeedEl.innerHTML = `<span class="pf-dot live"></span><span class="pf-label">LIVE · ${detail.source.toUpperCase()} · ${detail.count} prices · ${new Date(detail.at).toLocaleTimeString()}</span>`;
    // Also refresh positions with latest prices from engine
    renderState(tradingEngine.getState());
  });

  window.addEventListener('execute-signal', (e: Event) => {
    const detail = (e as CustomEvent<{ signal: Signal }>).detail;
    const signal = detail?.signal;
    if (!signal) return;

    const trade = tradingEngine.acceptSignal(signal);
    if (trade) {
      showToast(`✓ ${signal.direction} ${signal.symbol} — ${trade.quantity} shares @ ${usdPrecise.format(trade.entryPrice)}`);
    } else {
      const st = tradingEngine.getState();
      if (st.haltedUntil > Date.now()) {
        showToast('⚠ Trading halted — daily loss limit reached');
      } else if (st.positions.has(signal.symbol)) {
        showToast(`Position already open for ${signal.symbol}`);
      } else if (signal.expiresAt < Date.now()) {
        showToast('Signal expired');
      } else {
        showToast('Signal rejected: insufficient capital or position limits');
      }
    }
  });

  // Refresh every 30s for clock drift / age labels
  setInterval(() => renderState(tradingEngine.getState()), 30_000);
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initPortfolioPanel(): void {
  registerPanel({
    id: 'portfolio',
    title: 'Portfolio',
    badge: 'PAPER',
    badgeClass: 'mock',
    defaultCollapsed: false,
    init: buildPortfolioBody,
  });
}
