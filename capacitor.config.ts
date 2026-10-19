import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iPhone/iPad app (App Store). It opens the live TreinON, so every update published on
 * the web reaches the app at once, without a new App Store release. The files in dist/ are
 * only the fallback the app ships with.
 */
const config: CapacitorConfig = {
  appId: 'pt.treinon.app',
  appName: 'TreinON',
  webDir: 'dist',
  server: {
    url: 'https://treinon.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#1b2230',
    preferredContentMode: 'mobile',
  },
};

export default config;
