import { describe, it, expect } from 'vitest';
import { detectInstallEnv } from '@/lib/install-env';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0';
const WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const GOOGLE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/330.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

describe('install environment', () => {
  it('recognises Safari on iPhone', () => expect(detectInstallEnv(SAFARI)).toBe('ios-safari'));
  it('Chrome on iPhone', () => expect(detectInstallEnv(CHROME_IOS)).toBe('ios-other-browser'));
  it('inside other apps', () => {
    expect(detectInstallEnv(INSTAGRAM)).toBe('ios-in-app');
    expect(detectInstallEnv(WEBVIEW)).toBe('ios-in-app');
    expect(detectInstallEnv(GOOGLE_APP)).toBe('ios-in-app');
  });
  it('Android, desktop and already installed', () => {
    expect(detectInstallEnv(ANDROID)).toBe('android');
    expect(detectInstallEnv('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(detectInstallEnv(SAFARI, { standalone: true })).toBe('installed');
  });
});
