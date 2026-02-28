/**
 * Atlas - Global Intelligence Platform
 * Entry point — final integration
 *
 * Boot order:
 *  1. Theme
 *  2. Globe + layers
 *  3. Panels (register listeners before data arrives)
 *  4. Intelligence engine (CII, convergence, anomaly)
 *  5. Paper trading engine (strategies → signals → risk → broker → portfolio)
 *  6. Bootstrap (first-visit equity curve seed)
 *  7. Header controls (theme toggle, paper-trading toggle)
 *  8. Bottom status bar
 *  9. Keyboard shortcuts
 * 10. WebSocket relay (deferred 1 s)
 */

import { initState } from './lib/state';
import { WebSocketManager } from './lib/websocket';
import { initTheme, toggleTheme, getTheme } from './lib/theme';
import { dataService } from './lib/data-service';
import GEO_MAP from './data/geo-asset-mapping.json';

// ── Application state ─────────────────────────────────────────────────────────
const state = initState();

// WebSocket manager (exposed for DevTools)
let wsManager: WebSocketManager | null = null;

// ── Globe initialisation ──────────────────────────────────────────────────────

async function initGlobe(): Promise<void> {
  const container = document.getElementById('globe-container');
  if (!container) { console.error('Globe container not found'); return; }

  try {
    const { initGlobe: initGlobeInstance, setGlobeTheme } = await import('./globe/globe');

    // Static layers
    await import('./globe/layers/test-markers');
    await import('./globe/layers/military-bases');
    await import('./globe/layers/nuclear-facilities');
    await import('./globe/layers/undersea-cables');
    await import('./globe/layers/pipelines');
    await import('./globe/layers/chokepoints');
    await import('./globe/layers/financial-centers');
    await import('./globe/layers/conflict-zones');

    // Live data layers
    await import('./globe/layers/earthquakes');
    await import('./globe/layers/fires');
    await import('./globe/layers/aircraft');

    // Portfolio risk heatmap (subscribes to trading:portfolio)
    await import('./globe/layers/risk-heatmap');

    const globe = initGlobeInstance(container);
    console.log('[Atlas] Globe initialised');

    const { getLayerRegistry } = await import('./globe/layer-registry');
    const registry = getLayerRegistry();
    const storedActiveSet = state.get('globe').activeLayers;
    const defaultActiveIds = registry.getDefaultActiveIds();
    const activeLayerIds: string[] =
      storedActiveSet.size > 0 ? Array.from(storedActiveSet) : defaultActiveIds;

    state.update('globe', (current) => ({
      ...current,
      activeLayers: new Set(activeLayerIds),
    }));

    activeLayerIds.forEach((layerId: string) => {
      const layer = registry.createLayer(layerId);
      if (layer) globe.registerLayer(layerId, layer);
    });

    console.log('[Atlas] Layers:', activeLayerIds);

    const { initLayerControls } = await import('./globe/controls');
    initLayerControls();

    window.addEventListener('themechange', (e: any) => setGlobeTheme(e.detail.theme));
    window.addEventListener('resize', () => globe.resize());

  } catch (err) {
    console.error('[Atlas] Globe init failed:', err);
  }
}

// ── Panel initialisation ──────────────────────────────────────────────────────

async function initPanels(): Promise<void> {
  const rightPanel = document.getElementById('right-panel');
  if (!rightPanel) { console.error('Right panel container not found'); return; }

  const { initPanelManager } = await import('./panels/panel-manager');
  initPanelManager();

  const panels: Array<{ name: string; loader: () => Promise<Record<string, () => void>>; fn: string }> = [
    // ── Left sidebar: Paper Trading (Signals first — natural workflow) ──────
    { name: 'signals',             loader: () => import('./panels/signals'),              fn: 'initSignalsPanel' },
    { name: 'portfolio',           loader: () => import('./panels/portfolio'),            fn: 'initPortfolioPanel' },
    { name: 'performance',         loader: () => import('./panels/performance'),          fn: 'initPerformancePanel' },
    // ── Right sidebar: Intelligence panels ──────────────────────────────────
    { name: 'strategic-risk',      loader: () => import('./panels/strategic-risk'),      fn: 'initStrategicRiskPanel' },
    { name: 'news-feed',           loader: () => import('./panels/news-feed'),            fn: 'initNewsFeedPanel' },
    { name: 'ai-insights',         loader: () => import('./panels/ai-insights'),          fn: 'initAIInsightsPanel' },
    { name: 'markets',             loader: () => import('./panels/markets'),              fn: 'initMarketsPanel' },
    { name: 'country-instability', loader: () => import('./panels/country-instability'), fn: 'initInstabilityPanel' },
  ];

  for (const panel of panels) {
    try {
      const mod = await panel.loader();
      const initFn = mod[panel.fn] as (() => void) | undefined;
      if (typeof initFn === 'function') initFn();
      else console.warn(`[Atlas] Panel "${panel.name}" export "${panel.fn}" not found`);
    } catch (err) {
      console.error(`[Atlas] Panel "${panel.name}" failed to load:`, err);
    }
  }

  console.log('[Atlas] Panels initialised');

  dataService.startPolling();
  console.log('[Atlas] Data polling started');
}

// ── WebSocket relay ───────────────────────────────────────────────────────────

function initWebSockets(): void {
  const relayUrl = (import.meta.env.VITE_RELAY_URL as string | undefined)
    ?? 'wss://atlas-relay.up.railway.app/ws';

  wsManager = new WebSocketManager({
    url: relayUrl,
    reconnect: true,
    reconnectInterval: 5_000,
    maxReconnectAttempts: 20,
  });

  wsManager.on('message', (msg: any) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'aircraft' && Array.isArray(msg.data))
      window.dispatchEvent(new CustomEvent('aircraft-update', { detail: msg.data }));
    else if (msg.type === 'ais' && msg.data)
      window.dispatchEvent(new CustomEvent('ais-vessel', { detail: msg.data }));
  });

  wsManager.on('open', () => {
    console.log('[Atlas] WebSocket relay connected');
    wsManager!.send(JSON.stringify({ type: 'subscribe', channels: ['ais', 'aircraft'] }));
  });

  wsManager.connect();
  if (import.meta.env.DEV) (window as any).atlas.wsManager = wsManager;
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

function initThemeToggle(): void {
  const toggleButton = document.getElementById('theme-toggle');
  const iconSpan     = toggleButton?.querySelector('.theme-icon');
  if (!toggleButton || !iconSpan) { console.error('Theme toggle not found'); return; }

  const updateIcon = () => {
    iconSpan.textContent = getTheme() === 'dark' ? '🌙' : '☀️';
  };

  updateIcon();
  toggleButton.addEventListener('click', () => { toggleTheme(); updateIcon(); });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault(); toggleTheme(); updateIcon();
    }
  });
  window.addEventListener('themechange', updateIcon);
}

// ── Paper-trading header toggle ───────────────────────────────────────────────

type TradingMode = 'auto' | 'manual' | 'killed';
let tradingMode: TradingMode = 'auto';

async function initPaperTradingToggle(): Promise<void> {
  const btn    = document.getElementById('paper-trading-toggle') as HTMLButtonElement | null;
  const status = document.getElementById('pt-toggle-status');
  if (!btn || !status) return;

  const { setAutoExecute } = await import('./trading/engine/execution-loop');

  const apply = (mode: TradingMode) => {
    tradingMode = mode;
    btn.classList.remove('pt-active', 'pt-paused', 'pt-killed');

    switch (mode) {
      case 'auto':
        setAutoExecute(true);
        btn.classList.add('pt-active');
        status.textContent = 'AUTO';
        break;
      case 'manual':
        setAutoExecute(false);
        btn.classList.add('pt-paused');
        status.textContent = 'MANUAL';
        break;
      case 'killed':
        setAutoExecute(false);
        btn.classList.add('pt-killed');
        status.textContent = 'KILLED';
        break;
    }
  };

  // Start in AUTO mode
  apply('auto');

  // Click cycles: AUTO → MANUAL → AUTO
  btn.addEventListener('click', () => {
    apply(tradingMode === 'auto' ? 'manual' : 'auto');
    showToast(tradingMode === 'auto' ? 'Auto-execute ON' : 'Manual mode — signals queued only');
  });
}

// ── Bottom status bar ─────────────────────────────────────────────────────────

function initStatusBar(): void {
  const navEl     = document.getElementById('sb-nav-value');
  const pnlEl     = document.getElementById('sb-pnl-value');
  const sigEl     = document.getElementById('sb-signals-value');
  const riskEl    = document.getElementById('sb-risk-value');

  if (!navEl || !pnlEl || !sigEl || !riskEl) return;

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  let lastNav = 1_000_000;

  const updateNav = (nav: number, dailyPnl: number) => {
    const fmtNav = fmt.format(nav);
    if (fmtNav !== navEl.textContent) {
      navEl.textContent = fmtNav;
      navEl.classList.remove('sb-flash-up', 'sb-flash-down');
      // Force reflow so animation restarts
      void navEl.offsetWidth;
      navEl.classList.add(nav >= lastNav ? 'sb-flash-up' : 'sb-flash-down');
      lastNav = nav;
    }

    const sign   = dailyPnl >= 0 ? '+' : '';
    pnlEl.textContent = `${sign}${fmt.format(dailyPnl)}`;
    pnlEl.classList.toggle('sb-pos', dailyPnl >= 0);
    pnlEl.classList.toggle('sb-neg', dailyPnl < 0);
  };

  const updateRisk = (status: string) => {
    const s = status.toUpperCase();
    riskEl.textContent = `● ${s}`;
    riskEl.className   = 'sb-value sb-risk-dot';
    if (s === 'GREEN')  riskEl.classList.add('risk-green');
    else if (s === 'YELLOW') riskEl.classList.add('risk-yellow');
    else if (s === 'RED')    riskEl.classList.add('risk-red');
    else if (s === 'BLACK')  riskEl.classList.add('risk-black');
  };

  // Subscribe to portfolio updates
  window.addEventListener('trading:portfolio', (e: Event) => {
    const snap = (e as CustomEvent).detail;
    if (!snap) return;
    const nav      = typeof snap.totalValue  === 'number' ? snap.totalValue  : lastNav;
    const dailyPnl = typeof snap.dailyPnl    === 'number' ? snap.dailyPnl    : 0;
    updateNav(nav, dailyPnl);
  });

  // Subscribe to risk status
  window.addEventListener('trading:riskStatus', (e: Event) => {
    const rs = (e as CustomEvent).detail;
    if (rs?.circuitBreakerState) updateRisk(rs.circuitBreakerState);
  });

  // Subscribe to signals count
  window.addEventListener('trading:signals', (e: Event) => {
    const signals = (e as CustomEvent).detail;
    const count = Array.isArray(signals) ? signals.filter((s: any) => !s.expiresAt || s.expiresAt > Date.now()).length : 0;
    sigEl.textContent = `${count} active`;
  });

  // Legacy compatibility
  window.addEventListener('trading:legacy-sync', (e: Event) => {
    const d = (e as CustomEvent<{ balance: number; dailyPnL: number }>).detail;
    if (d) updateNav(d.balance, d.dailyPnL);
    state.set('trading', {
      enabled: true,
      balance:   d.balance,
      dailyPnL:  d.dailyPnL,
      positions: (d as any).positions ?? 0,
    });
  });
}

// ── Globe signal/trade flash wiring ──────────────────────────────────────────

/** Build a reverse index: symbol → [iso2 countries] */
const SYMBOL_TO_COUNTRIES: Record<string, string[]> = (() => {
  const idx: Record<string, string[]> = {};
  for (const [iso2, entry] of Object.entries(GEO_MAP as Record<string, { long: string[]; short: string[] }>)) {
    for (const sym of [...entry.long, ...entry.short]) {
      if (!idx[sym]) idx[sym] = [];
      if (!idx[sym].includes(iso2)) idx[sym].push(iso2);
    }
  }
  return idx;
})();

function flashSymbolOnGlobe(symbol: string, duration = 3000): void {
  const countries = SYMBOL_TO_COUNTRIES[symbol] ?? [];
  for (const iso2 of countries.slice(0, 3)) {
    window.dispatchEvent(new CustomEvent('globe:signal-flash', { detail: { iso2, duration } }));
  }
}

function initGlobeWiring(): void {
  // Flash globe when a geopolitical signal fires
  window.addEventListener('trading:signals', (e: Event) => {
    const signals = (e as CustomEvent<Array<{ symbol: string; strategy: string; generatedAt?: number }>>).detail;
    if (!Array.isArray(signals)) return;

    // Only flash newly generated signals (within the last 5 seconds)
    const freshCutoff = Date.now() - 5_000;
    for (const sig of signals) {
      if ((sig.generatedAt ?? 0) >= freshCutoff) {
        flashSymbolOnGlobe(sig.symbol, 4_000);
      }
    }
  });

  // Flash when a trade executes (new position opened)
  window.addEventListener('trading:portfolio', (e: Event) => {
    const snap = (e as CustomEvent<{ positions?: Array<{ symbol: string; openedAt?: number }> }>).detail;
    if (!snap?.positions) return;
    const freshCutoff = Date.now() - 3_000;
    for (const pos of snap.positions) {
      if ((pos.openedAt ?? 0) >= freshCutoff) {
        flashSymbolOnGlobe(pos.symbol, 5_000);
      }
    }
  });
}

// ── Right panel drag-to-resize ────────────────────────────────────────────────

const RIGHT_PANEL_WIDTH_KEY = 'atlas-right-panel-width';
const MIN_RIGHT_WIDTH = 320;
const MAX_RIGHT_WIDTH = Math.round(window.innerWidth * 0.65);

function initRightPanelResize(): void {
  const panel  = document.getElementById('right-panel') as HTMLElement | null;
  const handle = document.getElementById('right-resize-handle') as HTMLElement | null;
  if (!panel || !handle) return;

  // Restore persisted width
  const saved = localStorage.getItem(RIGHT_PANEL_WIDTH_KEY);
  if (saved) {
    const w = parseInt(saved, 10);
    if (w >= MIN_RIGHT_WIDTH && w <= MAX_RIGHT_WIDTH) {
      panel.style.width = `${w}px`;
      document.documentElement.style.setProperty('--right-panel-width', `${w}px`);
    }
  }

  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    // Dragging left = panel grows; right = shrinks
    const delta   = startX - e.clientX;
    const newWidth = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, startWidth + delta));
    panel.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--right-panel-width', `${newWidth}px`);
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const finalWidth = parseInt(panel.style.width, 10);
    localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(finalWidth));
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    dragging   = true;
    startX     = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor     = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Touch support
  handle.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    startX     = touch.clientX;
    startWidth = panel.offsetWidth;
    dragging   = true;
    handle.classList.add('dragging');
  }, { passive: true });

  handle.addEventListener('touchmove', (e: TouchEvent) => {
    if (!dragging) return;
    const touch   = e.touches[0];
    const delta   = startX - touch.clientX;
    const newWidth = Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, startWidth + delta));
    panel.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--right-panel-width', `${newWidth}px`);
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, panel.style.width.replace('px', ''));
  });

  console.log('[Atlas] Right panel resize initialised');
}

// ── Left panel drag-to-resize ─────────────────────────────────────────────────

const LEFT_PANEL_WIDTH_KEY = 'atlas-left-panel-width';
const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = Math.round(window.innerWidth * 0.45);

function initLeftPanelResize(): void {
  const panel  = document.getElementById('left-panel') as HTMLElement | null;
  const handle = document.getElementById('left-resize-handle') as HTMLElement | null;
  if (!panel || !handle) return;

  // Restore persisted width
  const saved = localStorage.getItem(LEFT_PANEL_WIDTH_KEY);
  if (saved) {
    const w = parseInt(saved, 10);
    if (w >= MIN_LEFT_WIDTH && w <= MAX_LEFT_WIDTH) {
      panel.style.width = `${w}px`;
      document.documentElement.style.setProperty('--left-panel-width', `${w}px`);
    }
  }

  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    // Dragging right = panel grows; left = shrinks
    const delta    = e.clientX - startX;
    const newWidth = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, startWidth + delta));
    panel.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--left-panel-width', `${newWidth}px`);
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(parseInt(panel.style.width, 10)));
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',   onMouseUp);
  };

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    dragging   = true;
    startX     = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor     = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  });

  // Touch support
  handle.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    startX     = touch.clientX;
    startWidth = panel.offsetWidth;
    dragging   = true;
    handle.classList.add('dragging');
  }, { passive: true });

  handle.addEventListener('touchmove', (e: TouchEvent) => {
    if (!dragging) return;
    const touch    = e.touches[0];
    const delta    = touch.clientX - startX;
    const newWidth = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, startWidth + delta));
    panel.style.width = `${newWidth}px`;
    document.documentElement.style.setProperty('--left-panel-width', `${newWidth}px`);
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    localStorage.setItem(LEFT_PANEL_WIDTH_KEY, panel.style.width.replace('px', ''));
  });

  console.log('[Atlas] Left panel resize initialised');
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function showToast(message: string, duration = 2200): void {
  let toast = document.getElementById('atlas-kb-toast') as HTMLDivElement | null;
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'atlas-kb-toast';
    toast.className = 'atlas-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout((toast as any)._timer);
  (toast as any)._timer = setTimeout(() => toast!.classList.remove('visible'), duration);
}

function getPanelEl(name: string): HTMLElement | null {
  return document.querySelector(`[data-panel="${name}"]`) ?? document.getElementById(`panel-${name}`);
}

function togglePanelVisibility(name: string, label: string): void {
  const el = getPanelEl(name);
  if (!el) return;
  const isHidden = el.style.display === 'none' || el.classList.contains('panel-hidden');
  if (isHidden) {
    el.style.display = '';
    el.classList.remove('panel-hidden');
    showToast(`${label} panel shown`);
  } else {
    el.style.display = 'none';
    showToast(`${label} panel hidden`);
  }
}

async function initKeyboardShortcuts(): Promise<void> {
  const { setAutoExecute, getAutoExecute } = await import('./trading/engine/execution-loop');
  const { portfolioManager } = await import('./trading/engine/portfolio-manager');

  let killSwitchActive = false;

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore when user is typing in an input field
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      // T → toggle portfolio panel
      case 't':
      case 'T': {
        e.preventDefault();
        togglePanelVisibility('portfolio', 'Portfolio');
        break;
      }

      // S → toggle signals panel
      case 's':
      case 'S': {
        e.preventDefault();
        togglePanelVisibility('signals', 'Signals');
        break;
      }

      // P → toggle performance panel
      case 'p':
      case 'P': {
        e.preventDefault();
        togglePanelVisibility('performance', 'Performance');
        break;
      }

      // Space → pause / resume auto-trading
      case ' ': {
        e.preventDefault();
        if (killSwitchActive) {
          showToast('Kill switch active — press Escape to reset first');
          return;
        }
        const nowAuto = !getAutoExecute();
        setAutoExecute(nowAuto);

        // Sync header toggle
        const toggleBtn = document.getElementById('paper-trading-toggle');
        const statusEl  = document.getElementById('pt-toggle-status');
        if (toggleBtn && statusEl) {
          toggleBtn.classList.remove('pt-active', 'pt-paused');
          if (nowAuto) { toggleBtn.classList.add('pt-active'); statusEl.textContent = 'AUTO'; }
          else         { toggleBtn.classList.add('pt-paused'); statusEl.textContent = 'MANUAL'; }
        }

        showToast(nowAuto ? '▶ Auto-execute RESUMED' : '⏸ Auto-execute PAUSED');
        break;
      }

      // Escape → kill switch — halts all trading, flattens nothing but stops execution
      case 'Escape': {
        if (killSwitchActive) {
          // Second Escape resets kill switch
          killSwitchActive = false;
          setAutoExecute(true);
          const btn  = document.getElementById('paper-trading-toggle');
          const sEl  = document.getElementById('pt-toggle-status');
          if (btn && sEl) { btn.classList.remove('pt-killed'); btn.classList.add('pt-active'); sEl.textContent = 'AUTO'; }
          showToast('⚡ Kill switch RESET — auto-execute resumed');
          return;
        }
        killSwitchActive = true;
        setAutoExecute(false);
        const btn  = document.getElementById('paper-trading-toggle');
        const sEl  = document.getElementById('pt-toggle-status');
        if (btn && sEl) {
          btn.classList.remove('pt-active', 'pt-paused');
          btn.classList.add('pt-killed');
          sEl.textContent = 'KILLED';
        }
        console.warn('[Atlas] KILL SWITCH ACTIVATED — all auto-trading halted');
        showToast('🛑 KILL SWITCH — all trading halted. Press Esc again to reset.', 4000);
        break;
      }
    }
  });

  console.log('[Atlas] Keyboard shortcuts: T=portfolio  S=signals  P=performance  Space=pause  Esc=kill');
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  console.log('[Atlas] Initialising Global Intelligence Platform…');

  // Vercel Analytics
  try {
    const { inject } = await import('@vercel/analytics');
    inject();
  } catch { /* no-op in dev */ }

  initTheme();

  initGlobe();

  // Trading engine must initialize before panels (portfolio panel imports tradingEngine at module level)
  const { initTradingEngine } = await import('./trading/index');
  initTradingEngine();

  const { initBootstrap } = await import('./trading/bootstrap');
  initBootstrap();

  // Now safe to load panels
  await initPanels();

  initThemeToggle();

  // Intelligence engine
  try {
    const { initIntelligenceEngine } = await import('./intelligence/index');
    initIntelligenceEngine();
  } catch (err) {
    console.error('[Atlas] Intelligence engine failed:', err);
  }

  // UI controls
  await initPaperTradingToggle();
  initStatusBar();
  initGlobeWiring();
  initLeftPanelResize();
  initRightPanelResize();
  await initKeyboardShortcuts();

  // Command palette
  try {
    const { commandPalette } = await import('./lib/command-palette');
    commandPalette.init();
    const cmdHint = document.getElementById('cmd-palette-hint');
    if (cmdHint) cmdHint.addEventListener('click', () => commandPalette.open());
  } catch (err) {
    console.warn('[Atlas] Command palette unavailable:', err);
  }

  // WebSocket relay (defer to let prices load first)
  setTimeout(initWebSockets, 1_000);

  console.log('[Atlas] Initialisation complete — globe + intelligence + trading active');
}

// DOM ready guard
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// DevTools surface
if (import.meta.env.DEV) {
  (window as any).atlas = { state, wsManager };
}
