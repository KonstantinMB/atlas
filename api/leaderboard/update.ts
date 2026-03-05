/**
 * Leaderboard Update Helper
 *
 * Called by portfolio PUT after successful save.
 * Computes period returns from equityCurve and updates Redis sorted sets.
 */

import { getAuthRedis } from '../auth/_redis';

const STARTING_CAPITAL = 1_000_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PREV_RANK_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SCORE_MULTIPLIER = 10000; // returnPct * 10000 for Redis precision

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_DAYS: Record<LeaderboardPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

interface EquityPoint {
  timestamp: number;
  totalValue: number;
  cash?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

interface StoredPortfolio {
  cash: number;
  positions: unknown[];
  closedTrades: unknown[];
  equityCurve?: unknown[];
}

/**
 * Find the closest equity point at or before the given timestamp.
 * Returns the point's totalValue, or null if none found.
 */
function valueAtTime(curve: EquityPoint[], targetTs: number): number | null {
  if (curve.length === 0) return null;
  let best: EquityPoint | null = null;
  for (const p of curve) {
    if (p.timestamp <= targetTs) {
      if (!best || p.timestamp > best.timestamp) best = p;
    }
  }
  return best ? best.totalValue : null;
}

/**
 * Compute return for a period from equity curve.
 * Uses period-start value if available; otherwise inception return.
 */
function computeReturn(
  portfolio: StoredPortfolio,
  periodDays: number
): number | null {
  const curve = (portfolio.equityCurve ?? []) as EquityPoint[];
  const now = Date.now();
  const periodStartTs = now - periodDays * MS_PER_DAY;

  // Current value: last equity point or cash + positions
  let valueNow: number;
  if (curve.length > 0) {
    valueNow = curve[curve.length - 1]!.totalValue;
  } else {
    const positions = (portfolio.positions ?? []) as Array<{ marketValue?: number }>;
    const marketValue = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
    valueNow = (portfolio.cash ?? STARTING_CAPITAL) + marketValue;
  }

  const valueStart = valueAtTime(curve, periodStartTs);
  const startValue = valueStart ?? STARTING_CAPITAL;
  if (startValue <= 0) return null;
  return (valueNow - startValue) / startValue;
}

/**
 * Minimum activity: skip if user has no meaningful activity.
 */
function hasMinimumActivity(portfolio: StoredPortfolio): boolean {
  const positions = portfolio.positions ?? [];
  const closedTrades = portfolio.closedTrades ?? [];
  const equityCurve = (portfolio.equityCurve ?? []) as EquityPoint[];
  return (
    positions.length > 0 ||
    closedTrades.length > 0 ||
    equityCurve.length >= 2
  );
}

/**
 * Update leaderboard entries for a user after portfolio save.
 * Skips if no minimum activity.
 */
export async function updateLeaderboardEntries(
  username: string,
  portfolio: StoredPortfolio
): Promise<void> {
  if (!hasMinimumActivity(portfolio)) return;

  const redis = getAuthRedis();
  if (!redis) return;

  const periods: LeaderboardPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

  for (const period of periods) {
    let returnPct = computeReturn(portfolio, PERIOD_DAYS[period]);
    // Fallback to inception return if period has no data (e.g. new user) — ensures user appears on all periods
    if (returnPct === null) {
      const curve = (portfolio.equityCurve ?? []) as EquityPoint[];
      let valueNow: number;
      if (curve.length > 0) {
        valueNow = curve[curve.length - 1]!.totalValue;
      } else {
        const positions = (portfolio.positions ?? []) as Array<{ marketValue?: number }>;
        const marketValue = positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
        valueNow = (portfolio.cash ?? STARTING_CAPITAL) + marketValue;
      }
      if (STARTING_CAPITAL <= 0) continue;
      returnPct = (valueNow - STARTING_CAPITAL) / STARTING_CAPITAL;
    }

    const key = `leaderboard:${period}`;
    const prevRankKey = `leaderboard:prev_rank:${period}:${username}`;

    // Store current rank as prev_rank for next request (before we update)
    const currentRank = await redis.zrevrank(key, username);
    if (currentRank !== null) {
      await redis.set(prevRankKey, String(currentRank + 1), {
        ex: PREV_RANK_TTL_SECONDS,
      });
    }

    // Score: returnPct * 10000 (higher = better, ZREVRANGE returns desc)
    const score = returnPct * SCORE_MULTIPLIER;
    await redis.zadd(key, { score, member: username });
  }
}
