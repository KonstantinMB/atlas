/**
 * Sentiment Strategy (News NLP)
 *
 * Inputs: GDELT tone scores from /api/data/gdelt edge function
 * Aggregates tone by sector using keyword mapping
 * 4-hour rolling average tone per sector
 * LONG when: tone > +2.5 (strong positive sentiment)
 * SHORT when: tone < -2.5 (strong negative)
 * Confidence: abs(tone) / 5.0, capped at 0.9
 * Runs every 15 minutes (aligned with GDELT update cycle)
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';
import { SECTOR_TO_SYMBOLS } from '../../data/universe';
import { getStore } from '../../../lib/state';
import type { PredictionMarketMomentum } from '../../../lib/state';

const STRATEGY_NAME = 'sentiment';
const UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ROLLING_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

interface GdeltEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  country: string;
  timestamp: number;
  tone: number | null;
}

interface SectorSentiment {
  sector: string;
  averageTone: number;
  eventCount: number;
  lastUpdate: number;
}

/**
 * Sector keyword mappings for news classification
 */
const SECTOR_KEYWORDS: Record<string, string[]> = {
  Technology: ['tech', 'technology', 'software', 'ai', 'artificial intelligence', 'chip', 'semiconductor', 'cloud', 'cyber', 'data'],
  Energy: ['oil', 'energy', 'crude', 'opec', 'gas', 'natural gas', 'lng', 'pipeline', 'refinery', 'petroleum'],
  Financials: ['bank', 'fed', 'federal reserve', 'rate', 'interest', 'credit', 'mortgage', 'lending', 'financial', 'wall street'],
  Healthcare: ['health', 'medical', 'hospital', 'pharma', 'drug', 'vaccine', 'biotech', 'medicare', 'insurance'],
  'Consumer Staples': ['retail', 'consumer', 'walmart', 'target', 'grocery', 'food', 'beverage', 'procter'],
  Utilities: ['utility', 'utilities', 'electric', 'power', 'grid', 'renewable', 'solar', 'wind'],
  Industrials: ['industrial', 'manufacturing', 'factory', 'aerospace', 'boeing', 'caterpillar', 'construction'],
  Materials: ['mining', 'metals', 'copper', 'aluminum', 'steel', 'materials', 'commodity'],
  'Real Estate': ['real estate', 'property', 'housing', 'mortgage', 'reit', 'apartment', 'commercial real estate'],
  Communications: ['telecom', 'communication', 'media', 'broadcasting', 'netflix', 'disney', 'verizon', 'at&t'],
  'Precious Metals': ['gold', 'silver', 'platinum', 'palladium', 'precious metal'],
};

let eventHistory: GdeltEvent[] = [];
let updateTimer: number | null = null;

/**
 * Fetch latest GDELT events
 */
async function fetchGdeltEvents(): Promise<GdeltEvent[]> {
  try {
    const response = await fetch('/api/data/gdelt');
    if (!response.ok) {
      console.error('[SentimentStrategy] GDELT fetch failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('[SentimentStrategy] GDELT fetch error:', error);
    return [];
  }
}

/**
 * Classify news event into sector based on title keywords
 */
function classifyEventToSector(event: GdeltEvent): string[] {
  const titleLower = event.title.toLowerCase();
  const matchedSectors: string[] = [];

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        matchedSectors.push(sector);
        break; // Only count once per sector
      }
    }
  }

  return matchedSectors;
}

/**
 * Aggregate tone scores by sector over 4-hour window
 */
function aggregateSentimentBySector(): Map<string, SectorSentiment> {
  const now = Date.now();
  const windowStart = now - ROLLING_WINDOW_MS;

  // Filter events within 4-hour window
  const recentEvents = eventHistory.filter(e => e.timestamp >= windowStart);

  // Aggregate by sector
  const sectorTones = new Map<string, number[]>();

  for (const event of recentEvents) {
    if (event.tone === null) continue;

    const sectors = classifyEventToSector(event);

    for (const sector of sectors) {
      if (!sectorTones.has(sector)) {
        sectorTones.set(sector, []);
      }
      sectorTones.get(sector)!.push(event.tone);
    }
  }

  // Calculate average tone per sector
  const sectorSentiments = new Map<string, SectorSentiment>();

  for (const [sector, tones] of sectorTones.entries()) {
    if (tones.length === 0) continue;

    const averageTone = tones.reduce((sum, t) => sum + t, 0) / tones.length;

    sectorSentiments.set(sector, {
      sector,
      averageTone,
      eventCount: tones.length,
      lastUpdate: now,
    });
  }

  return sectorSentiments;
}

/**
 * Get prediction market momentum boost for a sector
 * Returns: { boost: number (-0.05 to +0.05), snippet: string }
 */
function getPredictionMarketBoost(sector: string, direction: 'LONG' | 'SHORT'): { boost: number; snippet: string } {
  try {
    const store = getStore();
    const predictionMarkets = store.get('predictionMarkets') as PredictionMarketMomentum[];

    if (!predictionMarkets || predictionMarkets.length === 0) {
      return { boost: 0, snippet: '' };
    }

    // Filter markets by category matching sector (fuzzy match)
    const relevantMarkets = predictionMarkets.filter(m => {
      const cat = m.category.toLowerCase();
      const sec = sector.toLowerCase();

      // Direct category match
      if (cat.includes(sec) || sec.includes(cat)) return true;

      // Finance-related mappings
      if (sec === 'financials' && (cat.includes('finance') || cat.includes('market') || cat.includes('economy'))) return true;
      if (sec === 'technology' && cat.includes('tech')) return true;
      if (sec === 'energy' && cat.includes('energy')) return true;

      return false;
    });

    if (relevantMarkets.length === 0) {
      return { boost: 0, snippet: '' };
    }

    // Calculate average momentum across relevant markets
    const avgMomentum = relevantMarkets.reduce((sum, m) => sum + m.sentimentMomentum, 0) / relevantMarkets.length;

    // Boost confidence if momentum aligns with direction
    let boost = 0;
    let snippet = '';

    if (direction === 'LONG' && avgMomentum > 0.1) {
      // Positive momentum supports LONG signals
      boost = Math.min(avgMomentum * 0.05, 0.05); // Max +0.05 confidence boost
      const pct = (avgMomentum * 100).toFixed(1);
      snippet = ` Prediction market momentum: +${pct}% (24h) confirms bullish sentiment.`;
    } else if (direction === 'SHORT' && avgMomentum < -0.1) {
      // Negative momentum supports SHORT signals
      boost = Math.min(Math.abs(avgMomentum) * 0.05, 0.05); // Max +0.05 confidence boost
      const pct = (avgMomentum * 100).toFixed(1);
      snippet = ` Prediction market momentum: ${pct}% (24h) confirms bearish sentiment.`;
    }

    return { boost, snippet };
  } catch (err) {
    console.warn('[SentimentStrategy] Prediction market boost failed:', err);
    return { boost: 0, snippet: '' };
  }
}

/**
 * Generate signals based on sector sentiment
 */
function generateSentimentSignals(): void {
  const sectorSentiments = aggregateSentimentBySector();

  for (const [sector, sentiment] of sectorSentiments.entries()) {
    const { averageTone, eventCount } = sentiment;

    // Need at least 3 events in window for confidence
    if (eventCount < 3) continue;

    // Get tradeable symbols for this sector
    const symbols = SECTOR_TO_SYMBOLS[sector];
    if (!symbols || symbols.length === 0) continue;

    // LONG signal: tone > +2.5
    if (averageTone > 2.5) {
      const baseConfidence = Math.min(Math.abs(averageTone) / 5.0, 0.9);

      // Get prediction market momentum boost
      const { boost, snippet } = getPredictionMarketBoost(sector, 'LONG');
      const confidence = Math.min(baseConfidence + boost, 0.95); // Cap at 0.95

      // Generate signal for the primary symbol (first in list)
      const symbol = symbols[0];

      const signal: Signal = {
        id: `sentiment-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
        strategy: STRATEGY_NAME,
        symbol,
        direction: 'LONG',
        confidence,
        reasoning: `${sector} sector shows strong positive sentiment (avg tone: ${averageTone.toFixed(1)}) over 4-hour window with ${eventCount} news events. Positive media coverage typically precedes sector strength.${snippet}`,
        targetReturn: 0.04, // 4% target
        stopLoss: 0.02, // 2% stop
        takeProfit: 0.04,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
      };

      signalBus.publish(signal);
    }

    // SHORT signal: tone < -2.5
    if (averageTone < -2.5) {
      const baseConfidence = Math.min(Math.abs(averageTone) / 5.0, 0.9);

      // Get prediction market momentum boost
      const { boost, snippet } = getPredictionMarketBoost(sector, 'SHORT');
      const confidence = Math.min(baseConfidence + boost, 0.95); // Cap at 0.95

      // Generate signal for the primary symbol
      const symbol = symbols[0];

      const signal: Signal = {
        id: `sentiment-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
        strategy: STRATEGY_NAME,
        symbol,
        direction: 'SHORT',
        confidence,
        reasoning: `${sector} sector shows strong negative sentiment (avg tone: ${averageTone.toFixed(1)}) over 4-hour window with ${eventCount} news events. Negative media coverage often precedes sector weakness.${snippet}`,
        targetReturn: 0.04, // 4% target
        stopLoss: 0.02, // 2% stop
        takeProfit: 0.04,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
      };

      signalBus.publish(signal);
    }
  }
}

/**
 * Update cycle: fetch GDELT events and generate signals
 */
async function updateCycle(): Promise<void> {
  console.log('[SentimentStrategy] Running update cycle...');

  // Fetch latest events
  const newEvents = await fetchGdeltEvents();

  // Append to history
  eventHistory.push(...newEvents);

  // Trim history to 6 hours (keep more than rolling window for overlap)
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  eventHistory = eventHistory.filter(e => e.timestamp >= sixHoursAgo);

  console.log(
    `[SentimentStrategy] Event history: ${eventHistory.length} events (${newEvents.length} new)`
  );

  // Generate signals
  generateSentimentSignals();
}

/**
 * Initialize sentiment strategy
 *
 * Runs every 15 minutes to fetch GDELT data and generate signals.
 */
export function initSentimentStrategy(): void {
  console.log('[SentimentStrategy] Initializing...');

  // Run immediately
  updateCycle();

  // Then every 15 minutes
  updateTimer = window.setInterval(() => {
    updateCycle();
  }, UPDATE_INTERVAL_MS);

  console.log('[SentimentStrategy] Initialized successfully');
}

/**
 * Shutdown sentiment strategy (cleanup)
 */
export function shutdownSentimentStrategy(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('[SentimentStrategy] Shutdown complete');
}
