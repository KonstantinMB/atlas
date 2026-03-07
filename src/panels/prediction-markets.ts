/**
 * Prediction Markets Panel
 * Real-time prediction market sentiment from Polymarket CLOB API
 * Shows probability bars, volume, sparklines, and 24h momentum
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { PolymarketMetricsDetail } from '../lib/data-service';
import type { MarketMetrics } from '../lib/prediction-markets';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(volume: number): string {
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}

function truncateTitle(title: string, maxLen = 60): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '…';
}

// ── DOM builders ─────────────────────────────────────────────────────────────

function buildMiniSparkline(history: number[], isPositive: boolean): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'sparkline-mini';

  if (!history || history.length === 0) return wrapper;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 0.01;

  history.forEach((val, i) => {
    const bar = document.createElement('div');
    bar.className = 'sparkline-mini-bar';
    const heightPct = Math.max(15, ((val - min) / range) * 100);
    bar.style.height = `${heightPct}%`;
    bar.style.background = i === history.length - 1
      ? (isPositive ? '#4ade80' : '#f87171')
      : 'var(--text-muted)';
    wrapper.appendChild(bar);
  });

  return wrapper;
}

function buildMomentumBadge(momentum: number): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'prediction-momentum-badge';

  let icon = '—';
  let className = 'neutral';

  if (momentum > 0.1) {
    icon = '▲';
    className = 'bullish';
  } else if (momentum < -0.1) {
    icon = '▼';
    className = 'bearish';
  }

  badge.className = `prediction-momentum-badge ${className}`;
  badge.textContent = icon;
  badge.title = `24h momentum: ${(momentum * 100).toFixed(1)}%`;

  return badge;
}

function buildProbabilityBar(probability: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'prediction-prob-container';

  const label = document.createElement('span');
  label.className = 'prediction-prob-label';
  label.textContent = 'YES';

  const barBg = document.createElement('div');
  barBg.className = 'prediction-prob-bar-bg';

  const barFill = document.createElement('div');
  barFill.className = 'prediction-prob-bar-fill';
  barFill.style.width = `${probability * 100}%`;

  const pct = document.createElement('span');
  pct.className = 'prediction-prob-pct mono';
  pct.textContent = `${(probability * 100).toFixed(0)}%`;

  barBg.appendChild(barFill);
  container.appendChild(label);
  container.appendChild(barBg);
  container.appendChild(pct);

  return container;
}

function buildMarketRow(market: MarketMetrics): HTMLElement {
  const row = document.createElement('div');
  row.className = 'prediction-market-row';
  row.dataset.marketId = market.marketId || '';

  // Title + category
  const header = document.createElement('div');
  header.className = 'prediction-market-header';

  const title = document.createElement('div');
  title.className = 'prediction-market-title';
  title.textContent = truncateTitle(market.title);
  title.title = market.title; // Full title on hover

  const category = document.createElement('span');
  category.className = 'prediction-market-category';
  category.textContent = market.category || 'Global Events';

  header.appendChild(title);
  header.appendChild(category);
  row.appendChild(header);

  // Probability bar
  row.appendChild(buildProbabilityBar(market.probability));

  // Volume + Sparkline + Momentum
  const footer = document.createElement('div');
  footer.className = 'prediction-market-footer';

  const volume = document.createElement('span');
  volume.className = 'prediction-market-volume';
  volume.textContent = `Vol: ${formatVolume(market.volume24h)}`;

  footer.appendChild(volume);

  // Sparkline
  if (market.history24h && market.history24h.length > 0) {
    const isPositive = market.sentimentMomentum >= 0;
    footer.appendChild(buildMiniSparkline(market.history24h, isPositive));
  }

  // Momentum badge
  footer.appendChild(buildMomentumBadge(market.sentimentMomentum));

  row.appendChild(footer);

  return row;
}

function buildLoadingSkeleton(): HTMLElement {
  const skeleton = document.createElement('div');
  skeleton.className = 'prediction-loading-skeleton';
  skeleton.textContent = 'Loading prediction markets...';
  return skeleton;
}

function buildEmptyState(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'prediction-empty-state';
  empty.innerHTML = `
    <div class="prediction-empty-title">No prediction market data</div>
    <div class="prediction-empty-hint">If this persists, check API or network. Data streams from Polymarket every 5 min.</div>
  `;
  return empty;
}

// ── Live update helpers ───────────────────────────────────────────────────────

function applyPolymarketMetrics(container: HTMLElement, data: PolymarketMetricsDetail): void {
  // Clear loading/empty states
  container.innerHTML = '';

  if (!data.markets || data.markets.length === 0) {
    container.appendChild(buildEmptyState());
    return;
  }

  // Render all markets
  const list = document.createElement('div');
  list.className = 'prediction-markets-list';
  list.dataset.predictionList = '1';

  data.markets.forEach(market => {
    list.appendChild(buildMarketRow(market));
  });

  container.appendChild(list);

  // Update badge
  setLiveBadge();
}

function setLiveBadge(): void {
  const badge = document.querySelector('[data-panel-id="prediction-markets"] .panel-badge');
  if (badge) {
    badge.textContent = 'LIVE';
    badge.className = 'panel-badge live';
  }
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildPredictionMarketsBody(container: HTMLElement): void {
  // Initial loading state
  container.appendChild(buildLoadingSkeleton());

  // Wire live data
  dataService.addEventListener('polymarket-metrics', (e: Event) => {
    const { detail } = e as CustomEvent<PolymarketMetricsDetail>;
    applyPolymarketMetrics(container, detail);
  });

  // Apply already-cached data if available
  const cachedMetrics = dataService.getPolymarketMetrics();
  if (cachedMetrics) {
    applyPolymarketMetrics(container, cachedMetrics);
  }
}

export function initPredictionMarketsPanel(): void {
  registerPanel({
    id: 'prediction-markets',
    title: 'Prediction Markets',
    badge: 'LOADING',
    badgeClass: 'loading',
    defaultCollapsed: true,
    init: buildPredictionMarketsBody,
  });
}
