import "./lib/polyfills";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
// Self-hosted fonts: work offline on the pitch and no request to Google (GDPR)
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

// tells the startup safety net in index.html that the app is running
(window as unknown as { __treinonBooted?: boolean }).__treinonBooted = true;
