/**
 * GET /api/leaderboard
 *
 * Public leaderboard endpoint. Returns top traders by portfolio return.
 * Query params: period (weekly|monthly|quarterly|yearly), limit (1-200)
 */

import { withCors } from '../_cors';
import { getAuthRedis } from '../auth/_redis';
import { requireAuth } from '../auth/_middleware';

export const config = { runtime: 'edge' };

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

const SCORE_MULTIPLIER = 10000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

interface LeaderboardEntry {
  rank: number;
  username: string;
  returnPct: number;
  prevRank: number | null;
  rankChange: number | null;
  nav: number;
  tradeCount: number;
  maxDrawdown?: number;
  createdAt?: number;
}

interface LeaderboardResponse {
  period: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: number;
  entries: LeaderboardEntry[];
  totalCount: number;
  currentUserRank?: number;
  currentUserEntry?: LeaderboardEntry;
}

function jsonResponse(
  data: object,
  status: number,
  cacheSeconds = 60
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 5}`,
    },
  });
}

export default withCors(async (req: Request) => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, 0);
  }

  const url = new URL(req.url);
  const periodParam = url.searchParams.get('period') ?? 'monthly';
  const period =
    ['weekly', 'monthly', 'quarterly', 'yearly'].includes(periodParam)
      ? periodParam
      : 'monthly';

  const limitParam = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Math.min(
    Math.max(Number.isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, 1),
    MAX_LIMIT
  );

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Storage unavailable' }, 503, 0);
  }

  const key = `leaderboard:${period}`;

  // ZRANGE with rev: highest score first (descending), withScores for returnPct
  const rangeResult = await redis.zrange(key, 0, limit - 1, {
    rev: true,
    withScores: true,
  });

  const totalCount = await redis.zcard(key);

  // Parse interleaved [member, score, member, score, ...]
  const usernames: string[] = [];
  const scores: number[] = [];
  const arr = Array.isArray(rangeResult) ? rangeResult : [rangeResult];
  for (let i = 0; i < arr.length; i += 2) {
    if (typeof arr[i] === 'string') {
      usernames.push(arr[i] as string);
      scores.push(typeof arr[i + 1] === 'number' ? (arr[i + 1] as number) : 0);
    }
  }

  const now = Date.now();
  const periodDays = PERIOD_DAYS[period] ?? 30;
  const periodStart = new Date(now - periodDays * 24 * 60 * 60 * 1000);
  const periodEnd = new Date(now);

  const entries: LeaderboardEntry[] = [];

  // Fetch prev_rank and portfolio for each user (parallel)
  const fetchPromises = usernames.map(async (username, index) => {
    const rank = index + 1;
    const prevRankKey = `leaderboard:prev_rank:${period}:${username}`;
    const portfolioKey = `portfolio:${username}`;

    const [prevRankRaw, portfolioRaw] = await Promise.all([
      redis.get<string>(prevRankKey),
      redis.get<string>(portfolioKey),
    ]);

    const prevRank =
      prevRankRaw !== null
        ? parseInt(String(prevRankRaw), 10)
        : null;
    const rankChange =
      prevRank !== null && !Number.isNaN(prevRank) ? prevRank - rank : null;

    // Parse portfolio for nav, tradeCount, maxDrawdown, createdAt
    let nav = 1_000_000;
    let tradeCount = 0;
    let maxDrawdown: number | undefined;
    let createdAt: number | undefined;
    if (portfolioRaw) {
      try {
        const portfolio =
          typeof portfolioRaw === 'string'
            ? JSON.parse(portfolioRaw)
            : portfolioRaw;
        const positions = (portfolio.positions ?? []) as Array<{ marketValue?: number }>;
        const closedTrades = (portfolio.closedTrades ?? []) as unknown[];
        const cash = (portfolio.cash as number) ?? 1_000_000;
        const equityCurve = (portfolio.equityCurve ?? []) as Array<{ totalValue: number; timestamp: number }>;
        nav =
          equityCurve.length > 0
            ? equityCurve[equityCurve.length - 1]!.totalValue
            : cash + positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
        tradeCount = closedTrades.length;
        maxDrawdown = typeof portfolio.maxDrawdown === 'number' ? portfolio.maxDrawdown : undefined;
        if (equityCurve.length > 0) {
          createdAt = equityCurve[0]!.timestamp;
        } else if (typeof portfolio.savedAt === 'number') {
          createdAt = portfolio.savedAt;
        }
      } catch {
        // use defaults
      }
    }

    const returnPct = (scores[index] ?? 0) / SCORE_MULTIPLIER;

    return {
      rank,
      username,
      returnPct,
      prevRank: prevRank !== null && !Number.isNaN(prevRank) ? prevRank : null,
      rankChange,
      nav,
      tradeCount,
      maxDrawdown,
      createdAt,
    };
  });

  const resolvedEntries = await Promise.all(fetchPromises);
  entries.push(...resolvedEntries);

  const response: LeaderboardResponse = {
    period,
    periodLabel: PERIOD_LABELS[period] ?? 'Monthly',
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    updatedAt: now,
    entries,
    totalCount,
  };

  // If Authorization header present, include current user rank and entry
  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) {
    return jsonResponse(response, 200);
  }
  const user = userOrError;
  const userEntry = entries.find((e) => e.username === user.username);
  if (userEntry) {
    response.currentUserRank = userEntry.rank;
    response.currentUserEntry = userEntry;
  } else {
    // User might be ranked but not in top N
    const userRank = await redis.zrevrank(key, user.username);
    if (userRank !== null) {
      const userScore = await redis.zscore(key, user.username);
      const portfolioRaw = await redis.get<string>(`portfolio:${user.username}`);
      let nav = 1_000_000;
      let tradeCount = 0;
      let maxDrawdown: number | undefined;
      let createdAt: number | undefined;
      if (portfolioRaw) {
        try {
          const portfolio =
            typeof portfolioRaw === 'string'
              ? JSON.parse(portfolioRaw)
              : portfolioRaw;
          const positions = (portfolio.positions ?? []) as Array<{ marketValue?: number }>;
          const closedTrades = (portfolio.closedTrades ?? []) as unknown[];
          const cash = (portfolio.cash as number) ?? 1_000_000;
          const equityCurve = (portfolio.equityCurve ?? []) as Array<{ totalValue: number; timestamp: number }>;
          nav =
            equityCurve.length > 0
              ? equityCurve[equityCurve.length - 1]!.totalValue
              : cash + positions.reduce((s, p) => s + (p.marketValue ?? 0), 0);
          tradeCount = closedTrades.length;
          maxDrawdown = typeof portfolio.maxDrawdown === 'number' ? portfolio.maxDrawdown : undefined;
          if (equityCurve.length > 0) {
            createdAt = equityCurve[0]!.timestamp;
          } else if (typeof portfolio.savedAt === 'number') {
            createdAt = portfolio.savedAt;
          }
        } catch {
          // use defaults
        }
      }
      response.currentUserRank = userRank + 1;
      response.currentUserEntry = {
        rank: userRank + 1,
        username: user.username,
        returnPct:
          userScore !== null ? Number(userScore) / SCORE_MULTIPLIER : 0,
        prevRank: null,
        rankChange: null,
        nav,
        tradeCount,
        maxDrawdown,
        createdAt,
      };
    }
  }

  return jsonResponse(response, 200);
});
