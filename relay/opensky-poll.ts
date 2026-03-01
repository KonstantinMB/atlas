/**
 * OpenSky Network REST Poller
 * Uses OAuth2 client_credentials flow when OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET
 * are set; falls back to anonymous (with backoff) otherwise.
 */

export interface AircraftState {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number; // metres
  velocity: number; // m/s
  heading: number;  // degrees true north
}

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const MAX_AIRCRAFT = 800;

// ── OAuth2 token cache ──────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Reuse valid cached token (expire 30s early for safety)
  if (tokenCache && tokenCache.expiresAt - 30_000 > Date.now()) {
    return tokenCache.accessToken;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[OpenSky] Token request failed: ${res.status}`);
      return null;
    }

    const json = await res.json() as { access_token: string; expires_in: number };
    tokenCache = {
      accessToken: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };

    console.log('[OpenSky] OAuth2 token obtained, valid for', json.expires_in, 's');
    return tokenCache.accessToken;
  } catch (err) {
    console.error('[OpenSky] Token fetch error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ── Connectivity probe ───────────────────────────────────────────────────────

/**
 * Quick HEAD request to check if OpenSky is reachable from this host.
 * Returns false on any network error (Railway IPs are often blocked).
 */
async function probeOpenSky(): Promise<boolean> {
  try {
    const res = await fetch('https://opensky-network.org/', {
      method: 'HEAD',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'YC Hedge Fund Intelligence Platform (connectivity-probe)' },
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ── Poller ──────────────────────────────────────────────────────────────────

export class OpenSkyPoller {
  private interval: NodeJS.Timeout | null = null;
  private readonly subscribers: Set<(aircraft: AircraftState[]) => void> = new Set();
  private consecutiveErrors = 0;
  private disabled = false;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  async start(intervalMs = 30_000): Promise<void> {
    // Fast connectivity probe — skip entirely if OpenSky blocks this host
    const reachable = await probeOpenSky();
    if (!reachable) {
      console.warn(
        '[OpenSky] Host unreachable from this environment (Railway IP likely blocked). ' +
        'Aircraft tracking disabled. Set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET or ' +
        'use a proxy to enable it.'
      );
      this.disabled = true;
      return;
    }

    console.log('[OpenSky] Host reachable — starting poller');
    void this.poll(); // immediate first poll
    this.interval = setInterval(() => { void this.poll(); }, intervalMs);
  }

  private async poll(): Promise<void> {
    if (this.disabled) return;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'YC Hedge Fund Intelligence Platform (yc-hedge-fund-relay)',
      };

      // Prefer OAuth2 client credentials; fall back to Basic Auth (legacy)
      const token = await getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Legacy Basic Auth fallback
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;
        if (username && password) {
          const creds = Buffer.from(`${username}:${password}`).toString('base64');
          headers['Authorization'] = `Basic ${creds}`;
        }
      }

      const res = await fetch(OPENSKY_URL, { headers, signal: AbortSignal.timeout(15_000) });

      if (res.status === 429 || res.status === 403) {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
          console.warn(
            `[OpenSky] Blocked after ${this.consecutiveErrors} attempts — disabling poller. ` +
            'Set OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET in Railway env vars.'
          );
          this.disabled = true;
        }
        return;
      }

      if (!res.ok) {
        console.warn(`[OpenSky] Poll returned ${res.status}`);
        return;
      }

      this.consecutiveErrors = 0;
      const json = await res.json() as { states: unknown[][] | null };
      const states = json.states ?? [];

      const aircraft: AircraftState[] = states
        .filter((s) => s[6] !== null && s[5] !== null && s[8] === false)
        .slice(0, MAX_AIRCRAFT)
        .map((s) => ({
          icao24: String(s[0] ?? '').trim(),
          callsign: String(s[1] ?? '').trim(),
          country: String(s[2] ?? ''),
          lat: s[6] as number,
          lon: s[5] as number,
          altitude: ((s[7] ?? s[13] ?? 0) as number),
          velocity: (s[9] ?? 0) as number,
          heading: (s[10] ?? 0) as number,
        }));

      console.log(`[OpenSky] Received ${aircraft.length} aircraft`);
      this.subscribers.forEach(cb => cb(aircraft));

    } catch (err) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        console.warn(
          `[OpenSky] Network errors persist (${this.consecutiveErrors}x) — disabling poller.`
        );
        this.disabled = true;
        return;
      }
      if (this.consecutiveErrors === 1) {
        console.warn(
          '[OpenSky] Poll error (will retry silently):',
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  subscribe(callback: (aircraft: AircraftState[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
