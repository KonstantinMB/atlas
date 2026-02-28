/**
 * Atlas - Global Intelligence Platform
 * Entry point for the application
 */

import { initState } from './lib/state';
import { WebSocketManager } from './lib/websocket';
import { initTheme, toggleTheme, getTheme } from './lib/theme';
import { dataService } from './lib/data-service';

// Initialize application state
const state = initState();

// WebSocket manager for real-time data streams
let wsManager: WebSocketManager | null = null;

/**
 * Initialize the globe and map layers
 */
async function initGlobe(): Promise<void> {
  const container = document.getElementById('globe-container');
  if (!container) {
    console.error('Globe container not found');
    return;
  }

  try {
    // Import globe initialization
    const { initGlobe: initGlobeInstance, setGlobeTheme } = await import('./globe/globe');

    // Import all layers to register them
    await import('./globe/layers/test-markers');
    await import('./globe/layers/military-bases');
    await import('./globe/layers/nuclear-facilities');
    await import('./globe/layers/undersea-cables');
    await import('./globe/layers/pipelines');
    await import('./globe/layers/chokepoints');
    await import('./globe/layers/financial-centers');
    await import('./globe/layers/conflict-zones');

    // Import live data layers (deferred fetches run internally)
    await import('./globe/layers/earthquakes');
    await import('./globe/layers/fires');
    await import('./globe/layers/aircraft');

    // Initialize globe
    const globe = initGlobeInstance(container);
    console.log('[Atlas] Globe initialized successfully');

    // Get layer registry and sync with globe
    const { getLayerRegistry } = await import('./globe/layer-registry');
    const registry = getLayerRegistry();

    // Use stored active layers or fall back to registry defaults
    const storedActiveSet = state.get('globe').activeLayers;
    const defaultActiveIds = registry.getDefaultActiveIds();
    const activeLayerIds: string[] =
      storedActiveSet.size > 0 ? Array.from(storedActiveSet) : defaultActiveIds;

    // Persist the resolved active layers to state
    state.update('globe', (current) => ({
      ...current,
      activeLayers: new Set(activeLayerIds),
    }));

    // Create and register active layers with the globe
    activeLayerIds.forEach((layerId: string) => {
      const layer = registry.createLayer(layerId);
      if (layer) {
        globe.registerLayer(layerId, layer);
      }
    });

    console.log('[Atlas] Loaded layers:', activeLayerIds);

    // Initialize layer controls
    const { initLayerControls } = await import('./globe/controls');
    initLayerControls();

    // Listen for theme changes and update globe basemap
    window.addEventListener('themechange', (e: any) => {
      setGlobeTheme(e.detail.theme);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      globe.resize();
    });

  } catch (error) {
    console.error('[Atlas] Globe initialization failed:', error);
  }
}

/**
 * Initialize panels on the right sidebar
 */
async function initPanels(): Promise<void> {
  const rightPanel = document.getElementById('right-panel');
  if (!rightPanel) {
    console.error('Right panel container not found');
    return;
  }

  // Import panel manager first — it's required by all panels
  const { initPanelManager } = await import('./panels/panel-manager');
  initPanelManager();

  // Each panel gets its own try-catch so one failure never blocks the rest
  const panels: Array<{ name: string; loader: () => Promise<{ [key: string]: () => void }>; fn: string }> = [
    { name: 'strategic-risk',      loader: () => import('./panels/strategic-risk'),      fn: 'initStrategicRiskPanel' },
    { name: 'portfolio',           loader: () => import('./panels/portfolio'),            fn: 'initPortfolioPanel' },
    { name: 'signals',             loader: () => import('./panels/signals'),              fn: 'initSignalsPanel' },
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
    } catch (err) {
      console.error(`[Atlas] Panel "${panel.name}" failed to initialize:`, err);
    }
  }

  console.log('[Atlas] Panels initialized');

  // Start data service polling after all panels have registered their listeners
  dataService.startPolling();
  console.log('[Atlas] Data service polling started');
}

/**
 * Initialize WebSocket connections for real-time data
 * Connects to the Railway relay for AIS vessel and OpenSky aircraft streams.
 */
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

    if (msg.type === 'aircraft' && Array.isArray(msg.data)) {
      window.dispatchEvent(new CustomEvent('aircraft-update', { detail: msg.data }));
    } else if (msg.type === 'ais' && msg.data) {
      window.dispatchEvent(new CustomEvent('ais-vessel', { detail: msg.data }));
    }
  });

  wsManager.on('open', () => {
    console.log('[Atlas] WebSocket relay connected');
    // Subscribe to both channels explicitly
    wsManager!.send(JSON.stringify({ type: 'subscribe', channels: ['ais', 'aircraft'] }));
  });

  wsManager.connect();

  // Expose for debugging
  if (import.meta.env.DEV) {
    (window as any).atlas.wsManager = wsManager;
  }
}

/**
 * Initialize theme toggle button
 */
function initThemeToggle(): void {
  const toggleButton = document.getElementById('theme-toggle');
  const iconSpan = toggleButton?.querySelector('.theme-icon');

  if (!toggleButton || !iconSpan) {
    console.error('Theme toggle button not found');
    return;
  }

  // Update icon based on current theme
  const updateIcon = () => {
    const theme = getTheme();
    iconSpan.textContent = theme === 'dark' ? '🌙' : '☀️';
  };

  // Set initial icon
  updateIcon();

  // Handle toggle click
  toggleButton.addEventListener('click', () => {
    toggleTheme();
    updateIcon();
  });

  // Handle keyboard shortcut: Ctrl/Cmd + Shift + T
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      toggleTheme();
      updateIcon();
    }
  });

  // Listen for theme changes from other sources
  window.addEventListener('themechange', updateIcon);

  console.log('[Atlas] Theme toggle initialized');
}

/**
 * Main application initialization
 */
async function init(): Promise<void> {
  console.log('[Atlas] Initializing Global Intelligence Platform...');
  console.log('[Atlas] Environment:', import.meta.env.MODE);

  // Initialize theme system first (before any UI rendering)
  initTheme();

  // Initialize core components
  initGlobe();
  await initPanels();
  initThemeToggle();

  // Initialize intelligence engine (CII, convergence, anomaly detection)
  const { initIntelligenceEngine } = await import('./intelligence/index');
  initIntelligenceEngine();

  // Initialize paper trading engine (strategies, signals, portfolio)
  const { initTradingEngine } = await import('./trading/index');
  initTradingEngine();

  // Initialize command palette (after globe and panels are ready)
  const { commandPalette } = await import('./lib/command-palette');
  commandPalette.init();

  // Wire the header hint badge to open the palette
  const cmdHint = document.getElementById('cmd-palette-hint');
  if (cmdHint) {
    cmdHint.addEventListener('click', () => commandPalette.open());
  }

  // WebSocket connections (deferred to avoid blocking)
  setTimeout(initWebSockets, 1000);

  console.log('[Atlas] Initialization complete');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging in console
if (import.meta.env.DEV) {
  (window as any).atlas = {
    state,
    wsManager,
  };
}
