# Edge Functions Infrastructure

## Overview

YC Hedge Fund uses Vercel Edge Functions as the API layer. This provides:
- Global low-latency execution (edge runtime)
- Zero cold starts
- Automatic CORS handling
- 3-tier caching system (memory → Redis → upstream)
- Stale-on-error fallback for resilience

## Architecture

```
Client Request
    ↓
CORS Middleware (_cors.ts)
    ↓
Edge Function Handler
    ↓
Cache Wrapper (_cache.ts)
    ↓
┌─────────────────────────┐
│ Tier 1: Memory (LRU)    │  ← Fastest (< 1ms)
│ 100 entries max         │
└─────────────────────────┘
    ↓ (cache miss)
┌─────────────────────────┐
│ Tier 2: Upstash Redis   │  ← Fast (~10-50ms)
│ Persistent, shared      │
└─────────────────────────┘
    ↓ (cache miss)
┌─────────────────────────┐
│ Tier 3: Upstream API    │  ← Slow (100ms-2s)
│ Public data sources     │
└─────────────────────────┘
```

## Core Files

### `/api/_cors.ts`
CORS middleware that wraps all edge function handlers.

**Features:**
- Origin allowlist (localhost + production domains)
- Automatic OPTIONS preflight handling
- Error responses with CORS headers
- Credentials support

**Usage:**
```typescript
import { withCors } from './_cors.ts';

export const config = { runtime: 'edge' };

export default withCors(async (req: Request) => {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### `/api/_cache.ts`
3-tier caching system with stale-on-error fallback.

**Features:**
- In-memory LRU cache (100 entries, fastest)
- Upstash Redis (persistent, shared across edge instances)
- Automatic cache invalidation based on TTL
- Stale-on-error: returns cached data if upstream fails
- Lazy Redis initialization (works without Redis configured)

**Usage:**
```typescript
import { withCache } from './_cache.ts';

const data = await withCache('usgs:earthquakes', 300, async () => {
  const res = await fetch('https://earthquake.usgs.gov/...');
  return res.json();
});
```

**Cache Key Naming Convention:**
- `{source}:{resource}` - e.g., `gdelt:events`, `usgs:earthquakes`
- `{source}:{resource}:{param}` - e.g., `finnhub:quote:AAPL`

**TTL Guidelines:**
- Real-time data (quotes, prices): 30-60 seconds
- News feeds: 5-15 minutes
- Conflict/disaster events: 15-30 minutes
- Economic indicators: 6-24 hours
- Static/reference data: 24 hours

## Test Endpoints

### `/api/health`
Health check endpoint that verifies edge runtime is working.

**Request:**
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health?env=true  # Include env info
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1772265868747,
  "date": "2026-02-28T08:04:28.747Z",
  "edge": {
    "runtime": "edge",
    "region": "iad1"
  },
  "env": {
    "hasRedis": true,
    "nodeEnv": "development"
  }
}
```

### `/api/cache-test`
Demonstrates the 3-tier caching system.

**Request:**
```bash
# First call (fetches from upstream, ~100ms)
curl http://localhost:3000/api/cache-test?ttl=60

# Second call (hits memory cache, <1ms)
curl http://localhost:3000/api/cache-test?ttl=60

# Force refresh
curl http://localhost:3000/api/cache-test?refresh=true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "This data was fetched from upstream",
    "fetchedAt": "2026-02-28T08:04:28.865Z",
    "randomValue": 0.546886778426244
  },
  "meta": {
    "duration": 0,
    "ttl": 60,
    "likelyCacheTier": "memory",
    "timestamp": 1772265868866
  }
}
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start Vercel dev server
npm run dev
# or
npx vercel dev --yes

# Test edge functions
node api/test-edge.js
```

### Environment Variables

Required for full functionality:
```bash
# Upstash Redis (optional for local dev - falls back to memory-only)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

Without Redis configured, the cache system automatically falls back to memory-only mode (still works, just not persistent across edge instances).

### Testing

**Unit Tests:**
```bash
node api/test-edge.js
```

**Manual cURL Tests:**
```bash
# Health check
curl http://localhost:3000/api/health

# Cache test (first call)
curl http://localhost:3000/api/cache-test | jq .

# Cache test (second call - should be instant)
curl http://localhost:3000/api/cache-test | jq .
```

**Performance Validation:**
- Memory cache hits should be < 5ms
- Redis cache hits should be < 50ms
- Upstream fetches should be > 100ms (simulated delay)

## Edge Function Template

Use this template for all new data source adapters:

```typescript
/**
 * [Source Name] Data Adapter
 *
 * Fetches [description] from [upstream API]
 * Cache: [TTL seconds] seconds
 */

import { withCors } from './_cors.ts';
import { withCache } from './_cache.ts';

export const config = { runtime: 'edge' };

// Cache key and TTL
const CACHE_KEY = 'source:resource';
const TTL_SECONDS = 300; // 5 minutes

export default withCors(async (req: Request) => {
  try {
    const data = await withCache(CACHE_KEY, TTL_SECONDS, async () => {
      // Fetch from upstream
      const res = await fetch('https://upstream-api.example.com/endpoint');

      if (!res.ok) {
        throw new Error(`Upstream error: ${res.status}`);
      }

      const rawData = await res.json();

      // Normalize to consistent schema
      return normalize(rawData);
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${TTL_SECONDS}, stale-while-revalidate=${TTL_SECONDS * 2}`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: Date.now(),
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

/**
 * Normalize upstream data to consistent schema
 */
function normalize(rawData: any): NormalizedData {
  // Transform upstream schema to our standard format
  return {
    // ... normalized fields
  };
}

interface NormalizedData {
  // Define your normalized schema
}
```

## Next Steps (Phase 1)

Create data source adapters in `/api/data/`:
- `gdelt.ts` - GDELT news events
- `usgs.ts` - USGS earthquakes
- `acled.ts` - ACLED conflict events
- `firms.ts` - NASA fire detection
- `gdacs.ts` - Disaster alerts
- `eonet.ts` - NASA natural events

Each adapter follows the same pattern:
1. Export edge runtime config
2. Wrap with CORS middleware
3. Use cache wrapper with appropriate TTL
4. Fetch from upstream API
5. Normalize response schema
6. Handle errors gracefully

## Cache Performance Stats

From test run:
- **Upstream fetch**: 102ms (simulated 100ms delay)
- **Memory cache hit**: 0.3ms (340x faster)
- **Cache key**: `test:cache`
- **TTL**: 60 seconds
- **Stale-on-error**: Enabled

The cache provides:
- **340x speedup** for memory hits
- **Resilience** via stale-on-error fallback
- **Scalability** via shared Redis layer
- **Simplicity** via single `withCache()` wrapper
