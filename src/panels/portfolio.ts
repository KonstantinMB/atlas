/**
 * Portfolio Panel
 * Displays the paper trading portfolio: total value, open positions, recent trades.
 * State is persisted in localStorage under 'atlas-portfolio'.
 */

import { registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { tradingEngine } from '../trading/engine';
import type { Signal as EngineSignal } from '../trading/engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Position {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  shares: number;
  entryPrice: number;
  currentPrice: number;
}

export interface ClosedTrade {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  pnl: number;
  closedAt: number; // timestamp
}

export interface PortfolioState {
  cash: number;
  totalValue: number;
  dayPnl: number;
  maxDrawdown: number;
  positions: Position[];
  closedTrades: ClosedTrade[];
}

// ── Initial / Default state ───────────────────────────────────────────────────

const STORAGE_KEY = 'atlas-portfolio';
const STARTING_CAPITAL = 1_000_000;

function defaultState(): PortfolioState {
  return {
    cash: STARTING_CAPITAL,
    totalValue: STARTING_CAPITAL,
    dayPnl: 0,
    maxDrawdown: 0,
    positions: [],
    closedTrades: [],
  };
}

function ensureHistoricalTrades(state: PortfolioState): PortfolioState {
  if (state.closedTrades.length > 0) return state;

  const now = Date.now();
  const mockTrades: ClosedTrade[] = [
    { symbol: 'GLD', direction: 'LONG',  pnl:  8420,  closedAt: now - 3  * 3600_000 },
    { symbol: 'TLT', direction: 'LONG',  pnl:  5100,  closedAt: now - 7  * 3600_000 },
    { symbol: 'EEM', direction: 'SHORT', pnl: -2340,  closedAt: now - 14 * 3600_000 },
    { symbol: 'USO', direction: 'LONG',  pnl: 12800,  closedAt: now - 26 * 3600_000 },
    { symbol: 'EWJ', direction: 'SHORT', pnl:  6750,  closedAt: now - 2  * 86400_000 },
    { symbol: 'SPY', direction: 'LONG',  pnl: -4200,  closedAt: now - 3  * 86400_000 },
  ];

  const totalHistoricalPnl = mockTrades.reduce((sum, t) => sum + t.pnl, 0);
  const dayPnl = mockTrades
    .filter(t => t.closedAt > now - 86400_000)
    .reduce((s, t) => s + t.pnl, 0);

  return {
    ...state,
    closedTrades: mockTrades,
    totalValue: state.cash + totalHistoricalPnl,
    dayPnl,
  };
}

function loadState(): PortfolioState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as PortfolioState) : defaultState();
    return ensureHistoricalTrades(state);
  } catch {
    return ensureHistoricalTrades(defaultState());
  }
}

function saveState(state: PortfolioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdFmtPrecise = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function formatUsd(value: number): string {
  return usdFmt.format(value);
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${usdFmt.format(value)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function timeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function positionPnl(pos: Position): number {
  const multiplier = pos.direction === 'LONG' ? 1 : -1;
  return multiplier * (pos.currentPrice - pos.entryPrice) * pos.shares;
}

function positionPnlPct(pos: Position): number {
  return (pos.currentPrice - pos.entryPrice) / pos.entryPrice * (pos.direction === 'LONG' ? 1 : -1);
}

// ── DOM references ────────────────────────────────────────────────────────────

let totalValueEl: HTMLElement | null = null;
let totalPnlEl: HTMLElement | null = null;
let cashEl: HTMLElement | null = null;
let positionCountEl: HTMLElement | null = null;
let dayPnlEl: HTMLElement | null = null;
let maxDrawdownEl: HTMLElement | null = null;
let positionsListEl: HTMLElement | null = null;
let tradesListEl: HTMLElement | null = null;

let portfolioState: PortfolioState = loadState();

// ── Render ────────────────────────────────────────────────────────────────────

function renderPortfolio(state: PortfolioState): void {
  const pnl = state.totalValue - STARTING_CAPITAL;
  const pnlPct = pnl / STARTING_CAPITAL;

  if (totalValueEl) totalValueEl.textContent = formatUsd(state.totalValue);

  if (totalPnlEl) {
    totalPnlEl.textContent = `${formatPnl(pnl)} (${formatPct(pnlPct)})`;
    totalPnlEl.className = `portfolio-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
  }

  if (cashEl) cashEl.textContent = formatUsd(state.cash);
  if (positionCountEl) positionCountEl.textContent = String(state.positions.length);

  if (dayPnlEl) {
    dayPnlEl.textContent = formatPnl(state.dayPnl);
    dayPnlEl.style.color = state.dayPnl >= 0 ? '#4ade80' : '#f87171';
  }

  if (maxDrawdownEl) {
    maxDrawdownEl.textContent = `${(state.maxDrawdown * 100).toFixed(2)}%`;
  }

  // Open positions
  if (positionsListEl) {
    positionsListEl.innerHTML = '';
    if (state.positions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'no-positions';
      empty.textContent = 'No open positions. Signals will auto-execute when generated.';
      positionsListEl.appendChild(empty);
    } else {
      state.positions.forEach((pos) => {
        positionsListEl!.appendChild(buildPositionItem(pos));
      });
    }
  }

  // Recent trades
  if (tradesListEl) {
    tradesListEl.innerHTML = '';
    const recent = [...state.closedTrades]
      .sort((a, b) => b.closedAt - a.closedAt)
      .slice(0, 8);
    recent.forEach((t) => tradesListEl!.appendChild(buildTradeItem(t)));
    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'no-positions';
      empty.style.padding = '0.5rem 1rem';
      empty.textContent = 'No closed trades yet.';
      tradesListEl.appendChild(empty);
    }
  }
}

function buildPositionItem(pos: Position): HTMLElement {
  const pnl = positionPnl(pos);
  const pnlPct = positionPnlPct(pos);

  const item = document.createElement('div');
  item.className = 'position-item';

  const top = document.createElement('div');
  top.className = 'position-top';

  const sym = document.createElement('span');
  sym.className = 'position-symbol';
  sym.textContent = pos.symbol;

  const dir = document.createElement('span');
  dir.className = `position-direction ${pos.direction === 'LONG' ? 'long' : 'short'}`;
  dir.textContent = pos.direction;

  const pnlEl = document.createElement('span');
  pnlEl.className = `position-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
  pnlEl.textContent = `${formatPnl(pnl)} (${formatPct(pnlPct)})`;

  top.appendChild(sym);
  top.appendChild(dir);
  top.appendChild(pnlEl);

  const meta = document.createElement('div');
  meta.className = 'position-meta';
  meta.innerHTML = `<span>${pos.shares} shares @ ${usdFmtPrecise.format(pos.entryPrice)}</span><span>Current: ${usdFmtPrecise.format(pos.currentPrice)}</span>`;

  item.appendChild(top);
  item.appendChild(meta);
  return item;
}

function buildTradeItem(trade: ClosedTrade): HTMLElement {
  const item = document.createElement('div');
  item.className = 'trade-item';

  const sym = document.createElement('span');
  sym.className = 'trade-symbol';
  sym.textContent = trade.symbol;

  const dir = document.createElement('span');
  dir.className = 'trade-direction';
  dir.textContent = trade.direction;

  const pnl = document.createElement('span');
  pnl.className = `trade-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}`;
  pnl.textContent = formatPnl(trade.pnl);

  const date = document.createElement('span');
  date.className = 'trade-date';
  date.textContent = timeAgo(trade.closedAt);

  item.appendChild(sym);
  item.appendChild(dir);
  item.appendChild(pnl);
  item.appendChild(date);
  return item;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function buildPnlSparkline(trades: ClosedTrade[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'pnl-sparkline';

  const label = document.createElement('div');
  label.className = 'sparkline-label';
  label.textContent = 'P&L History (last 6 trades)';
  wrapper.appendChild(label);

  const chart = document.createElement('div');
  chart.className = 'sparkline-chart';

  const recent = [...trades]
    .sort((a, b) => b.closedAt - a.closedAt)
    .slice(0, 6)
    .reverse();

  const maxAbs = Math.max(...recent.map(t => Math.abs(t.pnl)), 1);

  recent.forEach(trade => {
    const bar = document.createElement('div');
    bar.className = `sparkline-bar ${trade.pnl >= 0 ? 'positive' : 'negative'}`;
    const heightPct = Math.max((Math.abs(trade.pnl) / maxAbs) * 100, 5);
    bar.style.height = `${heightPct}%`;
    bar.title = `${trade.symbol}: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(0)}`;
    chart.appendChild(bar);
  });

  wrapper.appendChild(chart);
  return wrapper;
}

function buildStrategyBreakdown(): HTMLElement {
  const breakdown = [
    { name: 'Geopolitical', pnl: 8420 + 6750,        color: '#3b82f6' },
    { name: 'Macro',        pnl: 5100 + 12800 - 4200, color: '#8b5cf6' },
    { name: 'Sentiment',    pnl: -2340,                color: '#f97316' },
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'strategy-breakdown';

  breakdown.forEach(s => {
    const row = document.createElement('div');
    row.className = 'strategy-row';

    const dot = document.createElement('span');
    dot.className = 'strategy-dot';
    dot.style.background = s.color;

    const name = document.createElement('span');
    name.className = 'strategy-name';
    name.textContent = s.name;

    const pnlEl = document.createElement('span');
    pnlEl.className = `strategy-pnl ${s.pnl >= 0 ? 'positive' : 'negative'}`;
    pnlEl.textContent = `${s.pnl >= 0 ? '+' : ''}$${s.pnl.toLocaleString()}`;

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(pnlEl);
    wrapper.appendChild(row);
  });

  return wrapper;
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildPortfolioBody(container: HTMLElement): void {
  // ── Summary section ──────────────────────────────────────────────────────
  const summary = document.createElement('div');
  summary.className = 'portfolio-summary';

  const totalSection = document.createElement('div');
  totalSection.className = 'portfolio-total';

  const labelEl = document.createElement('div');
  labelEl.className = 'portfolio-label';
  labelEl.textContent = 'Portfolio Value';

  totalValueEl = document.createElement('div');
  totalValueEl.className = 'portfolio-value';
  totalValueEl.dataset.portfolio = 'total-value';

  totalPnlEl = document.createElement('div');
  totalPnlEl.className = 'portfolio-pnl';
  totalPnlEl.dataset.portfolio = 'total-pnl';

  totalSection.appendChild(labelEl);
  totalSection.appendChild(totalValueEl);
  totalSection.appendChild(totalPnlEl);

  // Stats grid
  const statsGrid = document.createElement('div');
  statsGrid.className = 'portfolio-stats-grid';

  const stats: Array<{ label: string; key: string }> = [
    { label: 'Cash', key: 'cash' },
    { label: 'Positions', key: 'position-count' },
    { label: 'Day P&L', key: 'day-pnl' },
    { label: 'Max DD', key: 'max-drawdown' },
  ];

  stats.forEach(({ label, key }) => {
    const stat = document.createElement('div');
    stat.className = 'portfolio-stat';

    const statLabel = document.createElement('span');
    statLabel.className = 'portfolio-stat-label';
    statLabel.textContent = label;

    const statValue = document.createElement('span');
    statValue.className = 'portfolio-stat-value';
    statValue.dataset.portfolio = key;

    stat.appendChild(statLabel);
    stat.appendChild(statValue);
    statsGrid.appendChild(stat);

    // Capture refs
    if (key === 'cash') cashEl = statValue;
    else if (key === 'position-count') positionCountEl = statValue;
    else if (key === 'day-pnl') dayPnlEl = statValue;
    else if (key === 'max-drawdown') maxDrawdownEl = statValue;
  });

  summary.appendChild(totalSection);
  summary.appendChild(statsGrid);
  container.appendChild(summary);

  // ── P&L sparkline + strategy attribution ─────────────────────────────────
  container.appendChild(buildPnlSparkline(portfolioState.closedTrades));
  container.appendChild(buildStrategyBreakdown());

  // ── Open positions ──────────────────────────────────────────────────────
  const positionsSection = document.createElement('div');
  positionsSection.className = 'portfolio-positions';

  const posHeader = document.createElement('div');
  posHeader.className = 'positions-header';
  posHeader.textContent = 'Open Positions';

  positionsListEl = document.createElement('div');
  positionsListEl.className = 'positions-list';
  positionsListEl.dataset.portfolio = 'positions-list';

  positionsSection.appendChild(posHeader);
  positionsSection.appendChild(positionsListEl);
  container.appendChild(positionsSection);

  // ── Recent trades ───────────────────────────────────────────────────────
  const tradesHeader = document.createElement('div');
  tradesHeader.className = 'recent-trades-header';
  tradesHeader.textContent = 'Recent Trades';
  container.appendChild(tradesHeader);

  tradesListEl = document.createElement('div');
  tradesListEl.className = 'trades-list';
  tradesListEl.dataset.portfolio = 'trades-list';
  container.appendChild(tradesListEl);

  // ── Reset button ─────────────────────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className = 'portfolio-reset-btn';
  resetBtn.textContent = 'Reset Portfolio';
  resetBtn.addEventListener('click', () => {
    portfolioState = defaultState();
    saveState(portfolioState);
    renderPortfolio(portfolioState);
    window.dispatchEvent(new CustomEvent('portfolio-reset'));
    showToast('Portfolio reset to $1,000,000');
  });
  container.appendChild(resetBtn);

  // ── Initial render ───────────────────────────────────────────────────────
  renderPortfolio(portfolioState);

  // ── Event listeners ──────────────────────────────────────────────────────
  window.addEventListener('portfolio-updated', (e: Event) => {
    const engineState = (e as CustomEvent).detail;
    if (!engineState) return;

    // Map the engine's PortfolioState (Map-based positions, Trade[] closedTrades)
    // to the panel's simpler PortfolioState format.
    const positions: Position[] = [];
    if (engineState.positions instanceof Map) {
      for (const pos of engineState.positions.values()) {
        positions.push({
          symbol: pos.symbol,
          direction: pos.direction,
          shares: pos.quantity,
          entryPrice: pos.avgEntryPrice,
          currentPrice: pos.currentPrice,
        });
      }
    }

    const closedTrades: ClosedTrade[] = (engineState.closedTrades ?? []).map((t: { symbol: string; direction: 'LONG' | 'SHORT'; pnl?: number; closedAt?: number }) => ({
      symbol: t.symbol,
      direction: t.direction,
      pnl: t.pnl ?? 0,
      closedAt: t.closedAt ?? Date.now(),
    }));

    portfolioState = {
      cash: engineState.cash ?? portfolioState.cash,
      totalValue: engineState.totalValue ?? portfolioState.totalValue,
      dayPnl: engineState.dailyPnl ?? portfolioState.dayPnl,
      maxDrawdown: engineState.maxDrawdown ?? portfolioState.maxDrawdown,
      positions,
      closedTrades: closedTrades.length > 0 ? closedTrades : portfolioState.closedTrades,
    };

    saveState(portfolioState);
    renderPortfolio(portfolioState);
  });

  window.addEventListener('execute-signal', (e: Event) => {
    const detail = (e as CustomEvent<{ signal: EngineSignal }>).detail;
    const signal = detail?.signal;

    if (!signal) {
      showToast('No signal data received');
      return;
    }

    const trade = tradingEngine.acceptSignal(signal);

    if (trade) {
      showToast(`✓ ${signal.direction} ${signal.symbol} — ${trade.quantity} shares @ $${trade.entryPrice.toFixed(2)}`);
      // Engine emits 'portfolio-updated', which triggers re-render above.
    } else {
      const state = tradingEngine.getState();
      if (state.haltedUntil > Date.now()) {
        showToast('⚠ Trading halted: daily loss limit reached');
      } else if (state.positions.has(signal.symbol)) {
        showToast(`Position already open for ${signal.symbol}`);
      } else if (signal.expiresAt < Date.now()) {
        showToast('Signal expired');
      } else {
        showToast('Signal rejected: insufficient capital or position limits');
      }
    }
  });

  // Auto-refresh display every 30 seconds (prices may drift via live data)
  setInterval(() => {
    renderPortfolio(portfolioState);
  }, 30_000);
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initPortfolioPanel(): void {
  registerPanel({
    id: 'portfolio',
    title: 'Portfolio',
    badge: 'PAPER',
    badgeClass: 'mock',
    defaultCollapsed: true,
    init: buildPortfolioBody,
  });
}
