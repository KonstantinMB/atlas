---
name: atlas-geopolitics-asset-mapping
description: Map geopolitical events (CII, conflicts, disasters) to tradeable ETF assets. Use when building or modifying geopolitical strategy, geo-asset-mapping, or CII-triggered signals in Atlas.
---

# Geopolitics → Asset Mapping

## Data Source
`/src/data/geo-asset-mapping.json` — country code → affected assets (ETFs, commodities).

## Flow
1. **CII spike** (instability.ts) → country Z-score > 2.0σ
2. **Lookup** geo-asset-mapping for that country
3. **Generate signals**: long safe havens (GLD, TLT), short regional ETFs
4. **Confidence**: `min(z_score / 3.0, 1.0)`

## Example
Russia CII spike → short ERUS, long GLD, long USO (oil)

## Integration
- Input: `src/intelligence/instability.ts` CII scores
- Output: `src/trading/signals/strategies/geopolitical.ts` signals
- Risk: risk-agent validates before execution
