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
 * the dev-server root locally. Background matches CSS --bg (#f6f3ef).
 */
export const pwaManifest: PwaManifest = {
  name: "FermentStation",
  short_name: "Ferment",
  id: "./",
  start_url: "./",
  scope: "./",
  display: "standalone",
  theme_color: "#9d4934",
  background_color: "#f6f3ef",
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
