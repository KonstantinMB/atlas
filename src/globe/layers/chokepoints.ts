/**
 * Chokepoints Layer
 * Displays critical maritime chokepoints and strategic waterways
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import CHOKEPOINTS_DATA from '../../data/chokepoints.json';

interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  throughput: string;
  importance: string;
}

const CHOKEPOINTS = CHOKEPOINTS_DATA as Chokepoint[];

const metadata: LayerMetadata = {
  id: 'chokepoints',
  name: 'Maritime Chokepoints',
  description: 'Strategic maritime chokepoints controlling global trade and energy flows',
  category: 'infrastructure',
  color: '#facc15',
  defaultActive: true,
};

function createChokepointsLayer() {
  return new ScatterplotLayer<Chokepoint>({
    id: 'chokepoints',
    data: CHOKEPOINTS,
    pickable: true,
    opacity: 0.95,
    stroked: true,
    filled: true,
    radiusScale: 1,
    radiusMinPixels: 6,
    radiusMaxPixels: 22,
    lineWidthMinPixels: 2,
    getPosition: (d) => [d.lon, d.lat, 0],
    getRadius: 8,
    getFillColor: [250, 204, 21, 170],
    getLineColor: [250, 204, 21, 255],
  });
}

registerLayerDef(metadata, createChokepointsLayer);

export { createChokepointsLayer };
