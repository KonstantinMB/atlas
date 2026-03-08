/**
 * Notification Toast — High-Severity Event Alerts
 *
 * Slides in from top-right for critical/high-severity events from the event stream.
 * Shows event title, signals generated count, and action buttons.
 * Auto-dismisses after 5 seconds with progress bar.
 * Stacks up to 3 toasts.
 */

// ── Toast Interface ───────────────────────────────────────────────────────

interface ToastData {
  id: string;
  severity: 'high' | 'critical';
  title: string;
  details?: string;
  source: string;
  layer: 'PRICE' | 'EVENT' | 'PHYSICAL' | 'REF';
  signalsGenerated?: number;
  location?: [number, number];
  timestamp: number;
}

// ── State ─────────────────────────────────────────────────────────────────

let toastContainer: HTMLElement | null = null;
let activeToasts: Map<string, { el: HTMLElement; timer: NodeJS.Timeout }> = new Map();
const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 8000; // 8 seconds - slower to dismiss

// Settings
let soundEnabled = true; // Toggleable via settings

// ── Initialize ────────────────────────────────────────────────────────────

export function initNotificationToasts(): void {
  // Create toast container at top-right
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  // Listen for high-severity events
  window.addEventListener('event:high-severity', (e) => {
    const event = (e as CustomEvent).detail as ToastData;
    showToast(event);
  });
}

// ── Show Toast ────────────────────────────────────────────────────────────

export function showToast(data: ToastData): void {
  if (!toastContainer) return;

  // Remove oldest toast if at max capacity
  if (activeToasts.size >= MAX_TOASTS) {
    const oldestId = Array.from(activeToasts.keys())[0];
    dismissToast(oldestId, false);
  }

  // Play notification sound
  if (soundEnabled) {
    playNotificationSound();
  }

  // Create toast element
  const toast = buildToast(data);
  toastContainer.appendChild(toast);

  // Trigger slide-in animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto-dismiss after 5 seconds
  const timer = setTimeout(() => {
    dismissToast(data.id, true);
  }, AUTO_DISMISS_MS);

  activeToasts.set(data.id, { el: toast, timer });

  // Start progress bar animation
  const progressBar = toast.querySelector('.toast-progress-fill') as HTMLElement;
  if (progressBar) {
    progressBar.style.transition = `width ${AUTO_DISMISS_MS}ms linear`;
    requestAnimationFrame(() => {
      progressBar.style.width = '0%';
    });
  }

  console.log(`[NotificationToast] Showing toast for ${AUTO_DISMISS_MS / 1000}s:`, data.title);
}

// ── Build Toast Element ───────────────────────────────────────────────────

function buildToast(data: ToastData): HTMLElement {
  const toast = document.createElement('div');
  toast.className = `toast toast-${data.severity}`;
  toast.dataset.toastId = data.id;

  const icon = getSeverityIcon(data.severity);
  const layerColor = getLayerColor(data.layer);

  const sourceLabel = getSourceLabel(data.source);
  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-icon">${icon}</span>
      <span class="toast-layer" style="color: ${layerColor};">${data.layer}</span>
      <span class="toast-source">${sourceLabel}</span>
      <button class="toast-close" data-toast-id="${data.id}">✕</button>
    </div>

    <div class="toast-title">${escapeHtml(data.title)}</div>

    ${
      data.details
        ? `<div class="toast-details">${escapeHtml(data.details).replace(/\n/g, '<br>')}</div>`
        : ''
    }

    ${
      data.signalsGenerated && data.signalsGenerated > 0
        ? `
      <div class="toast-signals">
        ⚡ ${data.signalsGenerated} signal${data.signalsGenerated > 1 ? 's' : ''} generated
      </div>
    `
        : ''
    }

    <div class="toast-actions">
      ${
        data.location
          ? `<button class="toast-action-btn" data-action="map" data-toast-id="${data.id}">
          VIEW ON MAP
        </button>`
          : ''
      }
      ${
        data.signalsGenerated
          ? `<button class="toast-action-btn" data-action="signals" data-toast-id="${data.id}">
          VIEW SIGNALS
        </button>`
          : ''
      }
    </div>

    <div class="toast-progress">
      <div class="toast-progress-fill"></div>
    </div>
  `;

  // Wire up event handlers
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', () => dismissToast(data.id, false));

  const actionBtns = toast.querySelectorAll('.toast-action-btn');
  actionBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset.action;
      handleAction(data, action!);
      dismissToast(data.id, false);
    });
  });

  return toast;
}

// ── Dismiss Toast ─────────────────────────────────────────────────────────

function dismissToast(id: string, auto: boolean): void {
  const entry = activeToasts.get(id);
  if (!entry) return;

  const { el, timer } = entry;

  // Clear auto-dismiss timer
  clearTimeout(timer);

  // Slide out
  el.classList.remove('visible');
  el.classList.add('dismissing');

  // Remove from DOM after animation
  setTimeout(() => {
    el.remove();
    activeToasts.delete(id);
  }, 300);
}

// ── Action Handlers ───────────────────────────────────────────────────────

function handleAction(data: ToastData, action: string): void {
  console.log('[NotificationToast] Action:', action, data);

  switch (action) {
    case 'map':
      if (data.location) {
        window.dispatchEvent(
          new CustomEvent('globe:fly-to', {
            detail: {
              longitude: data.location[0],
              latitude: data.location[1],
              zoom: 5,
              duration: 1500,
            },
          })
        );
      }
      break;

    case 'signals':
      // Open signals panel and filter to recent signals
      window.dispatchEvent(
        new CustomEvent('panel:open', {
          detail: { panelId: 'signals' },
        })
      );
      break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getSeverityIcon(severity: 'high' | 'critical'): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'high':
      return '⚠️';
  }
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    mock: 'Demo',
    gdelt: 'GDELT News',
    usgs: 'USGS Earthquakes',
    gdacs: 'GDACS Disasters',
    nasa_firms: 'NASA FIRMS',
    acled: 'ACLED Conflict',
    finnhub: 'Finnhub',
    coingecko: 'CoinGecko',
    sec_edgar: 'SEC EDGAR',
  };
  return labels[source] || source.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLayerColor(layer: ToastData['layer']): string {
  // Use CSS variables from design system instead of hardcoded colors
  const root = getComputedStyle(document.documentElement);
  switch (layer) {
    case 'PRICE':
      return '#4FC3F7'; // Cyan - price movements
    case 'EVENT':
      return root.getPropertyValue('--text-accent').trim() || '#D4A843'; // Gold accent
    case 'PHYSICAL':
      return root.getPropertyValue('--signal-negative').trim() || '#FF1744'; // Red - critical
    case 'REF':
      return root.getPropertyValue('--text-tertiary').trim() || '#94a3b8'; // Gray - reference
  }
}

function playNotificationSound(): void {
  // Create a simple beep using Web Audio API
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz beep
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Low volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (err) {
    console.warn('[NotificationToast] Could not play sound:', err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export function toggleSound(enabled: boolean): void {
  soundEnabled = enabled;
}

export function dismissAll(): void {
  for (const id of activeToasts.keys()) {
    dismissToast(id, false);
  }
}

export function cleanupNotificationToasts(): void {
  dismissAll();

  if (toastContainer) {
    toastContainer.remove();
    toastContainer = null;
  }
}
