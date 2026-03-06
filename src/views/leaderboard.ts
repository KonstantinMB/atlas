/**
 * Leaderboard View — Paper trading rankings
 *
 * Full-width page at /leaderboard. Period pills, table, polling.
 */

import { auth } from '../auth/auth-manager';
import { openAuthModal } from '../auth/auth-modal';
import { getMockLeaderboardData, isMockDataEnabled } from '../data/mock-leaderboard';
import { createRewardsShowcase, createRewardsTeaser, createMockModeToggle, createCompetitionStats } from './leaderboard-rewards';

const POLL_INTERVAL_MS = 90_000;

interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName?: string;
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
  // Check if mock mode is enabled
  if (isMockDataEnabled()) {
    const mockEntries = getMockLeaderboardData(period);
    const now = Date.now();
    const periodDays = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 }[period];
    const periodStart = new Date(now - periodDays * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now);

    return {
      period,
      periodLabel: period.charAt(0).toUpperCase() + period.slice(1),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      updatedAt: now,
      entries: mockEntries,
      totalCount: mockEntries.length,
    };
  }

  // Real API call
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
  const subheaderText = containerEl.querySelector('.leaderboard-subheader-text');
  const subheader = containerEl.querySelector('.leaderboard-subheader');
  const rankCallout = containerEl.querySelector('.leaderboard-rank-callout');
  if (!tableWrap || !subheaderText) return;

  subheaderText.textContent = `Ranked by portfolio return • You appear on all time periods when you trade • Last updated: ${formatTime(data.updatedAt)}`;
  updateAuthActionsVisibility();

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

  // Show current user even when main entries empty (e.g. they're in set but not in top N, or set is sparse)
  const entriesToShow = data.entries.length > 0
    ? data.entries
    : data.currentUserEntry
      ? [data.currentUserEntry]
      : [];

  if (entriesToShow.length === 0) {
    const msg = auth.isAuthenticated()
      ? 'No traders yet. Trade to appear on all periods — your rank updates after each portfolio save.'
      : 'No traders yet. Sign up and start paper trading to compete.';
    tableWrap.innerHTML = `
      <div class="leaderboard-empty">
        <p>${msg}</p>
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
  const rows = entriesToShow.map((e) => {
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
        <td class="leaderboard-td-username">${escapeHtml(e.displayName || e.username)}</td>
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

function updateAuthActionsVisibility(): void {
  if (!containerEl) return;
  const show = auth.isAuthenticated();
  const syncBtn = containerEl.querySelector('#leaderboard-sync-btn');
  const profileBtn = containerEl.querySelector('#leaderboard-profile-btn');
  if (syncBtn) (syncBtn as HTMLElement).style.display = show ? '' : 'none';
  if (profileBtn) (profileBtn as HTMLElement).style.display = show ? '' : 'none';
}

function renderBanner(): void {
  if (!containerEl) return;
  const banner = containerEl.querySelector('.leaderboard-banner');
  if (!banner) return;

  updateAuthActionsVisibility();

  if (auth.isAuthenticated()) {
    banner.classList.add('leaderboard-banner-hidden');
    return;
  }

  banner.classList.remove('leaderboard-banner-hidden');
  const text = banner.querySelector('.leaderboard-banner-text');
  const btn = banner.querySelector('.leaderboard-banner-btn') as HTMLButtonElement | null;
  if (text) text.textContent = 'Join the competition! Sign up and start paper trading to climb the ranks.';
  if (btn) {
    btn.textContent = 'Sign Up & Trade';
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
    updateAuthActionsVisibility();
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
      <span class="leaderboard-banner-text">Join the competition! Sign up and start paper trading to climb the ranks.</span>
      <button type="button" class="leaderboard-banner-btn">Sign Up & Trade</button>
    </div>
    <div class="leaderboard-mobile-desktop-cta" role="complementary" aria-label="Desktop experience">
      <img src="/icon-192.png" alt="YC Hedge Fund" class="leaderboard-mobile-desktop-cta-logo" width="48" height="48" />
      <div class="leaderboard-mobile-desktop-cta-content">
        <p class="leaderboard-mobile-desktop-cta-text">Want to trade on the map and use all features? Open on desktop for the full experience.</p>
      </div>
    </div>
    <div class="leaderboard-content">
      <div class="leaderboard-hero">
        <div class="leaderboard-logo-trophy-big">🏆</div>
        <h1 class="leaderboard-logo">PAPER TRADING CHAMPIONS</h1>
        <p class="leaderboard-tagline">Compete with traders worldwide • $1M virtual capital • Real rankings, zero risk</p>
      </div>
      <div id="leaderboard-competition-stats-section"></div>
      <div id="leaderboard-rewards-section"></div>
      <div id="leaderboard-rewards-teaser-section"></div>
      <div class="leaderboard-controls">
        <div id="leaderboard-mock-toggle-section"></div>
        <div class="leaderboard-pills">
          <button type="button" class="leaderboard-pill" data-period="weekly">Weekly</button>
          <button type="button" class="leaderboard-pill" data-period="monthly">Monthly</button>
          <button type="button" class="leaderboard-pill" data-period="quarterly">Quarterly</button>
          <button type="button" class="leaderboard-pill" data-period="yearly">Yearly</button>
        </div>
      </div>
      <div class="leaderboard-subheader">
        <span class="leaderboard-subheader-text">Ranked by portfolio return • You appear on all time periods when you trade • Last updated: —</span>
        <div class="leaderboard-subheader-actions">
          <button type="button" class="leaderboard-profile-btn" id="leaderboard-profile-btn" title="Edit your display name for the leaderboard" style="display:none">✎ Edit Profile</button>
          <button type="button" class="leaderboard-sync-btn" id="leaderboard-sync-btn" title="Sync portfolio to update your rank on all periods" style="display:none">↻ Sync</button>
        </div>
      </div>
      <div class="leaderboard-rank-callout leaderboard-rank-callout-hidden" role="button" tabindex="0">
        <span class="leaderboard-rank-callout-text">Your rank: #—</span>
        <span class="leaderboard-rank-callout-hint">Click to scroll to your row</span>
      </div>
      <div class="leaderboard-table-wrap"></div>
    </div>
  `;

  const syncBtn = wrap.querySelector('#leaderboard-sync-btn');
  syncBtn?.addEventListener('click', async () => {
    if (!auth.isAuthenticated()) return;
    const { pushLocalToServer } = await import('../trading/engine/server-sync');
    const ok = await pushLocalToServer();
    const { showToast } = await import('../lib/toast');
    showToast(ok ? 'Portfolio synced — rank will update shortly' : 'Sync failed');
    if (ok) void loadAndRender();
  });

  const profileBtn = wrap.querySelector('#leaderboard-profile-btn');
  profileBtn?.addEventListener('click', () => {
    import('../auth/profile-modal').then(({ openProfileModal }) => openProfileModal());
  });

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

  // Inject competition stats (always visible in mock mode)
  const statsSection = containerEl.querySelector('#leaderboard-competition-stats-section');
  if (statsSection && isMockDataEnabled()) {
    statsSection.appendChild(createCompetitionStats());
  }

  // Inject rewards showcase (always visible in mock mode demo)
  const rewardsSection = containerEl.querySelector('#leaderboard-rewards-section');
  if (rewardsSection && isMockDataEnabled()) {
    rewardsSection.appendChild(createRewardsShowcase());
  }

  // Inject compact rewards teaser
  const teaserSection = containerEl.querySelector('#leaderboard-rewards-teaser-section');
  if (teaserSection) {
    teaserSection.appendChild(createRewardsTeaser());
  }

  // Inject mock mode toggle
  const toggleSection = containerEl.querySelector('#leaderboard-mock-toggle-section');
  if (toggleSection) {
    toggleSection.appendChild(createMockModeToggle());
  }

  currentUsername = auth.getUser()?.username ?? null;
  window.addEventListener('auth:authenticated', () => {
    currentUsername = auth.getUser()?.username ?? null;
    renderBanner();
    void loadAndRender();
  });

  // Listen for mock toggle changes
  window.addEventListener('leaderboard:mock-toggle', ((e: CustomEvent) => {
    const { enabled } = e.detail;

    // Re-render competition stats based on mode
    const statsSection = containerEl?.querySelector('#leaderboard-competition-stats-section');
    if (statsSection) {
      statsSection.innerHTML = '';
      if (enabled) {
        statsSection.appendChild(createCompetitionStats());
      }
    }

    // Re-render rewards showcase based on mode
    const rewardsSection = containerEl?.querySelector('#leaderboard-rewards-section');
    if (rewardsSection) {
      rewardsSection.innerHTML = '';
      if (enabled) {
        rewardsSection.appendChild(createRewardsShowcase());
      }
    }
    void loadAndRender();
  }) as EventListener);

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
