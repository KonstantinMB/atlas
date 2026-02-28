/**
 * GDELT News Events Edge Function
 *
 * Fetches global conflict/military news events from the GDELT 2.0 API.
 * No API key required. 15-minute cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  sourcecountry: string;
  language: string;
  domain: string;
  tone?: string;
}

interface GdeltEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  country: string;
  timestamp: number;
  tone: number | null;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function parseGdeltDate(seendate: string): number {
  // Format: YYYYMMDDTHHMMSSZ
  if (!seendate || seendate.length < 15) return Date.now();
  const iso = `${seendate.slice(0, 4)}-${seendate.slice(4, 6)}-${seendate.slice(6, 8)}T${seendate.slice(9, 11)}:${seendate.slice(11, 13)}:${seendate.slice(13, 15)}Z`;
  const ms = Date.parse(iso);
  return isNaN(ms) ? Date.now() : ms;
}

const GDELT_URL =
  'https://api.gdeltproject.org/api/v2/doc/doc?query=war+OR+conflict+OR+military&mode=artlist&maxrecords=50&format=json&timespan=1440';

function normalize(raw: { articles?: GdeltArticle[] }): GdeltEvent[] {
  if (!Array.isArray(raw.articles)) return [];

  return raw.articles.map((a) => ({
    id: simpleHash(a.url || a.title || Math.random().toString()),
    title: a.title || '',
    url: a.url || '',
    source: a.domain || '',
    country: a.sourcecountry || '',
    timestamp: parseGdeltDate(a.seendate),
    tone: a.tone !== undefined ? (parseFloat(a.tone as string) || null) : null,
  }));
}

export default withCors(async (_req: Request) => {
  // 30-minute cache — GDELT free tier rate-limits heavy polling
  let events: GdeltEvent[] = [];
  try {
    events = await withCache<GdeltEvent[]>('gdelt:events:global', 1800, async () => {
      const res = await fetch(GDELT_URL, {
        headers: { Accept: 'application/json', 'User-Agent': 'Atlas/1.0' },
      });
      // 429 = rate limited, return empty so stale cache is used next time
      if (res.status === 429) return [];
      if (!res.ok) throw new Error(`GDELT upstream error: ${res.status}`);
      const raw = await res.json();
      return normalize(raw);
    });
  } catch {
    events = [];
  }

  return new Response(JSON.stringify({ events, count: events.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
    },
  });
});
