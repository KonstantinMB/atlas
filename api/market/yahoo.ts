/**
 * Yahoo Finance Market Quotes Edge Function
 *
 * Fetches quotes for 12 key instruments: equities, ETFs, forex, VIX, crypto.
 * Includes 5-day price history for SPY, QQQ, GLD, TLT.
 * No API key required. 60-second cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  change5dPct: number;
  history5d: number[];
  timestamp: number;
}

const SYMBOLS = [
  'SPY',
  'QQQ',
  'IWM',
  'EEM',
  'GLD',
  'TLT',
  'SHY',
  'USO',
  'XLP',
  'EURUSD=X',
  '%5EVIX',
  'BTC-USD',
];

const DISPLAY_NAMES: Record<string, string> = {
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq 100 ETF',
  IWM: 'Russell 2000 ETF',
  EEM: 'Emerging Markets ETF',
  GLD: 'Gold ETF',
  TLT: '20Y Treasury ETF',
  SHY: '2Y Treasury ETF',
  USO: 'Oil ETF',
  XLP: 'Consumer Staples ETF',
  'EURUSD=X': 'EUR/USD',
  '%5EVIX': 'VIX',
  'BTC-USD': 'Bitcoin',
};

const DISPLAY_SYMBOLS: Record<string, string> = {
  '%5EVIX': 'VIX',
};

interface YahooMeta {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  longName?: string;
  symbol?: string;
}

interface YahooIndicators {
  quote?: Array<{ close?: (number | null)[] }>;
}

interface YahooChartResult {
  meta: YahooMeta;
  indicators?: YahooIndicators;
}

interface YahooChart {
  chart: {
    result?: YahooChartResult[];
    error?: { message: string };
  };
}

function parseHistory5d(result: YahooChartResult): number[] {
  const closes = result.indicators?.quote?.[0]?.close;
  if (!closes || closes.length === 0) return [];
  return closes.filter((v): v is number => v !== null && v !== undefined);
}

function compute5dChange(history: number[]): number {
  if (history.length < 2) return 0;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last || first === 0) return 0;
  return ((last - first) / first) * 100;
}

async function fetchSymbol(symbol: string): Promise<MarketQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data: YahooChart = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;

    const meta = result.meta;
    const displaySymbol = DISPLAY_SYMBOLS[symbol] || symbol;
    const history5d = parseHistory5d(result);
    const change5dPct = compute5dChange(history5d);

    return {
      symbol: displaySymbol,
      name:
        DISPLAY_NAMES[symbol] ||
        meta.shortName ||
        meta.longName ||
        displaySymbol,
      price: meta.regularMarketPrice ?? 0,
      changePercent: meta.regularMarketChangePercent ?? 0,
      change5dPct,
      history5d,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export default withCors(async (_req: Request) => {
  const quotes = await withCache<MarketQuote[]>('market:quotes:v2', 60, async () => {
    const results = await Promise.allSettled(SYMBOLS.map((s) => fetchSymbol(s)));

    const fetched: MarketQuote[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        fetched.push(result.value);
      }
    }

    if (fetched.length === 0) {
      throw new Error('All Yahoo Finance upstream fetches failed');
    }

    return fetched;
  });

  return new Response(
    JSON.stringify({ quotes, count: quotes.length, timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  );
});
