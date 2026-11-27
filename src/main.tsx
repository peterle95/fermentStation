import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { App } from "./App";
import "./styles.css";
import { shouldRegisterServiceWorker, viewportShortfall } from "./platform/pwa";

// Publish how far an iOS home-screen app's viewport falls short of the screen (see viewportShortfall).
function updateViewportShortfall() {
  const shortfall = viewportShortfall({
    iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
  });
  const root = document.documentElement;
  root.style.setProperty("--viewport-shortfall", `${shortfall}px`);
  // The shell then reaches past the reported viewport; keep that strip from scrolling the page.
  root.style.overflow = shortfall > 0 ? "hidden" : "";
}
updateViewportShortfall();
window.addEventListener("resize", updateViewportShortfall);
window.addEventListener("orientationchange", updateViewportShortfall);

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
