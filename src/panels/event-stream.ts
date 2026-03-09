/**
 * Event Stream Panel — Real-Time Feed of ALL Data Sources
 *
 * Shows a live stream of everything happening across 32 data sources:
 * - Price updates (PRICE layer - blue)
 * - Geopolitical events (EVENT layer - amber)
 * - Physical events (PHYSICAL layer - red)
 * - Reference data (REF layer - gray)
 *
 * High-severity events get gold stars and trigger signal generation.
 * Clicking an event flies the globe to location and opens detail.
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { dataService } from '../lib/data-service';

// ── Event Types ───────────────────────────────────────────────────────────────

interface StreamEvent {
  id: string;
  timestamp: number;
  layer: 'PRICE' | 'EVENT' | 'PHYSICAL' | 'REF';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  details: string;
  source: string;
  location?: [number, number]; // [lon, lat]
  signalsGenerated?: number;
  metadata?: Record<string, any>;
  referenceUrl?: string; // Link to source article/data
  affectedAssets?: string[]; // Assets impacted
  magnitude?: number; // For earthquakes, severity scores
}

// ── Layer Colors ──────────────────────────────────────────────────────────────

const LAYER_COLORS = {
  PRICE: '#4FC3F7', // Cyan
  EVENT: '#FFB300', // Amber
  PHYSICAL: '#FF3D3D', // Red
  REF: '#94a3b8', // Gray
};

const LAYER_LABELS = {
  PRICE: 'PRICE',
  EVENT: 'EVENT',
  PHYSICAL: 'PHYSICAL',
  REF: 'REF',
};

// ── State ─────────────────────────────────────────────────────────────────────

let events: StreamEvent[] = [];
let filteredEvents: StreamEvent[] = [];
let currentFilter: 'ALL' | 'PRICE' | 'EVENT' | 'PHYSICAL' | 'REF' = 'ALL';
let eventRate = 0; // events per hour
let lastEventCount = 0;
let rateCheckInterval: NodeJS.Timeout | null = null;
let listContainer: HTMLElement | null = null;
let rateDisplay: HTMLElement | null = null;

// ── Initialize Panel ──────────────────────────────────────────────────────────

export function initEventStreamPanel(): void {
  registerPanel({
    id: 'event-stream',
    title: 'Live Feed',
    badge: '',
    badgeClass: '',
    defaultCollapsed: false,
    init: buildPanelBody,
  });
}

function buildPanelBody(container: HTMLElement): void {
  container.className += ' event-stream-panel-body';

  container.innerHTML = `
    <div class="event-stream-header">
      <div class="stream-title">LIVE FEED</div>
      <div class="stream-rate">
        <span class="rate-value" id="event-rate-value">0</span>/hr
        <span class="rate-status">●</span>
      </div>
    </div>

    <div class="stream-filters">
      <button class="stream-filter-btn active" data-filter="ALL">ALL</button>
      <button class="stream-filter-btn" data-filter="PRICE">PRICE</button>
      <button class="stream-filter-btn" data-filter="EVENT">EVENT</button>
      <button class="stream-filter-btn" data-filter="PHYSICAL">PHYS</button>
      <button class="stream-filter-btn" data-filter="REF">REF</button>
    </div>

    <div class="stream-list" id="stream-list"></div>
  `;

  listContainer = container.querySelector('#stream-list');
  rateDisplay = container.querySelector('#event-rate-value');

  // Wire filter buttons
  container.querySelectorAll('.stream-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = (btn as HTMLElement).dataset.filter as any;
      container.querySelectorAll('.stream-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter();
    });
  });

  // Subscribe to data service events
  subscribeToDataEvents();

  // Start event rate tracking
  startRateTracking();

  // Generate mock events for demo
  generateMockEvents();

  // Render initial state
  renderEventList();
}

// ── Subscribe to Data Events ──────────────────────────────────────────────────

function subscribeToDataEvents(): void {
  // Subscribe to various data service events
  dataService.addEventListener('gdelt-news', (data: any) => {
    addEvent({
      layer: 'EVENT',
      severity: data.tone < -5 ? 'high' : 'medium',
      title: `NEWS: ${data.title || 'Global event'}`,
      details: data.summary || '',
      source: 'gdelt',
      location: data.location,
      referenceUrl: data.sourceUrl,
    });
  });

  dataService.addEventListener('usgs-earthquake', (data: any) => {
    addEvent({
      layer: 'PHYSICAL',
      severity: data.magnitude > 6 ? 'critical' : data.magnitude > 5 ? 'high' : 'medium',
      title: `M${data.magnitude} EARTHQUAKE — ${data.location}`,
      details: `Infrastructure: ${data.nearbyFacilities || 0} facilities within 600km`,
      source: 'usgs',
      location: data.coordinates,
      magnitude: data.magnitude,
      affectedAssets: data.nearbyFacilities > 0 ? ['Critical infrastructure', 'Regional supply chains'] : undefined,
      referenceUrl: data.url || 'https://earthquake.usgs.gov/earthquakes/map/',
    });
  });

  dataService.addEventListener('price-update', (data: any) => {
    const changePercent = data.change * 100;
    const isHighVolatility = Math.abs(changePercent) > 5;

    addEvent({
      layer: 'PRICE',
      severity: isHighVolatility ? 'high' : 'low',
      title: `${data.symbol} $${data.price.toFixed(2)} ${data.change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
      details: isHighVolatility ? 'High volatility detected' : '',
      source: data.source || 'finnhub',
      referenceUrl: `https://finance.yahoo.com/quote/${data.symbol}`,
    });
  });

  dataService.addEventListener('firms-fire', (data: any) => {
    const isCritical = data.infrastructure && (
      data.infrastructure.includes('oil') ||
      data.infrastructure.includes('pipeline') ||
      data.infrastructure.includes('refinery')
    );

    addEvent({
      layer: 'PHYSICAL',
      severity: isCritical ? 'critical' : 'high',
      title: `FIRE DETECTED: ${data.latitude.toFixed(1)}°N, ${data.longitude.toFixed(1)}°E`,
      details: `Near: ${data.nearLocation || 'Unknown'} (${data.distance || 0}km)\nInfrastructure: ${
        data.infrastructure || 'Unknown'
      }\nSeverity: ${data.severity?.toUpperCase() || 'MEDIUM'}`,
      source: 'nasa_firms',
      location: [data.longitude, data.latitude],
      magnitude: data.brightness || data.frp,
      affectedAssets: data.infrastructure ? [data.infrastructure] : undefined,
      referenceUrl: 'https://firms.modaps.eosdis.nasa.gov/map/',
    });
  });

  dataService.addEventListener('acled-conflict', (data: any) => {
    const ciiIncrease = (data.ciiNew || 0) - (data.ciiOld || 0);
    const isCritical = ciiIncrease > 10 || data.fatalities > 50;

    addEvent({
      layer: 'EVENT',
      severity: isCritical ? 'critical' : 'high',
      title: `${data.eventType || 'PROTEST'}: ${data.participants || 0}+ participants, ${
        data.location
      }`,
      details: `CII ${data.country}: ${data.ciiOld || 0} → ${data.ciiNew || 0} (+${ciiIncrease})`,
      source: 'acled',
      location: data.coordinates,
      signalsGenerated: data.signalsGenerated,
      magnitude: ciiIncrease,
      affectedAssets: data.affectedSectors || [`${data.country} assets`, 'Regional stability'],
      referenceUrl: data.url || 'https://acleddata.com/',
    });
  });

  // Add more event subscriptions as needed
}

// ── Add Event ─────────────────────────────────────────────────────────────────

function addEvent(eventData: Partial<StreamEvent>): void {
  const event: StreamEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    layer: eventData.layer || 'REF',
    severity: eventData.severity || 'low',
    title: eventData.title || 'Unknown event',
    details: eventData.details || '',
    source: eventData.source || 'unknown',
    location: eventData.location,
    signalsGenerated: eventData.signalsGenerated,
    metadata: eventData.metadata,
  };

  events.unshift(event); // Add to beginning (newest first)

  // Keep last 500 events
  if (events.length > 500) {
    events = events.slice(0, 500);
  }

  applyFilter();
  animateNewEvent(event);

  // Trigger notification toast for high-severity events
  if (event.severity === 'high' || event.severity === 'critical') {
    window.dispatchEvent(
      new CustomEvent('event:high-severity', {
        detail: {
          id: event.id,
          severity: event.severity,
          title: event.title,
          details: event.details,
          source: event.source,
          layer: event.layer,
          signalsGenerated: event.signalsGenerated,
          location: event.location,
          timestamp: event.timestamp,
          referenceUrl: event.referenceUrl,
          affectedAssets: event.affectedAssets,
          magnitude: event.magnitude,
          metadata: event.metadata,
        },
      })
    );
  }
}

// ── Filter Events ─────────────────────────────────────────────────────────────

function applyFilter(): void {
  if (currentFilter === 'ALL') {
    filteredEvents = events;
  } else {
    filteredEvents = events.filter((e) => e.layer === currentFilter);
  }

  renderEventList();
}

// ── Render Event List ─────────────────────────────────────────────────────────

function renderEventList(): void {
  if (!listContainer) return;

  // Render only the first 50 events for performance
  const toRender = filteredEvents.slice(0, 50);

  if (toRender.length === 0) {
    listContainer.innerHTML = `
      <div class="stream-empty">
        <div class="empty-icon">📡</div>
        <div class="empty-title">No events yet</div>
        <div class="empty-subtitle">Waiting for data sources to stream...</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const event of toRender) {
    const card = buildEventCard(event);
    fragment.appendChild(card);
  }

  listContainer.innerHTML = '';
  listContainer.appendChild(fragment);
}

// ── Build Event Card ──────────────────────────────────────────────────────────

function buildEventCard(event: StreamEvent): HTMLElement {
  const isHighSeverity = event.severity === 'high' || event.severity === 'critical';
  const layerColor = LAYER_COLORS[event.layer];
  const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false });

  const card = document.createElement('div');
  card.className = `stream-event-card ${event.severity}`;
  card.dataset.eventId = event.id;
  card.style.borderLeftColor = layerColor;

  card.innerHTML = `
    <div class="event-card-header">
      ${isHighSeverity ? '<span class="event-star">★</span>' : '<span class="event-dot">●</span>'}
      <span class="event-time">${timestamp}</span>
      <span class="event-layer" style="color: ${layerColor};">${LAYER_LABELS[event.layer]}</span>
      <span class="event-source">${event.source}</span>
    </div>

    <div class="event-card-title">${event.title}</div>

    ${
      event.details
        ? `<div class="event-card-details">${event.details.replace(/\n/g, '<br>')}</div>`
        : ''
    }

    ${
      event.signalsGenerated && event.signalsGenerated > 0
        ? `
      <div class="event-card-signals">
        → Signals generated: ${event.signalsGenerated} signal${event.signalsGenerated > 1 ? 's' : ''}
      </div>
    `
        : ''
    }
  `;

  // Click handler
  card.addEventListener('click', () => handleEventClick(event));

  return card;
}

// ── Animate New Event ─────────────────────────────────────────────────────────

function animateNewEvent(event: StreamEvent): void {
  if (!listContainer) return;

  // Only animate if the event matches current filter
  const matchesFilter = currentFilter === 'ALL' || event.layer === currentFilter;
  if (!matchesFilter) return;

  // Check if we already have 50 events - if so, full re-render happens via applyFilter
  // Don't animate, just let renderEventList handle it
  if (filteredEvents.length > 50) {
    return; // renderEventList will handle the full list
  }

  const card = buildEventCard(event);
  card.style.opacity = '0';
  card.style.transform = 'translateY(-20px)';

  listContainer.insertBefore(card, listContainer.firstChild);

  // Remove excess cards beyond 50
  while (listContainer.children.length > 50) {
    listContainer.removeChild(listContainer.lastChild!);
  }

  // Trigger animation
  requestAnimationFrame(() => {
    card.style.transition = 'opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
}

// ── Event Click Handler ───────────────────────────────────────────────────────

function handleEventClick(event: StreamEvent): void {
  console.log('[EventStream] Event clicked:', event);

  // Fly globe to location if available
  if (event.location) {
    window.dispatchEvent(
      new CustomEvent('globe:fly-to', {
        detail: {
          longitude: event.location[0],
          latitude: event.location[1],
          zoom: 5,
          duration: 1500,
        },
      })
    );
  }

  // TODO: Open detail panel with full event data
}

// ── Event Rate Tracking ───────────────────────────────────────────────────────

function startRateTracking(): void {
  // Update rate every 10 seconds
  rateCheckInterval = setInterval(() => {
    const currentCount = events.length;
    const newEvents = currentCount - lastEventCount;

    // Calculate events per hour based on 10-second window
    eventRate = Math.round((newEvents / 10) * 3600);

    lastEventCount = currentCount;

    updateRateDisplay();
  }, 10_000);

  // Initial check after 1 second
  setTimeout(() => {
    lastEventCount = events.length;
  }, 1000);
}

function updateRateDisplay(): void {
  if (!rateDisplay) return;

  const oldValue = parseInt(rateDisplay.textContent || '0');
  const newValue = eventRate;

  // Smooth number animation
  animateNumber(rateDisplay, oldValue, newValue, 500);

  // Check if rate is spiking (>2x baseline of 1000/hr)
  const baseline = 1000;
  const isSpike = eventRate > baseline * 2;

  const rateStatus = document.querySelector('.rate-status') as HTMLElement;
  if (rateStatus) {
    if (isSpike) {
      rateStatus.classList.add('spike');
    } else {
      rateStatus.classList.remove('spike');
    }
  }

  // Emit event rate update for nav stats
  window.dispatchEvent(
    new CustomEvent('event-stream:rate-update', {
      detail: { rate: eventRate },
    })
  );
}

function animateNumber(el: HTMLElement, from: number, to: number, duration: number): void {
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
    const current = Math.round(from + (to - from) * eased);

    el.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

// ── Generate Mock Events ──────────────────────────────────────────────────────

function generateMockEvents(): void {
  // Generate some initial mock events
  const mockEvents: Partial<StreamEvent>[] = [
    {
      layer: 'REF',
      severity: 'low',
      title: 'Data refresh: Market indices updated',
      details: 'S&P 500, NASDAQ, DJI refreshed from Yahoo Finance',
      source: 'mock',
    },
    {
      layer: 'PRICE',
      severity: 'low',
      title: 'AAPL $198.42 +0.31%',
      source: 'finnhub',
    },
    {
      layer: 'EVENT',
      severity: 'high',
      title: '8-K FILING: MSFT — Results of Operations',
      details: 'Revenue: $62.0B (+15% YoY)',
      source: 'sec_edgar',
      signalsGenerated: 1,
      referenceUrl: 'https://www.sec.gov/edgar/browse/?CIK=789019',
    },
    {
      layer: 'PHYSICAL',
      severity: 'medium',
      title: 'M5.2 EARTHQUAKE — Tonga',
      details: 'Infrastructure: 0 facilities within 600km',
      source: 'usgs',
      location: [-175.2, -21.2],
      magnitude: 5.2,
      referenceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
    },
    {
      layer: 'REF',
      severity: 'low',
      title: 'Reference update: New sanctions list',
      details: 'OFAC added 12 entities, OpenSanctions database updated',
      source: 'mock',
      referenceUrl: 'https://www.opensanctions.org/',
    },
    {
      layer: 'EVENT',
      severity: 'high',
      title: 'PROTEST: 2,000+ participants, Tehran',
      details: 'CII Iran: 72 → 78 (+6)',
      source: 'acled',
      location: [51.4, 35.7],
      signalsGenerated: 2,
      affectedAssets: ['Iranian Rial (IRR)', 'Regional oil supply', 'Geopolitical risk premium'],
      referenceUrl: 'https://acleddata.com/',
    },
    {
      layer: 'PHYSICAL',
      severity: 'critical',
      title: 'FIRE DETECTED: 23.4°N, 57.2°E — Strait of Hormuz',
      details: 'Near: Strait of Hormuz (12km)\nInfrastructure: oil tanker route\nSeverity: HIGH',
      source: 'nasa_firms',
      location: [57.2, 23.4],
      affectedAssets: ['Oil tanker routes', 'Crude oil (WTI)', 'Brent futures', 'Shipping insurance'],
      magnitude: 8.5,
      referenceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
      signalsGenerated: 3,
    },
    {
      layer: 'PRICE',
      severity: 'low',
      title: 'BTC $67,234 -0.12%',
      source: 'coingecko',
    },
  ];

  // Add mock events with slight delays
  mockEvents.forEach((evt, i) => {
    setTimeout(() => addEvent(evt), i * 500);
  });

  // Continue generating random events every 5-15 seconds
  const generateRandomEvent = () => {
    const layers: Array<'PRICE' | 'EVENT' | 'PHYSICAL' | 'REF'> = [
      'PRICE',
      'EVENT',
      'PHYSICAL',
      'REF',
    ];
    const layer = layers[Math.floor(Math.random() * layers.length)];

    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'BTC', 'ETH', 'SPY'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const price = 100 + Math.random() * 500;
    const change = (Math.random() - 0.5) * 0.1;

    const eventTitles: Record<string, string[]> = {
      EVENT: [
        '8-K Filing: Major earnings release',
        'Protest activity: CII elevated',
        'Regulatory update: Sector impact',
        'Geopolitical development: Region watch',
      ],
      PHYSICAL: [
        'Earthquake detected: M5.2 — Pacific region',
        'Fire detected: Industrial zone',
        'Storm system: Shipping lanes affected',
        'Infrastructure alert: Critical facility',
      ],
      REF: [
        'Data refresh: Market indices updated',
        'Reference update: New sanctions list',
        'Benchmark revision: Sector weights',
      ],
    };
    const titles = eventTitles[layer] || ['Event update'];
    const title =
      layer === 'PRICE'
        ? `${symbol} $${price.toFixed(2)} ${change >= 0 ? '+' : ''}${(change * 100).toFixed(2)}%`
        : titles[Math.floor(Math.random() * titles.length)];
    const event: Partial<StreamEvent> = {
      layer,
      severity: Math.random() > 0.8 ? 'high' : 'low',
      title,
      details:
        layer === 'PHYSICAL'
          ? 'Infrastructure and supply chain impact assessed. Check Live Feed for details.'
          : layer === 'EVENT'
            ? 'Convergence with existing signals. Review Intel panels.'
            : '',
      source: layer === 'PRICE' ? 'finnhub' : 'mock',
    };

    addEvent(event);

    // Schedule next event
    const delay = 5000 + Math.random() * 10000; // 5-15 seconds
    setTimeout(generateRandomEvent, delay);
  };

  // Start random event generation
  setTimeout(generateRandomEvent, 10000);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupEventStream(): void {
  if (rateCheckInterval) {
    clearInterval(rateCheckInterval);
    rateCheckInterval = null;
  }
}
