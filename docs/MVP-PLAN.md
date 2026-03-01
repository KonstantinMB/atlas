# YC Hedge Fund — MVP Implementation Plan

## The $50/mo Intelligence Platform with Paper Trading

**Built from scratch. No forks. 100% public data. WorldMonitor-class frontend with hedge fund foundations.**

---

## Philosophy: Copy the Architecture, Not the Code

Elie Habib proved the model works at ~$50–100/mo:

| Component | WorldMonitor | Our Cost | Notes |
|-----------|-------------|----------|-------|
| Frontend hosting | Vercel (free/Pro $20) | $0–20/mo | Same approach — Vercel Edge Functions |
| WebSocket relay | Railway (~$5–15) | $5–15/mo | Same — for AIS, OpenSky, blocked feeds |
| Cache + state | Upstash Redis (~$5–20) | $5–20/mo | Same — 3-tier cache, Welford baselines |
| AI summarization | Groq free + OpenRouter | $0–20/mo | Same — dedup via Redis, browser fallback |
| Database | **None** | **None for MVP** | Same — Redis + static JSON + client compute |
| Map tiles | MapTiler/MapLibre (free) | $0 | Same — free open-source tiles |
| Data sources | 100% public APIs | $0–10/mo | Same — GDELT, USGS, RSS, Finnhub free tier |
| **Total MVP** | | **$10–85/mo** | |

The key insight: **WorldMonitor has NO traditional database.** All intelligence computation runs client-side. Static datasets (military bases, nuclear sites, cables, pipelines) are JSON baked into the build. Dynamic data is fetched from public APIs, cached in Redis, and computed in the browser. We follow the exact same pattern for MVP, then layer in TimescaleDB/Kafka only when paper trading needs persistent state.

---

## What We're Building (MVP Scope)

### The View: WorldMonitor-class intelligence dashboard
- Interactive 3D globe (deck.gl + MapLibre) with 20+ data layers
- Real-time news aggregation from 50+ RSS feeds with AI classification
- Country Instability Index, convergence detection, anomaly alerting
- Military tracking (AIS vessels, ADS-B aircraft)
- Financial markets panel (quotes, crypto, Fear & Greed)
- AI-generated intelligence briefs

### The Edge: Hedge fund foundations baked in from day one
- Paper trading engine (fully mock — simulated portfolio with $1M starting capital)
- Signal visualization (sentiment scores, geopolitical risk → market impact mapping)
- Strategy performance dashboard (equity curves, drawdown, Sharpe ratio)
- Mock trade history with P&L attribution
- Risk exposure heatmap overlaid on the intelligence globe

### What's NOT in MVP
- Real broker connections (no Alpaca, no IB, no CCXT)
- Kafka event streaming (overkill for MVP — use Redis pub/sub)
- TimescaleDB/ClickHouse (not needed until we have persistent backtesting)
- ML model training pipeline (use pre-computed mock signals)
- User authentication (single-user desktop/local first)

---

## Repository Structure

```
atlas/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # ESLint + TypeCheck + Vitest
│       └── deploy.yml                 # Vercel auto-deploy on main
├── api/                               # Vercel Edge Functions (serverless)
│   ├── _cors.ts                       # CORS middleware
│   ├── _cache.ts                      # 3-tier cache (memory → Redis → upstream)
│   ├── rss/
│   │   ├── proxy.ts                   # Domain-allowlisted RSS proxy
│   │   └── feeds.json                 # 50+ feed definitions with tiers
│   ├── data/
│   │   ├── gdelt.ts                   # GDELT GKG + Events adapter
│   │   ├── usgs.ts                    # Earthquake data
│   │   ├── acled.ts                   # Conflict events (free tier)
│   │   ├── firms.ts                   # NASA fire detection
│   │   ├── gdacs.ts                   # Global disasters
│   │   └── eonet.ts                   # NASA natural events
│   ├── market/
│   │   ├── finnhub.ts                 # Stock quotes (60 req/min free)
│   │   ├── coingecko.ts              # Crypto prices
│   │   ├── yahoo.ts                   # Fallback market data
│   │   ├── fred.ts                    # Economic indicators
│   │   ├── fear-greed.ts             # Market sentiment index
│   │   └── stablecoins.ts            # Peg monitoring
│   ├── osint/
│   │   ├── opensky.ts                 # Aircraft positions (via Railway relay)
│   │   ├── ais.ts                     # Vessel positions (via Railway relay)
│   │   ├── sanctions.ts              # OpenSanctions bulk
│   │   └── polymarket.ts             # Prediction markets
│   ├── ai/
│   │   ├── summarize.ts              # LLM brief generation (Groq → fallback)
│   │   ├── classify.ts               # Threat classification
│   │   └── sentiment.ts              # News sentiment scoring
│   └── trading/                       # Paper trading API
│       ├── portfolio.ts               # Mock portfolio state
│       ├── signals.ts                 # Generated signals endpoint
│       ├── execute.ts                 # Paper order execution
│       └── performance.ts            # Strategy metrics
├── relay/                             # Railway WebSocket relay server
│   ├── index.ts                       # Express + WebSocket server
│   ├── ais-stream.ts                 # AISStream.io multiplexer
│   ├── opensky-auth.ts               # OpenSky OAuth2 proxy
│   ├── rss-blocked.ts                # Proxy for Vercel-blocked feeds
│   └── railway.toml                   # Railway config
├── src/                               # Frontend source (Vite + vanilla TS)
│   ├── index.html
│   ├── main.ts                        # App entry, layer registration
│   ├── styles/
│   │   ├── base.css                   # CSS variables, dark theme
│   │   ├── panels.css                 # Side panel layouts
│   │   ├── globe.css                  # Map container styles
│   │   └── trading.css                # Trading-specific UI
│   ├── globe/                         # deck.gl globe + layers
│   │   ├── globe.ts                   # Globe initialization (deck.gl + MapLibre)
│   │   ├── layers/
│   │   │   ├── conflicts.ts           # Conflict zone polygons
│   │   │   ├── bases.ts               # Military base markers (220+)
│   │   │   ├── nuclear.ts             # Nuclear facility markers
│   │   │   ├── cables.ts              # Undersea cable lines
│   │   │   ├── pipelines.ts           # Oil/gas pipeline lines
│   │   │   ├── datacenters.ts         # AI datacenter markers
│   │   │   ├── vessels.ts             # AIS ship positions
│   │   │   ├── aircraft.ts            # ADS-B military flights
│   │   │   ├── events.ts              # Protests, disasters, earthquakes
│   │   │   ├── fires.ts               # NASA FIRMS satellite fire detection
│   │   │   ├── chokepoints.ts         # 8 strategic maritime chokepoints
│   │   │   ├── financial-centers.ts   # Stock exchanges, central banks
│   │   │   └── risk-heatmap.ts        # 🆕 Geopolitical risk → market overlay
│   │   └── controls.ts               # Layer toggles, zoom presets
│   ├── panels/                        # Right-side intelligence panels
│   │   ├── panel-manager.ts           # Panel layout, resize, collapse
│   │   ├── news-feed.ts              # Real-time news with clustering
│   │   ├── ai-insights.ts            # LLM-generated briefs
│   │   ├── country-instability.ts    # CII rankings
│   │   ├── strategic-risk.ts          # Composite risk gauge (0-100)
│   │   ├── intel-feed.ts             # Classified threat events
│   │   ├── infrastructure.ts          # Infrastructure cascade monitoring
│   │   ├── markets.ts                 # 🆕 Financial markets panel
│   │   ├── signals.ts                 # 🆕 Trading signals with confidence
│   │   └── portfolio.ts              # 🆕 Paper portfolio P&L
│   ├── trading/                       # 🆕 Paper trading engine (client-side)
│   │   ├── engine.ts                  # Core paper trading state machine
│   │   ├── portfolio.ts              # Position tracking, P&L calculation
│   │   ├── signals.ts                # Signal generation from intelligence
│   │   ├── strategies/
│   │   │   ├── geopolitical.ts        # Geo risk → asset mapping
│   │   │   ├── sentiment.ts           # News sentiment momentum
│   │   │   └── macro.ts              # Economic indicator signals
│   │   ├── risk.ts                    # Position limits, drawdown tracking
│   │   └── mock-data.ts              # Pre-generated realistic mock trades
│   ├── intelligence/                  # Client-side analytics (from WorldMonitor)
│   │   ├── instability.ts            # Country Instability Index
│   │   ├── convergence.ts            # Geographic event convergence
│   │   ├── anomaly.ts                # Welford's temporal baseline
│   │   ├── surge.ts                   # Military surge detection
│   │   └── cascade.ts                # Infrastructure cascade model
│   ├── lib/
│   │   ├── cache.ts                   # Client-side request cache
│   │   ├── websocket.ts              # WebSocket connection manager
│   │   ├── geo.ts                     # Geo utilities (haversine, grid binning)
│   │   ├── formatters.ts             # Number/date/currency formatting
│   │   └── state.ts                   # Simple reactive state store
│   └── data/                          # Static datasets (baked into build)
│       ├── military-bases.json        # 220+ bases with coordinates
│       ├── nuclear-facilities.json    # Global nuclear sites
│       ├── undersea-cables.json       # Cable routes as GeoJSON
│       ├── pipelines.json             # Oil/gas pipeline routes
│       ├── datacenters.json           # Major AI/cloud datacenters
│       ├── chokepoints.json           # 8 strategic maritime chokepoints
│       ├── conflict-zones.json        # Active conflict polygons
│       ├── financial-centers.json     # 🆕 Exchanges, central banks, hubs
│       ├── geo-asset-mapping.json     # 🆕 Country/region → affected assets
│       └── rss-feeds.json            # Feed URLs, tiers, categories
├── scripts/
│   ├── setup.sh                       # One-command dev environment setup
│   ├── generate-mock-trades.ts        # Generate realistic paper trade history
│   └── scrape-static-data.ts         # Refresh static datasets from sources
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vercel.json                        # Edge function routing
├── .env.example                       # All API keys with registration links
└── README.md
```

### Why Vanilla TypeScript (No React)?

Following WorldMonitor exactly: **hand-crafted DOM manipulation keeps the bundle at ~250KB gzipped.** React/Next.js would add 150KB+ before a single component renders. For a real-time dashboard pushing thousands of data points per second, framework overhead matters. When we later add the full hedge fund backend (Phase 2+), we can wrap this in a Next.js shell.

---

## Data Sources — Every Single One Public & Free

### Tier 1: No API Key Required (works immediately)

| Source | Data | Endpoint | Update Freq | Parser |
|--------|------|----------|-------------|--------|
| **GDELT** | Global news events + tone scores | `api.gdeltproject.org/api/v2/doc/doc` | 15 min | JSON |
| **USGS** | Earthquakes worldwide | `earthquake.usgs.gov/fdsnws/event/1/query` | Real-time | GeoJSON |
| **GDACS** | Global disaster alerts | `gdacs.org/xml/rss.xml` | Hourly | XML/RSS |
| **NASA EONET** | Natural events (volcanoes, storms) | `eonet.gsfc.nasa.gov/api/v3/events` | Daily | JSON |
| **Google News RSS** | 50+ topic/region news feeds | `news.google.com/rss/topics/*` | ~5 min | RSS/XML |
| **mempool.space** | Bitcoin hashrate, fees, blocks | `mempool.space/api/*` | Real-time | JSON |
| **alternative.me** | Crypto Fear & Greed Index | `api.alternative.me/fng/` | Daily | JSON |
| **Yahoo Finance** | Stock quotes, forex, indices | `query1.finance.yahoo.com/*` | ~15 sec | JSON |
| **Stooq** | Historical EOD prices (any ticker) | `stooq.com/q/d/l/?s={ticker}&d1=...` | Daily | CSV |
| **BLS** | US employment, CPI, inflation | `api.bls.gov/publicAPI/v2/timeseries/data/` | Monthly | JSON |
| **World Bank** | Global economic indicators | `api.worldbank.org/v2/country/*` | Quarterly | JSON |
| **UN Comtrade** | Bilateral trade flows | `comtradeapi.un.org/public/v1/preview/*` | Monthly | JSON |
| **Polymarket** | Prediction market odds | `gamma-api.polymarket.com/events` | Real-time | JSON |
| **OpenSanctions** | Global sanctions bulk data | `data.opensanctions.org/datasets/latest/*` | Daily | JSON/CSV |
| **CIA Factbook** | Country profiles (JSON) | `github.com/factbook/factbook.json` | Weekly | JSON |
| **CFTC COT** | Futures positioning reports | `cftc.gov/dea/newcot/deafut.txt` | Weekly | CSV |

### Tier 2: Free API Key Required (register once, free forever)

| Source | Data | Free Tier | Key Signup |
|--------|------|-----------|------------|
| **Finnhub** | Real-time US quotes, news, fundamentals | 60 req/min | finnhub.io |
| **CoinGecko** | Crypto market data (10K+ coins) | 30 req/min | coingecko.com/api |
| **FRED** | 816K+ economic time series | 120 req/min | fred.stlouisfed.org |
| **SEC EDGAR** | All public company filings (XBRL) | 10 req/sec | Just set User-Agent header |
| **OpenSky** | Live aircraft positions | ~100 req/day | opensky-network.org |
| **AISStream.io** | Live vessel AIS positions (WebSocket) | Unlimited WS | aisstream.io |
| **NASA FIRMS** | Satellite fire detection | 10 req/min | firms.modaps.eosdis.nasa.gov |
| **ACLED** | Conflict events (200+ countries) | 5000 rows/req | acleddata.com |
| **Groq** | LLM inference (Llama 3.1 8B) | 14.4K tokens/min | console.groq.com |
| **Cloudflare Radar** | Internet disruptions | 25 req/5min | radar.cloudflare.com |
| **EIA** | US energy data (oil, gas, electric) | 9000 req/hr | eia.gov |
| **Congress.gov** | US legislation tracking | 5000 req/hr | api.congress.gov |
| **openFDA** | Drug approvals, adverse events | 240 req/min | api.fda.gov |

### Tier 3: Paid but Cheap (optional for MVP)

| Source | Data | Cost | Worth It? |
|--------|------|------|-----------|
| **ADS-B Exchange** (RapidAPI) | Military/gov aircraft | $10/mo | Yes — unique data |
| **Finnhub Premium** | WebSocket real-time + more endpoints | $25/mo | Phase 2 |
| **Polygon.io Starter** | Delayed US market data | $29/mo | Phase 2 |

**Total data cost for MVP: $0–10/mo** (all Tier 1 + Tier 2 free keys)

---

## Paper Trading Engine Design

### Core Concept: Client-Side Simulation

The paper trading engine runs entirely in the browser, just like WorldMonitor's intelligence compute. No backend database required. State persists in `localStorage` + Redis (for cross-session on deployed version).

```
┌─────────────────────────────────────────────────────────┐
│  INTELLIGENCE LAYER (existing WorldMonitor-style)        │
│  News events, CII scores, convergence, anomalies         │
└──────────────────┬──────────────────────────────────────┘
                   │ signals
┌──────────────────▼──────────────────────────────────────┐
│  SIGNAL GENERATOR                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Geo Risk →   │ │ Sentiment →  │ │ Macro Indicator  │ │
│  │ Asset Mapper  │ │ Momentum     │ │ → Sector Rotation│ │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
│         └────────────────┼──────────────────┘            │
│                          │ scored signals (-1 to +1)      │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  PAPER TRADING ENGINE (client-side)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ Risk Manager │ │ Order Engine │ │ Portfolio Tracker │ │
│  │ Position lim │ │ Simulated    │ │ P&L, Sharpe,      │ │
│  │ Drawdown cap │ │ fills w/     │ │ drawdown, alpha   │ │
│  │ Sector caps  │ │ slippage     │ │ vs benchmarks     │ │
│  └─────────────┘ └──────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Starting Capital & Rules

```typescript
const PAPER_CONFIG = {
  startingCapital: 1_000_000,        // $1M paper money
  maxPositionPct: 0.10,              // 10% max single position
  maxSectorPct: 0.30,               // 30% max sector exposure
  maxDailyLossPct: 0.05,            // 5% daily loss = halt
  maxDrawdownPct: 0.15,             // 15% drawdown = reduce size 50%
  slippageBps: 5,                    // 0.05% simulated slippage
  commissionPerTrade: 0,             // Commission-free (Alpaca model)
  rebalanceFrequency: '1h',          // Check signals every hour
};
```

### Three MVP Strategies

**Strategy 1: Geopolitical Risk → Asset Mapping**
- When CII score for a country rises above 2.0 Z-score → trigger
- Look up affected assets in `geo-asset-mapping.json`
- Example: Iran CII spike → long crude oil (USO), short airlines (JETS)
- Position size proportional to Z-score magnitude

**Strategy 2: News Sentiment Momentum**
- GDELT tone scores aggregated per sector/country per hour
- When 4-hour rolling sentiment drops below -3.0 for a sector → short signal
- When it rises above +3.0 → long signal
- Use Finnhub to get current sector ETF prices for paper P&L

**Strategy 3: Macro Indicator Divergence**
- FRED data: yield curve (2s10s spread), unemployment claims, CPI
- When yield curve inverts beyond -0.5% → defensive rotation (long TLT, short SPY)
- When claims spike >10% week-over-week → risk-off signal
- Monthly rebalance based on macro regime classification

### Mock Data Generation

For the MVP showcase, we pre-generate 12 months of realistic paper trading history:

```typescript
// scripts/generate-mock-trades.ts
// Generates ~500 trades over 12 months with realistic:
// - Entry/exit prices based on real historical data (Stooq free CSVs)
// - P&L distribution matching typical systematic strategy (~55% win rate)
// - Drawdown periods that look realistic (not monotonically increasing)
// - Sector rotation visible in position history
// - Geopolitical event correlation (trades cluster around real events)

// Output: src/data/mock-trades.json (~200KB)
// Contains: trades[], dailyEquityCurve[], monthlyReturns[], positionHistory[]
```

This mock data powers the trading dashboard from day one. When live signal generation is added later, it replaces mock data with real signals — same visualization, same P&L engine.

---

## Implementation Phases (Detailed Week-by-Week)

### Phase 0: Foundation (Days 1–3)

**Day 1: Repository + Tooling**
```bash
# Initialize
mkdir atlas && cd atlas
npm init -y
npm install -D typescript vite @types/node vitest eslint
npm install deck.gl @deck.gl/core @deck.gl/layers @deck.gl/geo-layers
npm install maplibre-gl @deck.gl/mapbox
npm install @upstash/redis

# Git setup
git init
gh repo create atlas --private --source=.
```

Create: `vite.config.ts`, `tsconfig.json`, `vercel.json`, `.env.example`, `.eslintrc.js`, CI workflow.

**Day 2: Infrastructure Provisioning**
1. **Vercel**: Connect GitHub repo, configure Edge Functions directory (`/api`)
2. **Upstash Redis**: Create database (free tier: 10K commands/day)
3. **Railway**: Create project for WebSocket relay
4. Register free API keys: Finnhub, CoinGecko, FRED, OpenSky, AISStream.io, Groq, NASA FIRMS

**Day 3: Base Architecture**
- `api/_cors.ts` — CORS allowlist (our domains + localhost)
- `api/_cache.ts` — 3-tier caching (in-memory Map → Upstash Redis → upstream fetch)
- `src/main.ts` — App shell with dark theme CSS variables
- `src/lib/state.ts` — Simple reactive store (like WorldMonitor's pattern)
- `src/lib/websocket.ts` — WebSocket connection manager with auto-reconnect

**Deliverable: `npm run dev` serves a dark-themed shell. `vercel dev` runs edge functions locally.**

---

### Phase 1: Globe + Static Layers (Week 1)

**Goal: Interactive 3D globe with all static data layers**

The globe is the centerpiece. We build it first because it's the most visually impressive and validates the entire frontend architecture.

**Day 1–2: deck.gl Globe**
```typescript
// src/globe/globe.ts
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer, ArcLayer, IconLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';

// Dark map style (free, no Mapbox license)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Initialize deck.gl with MapLibre base
const deck = new Deck({
  canvas: 'deck-canvas',
  initialViewState: {
    longitude: 30, latitude: 25, zoom: 2.5,
    pitch: 35, bearing: 0
  },
  controller: true,
  layers: [] // Built up progressively
});
```

**Day 3–4: Static Data Layers**
Build each as a toggleable layer class:

| Layer | deck.gl Type | Data Source | Markers |
|-------|-------------|------------|---------|
| Military Bases (220+) | `IconLayer` | `military-bases.json` | Color by country alliance |
| Nuclear Facilities | `IconLayer` | `nuclear-facilities.json` | Icon by type (reactor/enrichment/waste) |
| Undersea Cables | `GeoJsonLayer` (lines) | `undersea-cables.json` | Color by owner |
| Pipelines | `GeoJsonLayer` (lines) | `pipelines.json` | Color by commodity (oil/gas) |
| Conflict Zones | `GeoJsonLayer` (polygons) | `conflict-zones.json` | Red fill with opacity |
| AI Datacenters | `ScatterplotLayer` | `datacenters.json` | Size by capacity |
| Strategic Chokepoints | `IconLayer` | `chokepoints.json` | Warning markers |
| Financial Centers | `IconLayer` | `financial-centers.json` | 🆕 Exchange/bank markers |

**Day 5: Layer Toggle UI**
Left sidebar with checkboxes (same as WorldMonitor's LAYERS panel):
```
☑ INTEL HOTSPOTS     ☑ CONFLICT ZONES
☑ MILITARY BASES     ☑ NUCLEAR SITES
☐ GAMMA IRRADIATORS  ☐ SPACEPORTS
☐ UNDERSEA CABLES    ☐ PIPELINES
☑ AI DATA CENTERS    ☑ MILITARY ACTIVITY
☐ SHIP TRAFFIC       ☐ TRADE ROUTES
☑ FINANCIAL CENTERS  ☑ RISK HEATMAP     ← NEW
```

**Deliverable: Full interactive globe with 12+ toggleable static layers, zoom presets (Global, Americas, Europe, MENA, Asia), dark theme.**

---

### Phase 2: Live Data + News (Weeks 2–3)

**Week 2: Edge Function Data Adapters**

Build one edge function per data source, following WorldMonitor's pattern:

```typescript
// api/data/gdelt.ts — Example edge function
import { cache } from '../_cache';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return cache('gdelt:latest', 900, async () => { // 15-min cache
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=&mode=ArtList&maxrecords=75&format=json&sort=DateDesc';
    const res = await fetch(url);
    const data = await res.json();
    // Normalize: extract title, url, tone, sourceCountry, seenDate, domain
    return data.articles?.map(normalizeGdeltArticle) || [];
  });
}
```

Build adapters for: GDELT, USGS, GDACS, NASA EONET, NASA FIRMS, Finnhub (quotes), CoinGecko, FRED (10 key series), Fear & Greed Index, Yahoo Finance (fallback), Polymarket.

**Week 2: News Feed Panel**
- Aggregate 50+ RSS feeds via the RSS proxy edge function
- Client-side clustering by topic (keyword matching, like WorldMonitor)
- Source tier badges (Tier 1: Reuters/AP, Tier 2: major outlets, Tier 3: regional, Tier 4: blogs)
- Tone coloring from GDELT (-10 red → 0 neutral → +10 green)
- Virtual scrolling for 100+ items (only render visible DOM nodes)

**Week 3: Markets Panel + Financial Data**
- Stock indices: S&P 500, NASDAQ, Dow, FTSE, Nikkei, Shanghai (Yahoo Finance)
- Forex: EUR/USD, GBP/USD, USD/JPY, USD/CNY (Yahoo Finance)
- Crypto: BTC, ETH, SOL + Fear & Greed (CoinGecko + alternative.me)
- Commodities: Oil (WTI/Brent), Gold, Natural Gas (Yahoo Finance)
- Bonds: US 10Y yield, 2s10s spread (FRED)
- Stablecoin peg monitoring: USDT, USDC deviation (CoinGecko)
- Mini sparkline charts (SVG, last 24h, same as WorldMonitor's approach)

**Deliverable: Globe with live earthquake/disaster markers, real-time news feed, financial markets panel, all data updating automatically.**

---

### Phase 3: Intelligence Engine (Week 4)

**Port WorldMonitor's analytics to our codebase (all client-side JS):**

**Country Instability Index (CII)**
```typescript
// src/intelligence/instability.ts
// 4-component weighted score (0-100):
// - Unrest (25%): ACLED protests + GDELT protest tone
// - Conflict (25%): ACLED battles/violence + UCDP baseline floors
// - Security (25%): GDELT terrorism keywords + sanctions count
// - Information (25%): Cloudflare Radar disruptions + press freedom proxy

// Regime-aware: logarithmic for democracies, linear for authoritarian
// 90-day rolling Welford baseline for Z-score anomalies
```

**Geographic Convergence Detection**
```typescript
// src/intelligence/convergence.ts
// Bin events into 1°×1° cells, 24-hour windows
// Alert when 3+ distinct event types converge
// Types: military, protest, conflict, sanctions, disaster, infrastructure, political
```

**Temporal Anomaly Detection**
```typescript
// src/intelligence/anomaly.ts
// Welford's online algorithm: streaming mean/variance
// Per (event_type, region, weekday, month) over 90-day window
// Thresholds: 1.5 (notable), 2.0 (significant), 3.0 (critical)
// State persisted in Redis via Upstash between sessions
```

**AI Insights Panel**
- Groq LLM generates 2-sentence briefs every 2 minutes
- Redis deduplication: hash headlines, skip duplicates
- Fallback chain: Groq → OpenRouter → browser T5 (same as WorldMonitor)
- Classified by: CRITICAL / HIGH / MEDIUM / LOW / INFO

**Deliverable: Full intelligence dashboard with CII scores, anomaly alerts, convergence detection, AI briefs — matching WorldMonitor's analytical depth.**

---

### Phase 4: Paper Trading + Signals (Weeks 5–6)

**Week 5: Signal Generation**

Three signal generators that consume intelligence data:

```typescript
// src/trading/signals.ts
interface Signal {
  id: string;
  timestamp: number;
  strategy: 'geopolitical' | 'sentiment' | 'macro';
  direction: 'long' | 'short';
  asset: string;           // Ticker symbol
  assetName: string;       // Human-readable
  confidence: number;      // 0 to 1
  score: number;           // -1 to +1
  reasoning: string;       // Why this signal
  triggerEvent?: string;   // What intelligence event triggered it
  triggerCountry?: string; // Associated country
  expiresAt: number;       // Signal expiry (24h default)
}
```

**Geopolitical Strategy Signal Flow:**
```
CII for Iran > 2.0 Z-score
  → lookup geo-asset-mapping.json
  → find: { "Iran": {
       "long": ["USO", "XLE", "LMT"],
       "short": ["JETS", "DAL", "AAL"],
       "confidence_base": 0.6
     }}
  → emit signals for each affected asset
  → confidence = base × Z-score_magnitude / 3
```

**Sentiment Strategy Signal Flow:**
```
GDELT 4-hour rolling tone for "Technology" sector = -4.2
  → below threshold of -3.0
  → emit SHORT signal for QQQ (tech ETF)
  → confidence = abs(tone) / 10
```

**Week 5: Paper Trading Engine**

```typescript
// src/trading/engine.ts
class PaperTradingEngine {
  private portfolio: Portfolio;
  private riskManager: RiskManager;
  private tradeHistory: Trade[];

  constructor() {
    this.portfolio = {
      cash: 1_000_000,
      positions: new Map(),
      totalValue: 1_000_000,
      dailyPnL: 0,
      totalPnL: 0,
      maxDrawdown: 0,
      highWaterMark: 1_000_000,
    };
  }

  processSignal(signal: Signal): Trade | null {
    // 1. Risk check
    if (!this.riskManager.canTrade(signal, this.portfolio)) return null;

    // 2. Calculate position size (Kelly-inspired, capped)
    const size = this.calculatePositionSize(signal);

    // 3. Get current price (from markets panel data)
    const price = this.getCurrentPrice(signal.asset);

    // 4. Apply simulated slippage
    const fillPrice = this.applySlippage(price, signal.direction);

    // 5. Execute paper trade
    const trade = this.executePaperTrade(signal, size, fillPrice);

    // 6. Update portfolio state
    this.updatePortfolio(trade);

    return trade;
  }

  // P&L updates every time market prices refresh (~15 sec)
  updateMarketPrices(prices: Map<string, number>) {
    for (const [ticker, position] of this.portfolio.positions) {
      const currentPrice = prices.get(ticker);
      if (currentPrice) {
        position.unrealizedPnL = (currentPrice - position.avgEntry) * position.quantity;
        position.currentValue = currentPrice * Math.abs(position.quantity);
      }
    }
    this.recalculatePortfolioMetrics();
  }
}
```

**Week 6: Trading Dashboard UI**

Add three new panels to the right side (alongside existing intelligence panels):

**Signals Panel:**
- Real-time signal feed with direction arrows (▲ long / ▼ short)
- Confidence bars (0–100%)
- Strategy tag (GEO / SENT / MACRO)
- Linked to globe: clicking a signal highlights the triggering region

**Portfolio Panel:**
- Total NAV: $1,023,456 (+2.35%)
- Today's P&L: +$3,212
- Positions table: ticker | qty | entry | current | P&L | % of portfolio
- Sector exposure pie chart (mini SVG)

**Performance Panel:**
- Equity curve (SVG line chart, 12-month history from mock + live)
- Monthly returns heatmap (green/red grid)
- Key metrics: Sharpe ratio, max drawdown, win rate, profit factor
- Benchmark comparison (vs SPY buy-and-hold)
- Drawdown chart (area under zero)

**Globe Integration — Risk Heatmap Layer:**
```typescript
// src/globe/layers/risk-heatmap.ts
// Choropleth overlay: countries colored by portfolio exposure risk
// Red = high exposure to geopolitical risk in that region
// Green = portfolio is hedged against that region's risk
// Opacity = position size as % of portfolio
// Click country → shows which positions are affected
```

**Deliverable: Full paper trading engine generating signals from intelligence data, executing mock trades, showing P&L, with a risk exposure heatmap on the globe.**

---

### Phase 5: Polish + Deploy (Week 7–8)

**Week 7: WebSocket Relay + Real-Time**
- Deploy Railway relay for AIS vessel streaming
- Deploy Railway relay for OpenSky aircraft
- Connect live vessel/aircraft markers on globe
- WebSocket push for market price updates
- Real-time P&L updates as prices change

**Week 7: Command Palette + Search**
- Cmd+K opens fuzzy search across:
  - Countries (with aliases: "kremlin" → Russia)
  - Assets (ticker symbols)
  - News articles
  - Active signals
  - Layer toggle commands

**Week 8: Performance + Polish**
- Virtual scrolling on all long lists
- Progressive layer loading (detail layers only on zoom)
- Request deduplication (same as WorldMonitor's pattern)
- CDN caching headers on edge functions (s-maxage)
- Gzip compression on Railway relay responses
- Error boundaries: stale data on upstream failure
- Mobile-responsive layout (globe full-screen, panels as bottom sheet)
- PWA manifest for installable app

**Week 8: Documentation + Launch**
- README with screenshots, setup guide, architecture overview
- `.env.example` with every API key, registration link, and description
- `docker-compose.yml` for fully local development
- Demo mode: works with zero API keys (just static layers + mock data)

**Deliverable: Production-deployed platform at atlas.yourdomain.com with full intelligence dashboard, paper trading, and all real-time data feeds.**

---

## Infrastructure Deployment Checklist

```
VERCEL (Frontend + Edge Functions)
├── Project: atlas
├── Framework: Vite
├── Build: npm run build
├── Output: dist/
├── Edge Functions: /api/*
├── Env vars:
│   ├── UPSTASH_REDIS_REST_URL
│   ├── UPSTASH_REDIS_REST_TOKEN
│   ├── GROQ_API_KEY
│   ├── FINNHUB_API_KEY
│   ├── COINGECKO_API_KEY
│   ├── FRED_API_KEY
│   ├── NASA_FIRMS_API_KEY
│   ├── WS_RELAY_URL (→ Railway HTTPS)
│   └── VITE_WS_RELAY_URL (→ Railway WSS, exposed to client)
└── Domain: atlas.yourdomain.com

RAILWAY (WebSocket Relay)
├── Service: atlas-relay
├── Dockerfile or Nixpack auto-detect
├── Port: 3001
├── Env vars:
│   ├── OPENSKY_USERNAME
│   ├── OPENSKY_PASSWORD
│   ├── AISSTREAM_API_KEY
│   └── ALLOWED_ORIGINS (our Vercel domains)
└── Custom domain: relay.atlas.yourdomain.com

UPSTASH REDIS
├── Database: atlas-cache
├── Region: US-East-1 (closest to Vercel edge)
├── Plan: Free (10K commands/day) → Pay-as-you-go when needed
└── Used for: 3-tier cache, Welford state, AI dedup, paper portfolio state

GITHUB
├── Repo: [org]/atlas
├── Branch protection: main (require PR + CI pass)
├── Actions: lint + typecheck + test on PR
├── Auto-deploy: Vercel on merge to main
└── Railway: auto-deploy relay/ on merge to main
```

---

## Cost Summary

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Vercel Hobby | $0 | 100GB bandwidth, 500K edge invocations |
| Railway | $5 | Relay server (~0.5 vCPU, 512MB) |
| Upstash Redis | $0–10 | Pay-per-request, ~5K commands/day |
| Groq API | $0 | Free tier: 14.4K tokens/min |
| All data APIs | $0 | All free tiers |
| Domain | $12/year | Optional |
| **Total** | **$5–15/mo** | |

Scale-up path when adding real trading infrastructure (Phase 2+):

| Addition | Cost | When |
|----------|------|------|
| Vercel Pro | +$20/mo | >1000 daily users |
| Timescale Cloud | +$30/mo | Persistent backtest storage |
| Finnhub Premium | +$25/mo | WebSocket real-time quotes |
| Confluent Kafka | +$0–25/mo | Event streaming for signals |
| Railway ML service | +$20–50/mo | FinBERT inference server |
| **Full platform** | **$100–150/mo** | |

---

## What Success Looks Like (8 Weeks)

By week 8, someone visiting atlas.yourdomain.com sees:

1. **A stunning dark-themed 3D globe** with military bases, conflict zones, nuclear sites, undersea cables, live vessel tracks, and financial center markers — visually indistinguishable from WorldMonitor

2. **Real-time intelligence panels** showing breaking news with AI classification, country instability rankings, convergence alerts, anomaly detection, and AI-generated briefs

3. **A financial markets ticker** showing live stock indices, crypto, commodities, forex, and bond yields

4. **Trading signals appearing in real-time** as intelligence events trigger: "LONG USO — Iran CII spike +2.3σ — 72% confidence"

5. **A paper portfolio panel** showing $1M starting capital, current positions, unrealized P&L updating every 15 seconds, and a 12-month equity curve

6. **A risk heatmap on the globe** showing portfolio exposure by region, making geopolitical risk tangible and visual

7. **Performance metrics**: Sharpe ratio, max drawdown, win rate — proving (or disproving) that geopolitical intelligence generates alpha

All of this running on **$5–15/mo in infrastructure, 100% public data, zero forks, built from scratch.**

---

## Next Steps After MVP

Once the MVP is validated and the visualization tells a compelling story:

| Phase | Timeline | What | Infra Addition |
|-------|----------|------|---------------|
| **Live signals** | Week 9–12 | Replace mock data with real-time signal generation from FinBERT + GDELT sentiment | Railway ML service |
| **Backtesting** | Week 10–14 | VectorBT integration for historical strategy validation | TimescaleDB for OHLCV storage |
| **Paper broker** | Week 12–16 | Alpaca paper trading API (real order book, real fills) | Alpaca API key (free) |
| **Multi-agent** | Week 14–18 | LangGraph agents analyzing from different perspectives | Claude/GPT API costs |
| **Live trading** | Week 20+ | Real capital execution after 8+ weeks paper validation | IB/Alpaca live accounts |
