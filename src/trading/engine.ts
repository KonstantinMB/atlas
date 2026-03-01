/**
 * Paper Trading Engine — Core State Machine
 * Manages portfolio state, executes signals, checks risk limits, persists to localStorage.
 */

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface Signal {
  id: string;
  timestamp: number;
  strategy: string;
  symbol: string;
  direction: TradeDirection;
  confidence: number;     // 0–1
  reasoning: string;
  targetReturn: number;   // expected % return
  stopLoss: number;       // % from entry to stop
  takeProfit: number;     // % from entry to take profit
  expiresAt: number;      // epoch ms
}

export interface Trade {
  id: string;
  signalId: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;       // shares
  openedAt: number;
  closedAt?: number;
  pnl?: number;           // realised P&L in $
  pnlPct?: number;        // realised P&L in %
  strategy: string;
  reasoning: string;
  stopLossPct: number;    // e.g. 0.05
  takeProfitPct: number;  // e.g. 0.15
}

export interface Position {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  direction: TradeDirection;
  openedAt: number;
}

export interface PortfolioState {
  cash: number;
  totalValue: number;
  positions: Map<string, Position>;
  openTrades: Trade[];
  closedTrades: Trade[];
  signals: Signal[];
  dailyPnl: number;
  totalPnl: number;
  maxDrawdown: number;
  haltedUntil: number;  // epoch ms, 0 if not halted
}

export const PAPER_CONFIG = {
  startingCapital: 1_000_000,
  maxPositionPct: 0.10,
  maxSectorPct: 0.30,
  maxDailyLossPct: 0.05,
  maxDrawdownPct: 0.15,
  slippageBps: 5,
  commissionPerTrade: 0,
} as const;

const STORAGE_KEY = 'atlas-portfolio';
const STORAGE_VERSION = 2; // bump when Position interface changes

// ── Serialisation helpers ──────────────────────────────────────────────────────

interface StoredState {
  v?: number;
  cash: number;
  totalValue: number;
  positions: [string, Position][];
  openTrades: Trade[];
  closedTrades: Trade[];
  signals: Signal[];
  dailyPnl: number;
  totalPnl: number;
  maxDrawdown: number;
  haltedUntil: number;
  peakValue: number;
  dailyStartValue: number;
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class TradingEngine {
  private state: PortfolioState;
  private peakValue: number;
  private dailyStartValue: number;
  private prices: Map<string, number> = new Map();

  constructor() {
    const loaded = this.loadState();
    if (loaded) {
      this.state = loaded.state;
      this.peakValue = loaded.peakValue;
      this.dailyStartValue = loaded.dailyStartValue;
    } else {
      this.state = this.createInitialState();
      this.peakValue = PAPER_CONFIG.startingCapital;
      this.dailyStartValue = PAPER_CONFIG.startingCapital;
    }
  }

  private createInitialState(): PortfolioState {
    return {
      cash: PAPER_CONFIG.startingCapital,
      totalValue: PAPER_CONFIG.startingCapital,
      positions: new Map(),
      openTrades: [],
      closedTrades: [],
      signals: [],
      dailyPnl: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      haltedUntil: 0,
    };
  }

  private loadState(): { state: PortfolioState; peakValue: number; dailyStartValue: number } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw) as StoredState;

      // Clear stale data from older versions that used a different Position shape
      if ((data.v ?? 0) < STORAGE_VERSION) {
        console.warn('[TradingEngine] Stale localStorage version — clearing portfolio data');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // Filter out any malformed positions missing required fields
      const validPositions: [string, Position][] = (data.positions ?? []).filter(
        ([, pos]) =>
          pos &&
          typeof pos.direction === 'string' &&
          typeof pos.marketValue === 'number' &&
          typeof pos.quantity === 'number' &&
          typeof pos.avgEntryPrice === 'number'
      );

      const state: PortfolioState = {
        cash: data.cash ?? PAPER_CONFIG.startingCapital,
        totalValue: data.totalValue ?? PAPER_CONFIG.startingCapital,
        positions: new Map(validPositions),
        openTrades: data.openTrades ?? [],
        closedTrades: data.closedTrades ?? [],
        signals: data.signals ?? [],
        dailyPnl: data.dailyPnl ?? 0,
        totalPnl: data.totalPnl ?? 0,
        maxDrawdown: data.maxDrawdown ?? 0,
        haltedUntil: data.haltedUntil ?? 0,
      };
      return {
        state,
        peakValue: data.peakValue ?? PAPER_CONFIG.startingCapital,
        dailyStartValue: data.dailyStartValue ?? PAPER_CONFIG.startingCapital,
      };
    } catch {
      return null;
    }
  }

  private saveState(): void {
    try {
      const stored: StoredState = {
        v: STORAGE_VERSION,
        cash: this.state.cash,
        totalValue: this.state.totalValue,
        positions: Array.from(this.state.positions.entries()),
        openTrades: this.state.openTrades,
        closedTrades: this.state.closedTrades,
        signals: this.state.signals,
        dailyPnl: this.state.dailyPnl,
        totalPnl: this.state.totalPnl,
        maxDrawdown: this.state.maxDrawdown,
        haltedUntil: this.state.haltedUntil,
        peakValue: this.peakValue,
        dailyStartValue: this.dailyStartValue,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch (err) {
      console.error('[TradingEngine] Failed to save state:', err);
    }
  }

  private computeTotalValue(): number {
    let posValue = 0;
    for (const pos of this.state.positions.values()) {
      posValue += pos?.marketValue ?? 0;
    }
    return this.state.cash + posValue;
  }

  private updateDrawdown(): void {
    if (this.state.totalValue > this.peakValue) {
      this.peakValue = this.state.totalValue;
    }
    const drawdown = this.peakValue > 0
      ? (this.peakValue - this.state.totalValue) / this.peakValue
      : 0;
    if (drawdown > this.state.maxDrawdown) {
      this.state.maxDrawdown = drawdown;
    }
    if (drawdown >= PAPER_CONFIG.maxDrawdownPct) {
      console.warn(
        `[TradingEngine] Max drawdown threshold reached: ${(drawdown * 100).toFixed(1)}%`
      );
    }
  }

  private emitUpdate(): void {
    window.dispatchEvent(new CustomEvent('portfolio-updated', { detail: this.getState() }));
  }

  /**
   * Accept a trading signal and open a position.
   * Returns the created Trade, or null if the signal was rejected.
   */
  acceptSignal(signal: Signal): Trade | null {
    const now = Date.now();

    // Reject if halted
    if (this.state.haltedUntil > now) return null;

    // Reject expired signals
    if (signal.expiresAt < now) return null;

    // Reject duplicate (already have an open position for this symbol)
    if (this.state.positions.has(signal.symbol)) return null;

    // Check daily loss halt
    if (this.dailyStartValue > 0) {
      const dailyLossPct = -this.state.dailyPnl / this.dailyStartValue;
      if (dailyLossPct >= PAPER_CONFIG.maxDailyLossPct) {
        const nextMidnight = new Date();
        nextMidnight.setUTCHours(24, 0, 0, 0);
        this.state.haltedUntil = nextMidnight.getTime();
        this.saveState();
        return null;
      }
    }

    // Use known price or fall back to $100 (will update on next price tick)
    const basePrice = this.prices.get(signal.symbol) ?? 100;
    const slippageFactor = signal.direction === 'LONG'
      ? 1 + PAPER_CONFIG.slippageBps / 10_000
      : 1 - PAPER_CONFIG.slippageBps / 10_000;
    const entryPrice = basePrice * slippageFactor;

    // Kelly-like position sizing: confidence × 2% of portfolio ÷ stopLoss%, capped at maxPositionPct
    const stopLoss = signal.stopLoss > 0 ? signal.stopLoss : 0.05;
    const positionDollars = Math.min(
      (signal.confidence * 0.02 * this.state.totalValue) / stopLoss,
      PAPER_CONFIG.maxPositionPct * this.state.totalValue
    );

    if (positionDollars > this.state.cash) return null;

    const quantity = Math.floor(positionDollars / entryPrice);
    if (quantity <= 0) return null;

    const cost = entryPrice * quantity;
    const tradeId = `trade-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const trade: Trade = {
      id: tradeId,
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      status: 'OPEN',
      entryPrice,
      quantity,
      openedAt: now,
      strategy: signal.strategy,
      reasoning: signal.reasoning,
      stopLossPct: signal.stopLoss,
      takeProfitPct: signal.takeProfit,
    };

    const position: Position = {
      symbol: signal.symbol,
      quantity,
      avgEntryPrice: entryPrice,
      currentPrice: entryPrice,
      marketValue: cost,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      direction: signal.direction,
      openedAt: now,
    };

    this.state.cash -= cost;
    this.state.openTrades.push(trade);
    this.state.positions.set(signal.symbol, position);
    this.state.totalValue = this.computeTotalValue();

    this.saveState();
    this.emitUpdate();
    return trade;
  }

  /**
   * Close an open position by symbol.
   * Returns the closed Trade record, or null if not found.
   */
  closePosition(symbol: string, reason: string): Trade | null {
    const position = this.state.positions.get(symbol);
    if (!position) return null;

    const tradeIdx = this.state.openTrades.findIndex(
      t => t.symbol === symbol && t.status === 'OPEN'
    );
    if (tradeIdx < 0) return null;

    const trade = this.state.openTrades[tradeIdx];
    if (!trade) return null;

    const now = Date.now();
    const exitPrice = position.currentPrice;

    const pnl = position.direction === 'LONG'
      ? (exitPrice - position.avgEntryPrice) * position.quantity
      : (position.avgEntryPrice - exitPrice) * position.quantity;

    const cost = position.avgEntryPrice * position.quantity;
    const pnlPct = cost > 0 ? pnl / cost : 0;

    const closedTrade: Trade = {
      id: trade.id,
      signalId: trade.signalId,
      symbol: trade.symbol,
      direction: trade.direction,
      status: 'CLOSED',
      entryPrice: trade.entryPrice,
      exitPrice,
      quantity: trade.quantity,
      openedAt: trade.openedAt,
      closedAt: now,
      pnl,
      pnlPct,
      strategy: trade.strategy,
      reasoning: trade.reasoning,
      stopLossPct: trade.stopLossPct,
      takeProfitPct: trade.takeProfitPct,
    };

    // Return collateral + P&L to cash
    this.state.cash += cost + pnl;
    this.state.openTrades.splice(tradeIdx, 1);
    this.state.closedTrades.push(closedTrade);
    this.state.positions.delete(symbol);

    this.state.dailyPnl += pnl;
    this.state.totalPnl += pnl;
    this.state.totalValue = this.computeTotalValue();
    this.updateDrawdown();

    console.log(`[TradingEngine] Closed ${symbol} (${reason}): P&L $${pnl.toFixed(2)}`);
    this.saveState();
    this.emitUpdate();
    return closedTrade;
  }

  /**
   * Update current prices for all known symbols.
   * Recalculates unrealised P&L and checks SL/TP triggers.
   */
  updatePrices(quotes: Record<string, number>): void {
    const toClose: Array<{ symbol: string; reason: string }> = [];

    for (const [symbol, price] of Object.entries(quotes)) {
      this.prices.set(symbol, price);

      const position = this.state.positions.get(symbol);
      if (!position) continue;

      position.currentPrice = price;
      const unrealizedPnl = position.direction === 'LONG'
        ? (price - position.avgEntryPrice) * position.quantity
        : (position.avgEntryPrice - price) * position.quantity;

      position.unrealizedPnl = unrealizedPnl;
      const cost = position.avgEntryPrice * position.quantity;
      position.unrealizedPnlPct = cost > 0 ? unrealizedPnl / cost : 0;
      position.marketValue = cost + unrealizedPnl;

      const trade = this.state.openTrades.find(t => t.symbol === symbol && t.status === 'OPEN');
      if (!trade) continue;

      if (position.direction === 'LONG') {
        if (price <= trade.entryPrice * (1 - trade.stopLossPct)) {
          toClose.push({ symbol, reason: 'stop-loss' });
        } else if (price >= trade.entryPrice * (1 + trade.takeProfitPct)) {
          toClose.push({ symbol, reason: 'take-profit' });
        }
      } else {
        if (price >= trade.entryPrice * (1 + trade.stopLossPct)) {
          toClose.push({ symbol, reason: 'stop-loss' });
        } else if (price <= trade.entryPrice * (1 - trade.takeProfitPct)) {
          toClose.push({ symbol, reason: 'take-profit' });
        }
      }
    }

    this.state.totalValue = this.computeTotalValue();

    for (const { symbol, reason } of toClose) {
      this.closePosition(symbol, reason);
    }

    if (toClose.length === 0) {
      this.saveState();
      this.emitUpdate();
    }
  }

  getState(): PortfolioState {
    return this.state;
  }

  getDailyStats(): { dailyPnl: number; dailyPnlPct: number; openPositions: number } {
    return {
      dailyPnl: this.state.dailyPnl,
      dailyPnlPct: this.dailyStartValue > 0
        ? this.state.dailyPnl / this.dailyStartValue
        : 0,
      openPositions: this.state.positions.size,
    };
  }

  resetPortfolio(): void {
    this.state = this.createInitialState();
    this.peakValue = PAPER_CONFIG.startingCapital;
    this.dailyStartValue = PAPER_CONFIG.startingCapital;
    this.prices.clear();
    localStorage.removeItem(STORAGE_KEY);
    this.emitUpdate();
  }
}

export const tradingEngine = new TradingEngine();
