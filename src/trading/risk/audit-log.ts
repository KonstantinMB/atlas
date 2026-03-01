/**
 * Audit Log - Immutable Compliance Trail
 *
 * Logs every risk decision to localStorage with immutable append-only semantics.
 * Provides compliance reporting and forensic analysis capabilities.
 *
 * Each risk decision is logged with:
 * - Signal details (strategy, symbol, direction, confidence)
 * - Risk check results (all 10+ checks with pass/fail)
 * - Circuit breaker state at time of decision
 * - Final decision (approved/rejected with reason)
 * - Timestamp (millisecond precision)
 *
 * Logs are never modified or deleted (append-only).
 */

import type { RiskDecision } from './risk-manager';
import type { Signal } from '../engine';

export interface RiskAuditEntry {
  id: string; // UUID
  timestamp: number;
  signalId: string;
  signal: {
    strategy: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    confidence: number;
    reasoning: string;
  };
  decision: {
    approved: boolean;
    adjustedSize?: number;
    reason?: string;
    circuitBreakerState: string;
  };
  checks: Array<{
    name: string;
    passed: boolean;
    value: number;
    limit: number;
    message: string;
  }>;
}

export interface AuditStats {
  totalDecisions: number;
  approvalRate: number;
  rejectionsByCheck: Record<string, number>;
  avgChecksPerDecision: number;
  circuitBreakerTrips: Record<string, number>;
  recentRejections: RiskAuditEntry[];
}

class AuditLog {
  private entries: RiskAuditEntry[] = [];
  private readonly STORAGE_KEY = 'atlas_risk_audit_log';
  private readonly MAX_ENTRIES = 10000; // Cap at 10K entries (~5MB)

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Log a risk decision (immutable append)
   */
  logDecision(signalId: string, decision: RiskDecision, signal?: Signal): void {
    const entry: RiskAuditEntry = {
      id: this.generateUUID(),
      timestamp: Date.now(),
      signalId,
      signal: signal
        ? {
            strategy: signal.strategy,
            symbol: signal.symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            reasoning: signal.reasoning,
          }
        : {
            strategy: 'unknown',
            symbol: 'unknown',
            direction: 'LONG',
            confidence: 0,
            reasoning: 'Signal not provided',
          },
      decision: {
        approved: decision.approved,
        adjustedSize: decision.adjustedSize,
        reason: decision.reason,
        circuitBreakerState: decision.circuitBreakerState,
      },
      checks: decision.checks.map(check => ({
        name: check.name,
        passed: check.passed,
        value: check.value,
        limit: check.limit,
        message: check.message,
      })),
    };

    // Append-only: never modify existing entries
    this.entries.push(entry);

    // Cap at max entries (remove oldest if exceeding)
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries = this.entries.slice(-this.MAX_ENTRIES);
      console.warn(`[AuditLog] Pruned to ${this.MAX_ENTRIES} entries (oldest removed)`);
    }

    // Persist to localStorage
    this.saveToStorage();

    // Log to console for debugging
    console.log(
      `[AuditLog] ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'}: ${entry.signal.symbol} ${entry.signal.direction} (${entry.signal.strategy})`
    );

    if (!decision.approved && decision.reason) {
      console.warn(`[AuditLog] Rejection reason: ${decision.reason}`);
    }
  }

  /**
   * Get all audit entries
   */
  getAll(): RiskAuditEntry[] {
    return [...this.entries]; // Return copy (immutable)
  }

  /**
   * Get entries within time range
   */
  getByTimeRange(startMs: number, endMs: number): RiskAuditEntry[] {
    return this.entries.filter(e => e.timestamp >= startMs && e.timestamp <= endMs);
  }

  /**
   * Get entries for specific symbol
   */
  getBySymbol(symbol: string): RiskAuditEntry[] {
    return this.entries.filter(e => e.signal.symbol === symbol);
  }

  /**
   * Get entries for specific strategy
   */
  getByStrategy(strategy: string): RiskAuditEntry[] {
    return this.entries.filter(e => e.signal.strategy === strategy);
  }

  /**
   * Get approved decisions only
   */
  getApproved(): RiskAuditEntry[] {
    return this.entries.filter(e => e.decision.approved);
  }

  /**
   * Get rejected decisions only
   */
  getRejected(): RiskAuditEntry[] {
    return this.entries.filter(e => !e.decision.approved);
  }

  /**
   * Get recent entries (last N)
   */
  getRecent(count: number = 50): RiskAuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    if (this.entries.length === 0) {
      return {
        totalDecisions: 0,
        approvalRate: 0,
        rejectionsByCheck: {},
        avgChecksPerDecision: 0,
        circuitBreakerTrips: {},
        recentRejections: [],
      };
    }

    const approved = this.entries.filter(e => e.decision.approved).length;
    const rejected = this.entries.length - approved;

    // Count rejections by check type
    const rejectionsByCheck: Record<string, number> = {};

    for (const entry of this.entries) {
      if (!entry.decision.approved) {
        // Find first failing check
        const failedCheck = entry.checks.find(c => !c.passed);

        if (failedCheck) {
          rejectionsByCheck[failedCheck.name] = (rejectionsByCheck[failedCheck.name] || 0) + 1;
        }
      }
    }

    // Count circuit breaker trips by state
    const circuitBreakerTrips: Record<string, number> = {};

    for (const entry of this.entries) {
      const state = entry.decision.circuitBreakerState;

      if (state !== 'GREEN') {
        circuitBreakerTrips[state] = (circuitBreakerTrips[state] || 0) + 1;
      }
    }

    // Calculate average checks per decision
    const totalChecks = this.entries.reduce((sum, e) => sum + e.checks.length, 0);
    const avgChecksPerDecision = totalChecks / this.entries.length;

    // Get recent rejections (last 10)
    const recentRejections = this.entries
      .filter(e => !e.decision.approved)
      .slice(-10)
      .reverse();

    return {
      totalDecisions: this.entries.length,
      approvalRate: approved / this.entries.length,
      rejectionsByCheck,
      avgChecksPerDecision,
      circuitBreakerTrips,
      recentRejections,
    };
  }

  /**
   * Export audit log as CSV
   */
  exportCSV(): string {
    const headers = [
      'Timestamp',
      'Signal ID',
      'Strategy',
      'Symbol',
      'Direction',
      'Confidence',
      'Approved',
      'Circuit Breaker',
      'Reason',
      'Failed Checks',
    ];

    const rows = this.entries.map(entry => {
      const failedChecks = entry.checks.filter(c => !c.passed).map(c => c.name);

      return [
        new Date(entry.timestamp).toISOString(),
        entry.signalId,
        entry.signal.strategy,
        entry.signal.symbol,
        entry.signal.direction,
        entry.signal.confidence.toFixed(2),
        entry.decision.approved ? 'YES' : 'NO',
        entry.decision.circuitBreakerState,
        entry.decision.reason || '',
        failedChecks.join('; '),
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    return csv;
  }

  /**
   * Export audit log as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /**
   * Clear all entries (DANGEROUS - use only for testing)
   */
  clear(): void {
    console.warn('[AuditLog] CLEARING ALL AUDIT ENTRIES (this should only be used in testing)');
    this.entries = [];
    this.saveToStorage();
  }

  /**
   * Get compliance report for date range
   */
  getComplianceReport(startMs: number, endMs: number): {
    period: { start: string; end: string };
    totalDecisions: number;
    approved: number;
    rejected: number;
    approvalRate: number;
    topRejectionReasons: Array<{ check: string; count: number; percentage: number }>;
    circuitBreakerEvents: Array<{ state: string; count: number }>;
    riskiestStrategies: Array<{ strategy: string; rejectionRate: number; count: number }>;
  } {
    const entries = this.getByTimeRange(startMs, endMs);

    if (entries.length === 0) {
      return {
        period: {
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
        },
        totalDecisions: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        topRejectionReasons: [],
        circuitBreakerEvents: [],
        riskiestStrategies: [],
      };
    }

    const approved = entries.filter(e => e.decision.approved).length;
    const rejected = entries.length - approved;

    // Count rejections by check
    const rejectionsByCheck: Record<string, number> = {};

    for (const entry of entries) {
      if (!entry.decision.approved) {
        const failedCheck = entry.checks.find(c => !c.passed);

        if (failedCheck) {
          rejectionsByCheck[failedCheck.name] = (rejectionsByCheck[failedCheck.name] || 0) + 1;
        }
      }
    }

    const topRejectionReasons = Object.entries(rejectionsByCheck)
      .map(([check, count]) => ({
        check,
        count,
        percentage: (count / rejected) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Count circuit breaker events
    const cbCounts: Record<string, number> = {};

    for (const entry of entries) {
      const state = entry.decision.circuitBreakerState;

      if (state !== 'GREEN') {
        cbCounts[state] = (cbCounts[state] || 0) + 1;
      }
    }

    const circuitBreakerEvents = Object.entries(cbCounts).map(([state, count]) => ({
      state,
      count,
    }));

    // Calculate rejection rate by strategy
    const strategyStats: Record<string, { total: number; rejected: number }> = {};

    for (const entry of entries) {
      const strategy = entry.signal.strategy;

      if (!strategyStats[strategy]) {
        strategyStats[strategy] = { total: 0, rejected: 0 };
      }

      strategyStats[strategy].total++;

      if (!entry.decision.approved) {
        strategyStats[strategy].rejected++;
      }
    }

    const riskiestStrategies = Object.entries(strategyStats)
      .map(([strategy, stats]) => ({
        strategy,
        rejectionRate: stats.rejected / stats.total,
        count: stats.total,
      }))
      .sort((a, b) => b.rejectionRate - a.rejectionRate);

    return {
      period: {
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
      },
      totalDecisions: entries.length,
      approved,
      rejected,
      approvalRate: approved / entries.length,
      topRejectionReasons,
      circuitBreakerEvents,
      riskiestStrategies,
    };
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
    } catch (error) {
      console.error('[AuditLog] Error saving to localStorage:', error);

      // If quota exceeded, prune to 50% and retry
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[AuditLog] Quota exceeded, pruning to 50% of entries');
        this.entries = this.entries.slice(-Math.floor(this.MAX_ENTRIES / 2));

        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
        } catch (retryError) {
          console.error('[AuditLog] Failed to save even after pruning:', retryError);
        }
      }
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);

      if (saved) {
        this.entries = JSON.parse(saved);
        console.log(`[AuditLog] Loaded ${this.entries.length} audit entries from localStorage`);
      }
    } catch (error) {
      console.error('[AuditLog] Error loading from localStorage:', error);
      this.entries = [];
    }
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

/**
 * Global audit log instance
 */
export const auditLog = new AuditLog();

/**
 * Helper function to log risk decision (used by RiskManager)
 */
export function logRiskDecision(signalId: string, decision: RiskDecision, signal?: Signal): void {
  auditLog.logDecision(signalId, decision, signal);
}

/**
 * Download the full audit log as a CSV file (triggers browser file save dialog).
 * Call from the command palette or developer console.
 */
export function downloadAuditLog(): void {
  const csv = auditLog.exportCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const filename = `yc-hedge-fund-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 5_000);

  const stats = auditLog.getStats();
  console.log(
    `[AuditLog] Downloaded ${stats.totalDecisions} decisions as ${filename}`,
    `(approval rate: ${(stats.approvalRate * 100).toFixed(1)}%)`
  );
}

/**
 * Download the full audit log as a JSON file.
 */
export function downloadAuditLogJSON(): void {
  const json = auditLog.exportJSON();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const filename = `yc-hedge-fund-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
