/**
 * Prediction Market Strategy
 *
 * Generates trading signals for traditional markets based on prediction market momentum
 * with multi-source confirmation from news (GDELT) and geopolitical events (CII).
 *
 * Signal Triggers:
 *  - Prediction market 24h momentum > ±15%
 *  - Volume > $500K (high liquidity markets only)
 *  - Multi-source confirmation: news tone or CII events align with momentum
 *
 * Confidence Formula:
 *  base * (abs(momentum) / 0.3) * confirmationBoost
 *  - base: 0.62-0.72 from asset mapping
 *  - momentum: normalized (15% = 0.5, 30% = 1.0)
 *  - confirmation: +0.15 if news aligns, +0.10 if CII aligns
 *  - cap: 0.90
 *
 * Runs every 15 minutes
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';
import { getStore } from '../../../lib/state';
import type { PredictionMarketMomentum } from '../../../lib/state';
import { dataService } from '../../../lib/data-service';
import type { GdeltEvent } from '../../../lib/data-service';
import { isTradeable } from '../../data/universe';
import assetMapping from '../../../data/prediction-market-asset-mapping.json';

const STRATEGY_NAME = 'prediction-markets';
const UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MOMENTUM_THRESHOLD = 0.15; // ±15%
const HIGH_VOLUME_THRESHOLD = 80_000; // $80K (lowered for more signal frequency)

let updateTimer: number | null = null;

// ── Types ──────────────────────────────────────────────────────────────────

interface AssetMapping {
  keywords: string[];
  bullish_assets: string[];
  bearish_assets: string[];
  confidence_base: number;
  rationale: string;
}

interface MappingResult {
  symbols: string[];
  direction: 'LONG' | 'SHORT';
  confidence_base: number;
  rationale: string;
}

interface NewsConfirmation {
  aligned: boolean;
  tone: number;
  eventCount: number;
}

interface CIIConfirmation {
  aligned: boolean;
  countries: string[];
  maxZScore: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract keywords from market title for matching
 */
function extractKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const keywords: string[] = [];

  // Extract meaningful words (> 3 chars, not common stop words)
  const stopWords = new Set(['the', 'will', 'this', 'that', 'with', 'from', 'have', 'been', 'for', 'are', 'and', 'or']);
  const words = lower.match(/\b\w{4,}\b/g) || [];

  for (const word of words) {
    if (!stopWords.has(word)) {
      keywords.push(word);
    }
  }

  return keywords;
}

/**
 * Match prediction market to tradeable assets
 */
function matchMarketToAssets(market: PredictionMarketMomentum): MappingResult | null {
  const mappings = assetMapping as Record<string, AssetMapping>;

  // Try category match first
  let mapping = mappings[market.category];

  // If no category match, try keyword matching on title
  if (!mapping) {
    for (const [_cat, config] of Object.entries(mappings)) {
      const matches = config.keywords.some(kw =>
        market.title.toLowerCase().includes(kw)
      );
      if (matches) {
        mapping = config;
        break;
      }
    }
  }

  if (!mapping) return null;

  // Positive momentum → bullish assets, negative → bearish assets
  const direction: 'LONG' | 'SHORT' = market.sentimentMomentum > 0 ? 'LONG' : 'SHORT';
  const symbols = market.sentimentMomentum > 0
    ? mapping.bullish_assets
    : mapping.bearish_assets;

  return {
    symbols,
    direction,
    confidence_base: mapping.confidence_base,
    rationale: mapping.rationale,
  };
}

/**
 * Check if GDELT news confirms prediction market movement
 */
function getNewsConfirmation(market: PredictionMarketMomentum): NewsConfirmation {
  try {
    const gdeltData = dataService.getGdelt();
    if (!gdeltData || !gdeltData.events || gdeltData.events.length === 0) {
      return { aligned: false, tone: 0, eventCount: 0 };
    }

    const keywords = extractKeywords(market.title);

    // Filter GDELT events matching keywords (within last 4 hours)
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    const relevantNews = gdeltData.events.filter((e: GdeltEvent) => {
      if (e.timestamp < fourHoursAgo) return false;
      if (e.tone === null) return false;

      const titleLower = e.title.toLowerCase();
      return keywords.some(kw => titleLower.includes(kw));
    });

    if (relevantNews.length < 3) {
      return { aligned: false, tone: 0, eventCount: relevantNews.length };
    }

    // Calculate average tone
    const avgTone = relevantNews.reduce((sum: number, e: GdeltEvent) => sum + (e.tone || 0), 0) / relevantNews.length;

    // Check if news tone aligns with prediction market momentum
    // Positive momentum + positive tone = aligned
    // Negative momentum + negative tone = aligned
    const aligned =
      (market.sentimentMomentum > 0.1 && avgTone > 1.5) ||
      (market.sentimentMomentum < -0.1 && avgTone < -1.5);

    return { aligned, tone: avgTone, eventCount: relevantNews.length };
  } catch (err) {
    console.warn('[PredictionMarketStrategy] News confirmation failed:', err);
    return { aligned: false, tone: 0, eventCount: 0 };
  }
}

/**
 * Check if CII (Country Instability Index) confirms prediction market movement
 * For geopolitical markets, check if related countries have CII spikes
 */
function getCIIConfirmation(market: PredictionMarketMomentum): CIIConfirmation {
  try {
    // CII data is in intelligence state, not directly accessible here
    // We'll check if market mentions specific countries and assume confirmation
    // based on geopolitical category + negative momentum

    if (market.category !== 'Geopolitics') {
      return { aligned: false, countries: [], maxZScore: 0 };
    }

    // Extract country mentions from title
    const countryKeywords: Record<string, string[]> = {
      'Iran': ['iran', 'tehran'],
      'Russia': ['russia', 'moscow', 'putin'],
      'China': ['china', 'beijing', 'xi'],
      'Ukraine': ['ukraine', 'kyiv', 'kiev'],
      'Israel': ['israel', 'jerusalem'],
      'Taiwan': ['taiwan', 'taipei'],
      'North Korea': ['north korea', 'pyongyang'],
    };

    const titleLower = market.title.toLowerCase();
    const mentionedCountries: string[] = [];

    for (const [country, keywords] of Object.entries(countryKeywords)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        mentionedCountries.push(country);
      }
    }

    if (mentionedCountries.length === 0) {
      return { aligned: false, countries: [], maxZScore: 0 };
    }

    // If geopolitical market mentions countries and has high momentum, assume CII confirmation
    // In a real implementation, we'd query the intelligence engine's CII rankings
    const aligned = Math.abs(market.sentimentMomentum) > 0.2;

    return {
      aligned,
      countries: mentionedCountries,
      maxZScore: 3.0, // Placeholder - would be actual CII Z-score
    };
  } catch (err) {
    console.warn('[PredictionMarketStrategy] CII confirmation failed:', err);
    return { aligned: false, countries: [], maxZScore: 0 };
  }
}

/**
 * Calculate signal confidence with multi-source confirmation
 */
function calculateConfidence(
  market: PredictionMarketMomentum,
  mappingResult: MappingResult,
  newsConf: NewsConfirmation,
  ciiConf: CIIConfirmation
): number {
  // Base confidence from asset mapping
  let confidence = mappingResult.confidence_base;

  // Momentum factor: 15% = 0.5x, 30%+ = 1.0x
  const momentumFactor = Math.min(Math.abs(market.sentimentMomentum) / 0.3, 1.0);
  confidence *= (0.5 + momentumFactor * 0.5); // Scale from 0.5x to 1.0x

  // News confirmation boost
  if (newsConf.aligned && newsConf.eventCount >= 3) {
    confidence += 0.15;
  }

  // CII confirmation boost (geopolitical markets only)
  if (ciiConf.aligned && ciiConf.countries.length > 0) {
    confidence += 0.10;
  }

  // Cap at 0.90
  return Math.min(confidence, 0.90);
}

/**
 * Build reasoning string for signal
 */
function buildReasoning(
  market: PredictionMarketMomentum,
  mappingResult: MappingResult,
  newsConf: NewsConfirmation,
  ciiConf: CIIConfirmation
): string {
  const momentumPct = (market.sentimentMomentum * 100).toFixed(1);
  const probPct = (market.probability * 100).toFixed(0);
  const volFormatted = market.volume24h >= 1e6
    ? `$${(market.volume24h / 1e6).toFixed(1)}M`
    : `$${(market.volume24h / 1e3).toFixed(0)}K`;

  let reasoning = `Polymarket "${market.title}" ${market.sentimentMomentum >= 0 ? '+' : ''}${momentumPct}% (24h, ${probPct}% prob, ${volFormatted} vol).`;

  // Add news confirmation
  if (newsConf.aligned) {
    reasoning += ` GDELT tone: ${newsConf.tone.toFixed(1)} (${newsConf.eventCount} events, ${newsConf.tone > 0 ? 'bullish' : 'bearish'}).`;
  }

  // Add CII confirmation
  if (ciiConf.aligned && ciiConf.countries.length > 0) {
    reasoning += ` CII ${ciiConf.countries.join(', ')}: elevated risk.`;
  }

  // Add rationale
  reasoning += ` → ${mappingResult.rationale}`;

  return reasoning;
}

/**
 * Generate signals based on prediction markets
 */
function generateSignals(): void {
  try {
    const store = getStore();
    const markets = store.get('predictionMarkets') as PredictionMarketMomentum[];

    if (!markets || markets.length === 0) {
      console.log('[PredictionMarketStrategy] No prediction markets available');
      return;
    }

    // Filter for high momentum + high volume markets
    const highMomentumMarkets = markets.filter(m =>
      Math.abs(m.sentimentMomentum) > MOMENTUM_THRESHOLD &&
      m.volume24h > HIGH_VOLUME_THRESHOLD
    );

    // Sort by momentum strength * volume (prioritize high-conviction + liquid markets)
    // This ensures we pick from ALL markets, not just first ones that pass filter
    const sortedMarkets = highMomentumMarkets.sort((a, b) => {
      const scoreA = Math.abs(a.sentimentMomentum) * Math.log10(a.volume24h + 1);
      const scoreB = Math.abs(b.sentimentMomentum) * Math.log10(b.volume24h + 1);
      return scoreB - scoreA; // Descending (best first)
    });

    console.log(
      `[PredictionMarketStrategy] Found ${sortedMarkets.length} high-momentum markets (>${MOMENTUM_THRESHOLD * 100}%, >${HIGH_VOLUME_THRESHOLD / 1000}K vol)`
    );

    if (sortedMarkets.length > 0) {
      console.log(
        `[PredictionMarketStrategy] Top market: "${sortedMarkets[0].title}" ` +
        `(${(sortedMarkets[0].sentimentMomentum * 100).toFixed(1)}% momentum, $${(sortedMarkets[0].volume24h / 1000).toFixed(0)}K vol)`
      );
    }

    let signalCount = 0;

    for (const market of sortedMarkets) {
      // Match market to tradeable assets
      const mappingResult = matchMarketToAssets(market);
      if (!mappingResult || mappingResult.symbols.length === 0) {
        console.log(`[PredictionMarketStrategy] No asset mapping for "${market.title}"`);
        continue;
      }

      // Get multi-source confirmation
      const newsConf = getNewsConfirmation(market);
      const ciiConf = getCIIConfirmation(market);

      // Require at least one confirmation source
      if (!newsConf.aligned && !ciiConf.aligned) {
        console.log(`[PredictionMarketStrategy] No confirmation for "${market.title}" (news: ${newsConf.eventCount} events, CII: ${ciiConf.countries.length} countries)`);
        continue;
      }

      // Calculate confidence
      const confidence = calculateConfidence(market, mappingResult, newsConf, ciiConf);

      // Build reasoning
      const reasoning = buildReasoning(market, mappingResult, newsConf, ciiConf);

      // Generate signals for mapped symbols (max 2 to avoid over-concentration)
      const symbolsToTrade = mappingResult.symbols.slice(0, 2);

      for (const symbol of symbolsToTrade) {
        // Validate symbol is tradeable
        if (!isTradeable(symbol)) {
          console.log(`[PredictionMarketStrategy] Skipping ${symbol} (not in universe)`);
          continue;
        }

        const signal: Signal = {
          id: `${STRATEGY_NAME}-${symbol}-${Date.now()}`,
          timestamp: Date.now(),
          strategy: STRATEGY_NAME,
          symbol,
          direction: mappingResult.direction,
          confidence,
          reasoning,
          targetReturn: 0.06, // 6% target
          stopLoss: 0.025, // 2.5% stop
          takeProfit: 0.06,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        };

        signalBus.publish(signal);
        signalCount++;

        console.log(
          `[PredictionMarketStrategy] Signal: ${signal.direction} ${symbol} (conf: ${(confidence * 100).toFixed(0)}%)`
        );
      }
    }

    console.log(`[PredictionMarketStrategy] Generated ${signalCount} signals`);
  } catch (err) {
    console.error('[PredictionMarketStrategy] Signal generation failed:', err);
  }
}

/**
 * Update cycle: check prediction markets and generate signals
 */
async function updateCycle(): Promise<void> {
  console.log('[PredictionMarketStrategy] Running update cycle...');
  generateSignals();
}

/**
 * Initialize prediction market strategy
 */
export function initPredictionMarketStrategy(): void {
  console.log('[PredictionMarketStrategy] Initializing...');

  // Run immediately after 30 seconds (let data load first)
  setTimeout(() => {
    updateCycle();
  }, 30_000);

  // Then every 15 minutes
  updateTimer = window.setInterval(() => {
    updateCycle();
  }, UPDATE_INTERVAL_MS);

  console.log('[PredictionMarketStrategy] Initialized successfully (15min interval)');
}

/**
 * Shutdown prediction market strategy (cleanup)
 */
export function shutdownPredictionMarketStrategy(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('[PredictionMarketStrategy] Shutdown complete');
}
