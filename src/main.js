/**
 * YC Hedge Fund - Global Intelligence Platform
 * Entry point for the application
 */
import { initState } from './lib/state';
// Initialize application state
const state = initState();
// WebSocket manager for real-time data streams
let wsManager = null;
/**
 * Initialize the globe and map layers
 */
function initGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) {
        console.error('Globe container not found');
        return;
    }
    console.log('[YC Hedge Fund] Globe initialization placeholder - deck.gl setup will go here');
    // TODO: Initialize deck.gl + MapLibre GL JS
    // TODO: Load static layers from /src/data/
}
/**
 * Initialize panels on the right sidebar
 */
function initPanels() {
    const rightPanel = document.getElementById('right-panel');
    if (!rightPanel) {
        console.error('Right panel container not found');
        return;
    }
    console.log('[YC Hedge Fund] Panel initialization placeholder');
    // TODO: Initialize collapsible panels
    // TODO: Load real-time data feeds
}
/**
 * Initialize WebSocket connections for real-time data
 */
function initWebSockets() {
    // Railway relay WebSocket will be initialized here
    console.log('[YC Hedge Fund] WebSocket initialization placeholder');
    // TODO: Connect to Railway relay for AIS + OpenSky streams
}
/**
 * Main application initialization
 */
function init() {
    console.log('[YC Hedge Fund] Initializing Global Intelligence Platform...');
    console.log('[YC Hedge Fund] Environment:', import.meta.env.MODE);
    // Initialize core components
    initGlobe();
    initPanels();
    // WebSocket connections (deferred to avoid blocking)
    setTimeout(initWebSockets, 1000);
    console.log('[YC Hedge Fund] Initialization complete');
}
// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
// Export for debugging in console
if (import.meta.env.DEV) {
    window.atlas = {
        state,
        wsManager,
    };
}
//# sourceMappingURL=main.js.map