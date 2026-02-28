/**
 * Financial Centers Layer
 * Displays major global financial hubs - exchanges, central banks, institutions
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { registerLayerDef } from '../layer-registry';
import type { LayerMetadata } from '../layer-registry';
import FINANCIAL_DATA from '../../data/financial-centers.json';

interface FinancialCenter {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  type: string;
}

const CENTERS = FINANCIAL_DATA as FinancialCenter[];

const metadata: LayerMetadata = {
  id: 'financial-centers',
  name: 'Financial Centers',
  description: 'Major global financial hubs: stock exchanges, central banks, institutions',
  category: 'economic',
  color: '#10b981',
  defaultActive: true,
};

function createFinancialCentersLayer() {
  return new ScatterplotLayer<FinancialCenter>({
    id: 'financial-centers',
    data: CENTERS,
    pickable: true,
    opacity: 0.9,
    stroked: true,
    filled: true,
    radiusScale: 1,
    radiusMinPixels: 5,
    radiusMaxPixels: 18,
    lineWidthMinPixels: 1.5,
    getPosition: (d) => [d.lon, d.lat, 0],
    getRadius: 5,
    getFillColor: [16, 185, 129, 150],
    getLineColor: [16, 185, 129, 255],
  });
}

registerLayerDef(metadata, createFinancialCentersLayer);

export { createFinancialCentersLayer };
