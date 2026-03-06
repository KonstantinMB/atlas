# Atlas Prediction Markets — Prompt Strategy for Agent Implementation

## Quick Start (Orchestrator Prompt)

Use this to kick off the prediction markets feature with an agent:

```
I'm working on Project Atlas. Read CLAUDE.md for context.

Implement the prediction markets feature as described in docs/PREDICTION-MARKETS-PROMPT-STRATEGY.md.

Execute the prompts in order (1 → 2 → 3 → 4). Each prompt is self-contained. When you need my input, ask clearly and wait. Otherwise, build autonomously.

Start with Prompt 1 — Prediction Markets API & Data Layer.
```

---

## Overview

Add **advanced prediction market metrics** to Atlas, integrating Polymarket data into the situational awareness dashboard. The platform already has basic Polymarket probability bars via `api/osint/polymarket.ts`. This feature extends it with:

- **Historical probability trends** (24h sparklines)
- **24h trading volume** and **liquidity depth**
- **Sentiment momentum** (rate of change in Yes share prices) for the AI hedge fund decision engine
- **Unified TypeScript interfaces** for future Kalshi integration (MVP: Polymarket only)

**Architecture alignment**: Atlas uses **Vanilla TypeScript + Vite** (no React). Data flows via `DataService` (EventTarget + CustomEvents), `api-client` (TTL cache), and edge functions with 3-tier cache. Follow existing patterns in `src/lib/data-service.ts`, `api/osint/polymarket.ts`, and `src/panels/markets.ts`.

---

## Agent Delegation

| Phase | Agent | Scope |
|-------|-------|-------|
| 1 | **api-agent** | Edge functions, unified interfaces, Polymarket Gamma + CLOB |
| 2 | **data-agent** | DataService integration, polling, staleness |
| 3 | **intelligence-agent** | Sentiment momentum algorithm, signal inputs |
| 4 | **frontend-agent** | Prediction markets panel, sparklines, UI |

**Flow**: api-agent → data-agent → intelligence-agent → frontend-agent. Trading-agent consumes sentiment momentum via signal strategies (no new strategy in MVP; momentum feeds existing sentiment strategy).

---

## Unified TypeScript Interfaces

Define in `shared/prediction-markets.ts` (or `src/lib/prediction-markets.ts`):

```typescript
/** Normalized prediction market (Polymarket today; Kalshi later) */
export interface PredictionMarket {
  id: string;
  source: 'polymarket' | 'kalshi';
  title: string;
  probability: number;           // Yes share price 0–1
  volume24h: number;
  volumeTotal: number;
  liquidityDepth?: number;       // Best bid/ask depth if available
  category: string;
  endDate: number;
  outcomePrices: [number, number]; // [Yes, No]
}

/** Historical odds for sparklines and momentum */
export interface HistoricalOdds {
  marketId: string;
  points: { t: number; p: number }[];  // t=timestamp ms, p=Yes probability
  interval: '1h' | '6h' | '1d';
}

/** Aggregated metrics for decision engine */
export interface MarketMetrics {
  marketId: string;
  probability: number;
  volume24h: number;
  sentimentMomentum: number;     // ROC of Yes price over 24h (-1 to +1 scale)
  history24h: number[];          // Sparkline data points
  lastUpdated: number;
}
```

---

## Data Sources

### Polymarket Gamma API (existing)
- **URL**: `https://gamma-api.polymarket.com/events?limit=50&active=true`
- **Provides**: id, title, volume, endDate, markets[].outcomePrices
- **Cache**: 5 min (existing)

### Polymarket CLOB API (new)
- **URL**: `https://clob.polymarket.com/prices-history?market={assetId}&interval=1h`
- **Provides**: Historical Yes prices for sparklines
- **Mapping**: Gamma event.markets[0].conditionId or clobTokenIds → CLOB market param
- **Cache**: 5 min per market
- **Rate limit**: Public, no key; batch sparingly (top 10–15 markets)

---

## Sentiment Momentum Algorithm

**Definition**: Rate of change of Yes share price over 24 hours.

```
sentimentMomentum = (price_now - price_24h_ago) / max(price_24h_ago, 0.01)
```

Clamp to `[-1, 1]` for display. Positive = market moving toward "Yes", negative = toward "No".

**Use**: Feed into `trading-agent` sentiment strategy as an additional input. When `sentimentMomentum > 0.1` and GDELT tone is positive → boost confidence. When `sentimentMomentum < -0.1` and tone negative → boost SHORT confidence.

---

## Prompt Sequence (Run One at a Time)

### Prompt 1 — Prediction Markets API & Data Layer

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Extend the Polymarket edge function and add CLOB historical data.

1. **Unified interfaces** (shared/prediction-markets.ts or src/lib/prediction-markets.ts):
   - Define PredictionMarket, HistoricalOdds, MarketMetrics (see PREDICTION-MARKETS-PROMPT-STRATEGY.md)
   - Export types for use by api, data-service, and panels

2. **Extend api/osint/polymarket.ts**:
   - Add volume24h if Gamma API provides it (or derive from volume)
   - Add outcomePrices: [Yes, No] from markets[0].outcomePrices
   - Normalize to PredictionMarket interface
   - Keep 5-min cache, withCors, withCache

3. **Create api/osint/polymarket-history.ts** (new edge function):
   - GET /api/osint/polymarket-history?marketIds=id1,id2,id3
   - For each marketId, fetch CLOB: https://clob.polymarket.com/prices-history?market={id}&interval=1h
   - Parse history array [{t, p}], convert t (seconds) to ms
   - Return { histories: { [marketId]: { points: [...], interval: '1h' } } }
   - Cache 5 min per request (cache key includes marketIds)
   - Use withCors, withCache
   - Handle CLOB market ID mapping: Gamma returns conditionId or clobTokenIds; CLOB expects asset/token ID — verify Polymarket docs and map correctly

4. **Create api/osint/polymarket-metrics.ts** (aggregator):
   - GET /api/osint/polymarket-metrics
   - Fetches /api/osint/polymarket (or calls Gamma directly within edge)
   - For top 15 markets by volume, fetches CLOB history
   - Computes sentimentMomentum per market: (price_now - price_24h) / max(price_24h, 0.01), clamped [-1,1]
   - Returns { markets: MarketMetrics[], timestamp }
   - Cache 5 min

**Acceptance criteria**:
- GET /api/osint/polymarket returns PredictionMarket[] with volume24h, outcomePrices
- GET /api/osint/polymarket-metrics returns MarketMetrics[] with sentimentMomentum, history24h
- All edge functions use withCors, withCache, runtime: 'edge'
```

---

### Prompt 2 — DataService Integration

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Integrate prediction market metrics into DataService.

1. **Extend src/lib/data-service.ts**:
   - Add PredictionMarketDetail, MarketMetricsDetail interfaces (wrap API responses)
   - Add fetchPolymarketMetrics(): Promise<void>
     - Calls GET /api/osint/polymarket-metrics
     - Uses api.fetch with 300_000 TTL (5 min)
     - Stores in private polymarketMetrics: MarketMetricsDetail | null
     - Dispatches CustomEvent('polymarket-metrics', { detail })
   - Add getPolymarketMetrics(): MarketMetricsDetail | null
   - In startPolling(), add: setTimeout(() => void this.fetchPolymarketMetrics(), 5_000)
   - Add setInterval(() => void this.fetchPolymarketMetrics(), 300_000)

2. **Optional**: If basic Polymarket events are needed elsewhere, add fetchPolymarket() and 'polymarket' event. Otherwise, polymarket-metrics is sufficient (it aggregates).

**Acceptance criteria**:
- dataService.fetchPolymarketMetrics() fetches and dispatches 'polymarket-metrics'
- dataService.startPolling() includes Polymarket metrics every 5 min
- Panels can subscribe: dataService.addEventListener('polymarket-metrics', handler)
```

---

### Prompt 3 — Sentiment Momentum → Signal Engine

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Feed prediction market sentiment momentum into the trading signal engine.

1. **State store** (src/lib/state.ts):
   - Add key 'predictionMarkets' or extend 'intelligence' with predictionMarketMomentum
   - When polymarket-metrics event fires, update state with top markets' sentimentMomentum

2. **Sentiment strategy** (src/trading/signals/strategies/sentiment.ts):
   - Subscribe to prediction market metrics (via state or direct DataService listener)
   - When generating signals: if sector has related prediction market (e.g. Politics → election markets), use sentimentMomentum as confidence modifier:
     - momentum > 0.1: boost confidence by +0.05 (cap 0.95)
     - momentum < -0.1: for SHORT signals, boost confidence by +0.05
   - Add reasoning snippet: "Prediction market momentum: +X% (24h)" when used
   - Do NOT create a new strategy; only enhance existing sentiment strategy

3. **Intelligence integration** (optional, if intelligence-agent owns this):
   - Document in atlas-intelligence-integration skill: prediction markets as auxiliary sentiment input

**Acceptance criteria**:
- Sentiment strategy can read prediction market momentum from state
- When momentum aligns with GDELT tone, signal confidence increases
- Reasoning includes prediction market context when available
```

---

### Prompt 4 — Prediction Markets Panel

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Build the prediction markets panel in the right-side panel stack.

1. **New panel** (src/panels/prediction-markets.ts):
   - registerPanel({ id: 'prediction-markets', title: 'Prediction Markets', ... })
   - Subscribe to dataService 'polymarket-metrics' event
   - On data: render list of markets with:
     - Title (truncated)
     - Probability bar (Yes %)
     - 24h volume (formatted, e.g. $1.2M)
     - Mini sparkline (history24h, reuse buildMiniSparkline pattern from markets.ts)
     - Sentiment momentum badge: ▲ / ▼ / — with color (green/red/neutral)
   - Loading skeleton while fetching
   - Empty state: "No prediction market data"
   - Match dark theme: --bg-panel, --text-primary, --sentiment-positive, --sentiment-negative

2. **Styling** (src/styles/base.css):
   - .prediction-market-row, .prediction-prob-bar, .prediction-momentum-badge
   - Reuse .sparkline-mini from markets panel

3. **Panel registration** (src/panels/panel-manager.ts or wherever panels are registered):
   - Import and call initPredictionMarketsPanel()

4. **Nav**: Add "Prediction Markets" to panel tabs if there's a tab list, or ensure it appears in the panel stack.

**Acceptance criteria**:
- Prediction markets panel renders with probability bars, volume, sparklines, momentum
- Data updates when polymarket-metrics event fires (every 5 min)
- Matches platform aesthetic (dark, JetBrains Mono for numbers)
- Responsive layout
```

---

## Verification Checklist

After all prompts are run:

- [ ] GET /api/osint/polymarket returns extended PredictionMarket
- [ ] GET /api/osint/polymarket-metrics returns MarketMetrics with sentimentMomentum
- [ ] DataService fetches and dispatches polymarket-metrics
- [ ] Sentiment strategy uses momentum when available
- [ ] Prediction markets panel renders with sparklines and momentum badges
- [ ] CLAUDE.md updated with new API routes and panel

---

## Skills & Rules

- **Skill**: `.cursor/skills/atlas-prediction-markets/SKILL.md` — Prediction market data flow, interfaces, momentum formula
- **Rule**: Ensure api-agent and data-agent follow edge-functions.mdc and atlas-conventions.mdc

---

## Kalshi (Future)

Architecture is extensible. When adding Kalshi:
- Add `api/osint/kalshi.ts` with same PredictionMarket normalization
- Extend polymarket-metrics aggregator to merge Polymarket + Kalshi (or create kalshi-metrics)
- DataService fetches both, merges by category or source
- Kalshi requires API key — document in .env.example
