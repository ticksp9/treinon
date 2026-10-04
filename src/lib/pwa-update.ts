/**
 * Keep every installed copy of the app up to date. Before, a new version was
 * downloaded in the background but the open app (installed on PC/iPad) kept
 * showing the old screens until someone reloaded it by hand.
 *
 * Now: look for a new version when the app comes back to the front and every
 * 15 minutes; when there is one, reload — but never during a live match (the
 * live match sets window.__treinonLiveMatch); then it waits for the match to end.
 */
import { registerSW } from 'virtual:pwa-register';

declare global {
  interface Window { __treinonLiveMatch?: boolean }
}

export function setupAutoUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  let pending = false;

  const apply = () => {
    if (!pending) return;
    if (window.__treinonLiveMatch) { setTimeout(apply, 30_000); return; }
    pending = false;
    void updateSW(true); // activates the new version and reloads the page
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() { pending = true; apply(); },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => { if (navigator.onLine) registration.update().catch(() => { /* offline */ }); };
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('focus', check);
    },
  });
}
