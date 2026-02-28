/**
 * Trading Coordinator
 * Initialises all strategies and wires price updates from the data service
 * to the trading engine.
 */

import { tradingEngine } from './engine';
import type { YahooDetail, CryptoDetail } from '../lib/data-service';
import { dataService } from '../lib/data-service';
import { initGeopoliticalStrategy } from './strategies/geopolitical';
import { initSentimentStrategy } from './strategies/sentiment';
import { fetchMacroData } from './strategies/macro';

export function initTradingEngine(): void {
  initGeopoliticalStrategy();
  initSentimentStrategy();
  void fetchMacroData();

  // Wire Yahoo Finance → engine price cache
  dataService.addEventListener('yahoo', (e: Event) => {
    const detail = (e as CustomEvent<YahooDetail>).detail;
    const priceMap: Record<string, number> = {};
    for (const quote of detail.quotes) {
      if (quote.price > 0) priceMap[quote.symbol] = quote.price;
    }
    tradingEngine.updatePrices(priceMap);
    window.dispatchEvent(new CustomEvent('price-feed-updated', {
      detail: { source: 'yahoo', count: Object.keys(priceMap).length, at: Date.now() },
    }));
  });

  // Wire CoinGecko crypto → engine price cache
  dataService.addEventListener('crypto', (e: Event) => {
    const detail = (e as CustomEvent<CryptoDetail>).detail;
    const priceMap: Record<string, number> = {};
    for (const coin of detail.prices) {
      if (coin.price > 0) {
        // Store by bare symbol (BTC) and Yahoo-style (BTC-USD)
        const sym = coin.symbol.toUpperCase();
        priceMap[sym] = coin.price;
        priceMap[`${sym}-USD`] = coin.price;
      }
    }
    tradingEngine.updatePrices(priceMap);
    window.dispatchEvent(new CustomEvent('price-feed-updated', {
      detail: { source: 'crypto', count: Object.keys(priceMap).length, at: Date.now() },
    }));
  });

  console.log('[Trading] Paper trading engine initialised');
}
