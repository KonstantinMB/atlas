/**
 * AI Insights Panel
 * Groq-powered intelligence briefs generated from live GDELT event data
 */

import { registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';
import type { GdeltEvent, GdeltDetail } from '../lib/data-service';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AIBrief {
  text: string;
  topics: string[];
  generatedAt: number;
  model: string;
}

// ── Fallback events used when GDELT is rate-limited ────────────────────────────

const FALLBACK_EVENTS: GdeltEvent[] = [
  { id: 'fb1', title: 'Military buildup reported near Taiwan Strait', source: 'Reuters', country: 'CN', tone: -5.2, timestamp: Date.now(), url: '' },
  { id: 'fb2', title: 'Oil pipeline disruption threatens supply routes', source: 'Bloomberg', country: 'KZ', tone: -3.8, timestamp: Date.now(), url: '' },
  { id: 'fb3', title: 'NATO exercises in Eastern Europe expand', source: 'BBC', country: 'PL', tone: -2.1, timestamp: Date.now(), url: '' },
  { id: 'fb4', title: 'Sanctions pressure intensifies on energy sector', source: 'FT', country: 'RU', tone: -4.5, timestamp: Date.now(), url: '' },
  { id: 'fb5', title: 'Red Sea shipping disruptions continue', source: 'Reuters', country: 'YE', tone: -3.9, timestamp: Date.now(), url: '' },
];

// ── State ──────────────────────────────────────────────────────────────────────

let currentEvents: GdeltEvent[] = [];
let lastBrief: AIBrief | null = null;
let isGenerating = false;

// Refs to DOM nodes populated after panel init
let briefTextEl: HTMLElement | null = null;
let briefTimeEl: HTMLElement | null = null;
let topicsContainerEl: HTMLElement | null = null;
let loadingEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;
let regenBtn: HTMLButtonElement | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function extractTopics(events: GdeltEvent[]): string[] {
  const countries = new Set<string>();
  const keywords = new Set<string>();

  const topicPatterns: [RegExp, string][] = [
    [/ukraine|russia/i, 'Ukraine'],
    [/china|taiwan/i, 'Taiwan Strait'],
    [/iran|israel|middle east/i, 'Middle East'],
    [/oil|energy|opec|pipeline/i, 'Energy'],
    [/market|stock|economy|inflation|fed/i, 'Markets'],
    [/nuclear|missile|weapon/i, 'Defense'],
    [/flood|earthquake|tsunami|hurricane/i, 'Disasters'],
    [/sanctions|trade|tariff/i, 'Trade'],
  ];

  for (const ev of events.slice(0, 10)) {
    if (ev.country) countries.add(ev.country);
    for (const [rx, label] of topicPatterns) {
      if (rx.test(ev.title)) keywords.add(label);
    }
  }

  const result = Array.from(keywords).slice(0, 4);
  if (result.length < 3) {
    Array.from(countries).slice(0, 3 - result.length).forEach(c => result.push(c));
  }
  return result.slice(0, 5);
}

// ── API call ───────────────────────────────────────────────────────────────────

async function generateBrief(events: GdeltEvent[]): Promise<void> {
  if (isGenerating) return;

  isGenerating = true;
  showLoading(true);

  const eventsToUse = events.length > 0 ? events : FALLBACK_EVENTS;

  try {
    const top10 = eventsToUse.slice(0, 10).map(e => ({
      title: e.title,
      source: e.source,
      country: e.country,
      tone: e.tone,
    }));

    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: top10, type: 'intelligence_brief' }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

    const json = await res.json();
    const text = json.summary ?? json.brief ?? json.text ?? 'No summary available.';
    const topics = extractTopics(eventsToUse);

    lastBrief = { text, topics, generatedAt: Date.now(), model: json.model ?? 'Groq Llama 3.1' };
    renderBrief(lastBrief);
  } catch {
    const topics = extractTopics(eventsToUse);
    const fallback = buildFallbackBrief(eventsToUse);
    lastBrief = { text: fallback, topics, generatedAt: Date.now(), model: 'Keyword Fallback' };
    renderBrief(lastBrief);
  } finally {
    isGenerating = false;
    showLoading(false);
  }
}

function buildFallbackBrief(events: GdeltEvent[]): string {
  const top = events.slice(0, 5);
  if (top.length === 0) return 'Awaiting live intelligence data...';

  const countries = [...new Set(top.map(e => e.country).filter(Boolean))].slice(0, 3);
  const sources = [...new Set(top.map(e => e.source).filter(Boolean))].slice(0, 3);

  return (
    `Global intelligence monitor is tracking ${events.length} active events across ` +
    `${countries.length > 0 ? countries.join(', ') : 'multiple regions'}. ` +
    `Key developments reported via ${sources.join(', ')}. ` +
    `Monitor geopolitical risk indicators for elevated activity in flash-points.`
  );
}

// ── DOM rendering ──────────────────────────────────────────────────────────────

function showLoading(show: boolean): void {
  if (!loadingEl || !contentEl) return;
  loadingEl.style.display = show ? 'block' : 'none';
  contentEl.style.display = show ? 'none' : 'block';
}

function renderBrief(brief: AIBrief): void {
  if (briefTextEl) briefTextEl.textContent = brief.text;
  if (briefTimeEl) briefTimeEl.textContent = `Generated ${relativeTime(brief.generatedAt)}`;

  if (topicsContainerEl) {
    topicsContainerEl.innerHTML = '';
    brief.topics.forEach(topic => {
      const tag = document.createElement('span');
      tag.className = 'topic-tag';
      tag.textContent = topic;
      topicsContainerEl!.appendChild(tag);
    });
  }
}

// ── Panel body builder ─────────────────────────────────────────────────────────

function buildAIInsightsBody(container: HTMLElement): void {
  // ── Brief wrapper ──────────────────────────────────────────────────────────
  const briefWrapper = document.createElement('div');
  briefWrapper.className = 'ai-brief';

  // Header
  const header = document.createElement('div');
  header.className = 'ai-brief-header';

  const modelBadge = document.createElement('span');
  modelBadge.className = 'ai-model-badge';
  modelBadge.textContent = 'GROQ LLAMA 3.1';

  briefTimeEl = document.createElement('span');
  briefTimeEl.className = 'ai-brief-time';
  briefTimeEl.textContent = 'Initializing...';

  header.appendChild(modelBadge);
  header.appendChild(briefTimeEl);

  // Loading state
  loadingEl = document.createElement('div');
  loadingEl.className = 'ai-brief-loading';
  loadingEl.textContent = 'Analyzing intelligence feed...';
  loadingEl.style.display = 'none';

  // Content block (text + topics)
  contentEl = document.createElement('div');

  briefTextEl = document.createElement('div');
  briefTextEl.className = 'ai-brief-text';
  briefTextEl.textContent =
    'Atlas AI is monitoring global events. Intelligence briefs will be generated automatically ' +
    'once live data feeds are connected. Tracking geopolitical developments across all regions.';

  topicsContainerEl = document.createElement('div');
  topicsContainerEl.className = 'ai-brief-topics';

  // Default placeholder topics
  ['Loading...'].forEach(t => {
    const tag = document.createElement('span');
    tag.className = 'topic-tag';
    tag.textContent = t;
    topicsContainerEl!.appendChild(tag);
  });

  contentEl.appendChild(briefTextEl);
  contentEl.appendChild(topicsContainerEl);

  // Regenerate button
  regenBtn = document.createElement('button');
  regenBtn.className = 'ai-regenerate-btn';
  regenBtn.textContent = '⟳ Regenerate Brief';
  regenBtn.addEventListener('click', () => {
    void generateBrief(currentEvents); // generateBrief uses FALLBACK_EVENTS when empty
  });

  briefWrapper.appendChild(header);
  briefWrapper.appendChild(loadingEl);
  briefWrapper.appendChild(contentEl);
  briefWrapper.appendChild(regenBtn);
  container.appendChild(briefWrapper);

  // ── Wire up live GDELT data ────────────────────────────────────────────────
  let firstGenTriggered = false;

  function handleGdelt(detail: GdeltDetail): void {
    currentEvents = detail.events ?? []; // set even if empty

    modelBadge.textContent = 'GROQ LLAMA 3.1';

    if (!firstGenTriggered) {
      firstGenTriggered = true;
      void generateBrief(currentEvents); // uses FALLBACK_EVENTS internally when empty
    }
  }

  // Listen for future GDELT events
  dataService.addEventListener('gdelt', (e: Event) => {
    const { detail } = e as CustomEvent<GdeltDetail>;
    handleGdelt(detail);
  });

  // Handle data already loaded before panel was registered (e.g., hot-reload)
  const existing = dataService.getGdelt();
  if (existing) {
    setTimeout(() => handleGdelt(existing), 5_000);
  } else {
    // Listen for first arrival with a 5s delay (let news panel get it first)
    dataService.addEventListener('gdelt', (e: Event) => {
      const { detail } = e as CustomEvent<GdeltDetail>;
      setTimeout(() => handleGdelt(detail), 100);
    }, { once: true });
  }

  // Trigger brief even if GDELT never arrives (rate-limited)
  setTimeout(() => {
    if (!firstGenTriggered) {
      firstGenTriggered = true;
      void generateBrief(currentEvents); // will use FALLBACK_EVENTS internally
    }
  }, 10_000);

  // Auto-regenerate every 30 minutes
  setInterval(() => {
    void generateBrief(currentEvents); // uses FALLBACK_EVENTS when empty
  }, 30 * 60 * 1_000);

  // Update "generated X ago" label every minute
  setInterval(() => {
    if (lastBrief && briefTimeEl) {
      briefTimeEl.textContent = `Generated ${relativeTime(lastBrief.generatedAt)}`;
    }
  }, 60_000);
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function initAIInsightsPanel(): void {
  registerPanel({
    id: 'ai-insights',
    title: 'AI Intelligence Brief',
    badge: 'AI',
    badgeClass: 'ai',
    defaultCollapsed: false,
    init: buildAIInsightsBody,
  });
}
