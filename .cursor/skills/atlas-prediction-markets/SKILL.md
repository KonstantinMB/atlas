---
name: atlas-prediction-markets
description: Prediction market data flow, Polymarket integration, sentiment momentum. Use when adding prediction markets, extending Polymarket API, or wiring momentum into signals.
---

# Prediction Markets Integration

## Data Flow
1. **api/osint/polymarket.ts** — Gamma API, basic events (existing)
2. **api/osint/polymarket-history.ts** — CLOB prices-history for sparklines
3. **api/osint/polymarket-metrics.ts** — Aggregates Gamma + CLOB, computes sentimentMomentum
4. **DataService** — fetchPolymarketMetrics(), dispatches 'polymarket-metrics'
5. **Panels** — Subscribe to event, render probability bars + sparklines + momentum
6. **Sentiment strategy** — Reads momentum from state, boosts confidence when aligned with GDELT tone

## Key Interfaces (shared or src/lib)
- `PredictionMarket` — id, probability, volume24h, category, endDate, outcomePrices
- `MarketMetrics` — marketId, probability, volume24h, sentimentMomentum, history24h
- `HistoricalOdds` — marketId, points: {t, p}[], interval

## Sentiment Momentum Formula
```
momentum = (price_now - price_24h_ago) / max(price_24h_ago, 0.01)
```
Clamp to [-1, 1]. Positive = moving toward Yes, negative = toward No.

## Polymarket APIs
- **Gamma**: `gamma-api.polymarket.com/events` — events, outcomePrices, volume
- **CLOB**: `clob.polymarket.com/prices-history?market={id}&interval=1h` — historical Yes prices
- Map Gamma market conditionId/clobTokenIds → CLOB market param

## Integration Points
- **State**: `state.set('predictionMarkets', metrics)` when polymarket-metrics fires
- **Sentiment strategy**: Check momentum; if > 0.1 or < -0.1, modify confidence
- **Panel**: dataService.addEventListener('polymarket-metrics', ...)

## Reference
- Full prompt strategy: docs/PREDICTION-MARKETS-PROMPT-STRATEGY.md
