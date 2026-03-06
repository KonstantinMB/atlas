/**
 * Data Service
 * Coordinates API fetching across all panels. Single source of truth for live data.
 * Panels listen to CustomEvents emitted by this service rather than fetching independently.
 */

import { api } from './api-client';
import type { MarketMetrics, PolymarketMetricsResponse } from './prediction-markets';

// ── Response types matching the edge function schemas ──────────────────────────

export interface GdeltEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  country: string;
  timestamp: number;
  tone: number | null;
}

export interface EarthquakeEvent {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  lon: number;
  lat: number;
  depth: number;
  tsunami: boolean;
  significance: number;
}

export interface DisasterAlert {
  id: string;
  title: string;
  type: string;
  severity: 'green' | 'orange' | 'red';
  lat: number;
  lon: number;
  date: number;
  url: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  change5dPct: number;
  history5d: number[];
  timestamp: number;
}

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  marketCapRank: number;
}

export interface CryptoDetail {
  prices: CryptoPrice[];
  totalCryptoMarketCap: number;
  lastFetch: number;
}

export interface RadarSignal {
  id: string;
  name: string;
  value: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
}

export interface MacroRadarDetail {
  signals: RadarSignal[];
  verdict: 'BUY' | 'CASH' | 'SELL';
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  timestamp: number;
}

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
  nextUpdate: number;
}

export interface PolymarketMetricsDetail {
  markets: MarketMetrics[];
  timestamp: number;
  lastFetch: number;
}

// ── Event detail shapes ────────────────────────────────────────────────────────

export interface GdeltDetail {
  events: GdeltEvent[];
  lastFetch: number;
}

export interface UsgsDetail {
  events: EarthquakeEvent[];
  lastFetch: number;
}

export interface GdacsDetail {
  alerts: DisasterAlert[];
  lastFetch: number;
}

export interface YahooDetail {
  quotes: MarketQuote[];
  lastFetch: number;
}

// ── Service class ──────────────────────────────────────────────────────────────

class DataService extends EventTarget {
  private gdelt: GdeltDetail | null = null;
  private usgs: UsgsDetail | null = null;
  private gdacs: GdacsDetail | null = null;
  private fearGreed: FearGreedData | null = null;
  private yahoo: YahooDetail | null = null;
  private crypto: CryptoDetail | null = null;
  private macroRadar: MacroRadarDetail | null = null;
  private polymarketMetrics: PolymarketMetricsDetail | null = null;

  // Accessors for current cached state (panels can call these after events fire)
  getGdelt(): GdeltDetail | null { return this.gdelt; }
  getUsgs(): UsgsDetail | null { return this.usgs; }
  getGdacs(): GdacsDetail | null { return this.gdacs; }
  getFearGreed(): FearGreedData | null { return this.fearGreed; }
  getYahoo(): YahooDetail | null { return this.yahoo; }
  getCrypto(): CryptoDetail | null { return this.crypto; }
  getMacroRadar(): MacroRadarDetail | null { return this.macroRadar; }
  getPolymarketMetrics(): PolymarketMetricsDetail | null { return this.polymarketMetrics; }

  async fetchGdelt(): Promise<void> {
    try {
      const data = await api.fetch<{ events: GdeltEvent[] }>(
        '/api/data/gdelt',
        900_000 // 15 min TTL
      );
      this.gdelt = { events: data.events ?? [], lastFetch: Date.now() };
      this.dispatchEvent(new CustomEvent<GdeltDetail>('gdelt', { detail: this.gdelt }));
    } catch (err) {
      console.error('[DataService] GDELT fetch failed:', err);
    }
  }

  async fetchUsgs(): Promise<void> {
    try {
      const data = await api.fetch<{ events: EarthquakeEvent[] }>(
        '/api/data/usgs',
        300_000 // 5 min TTL
      );
      this.usgs = { events: data.events ?? [], lastFetch: Date.now() };
      this.dispatchEvent(new CustomEvent<UsgsDetail>('usgs', { detail: this.usgs }));
    } catch (err) {
      console.error('[DataService] USGS fetch failed:', err);
    }
  }

  async fetchGdacs(): Promise<void> {
    try {
      const data = await api.fetch<{ alerts: DisasterAlert[] }>(
        '/api/data/gdacs',
        1_800_000 // 30 min TTL
      );
      this.gdacs = { alerts: data.alerts ?? [], lastFetch: Date.now() };
      this.dispatchEvent(new CustomEvent<GdacsDetail>('gdacs', { detail: this.gdacs }));
    } catch (err) {
      console.error('[DataService] GDACS fetch failed:', err);
    }
  }

  async fetchFearGreed(): Promise<void> {
    try {
      const data = await api.fetch<FearGreedData & { fetchedAt?: number }>(
        '/api/market/fear-greed',
        3_600_000 // 1 hr TTL
      );
      this.fearGreed = {
        value: data.value,
        classification: data.classification,
        timestamp: data.timestamp,
        nextUpdate: data.nextUpdate,
      };
      this.dispatchEvent(
        new CustomEvent<FearGreedData>('fear-greed', { detail: this.fearGreed })
      );
    } catch (err) {
      console.error('[DataService] Fear & Greed fetch failed:', err);
    }
  }

  async fetchYahoo(): Promise<void> {
    try {
      const data = await api.fetch<{ quotes: MarketQuote[] }>(
        '/api/market/yahoo',
        60_000 // 1 min TTL
      );
      this.yahoo = { quotes: data.quotes ?? [], lastFetch: Date.now() };
      this.dispatchEvent(new CustomEvent<YahooDetail>('yahoo', { detail: this.yahoo }));
    } catch (err) {
      console.error('[DataService] Yahoo fetch failed:', err);
    }
  }

  async fetchCrypto(): Promise<void> {
    try {
      const data = await api.fetch<{ prices: CryptoPrice[]; totalCryptoMarketCap: number }>(
        '/api/market/coingecko',
        60_000
      );
      this.crypto = {
        prices: data.prices ?? [],
        totalCryptoMarketCap: data.totalCryptoMarketCap ?? 0,
        lastFetch: Date.now(),
      };
      this.dispatchEvent(new CustomEvent<CryptoDetail>('crypto', { detail: this.crypto }));
    } catch (err) {
      console.error('[DataService] Crypto fetch failed:', err);
    }
  }

  async fetchMacroRadar(): Promise<void> {
    try {
      const data = await api.fetch<MacroRadarDetail>(
        '/api/market/macro-radar',
        300_000 // 5 min TTL
      );
      this.macroRadar = data;
      this.dispatchEvent(new CustomEvent<MacroRadarDetail>('macro-radar', { detail: this.macroRadar }));
    } catch (err) {
      console.error('[DataService] Macro radar fetch failed:', err);
    }
  }

  async fetchPolymarketMetrics(): Promise<void> {
    try {
      const data = await api.fetch<PolymarketMetricsResponse>(
        '/api/osint/polymarket-metrics',
        300_000 // 5 min TTL
      );
      this.polymarketMetrics = {
        markets: data.markets ?? [],
        timestamp: data.timestamp,
        lastFetch: Date.now(),
      };
      this.dispatchEvent(
        new CustomEvent<PolymarketMetricsDetail>('polymarket-metrics', {
          detail: this.polymarketMetrics,
        })
      );
    } catch (err) {
      console.error('[DataService] Polymarket metrics fetch failed:', err);
    }
  }

  /**
   * Start polling all data sources on staggered intervals.
   * Call once after all panels have been initialized.
   */
  startPolling(): void {
    // Staggered initial fetches to spread load
    setTimeout(() => { void this.fetchYahoo(); }, 1_000);
    setTimeout(() => { void this.fetchFearGreed(); }, 1_500);
    setTimeout(() => { void this.fetchGdelt(); }, 2_000);
    setTimeout(() => { void this.fetchCrypto(); }, 2_000);
    setTimeout(() => { void this.fetchMacroRadar(); }, 4_000);
    setTimeout(() => {
      void this.fetchUsgs();
      void this.fetchGdacs();
    }, 3_000);
    setTimeout(() => { void this.fetchPolymarketMetrics(); }, 5_000);

    // Recurring polls
    setInterval(() => { void this.fetchYahoo(); }, 60_000);
    setInterval(() => { void this.fetchFearGreed(); }, 3_600_000);
    setInterval(() => { void this.fetchGdelt(); }, 900_000);
    setInterval(() => { void this.fetchUsgs(); }, 300_000);
    setInterval(() => { void this.fetchGdacs(); }, 1_800_000);
    setInterval(() => { void this.fetchCrypto(); }, 60_000);
    setInterval(() => { void this.fetchMacroRadar(); }, 300_000);
    setInterval(() => { void this.fetchPolymarketMetrics(); }, 300_000);
  }
}

export const dataService = new DataService();
