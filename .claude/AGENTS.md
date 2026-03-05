# Atlas Agent Roster

## Orchestrator
**orchestrator-agent** — Plans work, delegates to specialists, enforces execution order. Use for multi-phase features (e.g. leaderboard).

## Specialists

| Agent | Scope | Key Paths |
|-------|-------|-----------|
| **api-agent** | Edge functions, auth, caching, data adapters | `api/` |
| **frontend-agent** | Globe, panels, UI, charts, routing | `src/globe/`, `src/panels/`, `src/styles/`, `src/auth/` |
| **trading-agent** | Signals, portfolio, execution, strategies | `src/trading/` |
| **data-agent** | Market data, WebSocket, staleness, backfill | `src/trading/data/`, `api/market/` |
| **risk-agent** | Pre-trade checks, circuit breakers, VaR, audit | `src/trading/risk/` |
| **intelligence-agent** | CII, convergence, anomaly, surge | `src/intelligence/` |
| **infra-agent** | Vercel, Railway, build, CI/CD | `vercel.json`, `package.json`, `relay/` |

## Execution Flow (MUST follow)
1. data-agent → prices
2. intelligence-agent → CII, convergence, anomalies
3. trading-agent → signals
4. risk-agent → validate (GATEKEEPER)
5. trading-agent → execute
6. frontend-agent → render

## Rules (.cursor/rules/)
- atlas-conventions.mdc — always apply
- financial-calculations.mdc — trading, intelligence, performance
- edge-functions.mdc — api/

## Skills (.cursor/skills/)
- atlas-geopolitics-asset-mapping — CII → geo-asset-mapping → signals
- atlas-paper-trading-flow — engine → portfolio → server-sync
- atlas-intelligence-integration — intelligence modules → strategies
