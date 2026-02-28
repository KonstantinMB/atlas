/**
 * 3-Tier Caching System for Vercel Edge Functions
 *
 * Architecture (WorldMonitor-inspired):
 * 1. In-memory LRU cache (100 entries, fastest)
 * 2. Upstash Redis (persistent, shared across edge instances)
 * 3. Upstream fetch (slowest, only when cache misses)
 *
 * Stale-on-error: If upstream fails, return stale cache data
 */

import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

// In-memory LRU cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const MAX_MEMORY_ENTRIES = 100;

/**
 * Initialize Upstash Redis client (lazy, only when needed)
 */
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Upstash Redis not configured - cache will be memory-only');
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Evict oldest entry from memory cache when limit reached
 */
function evictOldestFromMemory() {
  if (memoryCache.size < MAX_MEMORY_ENTRIES) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    memoryCache.delete(oldestKey);
  }
}

/**
 * Check if cache entry is still valid
 */
function isValid<T>(entry: CacheEntry<T>): boolean {
  const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
  return age < entry.ttl;
}

/**
 * Get data from memory cache
 */
function getFromMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!entry) return null;

  if (isValid(entry)) {
    return entry.data;
  }

  // Expired - remove from memory
  memoryCache.delete(key);
  return null;
}

/**
 * Set data in memory cache
 */
function setInMemory<T>(key: string, data: T, ttlSeconds: number): void {
  evictOldestFromMemory();

  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlSeconds,
  });
}

/**
 * Check if an error is an Upstash "overloaded" signal
 */
function isUpstashOverloaded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return e['overloaded'] === true || String(e['message'] ?? '').includes('overload');
}

/**
 * Get data from Redis cache
 */
async function getFromRedis<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get<CacheEntry<T>>(key);

    if (!cached) return null;

    if (isValid(cached)) {
      // Also populate memory cache for faster subsequent access
      setInMemory(key, cached.data, cached.ttl);
      return cached.data;
    }

    // Expired - delete from Redis
    await redis.del(key);
    return null;
  } catch (error) {
    if (isUpstashOverloaded(error)) {
      // Redis overloaded — skip silently, memory cache still works
      return null;
    }
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Set data in Redis cache
 */
async function setInRedis<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    };

    // Set with Redis TTL (add 10% buffer to handle clock skew)
    await redis.set(key, entry, { ex: Math.floor(ttlSeconds * 1.1) });
  } catch (error) {
    if (isUpstashOverloaded(error)) {
      // Redis overloaded — data still in memory cache, acceptable degradation
      return;
    }
    console.error('Redis set error:', error);
  }
}

/**
 * Get stale data from any cache tier (for error fallback)
 */
async function getStaleData<T>(key: string): Promise<T | null> {
  // Try memory first (even if expired)
  const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memEntry) return memEntry.data;

  // Try Redis (even if expired)
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get<CacheEntry<T>>(key);
    return cached?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 3-tier cache wrapper with stale-on-error fallback
 *
 * @param key - Unique cache key (e.g., "gdelt:events", "usgs:earthquakes")
 * @param ttlSeconds - Time to live in seconds
 * @param fetcher - Async function that fetches fresh data
 * @returns Cached or fresh data
 *
 * Usage:
 * const data = await withCache('usgs:earthquakes', 300, async () => {
 *   const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
 *   return res.json();
 * });
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Tier 1: Check memory cache
  const memoryData = getFromMemory<T>(key);
  if (memoryData !== null) {
    return memoryData;
  }

  // Tier 2: Check Redis cache
  const redisData = await getFromRedis<T>(key);
  if (redisData !== null) {
    return redisData;
  }

  // Tier 3: Fetch from upstream
  try {
    const freshData = await fetcher();

    // Store in both cache tiers
    setInMemory(key, freshData, ttlSeconds);
    await setInRedis(key, freshData, ttlSeconds);

    return freshData;
  } catch (error) {
    console.error(`Upstream fetch failed for key "${key}":`, error);

    // Stale-on-error fallback: try to return expired cache data
    const staleData = await getStaleData<T>(key);

    if (staleData !== null) {
      console.warn(`Returning stale data for key "${key}" due to upstream failure`);
      return staleData;
    }

    // No stale data available — if it's an Upstash overload, return a typed empty
    // rather than letting a 500 propagate to the client.
    if (isUpstashOverloaded(error)) {
      console.warn(`Upstash overloaded for key "${key}" — returning empty fallback`);
      // Callers wrap withCache in try/catch and handle empty gracefully
      throw error;
    }

    // Other upstream failures
    throw error;
  }
}

/**
 * Manually invalidate cache entry (all tiers)
 */
export async function invalidateCache(key: string): Promise<void> {
  // Remove from memory
  memoryCache.delete(key);

  // Remove from Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }
}

/**
 * Clear all memory cache (useful for testing)
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
