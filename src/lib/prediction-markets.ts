/**
 * Prediction Markets — Unified TypeScript Interfaces
 *
 * Normalized interfaces for prediction market data across multiple sources
 * (Polymarket today; Kalshi extensible for future).
 *
 * Architecture: Edge functions → DataService → Panel UI
 */

/** Normalized prediction market (Polymarket today; Kalshi later) */
export interface PredictionMarket {
  id: string;
  source: 'polymarket' | 'kalshi';
  title: string;
  probability: number; // Yes share price 0–1
  volume24h: number;
  volumeTotal: number;
  liquidityDepth?: number; // Best bid/ask depth if available
  category: string;
  endDate: number; // Unix timestamp ms
  outcomePrices: [number, number]; // [Yes, No]
}

/** Historical odds for sparklines and momentum */
export interface HistoricalOdds {
  marketId: string;
  points: { t: number; p: number }[]; // t=timestamp ms, p=Yes probability
  interval: '1h' | '6h' | '1d';
}

/** Aggregated metrics for decision engine */
export interface MarketMetrics {
  marketId: string;
  title: string;
  probability: number;
  volume24h: number;
  sentimentMomentum: number; // ROC of Yes price over 24h (-1 to +1 scale)
  history24h: number[]; // Sparkline data points (Yes probabilities)
  lastUpdated: number;
  category?: string;
}

/** API response wrapper for polymarket-metrics endpoint */
export interface PolymarketMetricsResponse {
  markets: MarketMetrics[];
  timestamp: number;
}

/** API response wrapper for polymarket-history endpoint */
export interface PolymarketHistoryResponse {
  histories: {
    [marketId: string]: {
      points: { t: number; p: number }[];
      interval: '1h' | '6h' | '1d';
    };
  };
}
