---
name: atlas-paper-trading-flow
description: End-to-end paper trading flow in Atlas. Use when debugging execution, adding strategies, or wiring new signal types.
---

# Paper Trading Flow

## Components
- **engine.ts** — Core state, PAPER_CONFIG
- **portfolio-manager.ts** — Positions, P&L, equity curve, FIFO lots
- **paper-broker.ts** — Simulated fills (slippage, partial fills)
- **execution-loop.ts** — 60s cycle: prices → signals → risk → execute
- **server-sync.ts** — Debounce 5s → PUT /api/trading/portfolio

## Event Flow
1. `market-tick` → portfolioManager.updateMarkToMarket()
2. execution-loop runs → risk checks → paper-broker.execute()
3. portfolio-updated → server-sync schedules PUT
4. Panels listen to `portfolio-updated` for UI refresh

## Key Interfaces
- `Signal` (engine.ts): id, strategy, symbol, direction, confidence, stopLoss, takeProfit
- `ManagedPosition` (portfolio-manager): lots, avgCostPrice, unrealizedPnl
- `ClosedTrade`: realizedPnl, closeReason

## Auth
- Authenticated: server sync enabled, portfolio in Redis
- Local-only: localStorage only, "Sign up to save" banner
