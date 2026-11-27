/**
 * TEMPORARY viewport readout for diagnosing the iOS home-screen layout (remove once confirmed).
 * Shows what the device reports for the screen, the viewports, the viewport units and the safe areas, and where
 * the shell and the phone nav actually land, so the layout can be fixed from numbers instead of guesses.
 *
 * Open it with ?viewport-debug or #viewport-debug in the URL, or, inside the installed app where the URL can't be
 * edited, hold two fingers on the screen for one second (the same gesture hides it again).
 */

const PROBES = ["100vh", "100svh", "100lvh", "100dvh", "env(safe-area-inset-top)", "env(safe-area-inset-bottom)", "env(safe-area-inset-left)", "env(safe-area-inset-right)"] as const;

function measure(probe: HTMLElement, length: string): number {
  probe.style.height = length;
  return Math.round(probe.getBoundingClientRect().height * 10) / 10;
}

function rect(selector: string): string {
  const element = document.querySelector(selector);
  if (!element) return "–";
  const box = element.getBoundingClientRect();
  return `top ${Math.round(box.top)} bottom ${Math.round(box.bottom)} h ${Math.round(box.height)}`;
}

function report(probe: HTMLElement): string {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  const viewport = window.visualViewport;
  const scroller = document.scrollingElement;
  const ios = /OS (\d+)_(\d+)(?:_(\d+))? like Mac OS X/.exec(navigator.userAgent);
  const lines = [
    `iOS ${ios ? ios.slice(1).filter(Boolean).join(".") : "–"}  standalone ${String(standalone)}  display-mode ${matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser"}`,
    `screen ${screen.width}×${screen.height}  dpr ${devicePixelRatio}`,
    `inner ${innerWidth}×${innerHeight}  client ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}`,
    `visualViewport ${viewport ? `${Math.round(viewport.width)}×${Math.round(viewport.height)} top ${Math.round(viewport.offsetTop)} scale ${viewport.scale}` : "–"}`,
    `page scroll ${scroller ? `${Math.round(scroller.scrollTop)} of ${scroller.scrollHeight - scroller.clientHeight}` : "–"}`,
    ...PROBES.map((length) => `${length} = ${measure(probe, length)}`),
    `.app-shell ${rect(".app-shell")}`,
    `.design-topbar ${rect(".design-topbar")}`,
    `.phone-navigation ${rect(".phone-navigation")}`,
    `dialog[open] ${rect("dialog[open]")}`,
  ];
  return lines.join("\n");
}

function show(): () => void {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;";
  const panel = document.createElement("pre");
  panel.setAttribute("aria-hidden", "true");
  panel.style.cssText = "position:fixed;z-index:2147483647;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 8px);margin:0;padding:8px;border-radius:8px;background:rgba(0,0,0,.85);color:#b8f075;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;pointer-events:none;";
  document.body.append(probe, panel);
  let frame = 0;
  const update = () => { frame = 0; panel.textContent = report(probe); };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const timer = setInterval(schedule, 500);
  const events = ["resize", "orientationchange", "scroll"] as const;
  for (const event of events) window.addEventListener(event, schedule, { passive: true, capture: true });
  window.visualViewport?.addEventListener("resize", schedule);
  update();
  return () => {
    clearInterval(timer);
    if (frame) cancelAnimationFrame(frame);
    for (const event of events) window.removeEventListener(event, schedule, { capture: true });
    window.visualViewport?.removeEventListener("resize", schedule);
    probe.remove();
    panel.remove();
  };
}

export function installViewportDebug(): void {
  let hide: (() => void) | null = null;
  const toggle = () => { if (hide) { hide(); hide = null; } else { hide = show(); } };
  if (/[?&#]viewport-debug\b/.test(location.search + location.hash)) toggle();

  let hold = 0;
  const cancel = () => { clearTimeout(hold); hold = 0; };
  window.addEventListener("touchstart", (event) => {
    cancel();
    if (event.touches.length === 2) hold = window.setTimeout(() => { hold = 0; toggle(); }, 1000);
  }, { passive: true });
  window.addEventListener("touchmove", cancel, { passive: true });
  window.addEventListener("touchend", cancel, { passive: true });
  window.addEventListener("touchcancel", cancel, { passive: true });
}
