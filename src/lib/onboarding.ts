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
    placement: 'left',
  },
  {
    id: 'portfolio',
    target: '[data-panel-id="portfolio"]',
    title: 'Portfolio',
    body: 'Your $1M paper portfolio. Positions, P&L, sector exposure. Sign in to persist across devices.',
    placement: 'left',
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
  return el.getBoundingClientRect();
}

function createSpotlight(rect: DOMRect): HTMLElement {
  const spotlight = document.createElement('div');
  spotlight.className = 'onboarding-spotlight';
  spotlight.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${Math.max(rect.width, 40)}px;
    height: ${Math.max(rect.height, 40)}px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.82);
    border-radius: 6px;
    border: 2px solid var(--text-accent);
    pointer-events: none;
    z-index: 10002;
    transition: all 0.25s ease;
  `;
  return spotlight;
}

function createTooltip(step: OnboardingStep, rect: DOMRect): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';

  const placement = step.placement ?? 'bottom';
  const padding = 16;

  let top = 0;
  let left = rect.left + rect.width / 2;

  if (placement === 'bottom') {
    top = rect.bottom + padding;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateX(-50%)';
  } else if (placement === 'top') {
    top = rect.top - padding;
    tooltip.style.left = `${left}px`;
    tooltip.style.bottom = 'auto';
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
  } else if (placement === 'right') {
    left = rect.right + padding;
    top = rect.top + rect.height / 2;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translateY(-50%)';
  } else {
    left = rect.left - padding;
    top = rect.top + rect.height / 2;
    tooltip.style.right = 'auto';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translate(-100%, -50%)';
  }

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
  tooltip.style.zIndex = '10003';

  return tooltip;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function scrollTargetIntoView(selector: string): void {
  const el = document.querySelector(selector);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderStep(): void {
  if (!overlay) return;

  const step = STEPS[currentStepIndex];
  if (!step) return;

  scrollTargetIntoView(step.target);

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
