/**
 * Where is the app open, and how can it be installed from there?
 * iPhone/iPad have no install button: only "Add to Home Screen" from the share menu,
 * which does not exist inside apps like WhatsApp, Instagram, Gmail or the Google app.
 */
export type InstallEnv =
  | 'installed'
  | 'ios-safari'
  | 'ios-other-browser' // Chrome/Edge/Firefox on iOS 16.4+: share button in the address bar
  | 'ios-in-app' // opened inside another app → must open in Safari first
  | 'android'
  | 'desktop';

export function detectInstallEnv(ua: string, opts: { standalone?: boolean; touchMac?: boolean } = {}): InstallEnv {
  if (opts.standalone) return 'installed';
  const ios = /iPad|iPhone|iPod/.test(ua) || (!!opts.touchMac && ua.includes('Mac'));
  if (ios) {
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|LinkedInApp|Twitter|TikTok|Snapchat|GoogleApp|MicroMessenger/i.test(ua)) return 'ios-in-app';
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'ios-other-browser';
    // Safari has "Version/x Mobile/… Safari/…"; in-app web views usually lack "Safari"
    if (!/Safari\//.test(ua) || !/Version\//.test(ua)) return 'ios-in-app';
    return 'ios-safari';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function currentInstallEnv(): InstallEnv {
  if (typeof window === 'undefined') return 'desktop';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  return detectInstallEnv(navigator.userAgent, { standalone, touchMac: 'ontouchend' in document });
}
