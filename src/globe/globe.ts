/**
 * Globe Initialization
 * deck.gl + MapLibre GL JS
 * No Mapbox license required - using free CartoDB basemaps
 */

import { Deck } from '@deck.gl/core';
import type { Layer, PickingInfo } from '@deck.gl/core';
import type { MapViewState } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getStore } from '../lib/state';
import { showEntityPopup, hideEntityPopup, initEntityPopup } from './entity-popup';
import type { EntityInfo } from './entity-popup';

/**
 * Theme-aware basemap styles
 */
const BASEMAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
} as const;

/**
 * Initial view state configuration
 * Centered on Middle East/Mediterranean region
 */
const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 30,
  latitude: 25,
  zoom: 2.5,
  pitch: 35,
  bearing: 0,
  minZoom: 1,
  maxZoom: 18,
  minPitch: 0,
  maxPitch: 60,
};

/**
 * Globe manager class
 * Handles deck.gl instance, MapLibre basemap, and layer management
 */
class GlobeManager {
  private deck: Deck | null = null;
  private map: maplibregl.Map | null = null;
  private container: HTMLElement | null = null;
  private currentTheme: 'dark' | 'light' = 'dark';
  private layerRegistry: Map<string, Layer> = new Map();
  private activeLayerIds: Set<string> = new Set();

  /**
   * Initialize the globe
   */
  init(container: HTMLElement): void {
    if (this.deck) {
      console.warn('[Globe] Already initialized');
      return;
    }

    this.container = container;
    const store = getStore();

    // Get initial active layers from state
    const globeState = store.get('globe');
    this.activeLayerIds = new Set(globeState.activeLayers);

    // Create MapLibre GL JS map
    this.map = new maplibregl.Map({
      container,
      style: BASEMAP_STYLES[this.currentTheme],
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch ?? 0,
      bearing: INITIAL_VIEW_STATE.bearing ?? 0,
      interactive: false, // deck.gl will handle interaction
      attributionControl: false, // Clean UI
    });

    // Initialize deck.gl
    this.deck = new Deck({
      parent: container as HTMLDivElement,
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
      },
      initialViewState: INITIAL_VIEW_STATE,
      controller: {
        dragRotate: true,
        touchRotate: true,
        scrollZoom: true,
        doubleClickZoom: true,
        keyboard: true,
        inertia: true,
      },
      // Sync deck.gl view state with MapLibre
      onViewStateChange: ({ viewState }) => {
        if (this.map) {
          this.map.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing ?? 0,
            pitch: viewState.pitch ?? 0,
          });
        }

        // Update state
        store.update('globe', (current) => ({
          ...current,
          viewState: {
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            zoom: viewState.zoom,
            pitch: viewState.pitch ?? 0,
            bearing: viewState.bearing ?? 0,
          },
        }));

        return viewState;
      },
      // Handle clicks and hovers
      onClick: (info: PickingInfo) => this.handleClick(info),
      onHover: (info: PickingInfo) => this.handleHover(info),
      // Performance optimizations
      _pickable: true,
      pickingRadius: 5,
      useDevicePixels: true,
    });

    // Update state to mark globe as initialized
    store.update('globe', (current) => ({
      ...current,
      initialized: true,
    }));

    // Initialize entity popup DOM
    initEntityPopup();

    // Subscribe to active layer changes
    store.subscribe('globe', (globeState) => {
      const newActiveLayerIds = new Set(globeState.activeLayers);
      if (!this.setsEqual(newActiveLayerIds, this.activeLayerIds)) {
        this.activeLayerIds = newActiveLayerIds;
        this.updateLayers();
      }
    });

    console.log('[Globe] Initialized with deck.gl + MapLibre');
  }

  /**
   * Register a layer in the registry
   */
  registerLayer(id: string, layer: Layer): void {
    this.layerRegistry.set(id, layer);
    this.updateLayers();
  }

  /**
   * Unregister a layer
   */
  unregisterLayer(id: string): void {
    this.layerRegistry.delete(id);
    this.updateLayers();
  }

  /**
   * Update deck.gl with currently active layers
   */
  updateLayers(layers?: Layer[]): void {
    if (!this.deck) {
      console.warn('[Globe] Cannot update layers - deck not initialized');
      return;
    }

    // If layers array is provided, use it directly
    if (layers) {
      this.deck.setProps({ layers });
      return;
    }

    // Otherwise, filter from registry based on active layer IDs
    const activeLayers: Layer[] = [];
    this.layerRegistry.forEach((layer, id) => {
      if (this.activeLayerIds.has(id)) {
        activeLayers.push(layer);
      }
    });

    this.deck.setProps({ layers: activeLayers });
  }

  /**
   * Toggle a layer on/off
   */
  toggleLayer(layerId: string): void {
    const store = getStore();
    store.update('globe', (current) => {
      const newActiveLayers = new Set(current.activeLayers);
      if (newActiveLayers.has(layerId)) {
        newActiveLayers.delete(layerId);
      } else {
        newActiveLayers.add(layerId);
      }
      return {
        ...current,
        activeLayers: newActiveLayers,
      };
    });
  }

  /**
   * Switch between dark and light basemap
   */
  setTheme(theme: 'dark' | 'light'): void {
    if (!this.map) return;

    this.currentTheme = theme;
    this.map.setStyle(BASEMAP_STYLES[theme]);
    console.log(`[Globe] Switched to ${theme} theme`);
  }

  /**
   * Fly to a specific location
   */
  flyTo(options: {
    longitude: number;
    latitude: number;
    zoom?: number;
    pitch?: number;
    bearing?: number;
    duration?: number;
  }): void {
    if (!this.deck) return;

    const currentViewState = this.deck.getViewports()[0] as any;
    const viewState: MapViewState = {
      longitude: options.longitude,
      latitude: options.latitude,
      zoom: options.zoom ?? currentViewState?.zoom ?? 2.5,
      pitch: options.pitch ?? currentViewState?.pitch ?? 0,
      bearing: options.bearing ?? currentViewState?.bearing ?? 0,
      transitionDuration: options.duration ?? 1000,
    };

    this.deck.setProps({ initialViewState: viewState });
  }

  /**
   * Handle click events on the globe
   */
  private handleClick(info: PickingInfo): void {
    if (!info.object) {
      hideEntityPopup();
      const store = getStore();
      store.set('selected', { country: null, event: null, asset: null });
      return;
    }

    const layerId = info.layer?.id ?? '';
    const obj = info.object as Record<string, unknown>;

    // Show entity popup
    const entity = buildEntityInfo(layerId, obj);
    if (entity) showEntityPopup(entity);

    // Update selected state
    const store = getStore();
    store.update('selected', (current) => {
      if (obj['country']) return { ...current, country: String(obj['id'] ?? obj['country']) };
      if (obj['eventId']) return { ...current, event: String(obj['id'] ?? obj['eventId']) };
      if (obj['assetId']) return { ...current, asset: String(obj['id'] ?? obj['assetId']) };
      return current;
    });
  }

  /**
   * Handle hover events on the globe
   */
  private handleHover(info: PickingInfo): void {
    if (!this.container) return;

    // Update cursor style
    this.container.style.cursor = info.object ? 'pointer' : 'grab';

    // Could show tooltip here in the future
    if (info.object) {
      // console.log('[Globe] Hover:', info.object);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.deck) {
      this.deck.finalize();
      this.deck = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.layerRegistry.clear();
    this.activeLayerIds.clear();
    console.log('[Globe] Destroyed');
  }

  /**
   * Get current deck.gl instance (for debugging)
   */
  getDeck(): Deck | null {
    return this.deck;
  }

  /**
   * Get current MapLibre instance (for debugging)
   */
  getMap(): maplibregl.Map | null {
    return this.map;
  }

  /**
   * Helper: Compare two sets for equality
   */
  private setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }

  /**
   * Handle window resize
   */
  resize(): void {
    if (this.deck) {
      this.deck.setProps({
        width: this.container?.clientWidth ?? window.innerWidth,
        height: this.container?.clientHeight ?? window.innerHeight,
      });
    }
    if (this.map) {
      this.map.resize();
    }
  }
}

// ── Entity info builder ──────────────────────────────────────────────────────

function buildEntityInfo(layerId: string, obj: Record<string, unknown>): EntityInfo | null {
  const str = (v: unknown, fallback = 'Unknown') => (v != null ? String(v) : fallback);
  const coordsVal = (obj['lon'] != null && obj['lat'] != null)
    ? [Number(obj['lon']), Number(obj['lat'])] as [number, number]
    : undefined;
  // Avoid assigning undefined to exactOptionalPropertyType fields
  const withCoords = coordsVal !== undefined ? { coordinates: coordsVal } : {};

  if (layerId === 'military-bases') {
    return {
      id: str(obj['id'] ?? obj['name']),
      name: str(obj['name']),
      type: 'military-base',
      subtitle: `${str(obj['country'])} · ${str(obj['alliance'])}`,
      fields: [
        { label: 'TYPE',     value: str(obj['type']).toUpperCase() },
        { label: 'ALLIANCE', value: str(obj['alliance']) },
        { label: 'COUNTRY',  value: str(obj['country']) },
        { label: 'STATUS',   value: 'ACTIVE' },
      ],
      ...withCoords,
      color: '#3b82f6',
    };
  }

  if (layerId === 'nuclear-facilities') {
    return {
      id: str(obj['id'] ?? obj['name']),
      name: str(obj['name']),
      type: 'nuclear',
      subtitle: `${str(obj['country'])} · ${str(obj['type'], 'Facility')}`,
      fields: [
        { label: 'TYPE',    value: str(obj['type']) },
        { label: 'COUNTRY', value: str(obj['country']) },
        { label: 'STATUS',  value: str(obj['status'], 'Active') },
        { label: 'RISK',    value: 'MONITORED' },
      ],
      ...withCoords,
      severity: 'high' as const,
      color: '#fbbf24',
    };
  }

  if (layerId === 'chokepoints') {
    return {
      id: str(obj['id'] ?? obj['name']),
      name: str(obj['name']),
      type: 'chokepoint',
      subtitle: str(obj['region'], 'Strategic Waterway'),
      fields: [
        { label: 'TYPE',        value: 'MARITIME CHOKEPOINT' },
        { label: 'THROUGHPUT',  value: str(obj['throughput'], 'High') },
        { label: 'IMPORTANCE',  value: str(obj['importance'], 'Critical') },
        { label: 'RISK LEVEL',  value: 'ELEVATED' },
      ],
      ...withCoords,
      severity: 'medium' as const,
      color: '#facc15',
    };
  }

  if (layerId === 'financial-centers') {
    return {
      id: str(obj['id'] ?? obj['name']),
      name: str(obj['name']),
      type: 'financial',
      subtitle: str(obj['country'], 'Financial Hub'),
      fields: [
        { label: 'CITY',     value: str(obj['city']) },
        { label: 'TYPE',     value: str(obj['type']) },
        { label: 'COUNTRY',  value: str(obj['country']) },
        { label: 'STATUS',   value: 'ACTIVE' },
      ],
      ...withCoords,
      color: '#10b981',
    };
  }

  if (layerId === 'earthquakes') {
    const mag = Number(obj['magnitude'] ?? 0);
    const severity = (mag >= 7 ? 'critical' : mag >= 6 ? 'high' : 'medium') as 'critical' | 'high' | 'medium';
    return {
      id: str(obj['id']),
      name: `M${mag.toFixed(1)} Earthquake`,
      type: 'earthquake',
      subtitle: str(obj['place'], 'Unknown Location'),
      fields: [
        { label: 'MAGNITUDE', value: `M${mag.toFixed(1)}` },
        { label: 'DEPTH',     value: `${Number(obj['depth'] ?? 0).toFixed(0)} km` },
        { label: 'TSUNAMI',   value: obj['tsunami'] ? '⚠ YES' : 'No' },
        { label: 'TIME',      value: obj['time'] ? new Date(Number(obj['time'])).toUTCString().slice(0, 16) : 'Unknown' },
      ],
      ...withCoords,
      severity,
      color: '#f97316',
    };
  }

  if (layerId === 'fires') {
    return {
      id: str(obj['id'] ?? `${obj['lat']},${obj['lon']}`),
      name: 'Active Fire Detection',
      type: 'fire',
      subtitle: str(obj['country'], 'Unknown Region'),
      fields: [
        { label: 'BRIGHTNESS', value: str(obj['brightness'], 'N/A') },
        { label: 'CONFIDENCE', value: str(obj['confidence'], 'N/A') },
        { label: 'SATELLITE',  value: str(obj['satellite'], 'N/A') },
        { label: 'FRPS',       value: str(obj['frp'], 'N/A') },
      ],
      ...withCoords,
      severity: 'high' as const,
      color: '#ef4444',
    };
  }

  if (layerId === 'aircraft') {
    return {
      id: str(obj['icao24'] ?? obj['callsign']),
      name: str(obj['callsign'], 'Unknown Aircraft'),
      type: 'aircraft',
      subtitle: `ICAO: ${str(obj['icao24'])}`,
      fields: [
        { label: 'CALLSIGN',  value: str(obj['callsign']) },
        { label: 'ALTITUDE',  value: `${Number(obj['altitude'] ?? 0).toFixed(0)} m` },
        { label: 'SPEED',     value: `${Number(obj['velocity'] ?? 0).toFixed(0)} m/s` },
        { label: 'COUNTRY',   value: str(obj['originCountry']) },
      ],
      ...withCoords,
      color: '#60a5fa',
    };
  }

  // Generic fallback
  if (obj['name']) {
    return {
      id: str(obj['id'] ?? obj['name']),
      name: str(obj['name']),
      type: layerId || 'entity',
      subtitle: str(obj['country'] ?? obj['region'], ''),
      fields: [],
      ...withCoords,
    };
  }

  return null;
}

// Singleton instance
let globeManager: GlobeManager | null = null;

/**
 * Initialize the globe
 */
export function initGlobe(container: HTMLElement): GlobeManager {
  if (!globeManager) {
    globeManager = new GlobeManager();
  }
  globeManager.init(container);
  return globeManager;
}

/**
 * Get the globe manager instance
 */
export function getGlobe(): GlobeManager {
  if (!globeManager) {
    throw new Error('Globe not initialized. Call initGlobe() first.');
  }
  return globeManager;
}

/**
 * Update globe layers (convenience function)
 */
export function updateGlobeLayers(layers: Layer[]): void {
  const globe = getGlobe();
  globe.updateLayers(layers);
}

/**
 * Register a layer
 */
export function registerLayer(id: string, layer: Layer): void {
  const globe = getGlobe();
  globe.registerLayer(id, layer);
}

/**
 * Toggle a layer on/off
 */
export function toggleLayer(layerId: string): void {
  const globe = getGlobe();
  globe.toggleLayer(layerId);
}

/**
 * Switch basemap theme
 */
export function setGlobeTheme(theme: 'dark' | 'light'): void {
  const globe = getGlobe();
  globe.setTheme(theme);
}

/**
 * Fly to location
 */
export function flyToLocation(options: {
  longitude: number;
  latitude: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  duration?: number;
}): void {
  const globe = getGlobe();
  globe.flyTo(options);
}

// Export types
export type { Layer, PickingInfo, MapViewState };
export { GlobeManager };
