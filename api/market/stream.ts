/**
 * Market Data Stream Edge Function
 *
 * Proxies Finnhub REST quotes for the full tradeable universe.
 * Uses Yahoo Finance as primary (no API key, supports stocks, ETFs, crypto, forex).
 * Finnhub optional when API key provided (batched, 5 symbols/call).
 * Caches 15 seconds.
 *
 * Returns: { [symbol]: MarketTick }
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';
import { getAllSymbols } from '../../shared/universe-symbols';

export const config = { runtime: 'edge' };

interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

/** Max symbols to fetch per request (avoid timeout/rate limits) */
const MAX_SYMBOLS = 500; // Full universe coverage

/** Concurrency limit for Yahoo fetches */
const YAHOO_CONCURRENCY = 15; // Increased from 10 for faster execution

/**
 * Fetch quote from Finnhub REST API
 */
async function fetchFromFinnhub(symbol: string, apiKey: string): Promise<MarketTick | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[MarketStream] Finnhub fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: any = await response.json();

    // Finnhub returns: { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp }
    const price = data.c;
    const timestamp = data.t * 1000; // Convert to ms

    if (!price || price === 0) {
      return null;
    }

    return {
      symbol,
      price,
      bid: price, // Finnhub quote endpoint doesn't provide bid/ask
      ask: price,
      volume: 0, // Not provided in quote endpoint
      timestamp,
    };
  } catch (error) {
    console.error(`[MarketStream] Finnhub error for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch quote from Yahoo Finance REST API (fallback)
 */
async function fetchFromYahoo(symbol: string): Promise<MarketTick | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result?.meta?.regularMarketPrice) {
      return null;
    }

    const meta = result.meta;

    return {
      symbol,
      price: meta.regularMarketPrice,
      bid: meta.bid || meta.regularMarketPrice,
      ask: meta.ask || meta.regularMarketPrice,
      volume: meta.regularMarketVolume || 0,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(`[MarketStream] Yahoo error for ${symbol}:`, error);
    return null;
  }
}

/** Run async tasks with max concurrency */
async function runWithConcurrency(
  symbols: string[],
  concurrency: number,
  fn: (symbol: string) => Promise<MarketTick | null>
): Promise<Record<string, MarketTick>> {
  const results: Record<string, MarketTick> = {};
  let index = 0;

  async function worker(): Promise<void> {
    while (index < symbols.length) {
      const i = index++;
      const symbol = symbols[i];
      try {
        const tick = await fn(symbol);
        if (tick) results[symbol] = tick;
      } catch {
        // Skip failed symbols
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Fetch quotes for all symbols in universe
 */
async function fetchAllQuotes(): Promise<Record<string, MarketTick>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  const allSymbols = getAllSymbols().slice(0, MAX_SYMBOLS);
  const quotes: Record<string, MarketTick> = {};

  // Finnhub: only for first 50 non-crypto symbols (rate limit: 60/min)
  const finnhubSymbols = allSymbols.filter(s => !s.includes('-USD') && !s.includes('=X')).slice(0, 50);

  if (apiKey && finnhubSymbols.length > 0) {
    const batchSize = 5;
    for (let i = 0; i < finnhubSymbols.length; i += batchSize) {
      const batch = finnhubSymbols.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(s => fetchFromFinnhub(s, apiKey)));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) quotes[batch[idx]] = r.value;
      });
      if (i + batchSize < finnhubSymbols.length) {
        await new Promise(r => setTimeout(r, 250));
      }
    }
  }

  // Yahoo: primary for all symbols (stocks, ETFs, crypto, forex)
  const missingSymbols = allSymbols.filter(s => !quotes[s]);

  if (missingSymbols.length > 0) {
    const yahooQuotes = await runWithConcurrency(
      missingSymbols,
      YAHOO_CONCURRENCY,
      fetchFromYahoo
    );
    Object.assign(quotes, yahooQuotes);
  }

  const missing = allSymbols.filter(s => !quotes[s]);
  if (missing.length > 0) {
    console.warn(`[MarketStream] Missing quotes for ${missing.length} symbols`);
  }

  return quotes;
}

export default withCors(async (_req: Request) => {
  try {
    const quotes = await withCache<Record<string, MarketTick>>(
      'market:stream:v2', // v2: reduced symbols, longer cache
      60, // 60-second cache (increased from 15s to reduce CPU load)
      async () => {
        const data = await fetchAllQuotes();

        if (Object.keys(data).length === 0) {
          throw new Error('All market data upstream fetches failed');
        }

        return data;
      }
    );

    return new Response(
      JSON.stringify({
        quotes,
        count: Object.keys(quotes).length,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('[MarketStream] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
