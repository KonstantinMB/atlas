/**
 * Globe Layer Controls
 * Polished toggle-switch UI for the left panel
 */

import { getStore } from '../lib/state';
import { getLayerRegistry } from './layer-registry';
import { getGlobe } from './globe';

const LAYER_ICONS: Record<string, string> = {
  'military-bases':      '⚔',
  'nuclear-facilities':  '☢',
  'undersea-cables':     '〰',
  'pipelines':           '⬛',
  'chokepoints':         '⚓',
  'financial-centers':   '💹',
  'conflict-zones':      '⚠',
  'earthquakes':         '🌋',
  'fires':               '🔥',
  'aircraft':            '✈',
  'test-markers':        '◉',
};

const CATEGORY_LABELS: Record<string, string> = {
  military:       'Military',
  infrastructure: 'Infrastructure',
  economic:       'Economic',
  intelligence:   'Intelligence',
  environmental:  'Environmental',
};

/**
 * Initialize layer controls — called once at startup
 */
export function initLayerControls(): void {
  const leftPanel = document.getElementById('left-panel');
  if (!leftPanel) {
    console.error('[Controls] Left panel not found');
    return;
  }

  renderLayerControls(leftPanel);
  console.log('[Controls] Layer controls initialized');
}

/**
 * Full render of the layer panel
 */
function renderLayerControls(container: HTMLElement): void {
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'layers-header';
  header.textContent = 'LAYERS';
  container.appendChild(header);

  const store = getStore();
  const registry = getLayerRegistry();
  const allMetadata = registry.getAllMetadata();

  // Group by category
  const categories = new Map<string, typeof allMetadata>();
  allMetadata.forEach(meta => {
    if (!categories.has(meta.category)) {
      categories.set(meta.category, []);
    }
    categories.get(meta.category)!.push(meta);
  });

  const activeLayers = store.get('globe').activeLayers;

  // Render each category + its layers
  categories.forEach((layers, category) => {
    const catSection = document.createElement('div');
    catSection.className = 'layer-category';

    const catLabel = document.createElement('div');
    catLabel.className = 'layer-category-label';
    catLabel.textContent = CATEGORY_LABELS[category] ?? category;
    catSection.appendChild(catLabel);

    layers.forEach(meta => {
      const row = buildLayerRow(meta.id, meta.name, meta.color, activeLayers.has(meta.id));
      catSection.appendChild(row);
    });

    container.appendChild(catSection);
  });

  // Sync active state when store changes (no full re-render)
  store.subscribe('globe', (globeState) => {
    container.querySelectorAll<HTMLElement>('[data-layer-id]').forEach(row => {
      const id = row.dataset.layerId!;
      const isActive = globeState.activeLayers.has(id);
      row.classList.toggle('active', isActive);
    });
  });
}

/**
 * Build a single layer row element
 */
function buildLayerRow(
  id: string,
  name: string,
  color: string,
  isActive: boolean,
): HTMLElement {
  const row = document.createElement('div');
  row.className = `layer-row${isActive ? ' active' : ''}`;
  row.dataset.layerId = id;
  row.style.setProperty('--layer-color', color);

  // Toggle switch
  const switchWrap = document.createElement('div');
  switchWrap.className = 'layer-toggle-switch';
  const track = document.createElement('div');
  track.className = 'layer-toggle-track';
  const thumb = document.createElement('div');
  thumb.className = 'layer-toggle-thumb';
  track.appendChild(thumb);
  switchWrap.appendChild(track);

  // Glow dot
  const dot = document.createElement('span');
  dot.className = 'layer-dot';
  dot.style.background = color;
  dot.style.boxShadow = `0 0 6px ${color}`;

  // Icon
  const icon = document.createElement('span');
  icon.className = 'layer-icon';
  icon.textContent = LAYER_ICONS[id] ?? '●';

  // Name
  const label = document.createElement('span');
  label.className = 'layer-name';
  label.textContent = name;

  row.appendChild(switchWrap);
  row.appendChild(dot);
  row.appendChild(icon);
  row.appendChild(label);

  // Click anywhere on the row toggles the layer
  row.addEventListener('click', () => {
    const store = getStore();
    const globe = getGlobe();
    const registry = getLayerRegistry();

    store.update('globe', (current) => {
      const next = new Set(current.activeLayers);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...current, activeLayers: next };
    });

    // Rebuild layer in deck.gl
    const nowActive = store.get('globe').activeLayers.has(id);
    if (nowActive) {
      const layer = registry.createLayer(id);
      if (layer) globe.registerLayer(id, layer);
    } else {
      globe.unregisterLayer(id);
    }
  });

  return row;
}
