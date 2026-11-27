import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App } from "./App";
import "./styles.css";
import { shouldRegisterServiceWorker } from "./platform/pwa";
import { installViewportDebug } from "./platform/viewport-debug";

// TEMPORARY: iOS layout diagnostics (?viewport-debug, or a two-finger hold). Remove once the layout is confirmed.
installViewportDebug();

if (shouldRegisterServiceWorker({ native: Capacitor.isNativePlatform() })) {
  void import("virtual:pwa-register").then(({ registerSW }) =>
    registerSW({ immediate: true }),
  ).catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
