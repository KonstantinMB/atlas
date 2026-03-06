/**
 * Polymarket Prediction Markets Edge Function
 *
 * Fetches active prediction markets from Polymarket's Gamma API.
 * No API key required. 5-minute cache.
 *
 * Returns normalized PredictionMarket[] with volume24h, outcomePrices, etc.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';
import type { PredictionMarket } from '../../src/lib/prediction-markets';

export const config = { runtime: 'edge' };

interface PolymarketRawMarket {
  id?: string;
  question?: string;
  outcomePrices?: string | string[];
  volume?: string | number;
  endDate?: string;
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

const POLYMARKET_URL = 'https://gamma-api.polymarket.com/events?limit=20&active=true';

function parseVolume(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function parseOutcomePrices(market: PolymarketRawMarket): [number, number] {
  try {
    // outcomePrices is often a JSON string like "[\"0.65\",\"0.35\"]"
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
    // ignore JSON parse errors
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

function normalize(raw: PolymarketRawEvent[]): PredictionMarket[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((e) => e.id || e.title)
    .map((event) => {
      const market = event.markets?.[0];
      const outcomePrices = market ? parseOutcomePrices(market) : [0.5, 0.5] as [number, number];
      const probability = outcomePrices[0]; // Yes price
      const endDateMs = event.endDate ? Date.parse(event.endDate) : 0;
      const volumeTotal = parseVolume(event.volume);

      return {
        id: String(event.id || event.title || Math.random()),
        source: 'polymarket' as const,
        title: event.title || '',
        probability,
        volume24h: volumeTotal, // Gamma doesn't separate 24h vs total; approximate as total for now
        volumeTotal,
        category: parseCategory(event),
        endDate: isNaN(endDateMs) ? 0 : endDateMs,
        outcomePrices,
      };
    })
    .sort((a, b) => b.volumeTotal - a.volumeTotal);
}

export default withCors(async (_req: Request) => {
  const markets = await withCache<PredictionMarket[]>('osint:polymarket', 300, async () => {
    const res = await fetch(POLYMARKET_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Polymarket upstream error: ${res.status}`);
    const raw: PolymarketRawEvent[] = await res.json();
    return normalize(raw);
  });

  return new Response(JSON.stringify({ markets, count: markets.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
