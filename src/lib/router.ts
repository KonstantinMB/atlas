/**
 * Client-side routing — dashboard | leaderboard
 * Exported for use by main.ts and command-palette.
 */

export type ViewState = 'dashboard' | 'leaderboard';

export function getViewFromPath(): ViewState {
  return window.location.pathname === '/leaderboard' ? 'leaderboard' : 'dashboard';
}

function updateNavForView(view: ViewState): void {
  const navTabs = document.querySelector('.header-nav-tabs');
  const backBtn = document.getElementById('dashboard-back');
  if (!navTabs || !backBtn) return;
  if (view === 'leaderboard') {
    navTabs.setAttribute('aria-hidden', 'true');
    (navTabs as HTMLElement).style.display = 'none';
    backBtn.style.display = '';
  } else {
    navTabs.removeAttribute('aria-hidden');
    (navTabs as HTMLElement).style.display = '';
    backBtn.style.display = 'none';
  }
}

export async function navigateToLeaderboard(): Promise<void> {
  history.pushState({ view: 'leaderboard' }, '', '/leaderboard');
  const { showLeaderboard } = await import('../views/leaderboard');
  showLeaderboard();
  updateNavForView('leaderboard');
}

export async function navigateToDashboard(): Promise<void> {
  history.pushState({ view: 'dashboard' }, '', '/');
  const { hideLeaderboard } = await import('../views/leaderboard');
  hideLeaderboard();
  updateNavForView('dashboard');
}

export function initRouter(backBtn: HTMLElement | null): void {
  backBtn?.addEventListener('click', () => void navigateToDashboard());

  window.addEventListener('popstate', async () => {
    const view = getViewFromPath();
    if (view === 'leaderboard') {
      const { showLeaderboard } = await import('../views/leaderboard');
      showLeaderboard();
    } else {
      const { hideLeaderboard } = await import('../views/leaderboard');
      hideLeaderboard();
    }
    updateNavForView(view);
  });
}

export async function setupInitialView(): Promise<void> {
  const view = getViewFromPath();
  if (view === 'leaderboard') {
    const { showLeaderboard } = await import('../views/leaderboard');
    showLeaderboard();
    updateNavForView('leaderboard');
  }
}
