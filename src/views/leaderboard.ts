/**
 * Leaderboard View — Paper trading rankings
 *
 * Full-width page at /leaderboard. Period pills, table, polling.
 */

import { auth } from '../auth/auth-manager';
import { openAuthModal } from '../auth/auth-modal';

const POLL_INTERVAL_MS = 90_000;

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

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

let containerEl: HTMLElement | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let currentPeriod: Period = 'monthly';
let currentUsername: string | null = null;
let lastResponse: LeaderboardResponse | null = null;

function formatReturn(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function formatNav(nav: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(nav);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

async function fetchLeaderboard(period: Period): Promise<LeaderboardResponse | null> {
  const headers: Record<string, string> = {};
  const token = auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/leaderboard?period=${period}&limit=100`, { headers });
    if (!res.ok) return null;
    return (await res.json()) as LeaderboardResponse;
  } catch {
    return null;
  }
}

function renderSkeleton(): void {
  if (!containerEl) return;
  const tableWrap = containerEl.querySelector('.leaderboard-table-wrap');
  if (!tableWrap) return;

  tableWrap.innerHTML = `
    <div class="leaderboard-skeleton">
      ${Array.from({ length: 8 }, () => `
        <div class="leaderboard-skeleton-row">
          <div class="leaderboard-skeleton-cell" style="width:3rem"></div>
          <div class="leaderboard-skeleton-cell" style="width:8rem"></div>
          <div class="leaderboard-skeleton-cell" style="width:5rem"></div>
          <div class="leaderboard-skeleton-cell" style="width:4rem"></div>
          <div class="leaderboard-skeleton-cell" style="width:6rem"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildTooltipContent(e: LeaderboardEntry, data: LeaderboardResponse): string {
  const parts: string[] = [];
  parts.push(`Period: ${formatDate(new Date(data.periodStart).getTime())} – ${formatDate(new Date(data.periodEnd).getTime())}`);
  parts.push(`Trades: ${e.tradeCount}`);
  if (e.maxDrawdown != null && e.maxDrawdown > 0) {
    parts.push(`Max drawdown: ${(e.maxDrawdown * 100).toFixed(1)}%`);
  }
  if (e.createdAt != null) {
    parts.push(`Joined: ${formatDate(e.createdAt)}`);
  }
  return parts.join(' • ');
}

function renderTable(data: LeaderboardResponse): void {
  if (!containerEl) return;
  lastResponse = data;
  const tableWrap = containerEl.querySelector('.leaderboard-table-wrap');
  const subheader = containerEl.querySelector('.leaderboard-subheader');
  const rankCallout = containerEl.querySelector('.leaderboard-rank-callout');
  if (!tableWrap || !subheader) return;

  subheader.textContent = `Ranked by portfolio return • Last updated: ${formatTime(data.updatedAt)}`;

  // Your rank callout: show when logged in and user not in top 10
  const userRank = data.currentUserRank ?? (data.currentUserEntry?.rank);
  const showRankCallout = currentUsername !== null && userRank != null && userRank > 10;
  if (rankCallout) {
    if (showRankCallout) {
      rankCallout.classList.remove('leaderboard-rank-callout-hidden');
      const text = rankCallout.querySelector('.leaderboard-rank-callout-text');
      if (text) text.textContent = `Your rank: #${userRank}`;
      (rankCallout as HTMLElement).onclick = () => {
        const row = tableWrap.querySelector(`tr[data-username="${escapeAttr(currentUsername ?? '')}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    } else {
      rankCallout.classList.add('leaderboard-rank-callout-hidden');
    }
  }

  if (data.entries.length === 0) {
    tableWrap.innerHTML = `
      <div class="leaderboard-empty">
        <p>No traders yet. Sign up and start paper trading to compete.</p>
      </div>
    `;
    return;
  }

  const thead = `
    <thead>
      <tr>
        <th class="leaderboard-th-rank">Rank</th>
        <th class="leaderboard-th-username">Username</th>
        <th class="leaderboard-th-return">Return %</th>
        <th class="leaderboard-th-nav">NAV</th>
      </tr>
    </thead>
  `;

  const podiumIcons = ['🥇', '🥈', '🥉'];
  const rows = data.entries.map((e) => {
    const isCurrentUser = currentUsername !== null && e.username === currentUsername;
    const baseRowClass = 'leaderboard-row';
    const rowClasses = [baseRowClass];
    if (isCurrentUser) rowClasses.push('leaderboard-row-me');
    if (e.rank <= 3) rowClasses.push(`leaderboard-row-podium leaderboard-row-podium-${e.rank}`);
    const rowClass = rowClasses.join(' ');
    const returnClass = e.returnPct >= 0 ? 'leaderboard-return-pos' : 'leaderboard-return-neg';
    let returnHtml = `<span class="${returnClass}">${formatReturn(e.returnPct)}</span>`;
    if (e.rankChange !== null) {
      const up = e.rankChange > 0;
      returnHtml += ` <span class="leaderboard-change-inline ${up ? 'leaderboard-change-up' : 'leaderboard-change-down'}">${up ? '▲' : '▼'}${Math.abs(e.rankChange)}</span>`;
    } else {
      returnHtml += ' <span class="leaderboard-change-inline leaderboard-change-none">—</span>';
    }
    const podiumIcon = e.rank <= 3 ? podiumIcons[e.rank - 1]! : '';
    const rankCell = podiumIcon ? `${podiumIcon} ${e.rank}` : String(e.rank);
    const tooltip = buildTooltipContent(e, data);
    return `
      <tr class="${rowClass}" data-username="${escapeAttr(e.username)}" data-tooltip="${escapeAttr(tooltip)}" title="${escapeAttr(tooltip)}">
        <td class="leaderboard-td-rank">${rankCell}</td>
        <td class="leaderboard-td-username">${escapeHtml(e.username)}</td>
        <td class="leaderboard-td-return">${returnHtml}</td>
        <td class="leaderboard-td-nav">${formatNav(e.nav)}</td>
      </tr>
    `;
  }).join('');

  tableWrap.innerHTML = `
    <div class="leaderboard-table-scroll">
      <table class="leaderboard-table">
        ${thead}
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderBanner(): void {
  if (!containerEl) return;
  const banner = containerEl.querySelector('.leaderboard-banner');
  if (!banner) return;

  if (auth.isAuthenticated()) {
    banner.classList.add('leaderboard-banner-hidden');
    return;
  }

  banner.classList.remove('leaderboard-banner-hidden');
  const text = banner.querySelector('.leaderboard-banner-text');
  const btn = banner.querySelector('.leaderboard-banner-btn') as HTMLButtonElement | null;
  if (text) text.textContent = 'Compete with other traders. Sign up to start paper trading.';
  if (btn) {
    btn.textContent = 'Sign Up';
    btn.onclick = () => openAuthModal({ tab: 'register' });
  }
}

async function loadAndRender(): Promise<void> {
  if (!containerEl) return;

  renderSkeleton();
  const data = await fetchLeaderboard(currentPeriod);
  if (!data) {
    const tableWrap = containerEl.querySelector('.leaderboard-table-wrap');
    if (tableWrap) {
      tableWrap.innerHTML = '<div class="leaderboard-error"><p>Failed to load leaderboard. Try again later.</p></div>';
    }
    return;
  }

  renderTable(data);
  renderBanner();
}

function schedulePoll(): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      void loadAndRender();
    }
    schedulePoll();
  }, POLL_INTERVAL_MS);
}

function createView(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.id = 'leaderboard-view';
  wrap.className = 'leaderboard-view';

  wrap.innerHTML = `
    <div class="leaderboard-banner leaderboard-banner-hidden" role="banner">
      <span class="leaderboard-banner-text">Compete with other traders. Sign up to start paper trading.</span>
      <button type="button" class="leaderboard-banner-btn">Sign Up</button>
    </div>
    <div class="leaderboard-content">
      <h1 class="leaderboard-title">LEADERBOARD</h1>
      <div class="leaderboard-pills">
        <button type="button" class="leaderboard-pill" data-period="weekly">Weekly</button>
        <button type="button" class="leaderboard-pill" data-period="monthly">Monthly</button>
        <button type="button" class="leaderboard-pill" data-period="quarterly">Quarterly</button>
        <button type="button" class="leaderboard-pill" data-period="yearly">Yearly</button>
      </div>
      <p class="leaderboard-subheader">Ranked by portfolio return • Last updated: —</p>
      <div class="leaderboard-rank-callout leaderboard-rank-callout-hidden" role="button" tabindex="0">
        <span class="leaderboard-rank-callout-text">Your rank: #—</span>
        <span class="leaderboard-rank-callout-hint">Click to scroll to your row</span>
      </div>
      <div class="leaderboard-table-wrap"></div>
    </div>
  `;

  wrap.querySelectorAll('.leaderboard-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const period = (btn as HTMLElement).dataset.period as Period;
      if (!period || period === currentPeriod) return;
      currentPeriod = period;
      wrap.querySelectorAll('.leaderboard-pill').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      void loadAndRender();
    });
  });

  return wrap;
}

export function initLeaderboardView(parent: HTMLElement): HTMLElement {
  containerEl = createView();
  parent.appendChild(containerEl);

  currentUsername = auth.getUser()?.username ?? null;
  window.addEventListener('auth:authenticated', () => {
    currentUsername = auth.getUser()?.username ?? null;
    renderBanner();
    void loadAndRender();
  });

  const monthlyBtn = containerEl.querySelector('[data-period="monthly"]');
  if (monthlyBtn) monthlyBtn.classList.add('active');

  void loadAndRender();
  schedulePoll();

  return containerEl;
}

export function showLeaderboard(): void {
  const view = document.getElementById('leaderboard-view');
  const globe = document.getElementById('globe-container');
  const left = document.getElementById('left-panel');
  const right = document.getElementById('right-panel');
  const status = document.getElementById('status-bar');

  if (view) view.style.display = '';
  if (globe) globe.style.display = 'none';
  if (left) left.style.display = 'none';
  if (right) right.style.display = 'none';
  if (status) status.style.display = 'none';
}

export function hideLeaderboard(): void {
  const view = document.getElementById('leaderboard-view');
  const globe = document.getElementById('globe-container');
  const left = document.getElementById('left-panel');
  const right = document.getElementById('right-panel');
  const status = document.getElementById('status-bar');

  if (view) view.style.display = 'none';
  if (globe) globe.style.display = '';
  if (left) left.style.display = '';
  if (right) right.style.display = '';
  if (status) status.style.display = '';
}

export function destroyLeaderboard(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  containerEl?.remove();
  containerEl = null;
}
