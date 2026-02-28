/**
 * Markets Panel
 * Shows mock data immediately; updates to live Yahoo Finance quotes when they arrive.
 * Adds a Fear & Greed index section below the market grid.
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { MarketQuote, FearGreedData, YahooDetail } from '../lib/data-service';

interface MarketItem {
  symbol: string;
  name: string;
  price: string;
  change: number; // percentage
}

// Symbols align with what Yahoo Finance returns so DOM updates work by matching symbol
const MOCK_MARKETS: MarketItem[] = [
  { symbol: 'SPY', name: 'S&P 500 ETF', price: '520.10', change: 0.52 },
  { symbol: 'GLD', name: 'Gold ETF', price: '234.16', change: 0.87 },
  { symbol: 'USO', name: 'Oil ETF', price: '75.20', change: -1.23 },
  { symbol: 'EURUSD=X', name: 'EUR/USD', price: '1.0847', change: -0.41 },
  { symbol: 'VIX', name: 'Volatility', price: '18.74', change: 6.11 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hours = now.getUTCHours();
  // NYSE: 14:30–21:00 UTC
  return hours >= 14 && hours < 21;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol === 'EURUSD=X') return price.toFixed(4);
  if (price >= 1_000) {
    return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return price.toFixed(2);
}

function fearGreedColor(value: number): string {
  if (value < 25) return 'var(--status-critical)';   // Extreme Fear
  if (value < 45) return 'var(--status-high)';        // Fear
  if (value < 55) return 'rgba(255,255,255,0.5)';     // Neutral
  if (value < 75) return 'var(--status-low)';          // Greed
  return '#00ff88';                                    // Extreme Greed
}

// ── DOM builders ───────────────────────────────────────────────────────────────

function buildMarketItem(item: MarketItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'market-item';
  el.dataset.market = item.symbol; // enables targeted updates

  const symbol = document.createElement('div');
  symbol.className = 'market-symbol';
  symbol.textContent = item.symbol;

  const price = document.createElement('div');
  price.className = 'market-price mono';
  price.textContent = item.price;

  const changeEl = document.createElement('div');
  const isPositive = item.change >= 0;
  changeEl.className = `market-change ${isPositive ? 'positive' : 'negative'}`;
  changeEl.textContent = `${isPositive ? '+' : ''}${item.change.toFixed(2)}%`;

  el.appendChild(symbol);
  el.appendChild(price);
  el.appendChild(changeEl);

  return el;
}

// ── Live data update logic ─────────────────────────────────────────────────────

function applyYahooQuotes(quotes: MarketQuote[], updateTimeEl: HTMLElement): void {
  quotes.forEach((q) => {
    const itemEl = document.querySelector<HTMLElement>(`[data-market="${q.symbol}"]`);
    if (!itemEl) return;

    const priceEl = itemEl.querySelector('.market-price');
    const changeEl = itemEl.querySelector('.market-change');

    if (priceEl) priceEl.textContent = formatPrice(q.price, q.symbol);
    if (changeEl) {
      const isPos = q.changePercent >= 0;
      changeEl.textContent = `${isPos ? '+' : ''}${q.changePercent.toFixed(2)}%`;
      changeEl.className = `market-change ${isPos ? 'positive' : 'negative'}`;
    }
  });

  // Update status badge and timestamp
  updateTimeEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;

  const badge = document.querySelector('[data-panel-id="markets"] .panel-badge');
  if (badge) {
    badge.textContent = 'LIVE';
    badge.className = 'panel-badge live';
  }
}

function applyFearGreed(data: FearGreedData, fgRowEl: HTMLElement): void {
  const color = fearGreedColor(data.value);
  fgRowEl.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'fg-label';
  label.textContent = 'Fear & Greed:';

  const value = document.createElement('span');
  value.className = 'fg-value mono';
  value.style.color = color;
  value.textContent = `${data.value} (${data.classification})`;

  fgRowEl.appendChild(label);
  fgRowEl.appendChild(value);
}

// ── Panel body ─────────────────────────────────────────────────────────────────

function buildMarketsBody(container: HTMLElement): void {
  // Market status bar
  const statusBar = document.createElement('div');
  statusBar.className = 'market-status-bar';

  const statusDot = document.createElement('span');
  const open = isMarketOpen();
  statusDot.className = `market-status-dot ${open ? 'open' : 'closed'}`;

  const statusText = document.createElement('span');
  statusText.className = 'market-status-text';
  statusText.textContent = open ? 'NYSE OPEN' : 'NYSE CLOSED';

  const updateTime = document.createElement('span');
  updateTime.className = 'market-update-time';
  updateTime.textContent = 'Mock data';

  statusBar.appendChild(statusDot);
  statusBar.appendChild(statusText);
  statusBar.appendChild(updateTime);
  container.appendChild(statusBar);

  // 2-column grid
  const grid = document.createElement('div');
  grid.className = 'market-grid';

  MOCK_MARKETS.forEach((item) => {
    grid.appendChild(buildMarketItem(item));
  });

  container.appendChild(grid);

  // Fear & Greed row (shown once data arrives)
  const fgRow = document.createElement('div');
  fgRow.className = 'market-fear-greed';
  fgRow.style.display = 'none'; // hidden until data loads
  container.appendChild(fgRow);

  // ── Listen to data service events ───────────────────────────────────────────

  dataService.addEventListener('yahoo', (e: Event) => {
    const { detail } = e as CustomEvent<YahooDetail>;
    applyYahooQuotes(detail.quotes, updateTime);
  });

  dataService.addEventListener('fear-greed', (e: Event) => {
    const { detail } = e as CustomEvent<FearGreedData>;
    fgRow.style.display = 'flex';
    applyFearGreed(detail, fgRow);
  });

  // Apply pre-loaded data if available (e.g., on hot-reload)
  const existingYahoo = dataService.getYahoo();
  if (existingYahoo) applyYahooQuotes(existingYahoo.quotes, updateTime);

  const existingFg = dataService.getFearGreed();
  if (existingFg) {
    fgRow.style.display = 'flex';
    applyFearGreed(existingFg, fgRow);
  }
}

export function initMarketsPanel(): void {
  registerPanel({
    id: 'markets',
    title: 'Markets',
    badge: 'MOCK',
    badgeClass: 'mock',
    defaultCollapsed: true,
    init: buildMarketsBody,
  });
}
