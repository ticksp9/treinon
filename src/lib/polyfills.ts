/**
 * Small gaps in older Safari (iPads/iPhones on iOS 12–15) that the build polyfills
 * do not cover. Imported first in main.tsx.
 */
const c = globalThis.crypto as Crypto | undefined;
if (c && typeof c.randomUUID !== 'function' && typeof c.getRandomValues === 'function') {
  // RFC 4122 version 4 (iOS < 15.4 has getRandomValues but not randomUUID)
  (c as Crypto & { randomUUID: () => string }).randomUUID = () => {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}

export {};
