/**
 * GDELT News Events Edge Function
 *
 * Fetches global news events from the GDELT 2.0 DOC API.
 * Tries multiple topic queries so a rate-limit on one doesn't
 * kill the whole feed. 20-minute server cache.
 * No API key required.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  sourcecountry: string;
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
  if (!seendate || seendate.length < 15) return Date.now();
  const iso = `${seendate.slice(0, 4)}-${seendate.slice(4, 6)}-${seendate.slice(6, 8)}T${seendate.slice(9, 11)}:${seendate.slice(11, 13)}:${seendate.slice(13, 15)}Z`;
  const ms = Date.parse(iso);
  return isNaN(ms) ? Date.now() : ms;
}

function normalize(raw: { articles?: GdeltArticle[] }): GdeltEvent[] {
  if (!Array.isArray(raw?.articles)) return [];
  return raw.articles.map((a) => ({
    id: simpleHash(a.url || a.title || String(Math.random())),
    title: a.title || '',
    url: a.url || '',
    source: a.domain || '',
    country: a.sourcecountry || '',
    timestamp: parseGdeltDate(a.seendate),
    tone: a.tone !== undefined ? (parseFloat(a.tone as string) || null) : null,
  })).filter(e => e.title.length > 0);
}

// Multiple queries — if one is rate-limited, another may succeed
const GDELT_QUERIES = [
  'geopolitical+conflict+military+war',
  'sanctions+diplomacy+crisis+threat',
  'russia+ukraine+china+taiwan+iran',
];

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const PARAMS = 'mode=artlist&maxrecords=25&format=json&timespan=360'; // last 6 hours

async function fetchGdeltQuery(query: string): Promise<GdeltEvent[]> {
  const url = `${BASE}?query=${query}&${PARAMS}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'YC-Hedge-Fund/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 429) return [];
  if (!res.ok) throw new Error(`GDELT error: ${res.status}`);
  const raw = await res.json();
  return normalize(raw);
}

export default withCors(async (_req: Request) => {
  let events: GdeltEvent[] = [];

  try {
    events = await withCache<GdeltEvent[]>('gdelt:events:v3', 1200, async () => {
      // Try each query; merge unique events (deduplicate by id)
      const seen = new Map<string, GdeltEvent>();

      for (const query of GDELT_QUERIES) {
        try {
          const results = await fetchGdeltQuery(query);
          for (const ev of results) {
            if (!seen.has(ev.id)) seen.set(ev.id, ev);
          }
          // If we already have enough results, stop early
          if (seen.size >= 30) break;
        } catch {
          // One query failing is OK — continue to next
        }
      }

      return [...seen.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    });
  } catch {
    events = [];
  }

  return new Response(
    JSON.stringify({ events, count: events.length, timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=1200, stale-while-revalidate=2400',
      },
    }
  );
});
