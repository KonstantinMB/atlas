# Atlas Leaderboard — Prompt Strategy for Agent Implementation

## Quick Start (Orchestrator Prompt)

Use this to kick off the leaderboard implementation with an agent:

```
I'm working on Project Atlas. Read CLAUDE.md for context.

Implement the paper trading leaderboard feature as described in docs/LEADERBOARD-PROMPT-STRATEGY.md.

Execute the prompts in order (1 → 2 → 3 → 4). Each prompt is self-contained. When you need my input, ask clearly and wait. Otherwise, build autonomously.

Start with Prompt 1 — Leaderboard Backend.
```

---

## Overview

Implement a **leaderboard** for paper trading users at `ychedgefunc.com/leaderboard`, ranked by portfolio return across four time periods: **Weekly**, **Monthly**, **Quarterly**, **Yearly**. The leaderboard should be highly interactive, engaging, and aligned with the platform's dark intelligence-dashboard aesthetic.

---

## Research-Backed UX Principles (Reference for Agents)

Based on TraderTale, FCA research, and gamified fintech best practices:

1. **Ranking by consistency + return** — Primary sort: total return %. Secondary (optional): Sharpe or win rate for tie-breaking.
2. **Hover previews & stats** — Each row reveals extra context on hover: period dates, trade count, max drawdown.
3. **Position change indicators** — Show ▲/▼ with previous rank when available (drives engagement).
4. **Current user highlight** — Logged-in user's row is always visible and visually distinct (glow, accent border).
5. **Clean typography** — JetBrains Mono (existing) handles dense financial data; keep numbers right-aligned.
6. **Purposeful color** — Green for profit, red for loss; accent color for current user.
7. **Minimum activity threshold** — Only users with at least one trade or non-default portfolio appear (avoids empty/fresh accounts).
8. **Real-time feel** — Poll every 60–120s or use a "Last updated" badge; no need for WebSocket in MVP.
9. **Empty state** — When not logged in: "Sign up to paper trade and compete on the leaderboard."
10. **Mobile-friendly** — Responsive table (horizontal scroll or card layout on small screens).

---

## Data Model & Logic

### Redis Schema (New Keys)

| Key | Type | Score | Member | TTL | Notes |
|-----|------|-------|--------|-----|-------|
| `leaderboard:weekly` | Sorted Set | return % (float × 10000 for precision) | username | none | Higher score = better |
| `leaderboard:monthly` | Sorted Set | same | username | none | |
| `leaderboard:quarterly` | Sorted Set | same | username | none | |
| `leaderboard:yearly` | Sorted Set | same | username | none | |
| `leaderboard:prev_rank:{period}:{username}` | String | — | previous rank (1–N) | 7 days | For ▲/▼ indicator |

**Return calculation** (from `equityCurve` in portfolio):

- **Weekly**: `(value_now - value_7d_ago) / value_7d_ago` — use closest timestamp in equity curve.
- **Monthly**: `(value_now - value_30d_ago) / value_30d_ago`
- **Quarterly**: `(value_now - value_90d_ago) / value_90d_ago`
- **Yearly**: `(value_now - value_365d_ago) / value_365d_ago`

If no data at period start (e.g. user joined 5 days ago), use **inception return**: `(value_now - starting_capital) / starting_capital` for that period. This is fair — new users still compete.

**Minimum activity**: Only update leaderboard if `positions.length > 0 || closedTrades.length > 0 || equityCurve.length >= 2`. Fresh $1M accounts with zero activity are excluded.

### API

**GET /api/leaderboard?period=weekly|monthly|quarterly|yearly&limit=100**

- **Auth**: Not required (public leaderboard).
- **Response**:
```json
{
  "period": "monthly",
  "periodLabel": "Monthly",
  "periodStart": "2025-02-05T00:00:00.000Z",
  "periodEnd": "2025-03-05T00:00:00.000Z",
  "updatedAt": 1749123456789,
  "entries": [
    {
      "rank": 1,
      "username": "alpha_trader",
      "returnPct": 12.34,
      "prevRank": 3,
      "rankChange": 2,
      "nav": 1123400,
      "tradeCount": 47
    }
  ],
  "totalCount": 156
}
```

- **Cache**: 60 seconds (stale-while-revalidate) — leaderboard doesn't need sub-second freshness.
- **Optional**: If `Authorization` header present, include `currentUserRank` and `currentUserEntry` in response for highlight logic.

---

## Integration Points

1. **Portfolio PUT** (`api/trading/portfolio.ts`): After successful save, call a shared `updateLeaderboard(username, portfolioData)` helper that:
   - Computes returns for each period from `equityCurve`.
   - Updates Redis sorted sets via `ZADD leaderboard:{period} {score} {username}`.
   - Optionally stores previous rank for ▲/▼ before updating.

2. **Server-sync** (`server-sync.ts`): No change — portfolio PUT already triggers on save. Leaderboard update happens server-side in the PUT handler.

3. **Routing**: Add client-side path check. When `window.location.pathname === '/leaderboard'`, render leaderboard view instead of main dashboard. Use `history.pushState` / `popstate` for SPA navigation.

4. **Nav**: Add "Leaderboard" link in header (e.g. after Trading tab or as a standalone link). Clicking navigates to `/leaderboard`.

---

## Prompt Sequence (Run One at a Time)

### Prompt 1 — Leaderboard Backend

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Implement the leaderboard backend.

1. Create `/api/leaderboard/index.ts` (or `leaderboard.ts`) — GET handler.
   - Query param: `period` (weekly|monthly|quarterly|yearly), default `monthly`
   - Query param: `limit` (1–200), default 100
   - Use Redis ZREVRANGE to get top N from `leaderboard:{period}` sorted set (higher score = better)
   - For each username, optionally fetch `leaderboard:prev_rank:{period}:{username}` for rank change
   - Return JSON: period, periodLabel, periodStart, periodEnd, updatedAt, entries (rank, username, returnPct, prevRank, rankChange, nav, tradeCount), totalCount
   - Cache response 60s (Cache-Control or Vercel edge cache)
   - No auth required

2. Create `/api/leaderboard/update.ts` or a shared helper used by portfolio PUT:
   - Function `updateLeaderboardEntries(username: string, portfolio: StoredPortfolio): Promise<void>`
   - Compute returns for weekly (7d), monthly (30d), quarterly (90d), yearly (365d) from equityCurve
   - If equityCurve is empty or too short, use inception return (totalValue - 1M) / 1M if we have at least one data point
   - Minimum activity: skip update if positions.length === 0 && closedTrades.length === 0 && equityCurve.length < 2
   - For each period: ZADD leaderboard:{period} {score} {username} (score = returnPct * 10000 for precision)
   - Optionally: before ZADD, ZREVRANK to get current rank, store in leaderboard:prev_rank:{period}:{username} for next request

3. Integrate into `api/trading/portfolio.ts`: After successful PUT, call updateLeaderboardEntries(user.username, payload)

4. Use getAuthRedis() for Redis access. Ensure CORS allows GET /api/leaderboard from our domain.

**Acceptance criteria**:
- curl "https://ychedgefunc.com/api/leaderboard?period=monthly" returns valid JSON with entries array
- After a user saves a portfolio with trades/equity data, they appear on the leaderboard
- Users with no activity do not appear
```

---

### Prompt 2 — Leaderboard UI Page

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Build the leaderboard frontend page at /leaderboard.

1. **Routing**: In main.ts (or a new router module), check `window.location.pathname`. If pathname === '/leaderboard', render the leaderboard view instead of the main dashboard. Use a simple view state: 'dashboard' | 'leaderboard'. On nav to /leaderboard, set view to leaderboard and call history.pushState. Listen to popstate for back button.

2. **Leaderboard view** (new file: `src/views/leaderboard.ts` or `src/panels/leaderboard-page.ts`):
   - Full-width layout matching platform dark theme (#0a0f0a bg, --text-primary, --text-accent)
   - Header: "LEADERBOARD" title, period pills: [Weekly] [Monthly] [Quarterly] [Yearly] (active pill highlighted)
   - Subheader: "Ranked by portfolio return • Last updated: {time}"
   - Table: Rank | Username | Return % | ▲/▼ (rank change) | NAV (optional)
   - Current user row: accent border, subtle glow (--text-accent)
   - Empty state when no entries: "No traders yet. Sign up and start paper trading to compete."
   - When not logged in: Banner "Sign up to paper trade and appear on the leaderboard" with link to register
   - Fetch from GET /api/leaderboard?period={activePeriod}
   - Poll every 90 seconds when tab is visible (document.visibilityState)
   - Loading skeleton while fetching
   - Responsive: on narrow viewport, table scrolls horizontally or switches to card layout

3. **Styling**: Add `.leaderboard-*` classes in base.css. Use existing CSS variables (--bg-panel, --border-primary, --sentiment-positive, --sentiment-negative). Match the performance panel's table styling (perf-metric-row, etc.) for consistency.

4. **Nav integration**: Add a "Leaderboard" link/button in the header nav (in index.html or wherever header-nav-tabs are). Clicking navigates to /leaderboard (history.pushState + update view). When on leaderboard, show "← Dashboard" or similar to return.

**Acceptance criteria**:
- Visiting ychedgefunc.com/leaderboard shows the leaderboard page
- Period pills switch data correctly
- Logged-in user sees their row highlighted
- Table is readable and matches platform aesthetic
```

---

### Prompt 3 — Engagement & Polish

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Enhance the leaderboard for maximum engagement and interactivity.

1. **Hover preview**: On row hover, show a small tooltip or expand row with: period date range, trade count, max drawdown (if we have it). Use portfolio data from a separate endpoint or include in leaderboard response. If not available, show: "Joined {date}" or "Trades: {count}".

2. **Rank change indicator**: Display ▲2 or ▼5 next to return % when prevRank exists. Green for up, red for down. "—" when no previous rank.

3. **Your rank callout**: When logged in and user is not in top 10, add a sticky "Your rank: #47" bar above or below the table that scrolls to their row on click.

4. **Empty state CTA**: When not logged in, make the banner more prominent — "Compete with other traders. Sign up to start paper trading." with a button that opens the auth modal (use openAuthModal from auth-modal).

5. **Keyboard**: When on leaderboard page, Cmd+K should still open command palette; add "Go to Dashboard" and "Go to Leaderboard" commands if not present.

6. **Podium effect** (optional): Top 3 rows could have subtle gold/silver/bronze accent or icon (🥇🥈🥉) for extra gamification.

**Acceptance criteria**:
- Hover shows extra stats
- Rank change arrows display correctly
- Logged-in users outside top 10 see "Your rank" callout
- Empty state has clear CTA
```

---

### Prompt 4 — Documentation & Agent Updates

```
I'm working on Project Atlas. Read CLAUDE.md for context.

**Task**: Update project documentation for the leaderboard feature.

1. **CLAUDE.md**: Add a "Leaderboard" section under File Structure:
   - api/leaderboard/ (or api/leaderboard.ts) — GET leaderboard, update helper
   - src/views/leaderboard.ts (or equivalent) — leaderboard page
   - Redis keys: leaderboard:weekly, leaderboard:monthly, leaderboard:quarterly, leaderboard:yearly, leaderboard:prev_rank:{period}:{username}
   - Update Redis Key Schema table with new keys
   - Add leaderboard to Build Status checklist

2. **api-agent.md** (if exists): Add leaderboard endpoints to the agent's knowledge.

3. **frontend-agent.md** (if exists): Add leaderboard view and routing to the agent's knowledge.

4. **README.md**: Add a line under Features: "Paper trading leaderboard (weekly, monthly, quarterly, yearly returns) at /leaderboard"
```

---

## Verification Checklist

After all prompts are run:

- [ ] `GET /api/leaderboard?period=monthly` returns valid JSON
- [ ] Portfolio save updates leaderboard (user appears after trading)
- [ ] `/leaderboard` route renders correctly
- [ ] Period pills (Weekly, Monthly, Quarterly, Yearly) work
- [ ] Logged-in user row is highlighted
- [ ] Not-logged-in users see CTA to sign up
- [ ] Mobile/responsive layout works
- [ ] Nav link to Leaderboard exists and works
- [ ] Back to Dashboard works
- [ ] CLAUDE.md updated

---

## Domain Note

The doc references `ychedgefunc.com`. If the deployed URL is different (e.g. `atlas-rouge-one.vercel.app`), agents should use the actual deployment URL for verification. The implementation is domain-agnostic.
