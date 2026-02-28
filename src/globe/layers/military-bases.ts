/**
 * Military Bases Layer
 * Displays global military installations color-coded by alliance
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import BASES_DATA from '../../data/military-bases.json';

interface MilitaryBase {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  type: 'air' | 'naval' | 'joint' | 'army';
  alliance: string;
}

const BASES = BASES_DATA as MilitaryBase[];

function getAllianceColor(alliance: string): [number, number, number, number] {
  switch (alliance) {
    case 'NATO':
      return [59, 130, 246, 230];
    case 'Russia':
      return [239, 68, 68, 230];
    case 'China':
      return [249, 115, 22, 230];
    default:
      return [156, 163, 175, 220];
  }
}

const metadata: LayerMetadata = {
  id: 'military-bases',
  name: 'Military Bases',
  description: 'Global military installations color-coded by alliance (NATO, Russia, China)',
  category: 'military',
  color: '#3b82f6',
  defaultActive: false,
};

function createMilitaryBasesLayer() {
  return new ScatterplotLayer<MilitaryBase>({
    id: 'military-bases',
    data: BASES,
    pickable: true,
    opacity: 0.95,
    stroked: true,
    filled: true,
    radiusScale: 1,
    radiusMinPixels: 4,
    radiusMaxPixels: 14,
    lineWidthMinPixels: 1.5,
    getPosition: (d) => [d.lon, d.lat, 0],
    getRadius: 3,
    getFillColor: (d) => getAllianceColor(d.alliance),
    getLineColor: (d) => {
      const [r, g, b] = getAllianceColor(d.alliance);
      return [r, g, b, 255];
    },
  });
}

registerLayerDef(metadata, createMilitaryBasesLayer);

export { createMilitaryBasesLayer };
