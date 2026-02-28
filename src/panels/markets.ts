/**
 * Markets Panel — Hedge Fund Market Intelligence
 * Sections: Macro Signal Radar → Status Bar → Equities Grid → Crypto
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type {
  MarketQuote,
  FearGreedData,
  YahooDetail,
  CryptoPrice,
  CryptoDetail,
  MacroRadarDetail,
  RadarSignal,
} from '../lib/data-service';

// ── Local interfaces ────────────────────────────────────────────────────────

interface MarketItem {
  symbol: string;
  name: string;
  price: string;
  changePercent: number;
  change5dPct: number;
  history5d: number[];
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RADAR: MacroRadarDetail = {
  signals: [
    { id: 'yield_curve',       name: 'YIELD CURVE',  value: '-0.45%',    signal: 'BEARISH', description: 'Inverted' },
    { id: 'vix',               name: 'VIX REGIME',   value: '18.4',      signal: 'NEUTRAL', description: 'Moderate' },
    { id: 'fear_greed',        name: 'FEAR/GREED',   value: '62',        signal: 'BULLISH', description: 'Greed zone' },
    { id: 'gold_trend',        name: 'GOLD TREND',   value: '+0.8% 5d',  signal: 'NEUTRAL', description: 'Sideways' },
    { id: 'dollar',            name: 'USD STRENGTH', value: '104.2',     signal: 'BULLISH', description: 'Risk-on' },
    { id: 'equity_momentum',   name: 'EQUITY MOM',   value: '+1.2% 5d',  signal: 'BULLISH', description: 'Trending up' },
    { id: 'crypto_sentiment',  name: 'CRYPTO SENT',  value: '+3.1%',     signal: 'BULLISH', description: 'Risk appetite' },
  ],
  verdict: 'BUY',
  bullishCount: 4,
  bearishCount: 1,
  neutralCount: 2,
  timestamp: Date.now(),
};

const MOCK_MARKETS: MarketItem[] = [
  { symbol: 'SPY', name: 'S&P 500',      price: '520.10', changePercent:  0.52,  change5dPct:  1.2,  history5d: [514, 516, 518, 517, 520] },
  { symbol: 'QQQ', name: 'Nasdaq 100',   price: '441.30', changePercent:  0.78,  change5dPct:  1.8,  history5d: [434, 437, 440, 438, 441] },
  { symbol: 'IWM', name: 'Russell 2000', price: '198.50', changePercent: -0.31,  change5dPct: -0.5,  history5d: [200, 199, 198, 197, 198] },
  { symbol: 'EEM', name: 'Emerging Mkts',price: '40.20',  changePercent:  0.25,  change5dPct:  0.8,  history5d: [39.8, 40.0, 39.9, 40.1, 40.2] },
  { symbol: 'GLD', name: 'Gold ETF',     price: '234.16', changePercent:  0.87,  change5dPct:  1.5,  history5d: [230, 231, 233, 232, 234] },
  { symbol: 'TLT', name: '20Y Treasury', price: '91.40',  changePercent: -0.42,  change5dPct: -1.2,  history5d: [92.5, 92, 91.8, 91.5, 91.4] },
  { symbol: 'USO', name: 'Oil ETF',      price: '75.20',  changePercent: -1.23,  change5dPct: -2.1,  history5d: [77, 76.5, 76, 75.5, 75.2] },
  { symbol: 'VIX', name: 'Volatility',   price: '18.74',  changePercent:  6.11,  change5dPct: 12.0,  history5d: [15, 16, 17, 18, 18.7] },
];

const MOCK_CRYPTO: CryptoPrice[] = [
  { id: 'bitcoin',  symbol: 'BTC', name: 'Bitcoin',  price: 67450, change24h:  3.2, change7d:  8.5, marketCap: 1_320_000_000_000, volume24h: 42_000_000_000, marketCapRank: 1 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3480,  change24h:  2.1, change7d:  5.2, marketCap:   420_000_000_000, volume24h: 18_000_000_000, marketCapRank: 2 },
  { id: 'solana',   symbol: 'SOL', name: 'Solana',   price: 168,   change24h:  4.5, change7d: 12.1, marketCap:    78_000_000_000, volume24h:  5_200_000_000, marketCapRank: 5 },
  { id: 'ripple',   symbol: 'XRP', name: 'XRP',      price: 0.62,  change24h: -1.2, change7d:  3.8, marketCap:    34_000_000_000, volume24h:  1_800_000_000, marketCapRank: 7 },
];

const MOCK_TOTAL_MCAP = 2_100_000_000_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hours = now.getUTCHours();
  return hours >= 14 && hours < 21;
}

function formatPrice(price: number, symbol: string): string {
  if (symbol === 'EURUSD=X') return price.toFixed(4);
  if (price >= 1_000) return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return price.toFixed(2);
}

function formatCryptoPrice(price: number): string {
  if (price >= 1_000) return `$${price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  if (price >= 1)     return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(1)}B`;
  return `$${(cap / 1e6).toFixed(0)}M`;
}

function fearGreedColor(value: number): string {
  if (value < 25) return '#ef4444';
  if (value < 45) return '#f97316';
  if (value < 55) return 'rgba(255,255,255,0.5)';
  if (value < 75) return '#22c55e';
  return '#4ade80';
}

// ── DOM builders ─────────────────────────────────────────────────────────────

function buildMiniSparkline(history: number[], isPositive: boolean): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'sparkline-mini';

  if (!history || history.length === 0) return wrapper;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

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

function buildRadarSignalEl(sig: RadarSignal): HTMLElement {
  const el = document.createElement('div');
  el.className = `radar-signal ${sig.signal}`;
  el.dataset.signalId = sig.id;

  const name = document.createElement('span');
  name.className = 'signal-name';
  name.textContent = sig.name;

  const value = document.createElement('span');
  value.className = 'signal-value';
  value.textContent = sig.value;

  const dot = document.createElement('span');
  dot.className = `signal-dot ${sig.signal.toLowerCase()}`;

  el.appendChild(name);
  el.appendChild(value);
  el.appendChild(dot);
  return el;
}

function buildRadarSection(radar: MacroRadarDetail): HTMLElement {
  const section = document.createElement('div');
  section.className = 'market-radar-section';
  section.dataset.radarSection = '1';

  const header = document.createElement('div');
  header.className = 'radar-header';

  const label = document.createElement('span');
  label.className = 'radar-label';
  label.textContent = 'MACRO SIGNAL RADAR';

  const verdict = document.createElement('div');
  verdict.className = `radar-verdict ${radar.verdict}`;
  verdict.dataset.verdict = '1';
  verdict.textContent = radar.verdict;

  header.appendChild(label);
  header.appendChild(verdict);
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'radar-signals-grid';
  grid.dataset.radarGrid = '1';
  radar.signals.forEach(sig => grid.appendChild(buildRadarSignalEl(sig)));
  section.appendChild(grid);

  const counts = document.createElement('div');
  counts.className = 'radar-counts';
  counts.dataset.radarCounts = '1';

  const bullish = document.createElement('span');
  bullish.className = 'bullish-count';
  bullish.textContent = `${radar.bullishCount} BULLISH`;

  const neutral = document.createElement('span');
  neutral.className = 'neutral-count';
  neutral.textContent = `${radar.neutralCount} NEUTRAL`;

  const bearish = document.createElement('span');
  bearish.className = 'bearish-count';
  bearish.textContent = `${radar.bearishCount} BEARISH`;

  counts.appendChild(bullish);
  counts.appendChild(neutral);
  counts.appendChild(bearish);
  section.appendChild(counts);

  return section;
}

function buildStatusBar(fgData: FearGreedData | null): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'market-status-bar';

  const dot = document.createElement('span');
  const open = isMarketOpen();
  dot.className = `market-status-dot ${open ? 'open' : 'closed'}`;

  const text = document.createElement('span');
  text.className = 'market-status-text';
  text.textContent = open ? 'NYSE OPEN' : 'NYSE CLOSED';

  bar.appendChild(dot);
  bar.appendChild(text);

  // Fear & Greed inline
  const fg = document.createElement('div');
  fg.className = 'fg-inline';
  fg.dataset.fgInline = '1';

  if (fgData) {
    renderFgInline(fg, fgData);
  } else {
    const lbl = document.createElement('span');
    lbl.className = 'fg-label';
    lbl.textContent = 'F&G:';
    const val = document.createElement('span');
    val.className = 'fg-value';
    val.textContent = '—';
    fg.appendChild(lbl);
    fg.appendChild(val);
  }

  bar.appendChild(fg);
  return bar;
}

function renderFgInline(el: HTMLElement, data: FearGreedData): void {
  el.innerHTML = '';
  const lbl = document.createElement('span');
  lbl.className = 'fg-label';
  lbl.textContent = 'F&G:';

  const val = document.createElement('span');
  val.className = 'fg-value';
  val.style.color = fearGreedColor(data.value);
  val.textContent = `${data.value} ${data.classification}`;

  el.appendChild(lbl);
  el.appendChild(val);
}

function buildMarketItem(item: MarketItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'market-item';
  el.dataset.market = item.symbol;

  const top = document.createElement('div');
  top.className = 'market-item-top';

  const symbol = document.createElement('span');
  symbol.className = 'market-symbol';
  symbol.textContent = item.symbol;

  const isPos = item.changePercent >= 0;
  const changeEl = document.createElement('span');
  changeEl.className = `market-change ${isPos ? 'positive' : 'negative'}`;
  changeEl.textContent = `${isPos ? '+' : ''}${item.changePercent.toFixed(2)}%`;

  top.appendChild(symbol);
  top.appendChild(changeEl);
  el.appendChild(top);

  const price = document.createElement('div');
  price.className = 'market-price mono';
  price.textContent = item.price;
  el.appendChild(price);

  el.appendChild(buildMiniSparkline(item.history5d, item.change5dPct >= 0));

  return el;
}

function buildCryptoRow(coin: CryptoPrice): HTMLElement {
  const row = document.createElement('div');
  row.className = 'crypto-row';
  row.dataset.crypto = coin.symbol;

  const sym = document.createElement('span');
  sym.className = 'crypto-symbol';
  sym.textContent = coin.symbol;

  const price = document.createElement('span');
  price.className = 'crypto-price mono';
  price.textContent = formatCryptoPrice(coin.price);

  const is24Pos = coin.change24h >= 0;
  const ch24 = document.createElement('span');
  ch24.className = `crypto-change-24h ${is24Pos ? 'positive' : 'negative'}`;
  ch24.textContent = `${is24Pos ? '+' : ''}${coin.change24h.toFixed(1)}%`;

  const is7Pos = coin.change7d >= 0;
  const ch7 = document.createElement('span');
  ch7.className = `crypto-change-7d ${is7Pos ? 'positive' : 'negative'}`;
  ch7.textContent = `${is7Pos ? '+' : ''}${coin.change7d.toFixed(1)}% 7d`;

  const mcap = document.createElement('span');
  mcap.className = 'crypto-mcap';
  mcap.textContent = formatMarketCap(coin.marketCap);

  row.appendChild(sym);
  row.appendChild(price);
  row.appendChild(ch24);
  row.appendChild(ch7);
  row.appendChild(mcap);
  return row;
}

function buildCryptoSection(coins: CryptoPrice[], totalMcap: number): HTMLElement {
  const section = document.createElement('div');
  section.className = 'crypto-section';
  section.dataset.cryptoSection = '1';

  const header = document.createElement('div');
  header.className = 'crypto-header';

  const title = document.createElement('span');
  title.textContent = 'CRYPTO';

  const mcapSpan = document.createElement('span');
  mcapSpan.className = 'crypto-total-mcap';
  mcapSpan.dataset.totalMcap = '1';
  mcapSpan.textContent = `${formatMarketCap(totalMcap)} total mcap`;

  header.appendChild(title);
  header.appendChild(mcapSpan);
  section.appendChild(header);

  const list = document.createElement('div');
  list.dataset.cryptoList = '1';
  coins.forEach(c => list.appendChild(buildCryptoRow(c)));
  section.appendChild(list);

  return section;
}

// ── Live update helpers ───────────────────────────────────────────────────────

function applyYahooQuotes(quotes: MarketQuote[]): void {
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

    // Rebuild sparkline if history is available
    const oldSparkline = itemEl.querySelector('.sparkline-mini');
    if (oldSparkline && q.history5d && q.history5d.length > 0) {
      const newSparkline = buildMiniSparkline(q.history5d, q.change5dPct >= 0);
      oldSparkline.replaceWith(newSparkline);
    }
  });
}

function applyCryptoData(detail: CryptoDetail): void {
  // Update total market cap
  const mcapEl = document.querySelector<HTMLElement>('[data-total-mcap]');
  if (mcapEl) mcapEl.textContent = `${formatMarketCap(detail.totalCryptoMarketCap)} total mcap`;

  detail.prices.forEach((coin) => {
    const rowEl = document.querySelector<HTMLElement>(`[data-crypto="${coin.symbol}"]`);
    if (!rowEl) return;

    const priceEl = rowEl.querySelector('.crypto-price');
    const ch24El = rowEl.querySelector('.crypto-change-24h');
    const ch7El  = rowEl.querySelector('.crypto-change-7d');
    const mcapEl2 = rowEl.querySelector('.crypto-mcap');

    if (priceEl) priceEl.textContent = formatCryptoPrice(coin.price);
    if (ch24El) {
      const isPos = coin.change24h >= 0;
      ch24El.textContent = `${isPos ? '+' : ''}${coin.change24h.toFixed(1)}%`;
      ch24El.className = `crypto-change-24h ${isPos ? 'positive' : 'negative'}`;
    }
    if (ch7El) {
      const isPos = coin.change7d >= 0;
      ch7El.textContent = `${isPos ? '+' : ''}${coin.change7d.toFixed(1)}% 7d`;
      ch7El.className = `crypto-change-7d ${isPos ? 'positive' : 'negative'}`;
    }
    if (mcapEl2) mcapEl2.textContent = formatMarketCap(coin.marketCap);
  });
}

function applyMacroRadar(radar: MacroRadarDetail): void {
  const verdictEl = document.querySelector<HTMLElement>('[data-verdict]');
  if (verdictEl) {
    verdictEl.textContent = radar.verdict;
    verdictEl.className = `radar-verdict ${radar.verdict}`;
  }

  radar.signals.forEach((sig) => {
    const sigEl = document.querySelector<HTMLElement>(`[data-signal-id="${sig.id}"]`);
    if (!sigEl) return;
    sigEl.className = `radar-signal ${sig.signal}`;

    const valEl = sigEl.querySelector('.signal-value');
    const dotEl = sigEl.querySelector('.signal-dot');
    if (valEl) valEl.textContent = sig.value;
    if (dotEl) dotEl.className = `signal-dot ${sig.signal.toLowerCase()}`;
  });

  const countsEl = document.querySelector('[data-radar-counts]');
  if (countsEl) {
    const bullishEl = countsEl.querySelector('.bullish-count');
    const neutralEl = countsEl.querySelector('.neutral-count');
    const bearishEl = countsEl.querySelector('.bearish-count');
    if (bullishEl) bullishEl.textContent = `${radar.bullishCount} BULLISH`;
    if (neutralEl) neutralEl.textContent = `${radar.neutralCount} NEUTRAL`;
    if (bearishEl) bearishEl.textContent = `${radar.bearishCount} BEARISH`;
  }
}

function setLiveBadge(): void {
  const badge = document.querySelector('[data-panel-id="markets"] .panel-badge');
  if (badge) {
    badge.textContent = 'LIVE';
    badge.className = 'panel-badge live';
  }
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildMarketsBody(container: HTMLElement): void {
  // 1. Macro Signal Radar
  container.appendChild(buildRadarSection(MOCK_RADAR));

  // 2. Status bar (NYSE open/closed + Fear & Greed)
  const existingFg = dataService.getFearGreed();
  container.appendChild(buildStatusBar(existingFg));

  // 3. Equities grid
  const grid = document.createElement('div');
  grid.className = 'market-grid';
  MOCK_MARKETS.forEach(item => grid.appendChild(buildMarketItem(item)));
  container.appendChild(grid);

  // 4. Crypto section
  container.appendChild(buildCryptoSection(MOCK_CRYPTO, MOCK_TOTAL_MCAP));

  // ── Wire live data ────────────────────────────────────────────────────────

  dataService.addEventListener('yahoo', (e: Event) => {
    const { detail } = e as CustomEvent<YahooDetail>;
    applyYahooQuotes(detail.quotes);
    setLiveBadge();
  });

  dataService.addEventListener('fear-greed', (e: Event) => {
    const { detail } = e as CustomEvent<FearGreedData>;
    const fgInline = document.querySelector<HTMLElement>('[data-fg-inline]');
    if (fgInline) renderFgInline(fgInline, detail);
  });

  dataService.addEventListener('crypto', (e: Event) => {
    const { detail } = e as CustomEvent<CryptoDetail>;
    applyCryptoData(detail);
    setLiveBadge();
  });

  dataService.addEventListener('macro-radar', (e: Event) => {
    const { detail } = e as CustomEvent<MacroRadarDetail>;
    applyMacroRadar(detail);
    setLiveBadge();
  });

  // Apply already-cached data on hot reload
  const cachedYahoo = dataService.getYahoo();
  if (cachedYahoo) applyYahooQuotes(cachedYahoo.quotes);

  const cachedCrypto = dataService.getCrypto();
  if (cachedCrypto) applyCryptoData(cachedCrypto);

  const cachedRadar = dataService.getMacroRadar();
  if (cachedRadar) applyMacroRadar(cachedRadar);
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
