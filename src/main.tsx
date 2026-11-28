import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App } from "./App";
import { UpdatePrompt } from "./components/UpdatePrompt";
import "./styles.css";
import { pwaUpdate, shouldRegisterServiceWorker } from "./platform/pwa";

/** Checks for a new version hourly and whenever the app returns to the foreground, like books-to-read. */
function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const check = () => void registration.update().catch(() => undefined);
  setInterval(check, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
}

if (shouldRegisterServiceWorker({ native: Capacitor.isNativePlatform() })) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      // A new worker installed beside the active one: offer it; updateSW(true) activates it and reloads.
      onNeedRefresh: () => pwaUpdate.offer(() => updateSW(true)),
      onRegisteredSW: (_url, registration) => {
        if (registration) watchForUpdates(registration);
      },
    });
  }).catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
);
