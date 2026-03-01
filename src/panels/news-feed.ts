/**
 * News Feed Panel — Real-Time Intelligence
 *
 * Multi-source live news:
 *   1. RSS feeds via /api/rss/proxy (BBC, Al Jazeera, Reuters, Defense One)
 *   2. GDELT v2 doc events (supplemental, via dataService)
 *
 * No mock data — all items come from real upstream feeds.
 * Refreshes every 5 minutes. Items sorted newest-first, capped at 40.
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { GdeltDetail } from '../lib/data-service';

// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface LiveNewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  location: string;
  timestamp: number;
  severity: Severity;
}

// ── RSS feed definitions ──────────────────────────────────────────────────────

const RSS_FEEDS: Array<{ url: string; label: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',    label: 'BBC' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', label: 'BBC Markets' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',       label: 'Al Jazeera' },
  { url: 'https://defenseone.com/rss/all/',                 label: 'DefenseOne' },
  { url: 'https://breakingdefense.com/feed/',               label: 'Breaking Defense' },
];

// ── Location keyword extraction ───────────────────────────────────────────────

const LOCATION_PATTERNS: Array<[RegExp, string]> = [
  [/ukraine|kyiv|zelenskyy|kharkiv|kherson/i,         'Ukraine'],
  [/russia|moscow|kremlin|putin|siberia/i,             'Russia'],
  [/china|beijing|xi jinping|taiwan strait/i,          'China'],
  [/taiwan/i,                                          'Taiwan'],
  [/israel|gaza|hamas|west bank|tel aviv|netanyahu/i,  'Middle East'],
  [/iran|tehran|khamenei|rouhani/i,                    'Iran'],
  [/north korea|pyongyang|kim jong/i,                  'North Korea'],
  [/syria|damascus/i,                                  'Syria'],
  [/iraq|baghdad/i,                                    'Iraq'],
  [/saudi arabia|riyadh|opec/i,                        'Saudi Arabia'],
  [/pakistan|islamabad/i,                              'Pakistan'],
  [/india|new delhi|modi/i,                            'India'],
  [/afghanistan|kabul/i,                               'Afghanistan'],
  [/sudan|khartoum/i,                                  'Sudan'],
  [/ethiopia|addis ababa/i,                            'Ethiopia'],
  [/nato|brussels|pentagon/i,                          'NATO'],
  [/europe|eu |european union/i,                       'Europe'],
  [/united states|washington|pentagon|trump|biden|harris/i, 'USA'],
  [/oil|brent|crude|opec|barrel/i,                     'Energy Markets'],
  [/red sea|strait of hormuz|suez|strait/i,            'Maritime'],
  [/federal reserve|fed |interest rate|inflation|gdp/i, 'Markets'],
  [/bitcoin|crypto|ethereum|stablecoin/i,              'Crypto'],
  [/africa/i,                                          'Africa'],
  [/latin america|brazil|venezuela|colombia/i,         'Latin America'],
  [/japan|tokyo/i,                                     'Japan'],
  [/south korea|seoul/i,                               'South Korea'],
];

function extractLocation(text: string): string {
  for (const [re, loc] of LOCATION_PATTERNS) {
    if (re.test(text)) return loc;
  }
  return 'Global';
}

// ── Severity classification ───────────────────────────────────────────────────

function estimateSeverity(title: string): Severity {
  const t = title.toLowerCase();
  if (/nuclear|missile strike|war |invaded|killed|dead|massacre|attack\b/.test(t)) return 'critical';
  if (/conflict|military|troops|explosion|casualties|sanctions|threat|coup/.test(t)) return 'high';
  if (/protest|arrested|tariff|trade war|rate hike|recession|warning/.test(t)) return 'medium';
  return 'low';
}

// ── Time formatting ───────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000)       return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Stable ID from title/url ──────────────────────────────────────────────────

function makeId(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── RSS XML parser ────────────────────────────────────────────────────────────

function parseRssXml(xml: string, label: string): LiveNewsItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) return [];

    return Array.from(doc.querySelectorAll('item'))
      .map(item => {
        const title = item.querySelector('title')?.textContent?.trim() ?? '';
        // <link> in RSS is a text node, not an element in some parsers
        const linkEl = item.querySelector('link');
        const url = linkEl?.textContent?.trim()
          ?? item.getElementsByTagName('link')[0]?.textContent?.trim()
          ?? '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim()
          ?? item.querySelector('dc\\:date, date')?.textContent?.trim()
          ?? '';
        const description = item.querySelector('description')?.textContent?.trim() ?? '';
        const ts = pubDate ? Date.parse(pubDate) : 0;
        const timestamp = ts > 0 ? ts : Date.now();
        const text = title + ' ' + description;

        return {
          id: makeId(url || title),
          source: label,
          title: title.replace(/<[^>]*>/g, ''),   // strip any HTML tags
          url,
          location: extractLocation(text),
          timestamp,
          severity: estimateSeverity(text),
        } satisfies LiveNewsItem;
      })
      .filter(it => it.title.length > 5);
  } catch {
    return [];
  }
}

// ── Fetch one RSS feed via proxy ──────────────────────────────────────────────

async function fetchRssFeed(feedUrl: string, label: string): Promise<LiveNewsItem[]> {
  try {
    const res = await fetch(`/api/rss/proxy?url=${encodeURIComponent(feedUrl)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, label);
  } catch {
    return [];
  }
}

// ── GDELT event → LiveNewsItem ────────────────────────────────────────────────

function gdeltToLiveItem(ev: { id: string; title: string; url: string; source: string; country: string; timestamp: number }): LiveNewsItem {
  return {
    id: ev.id,
    source: ev.source || 'GDELT',
    title: ev.title,
    url: ev.url,
    location: ev.country || extractLocation(ev.title),
    timestamp: ev.timestamp,
    severity: estimateSeverity(ev.title),
  };
}

// ── Merge, dedup, sort ────────────────────────────────────────────────────────

function mergeItems(
  existing: Map<string, LiveNewsItem>,
  incoming: LiveNewsItem[],
): Map<string, LiveNewsItem> {
  const next = new Map(existing);
  for (const item of incoming) {
    if (item.id && !next.has(item.id)) {
      next.set(item.id, item);
    }
  }
  return next;
}

function topItems(store: Map<string, LiveNewsItem>, max = 40): LiveNewsItem[] {
  return [...store.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, max);
}

// ── DOM builders ──────────────────────────────────────────────────────────────

function severityLabel(s: Severity): string {
  return { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[s];
}

function buildNewsEl(item: LiveNewsItem): HTMLElement {
  const el = document.createElement('div');
  el.className = `news-item sev-${item.severity}`;
  if (item.url) {
    el.style.cursor = 'pointer';
    el.title = 'Click to open article';
    el.addEventListener('click', () => window.open(item.url, '_blank', 'noopener'));
  }

  const headerRow = document.createElement('div');
  headerRow.className = 'news-item-header';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'news-source';
  sourceBadge.textContent = item.source.toUpperCase();

  const sevBadge = document.createElement('span');
  sevBadge.className = `news-severity ${item.severity}`;
  sevBadge.textContent = item.severity.toUpperCase();

  headerRow.appendChild(sourceBadge);
  headerRow.appendChild(sevBadge);

  const title = document.createElement('div');
  title.className = 'news-title';
  title.textContent = item.title;

  const meta = document.createElement('div');
  meta.className = 'news-meta';
  meta.innerHTML = `
    <span class="news-location">${severityLabel(item.severity)} ${item.location}</span>
    <span>·</span>
    <span class="news-time">${timeAgo(item.timestamp)}</span>
  `;

  el.appendChild(headerRow);
  el.appendChild(title);
  el.appendChild(meta);
  return el;
}

function buildSkeleton(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'news-skeleton';
  el.innerHTML = `
    <div class="news-skel-line short"></div>
    <div class="news-skel-line long"></div>
    <div class="news-skel-line medium"></div>
  `;
  return el;
}

// ── Panel body ────────────────────────────────────────────────────────────────

function buildNewsFeedBody(container: HTMLElement): void {
  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusBar = document.createElement('div');
  statusBar.className = 'news-loading';

  const dot = document.createElement('span');
  dot.className = 'news-loading-dot';

  const statusText = document.createElement('span');
  statusText.id = 'news-status-text';
  statusText.textContent = 'Fetching live feeds…';

  const srcCount = document.createElement('span');
  srcCount.className = 'news-src-count';

  statusBar.appendChild(dot);
  statusBar.appendChild(statusText);
  statusBar.appendChild(srcCount);
  container.appendChild(statusBar);

  // ── Feed scroll area ───────────────────────────────────────────────────────
  const feed = document.createElement('div');
  feed.className = 'news-feed-scroll';

  // Skeleton placeholders while loading
  for (let i = 0; i < 6; i++) feed.appendChild(buildSkeleton());
  container.appendChild(feed);

  // ── State ──────────────────────────────────────────────────────────────────
  let store: Map<string, LiveNewsItem> = new Map();
  let lastRefresh = 0;
  let renderedCount = 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(items: LiveNewsItem[]): void {
    if (items.length === 0) return;
    feed.innerHTML = '';
    for (const item of items) {
      feed.appendChild(buildNewsEl(item));
    }
    renderedCount = items.length;

    const secs = Math.floor((Date.now() - lastRefresh) / 1_000);
    statusText.textContent = `${renderedCount} stories · updated ${secs < 5 ? 'just now' : `${secs}s ago`}`;
    dot.style.background = 'var(--status-low)';
  }

  function setStatus(text: string, color?: string): void {
    statusText.textContent = text;
    if (color) dot.style.background = color;
  }

  // ── Load from all RSS feeds ─────────────────────────────────────────────────
  async function loadFeeds(): Promise<void> {
    setStatus('Fetching live feeds…');
    dot.style.background = 'var(--status-medium)';

    const results = await Promise.allSettled(
      RSS_FEEDS.map(f => fetchRssFeed(f.url, f.label))
    );

    const newItems: LiveNewsItem[] = [];
    let successCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.length > 0) {
        newItems.push(...r.value);
        successCount++;
      }
    }

    if (newItems.length > 0) {
      store = mergeItems(store, newItems);
      lastRefresh = Date.now();
      srcCount.textContent = ` · ${successCount}/${RSS_FEEDS.length} feeds`;
      render(topItems(store));
    } else {
      setStatus('Feed fetch failed — retrying shortly', 'var(--status-critical)');
    }
  }

  // ── GDELT supplement ───────────────────────────────────────────────────────
  function handleGdelt(detail: GdeltDetail): void {
    if (!detail.events?.length) return;
    const gdeltItems = detail.events.map(gdeltToLiveItem);
    store = mergeItems(store, gdeltItems);
    render(topItems(store));
  }

  dataService.addEventListener('gdelt', (e: Event) => {
    const { detail } = e as CustomEvent<GdeltDetail>;
    handleGdelt(detail);
  });

  const existing = dataService.getGdelt();
  if (existing) handleGdelt(existing);

  // ── Refresh timestamps every 30 s (keep "Xm ago" fresh) ──────────────────
  setInterval(() => {
    if (renderedCount > 0 && lastRefresh > 0) {
      const secs = Math.floor((Date.now() - lastRefresh) / 1_000);
      const label = secs < 60
        ? `${secs}s ago`
        : `${Math.floor(secs / 60)}m ago`;
      statusText.textContent = `${renderedCount} stories · updated ${label}`;
    }
    // Re-render time labels on visible items
    feed.querySelectorAll<HTMLElement>('.news-time').forEach(el => {
      const item = [...store.values()].find(
        i => el.closest('.news-item')?.querySelector('.news-title')?.textContent === i.title
      );
      if (item) el.textContent = timeAgo(item.timestamp);
    });
  }, 30_000);

  // ── Poll every 5 min ───────────────────────────────────────────────────────
  void loadFeeds();
  setInterval(() => { void loadFeeds(); }, 5 * 60_000);
}

// ── Export ────────────────────────────────────────────────────────────────────

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
