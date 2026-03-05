/**
 * YC Hedge Fund - First-visit welcome popup
 * Shows once per browser, with logo + catchy YC-themed message
 */

const STORAGE_KEY = 'yc-hedge-fund-welcome-seen';

const WELCOME_MESSAGES = [
  "Welcome! The YC stands for Y Combinator — we're manifesting it. In the meantime, enjoy paper trading on global chaos. 📈",
  "You've discovered the world's most ambitious hedge fund dashboard. Now we just need Y Combinator to discover us. Built with 100% hope and a dash of geopolitical intelligence.",
  "Welcome to YC Hedge Fund — where we trade on geopolitics before they trade on us. (YC application: pending. 🚀)",
  "We watch the world burn. We trade on it. We really, really want to go to YC. This is the pitch. Please save. 🙏",
];

function pickMessage(): string {
  const idx = Math.floor(Math.random() * WELCOME_MESSAGES.length);
  return WELCOME_MESSAGES[idx]!;
}

export function initWelcomePopup(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'welcome-popup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'welcome-title');

  overlay.innerHTML = `
    <div class="welcome-popup">
      <div class="welcome-popup-logo">
        <img src="/icon-192.png?v=2" alt="YC Hedge Fund" width="120" height="120" />
      </div>
      <h1 id="welcome-title" class="welcome-popup-title">Welcome to YC Hedge Fund</h1>
      <p class="welcome-popup-subtitle">Global Intelligence × Paper Trading</p>
      <p class="welcome-popup-message">${pickMessage()}</p>
      <button class="welcome-popup-cta" id="welcome-popup-close">
        Let's go →
      </button>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const closeBtn = overlay.querySelector('#welcome-popup-close');
  closeBtn?.addEventListener('click', close);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  function close(): void {
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('welcome-popup-closing');
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch { /* ignore */ }
      // Start onboarding tour on first visit (after a short delay for panels to render)
      import('./onboarding').then(({ startOnboarding, shouldShowOnboarding }) => {
        if (shouldShowOnboarding()) {
          setTimeout(() => startOnboarding(), 400);
        }
      });
    }, { once: true });
  }

  document.body.appendChild(overlay);

  // Trigger entrance animation after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('welcome-popup-visible');
    });
  });
}
