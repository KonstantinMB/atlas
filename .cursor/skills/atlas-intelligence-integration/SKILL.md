---
name: atlas-intelligence-integration
description: How intelligence modules (CII, convergence, anomaly) feed into trading. Use when connecting intelligence output to signals or panels.
---

# Intelligence → Trading Integration

## Modules (src/intelligence/)
- **instability.ts** — CII scores by country
- **convergence.ts** — Geographic event clustering (1° grid)
- **anomaly.ts** — Welford temporal baseline, Z-score alerts

## Data Flow
1. DataService fetches GDELT, USGS, ACLED, etc. via `/api/data/*`
2. Intelligence modules compute client-side (browser)
3. Results published to state or CustomEvents
4. Trading strategies subscribe: geopolitical (CII), sentiment (GDELT tone)

## State Keys
- `state.get('intelligence')` — CII, convergence, anomalies
- Events: panels subscribe to `intelligence:updated` or similar

## Panel Wiring
- country-instability.ts ← CII from instability.ts
- strategic-risk.ts ← composite from multiple sources
- signals panel ← trading signals (which consume intelligence)
