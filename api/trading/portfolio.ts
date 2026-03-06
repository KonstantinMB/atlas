/**
 * Portfolio Persistence Edge Function (Auth-required, per-user)
 *
 * GET /api/trading/portfolio
 *   - Requires auth (Bearer token)
 *   - Fetches portfolio:{username} from Redis
 *   - If none → returns default { cash: 1_000_000, positions: [], ... }
 *
 * PUT /api/trading/portfolio
 *   - Requires auth
 *   - Body: full portfolio state
 *   - Validates structure, saves to portfolio:{username}
 *
 * POST /api/trading/portfolio/reset
 *   - Requires auth (see portfolio/reset.ts)
 */

import { withCors } from '../_cors';
import { requireAuth } from '../auth/_middleware';
import { getAuthRedis } from '../auth/_redis';
import { updateLeaderboardEntries } from '../leaderboard/update';

export const config = { runtime: 'edge' };

const REDIS_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year (no expiry for portfolios)
const STARTING_CAPITAL = 1_000_000;

function portfolioKey(username: string): string {
  return `portfolio:${username}`;
}

function getRedis() {
  return getAuthRedis();
}

function jsonResponse(data: object, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function defaultPortfolio(createdAt: number) {
  return {
    cash: STARTING_CAPITAL,
    positions: [] as unknown[],
    closedTrades: [] as unknown[],
    realizedPnl: 0,
    highWaterMark: STARTING_CAPITAL,
    maxDrawdown: 0,
    dailyStartValue: STARTING_CAPITAL,
    equityCurve: [] as unknown[],
    savedAt: createdAt,
    createdAt,
  };
}

function validatePortfolio(body: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid body' };
  }
  const o = body as Record<string, unknown>;
  if (typeof o.cash !== 'number' || o.cash < 0) {
    return { ok: false, error: 'Invalid cash' };
  }
  if (!Array.isArray(o.positions)) {
    return { ok: false, error: 'positions must be array' };
  }
  for (const p of o.positions) {
    if (!p || typeof p !== 'object') continue;
    const pos = p as Record<string, unknown>;
    if (typeof pos.symbol !== 'string' || typeof pos.quantity !== 'number') {
      return { ok: false, error: 'Position missing symbol or quantity' };
    }
  }
  return { ok: true, data: body };
}

export default withCors(async (req: Request) => {
  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;
  const user = userOrError;

  const redis = getRedis();
  if (!redis) {
    return jsonResponse({ error: 'Storage unavailable' }, 503);
  }

  const key = portfolioKey(user.username);

  // ── GET: retrieve portfolio ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const raw = await redis.get<string>(key);
    let data: unknown;
    if (raw) {
      try {
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        data = null;
      }
    } else {
      data = null;
    }

    if (!data || typeof data !== 'object') {
      const fresh = defaultPortfolio(Date.now());
      return jsonResponse({ data: fresh, timestamp: Date.now() }, 200);
    }

    return jsonResponse({ data, timestamp: Date.now() }, 200);
  }

  // ── PUT: save portfolio ─────────────────────────────────────────────────
  if (req.method === 'PUT') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const validation = validatePortfolio(body);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const payload = {
      ...(validation.data as object),
      savedAt: Date.now(),
    };

    await redis.set(key, payload);

    // Update leaderboard before responding so sync reflects immediately
    await updateLeaderboardEntries(user.username, payload as unknown as Parameters<typeof updateLeaderboardEntries>[1]);

    return jsonResponse({ success: true, savedAt: Date.now() }, 200);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
});
