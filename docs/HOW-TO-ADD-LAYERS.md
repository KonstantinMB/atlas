# How to Add New Globe Layers

Quick reference guide for adding new data layers to the YC Hedge Fund globe.

## Layer File Template

Create a new file in `/src/globe/layers/` (e.g., `military-bases.ts`):

```typescript
/**
 * [Layer Name] Layer
 * [Brief description of what this layer displays]
 */

import { ScatterplotLayer } from '@deck.gl/layers';
// Or: IconLayer, GeoJsonLayer, ArcLayer, PolygonLayer, etc.
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';

/**
 * Layer data
 * Option 1: Inline data
 */
const DATA = [
  { name: 'Point 1', lon: -74.006, lat: 40.7128 },
  { name: 'Point 2', lon: 0.1276, lat: 51.5074 },
];

/**
 * Option 2: Import from static JSON file
 */
// import DATA from '../../data/military-bases.json';

/**
 * Layer metadata
 */
const metadata: LayerMetadata = {
  id: 'military-bases',              // Unique ID (kebab-case)
  name: 'Military Bases',            // Display name
  description: 'Global military installations',
  category: 'military',              // military | infrastructure | economic | intelligence | environmental
  color: '#ef4444',                  // Hex color for layer indicator
  defaultActive: false,              // Show on initial load?
};

/**
 * Create layer instance
 */
function createLayer() {
  return new ScatterplotLayer({
    id: 'military-bases',            // Must match metadata.id
    data: DATA,
    pickable: true,                  // Enable clicks/hovers
    opacity: 0.8,
    stroked: true,
    filled: true,
    radiusScale: 1000,
    radiusMinPixels: 5,
    radiusMaxPixels: 30,
    lineWidthMinPixels: 1,
    getPosition: (d: any) => [d.lon, d.lat, 0],
    getRadius: (d: any) => d.size || 100,
    getFillColor: [239, 68, 68, 200],     // [R, G, B, A]
    getLineColor: [239, 68, 68, 255],
    updateTriggers: {
      getPosition: DATA,
    },
  });
}

// Register the layer (runs on module import)
registerLayerDef(metadata, createLayer);

// Export for direct use (optional)
export { createLayer, DATA };
```

## Common Layer Types

### ScatterplotLayer (Points)
Best for: Cities, bases, facilities, events

```typescript
import { ScatterplotLayer } from '@deck.gl/layers';

new ScatterplotLayer({
  id: 'my-layer',
  data: DATA,
  getPosition: d => [d.lon, d.lat],
  getRadius: d => d.size,
  getFillColor: [255, 0, 0, 200],
});
```

### IconLayer (Custom Icons)
Best for: POIs with custom markers

```typescript
import { IconLayer } from '@deck.gl/layers';

new IconLayer({
  id: 'my-layer',
  data: DATA,
  getPosition: d => [d.lon, d.lat],
  getIcon: d => 'marker',
  getSize: 40,
  iconAtlas: '/icons/atlas.png',
  iconMapping: { marker: { x: 0, y: 0, width: 128, height: 128 } },
});
```

### GeoJsonLayer (Polygons/Lines)
Best for: Borders, regions, routes, cables

```typescript
import { GeoJsonLayer } from '@deck.gl/geo-layers';

new GeoJsonLayer({
  id: 'my-layer',
  data: GEOJSON_DATA,
  filled: true,
  stroked: true,
  getFillColor: [255, 0, 0, 100],
  getLineColor: [255, 0, 0, 255],
  getLineWidth: 2,
  lineWidthMinPixels: 1,
});
```

### ArcLayer (Connections)
Best for: Trade routes, flight paths, connections

```typescript
import { ArcLayer } from '@deck.gl/layers';

new ArcLayer({
  id: 'my-layer',
  data: DATA,
  getSourcePosition: d => [d.fromLon, d.fromLat],
  getTargetPosition: d => [d.toLon, d.toLat],
  getSourceColor: [255, 0, 0],
  getTargetColor: [0, 0, 255],
  getWidth: 2,
});
```

### HeatmapLayer (Density)
Best for: Event density, risk zones

```typescript
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

new HeatmapLayer({
  id: 'my-layer',
  data: DATA,
  getPosition: d => [d.lon, d.lat],
  getWeight: d => d.intensity,
  radiusPixels: 60,
  intensity: 1,
  threshold: 0.03,
});
```

## Data File Structure

### For ScatterplotLayer/IconLayer
`/src/data/military-bases.json`:
```json
[
  {
    "id": "base-001",
    "name": "Ramstein Air Base",
    "country": "DEU",
    "lon": 7.6003,
    "lat": 49.4369,
    "type": "air",
    "size": 150
  }
]
```

### For GeoJsonLayer
`/src/data/conflict-zones.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Syria Conflict Zone",
        "severity": "high"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [36.0, 33.0],
          [42.0, 33.0],
          [42.0, 37.0],
          [36.0, 37.0],
          [36.0, 33.0]
        ]]
      }
    }
  ]
}
```

## Import the Layer

In `/src/main.ts`, add your layer to the import:

```typescript
// Import test layer to register it
await import('./globe/layers/test-markers');
await import('./globe/layers/military-bases');  // Add this line
```

Or create a central layers index file:

`/src/globe/layers/index.ts`:
```typescript
// Import all layers to register them
import './test-markers';
import './military-bases';
import './nuclear-facilities';
import './undersea-cables';
// ... etc

export {};
```

Then in `main.ts`:
```typescript
await import('./globe/layers');
```

## Layer Categories

Use these predefined categories for consistent grouping:

- **`military`**: Military bases, weapons, conflicts
- **`infrastructure`**: Cables, pipelines, power grids
- **`economic`**: Financial centers, trade routes, markets
- **`intelligence`**: OSINT events, surveillance, signals
- **`environmental`**: Fires, earthquakes, weather

## Color Conventions

Suggested colors by category (from CSS variables):

- **Critical/High Risk**: `#ef4444` (red)
- **Medium Risk**: `#f97316` (orange)
- **Low Risk**: `#22c55e` (green)
- **Infrastructure**: `#3b82f6` (blue)
- **Intelligence**: `#4ade80` (green accent)
- **Economic**: `#eab308` (yellow)

## Performance Tips

1. **Lazy Loading**: Keep layer factories lightweight, load data on-demand
2. **Data Limits**: Aim for <10K points per layer for smooth 60fps
3. **LOD**: Use `radiusMinPixels`/`radiusMaxPixels` for zoom-based scaling
4. **Update Triggers**: Only specify when data changes dynamically
5. **Picking**: Set `pickable: false` for layers that don't need interaction

## Testing Checklist

After adding a layer:

- [ ] Layer appears in left panel under correct category
- [ ] Toggling layer on/off works
- [ ] Layer renders at correct positions
- [ ] Colors match layer metadata
- [ ] Clicking layer items triggers state updates (if pickable)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No console errors in browser
- [ ] Performance remains smooth (60fps)

## Example: Complete Pipeline Layer

`/src/globe/layers/pipelines.ts`:

```typescript
import { GeoJsonLayer } from '@deck.gl/geo-layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import PIPELINE_DATA from '../../data/pipelines.geojson';

const metadata: LayerMetadata = {
  id: 'pipelines',
  name: 'Oil & Gas Pipelines',
  description: 'Major energy pipeline infrastructure',
  category: 'infrastructure',
  color: '#f97316',
  defaultActive: false,
};

function createPipelinesLayer() {
  return new GeoJsonLayer({
    id: 'pipelines',
    data: PIPELINE_DATA,
    pickable: true,
    stroked: true,
    filled: false,
    lineWidthScale: 1,
    lineWidthMinPixels: 2,
    getLineColor: (d: any) => {
      const color = d.properties.type === 'oil'
        ? [249, 115, 22, 255]   // Orange for oil
        : [59, 130, 246, 255];  // Blue for gas
      return color;
    },
    getLineWidth: 3,
    updateTriggers: {
      getLineColor: PIPELINE_DATA,
    },
  });
}

registerLayerDef(metadata, createPipelinesLayer);

export { createPipelinesLayer };
```

---

**Ready to add layers?** Start with static data layers, then move to live data feeds in Phase 2.
