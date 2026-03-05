# YC Hedge Fund — Global Intelligence Platform

> AI-powered geopolitical intelligence dashboard with real-time data streams, client-side analytics, and paper trading capabilities.

**Live demo:** https://atlas-rouge-one.vercel.app

---

## Overview

YC Hedge Fund is a WorldMonitor-class intelligence dashboard built entirely with vanilla TypeScript and no frontend framework. It renders a 3D globe (deck.gl + MapLibre) overlaid with 12+ live data layers, runs a client-side intelligence engine (Country Instability Index, convergence detection, anomaly detection), and pairs it with a full paper trading engine that lets you watch geopolitical events translate directly into simulated trading signals and portfolio P&L.

The unique differentiator: the "Globe Risk Heatmap" makes your portfolio exposure **physically visible** — countries glow red when your paper positions are geopolitically exposed there, and flash yellow when a new signal fires for that region.

### Features
- Paper trading leaderboard (weekly, monthly, quarterly, yearly returns) at `/leaderboard`

---

## Setup

```bash
# 1. Clone
git clone https://github.com/KonstantinMB/atlas.git
cd atlas  # or yc-hedge-fund if repo is renamed

# 2. Install dependencies
npm install

# 3. Copy environment file and fill in your keys
cp .env.example .env

# 4. Start local dev server (Vite + Vercel edge functions)
npx vercel dev
```

The app will be available at `http://localhost:3000`. Edge functions run locally via the Vercel CLI.

For the WebSocket relay (real-time AIS vessel + aircraft streams), deploy the `/relay` directory to Railway and set `VITE_RELAY_URL` in your `.env`.

---

## Architecture

```
Browser (Vanilla TS + Vite)
├── deck.gl Globe (WebGL2, 12+ toggleable layers)
├── Intelligence Engine (CII, convergence, anomaly — all client-side)
├── Paper Trading Engine (signals → risk → broker → portfolio — all client-side)
│   ├── 5 signal strategies (Geopolitical, Sentiment, Momentum, Macro, Cross-Asset)
│   ├── RiskManager (10 pre-trade checks, CircuitBreaker)
│   └── PortfolioManager (localStorage + Upstash Redis persistence)
└── UI Panels (right sidebar, vanilla DOM)

Vercel Edge Functions (/api/)
├── /api/data/*     — GDELT, USGS, GDACS, EONET, ACLED, FIRMS
├── /api/market/*   — Finnhub, Yahoo Finance, CoinGecko, FRED, Fear&Greed
├── /api/osint/*    — OpenSky aircraft, AIS vessels, Polymarket, OpenSanctions
├── /api/rss/       — CORS-proxied RSS feeds (50+ sources)
├── /api/ai/        — Groq LLM summarize + sentiment
└── /api/trading/   — Portfolio state sync to Upstash Redis

Cache: 3-tier (in-memory LRU → Upstash Redis → upstream fetch, stale-on-error fallback)

Railway WebSocket Relay
└── AISStream.io vessels + OpenSky aircraft (multiplexed, auto-reconnect)
```

**No traditional database.** All state lives in Redis (ephemeral), localStorage (per-user), and static JSON baked into the build.

**No frontend framework.** The entire UI is direct DOM manipulation. Zero React, Vue, Angular, or Svelte. Bundle size: ~450 KB gzipped for app code (deck.gl + MapLibre are ~430 KB combined).

---

## Data Sources

### No API Key Required
| Source | Data | Update Frequency |
|--------|------|-----------------|
| GDELT | Global news events, tone scoring | 15 minutes |
| USGS | Earthquakes worldwide | Real-time |
| GDACS | Disaster alerts | 30 minutes |
| NASA EONET | Natural events | 1 hour |
| Yahoo Finance | Stock / forex / crypto quotes | 1 minute |
| alternative.me | Fear & Greed Index | 1 hour |
| Polymarket | Prediction market odds | 5 minutes |
| OpenSanctions | Global sanctions database | Daily |
| Google News RSS | 50+ topic feeds | 10 minutes |

### Free API Key Required
| Source | Data | Where to Register |
|--------|------|-------------------|
| Finnhub | Real-time US stock quotes | finnhub.io |
| CoinGecko | 10K+ crypto prices | coingecko.com/en/api |
| FRED | 816K economic indicators | fred.stlouisfed.org |
| Groq | LLM inference (Llama 3.1 8B) | console.groq.com |
| ACLED | Conflict event data | acleddata.com/register |
| NASA FIRMS | Satellite fire detection | firms.modaps.eosdis.nasa.gov |
| OpenSky | Aircraft positions | opensky-network.org |
| AISStream.io | Vessel AIS positions | aisstream.io |

---

## Paper Trading Strategies

### 1. Geopolitical Risk → Asset Mapping
Country Instability Index (CII) Z-scores are computed in real-time from GDELT, USGS, GDACS, and ACLED events. When a country's CII spikes beyond a threshold (default: +2σ), signals are generated for correlated ETFs via `geo-asset-mapping.json` — e.g. Iran instability → LONG USO (oil), SHORT JETS (airlines).

### 2. News Sentiment Momentum
GDELT global tone scores are aggregated by sector in a 4-hour rolling window. When the rolling tone crosses ±3.0 standard deviations, momentum signals fire for sector ETFs (XLE, XLK, XLF, etc.).

### 3. Macro Indicator Divergence
FRED economic series (yield curve spread, unemployment claims, CPI YoY) are polled every 6 hours. Inversions and threshold crossings trigger sector rotation signals — e.g. yield curve inversion → LONG TLT, SHORT QQQ.

### 4. Momentum Cross-Asset
Technical indicators (RSI, MACD, Bollinger Bands) computed client-side on Yahoo Finance price history. Signals fire on breakouts with volume confirmation.

### 5. Cross-Asset Consensus
Bayesian aggregation of the above four strategies. A consensus signal fires only when ≥ 3 strategies agree on direction for the same symbol, with combined confidence ≥ 80%.

### Risk Controls
Every signal passes through `RiskManager` before execution:
- Max 10% NAV per position
- Max 30% NAV per sector
- Max 5% daily loss → circuit breaker YELLOW
- Max 15% drawdown → circuit breaker RED (position sizing halved)
- Correlation limit: reject trades that increase portfolio beta above 1.5
- VaR95 daily limit: reject if new position pushes VaR > 3% NAV

### Paper Trading Configuration
```typescript
{
  startingCapital: 1_000_000,   // $1M paper capital
  maxPositionPct:  0.10,        // 10% per position
  maxSectorPct:    0.30,        // 30% per sector
  maxDailyLossPct: 0.05,        // 5% daily loss halt
  maxDrawdownPct:  0.15,        // 15% max drawdown
  slippageBps:     5,           // 0.05% simulated slippage
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Toggle Portfolio panel |
| `S` | Toggle Signals panel |
| `P` | Toggle Performance panel |
| `Space` | Pause / resume auto-trading |
| `Esc` | Kill switch — halt all trading (second Esc resets) |
| `⌘K` | Open command palette |

---

## Infrastructure

| Service | Provider | Plan | Cost |
|---------|----------|------|------|
| Frontend + Edge Functions | Vercel | Hobby (free) | $0 |
| WebSocket Relay | Railway | Pay-per-use | ~$5/mo |
| Cache + State | Upstash Redis | Pay-per-request | ~$0–10/mo |
| AI Inference | Groq | Free tier | $0 |
| **Total** | | | **$5–15/mo** |

---

## Development

```bash
npm run dev      # Vite dev server (frontend only, no edge functions)
npx vercel dev   # Full local dev with edge functions
npm run build    # Production build
npm run preview  # Preview production build locally
npx tsc --noEmit # Type-check without building
```

---

## License

MIT — built from scratch, inspired by the architecture of [WorldMonitor](https://github.com/koala73/worldmonitor) (AGPL-3.0, Elie Habib). No code was copied — architecture patterns only.
