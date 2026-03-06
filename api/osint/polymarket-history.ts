/**
 * Polymarket CLOB Historical Prices Edge Function
 *
 * Fetches historical Yes share prices from Polymarket's CLOB API
 * for sparklines and sentiment momentum calculation.
 *
 * GET /api/osint/polymarket-history?marketIds=id1,id2,id3
 *
 * Returns: { histories: { [marketId]: { points: [{t, p}], interval } } }
 * Cache: 5 min per request
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';
import type { PolymarketHistoryResponse } from '../../src/lib/prediction-markets';

export const config = { runtime: 'edge' };

const CLOB_HISTORY_URL = 'https://clob.polymarket.com/prices-history';

interface CLOBHistoryPoint {
  t: number; // Unix timestamp in seconds
  p: number; // Yes price (0–1)
}

interface CLOBHistoryResponse {
  history: CLOBHistoryPoint[];
}

async function fetchMarketHistory(
  marketId: string,
  interval: '1h' | '6h' | '1d' = '1h'
): Promise<{ points: { t: number; p: number }[]; interval: '1h' | '6h' | '1d' } | null> {
  try {
    const url = `${CLOB_HISTORY_URL}?market=${encodeURIComponent(marketId)}&interval=${interval}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.error(`CLOB history failed for ${marketId}: ${res.status}`);
      return null;
    }

    const data: CLOBHistoryResponse = await res.json();

    if (!data.history || !Array.isArray(data.history)) {
      return null;
    }

    // Convert timestamps from seconds to milliseconds
    const points = data.history.map((point) => ({
      t: point.t * 1000,
      p: Math.max(0, Math.min(1, point.p)),
    }));

    return { points, interval };
  } catch (err) {
    console.error(`CLOB history error for ${marketId}:`, err);
    return null;
  }
}

export default withCors(async (req: Request) => {
  const url = new URL(req.url);
  const marketIdsParam = url.searchParams.get('marketIds');
  const interval = (url.searchParams.get('interval') as '1h' | '6h' | '1d') || '1h';

  if (!marketIdsParam) {
    return new Response(
      JSON.stringify({ error: 'marketIds query parameter required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const marketIds = marketIdsParam.split(',').map((id) => id.trim()).filter(Boolean);

  if (marketIds.length === 0 || marketIds.length > 20) {
    return new Response(
      JSON.stringify({ error: 'marketIds must contain 1-20 market IDs' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Cache key includes marketIds for per-request caching
  const cacheKey = `osint:polymarket-history:${marketIds.join(',')}:${interval}`;

  const response = await withCache<PolymarketHistoryResponse>(
    cacheKey,
    300, // 5 min cache
    async () => {
      const histories: PolymarketHistoryResponse['histories'] = {};

      // Fetch histories in parallel
      const results = await Promise.all(
        marketIds.map((id) => fetchMarketHistory(id, interval))
      );

      marketIds.forEach((id, index) => {
        const result = results[index];
        if (result) {
          histories[id] = result;
        }
      });

      return { histories };
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
