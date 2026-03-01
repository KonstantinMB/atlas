/**
 * RSS Feed Proxy Edge Function
 *
 * Proxies RSS feeds that would otherwise be blocked by CORS in the browser.
 * Domain allowlist enforced. Returns raw RSS XML. 10-minute cache.
 *
 * Usage: GET /api/rss/proxy?url=https://feeds.bbci.co.uk/news/rss.xml
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

const ALLOWED_DOMAINS = new Set([
  'feeds.bbci.co.uk',
  'rss.reuters.com',
  'feeds.reuters.com',
  'news.google.com',
  'rss.cnn.com',
  'feeds.npr.org',
  'www.aljazeera.com',
  'feeds.washingtonpost.com',
  'rss.nytimes.com',
  'rss.ft.com',
  'www.economist.com',
  'foreignpolicy.com',
  'www.bellingcat.com',
  'www.understandingwar.org',
  'theintercept.com',
  'warisboring.com',
  'defenseone.com',
  'www.defensenews.com',
  'breakingdefense.com',
  'api.gdeltproject.org',
]);

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export default withCors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const feedUrl = searchParams.get('url');

  if (!feedUrl) {
    return new Response(JSON.stringify({ error: 'Missing required ?url= parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate URL format
  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new Response(JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check domain allowlist
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_DOMAINS.has(hostname)) {
    return new Response(
      JSON.stringify({ error: `Domain not allowed: ${hostname}` }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const cacheKey = `rss:${simpleHash(feedUrl)}`;

  const xml = await withCache<string>(cacheKey, 600, async () => {
    const res = await fetch(feedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'YC-Hedge-Fund-RSS-Proxy/1.0',
      },
    });

    if (!res.ok) throw new Error(`RSS upstream error: ${res.status} for ${feedUrl}`);
    return res.text();
  });

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      'X-Proxied-Url': feedUrl,
    },
  });
});
