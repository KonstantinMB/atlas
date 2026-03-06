/**
 * YC Hedge Fund - Onboarding teaser banner
 * Pops up every app open until user clicks X. Directs users to the ? button for the guided tour.
 */

const STORAGE_KEY = 'atlas-onboarding-teaser-dismissed';

export function initOnboardingTeaser(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch {
    return;
  }

  const banner = document.createElement('div');
  banner.className = 'onboarding-teaser';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  banner.innerHTML = `
    <span class="onboarding-teaser-text">New here? Click <strong>?</strong> for a guided tour.</span>
    <button type="button" class="onboarding-teaser-close" id="onboarding-teaser-close" aria-label="Dismiss">×</button>
  `;

  function positionNearButton(): void {
    const btn = document.getElementById('onboarding-tour-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    banner.style.top = `${rect.bottom + 6}px`;
    banner.style.left = `${rect.left}px`;
    banner.style.right = 'auto';
  }

  const closeBtn = banner.querySelector('#onboarding-teaser-close');
  closeBtn?.addEventListener('click', () => {
    window.removeEventListener('resize', positionNearButton);
    banner.classList.add('onboarding-teaser-closing');
    banner.addEventListener('transitionend', () => {
      banner.remove();
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch { /* ignore */ }
    }, { once: true });
  });

  document.body.appendChild(banner);
  positionNearButton();
  window.addEventListener('resize', positionNearButton);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.classList.add('onboarding-teaser-visible');
    });
  });
}
