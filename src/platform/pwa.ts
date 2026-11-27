export interface PwaManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

export interface PwaManifest {
  name: string;
  short_name: string;
  id: string;
  start_url: string;
  scope: string;
  display: "standalone";
  theme_color: string;
  background_color: string;
  icons: PwaManifestIcon[];
}

/**
 * Single source for install metadata shared by tests and vite.config.ts.
 * Relative id/start_url/scope resolve to the Pages subpath on Pages and to
 * the dev-server root locally. Theme and background match the
 * Swipe ground, CSS --colour-surface-inverse (#000000).
 */
export const pwaManifest: PwaManifest = {
  name: "FermentStation",
  short_name: "Ferment",
  id: "./",
  start_url: "./",
  scope: "./",
  display: "standalone",
  theme_color: "#000000",
  background_color: "#000000",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

/** Service workers back web offline only; native shells must not register one. */
export function shouldRegisterServiceWorker(input: { native: boolean }): boolean {
  return !input.native;
}

export interface ViewportSample {
  /** navigator.standalone: true only in an iOS home-screen web app. */
  iosStandalone: boolean;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * Pixels the layout viewport falls short of the screen in an iOS home-screen web app.
 * iOS 26 standalone web apps can report innerHeight (and so 100vh/100dvh) about one status bar
 * shorter than the screen they actually paint, which lifts bottom-anchored UI off the home
 * indicator (WebKit bug 316008). There the app always fills the screen, so the screen's long or
 * short side (iOS keeps screen.width/height in portrait) is the true height. Elsewhere: 0.
 */
export function viewportShortfall(sample: ViewportSample): number {
  if (!sample.iosStandalone) return 0;
  const landscape = sample.innerWidth > sample.innerHeight;
  const screenHeight = landscape
    ? Math.min(sample.screenWidth, sample.screenHeight)
    : Math.max(sample.screenWidth, sample.screenHeight);
  return Math.max(0, Math.round(screenHeight - sample.innerHeight));
}
