/**
 * Server Sync — Portfolio ↔ API
 *
 * Layer 1: localStorage (instant, offline-capable)
 * Layer 2: Redis via API (persistent, cross-device)
 *
 * WRITE: Debounce 5s after portfolio-updated, then PUT to /api/trading/portfolio
 * READ: On auth, fetch from server; latest timestamp wins
 */

import { auth } from '../../auth/auth-manager';
import { portfolioManager } from './portfolio-manager';
import type { ManagedPosition, ClosedTrade, EquityPoint } from './portfolio-manager';

const DEBOUNCE_MS = 5_000;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRetry = false;

function getAuthHeaders(): Record<string, string> {
  const token = auth.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function putToServer(): Promise<boolean> {
  if (!auth.isAuthenticated()) return false;

  const payload = portfolioManager.getStoredPayload();

  try {
    const res = await fetch('/api/trading/portfolio', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      pendingRetry = true;
      return false;
    }
    return true;
  } catch {
    pendingRetry = true;
    return false;
  }
}

function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void putToServer();
  }, DEBOUNCE_MS);
}

const STARTING_CAPITAL = 1_000_000;

function isServerDefault(data: Record<string, unknown>): boolean {
  const positions = (data.positions as unknown[]) ?? [];
  const closedTrades = (data.closedTrades as unknown[]) ?? [];
  const cash = (data.cash as number) ?? STARTING_CAPITAL;
  return positions.length === 0 && closedTrades.length === 0 && cash === STARTING_CAPITAL;
}

export async function pushLocalToServer(): Promise<boolean> {
  if (!auth.isAuthenticated()) return false;
  try {
    return await putToServer();
  } catch {
    return false;
  }
}

export async function resetPortfolioOnServer(): Promise<boolean> {
  if (!auth.isAuthenticated()) return false;
  try {
    const res = await fetch('/api/trading/portfolio/reset', {
      method: 'POST',
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
    if (!json.success || !json.data) return false;
    const data = json.data;
    const serverSavedAt = (data.savedAt as number) ?? Date.now();
    portfolioManager.loadFromServer({
      cash: data.cash as number,
      positions: ((data.positions as unknown[]) ?? []) as ManagedPosition[],
      closedTrades: ((data.closedTrades as unknown[]) ?? []) as ClosedTrade[],
      realizedPnl: (data.realizedPnl as number) ?? 0,
      highWaterMark: (data.highWaterMark as number) ?? STARTING_CAPITAL,
      maxDrawdown: (data.maxDrawdown as number) ?? 0,
      dailyStartValue: (data.dailyStartValue as number) ?? STARTING_CAPITAL,
      equityCurve: ((data.equityCurve as unknown[]) ?? []) as EquityPoint[],
      savedAt: serverSavedAt,
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadServerPortfolio(): Promise<boolean> {
  if (!auth.isAuthenticated()) return false;
  try {
    const res = await fetch('/api/trading/portfolio', {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: unknown };
    const data = json.data as Record<string, unknown> | undefined;
    if (!data) return false;
    const serverSavedAt = (data.savedAt as number) ?? Date.now();
    portfolioManager.loadFromServer({
      cash: data.cash as number,
      positions: ((data.positions as unknown[]) ?? []) as ManagedPosition[],
      closedTrades: ((data.closedTrades as unknown[]) ?? []) as ClosedTrade[],
      realizedPnl: (data.realizedPnl as number) ?? 0,
      highWaterMark: (data.highWaterMark as number) ?? STARTING_CAPITAL,
      maxDrawdown: (data.maxDrawdown as number) ?? 0,
      dailyStartValue: (data.dailyStartValue as number) ?? STARTING_CAPITAL,
      equityCurve: ((data.equityCurve as unknown[]) ?? []) as EquityPoint[],
      savedAt: serverSavedAt,
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchFromServer(): Promise<boolean> {
  if (!auth.isAuthenticated()) return false;

  try {
    const res = await fetch('/api/trading/portfolio', {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;

    const json = (await res.json()) as { data?: unknown; timestamp?: number };
    const data = json.data as Record<string, unknown> | undefined;
    if (!data) return false;

    const localRaw = localStorage.getItem('atlas-portfolio-v2');
    const localSavedAt = localRaw ? (JSON.parse(localRaw) as { savedAt?: number }).savedAt ?? 0 : 0;
    const serverSavedAt = (data.savedAt as number) ?? 0;

    // Migration prompt: server has default, local has data — let user choose
    if (isServerDefault(data) && portfolioManager.hasLocalData()) {
      window.dispatchEvent(new CustomEvent('portfolio:migration-prompt'));
      return true;
    }

    if (serverSavedAt >= localSavedAt) {
      portfolioManager.loadFromServer({
        cash: data.cash as number,
        positions: ((data.positions as unknown[]) ?? []) as ManagedPosition[],
        closedTrades: ((data.closedTrades as unknown[]) ?? []) as ClosedTrade[],
        realizedPnl: (data.realizedPnl as number) ?? 0,
        highWaterMark: (data.highWaterMark as number) ?? 1_000_000,
        maxDrawdown: (data.maxDrawdown as number) ?? 0,
        dailyStartValue: (data.dailyStartValue as number) ?? 1_000_000,
        equityCurve: ((data.equityCurve as unknown[]) ?? []) as EquityPoint[],
        savedAt: serverSavedAt,
      });
      return true;
    }

    // Local is newer — push to server
    await putToServer();
    return true;
  } catch {
    return false;
  }
}

export function initServerSync(): void {
  window.addEventListener('portfolio-updated', () => {
    if (auth.isAuthenticated()) scheduleSync();
  });

  window.addEventListener('auth:authenticated', (e: Event) => {
    const authenticated = (e as CustomEvent<boolean>).detail;
    if (authenticated) {
      void fetchFromServer();
    }
  });

  if (auth.isAuthenticated()) {
    void fetchFromServer();
  }
}
