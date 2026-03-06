/**
 * Polymarket Metrics Aggregator Edge Function
 *
 * Fetches prediction markets from Polymarket, enriches top markets with
 * historical data, and computes sentiment momentum for the trading engine.
 *
 * GET /api/osint/polymarket-metrics
 *
 * Returns: { markets: MarketMetrics[], timestamp }
 * Cache: 5 min
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';
import type { PredictionMarket, MarketMetrics, PolymarketMetricsResponse } from '../../src/lib/prediction-markets';

export const config = { runtime: 'edge' };

const POLYMARKET_URL = 'https://gamma-api.polymarket.com/events?limit=50&active=true';
const CLOB_HISTORY_URL = 'https://clob.polymarket.com/prices-history';
const TOP_MARKETS_COUNT = 15; // Fetch history for top 15 by volume

interface PolymarketRawMarket {
  id?: string;
  question?: string;
  outcomePrices?: string | string[];
  volume?: string | number;
  endDate?: string;
  clobTokenIds?: string[];
  conditionId?: string;
}

interface PolymarketRawEvent {
  id?: string;
  title?: string;
  description?: string;
  volume?: string | number;
  endDate?: string;
  tags?: Array<{ label?: string; slug?: string }>;
  markets?: PolymarketRawMarket[];
}

interface CLOBHistoryPoint {
  t: number; // seconds
  p: number;
}

interface CLOBHistoryResponse {
  history: CLOBHistoryPoint[];
}

function parseVolume(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function parseOutcomePrices(market: PolymarketRawMarket): [number, number] {
  try {
    let prices: string[] | undefined;
    if (typeof market.outcomePrices === 'string') {
      prices = JSON.parse(market.outcomePrices);
    } else if (Array.isArray(market.outcomePrices)) {
      prices = market.outcomePrices;
    }

    if (prices && prices.length >= 2) {
      const yes = parseFloat(prices[0] ?? '0.5');
      const no = parseFloat(prices[1] ?? '0.5');
      return [
        isNaN(yes) ? 0.5 : Math.max(0, Math.min(1, yes)),
        isNaN(no) ? 0.5 : Math.max(0, Math.min(1, no)),
      ];
    }
  } catch {
    // ignore
  }
  return [0.5, 0.5];
}

function parseCategory(event: PolymarketRawEvent): string {
  if (event.tags?.length) {
    const tag = event.tags[0];
    return tag?.label || tag?.slug || 'Politics';
  }

  const text = (event.title || event.description || '').toLowerCase();
  if (text.includes('election') || text.includes('president')) return 'Politics';
  if (text.includes('war') || text.includes('military') || text.includes('conflict'))
    return 'Geopolitics';
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('market'))
    return 'Finance';
  if (text.includes('climate') || text.includes('weather') || text.includes('disaster'))
    return 'Climate';
  return 'Global Events';
}

/**
 * Extract CLOB market ID from Polymarket event
 * Priority: clobTokenIds[0] > conditionId > event.id
 */
function getCLOBMarketId(event: PolymarketRawEvent): string | null {
  const market = event.markets?.[0];
  if (!market) return null;

  // Try clobTokenIds first
  if (market.clobTokenIds && Array.isArray(market.clobTokenIds) && market.clobTokenIds.length > 0) {
    return market.clobTokenIds[0] ?? null;
  }

  // Fall back to conditionId
  if (market.conditionId) {
    return market.conditionId;
  }

  // Last resort: event ID (may not work for CLOB)
  return event.id || null;
}

async function fetchCLOBHistory(marketId: string): Promise<CLOBHistoryPoint[]> {
  try {
    const url = `${CLOB_HISTORY_URL}?market=${encodeURIComponent(marketId)}&interval=1h`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return [];
    }

    const data: CLOBHistoryResponse = await res.json();
    return data.history || [];
  } catch {
    return [];
  }
}

/**
 * Compute sentiment momentum: (price_now - price_24h_ago) / max(price_24h_ago, 0.01)
 * Clamped to [-1, 1]
 */
function computeSentimentMomentum(history: CLOBHistoryPoint[], currentPrice: number): number {
  if (history.length === 0) return 0;

  // Find price ~24h ago (86400 seconds)
  const now = Math.floor(Date.now() / 1000);
  const target24h = now - 86400;

  // Find closest historical point to 24h ago
  let closest: CLOBHistoryPoint | null = null;
  let minDiff = Infinity;

  for (const point of history) {
    const diff = Math.abs(point.t - target24h);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  if (!closest) return 0;

  const price24h = closest.p;
  const momentum = (currentPrice - price24h) / Math.max(price24h, 0.01);

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, momentum));
}

export default withCors(async (_req: Request) => {
  const response = await withCache<PolymarketMetricsResponse>(
    'osint:polymarket-metrics',
    300, // 5 min cache
    async () => {
      // 1. Fetch markets from Gamma API
      const gammaRes = await fetch(POLYMARKET_URL, {
        headers: { Accept: 'application/json' },
      });

      if (!gammaRes.ok) {
        throw new Error(`Polymarket Gamma API error: ${gammaRes.status}`);
      }

      const rawEvents: PolymarketRawEvent[] = await gammaRes.json();

      // 2. Sort by volume, take top N
      const sorted = rawEvents
        .filter((e) => e.id || e.title)
        .sort((a, b) => parseVolume(b.volume) - parseVolume(a.volume))
        .slice(0, TOP_MARKETS_COUNT);

      // 3. Fetch CLOB history for each market (in parallel)
      const enrichedPromises = sorted.map(async (event): Promise<MarketMetrics | null> => {
        const clobMarketId = getCLOBMarketId(event);
        if (!clobMarketId) return null;

        const market = event.markets?.[0];
        if (!market) return null;

        const outcomePrices = parseOutcomePrices(market);
        const probability = outcomePrices[0];
        const volume24h = parseVolume(event.volume);

        // Fetch CLOB history
        const history = await fetchCLOBHistory(clobMarketId);

        // Extract last 24h of data points for sparkline
        const now = Math.floor(Date.now() / 1000);
        const history24h = history
          .filter((p) => p.t >= now - 86400)
          .map((p) => p.p);

        // Compute sentiment momentum
        const sentimentMomentum = computeSentimentMomentum(history, probability);

        return {
          marketId: String(event.id || event.title),
          title: event.title || '',
          probability,
          volume24h,
          sentimentMomentum,
          history24h,
          lastUpdated: Date.now(),
          category: parseCategory(event),
        };
      });

      const enriched = await Promise.all(enrichedPromises);
      const markets = enriched.filter((m): m is MarketMetrics => m !== null);

      return {
        markets,
        timestamp: Date.now(),
      };
    }
  );

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
