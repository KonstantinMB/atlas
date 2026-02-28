/**
 * CoinGecko Crypto Prices Edge Function
 *
 * Fetches richer market data for major cryptocurrencies via /coins/markets endpoint:
 * price, 24h/7d change, market cap, volume. Optional demo API key via
 * COINGECKO_API_KEY env var. 60-second cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  marketCapRank: number;
}

const COIN_IDS = ['bitcoin', 'ethereum', 'solana', 'ripple', 'binancecoin'];

const SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  ripple: 'XRP',
  binancecoin: 'BNB',
};

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number | null;
  total_volume: number | null;
  market_cap_rank: number | null;
}

function buildUrl(): string {
  const apiKey = process.env.COINGECKO_API_KEY;
  const base = apiKey
    ? 'https://pro-api.coingecko.com/api/v3/coins/markets'
    : 'https://api.coingecko.com/api/v3/coins/markets';

  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: COIN_IDS.join(','),
    order: 'market_cap_desc',
    per_page: '10',
    page: '1',
    sparkline: 'false',
    price_change_percentage: '24h,7d',
  });
  return `${base}?${params}`;
}

function buildHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_API_KEY;
  return apiKey ? { 'x-cg-demo-api-key': apiKey } : {};
}

function normalize(raw: CoinGeckoMarketCoin[]): CryptoPrice[] {
  return raw.map((coin) => ({
    id: coin.id,
    symbol: SYMBOL_MAP[coin.id] || coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price ?? 0,
    change24h: coin.price_change_percentage_24h ?? 0,
    change7d: coin.price_change_percentage_7d_in_currency ?? 0,
    marketCap: coin.market_cap ?? 0,
    volume24h: coin.total_volume ?? 0,
    marketCapRank: coin.market_cap_rank ?? 0,
  }));
}

export default withCors(async (_req: Request) => {
  const prices = await withCache<CryptoPrice[]>('market:crypto:v2', 60, async () => {
    const res = await fetch(buildUrl(), { headers: buildHeaders() });
    if (!res.ok) throw new Error(`CoinGecko upstream error: ${res.status}`);
    const raw: CoinGeckoMarketCoin[] = await res.json();
    return normalize(raw);
  });

  const totalCryptoMarketCap = prices.reduce((sum, p) => sum + p.marketCap, 0);

  return new Response(
    JSON.stringify({
      prices,
      count: prices.length,
      totalCryptoMarketCap,
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
});
