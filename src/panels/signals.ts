/**
 * Signals Panel — Phase 4e Part 1
 *
 * Real-time trading signals with:
 *  - Live subscription to 'trading:signals' (StateSync) + fallback mock data
 *  - Colour-coded strategy badges (GEO / SENT / MOM / MACRO / CROSS)
 *  - Horizontal confidence fill bar
 *  - Green tint for LONG, red tint for SHORT
 *  - ★ multi-strategy consensus row
 *  - Click → detail popup with full reasoning
 *  - Map icon → dispatches globe fly-to event
 *  - Paper Trade button per signal (manual) + auto-execute toggle (global)
 *  - Strategy filter pills
 *  - Virtual scrolling for 50+ signals (windowed DOM, item ~120 px high)
 *  - Live pulsing dot + active-signal count badge
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { dataService } from '../lib/data-service';
import type { Signal } from '../trading/engine';
import { executionLoop } from '../trading/engine/execution-loop';

// ── Strategy config ──────────────────────────────────────────────────────────

interface StrategyMeta { badge: string; color: string; cssClass: string }

const STRATEGY_META: Record<string, StrategyMeta> = {
  geopolitical:        { badge: 'GEO',      color: '#f97316', cssClass: 'geo'      },
  GEOPOLITICAL:        { badge: 'GEO',      color: '#f97316', cssClass: 'geo'      },
  sentiment:           { badge: 'SENT',     color: '#3b82f6', cssClass: 'sent'     },
  SENTIMENT:           { badge: 'SENT',     color: '#3b82f6', cssClass: 'sent'     },
  momentum:            { badge: 'MOM',      color: '#a855f7', cssClass: 'mom'      },
  MOMENTUM:            { badge: 'MOM',      color: '#a855f7', cssClass: 'mom'      },
  macro:               { badge: 'MACRO',    color: '#22c55e', cssClass: 'macro'    },
  MACRO:               { badge: 'MACRO',    color: '#22c55e', cssClass: 'macro'    },
  'cross-asset':       { badge: 'CROSS',    color: '#14b8a6', cssClass: 'cross'    },
  'prediction-markets':{ badge: 'PRED-MKT', color: '#06b6d4', cssClass: 'pred-mkt' },
  'PREDICTION-MARKETS':{ badge: 'PRED-MKT', color: '#06b6d4', cssClass: 'pred-mkt' },
};

function getMeta(strategy: string): StrategyMeta {
  return STRATEGY_META[strategy] ?? { badge: strategy.slice(0, 4).toUpperCase(), color: '#94a3b8', cssClass: 'other' };
}

// ── Geographic fly-to mapping ─────────────────────────────────────────────────

const SYMBOL_COORDS: Record<string, [number, number]> = {
  USO: [45, 25], XLE: [48, 25], VDE: [48, 25],     // Middle East (oil)
  EEM: [104, 15], FXI: [116, 30], VWO: [100, 20],  // EM / Asia
  GLD: [28, 2],  IAU: [28, 2],  GDXJ: [28, 2],     // Africa/Gold
  TLT: [-77, 38.9], IEF: [-77, 38.9],               // Washington (Fed)
  SPY: [-74, 40.7], DIA: [-74, 40.7], IWM: [-74, 40.7],
  QQQ: [-122, 37.4], XLK: [-122, 37.4],             // Silicon Valley
  XLF: [-73.9, 40.7],                               // Wall Street
  XLV: [-77, 38.9],                                 // DC (healthcare policy)
  XLI: [-79.9, 40.4],                               // Pittsburgh (industry)
  XLP: [-87.6, 41.8],                               // Chicago (consumer)
  XLB: [-105, 39.5],                                // Denver (materials)
  BTC: [139.7, 35.7], ETH: [139.7, 35.7],           // Tokyo (crypto regulation)
};

function getRegionFor(signal: Signal): [number, number] | null {
  // Try symbol map first
  if (SYMBOL_COORDS[signal.symbol]) return SYMBOL_COORDS[signal.symbol]!;

  // Country-name heuristics from reasoning text
  const r = signal.reasoning.toLowerCase();
  if (r.includes('iran') || r.includes('middle east') || r.includes('opec')) return [48, 25];
  if (r.includes('china') || r.includes('taiwan')) return [116, 30];
  if (r.includes('russia')) return [37.6, 55.7];
  if (r.includes('europe') || r.includes('euro')) return [10, 50];
  if (r.includes('fed') || r.includes('fomc') || r.includes('yield curve')) return [-77, 38.9];
  return null;
}

// ── Mock seed data (replaced immediately on live signal arrival) ──────────────

const MOCK_SIGNALS: Signal[] = [
  {
    id: 'mock-001',
    timestamp: Date.now() - 12 * 60_000,
    strategy: 'geopolitical',
    symbol: 'USO',
    direction: 'LONG',
    confidence: 0.82,
    reasoning: 'Iran CII +3.1σ deviation → oil supply disruption risk. Convergence with 3 military-base anomalies detected.',
    targetReturn: 0.12,
    stopLoss: 0.05,
    takeProfit: 0.12,
    expiresAt: Date.now() + 60 * 60_000,
  },
  {
    id: 'mock-002',
    timestamp: Date.now() - 28 * 60_000,
    strategy: 'sentiment',
    symbol: 'QQQ',
    direction: 'SHORT',
    confidence: 0.61,
    reasoning: 'Tech sector GDELT tone score -3.2 (4h rolling). Negative momentum accelerating across semiconductor headlines.',
    targetReturn: 0.08,
    stopLoss: 0.04,
    takeProfit: 0.08,
    expiresAt: Date.now() + 4 * 60 * 60_000,
  },
  {
    id: 'mock-003',
    timestamp: Date.now() - 45 * 60_000,
    strategy: 'macro',
    symbol: 'GLD',
    direction: 'LONG',
    confidence: 0.78,
    reasoning: 'Yield curve inversion -0.6%, VIX elevated at 28 → crisis flight-to-safety signal. FRED data confirms slowdown.',
    targetReturn: 0.10,
    stopLoss: 0.04,
    takeProfit: 0.10,
    expiresAt: Date.now() + 2 * 60 * 60_000,
  },
  {
    id: 'mock-004',
    timestamp: Date.now() - 67 * 60_000,
    strategy: 'geopolitical',
    symbol: 'GLD',
    direction: 'LONG',
    confidence: 0.74,
    reasoning: 'Middle East convergence score: 0.78 (high). Multiple instability indices elevated. Safe-haven rotation expected.',
    targetReturn: 0.09,
    stopLoss: 0.03,
    takeProfit: 0.09,
    expiresAt: Date.now() + 3 * 60 * 60_000,
  },
];

// ── Consensus detection ───────────────────────────────────────────────────────

interface Consensus {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  strategies: string[];
  combinedConfidence: number;
}

function detectConsensus(signals: Signal[]): Consensus[] {
  const active = signals.filter(s => s.expiresAt > Date.now());
  const groups = new Map<string, Signal[]>();

  for (const sig of active) {
    const key = `${sig.symbol}:${sig.direction}`;
    const list = groups.get(key) ?? [];
    list.push(sig);
    groups.set(key, list);
  }

  const result: Consensus[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const [symbol, direction] = key.split(':') as [string, string];
    const strategies = [...new Set(group.map(s => getMeta(s.strategy).badge))];
    const bayesian = 1 - group.reduce((p, s) => p * (1 - s.confidence), 1);
    result.push({
      symbol,
      direction: direction as 'LONG' | 'SHORT',
      strategies,
      combinedConfidence: bayesian,
    });
  }

  return result.sort((a, b) => b.combinedConfidence - a.combinedConfidence);
}

// ── Virtual scroll ────────────────────────────────────────────────────────────

const ITEM_HEIGHT  = 128;   // px — must match CSS
const BUFFER_COUNT = 3;     // extra items above/below viewport
const VISIBLE_COUNT = 10;   // items rendered at once

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtExpiry(ms: number): string {
  const remaining = ms - Date.now();
  if (remaining <= 0) return 'expired';
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function rrRatio(sig: Signal): string {
  if (sig.stopLoss <= 0) return '—';
  return (sig.takeProfit / sig.stopLoss).toFixed(1) + ':1';
}

// ── Signal item builder ───────────────────────────────────────────────────────

function buildSignalRow(
  sig: Signal,
  consensus: boolean,
  onTrade: (sig: Signal, btn: HTMLButtonElement) => void,
  onFlyTo: (sig: Signal) => void,
  onDetail: (sig: Signal) => void
): HTMLElement {
  const meta = getMeta(sig.strategy);
  const isLong = sig.direction === 'LONG';
  const isExpired = sig.expiresAt <= Date.now();
  const confPct = Math.round(sig.confidence * 100);

  const row = document.createElement('div');
  row.className = `sig-row sig-${isLong ? 'long' : 'short'}${isExpired ? ' sig-expired' : ''}`;
  row.dataset.signalId = sig.id;

  row.innerHTML = `
    <div class="sig-row-header">
      <span class="sig-dir ${isLong ? 'long' : 'short'}">${isLong ? '▲' : '▼'} ${sig.direction}</span>
      <span class="sig-symbol">${sig.symbol}</span>
      <span class="sig-badge sig-badge-${meta.cssClass}" style="--badge-color:${meta.color}">${meta.badge}</span>
      ${consensus ? '<span class="sig-consensus-star" title="Multi-strategy consensus">★</span>' : ''}
      <div class="sig-conf-wrap" title="Confidence: ${confPct}%">
        <div class="sig-conf-bar-outer"><div class="sig-conf-fill" style="width:${confPct}%;background:${isLong ? '#4ade80' : '#f87171'}"></div></div>
        <span class="sig-conf-label">${confPct}%</span>
      </div>
    </div>
    <div class="sig-reasoning">${sig.reasoning}</div>
    <div class="sig-meta-row">
      <span class="sig-time">${fmt(sig.timestamp)}</span>
      <span class="sig-sep">·</span>
      <span class="sig-expiry ${isExpired ? 'expired' : ''}">expires ${fmtExpiry(sig.expiresAt)}</span>
      <span class="sig-targets">TP <span class="tp">+${pct(sig.takeProfit)}</span> · SL <span class="sl">-${pct(sig.stopLoss)}</span> · R/R <span class="rr">${rrRatio(sig)}</span></span>
    </div>
    <div class="sig-actions">
      <button class="sig-btn sig-trade-btn" data-signal-id="${sig.id}" ${isExpired ? 'disabled' : ''}>
        Paper Trade
      </button>
      <button class="sig-btn sig-map-btn" title="Fly globe to region">
        🌍
      </button>
      <button class="sig-btn sig-detail-btn" title="Full detail">
        ⋯
      </button>
    </div>
  `;

  // Wire buttons
  const tradeBtn = row.querySelector<HTMLButtonElement>('.sig-trade-btn')!;
  const mapBtn   = row.querySelector<HTMLButtonElement>('.sig-map-btn')!;
  const detailBtn = row.querySelector<HTMLButtonElement>('.sig-detail-btn')!;

  tradeBtn.addEventListener('click', e => { e.stopPropagation(); onTrade(sig, tradeBtn); });
  mapBtn.addEventListener('click',   e => { e.stopPropagation(); onFlyTo(sig); });
  detailBtn.addEventListener('click', e => { e.stopPropagation(); onDetail(sig); });
  row.addEventListener('click', () => onDetail(sig));

  return row;
}

// ── Detail popup ──────────────────────────────────────────────────────────────

function buildDetailPopup(sig: Signal): HTMLElement {
  const meta   = getMeta(sig.strategy);
  const isLong = sig.direction === 'LONG';
  const confPct = Math.round(sig.confidence * 100);

  const overlay = document.createElement('div');
  overlay.className = 'sig-detail-overlay';
  overlay.innerHTML = `
    <div class="sig-detail-card">
      <div class="sig-detail-header">
        <div class="sig-detail-title">
          <span class="sig-dir ${isLong ? 'long' : 'short'}">${isLong ? '▲' : '▼'} ${sig.direction}</span>
          <span class="sig-detail-symbol">${sig.symbol}</span>
          <span class="sig-badge sig-badge-${meta.cssClass}" style="--badge-color:${meta.color}">${meta.badge}</span>
        </div>
        <button class="sig-detail-close">✕</button>
      </div>

      <div class="sig-detail-conf-row">
        <span class="sig-detail-label">Confidence</span>
        <div class="sig-detail-conf-bar">
          <div class="sig-conf-fill" style="width:${confPct}%; background:${meta.color}"></div>
        </div>
        <span class="sig-detail-conf-val" style="color:${meta.color}">${confPct}%</span>
      </div>

      <div class="sig-detail-body">
        <div class="sig-detail-reasoning">${sig.reasoning}</div>
      </div>

      <div class="sig-detail-grid">
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Target Return</span>
          <span class="sig-detail-val tp">+${pct(sig.targetReturn)}</span>
        </div>
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Stop Loss</span>
          <span class="sig-detail-val sl">-${pct(sig.stopLoss)}</span>
        </div>
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Risk / Reward</span>
          <span class="sig-detail-val rr">${rrRatio(sig)}</span>
        </div>
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Strategy</span>
          <span class="sig-detail-val">${sig.strategy}</span>
        </div>
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Generated</span>
          <span class="sig-detail-val">${fmt(sig.timestamp)}</span>
        </div>
        <div class="sig-detail-cell">
          <span class="sig-detail-label">Expires</span>
          <span class="sig-detail-val ${sig.expiresAt <= Date.now() ? 'sl' : ''}">${fmtExpiry(sig.expiresAt)}</span>
        </div>
      </div>

      <button class="sig-detail-trade-btn" id="sig-detail-trade" ${sig.expiresAt <= Date.now() ? 'disabled' : ''}>
        Paper Trade ${sig.direction} ${sig.symbol}
      </button>
    </div>
  `;

  overlay.querySelector('.sig-detail-close')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#sig-detail-trade')!.addEventListener('click', async () => {
    const btn = overlay.querySelector('#sig-detail-trade') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    const result = await executionLoop.executeSignal(sig);
    overlay.remove();
    if (result.approved && result.fill) {
      showToast(`✓ ${sig.direction} ${sig.symbol} — ${result.fill.fillQuantity} shares @ $${result.fill.fillPrice.toFixed(2)}`);
    } else {
      showToast(result.reason ?? 'Order rejected', 'error');
    }
  });

  return overlay;
}

// ── Panel state ───────────────────────────────────────────────────────────────

let allSignals: Signal[]     = [...MOCK_SIGNALS];
let filteredSignals: Signal[] = [...MOCK_SIGNALS];
let predMarketSignals: Signal[] = [];
let filterStrategy: string | null = null;
let autoExecute = false;
let isLive = false;

// Virtual scroll refs
let listContainer: HTMLElement | null  = null;
let countBadge: HTMLElement | null     = null;
let liveDot: HTMLElement | null        = null;
let autoToggleEl: HTMLInputElement | null = null;
let filterRowEl: HTMLElement | null    = null;
let consensusRowEl: HTMLElement | null = null;

// ── Virtual scroll engine ─────────────────────────────────────────────────────

let scrollTop = 0;
let containerHeight = 0;

function renderVirtualList(): void {
  if (!listContainer) return;

  const total = filteredSignals.length;
  const totalHeight = total * ITEM_HEIGHT;

  const firstIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_COUNT);
  const lastIdx  = Math.min(total - 1, firstIdx + VISIBLE_COUNT + BUFFER_COUNT * 2);

  // Find or create top spacer
  let topSpacer = listContainer.querySelector<HTMLElement>('.sig-spacer-top');
  if (!topSpacer) {
    topSpacer = document.createElement('div');
    topSpacer.className = 'sig-spacer-top';
    listContainer.prepend(topSpacer);
  }
  topSpacer.style.height = `${firstIdx * ITEM_HEIGHT}px`;

  // Find or create bottom spacer
  let botSpacer = listContainer.querySelector<HTMLElement>('.sig-spacer-bot');
  if (!botSpacer) {
    botSpacer = document.createElement('div');
    botSpacer.className = 'sig-spacer-bot';
    listContainer.append(botSpacer);
  }
  botSpacer.style.height = `${(total - lastIdx - 1) * ITEM_HEIGHT}px`;

  // Remove old rows (keep spacers)
  const oldRows = listContainer.querySelectorAll('.sig-row');
  oldRows.forEach(r => r.remove());

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'sig-empty';
    empty.innerHTML = `
      <div class="sig-empty-icon">📡</div>
      <div>No active signals</div>
      <div class="sig-empty-sub">Intelligence engine is monitoring ${allSignals.length > 0 ? '— try clearing filters' : 'live data feeds'}</div>
    `;
    listContainer.insertBefore(empty, botSpacer);
    return;
  }

  const consensus = detectConsensus(filteredSignals);
  const consensusKeys = new Set(consensus.map(c => `${c.symbol}:${c.direction}`));

  const fragment = document.createDocumentFragment();
  for (let i = firstIdx; i <= lastIdx; i++) {
    const sig = filteredSignals[i];
    if (!sig) continue;
    const isConsensus = consensusKeys.has(`${sig.symbol}:${sig.direction}`);
    const row = buildSignalRow(sig, isConsensus, handleTrade, handleFlyTo, handleDetail);
    fragment.appendChild(row);
  }
  listContainer.insertBefore(fragment, botSpacer);
}

// ── Consensus bar ─────────────────────────────────────────────────────────────

function renderConsensusBar(): void {
  if (!consensusRowEl) return;
  const consensus = detectConsensus(filteredSignals);
  if (consensus.length === 0) {
    consensusRowEl.style.display = 'none';
    return;
  }
  consensusRowEl.style.display = '';
  const top = consensus[0]!;
  consensusRowEl.innerHTML = `
    <span class="sig-consensus-icon">★</span>
    <span class="sig-consensus-text">
      CONSENSUS: <strong>${top.direction} ${top.symbol}</strong>
      (${top.strategies.join(' + ')})
    </span>
    <span class="sig-consensus-conf">${Math.round(top.combinedConfidence * 100)}%</span>
  `;
}

// ── Action handlers ───────────────────────────────────────────────────────────

function handleTrade(sig: Signal, btn: HTMLButtonElement): void {
  import('../auth/auth-modal').then(({ requireAuthForTrading }) => {
    requireAuthForTrading(async () => {
      btn.textContent = 'Submitting…';
      btn.disabled = true;
      const result = await executionLoop.executeSignal(sig);
      if (result.approved && result.fill) {
        btn.textContent = 'Submitted ✓';
        btn.classList.add('submitted');
        showToast(`✓ ${sig.direction} ${sig.symbol} — ${result.fill.fillQuantity} shares @ $${result.fill.fillPrice.toFixed(2)}`);
      } else {
        btn.textContent = 'Paper Trade';
        btn.disabled = false;
        showToast(result.reason ?? 'Order rejected', 'error');
        return;
      }
      setTimeout(() => {
        btn.textContent = 'Paper Trade';
        btn.disabled = false;
        btn.classList.remove('submitted');
      }, 4000);
    });
  });
}

function handleFlyTo(sig: Signal): void {
  const coords = getRegionFor(sig);
  if (!coords) return;
  window.dispatchEvent(new CustomEvent('globe:fly-to', {
    detail: { longitude: coords[0], latitude: coords[1], zoom: 4.5, duration: 1200 },
  }));
}

function handleDetail(sig: Signal): void {
  // Remove any existing popup
  document.querySelector('.sig-detail-overlay')?.remove();
  document.body.appendChild(buildDetailPopup(sig));
}

// ── Update helpers ────────────────────────────────────────────────────────────

function applyFilter(): void {
  filteredSignals = filterStrategy
    ? allSignals.filter(s => getMeta(s.strategy).cssClass === filterStrategy)
    : [...allSignals];
  scrollTop = 0;
  if (listContainer) listContainer.scrollTop = 0;
  renderVirtualList();
  renderConsensusBar();
  updateCountBadge();
}

function updateCountBadge(): void {
  const active = filteredSignals.filter(s => s.expiresAt > Date.now()).length;
  if (countBadge) countBadge.textContent = String(active);
}

// ── Prediction Market Signals Rendering ───────────────────────────────────

function renderPredictionMarketSignals(signals: Signal[]): void {
  const predListEl = document.querySelector('.sig-pred-market-list');
  if (!predListEl) return;

  if (signals.length === 0) {
    const metrics = dataService.getPolymarketMetrics();
    const hasMarketData = metrics?.markets && metrics.markets.length > 0;
    predListEl.innerHTML = `
      <div class="sig-pred-market-empty">
        <div class="sig-pred-empty-title">No prediction market signals yet</div>
        <div class="sig-pred-empty-hint">
          ${hasMarketData
            ? `✓ ${metrics!.markets!.length} markets streaming. Signals require momentum >15%, volume >$80K, asset mapping, and news/CII confirmation.`
            : 'No market data yet. Check the Prediction Markets panel—if it shows markets, the API is working and signals will appear when conditions are met.'}
        </div>
      </div>
    `;
    return;
  }

  // Show only active, non-expired signals
  const activeSignals = signals.filter(s => s.expiresAt > Date.now()).slice(0, 5); // Max 5

  if (activeSignals.length === 0) {
    predListEl.innerHTML = '<div class="sig-pred-market-empty">All prediction market signals expired</div>';
    return;
  }

  const html = activeSignals.map(sig => {
    const meta = getMeta(sig.strategy);
    const conf = Math.round(sig.confidence * 100);
    const dir = sig.direction;
    const dirClass = dir === 'LONG' ? 'long' : 'short';
    const coords = getRegionFor(sig);

    return `
      <div class="sig-pred-market-row ${dirClass}">
        <div class="sig-pred-row-top">
          <span class="sig-badge sig-badge-${meta.cssClass}" style="--badge-color:${meta.color}">${meta.badge}</span>
          <span class="sig-symbol">${sig.symbol}</span>
          <span class="sig-direction ${dirClass}">${dir}</span>
          ${coords ? `<button class="sig-map-btn" data-sig-id="${sig.id}" title="Show on globe">🌍</button>` : ''}
        </div>
        <div class="sig-conf-bar">
          <div class="sig-conf-fill ${dirClass}" style="width: ${conf}%"></div>
          <span class="sig-conf-text">${conf}% confidence</span>
        </div>
        <div class="sig-reasoning">${sig.reasoning}</div>
        <div class="sig-pred-row-bottom">
          <button class="sig-detail-btn" data-sig-id="${sig.id}">View Details</button>
          <span class="sig-external-hint">💡 Trade externally on Polymarket, Kalshi, etc.</span>
        </div>
      </div>
    `;
  }).join('');

  predListEl.innerHTML = html;

  // Wire up event handlers
  predListEl.querySelectorAll('.sig-map-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sigId = (btn as HTMLElement).dataset.sigId;
      const sig = signals.find(s => s.id === sigId);
      if (sig) handleFlyTo(sig);
    });
  });

  predListEl.querySelectorAll('.sig-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sigId = (btn as HTMLElement).dataset.sigId;
      const sig = signals.find(s => s.id === sigId);
      if (sig) handleDetail(sig);
    });
  });
}

function onNewSignals(signals: Signal[]): void {
  allSignals = signals.slice(0, 200); // cap at 200
  isLive = true;
  if (liveDot) liveDot.classList.add('live');

  // Separate prediction market signals from regular signals
  predMarketSignals = allSignals.filter(s => s.strategy === 'prediction-markets' || s.strategy === 'PREDICTION-MARKETS');
  const regularSignals = allSignals.filter(s => s.strategy !== 'prediction-markets' && s.strategy !== 'PREDICTION-MARKETS');

  // Update regular signals list
  allSignals = regularSignals;
  applyFilter();

  // Render prediction market signals separately
  renderPredictionMarketSignals(predMarketSignals);

  // Auto-execute is handled by executionLoop (subscribed to signal bus).
  // The signals panel checkbox syncs with setAutoExecute in execution-loop.
}

// ── Panel builder ─────────────────────────────────────────────────────────────

function buildBody(container: HTMLElement): void {
  container.className += ' sig-panel-body';

  // ── Prediction Market Signals Section (Read-Only) ────────────────────────
  const predMarketSection = document.createElement('div');
  predMarketSection.className = 'sig-pred-market-section';
  predMarketSection.innerHTML = `
    <div class="sig-pred-market-header">
      <span class="sig-pred-market-title">📊 Prediction Market Signals</span>
      <span class="sig-pred-market-badge">INFO ONLY</span>
    </div>
    <div class="sig-pred-market-disclaimer">
      ⓘ These signals are based on Polymarket prediction markets. Use this intelligence for trading on external platforms—paper trading for prediction markets is not yet supported on this platform.
    </div>
    <div class="sig-pred-market-list"></div>
  `;
  container.appendChild(predMarketSection);

  // ── Divider ──────────────────────────────────────────────────────────────
  const divider = document.createElement('div');
  divider.className = 'sig-section-divider';
  divider.innerHTML = '<span>PAPER TRADING SIGNALS</span>';
  container.appendChild(divider);

  // ── Top controls ─────────────────────────────────────────────────────────
  const controlsRow = document.createElement('div');
  controlsRow.className = 'sig-controls-row';
  controlsRow.innerHTML = `
    <div class="sig-live-wrap">
      <span class="sig-live-dot" title="Live data"></span>
      <span class="sig-count-badge" title="Active signals">0</span>
      <span class="sig-live-label">signals</span>
    </div>
    <label class="sig-auto-label" title="Automatically paper trade approved signals (confidence ≥ 70%)">
      <span>Auto-trade</span>
      <span class="sig-toggle-wrap">
        <input type="checkbox" class="sig-auto-checkbox">
        <span class="sig-toggle-track"></span>
      </span>
    </label>
  `;

  liveDot   = controlsRow.querySelector('.sig-live-dot');
  countBadge = controlsRow.querySelector('.sig-count-badge');
  autoToggleEl = controlsRow.querySelector('.sig-auto-checkbox');

  autoToggleEl?.addEventListener('change', async () => {
    autoExecute = autoToggleEl!.checked;
    const { setAutoExecute } = await import('../trading/engine/execution-loop');
    setAutoExecute(autoExecute);
    showToast(autoExecute ? 'Auto-trade ON — signals ≥70% will execute' : 'Auto-trade OFF');
  });

  // Sync checkbox with execution loop's auto-execute state
  import('../trading/engine/execution-loop').then(({ getAutoExecute }) => {
    autoExecute = getAutoExecute();
    if (autoToggleEl) autoToggleEl.checked = autoExecute;
  });

  container.appendChild(controlsRow);

  // ── Strategy filter pills ─────────────────────────────────────────────────
  filterRowEl = document.createElement('div');
  filterRowEl.className = 'sig-filter-row';

  const strategies = [
    { key: null,   label: 'All' },
    { key: 'geo',  label: 'GEO'   },
    { key: 'sent', label: 'SENT'  },
    { key: 'mom',  label: 'MOM'   },
    { key: 'macro',label: 'MACRO' },
    { key: 'cross',label: 'CROSS' },
    // PRED-MKT signals shown separately above, not in filters
  ];

  for (const s of strategies) {
    const pill = document.createElement('button');
    pill.className = `sig-filter-pill ${s.key === null ? 'active' : ''}`;
    pill.textContent = s.label;
    if (s.key) pill.dataset.strategy = s.key;
    pill.addEventListener('click', () => {
      filterStrategy = s.key;
      filterRowEl!.querySelectorAll('.sig-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilter();
    });
    filterRowEl.appendChild(pill);
  }

  container.appendChild(filterRowEl);

  // ── Consensus banner ──────────────────────────────────────────────────────
  consensusRowEl = document.createElement('div');
  consensusRowEl.className = 'sig-consensus-bar';
  consensusRowEl.style.display = 'none';
  container.appendChild(consensusRowEl);

  // ── Virtual scroll container ──────────────────────────────────────────────
  listContainer = document.createElement('div');
  listContainer.className = 'sig-list-container';

  listContainer.addEventListener('scroll', () => {
    scrollTop = listContainer!.scrollTop;
    containerHeight = listContainer!.clientHeight;
    renderVirtualList();
  });

  container.appendChild(listContainer);

  // ── Initial render with mock data ─────────────────────────────────────────
  applyFilter();

  // ── Subscribe to live trading signals (from StateSync) ────────────────────
  window.addEventListener('trading:signals', (e: Event) => {
    const signals = (e as CustomEvent<Signal[]>).detail;
    if (Array.isArray(signals) && signals.length > 0) {
      onNewSignals(signals);
    }
  });

  // ── Legacy fallback (old signals-updated event) ───────────────────────────
  window.addEventListener('signals-updated', (e: Event) => {
    const { signals } = (e as CustomEvent<{ signals: Signal[] }>).detail;
    if (Array.isArray(signals)) onNewSignals(signals);
  });

  // ── Polymarket data — refresh prediction-market empty state when data arrives ─
  dataService.addEventListener('polymarket-metrics', () => {
    renderPredictionMarketSignals(predMarketSignals);
  });

  // Initial render of prediction market section (shows empty state with data-status hint)
  renderPredictionMarketSignals(predMarketSignals);

  // ── Tick timer — refresh expiry countdowns every 30 s ────────────────────
  setInterval(() => {
    updateCountBadge();
    renderConsensusBar();
    // Re-render to update expired states
    if (listContainer) renderVirtualList();
  }, 30_000);

  // Initial count
  updateCountBadge();
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initSignalsPanel(): void {
  registerPanel({
    id: 'signals',
    title: 'Signals',
    badge: 'LIVE',
    badgeClass: 'live',
    defaultCollapsed: false,
    init: buildBody,
  });
}
