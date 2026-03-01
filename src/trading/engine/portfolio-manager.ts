/**
 * PortfolioManager — Live Position Tracking
 *
 * Responsibilities:
 *  - Open / close positions from broker fills (FIFO cost basis)
 *  - Mark-to-market on every price tick
 *  - Track cash, unrealizedPnL, realizedPnL, dailyPnL
 *  - Maintain high-water mark and drawdown
 *  - Persist to localStorage every 30 s
 *  - Async-persist to Upstash Redis via /api/trading/portfolio (fire-and-forget)
 *  - Emit 'portfolio-updated' CustomEvent for UI panel compatibility
 */

import type { Signal } from '../engine';
import { PAPER_CONFIG } from '../engine';
import type { Fill } from './paper-broker';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ManagedPosition {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  openedAt: number;
  strategy: string;
  signalId: string;

  // FIFO lots
  lots: Array<{
    quantity: number;
    costPrice: number;   // fill price of this lot
    openedAt: number;
  }>;

  // Aggregated (recalculated on MTM)
  quantity: number;
  avgCostPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;

  // Risk levels from signal
  stopLossPct: number;
  takeProfitPct: number;
  trailingStopPct?: number;

  // For TRAILING-STOP: track the best price seen
  highestPrice?: number;   // for LONG
  lowestPrice?: number;    // for SHORT
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  signalId: string;
  openedAt: number;
  closedAt: number;
  avgEntryPrice: number;
  avgExitPrice: number;
  quantity: number;
  realizedPnl: number;
  realizedPnlPct: number;
  closeReason: 'stop-loss' | 'take-profit' | 'trailing-stop' | 'time-stop' | 'signal-reversal' | 'manual' | 'risk-halt';
}

export interface EquityPoint {
  timestamp: number;
  totalValue: number;
  cash: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  cash: number;
  totalValue: number;
  startingCapital: number;
  highWaterMark: number;
  currentDrawdown: number;
  maxDrawdown: number;

  // P&L breakdown
  unrealizedPnl: number;
  realizedPnl: number;
  dailyPnl: number;
  totalPnl: number;
  totalPnlPct: number;

  // Positions
  positions: ManagedPosition[];
  closedTrades: ClosedTrade[];
  openPositionCount: number;
  closedTradeCount: number;

  // Daily baseline
  dailyStartValue: number;

  // Long / short ratio
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  grossExposure: number;
}

// ── StoredState (for localStorage) ───────────────────────────────────────────

interface StoredPortfolio {
  cash: number;
  positions: ManagedPosition[];
  closedTrades: ClosedTrade[];
  realizedPnl: number;
  highWaterMark: number;
  maxDrawdown: number;
  dailyStartValue: number;
  equityCurve: EquityPoint[];
  savedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY       = 'atlas-portfolio-v2';
const PERSIST_INTERVAL  = 30_000;   // 30 s
const MAX_CLOSED_TRADES = 500;
const MAX_EQUITY_POINTS = 1_000;

// ── PortfolioManager ──────────────────────────────────────────────────────────

export class PortfolioManager {
  private cash: number;
  private positions: Map<string, ManagedPosition> = new Map();
  private closedTrades: ClosedTrade[] = [];
  private realizedPnl = 0;
  private dailyStartValue: number;
  private highWaterMark: number;
  private maxDrawdown = 0;
  private equityCurve: EquityPoint[] = [];

  constructor(startingCapital = PAPER_CONFIG.startingCapital) {
    const loaded = this.loadFromStorage();
    if (loaded) {
      this.cash           = loaded.cash;
      this.positions      = new Map(loaded.positions.map(p => [p.symbol, p]));
      this.closedTrades   = loaded.closedTrades;
      this.realizedPnl    = loaded.realizedPnl;
      this.highWaterMark  = loaded.highWaterMark;
      this.maxDrawdown    = loaded.maxDrawdown;
      this.dailyStartValue = loaded.dailyStartValue;
      this.equityCurve    = loaded.equityCurve;
    } else {
      this.cash           = startingCapital;
      this.dailyStartValue = startingCapital;
      this.highWaterMark  = startingCapital;
    }

    this.schedulePersistence();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Open a position from a broker fill + originating signal.
   * Supports adding to an existing position in the same symbol (FIFO lot stacking).
   */
  openPosition(fill: Fill, signal: Signal): ManagedPosition {
    const cost = fill.fillPrice * fill.fillQuantity;

    if (cost > this.cash) {
      throw new Error(`Insufficient cash: need $${cost.toFixed(2)}, have $${this.cash.toFixed(2)}`);
    }

    this.cash -= cost;

    const existing = this.positions.get(signal.symbol);
    if (existing) {
      // Add a new FIFO lot to the existing position
      existing.lots.push({
        quantity: fill.fillQuantity,
        costPrice: fill.fillPrice,
        openedAt: fill.filledAt,
      });
      existing.quantity += fill.fillQuantity;
      existing.avgCostPrice = existing.lots.reduce(
        (sum, lot) => sum + lot.costPrice * lot.quantity, 0
      ) / existing.quantity;
      existing.currentPrice = fill.fillPrice;
      existing.marketValue  = existing.currentPrice * existing.quantity;
      this.emitUpdate();
      return existing;
    }

    const position: ManagedPosition = {
      id: `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: signal.symbol,
      direction: signal.direction,
      openedAt: fill.filledAt,
      strategy: signal.strategy,
      signalId: signal.id,
      lots: [{ quantity: fill.fillQuantity, costPrice: fill.fillPrice, openedAt: fill.filledAt }],
      quantity: fill.fillQuantity,
      avgCostPrice: fill.fillPrice,
      currentPrice: fill.fillPrice,
      marketValue: cost,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      stopLossPct: signal.stopLoss,
      takeProfitPct: signal.takeProfit,
      ...(signal.direction === 'LONG'  ? { highestPrice: fill.fillPrice } : {}),
      ...(signal.direction === 'SHORT' ? { lowestPrice:  fill.fillPrice } : {}),
    };

    this.positions.set(signal.symbol, position);
    this.appendEquityPoint();
    this.emitUpdate();
    return position;
  }

  /**
   * Close a position (or partial close) using FIFO lots.
   * Returns the closed trade record.
   */
  closePosition(
    symbol: string,
    fill: Fill,
    reason: ClosedTrade['closeReason'] = 'manual'
  ): ClosedTrade | null {
    const pos = this.positions.get(symbol);
    if (!pos) return null;

    const proceeds = fill.fillPrice * fill.fillQuantity;
    this.cash += proceeds;

    // FIFO: consume lots from the front
    let remaining = fill.fillQuantity;
    let totalCost = 0;

    while (remaining > 0 && pos.lots.length > 0) {
      const lot = pos.lots[0]!;
      if (lot.quantity <= remaining) {
        totalCost += lot.quantity * lot.costPrice;
        remaining -= lot.quantity;
        pos.lots.shift();
      } else {
        totalCost += remaining * lot.costPrice;
        lot.quantity -= remaining;
        remaining = 0;
      }
    }

    const avgEntryPrice = totalCost / fill.fillQuantity;
    const realizedPnl = pos.direction === 'LONG'
      ? (fill.fillPrice - avgEntryPrice) * fill.fillQuantity
      : (avgEntryPrice - fill.fillPrice) * fill.fillQuantity;

    this.realizedPnl += realizedPnl;

    const trade: ClosedTrade = {
      id: `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: pos.symbol,
      direction: pos.direction,
      strategy: pos.strategy,
      signalId: pos.signalId,
      openedAt: pos.openedAt,
      closedAt: fill.filledAt,
      avgEntryPrice,
      avgExitPrice: fill.fillPrice,
      quantity: fill.fillQuantity,
      realizedPnl,
      realizedPnlPct: realizedPnl / totalCost,
      closeReason: reason,
    };

    // Fully closed
    if (pos.lots.length === 0 || pos.quantity <= fill.fillQuantity) {
      this.positions.delete(symbol);
    } else {
      pos.quantity -= fill.fillQuantity;
      pos.avgCostPrice = pos.lots.reduce(
        (sum, lot) => sum + lot.costPrice * lot.quantity, 0
      ) / pos.quantity;
    }

    this.closedTrades.push(trade);
    if (this.closedTrades.length > MAX_CLOSED_TRADES) {
      this.closedTrades = this.closedTrades.slice(-MAX_CLOSED_TRADES);
    }

    this.updateDrawdown();
    this.appendEquityPoint();
    this.emitUpdate();
    return trade;
  }

  /**
   * Update mark-to-market for all positions from a fresh price map.
   * Also updates trailing-stop anchors.
   */
  updateMarkToMarket(prices: Map<string, number> | Record<string, number>): void {
    const getPrice = (sym: string): number | undefined =>
      prices instanceof Map ? prices.get(sym) : (prices as Record<string, number>)[sym];

    for (const pos of this.positions.values()) {
      const price = getPrice(pos.symbol);
      if (!price) continue;

      pos.currentPrice = price;

      // Update trailing-stop anchors
      if (pos.direction === 'LONG') {
        pos.highestPrice = Math.max(pos.highestPrice ?? price, price);
      } else {
        pos.lowestPrice = Math.min(pos.lowestPrice ?? price, price);
      }

      const cost = pos.avgCostPrice * pos.quantity;
      pos.unrealizedPnl = pos.direction === 'LONG'
        ? (price - pos.avgCostPrice) * pos.quantity
        : (pos.avgCostPrice - price) * pos.quantity;
      pos.unrealizedPnlPct = cost > 0 ? pos.unrealizedPnl / cost : 0;
      pos.marketValue = pos.direction === 'LONG'
        ? price * pos.quantity
        : pos.avgCostPrice * pos.quantity + pos.unrealizedPnl;
    }

    this.updateDrawdown();
    this.emitUpdate();
  }

  getSnapshot(): PortfolioSnapshot {
    const positions = Array.from(this.positions.values());
    const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const totalValue = this.cash + positions.reduce((s, p) => s + p.marketValue, 0);
    const totalPnl = totalValue - PAPER_CONFIG.startingCapital;
    const dailyPnl = totalValue - this.dailyStartValue;

    const longExposure  = positions.filter(p => p.direction === 'LONG').reduce((s, p) => s + p.marketValue, 0);
    const shortExposure = positions.filter(p => p.direction === 'SHORT').reduce((s, p) => s + p.marketValue, 0);

    return {
      timestamp: Date.now(),
      cash: this.cash,
      totalValue,
      startingCapital: PAPER_CONFIG.startingCapital,
      highWaterMark: this.highWaterMark,
      currentDrawdown: totalValue < this.highWaterMark
        ? (this.highWaterMark - totalValue) / this.highWaterMark
        : 0,
      maxDrawdown: this.maxDrawdown,
      unrealizedPnl,
      realizedPnl: this.realizedPnl,
      dailyPnl,
      totalPnl,
      totalPnlPct: totalPnl / PAPER_CONFIG.startingCapital,
      positions,
      closedTrades: this.closedTrades.slice(-100),
      openPositionCount: this.positions.size,
      closedTradeCount: this.closedTrades.length,
      dailyStartValue: this.dailyStartValue,
      longExposure,
      shortExposure,
      netExposure: longExposure - shortExposure,
      grossExposure: longExposure + shortExposure,
    };
  }

  getEquityCurve(): EquityPoint[] {
    return [...this.equityCurve];
  }

  /** Seed synthetic equity curve on first run (no-op if real data already exists) */
  seedEquityCurve(points: EquityPoint[]): void {
    if (this.equityCurve.length > 0) return;
    this.equityCurve = [...points];
  }

  getTotalValue(): number {
    const posValue = Array.from(this.positions.values()).reduce((s, p) => s + p.marketValue, 0);
    return this.cash + posValue;
  }

  getPosition(symbol: string): ManagedPosition | undefined {
    return this.positions.get(symbol);
  }

  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  getCash(): number {
    return this.cash;
  }

  getHighWaterMark(): number {
    return this.highWaterMark;
  }

  getDailyStartValue(): number {
    return this.dailyStartValue;
  }

  /** Call at start of each trading day */
  resetDailyStats(): void {
    this.dailyStartValue = this.getTotalValue();
  }

  reset(): void {
    this.cash = PAPER_CONFIG.startingCapital;
    this.positions.clear();
    this.closedTrades = [];
    this.realizedPnl = 0;
    this.dailyStartValue = PAPER_CONFIG.startingCapital;
    this.highWaterMark = PAPER_CONFIG.startingCapital;
    this.maxDrawdown = 0;
    this.equityCurve = [];
    localStorage.removeItem(STORAGE_KEY);
    this.emitUpdate();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  persistNow(): void {
    try {
      const data: StoredPortfolio = {
        cash: this.cash,
        positions: Array.from(this.positions.values()),
        closedTrades: this.closedTrades,
        realizedPnl: this.realizedPnl,
        highWaterMark: this.highWaterMark,
        maxDrawdown: this.maxDrawdown,
        dailyStartValue: this.dailyStartValue,
        equityCurve: this.equityCurve.slice(-MAX_EQUITY_POINTS),
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Quota exceeded — prune equity curve and retry
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        this.equityCurve = this.equityCurve.slice(-200);
        try {
          this.persistNow();
        } catch { /* give up */ }
      }
    }

    // Fire-and-forget Redis sync
    void this.syncToRedis();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private schedulePersistence(): void {
    setInterval(() => this.persistNow(), PERSIST_INTERVAL);
  }

  private loadFromStorage(): StoredPortfolio | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredPortfolio;
      // Reject stale data older than 7 days
      if (Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
      // Filter out malformed positions missing required fields (from schema migrations)
      data.positions = (data.positions ?? []).filter(
        p =>
          p &&
          typeof p.direction === 'string' &&
          typeof p.marketValue === 'number' &&
          typeof p.quantity === 'number' &&
          typeof p.symbol === 'string'
      );
      return data;
    } catch {
      return null;
    }
  }

  private updateDrawdown(): void {
    const totalValue = this.getTotalValue();
    if (totalValue > this.highWaterMark) {
      this.highWaterMark = totalValue;
    }
    const dd = (this.highWaterMark - totalValue) / this.highWaterMark;
    if (dd > this.maxDrawdown) this.maxDrawdown = dd;
  }

  private appendEquityPoint(): void {
    const posValue = Array.from(this.positions.values()).reduce((s, p) => s + (p?.marketValue ?? 0), 0);
    const total = this.cash + posValue;
    this.equityCurve.push({
      timestamp: Date.now(),
      totalValue: total,
      cash: this.cash,
      unrealizedPnl: Array.from(this.positions.values()).reduce((s, p) => s + p.unrealizedPnl, 0),
      realizedPnl: this.realizedPnl,
    });
    if (this.equityCurve.length > MAX_EQUITY_POINTS) {
      this.equityCurve = this.equityCurve.slice(-MAX_EQUITY_POINTS);
    }
  }

  private emitUpdate(): void {
    const snapshot = this.getSnapshot();
    window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: snapshot }));
  }

  private async syncToRedis(): Promise<void> {
    try {
      const snapshot = this.getSnapshot();
      await fetch('/api/trading/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot,
          equityCurve: this.equityCurve.slice(-100),
        }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Redis sync is best-effort — localStorage is the primary store
    }
  }
}

/** Global singleton */
export const portfolioManager = new PortfolioManager();
