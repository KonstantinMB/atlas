/**
 * News Feed Panel
 * Shows mock items immediately; prepends live GDELT events when they arrive.
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { GdeltEvent, GdeltDetail } from '../lib/data-service';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface NewsItem {
  source: string;
  title: string;
  location: string;
  timeAgo: string;
  severity: Severity;
}

const MOCK_ITEMS: NewsItem[] = [
  {
    source: 'SIGINT',
    title: 'Military exercises reported near Taiwan Strait',
    location: 'Taiwan',
    timeAgo: '5m ago',
    severity: 'critical',
  },
  {
    source: 'ENERGY',
    title: 'Oil pipeline disruption in Kazakhstan',
    location: 'Central Asia',
    timeAgo: '12m ago',
    severity: 'high',
  },
  {
    source: 'USGS',
    title: 'Earthquake M6.2 detected off coast of Japan',
    location: 'Japan',
    timeAgo: '23m ago',
    severity: 'high',
  },
  {
    source: 'MARKET',
    title: 'US Treasury yield curve inversion deepens',
    location: 'Markets',
    timeAgo: '31m ago',
    severity: 'medium',
  },
  {
    source: 'AIS',
    title: 'Vessel tracking anomaly in Red Sea shipping lane',
    location: 'Red Sea',
    timeAgo: '45m ago',
    severity: 'medium',
  },
  {
    source: 'OPEC',
    title: 'OPEC+ emergency meeting scheduled',
    location: 'Global',
    timeAgo: '1hr ago',
    severity: 'low',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function estimateSeverity(title: string): Severity {
  const t = title.toLowerCase();
  if (/war|nuclear|missile strike|military offensive|killed/.test(t)) return 'critical';
  if (/conflict|attack|explosion|casualties|troops/.test(t)) return 'high';
  if (/sanctions|military|threat|protests|arrested/.test(t)) return 'medium';
  return 'low';
}

function gdeltToNewsItem(ev: GdeltEvent): NewsItem {
  return {
    source: ev.source || 'GDELT',
    title: ev.title,
    location: ev.country || 'Global',
    timeAgo: timeAgo(ev.timestamp),
    severity: estimateSeverity(ev.title),
  };
}

// ── DOM builders ───────────────────────────────────────────────────────────────

function buildNewsItem(item: NewsItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'news-item';

  const headerRow = document.createElement('div');
  headerRow.className = 'news-item-header';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'news-source';
  sourceBadge.textContent = item.source;

  const severityBadge = document.createElement('span');
  severityBadge.className = `news-severity ${item.severity}`;
  severityBadge.textContent = item.severity.toUpperCase();

  headerRow.appendChild(sourceBadge);
  headerRow.appendChild(severityBadge);

  const title = document.createElement('div');
  title.className = 'news-title';
  title.textContent = item.title;

  const meta = document.createElement('div');
  meta.className = 'news-meta';

  const location = document.createElement('span');
  location.className = 'news-location';
  location.textContent = `◉ ${item.location}`;

  const dot = document.createElement('span');
  dot.textContent = '·';

  const time = document.createElement('span');
  time.textContent = item.timeAgo;

  meta.appendChild(location);
  meta.appendChild(dot);
  meta.appendChild(time);

  el.appendChild(headerRow);
  el.appendChild(title);
  el.appendChild(meta);

  return el;
}

// ── Live data integration ──────────────────────────────────────────────────────

function buildNewsFeedBody(container: HTMLElement): void {
  // Loading / status indicator
  const loadingBar = document.createElement('div');
  loadingBar.className = 'news-loading';

  const dot = document.createElement('span');
  dot.className = 'news-loading-dot';

  const statusText = document.createElement('span');
  statusText.textContent = 'Fetching live data...';

  loadingBar.appendChild(dot);
  loadingBar.appendChild(statusText);
  container.appendChild(loadingBar);

  // Scrollable feed area
  const feed = document.createElement('div');
  feed.className = 'news-feed-scroll';

  MOCK_ITEMS.forEach((item) => {
    feed.appendChild(buildNewsItem(item));
  });

  container.appendChild(feed);

  // ── GDELT live data ──────────────────────────────────────────────────────────
  let liveLoaded = false;
  let errorTimeout: ReturnType<typeof setTimeout>;

  function handleGdelt(detail: GdeltDetail): void {
    clearTimeout(errorTimeout);

    if (!detail.events?.length) {
      // GDELT returned empty (rate limited) — show degraded status, keep mock items
      statusText.textContent = 'Live feed rate-limited — showing curated intelligence';
      dot.style.background = 'var(--status-medium)';
      liveLoaded = true;
      return;
    }

    // Prepend live items before existing content (newest first, limit to 10)
    const toShow = detail.events.slice(0, 10);
    // Insert in reverse so first item ends up at top
    for (let i = toShow.length - 1; i >= 0; i--) {
      const ev = toShow[i];
      if (ev) {
        feed.insertBefore(buildNewsItem(gdeltToNewsItem(ev)), feed.firstChild);
      }
    }

    // Update status text
    const secsAgo = Math.floor((Date.now() - detail.lastFetch) / 1_000);
    statusText.textContent = `Last updated: ${secsAgo}s ago`;
    dot.style.background = 'var(--status-low)'; // green pulse

    if (!liveLoaded) {
      liveLoaded = true;
      // Kick off a periodic status text refresh so "X seconds ago" stays current
      setInterval(() => {
        const secs = Math.floor((Date.now() - detail.lastFetch) / 1_000);
        statusText.textContent = `Last updated: ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`} ago`;
      }, 15_000);
    }
  }

  dataService.addEventListener('gdelt', (e: Event) => {
    const { detail } = e as CustomEvent<GdeltDetail>;
    handleGdelt(detail);
  });

  // If data already loaded before listener registered (e.g., hot-reload)
  const existing = dataService.getGdelt();
  if (existing) handleGdelt(existing);

  // Error notice if GDELT never arrives after 30s
  errorTimeout = setTimeout(() => {
    if (!liveLoaded) {
      statusText.textContent = 'Live data unavailable — showing curated feed';
      dot.style.background = 'var(--status-critical)';
    }
  }, 30_000);
}

export function initNewsFeedPanel(): void {
  registerPanel({
    id: 'news-feed',
    title: 'Real-Time Intelligence',
    badge: 'LIVE',
    badgeClass: 'live',
    defaultCollapsed: false,
    init: buildNewsFeedBody,
  });
}
