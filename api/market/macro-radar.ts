/**
 * Macro Market Radar Edge Function
 *
 * Computes a 7-signal composite BUY/CASH/SELL verdict for the hedge fund strategy.
 * Aggregates FRED + Yahoo Finance + Fear&Greed + CoinGecko data concurrently.
 * 5-minute cache.
 *
 * Signals:
 *  1. YIELD_CURVE   — T10Y2Y spread (FRED)
 *  2. VIX_REGIME    — VIX level (Yahoo)
 *  3. FEAR_GREED    — Fear & Greed Index (alternative.me)
 *  4. GOLD_TREND    — GLD 5-day change (Yahoo)
 *  5. DOLLAR_STRENGTH — DTWEXBGS broad dollar index (FRED)
 *  6. EQUITY_MOMENTUM — SPY 5-day change (Yahoo)
 *  7. CRYPTO_SENTIMENT — BTC 24h change (CoinGecko)
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface RadarSignal {
  id: string;
  name: string;
  value: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
}

interface MacroRadarResponse {
  signals: RadarSignal[];
  verdict: 'BUY' | 'CASH' | 'SELL';
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  timestamp: number;
}

// ─── Upstream fetch helpers ───────────────────────────────────────────────────

interface FredApiResponse {
  observations?: Array<{ date: string; value: string }>;
}

async function fetchFredValue(seriesId: string, apiKey: string): Promise<number | null> {
  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: FredApiResponse = await res.json();
    const obs = data.observations?.[0];
    if (!obs || obs.value === '.') return null;
    return parseFloat(obs.value);
  } catch {
    return null;
  }
}

interface YahooMeta {
  regularMarketPrice?: number;
}

interface YahooChart {
  chart: {
    result?: Array<{
      meta: YahooMeta;
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
}

async function fetchYahooChart(
  symbol: string
): Promise<{ price: number; closes: number[] } | null> {
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
    if (!result) return null;
    const price = result.meta.regularMarketPrice ?? 0;
    const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((v): v is number => v !== null && v !== undefined);
    return { price, closes };
  } catch {
    return null;
  }
}

function pct5d(closes: number[]): number {
  if (closes.length < 2) return 0;
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!first || first === 0) return 0;
  return ((last! - first) / first) * 100;
}

interface FearGreedResponse {
  data?: Array<{ value: string }>;
}

async function fetchFearGreed(): Promise<number | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
    if (!res.ok) return null;
    const data: FearGreedResponse = await res.json();
    const val = data.data?.[0]?.value;
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

interface CoinGeckoSimplePrice {
  bitcoin?: { usd: number; usd_24h_change: number };
}

async function fetchBtcChange(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
    );
    if (!res.ok) return null;
    const data: CoinGeckoSimplePrice = await res.json();
    return data.bitcoin?.usd_24h_change ?? null;
  } catch {
    return null;
  }
}

// ─── Signal builders ─────────────────────────────────────────────────────────

function yieldCurveSignal(value: number | null): RadarSignal {
  const formatted = value !== null ? `${value.toFixed(2)}%` : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'Yield curve near flat — no strong directional signal.';

  if (value !== null) {
    if (value < -0.5) {
      signal = 'BEARISH';
      description = 'Deeply inverted yield curve signals recession risk.';
    } else if (value > 0.5) {
      signal = 'BULLISH';
      description = 'Positive yield curve indicates healthy growth expectations.';
    }
  }

  return { id: 'YIELD_CURVE', name: '10Y-2Y Yield Spread', value: formatted, signal, description };
}

function vixRegimeSignal(price: number | null): RadarSignal {
  const formatted = price !== null ? price.toFixed(1) : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'VIX in normal range — moderate market uncertainty.';

  if (price !== null) {
    if (price > 30) {
      signal = 'BEARISH';
      description = 'Elevated VIX indicates high fear and volatility regime.';
    } else if (price < 15) {
      signal = 'BULLISH';
      description = 'Low VIX signals complacency and risk-on environment.';
    }
  }

  return { id: 'VIX_REGIME', name: 'VIX Volatility Index', value: formatted, signal, description };
}

function fearGreedSignal(index: number | null): RadarSignal {
  const formatted = index !== null ? String(index) : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'Neutral sentiment — balanced market psychology.';

  if (index !== null) {
    if (index < 25) {
      signal = 'BULLISH';
      description = 'Extreme fear is historically a contrarian buy signal.';
    } else if (index <= 45) {
      signal = 'BULLISH';
      description = 'Fear zone — markets often recover from here.';
    } else if (index > 75) {
      signal = 'BEARISH';
      description = 'Extreme greed signals overheated market, risk of reversal.';
    }
  }

  return {
    id: 'FEAR_GREED',
    name: 'Fear & Greed Index',
    value: formatted,
    signal,
    description,
  };
}

function goldTrendSignal(change5d: number | null): RadarSignal {
  const formatted = change5d !== null ? `${change5d.toFixed(2)}%` : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'Gold stable — no strong risk-on/off signal.';

  if (change5d !== null) {
    if (change5d > 2) {
      signal = 'BEARISH';
      description = 'Gold surging signals risk-off flight to safety.';
    } else if (change5d < -1) {
      signal = 'BULLISH';
      description = 'Gold falling suggests risk appetite returning to equities.';
    }
  }

  return {
    id: 'GOLD_TREND',
    name: 'Gold 5-Day Trend',
    value: formatted,
    signal,
    description,
  };
}

function dollarSignal(value: number | null): RadarSignal {
  const formatted = value !== null ? value.toFixed(1) : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'Dollar index in neutral range.';

  if (value !== null) {
    if (value > 120) {
      signal = 'BEARISH';
      description = 'Strong dollar pressures EM assets and commodities.';
    } else if (value < 115) {
      signal = 'BULLISH';
      description = 'Weaker dollar supports risk assets and commodities.';
    }
  }

  return {
    id: 'DOLLAR_STRENGTH',
    name: 'US Dollar Index (Broad)',
    value: formatted,
    signal,
    description,
  };
}

function equityMomentumSignal(change5d: number | null): RadarSignal {
  const formatted = change5d !== null ? `${change5d.toFixed(2)}%` : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'SPY drifting sideways — no clear momentum.';

  if (change5d !== null) {
    if (change5d > 1.5) {
      signal = 'BULLISH';
      description = 'SPY on a 5-day uptrend — positive equity momentum.';
    } else if (change5d < -2) {
      signal = 'BEARISH';
      description = 'SPY breaking down — equity momentum is negative.';
    }
  }

  return {
    id: 'EQUITY_MOMENTUM',
    name: 'SPY 5-Day Momentum',
    value: formatted,
    signal,
    description,
  };
}

function cryptoSentimentSignal(change24h: number | null): RadarSignal {
  const formatted = change24h !== null ? `${change24h.toFixed(2)}%` : 'N/A';
  let signal: RadarSignal['signal'] = 'NEUTRAL';
  let description = 'Bitcoin flat — crypto sentiment neutral.';

  if (change24h !== null) {
    if (change24h > 5) {
      signal = 'BULLISH';
      description = 'Bitcoin surging — risk appetite high across asset classes.';
    } else if (change24h < -8) {
      signal = 'BEARISH';
      description = 'Bitcoin in sharp drawdown — broad risk-off signal.';
    }
  }

  return {
    id: 'CRYPTO_SENTIMENT',
    name: 'Bitcoin 24h Change',
    value: formatted,
    signal,
    description,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default withCors(async (_req: Request) => {
  const radar = await withCache<MacroRadarResponse>('market:radar', 300, async () => {
    const fredApiKey = process.env.FRED_API_KEY ?? '';

    // Fetch all 7 data points concurrently
    const [
      yieldCurveResult,
      dollarResult,
      vixResult,
      gldResult,
      spyResult,
      fearGreedResult,
      btcResult,
    ] = await Promise.allSettled([
      fredApiKey ? fetchFredValue('T10Y2Y', fredApiKey) : Promise.resolve(null),
      fredApiKey ? fetchFredValue('DTWEXBGS', fredApiKey) : Promise.resolve(null),
      fetchYahooChart('%5EVIX'),
      fetchYahooChart('GLD'),
      fetchYahooChart('SPY'),
      fetchFearGreed(),
      fetchBtcChange(),
    ]);

    const yieldCurveValue =
      yieldCurveResult.status === 'fulfilled' ? yieldCurveResult.value : null;
    const dollarValue =
      dollarResult.status === 'fulfilled' ? dollarResult.value : null;
    const vixData =
      vixResult.status === 'fulfilled' ? vixResult.value : null;
    const gldData =
      gldResult.status === 'fulfilled' ? gldResult.value : null;
    const spyData =
      spyResult.status === 'fulfilled' ? spyResult.value : null;
    const fearGreedValue =
      fearGreedResult.status === 'fulfilled' ? fearGreedResult.value : null;
    const btcChange =
      btcResult.status === 'fulfilled' ? btcResult.value : null;

    const signals: RadarSignal[] = [
      yieldCurveSignal(yieldCurveValue),
      vixRegimeSignal(vixData?.price ?? null),
      fearGreedSignal(fearGreedValue),
      goldTrendSignal(gldData ? pct5d(gldData.closes) : null),
      dollarSignal(dollarValue),
      equityMomentumSignal(spyData ? pct5d(spyData.closes) : null),
      cryptoSentimentSignal(btcChange),
    ];

    const bullishCount = signals.filter((s) => s.signal === 'BULLISH').length;
    const bearishCount = signals.filter((s) => s.signal === 'BEARISH').length;
    const neutralCount = signals.filter((s) => s.signal === 'NEUTRAL').length;

    let verdict: 'BUY' | 'CASH' | 'SELL' = 'CASH';
    if (bullishCount >= 4) verdict = 'BUY';
    else if (bearishCount >= 4) verdict = 'SELL';

    return { signals, verdict, bullishCount, bearishCount, neutralCount, timestamp: Date.now() };
  });

  return new Response(JSON.stringify(radar), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
