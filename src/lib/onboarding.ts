/**
 * YC Hedge Fund - Interactive Onboarding Tour
 *
 * Step-by-step walkthrough with spotlight overlay. Auto-starts on first visit
 * (after welcome popup). Can be triggered manually via Tour button or Cmd+K.
 */

const STORAGE_KEY = 'atlas-onboarding-completed';

export interface OnboardingStep {
  id: string;
  target: string; // CSS selector
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: OnboardingStep[] = [
  {
    id: 'globe',
    target: '#globe-container',
    title: 'The Globe',
    body: 'Your command center. Real-time intelligence: earthquakes, conflicts, vessels, aircraft. Toggle layers from the left panel.',
    placement: 'bottom',
  },
  {
    id: 'nav',
    target: '.header-nav-tabs',
    title: 'Navigation',
    body: 'Globe • Intel • Markets • Trading • Leaderboard. Switch views to focus on intelligence, markets, or your paper portfolio.',
    placement: 'bottom',
  },
  {
    id: 'left-panel',
    target: '#left-panel',
    title: 'Layers & Paper Trading',
    body: 'Layer toggles (military bases, cables, conflict zones) and paper trading panels: Signals, Portfolio, Performance.',
    placement: 'right',
  },
  {
    id: 'signals',
    target: '[data-panel-id="signals"]',
    title: 'Trading Signals',
    body: 'AI-generated signals from geopolitics, sentiment, and macro data. Execute paper trades or enable auto-execute.',
    placement: 'right',
  },
  {
    id: 'portfolio',
    target: '[data-panel-id="portfolio"]',
    title: 'Portfolio',
    body: 'Your $1M paper portfolio. Positions, P&L, sector exposure. Sign in to persist across devices.',
    placement: 'right',
  },
  {
    id: 'right-panel',
    target: '#right-panel',
    title: 'Intelligence Panels',
    body: 'News feed, AI briefs, country instability, strategic risk, markets. Expand panels to dive deeper.',
    placement: 'left',
  },
  {
    id: 'status-bar',
    target: '#status-bar',
    title: 'Status Bar',
    body: 'NAV, Daily P&L, active signals, risk state. Shortcuts: T (Trading), S (Signals), P (Performance), Space (toggle auto-trade).',
    placement: 'top',
  },
  {
    id: 'shortcuts',
    target: '#cmd-palette-hint',
    title: 'Quick Actions',
    body: 'Press ⌘K (or Ctrl+K) for the command palette: fly to regions, toggle layers, switch themes, and more.',
    placement: 'bottom',
  },
];

let overlay: HTMLElement | null = null;
let currentStepIndex = 0;
let onCompleteCallback: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Treat hidden/zero-dimension elements as not found (use centered fallback)
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

const SPOTLIGHT_PADDING = 6; // Visual breathing room so highlight aligns with UI

function createSpotlight(rect: DOMRect): HTMLElement {
  const p = SPOTLIGHT_PADDING;
  const left = rect.left - p;
  const top = rect.top - p;
  const width = Math.max(rect.width + p * 2, 40);
  const height = Math.max(rect.height + p * 2, 40);

  const spotlight = document.createElement('div');
  spotlight.className = 'onboarding-spotlight';
  spotlight.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: ${width}px;
    height: ${height}px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.82);
    border-radius: 8px;
    border: 2px solid var(--text-accent);
    pointer-events: auto;
    z-index: 100000;
    transition: all 0.25s ease;
  `;
  return spotlight;
}

const TOOLTIP_PADDING = 16;
const TOOLTIP_EST_HEIGHT = 200;
const TOOLTIP_EST_WIDTH = 320;

function createTooltip(step: OnboardingStep, rect: DOMRect): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padding = TOOLTIP_PADDING;

  // For very large targets (e.g. globe fills viewport), center tooltip so it's always visible
  const targetTooLarge = rect.height > vh * 0.6 || rect.width > vw * 0.6;
  let top: number;
  let left: number;
  let transform = '';

  if (targetTooLarge) {
    left = vw / 2;
    top = vh / 2;
    transform = 'translate(-50%, -50%)';
  } else {
    let placement = step.placement ?? 'bottom';
    left = rect.left + rect.width / 2;

    // Prevent tooltip from being clipped: prefer placement that keeps it in viewport
    if (placement === 'left' && rect.left - TOOLTIP_EST_WIDTH - padding < 0) {
      placement = 'right';
    } else if (placement === 'right' && rect.right + TOOLTIP_EST_WIDTH + padding > vw) {
      placement = 'left';
    }

    if (placement === 'bottom') {
      top = rect.bottom + padding;
      transform = 'translateX(-50%)';
    } else if (placement === 'top') {
      top = rect.top - padding;
      transform = 'translate(-50%, -100%)';
    } else if (placement === 'right') {
      left = rect.right + padding;
      top = rect.top + rect.height / 2;
      transform = 'translateY(-50%)';
    } else {
      left = rect.left - padding;
      top = rect.top + rect.height / 2;
      transform = 'translate(-100%, -50%)';
    }

    // Clamp to viewport so Next/Back/Skip are always visible
    const halfW = TOOLTIP_EST_WIDTH / 2;
    left = Math.max(padding + halfW, Math.min(vw - padding - halfW, left));
    top = Math.max(padding + TOOLTIP_EST_HEIGHT / 2, Math.min(vh - padding - TOOLTIP_EST_HEIGHT / 2, top));
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.transform = transform;

  const totalSteps = STEPS.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  tooltip.innerHTML = `
    <div class="onboarding-tooltip-progress" style="width: ${progress}%"></div>
    <h3 class="onboarding-tooltip-title">${escapeHtml(step.title)}</h3>
    <p class="onboarding-tooltip-body">${escapeHtml(step.body)}</p>
    <div class="onboarding-tooltip-actions">
      <span class="onboarding-tooltip-step">${currentStepIndex + 1} / ${totalSteps}</span>
      <div class="onboarding-tooltip-buttons">
        <button type="button" class="onboarding-btn onboarding-btn-skip" id="onboarding-skip">Skip</button>
        <div class="onboarding-btn-group">
          <button type="button" class="onboarding-btn onboarding-btn-back" id="onboarding-back" ${currentStepIndex === 0 ? 'disabled' : ''}>Back</button>
          <button type="button" class="onboarding-btn onboarding-btn-next" id="onboarding-next">
            ${currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  `;

  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = '100001';

  return tooltip;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function scrollTargetIntoView(selector: string): void {
  const el = document.querySelector(selector);
  el?.scrollIntoView({ behavior: 'auto', block: 'center' });
}

function renderStep(): void {
  if (!overlay) return;

  const step = STEPS[currentStepIndex];
  if (!step) return;

  scrollTargetIntoView(step.target);

  // Measure after layout settles (scroll is instant; rAF ensures layout is done)
  requestAnimationFrame(() => {
    if (!overlay) return;
    const rect = getTargetRect(step.target);
    if (!rect) {
      // Target not found — show tooltip centered
      const fallbackRect = new DOMRect(
        window.innerWidth / 2 - 150,
        window.innerHeight / 2 - 80,
        300,
        160
      );
      overlay.querySelector('.onboarding-spotlight')?.remove();
      overlay.querySelector('.onboarding-tooltip')?.remove();
      const tooltip = createTooltip(step, fallbackRect);
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      overlay.appendChild(tooltip);
    } else {
      overlay.querySelector('.onboarding-spotlight')?.remove();
      overlay.querySelector('.onboarding-tooltip')?.remove();
      overlay.appendChild(createSpotlight(rect));
      overlay.appendChild(createTooltip(step, rect));
    }

    // Re-attach button listeners
    const skipBtn = overlay.querySelector('#onboarding-skip');
    const backBtn = overlay.querySelector('#onboarding-back');
    const nextBtn = overlay.querySelector('#onboarding-next');

    skipBtn?.addEventListener('click', () => complete(true));
    backBtn?.addEventListener('click', () => {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep();
      }
    });
    nextBtn?.addEventListener('click', () => {
      if (currentStepIndex < STEPS.length - 1) {
        currentStepIndex++;
        renderStep();
      } else {
        complete(false);
      }
    });
  });
}

function complete(skipped: boolean): void {
  if (!overlay) return;
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  overlay.classList.add('onboarding-closing');
  overlay.addEventListener(
    'transitionend',
    () => {
      overlay?.remove();
      overlay = null;
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch { /* ignore */ }
      onCompleteCallback?.();
      onCompleteCallback = null;
    },
    { once: true }
  );
}

function close(): void {
  complete(true);
}

export function startOnboarding(opts?: { force?: boolean; onComplete?: () => void }): void {
  if (overlay) return;

  if (!opts?.force) {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch { /* ignore */ }
  }

  onCompleteCallback = opts?.onComplete ?? null;
  currentStepIndex = 0;

  overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'App tour');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (currentStepIndex < STEPS.length - 1) {
        currentStepIndex++;
        renderStep();
      } else {
        complete(false);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep();
      }
    }
  };
  document.addEventListener('keydown', keydownHandler);

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay?.classList.add('onboarding-visible');
      renderStep();
    });
  });
}

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
