/**
 * OpenSky Network REST Poller
 * OpenSky does not provide a WebSocket feed — we poll the REST API
 * every 30 seconds and push batched aircraft updates to subscribers.
 */

export interface AircraftState {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number; // metres (barometric or geometric)
  velocity: number; // m/s
  heading: number;  // degrees true north
}

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const MAX_AIRCRAFT = 800;

export class OpenSkyPoller {
  private interval: NodeJS.Timeout | null = null;
  private readonly subscribers: Set<(aircraft: AircraftState[]) => void> = new Set();
  private consecutiveErrors = 0;
  private disabled = false;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  start(intervalMs = 30_000): void {
    void this.poll(); // immediate first poll
    this.interval = setInterval(() => { void this.poll(); }, intervalMs);
  }

  private async poll(): Promise<void> {
    // Stop polling if repeatedly blocked — OpenSky blocks datacenter IPs
    if (this.disabled) return;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Atlas Intelligence Platform (atlas-relay)',
      };

      const username = process.env.OPENSKY_USERNAME;
      const password = process.env.OPENSKY_PASSWORD;
      if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const res = await fetch(OPENSKY_URL, { headers, signal: AbortSignal.timeout(15_000) });

      if (res.status === 429 || res.status === 403) {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
          console.warn(`[OpenSky] Blocked by upstream after ${this.consecutiveErrors} attempts — disabling poller. Set OPENSKY_USERNAME/OPENSKY_PASSWORD env vars for authenticated access.`);
          this.disabled = true;
        }
        return;
      }

      if (!res.ok) {
        console.warn(`[OpenSky] Poll returned ${res.status}`);
        return;
      }

      this.consecutiveErrors = 0; // reset on success
      const json = await res.json() as { states: any[][] | null };
      const states = json.states ?? [];

      const aircraft: AircraftState[] = states
        // s[8] = on_ground boolean, s[5] = lon, s[6] = lat
        .filter((s) => s[6] !== null && s[5] !== null && s[8] === false)
        .slice(0, MAX_AIRCRAFT)
        .map((s) => ({
          icao24: String(s[0] ?? ''),
          callsign: String(s[1] ?? '').trim(),
          country: String(s[2] ?? ''),
          lat: s[6] as number,
          lon: s[5] as number,
          altitude: (s[7] ?? s[13] ?? 0) as number,
          velocity: (s[9] ?? 0) as number,
          heading: (s[10] ?? 0) as number,
        }));

      this.subscribers.forEach(cb => cb(aircraft));
    } catch (err) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[OpenSky] Network errors persist (${this.consecutiveErrors}x) — disabling poller. Set OPENSKY_USERNAME/OPENSKY_PASSWORD env vars.`);
        this.disabled = true;
        return;
      }
      // Only log first occurrence or every 5th to reduce noise
      if (this.consecutiveErrors === 1) {
        console.warn('[OpenSky] Poll error (will retry silently):', err instanceof Error ? err.message : String(err));
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
