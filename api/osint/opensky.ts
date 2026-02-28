/**
 * OpenSky Aircraft Positions Edge Function
 *
 * Fetches live aircraft state vectors from OpenSky Network.
 * No API key required (anonymous rate limit applies). 1-minute cache.
 * Filters to airborne aircraft with valid coordinates, max 1000 results.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

// State vector field indices per OpenSky API docs
const IDX_ICAO24 = 0;
const IDX_CALLSIGN = 1;
const IDX_ORIGIN_COUNTRY = 2;
const IDX_LON = 5;
const IDX_LAT = 6;
const IDX_GEO_ALTITUDE = 7;
const IDX_ON_GROUND = 8;
const IDX_VELOCITY = 9;
const IDX_HEADING = 10;

type StateVector = (string | number | boolean | null)[];

interface OpenSkyResponse {
  time: number;
  states: StateVector[] | null;
}

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

const OPENSKY_URL =
  'https://opensky-network.org/api/states/all?lamin=-90&lomin=-180&lamax=90&lomax=180';

function normalizeState(s: StateVector): Aircraft | null {
  const onGround = s[IDX_ON_GROUND];
  if (onGround === true) return null;

  const lat = s[IDX_LAT] as number | null;
  const lon = s[IDX_LON] as number | null;
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

  return {
    icao24: String(s[IDX_ICAO24] ?? '').trim(),
    callsign: String(s[IDX_CALLSIGN] ?? '').trim(),
    country: String(s[IDX_ORIGIN_COUNTRY] ?? '').trim(),
    lat,
    lon,
    altitude: Number(s[IDX_GEO_ALTITUDE] ?? 0),
    velocity: Number(s[IDX_VELOCITY] ?? 0),
    heading: Number(s[IDX_HEADING] ?? 0),
  };
}

export default withCors(async (_req: Request) => {
  // 5-minute cache — OpenSky anonymous tier allows ~1 req/5min from shared IPs
  let aircraft: Aircraft[] = [];
  try {
    aircraft = await withCache<Aircraft[]>('osint:aircraft', 300, async () => {
      const res = await fetch(OPENSKY_URL, {
        headers: { 'User-Agent': 'Atlas/1.0 (intelligence dashboard)' },
      });
      // OpenSky returns 429 when rate-limited — return empty rather than error
      if (res.status === 429 || res.status === 503) return [];
      if (!res.ok) throw new Error(`OpenSky upstream error: ${res.status}`);

      const data: OpenSkyResponse = await res.json();
      const states = data.states ?? [];

      const results: Aircraft[] = [];
      for (const state of states) {
        if (results.length >= 1000) break;
        const ac = normalizeState(state);
        if (ac) results.push(ac);
      }

      return results;
    });
  } catch {
    // Any error (including Upstash overload propagation) → return empty gracefully
    aircraft = [];
  }

  return new Response(
    JSON.stringify({ aircraft, count: aircraft.length, source: 'opensky', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
});
