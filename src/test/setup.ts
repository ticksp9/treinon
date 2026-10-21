import "@testing-library/jest-dom";

// the app follows the phone's language on a first visit; the tests are written for Portuguese
try { localStorage.setItem("language", "pt"); } catch { /* no storage */ }

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
