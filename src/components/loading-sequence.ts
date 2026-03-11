/**
 * Cinematic Loading Sequence
 *
 * First visit only — staged boot animation:
 * 1. Black screen with ATLAS logo (◈) pulsing gold
 * 2. "INITIALIZING SYSTEMS..." in DM Mono
 * 3. Progress items appear with typewriter effect, each gets green checkmark
 * 4. "ACCESS GRANTED" flashes green
 * 5. Screen splits open like blast doors → reveals dashboard
 *
 * Duration: ~2-3 seconds (actual loading + staged animation)
 */

// ── State ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'atlas:first-visit-complete';
let overlayEl: HTMLElement | null = null;

// ── Check if Should Show ──────────────────────────────────────────────────

export function shouldShowLoadingSequence(): boolean {
  // Disabled - skip loading sequence entirely for faster initialization
  return false;
  // Previously: Only show on first visit
  // return !localStorage.getItem(STORAGE_KEY);
}

// ── Initialize & Play ─────────────────────────────────────────────────────

export async function playLoadingSequence(): Promise<void> {
  if (!shouldShowLoadingSequence()) {
    console.log('[LoadingSequence] Skipping (not first visit)');
    return;
  }

  console.log('[LoadingSequence] Playing cinematic boot sequence');

  createOverlay();

  // Step 1: Show logo + "INITIALIZING SYSTEMS..." (0ms)
  showLogo();

  // Step 2: Show progress items with typewriter effect (800ms)
  await delay(800);
  await showProgressItems();

  // Step 3: "ACCESS GRANTED" flash (200ms after last item)
  await delay(200);
  await showAccessGranted();

  // Step 4: Blast door effect (500ms)
  await delay(500);
  await blastDoorReveal();

  // Step 5: Remove overlay (after animation)
  await delay(1000);
  removeOverlay();

  // Mark as complete
  localStorage.setItem(STORAGE_KEY, 'true');

  console.log('[LoadingSequence] Sequence complete');
}

// ── Create Overlay ────────────────────────────────────────────────────────

function createOverlay(): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'loading-sequence-overlay';
  overlayEl.innerHTML = `
    <div class="loading-logo">
      <div class="atlas-symbol-large">◈</div>
    </div>
    <div class="loading-status">INITIALIZING SYSTEMS...</div>
    <div class="loading-progress" id="loading-progress"></div>
    <div class="loading-access" id="loading-access"></div>
    <div class="blast-door-left"></div>
    <div class="blast-door-right"></div>
  `;
  document.body.appendChild(overlayEl);
}

// ── Step 1: Show Logo ─────────────────────────────────────────────────────

function showLogo(): void {
  // Logo already visible via CSS, just ensure overlay is shown
  if (overlayEl) {
    overlayEl.style.opacity = '1';
  }
}

// ── Step 2: Progress Items ────────────────────────────────────────────────

const progressSteps = [
  'Connecting to 32 data sources...',
  'Loading intelligence layers...',
  'Initializing signal engine...',
  'Loading portfolio state...',
  'Establishing market data streams...',
];

async function showProgressItems(): Promise<void> {
  const progressContainer = document.getElementById('loading-progress');
  if (!progressContainer) return;

  for (const step of progressSteps) {
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.innerHTML = `
      <span class="progress-bullet">●</span>
      <span class="progress-text">${step}</span>
      <span class="progress-check">✓</span>
    `;
    progressContainer.appendChild(item);

    // Typewriter effect
    await delay(60);

    // Trigger check animation
    setTimeout(() => {
      item.classList.add('complete');
    }, 300);

    // Delay before next item
    await delay(250);
  }
}

// ── Step 3: Access Granted ────────────────────────────────────────────────

async function showAccessGranted(): Promise<void> {
  const accessEl = document.getElementById('loading-access');
  if (!accessEl) return;

  accessEl.textContent = 'ACCESS GRANTED';
  accessEl.classList.add('visible');

  // Flash animation
  await delay(800);
  accessEl.classList.add('flash');
}

// ── Step 4: Blast Door Reveal ─────────────────────────────────────────────

async function blastDoorReveal(): Promise<void> {
  if (!overlayEl) return;

  overlayEl.classList.add('blast-door-opening');

  // Doors slide open over 1s
  await delay(1000);
}

// ── Step 5: Remove Overlay ────────────────────────────────────────────────

function removeOverlay(): void {
  if (overlayEl) {
    overlayEl.style.opacity = '0';
    setTimeout(() => {
      overlayEl?.remove();
      overlayEl = null;
    }, 300);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── CSS Injection ─────────────────────────────────────────────────────────

function injectStyles(): void {
  const styleId = 'loading-sequence-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Overlay */
    .loading-sequence-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #000;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease-out;
    }

    /* Logo */
    .loading-logo {
      margin-bottom: 60px;
    }

    .atlas-symbol-large {
      font-size: 120px;
      color: var(--text-accent);
      text-shadow: 0 0 40px var(--text-accent);
      animation: logo-pulse 2s ease-in-out infinite;
    }

    @keyframes logo-pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 1;
        text-shadow: 0 0 40px var(--text-accent);
      }
      50% {
        transform: scale(1.05);
        opacity: 0.9;
        text-shadow: 0 0 60px var(--text-accent);
      }
    }

    /* Status text */
    .loading-status {
      font-family: var(--font-mono);
      font-size: 14px;
      letter-spacing: 0.1em;
      color: var(--text-accent);
      margin-bottom: 40px;
      opacity: 0.7;
    }

    /* Progress items */
    .loading-progress {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 400px;
    }

    .progress-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text-tertiary);
      opacity: 0;
      animation: item-appear 0.3s ease-out forwards;
    }

    @keyframes item-appear {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .progress-bullet {
      color: var(--text-accent);
      font-size: 8px;
    }

    .progress-text {
      flex: 1;
    }

    .progress-check {
      color: var(--signal-positive);
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .progress-item.complete .progress-check {
      opacity: 1;
      transform: scale(1);
    }

    .progress-item.complete .progress-text {
      color: var(--text-secondary);
    }

    /* Access granted */
    .loading-access {
      margin-top: 40px;
      font-family: var(--font-ui);
      font-size: 20px;
      font-weight: var(--font-bold);
      letter-spacing: 0.15em;
      color: var(--signal-positive);
      text-shadow: 0 0 20px var(--signal-positive);
      opacity: 0;
      transform: scale(0.9);
      transition: all 0.4s ease-out;
    }

    .loading-access.visible {
      opacity: 1;
      transform: scale(1);
    }

    .loading-access.flash {
      animation: access-flash 0.8s ease-out;
    }

    @keyframes access-flash {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
        transform: scale(1.1);
      }
    }

    /* Blast doors */
    .blast-door-left,
    .blast-door-right {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      background: #000;
      z-index: 1;
      transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1);
    }

    .blast-door-left {
      left: 0;
      border-right: 2px solid var(--text-accent);
      box-shadow: inset -4px 0 12px rgba(212, 168, 67, 0.3);
    }

    .blast-door-right {
      right: 0;
      border-left: 2px solid var(--text-accent);
      box-shadow: inset 4px 0 12px rgba(212, 168, 67, 0.3);
    }

    .loading-sequence-overlay.blast-door-opening .blast-door-left {
      transform: translateX(-100%);
    }

    .loading-sequence-overlay.blast-door-opening .blast-door-right {
      transform: translateX(100%);
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .atlas-symbol-large {
        font-size: 80px;
      }

      .loading-progress {
        min-width: 90%;
        padding: 0 20px;
      }

      .progress-item {
        font-size: 12px;
      }

      .loading-status {
        font-size: 12px;
      }

      .loading-access {
        font-size: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-inject styles
injectStyles();

// ── Public API ────────────────────────────────────────────────────────────

export function resetFirstVisit(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[LoadingSequence] First visit reset');
}
