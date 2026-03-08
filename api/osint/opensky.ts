/**
 * Aircraft Positions Edge Function
 *
 * Primary:  adsb.fi public API — lightweight JSON, datacenter-friendly, no auth
 * Fallback: OpenSky Network (OAuth2 if credentials set, else anonymous)
 *
 * Caches for 5 minutes so the upstream is hit at most once every 300 s,
 * well within rate limits and safely under Vercel's 25 s function timeout.
 * Returns empty array gracefully on any failure — never 500s.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface Aircraft {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
}

// ── adsb.fi ───────────────────────────────────────────────────────────────────
// Public ADS-B aggregator — no auth, no rate limit at reasonable polling rates.
// Returns all globally tracked aircraft as compact JSON.

interface AdsbFiAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  r?: string;
  t?: string;
}

interface AdsbFiResponse {
  ac?: AdsbFiAircraft[];
  now?: number;
  total?: number;
}

function normalizeAdsbFi(raw: AdsbFiResponse): Aircraft[] {
  const list = raw.ac ?? [];
  const results: Aircraft[] = [];

  for (const ac of list) {
    if (results.length >= 800) break;
    if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;
    // skip ground traffic
    if (ac.alt_baro === 'ground' || ac.alt_baro === 0) continue;

    results.push({
      icao24: String(ac.hex ?? '').trim(),
      callsign: String(ac.flight ?? ac.r ?? '').trim(),
      country: '',
      lat: ac.lat,
      lon: ac.lon,
      altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : 0,
      velocity: typeof ac.gs === 'number' ? ac.gs : 0,
      heading: typeof ac.track === 'number' ? ac.track : 0,
    });
  }

  return results;
}

async function fetchAdsbFi(): Promise<Aircraft[]> {
  // Try multiple adsb.fi endpoints (API may have changed)
  const endpoints = [
    'https://api.adsb.fi/v1/flights',
    'https://api.adsb.lol/v2/lat/10/lon/0/dist/10000', // Alternative public ADS-B API
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'YC-Hedge-Fund/1.0' },
        signal: AbortSignal.timeout(15_000), // Increased from 8s to 15s
      });
      if (!res.ok) continue;
      const data: AdsbFiResponse = await res.json();
      const aircraft = normalizeAdsbFi(data);
      if (aircraft.length > 0) return aircraft;
    } catch {
      continue; // Try next endpoint
    }
  }

  throw new Error('All adsb endpoints failed');
}

// ── OpenSky fallback ──────────────────────────────────────────────────────────
// Restricts to strategically interesting corridors (Europe, Middle East, Asia)
// to keep the response size manageable (~2-3k aircraft vs 15k globally).

type StateVector = (string | number | boolean | null)[];

interface OpenSkyResponse {
  states: StateVector[] | null;
}

const OPENSKY_URL =
  'https://opensky-network.org/api/states/all?lamin=10&lomin=-30&lamax=75&lomax=145';
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

function getEnv(key: string): string | undefined {
  return (typeof process !== 'undefined' ? process.env[key] : undefined)
    ?? (globalThis as Record<string, unknown>)[key] as string | undefined;
}

async function fetchOpenSkyToken(): Promise<string | null> {
  const id = getEnv('OPENSKY_CLIENT_ID');
  const secret = getEnv('OPENSKY_CLIENT_SECRET');
  if (!id || !secret) return null;
  try {
    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }).toString(),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const j = await res.json() as { access_token: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

function normalizeOpenSky(states: StateVector[]): Aircraft[] {
  const results: Aircraft[] = [];
  for (const s of states) {
    if (results.length >= 800) break;
    if (s[8] === true) continue; // on ground
    const lat = s[6] as number | null;
    const lon = s[5] as number | null;
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) continue;
    results.push({
      icao24: String(s[0] ?? '').trim(),
      callsign: String(s[1] ?? '').trim(),
      country: String(s[2] ?? '').trim(),
      lat,
      lon,
      altitude: Number(s[7] ?? 0),
      velocity: Number(s[9] ?? 0),
      heading: Number(s[10] ?? 0),
    });
  }
  return results;
}

async function fetchOpenSky(): Promise<Aircraft[]> {
  const token = await fetchOpenSkyToken();
  const headers: Record<string, string> = { 'User-Agent': 'YC-Hedge-Fund/1.0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(OPENSKY_URL, {
    headers,
    signal: AbortSignal.timeout(20_000), // Increased from 8s to 20s for war zone data
  });
  if (res.status === 401 || res.status === 403 || res.status === 429) return [];
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data: OpenSkyResponse = await res.json();
  return normalizeOpenSky(data.states ?? []);
}

// ── ADS-B Exchange fallback ──────────────────────────────────────────────────
// Free crowd-sourced ADS-B data, no auth required
// Focus on conflict regions: Middle East, Ukraine, Taiwan Strait

interface AdsbExchangeAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  r?: string;
}

async function fetchAdsbExchange(): Promise<Aircraft[]> {
  // Multiple regional feeds for war zones
  const regions = [
    { lat: 33, lon: 44, radius: 400 },   // Iraq/Syria/Iran
    { lat: 49, lon: 32, radius: 500 },   // Ukraine
    { lat: 25, lon: 121, radius: 300 },  // Taiwan Strait
    { lat: 31, lon: 35, radius: 300 },   // Israel/Palestine
  ];

  const allAircraft: Aircraft[] = [];

  for (const region of regions) {
    try {
      const url = `https://globe.adsbexchange.com/globe_history/${Date.now()}/aircraft.json`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'YC-Hedge-Fund/1.0' },
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) continue;

      const data: { aircraft?: AdsbExchangeAircraft[] } = await res.json();
      const aircraft = data.aircraft ?? [];

      for (const ac of aircraft) {
        if (allAircraft.length >= 800) break;
        if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue;

        // Filter to region
        const distance = Math.sqrt(
          Math.pow((ac.lat - region.lat), 2) + Math.pow((ac.lon - region.lon), 2)
        );
        if (distance > region.radius / 111) continue; // ~111 km per degree

        allAircraft.push({
          icao24: String(ac.hex ?? '').trim(),
          callsign: String(ac.flight ?? ac.r ?? '').trim(),
          country: '',
          lat: ac.lat,
          lon: ac.lon,
          altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : 0,
          velocity: typeof ac.gs === 'number' ? ac.gs : 0,
          heading: typeof ac.track === 'number' ? ac.track : 0,
        });
      }

      if (allAircraft.length > 100) break; // Got enough data
    } catch {
      continue; // Try next region
    }
  }

  if (allAircraft.length === 0) {
    throw new Error('No aircraft data from ADS-B Exchange');
  }

  return allAircraft;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default withCors(async (_req: Request) => {
  // 5-minute cache — strategic aircraft positions don't need sub-minute freshness
  const CACHE_TTL = 300;

  let aircraft: Aircraft[] = [];
  let source = 'none';

  try {
    aircraft = await withCache<Aircraft[]>('osint:aircraft:v3', CACHE_TTL, async () => {
      // Strategy: Try all sources in parallel, use first successful response
      const sources = [
        { name: 'adsb.fi', fetch: fetchAdsbFi },
        { name: 'opensky', fetch: fetchOpenSky },
        { name: 'adsbexchange', fetch: fetchAdsbExchange },
      ];

      // Race all sources with generous timeout
      const results = await Promise.allSettled(
        sources.map(async ({ name, fetch: fetchFn }) => {
          try {
            const data = await fetchFn();
            return { name, data };
          } catch (err) {
            // Only log non-network errors (these are expected when sources are unavailable)
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (!errorMsg.includes('failed') && !errorMsg.includes('No aircraft')) {
              console.warn(`[Aircraft] ${name}:`, errorMsg);
            }
            throw err;
          }
        })
      );

      // Return first successful result
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.data.length > 0) {
          source = result.value.name;
          return result.value.data;
        }
      }

      console.warn('[Aircraft] All sources failed, returning empty array');
      return [];
    });
    // Determine actual source from cached result
    if (aircraft.length > 0 && source === 'none') source = 'cache';
  } catch {
    aircraft = [];
  }

  return new Response(
    JSON.stringify({
      aircraft,
      count: aircraft.length,
      source,
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL * 2}`,
      },
    }
  );
});
