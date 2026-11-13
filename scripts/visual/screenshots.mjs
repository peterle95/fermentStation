#!/usr/bin/env node
// Visual verification: serves the app with Vite, seeds representative data through the app's
// real storage layer, drives the real UI in the locally installed Chrome/Edge over the DevTools
// protocol, and writes screenshots plus a machine-readable layout report.
// Usage and output layout: docs/design/visual-verification.md
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ---------------------------------------------------------------------------------------------
// What gets captured

const viewports = [
  { name: "1440x900", alias: "desktop", width: 1440, height: 900, mobile: false },
  { name: "1024x768", alias: "tablet-landscape", width: 1024, height: 768, mobile: true },
  { name: "768x1024", alias: "tablet-portrait", width: 768, height: 1024, mobile: true },
  { name: "390x844", alias: "phone", width: 390, height: 844, mobile: true },
  { name: "320x640", alias: "phone-small", width: 320, height: 640, mobile: true },
];

const detailBatch = "Napa cabbage kimchi";
const openDetail = [
  { tap: `.design-batch-card[aria-label="Open ${detailBatch}"]` },
  { waitFor: ".design-detail .batch-workspace" },
];

// Each surface is reached through real taps from a fresh load of the seeded app.
const surfaces = [
  { name: "overview", description: "Batch overview (My batches)", steps: [{ waitFor: ".design-batch-card" }] },
  { name: "all-batches", description: "All batches list", steps: [{ tap: ".batch-view-switch button:nth-child(2)" }, { waitFor: '.batch-view-switch button:nth-child(2)[aria-pressed="true"]' }] },
  { name: "batch-detail", description: `Batch detail (${detailBatch})`, steps: openDetail },
  { name: "observation-logger", description: "Batch detail with the Add observation logger open", steps: [...openDetail, { tap: ".design-detail .design-record-observation" }, { waitFor: "dialog.observation-logger.station-dialog[open]" }] },
  { name: "batch-tools", description: "Batch detail with Batch tools open, scrolled to the tools", steps: [...openDetail, { tap: '.design-detail button[aria-label="More batch tools"]' }, { waitFor: "#batch-management" }, { scrollTo: "#batch-management" }] },
  { name: "upcoming-strip", description: "Batch overview with More batch actions open, scrolled to the upcoming strip", steps: [{ waitFor: ".design-batch-card" }, { tap: ".design-more-actions > summary" }, { waitFor: ".upcoming-strip .small-card" }, { scrollTo: ".upcoming" }] },
  { name: "checks", description: "Checks view", steps: [{ tap: ".navigation .nav-checks" }, { waitFor: ".design-checks-view" }] },
  { name: "calendar", description: "Calendar", steps: [{ tap: ".navigation .nav-calendar" }, { waitFor: ".calendar-screen" }] },
  { name: "profiles", description: "Fermentation profiles", steps: [{ tap: ".navigation .nav-profiles" }, { waitFor: ".profiles-screen .profile-card" }] },
  { name: "profile-editor", description: "Profile editor (Kimchi)", steps: [{ tap: ".navigation .nav-profiles" }, { tap: 'button[aria-label="Edit Kimchi"]' }, { waitFor: ".app-shell.profile-editor-shell" }] },
  { name: "batch-creation", description: "Start a batch dialog", steps: [{ tap: ".design-topbar .batch-fab" }, { waitFor: "dialog.station-dialog[open]" }] },
  { name: "settings", description: "Settings", steps: [{ tap: '.design-topbar button[aria-label="Settings"]' }, { waitFor: ".settings-screen" }] },
  { name: "first-run", description: "Empty first-run state (no saved data)", scenario: "empty", steps: [{ waitFor: ".design-dashboard" }] },
  // Ticket 14: states styled before the harness could reach them. No baseline exists for these.
  { name: "trash", description: "Settings with Recently deleted batches open, scrolled to the trash rows", steps: [{ tap: '.design-topbar button[aria-label="Settings"]' }, { waitFor: ".settings-screen" }, { tap: ".settings-trash-toggle" }, { waitFor: ".deleted-batches-panel .trash-item" }, { scrollTo: ".settings-trash-toggle" }] },
  { name: "batch-picker", description: "Choose a batch sheet from an upcoming-strip day with several batches", steps: [{ waitFor: ".design-batch-card" }, { tap: ".design-more-actions > summary" }, { waitFor: '.upcoming-strip button[aria-haspopup="dialog"]' }, { tap: '.upcoming-strip button[aria-haspopup="dialog"]' }, { waitFor: "dialog.upcoming-batch-picker[open]" }] },
  { name: "profile-overview", description: "Profile overview dialog (Kimchi)", steps: [{ tap: ".navigation .nav-profiles" }, { tap: 'button[aria-label="View Kimchi guidance"]' }, { waitFor: "dialog.station-dialog[open]" }] },
  { name: "batch-dates", description: `Batch dates dialog (${detailBatch})`, steps: [...openDetail, { tap: '.design-detail button[aria-label="View batch dates"]' }, { waitFor: "dialog.station-dialog[open]" }] },
  { name: "profile-inputs", description: `Profile inputs dialog (${detailBatch})`, steps: [...openDetail, { tap: ".design-detail .design-input-summary .design-quiet" }, { waitFor: "dialog.station-dialog[open]" }] },
  { name: "station-info", description: "Station information dialog", steps: [{ waitFor: ".design-batch-card" }, { tap: ".design-account, .station-identity" }, { waitFor: "dialog.station-dialog[open]" }] },
];

// ---------------------------------------------------------------------------------------------
// Command line

const { values: args } = parseArgs({
  options: {
    surface: { type: "string", short: "s" },
    viewport: { type: "string", short: "v" },
    baseline: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    out: { type: "string" },
    "no-full": { type: "boolean", default: false },
    url: { type: "string" },
    date: { type: "string", default: "2026-03-18" },
    timezone: { type: "string", default: "Europe/Berlin" },
    locale: { type: "string", default: "en-GB" },
    scale: { type: "string", default: "1" },
    jobs: { type: "string", default: "4" },
    browser: { type: "string" },
    list: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help) {
  console.log(`npm run screenshots -- [options]

  -s, --surface a,b     only these surfaces (default: all)
  -v, --viewport a,b    only these viewports, by size or alias (default: all)
      --baseline        write to the baseline tree instead of current (refuses to overwrite without --force)
      --force           allow replacing existing baseline captures
      --out DIR         write to DIR instead
      --no-full         skip the unrolled full-height captures (faster)
      --url URL         use an already running Vite dev server for this repo instead of starting one
      --date YYYY-MM-DD frozen "today" for the app clock (default ${args.date})
      --scale N         device pixel ratio (default 1)
      --jobs N          pages captured in parallel (default 4)
      --browser PATH    Chrome/Edge executable (default: CHROME_PATH or the installed Chrome/Edge)
      --list            list surfaces and viewports`);
  process.exit(0);
}

if (args.list) {
  console.log("Surfaces:");
  for (const surface of surfaces) console.log(`  ${surface.name.padEnd(20)} ${surface.description}`);
  console.log("Viewports:");
  for (const viewport of viewports) console.log(`  ${viewport.name.padEnd(20)} ${viewport.alias}`);
  process.exit(0);
}

function pick(list, filter, match, kind) {
  if (!filter) return list;
  const wanted = filter.split(",").map((item) => item.trim()).filter(Boolean);
  const unknown = wanted.filter((item) => !list.some((entry) => match(entry, item)));
  if (unknown.length) throw new Error(`Unknown ${kind}: ${unknown.join(", ")}. Use --list.`);
  return list.filter((entry) => wanted.some((item) => match(entry, item)));
}

const selectedSurfaces = pick(surfaces, args.surface, (entry, item) => entry.name === item, "surface");
const selectedViewports = pick(viewports, args.viewport, (entry, item) => entry.name === item || entry.alias === item, "viewport");
const filtered = Boolean(args.surface || args.viewport);
const captureFull = !args["no-full"];
const scale = Number(args.scale);
const jobs = Math.max(1, Number.parseInt(args.jobs, 10) || 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("--date must be YYYY-MM-DD");

/** The baseline lives in the main checkout so linked worktrees compare against the same capture. */
function mainCheckout() {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf8" }).trim();
    return path.basename(common) === ".git" ? path.dirname(common) : repoRoot;
  } catch {
    return repoRoot;
  }
}

/** Which code a capture shows: commit, branch and whether app sources had uncommitted changes. */
function sourceRevision() {
  const git = (...values) => execFileSync("git", values, { cwd: repoRoot, encoding: "utf8" }).trim();
  try {
    return {
      commit: git("rev-parse", "--short", "HEAD"),
      branch: git("rev-parse", "--abbrev-ref", "HEAD"),
      uncommittedAppChanges: git("status", "--porcelain", "--", "src", "public", "index.html").split(/\r?\n/).filter(Boolean),
    };
  } catch {
    return null;
  }
}

const baselineDir = path.join(mainCheckout(), "screenshots", "baseline");
const currentDir = path.join(repoRoot, "screenshots", "current");
const outDir = path.resolve(args.out ?? (args.baseline ? baselineDir : currentDir));
const isBaseline = outDir === baselineDir;

// ---------------------------------------------------------------------------------------------
// Minimal Chrome DevTools Protocol client (Node's built-in WebSocket, flattened sessions)

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      this.listeners.get(message.sessionId ?? "")?.forEach((listener) => listener(message));
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Browser connection closed"));
      this.pending.clear();
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new Cdp(socket)), { once: true });
      socket.addEventListener("error", () => reject(new Error(`Unable to connect to ${url}`)), { once: true });
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  on(sessionId, listener) {
    if (!this.listeners.has(sessionId)) this.listeners.set(sessionId, new Set());
    this.listeners.get(sessionId).add(listener);
    return () => this.listeners.get(sessionId)?.delete(listener);
  }

  close() {
    this.socket.close();
  }
}

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms: ${what}`)), ms); }),
  ]);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------
// Browser and server

function findBrowser() {
  const candidates = [
    args.browser,
    process.env.CHROME_PATH,
    ...(process.platform === "win32" ? [
      path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
      path.join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
      path.join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
    ] : process.platform === "darwin" ? [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"]),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`No Chrome or Edge found. Pass --browser PATH or set CHROME_PATH. Tried:\n  ${candidates.join("\n  ")}`);
  return found;
}

async function launchBrowser() {
  const executable = findBrowser();
  const profile = await mkdtemp(path.join(tmpdir(), "fermentstation-visual-"));
  const child = spawn(executable, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-features=Translate,MediaRouter,OptimizationHints",
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--hide-crash-restore-bubble",
    "--mute-audio",
    "about:blank",
  ], { stdio: "ignore" });
  const portFile = path.join(profile, "DevToolsActivePort");
  const started = Date.now();
  while (!existsSync(portFile)) {
    if (child.exitCode !== null) throw new Error(`${executable} exited with code ${child.exitCode}`);
    if (Date.now() - started > 20_000) throw new Error(`${executable} did not open a DevTools port`);
    await sleep(50);
  }
  let lines = [];
  while (lines.length < 2) {
    lines = (await readFile(portFile, "utf8")).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) await sleep(50);
  }
  const cdp = await Cdp.connect(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
  const version = await cdp.send("Browser.getVersion");
  return {
    cdp,
    executable,
    version: version.product,
    async close() {
      await cdp.send("Browser.close").catch(() => undefined);
      cdp.close();
      if (child.exitCode === null) await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(5000)]);
      if (child.exitCode === null) child.kill();
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
    },
  };
}

async function startServer() {
  if (args.url) return { url: args.url.endsWith("/") ? args.url : `${args.url}/`, close: async () => undefined };
  const { createServer } = await import("vite");
  const server = await createServer({
    root: repoRoot,
    configFile: path.join(repoRoot, "vite.config.ts"),
    logLevel: "error",
    clearScreen: false,
    server: { port: 5199, strictPort: false, hmr: false, watch: null, open: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite did not report a local URL");
  return { url, close: () => server.close() };
}

// ---------------------------------------------------------------------------------------------
// In-page helpers (serialised with Function.prototype.toString; keep them self-contained)

function freezeClock(isoLocal) {
  const RealDate = Date;
  const offset = new RealDate(isoLocal).getTime() - RealDate.now();
  const now = () => RealDate.now() + offset;
  globalThis.Date = new Proxy(RealDate, {
    construct(target, values, newTarget) { return Reflect.construct(target, values.length ? values : [now()], newTarget); },
    apply() { return new RealDate(now()).toString(); },
    get(target, property, receiver) { return property === "now" ? now : Reflect.get(target, property, receiver); },
  });
}

async function waitForVisible(selector, timeout) {
  const shown = (element) => (typeof element.checkVisibility !== "function" || element.checkVisibility({ checkVisibilityCSS: true })) &&
    element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    if ([...document.querySelectorAll(selector)].some(shown)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function locate(selector) {
  const shown = (element) => (typeof element.checkVisibility !== "function" || element.checkVisibility({ checkVisibilityCSS: true })) &&
    element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const element = [...document.querySelectorAll(selector)].find(shown);
  if (!element) return { error: `no visible element matches ${selector}` };
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { error: `${selector} is outside the viewport at (${Math.round(x)}, ${Math.round(y)})` };
  const hit = document.elementFromPoint(x, y);
  if (!hit || !(hit === element || element.contains(hit))) {
    return { error: `${selector} is covered at (${Math.round(x)}, ${Math.round(y)}) by ${hit ? hit.outerHTML.slice(0, 120) : "nothing"}` };
  }
  return { x, y };
}

// Scrolls only the app's own scroll containers, nearest first, the way a user drags a pane.
// Never scrolls the document: Element.scrollIntoView would, and that hides layout bugs behind
// harness-made states.
function reveal(selector, block) {
  const shown = (element) => (typeof element.checkVisibility !== "function" || element.checkVisibility({ checkVisibilityCSS: true })) &&
    element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const element = [...document.querySelectorAll(selector)].find(shown);
  if (!element) return false;
  const scrolls = (value) => value === "auto" || value === "scroll";
  for (let scroller = element.parentElement; scroller && scroller !== document.body && scroller !== document.documentElement; scroller = scroller.parentElement) {
    const style = getComputedStyle(scroller);
    if (!scrolls(style.overflowY) && !scrolls(style.overflowX)) continue;
    const box = scroller.getBoundingClientRect();
    const current = element.getBoundingClientRect();
    if (scrolls(style.overflowY)) {
      const offset = current.top - box.top - scroller.clientTop;
      scroller.scrollTop += block === "start" ? offset - 16 : offset - (scroller.clientHeight - current.height) / 2;
    }
    if (scrolls(style.overflowX)) {
      const offset = current.left - box.left - scroller.clientLeft;
      scroller.scrollLeft += offset - (scroller.clientWidth - current.width) / 2;
    }
  }
  return true;
}

async function settle() {
  await document.fonts.ready;
  await Promise.all([...document.images].filter((image) => !image.complete).map((image) => new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 3000);
  })));
  for (let frame = 0; frame < 3; frame += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
}

function overflowToUnroll() {
  let need = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  // Form fields scroll their own text; a taller viewport never unrolls them.
  for (const element of document.querySelectorAll("*:not(textarea, select, input)")) {
    const style = getComputedStyle(element);
    if (!/(auto|scroll)/.test(style.overflowY)) continue;
    if (typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true })) continue;
    need = Math.max(need, element.scrollHeight - element.clientHeight);
  }
  return Math.ceil(need);
}

function auditLayout() {
  const viewportWidth = document.documentElement.clientWidth;
  const modal = document.querySelector("dialog:modal");
  const round = (value) => Math.round(value * 10) / 10;
  const shown = (element) => {
    if (typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  };
  const describe = (element) => {
    const parts = [];
    for (let node = element; node && node.nodeType === 1 && parts.length < 4; node = node.parentElement) {
      let part = node.localName;
      if (node.id) { parts.unshift(`${part}#${node.id}`); break; }
      const classes = [...node.classList].slice(0, 2);
      if (classes.length) part += `.${classes.join(".")}`;
      parts.unshift(part);
    }
    return parts.join(" > ");
  };
  const label = (element) => (element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder") ||
    element.getAttribute("name") || element.getAttribute("type") || "").trim().replace(/\s+/g, " ").slice(0, 80);

  const root = document.documentElement;
  const documentOverflow = {
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowing: root.scrollWidth > root.clientWidth + 1 || document.body.scrollWidth > root.clientWidth + 1,
    // The app shell is sized to the viewport; page-level vertical scrolling means something escaped it.
    scrollHeight: root.scrollHeight,
    clientHeight: root.clientHeight,
    verticalOverflowing: root.scrollHeight > root.clientHeight + 1,
  };
  if (documentOverflow.verticalOverflowing) {
    // Usual cause: absolutely positioned descendants of a scroller whose containing block lies
    // outside that scroller, so they are not clipped and extend the document instead.
    const escapes = [];
    for (const element of document.querySelectorAll("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= root.clientHeight + 1 && rect.right <= root.clientWidth + 1) continue;
      const position = getComputedStyle(element).position;
      if (position !== "absolute") continue;
      const containingBlock = element.offsetParent;
      for (let ancestor = element.parentElement; ancestor && ancestor !== containingBlock && ancestor !== root; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).overflowY === "visible") continue;
        escapes.push({ element: describe(element), escapes: describe(ancestor), bottom: round(rect.bottom) });
        break;
      }
    }
    documentOverflow.verticalSources = escapes.slice(0, 10);
    documentOverflow.verticalSourceCount = escapes.length;
  }

  const surfaceSelector = "body, .app-shell, .content-shell, .sidebar, .main-content, .design-dashboard, .design-detail, dialog[open], main, section, article, aside, header, nav, form";
  const surfaceOverflow = [...document.querySelectorAll(surfaceSelector)].filter(shown)
    .filter((element) => element.scrollWidth > element.clientWidth + 1)
    .map((element) => ({ element: describe(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: getComputedStyle(element).overflowX }));

  const controlSelector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"], [tabindex]:not([tabindex="-1"])';
  const clippedControls = [];
  const smallTargets = [];
  let skippedBehindModal = 0;
  for (const element of document.querySelectorAll(controlSelector)) {
    if (!shown(element)) continue;
    if (modal && !modal.contains(element)) { skippedBehindModal += 1; continue; }
    const rect = element.getBoundingClientRect();
    const entry = { element: describe(element), label: label(element) };

    let clippedBy = null;
    let inScroller = false;
    let visuallyHidden = false;
    for (let ancestor = element.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      // The .sr-only pattern (1px clipped box): deliberately invisible, not a clipped control.
      if (ancestor.clientWidth <= 1 || ancestor.clientHeight <= 1) { visuallyHidden = true; break; }
      const box = ancestor.getBoundingClientRect();
      const left = box.left + ancestor.clientLeft;
      const top = box.top + ancestor.clientTop;
      const scrolls = (value) => value === "auto" || value === "scroll";
      if (!scrolls(style.overflowX) && (rect.left < left - 1 || rect.right > left + ancestor.clientWidth + 1)) { clippedBy = { axis: "x", by: describe(ancestor) }; break; }
      if (!scrolls(style.overflowY) && (rect.top < top - 1 || rect.bottom > top + ancestor.clientHeight + 1)) { clippedBy = { axis: "y", by: describe(ancestor) }; break; }
      if (scrolls(style.overflowX) || scrolls(style.overflowY)) { inScroller = true; break; }
    }
    if (visuallyHidden) continue;
    if (!clippedBy && !inScroller && (rect.left < -1 || rect.right > viewportWidth + 1)) clippedBy = { axis: "x", by: "viewport" };
    if (clippedBy) clippedControls.push({ ...entry, ...clippedBy, left: round(rect.left), right: round(rect.right), top: round(rect.top), bottom: round(rect.bottom) });
    if (["BUTTON", "A", "SUMMARY"].includes(element.tagName) && element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0) {
      clippedControls.push({ ...entry, axis: "x", by: "own text", scrollWidth: element.scrollWidth, clientWidth: element.clientWidth });
    }

    let target = rect;
    const wrappingLabel = element.closest("label");
    if (wrappingLabel && ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) target = wrappingLabel.getBoundingClientRect();
    if (target.width < 43.5 || target.height < 43.5) {
      smallTargets.push({
        ...entry,
        width: round(target.width),
        height: round(target.height),
        ...(element.tagName === "A" && getComputedStyle(element).display === "inline" ? { inline: true } : {}),
        ...(element.matches(":disabled") ? { disabled: true } : {}),
      });
    }
  }
  return { documentOverflow, surfaceOverflow, clippedControls, smallTargets, skippedBehindModal };
}

const call = (fn, ...values) => `(${fn.toString()})(${values.map((value) => JSON.stringify(value)).join(", ")})`;

// ---------------------------------------------------------------------------------------------
// One capture

async function evaluate(cdp, sessionId, expression, what) {
  const result = await withTimeout(
    cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId),
    30_000,
    what,
  );
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error(`${what}: ${details.exception?.description ?? details.text}`);
  }
  return result.result.value;
}

async function navigate(cdp, sessionId, url) {
  let unsubscribe;
  const loaded = new Promise((resolve) => {
    unsubscribe = cdp.on(sessionId, (message) => { if (message.method === "Page.loadEventFired") resolve(); });
  });
  try {
    const result = await cdp.send("Page.navigate", { url }, sessionId);
    if (result.errorText) throw new Error(`Navigation to ${url} failed: ${result.errorText}`);
    await withTimeout(loaded, 30_000, `load ${url}`);
  } finally {
    unsubscribe();
  }
}

async function tap(cdp, sessionId, viewport, selector) {
  // Tap where it is if its centre is visible and uncovered; otherwise scroll its pane first.
  let point = await evaluate(cdp, sessionId, call(locate, selector), `locate ${selector}`);
  if (point.error) {
    await evaluate(cdp, sessionId, call(reveal, selector, "center"), `reveal ${selector}`);
    point = await evaluate(cdp, sessionId, call(locate, selector), `locate ${selector}`);
  }
  if (point.error) throw new Error(point.error);
  if (viewport.mobile) {
    const touchPoints = [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints }, sessionId);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  } else {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 }, sessionId);
    // Park the pointer in the bottom-right corner so hover styling does not leak into the capture.
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: viewport.width - 1, y: viewport.height - 1 }, sessionId);
  }
}

function describeConsoleArgs(values = []) {
  return values.map((value) => value.value ?? value.description ?? value.unserializableValue ?? value.type).join(" ");
}

async function capture(browser, base, surface, viewport, full = captureFull) {
  const started = Date.now();
  const { cdp } = browser;
  const scenario = surface.scenario ?? "seeded";
  const relative = { viewport: `${surface.name}/${viewport.name}.png`, ...(full ? { full: `${surface.name}/${viewport.name}.full.png` } : {}) };
  const record = { surface: surface.name, viewport: viewport.name, scenario, files: relative, status: "ok" };
  const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const pageErrors = [];
    let collecting = false;
    const requests = new Map();
    cdp.on(sessionId, (message) => {
      const { method, params } = message;
      if (method === "Page.javascriptDialogOpening") {
        pageErrors.push({ kind: "dialog", message: `${params.type}: ${params.message} (auto-dismissed)` });
        void cdp.send("Page.handleJavaScriptDialog", { accept: false }, sessionId).catch(() => undefined);
      }
      if (method === "Network.requestWillBeSent") requests.set(params.requestId, params.request.url);
      if (!collecting) return;
      if (method === "Runtime.exceptionThrown") {
        const details = params.exceptionDetails;
        pageErrors.push({ kind: "exception", message: details.exception?.description ?? details.text, url: details.url, line: details.lineNumber });
      } else if (method === "Runtime.consoleAPICalled" && (params.type === "error" || params.type === "assert")) {
        pageErrors.push({ kind: `console.${params.type}`, message: describeConsoleArgs(params.args) });
      } else if (method === "Log.entryAdded" && params.entry.level === "error") {
        pageErrors.push({ kind: `log.${params.entry.source}`, message: params.entry.text, url: params.entry.url });
      } else if (method === "Network.loadingFailed" && !params.canceled) {
        pageErrors.push({ kind: "network", message: params.errorText, url: requests.get(params.requestId) });
      }
    });
    await Promise.all(["Page.enable", "Runtime.enable", "Log.enable", "Network.enable"].map((method) => cdp.send(method, {}, sessionId)));
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: call(freezeClock, `${args.date}T10:00:00`) }, sessionId);
    await cdp.send("Emulation.setTimezoneOverride", { timezoneId: args.timezone }, sessionId);
    await cdp.send("Emulation.setLocaleOverride", { locale: args.locale }, sessionId);
    await cdp.send("Emulation.setEmulatedMedia", { features: [
      { name: "prefers-reduced-motion", value: "reduce" },
      { name: "prefers-color-scheme", value: "light" },
    ] }, sessionId);
    if (viewport.mobile) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
    const metrics = { width: viewport.width, height: viewport.height, deviceScaleFactor: scale, mobile: viewport.mobile };
    await cdp.send("Emulation.setDeviceMetricsOverride", metrics, sessionId);

    // Seed from a same-origin document that does not run the app, then load the app on top of it.
    await navigate(cdp, sessionId, `${base}favicon-64.png`);
    record.seed = await evaluate(cdp, sessionId, `import("/scripts/visual/seed.ts").then((module) => module.seed(${JSON.stringify(scenario)}))`, "seed");
    collecting = true;
    await navigate(cdp, sessionId, base);
    if (!await evaluate(cdp, sessionId, call(waitForVisible, ".app-shell", 15_000), "wait for app")) throw new Error("App shell did not render");

    try {
      for (const step of surface.steps) {
        if (step.tap) await tap(cdp, sessionId, viewport, step.tap);
        if (step.waitFor && !await evaluate(cdp, sessionId, call(waitForVisible, step.waitFor, 10_000), `wait for ${step.waitFor}`)) {
          throw new Error(`${step.waitFor} did not become visible`);
        }
        if (step.scrollTo && !await evaluate(cdp, sessionId, call(reveal, step.scrollTo, "start"), `scroll to ${step.scrollTo}`)) {
          throw new Error(`${step.scrollTo} not found`);
        }
      }
    } catch (error) {
      // Keep going: a capture of the state where the flow broke is the most useful evidence.
      record.status = "step-failed";
      record.error = error.message;
    }

    await evaluate(cdp, sessionId, call(settle), "settle");
    await sleep(150);
    record.checks = await evaluate(cdp, sessionId, call(auditLayout), "audit");
    record.checks.pageErrors = pageErrors;
    await writePng(path.join(outDir, relative.viewport), await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId));

    if (full) {
      let height = viewport.height;
      let converged = false;
      for (let round = 0; round < 6; round += 1) {
        const need = await evaluate(cdp, sessionId, call(overflowToUnroll), "measure");
        if (need <= 1) { converged = true; break; }
        height = Math.min(16_000, height + need);
        await cdp.send("Emulation.setDeviceMetricsOverride", { ...metrics, height }, sessionId);
        await evaluate(cdp, sessionId, call(settle), "settle");
        if (height >= 16_000) break;
      }
      record.full = { height, converged };
      await writePng(path.join(outDir, relative.full), await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId));
    }
  } catch (error) {
    record.status = "failed";
    record.error = error.message;
  } finally {
    await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => undefined);
  }
  record.durationMs = Date.now() - started;
  return record;
}

async function writePng(file, { data }) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(data, "base64"));
}

// ---------------------------------------------------------------------------------------------
// Report

function counts(record) {
  const checks = record.checks;
  if (!checks) return null;
  return {
    documentOverflow: checks.documentOverflow.overflowing ? 1 : 0,
    documentVerticalOverflow: checks.documentOverflow.verticalOverflowing ? 1 : 0,
    surfaceOverflow: checks.surfaceOverflow.length,
    clippedControls: checks.clippedControls.length,
    smallTargets: checks.smallTargets.filter((target) => !target.inline && !target.disabled).length,
    pageErrors: checks.pageErrors.length,
  };
}

const findingKeys = ["documentOverflow", "documentVerticalOverflow", "surfaceOverflow", "clippedControls", "smallTargets", "pageErrors"];
const describeTotals = (totals) => findingKeys.map((key) => `${key} ${totals[key] ?? "n/a"}`).join(", ");

function summarise(captures) {
  const totals = { captures: captures.length, failed: 0, stepFailed: 0, ...Object.fromEntries(findingKeys.map((key) => [key, 0])) };
  const uniqueSmallTargets = new Map();
  for (const record of captures) {
    if (record.status === "failed") totals.failed += 1;
    if (record.status === "step-failed") totals.stepFailed += 1;
    const recordCounts = counts(record);
    if (!recordCounts) continue;
    for (const [key, value] of Object.entries(recordCounts)) totals[key] += value;
    for (const target of record.checks.smallTargets) {
      if (target.inline || target.disabled) continue;
      const key = `${target.element} | ${target.label}`;
      const entry = uniqueSmallTargets.get(key) ?? { element: target.element, label: target.label, minWidth: target.width, minHeight: target.height, viewports: new Set(), surfaces: new Set() };
      entry.minWidth = Math.min(entry.minWidth, target.width);
      entry.minHeight = Math.min(entry.minHeight, target.height);
      entry.viewports.add(record.viewport);
      entry.surfaces.add(record.surface);
      uniqueSmallTargets.set(key, entry);
    }
  }
  return {
    totals,
    uniqueSmallTargets: [...uniqueSmallTargets.values()]
      .map((entry) => ({ ...entry, viewports: [...entry.viewports], surfaces: [...entry.surfaces] }))
      .sort((left, right) => right.surfaces.length * right.viewports.length - left.surfaces.length * left.viewports.length),
  };
}

async function readReport(dir) {
  try {
    return JSON.parse(await readFile(path.join(dir, "report.json"), "utf8"));
  } catch {
    return null;
  }
}

function order(records) {
  const surfaceIndex = (name) => surfaces.findIndex((surface) => surface.name === name);
  const viewportIndex = (name) => viewports.findIndex((viewport) => viewport.name === name);
  return records.sort((left, right) => surfaceIndex(left.surface) - surfaceIndex(right.surface) || viewportIndex(left.viewport) - viewportIndex(right.viewport));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function imageUrl(fromDir, dir, file) {
  const relative = path.relative(fromDir, path.join(dir, file));
  return path.isAbsolute(relative) ? pathToFileURL(path.join(dir, file)).href : relative.split(path.sep).join("/");
}

function describeSource(source) {
  if (!source) return "source revision unknown";
  const dirty = source.uncommittedAppChanges.length;
  return `${source.branch} @ ${source.commit}${dirty ? ` + ${dirty} uncommitted app file(s)` : ""}`;
}

async function writeIndex(report, baseline) {
  const reference = imageUrl(outDir, path.join(repoRoot, "out/www.orbix.studio/screenshots/source"), "");
  const compare = baseline && !isBaseline;
  const cell = (record) => {
    if (!record) return "<td></td>";
    const baselineRecord = compare && baseline.captures.find((entry) => entry.surface === record.surface && entry.viewport === record.viewport);
    const recordCounts = counts(record);
    const flags = recordCounts ? Object.entries(recordCounts).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`).join(" · ") : "";
    const images = [`<a href="${escapeHtml(imageUrl(outDir, outDir, record.files.full ?? record.files.viewport))}"><img loading="lazy" src="${escapeHtml(imageUrl(outDir, outDir, record.files.viewport))}" alt="${escapeHtml(`${record.surface} ${record.viewport}`)}"></a>`];
    if (baselineRecord) images.unshift(`<a class="baseline" href="${escapeHtml(imageUrl(outDir, baselineDir, baselineRecord.files.full ?? baselineRecord.files.viewport))}"><img loading="lazy" src="${escapeHtml(imageUrl(outDir, baselineDir, baselineRecord.files.viewport))}" alt="baseline"></a>`);
    return `<td><div class="pair">${images.join("")}</div><p class="${record.status === "ok" ? "" : "bad"}">${escapeHtml(record.status === "ok" ? flags || "no findings" : `${record.status}: ${record.error}`)}</p></td>`;
  };
  const rows = surfaces.map((surface) => {
    const records = viewports.map((viewport) => report.captures.find((entry) => entry.surface === surface.name && entry.viewport === viewport.name));
    if (records.every((record) => !record)) return "";
    return `<tr><th>${escapeHtml(surface.name)}<small>${escapeHtml(surface.description)}</small></th>${records.map(cell).join("")}</tr>`;
  }).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FermentStation visual verification</title>
<style>
  body { margin: 16px; font: 14px/1.4 system-ui, sans-serif; background: #f4f4f4; color: #111; }
  table { border-collapse: collapse; }
  th, td { vertical-align: top; padding: 8px; border: 1px solid #ddd; background: #fff; }
  th small { display: block; font-weight: 400; color: #555; max-width: 140px; }
  .pair { display: flex; gap: 6px; align-items: flex-start; }
  img { display: block; max-width: 260px; max-height: 360px; border: 1px solid #ccc; }
  .baseline img { opacity: 0.85; border-style: dashed; }
  p { margin: 6px 0 0; max-width: 360px; font-size: 12px; color: #444; }
  .bad { color: #b00020; }
</style></head><body>
<h1>${isBaseline ? "Baseline" : "Current"} capture · ${escapeHtml(report.generatedAt)}</h1>
<p>${escapeHtml(describeSource(report.source))}${compare ? ` · baseline ${escapeHtml(describeSource(baseline.source))}` : ""}</p>
<p>Clock ${escapeHtml(report.clock)} · ${escapeHtml(report.browser)} · ${compare ? "dashed = baseline (left), solid = current (right)" : "no baseline shown"} · click an image for the unrolled full-height capture · <a href="${escapeHtml(reference)}">reference artwork</a></p>
<table><thead><tr><th>Surface</th>${viewports.map((viewport) => `<th>${viewport.name}<small>${viewport.alias}</small></th>`).join("")}</tr></thead>
<tbody>${rows}</tbody></table>
</body></html>
`;
  await writeFile(path.join(outDir, "index.html"), html);
}

// ---------------------------------------------------------------------------------------------
// Main

async function main() {
  const existing = await readReport(outDir);
  if (isBaseline && existing && !args.force) {
    throw new Error(`A baseline already exists at ${outDir}. Pass --force to replace ${filtered ? "the selected captures" : "it"}.`);
  }
  if (!filtered) await rm(outDir, { recursive: true, force: true, maxRetries: 5 });
  await mkdir(outDir, { recursive: true });

  const started = Date.now();
  const revision = sourceRevision();
  const server = await startServer();
  let browser;
  const captures = [];
  try {
    browser = await launchBrowser();
    console.log(`Capturing ${selectedSurfaces.length} surface(s) x ${selectedViewports.length} viewport(s) from ${server.url} with ${browser.version} into ${outDir} (${describeSource(revision)})`);

    // Warm the dev server (dependency optimisation, first transforms) before timing captures.
    const warmUp = await capture(browser, server.url, { name: "_warmup", steps: [] }, viewports[0], false);
    await rm(path.join(outDir, "_warmup"), { recursive: true, force: true });
    if (warmUp.status === "failed") throw new Error(`App did not load: ${warmUp.error}`);

    const queue = selectedSurfaces.flatMap((surface) => selectedViewports.map((viewport) => ({ surface, viewport })));
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const record = await capture(browser, server.url, job.surface, job.viewport);
        // Filtered runs merge into an existing report, so each capture names the code it shows.
        record.commit = revision ? `${revision.commit}${revision.uncommittedAppChanges.length ? "+dirty" : ""}` : null;
        captures.push(record);
        const recordCounts = counts(record);
        const findings = recordCounts ? Object.entries(recordCounts).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`).join(" ") : "";
        console.log(`${record.status === "ok" ? "ok  " : "FAIL"} ${record.surface.padEnd(19)} ${record.viewport.padEnd(9)} ${(record.durationMs / 1000).toFixed(1).padStart(5)}s  ${findings}${record.error ? `  ${record.error}` : ""}`);
      }
    }));

    const kept = filtered && existing ? existing.captures.filter((record) => !captures.some((entry) => entry.surface === record.surface && entry.viewport === record.viewport)) : [];
    const all = order([...kept, ...captures]);
    const report = {
      generatedAt: new Date().toISOString(),
      clock: `${args.date}T10:00:00 ${args.timezone} (${args.locale})`,
      browser: browser.version,
      server: server.url,
      source: revision,
      deviceScaleFactor: scale,
      viewports,
      surfaces: surfaces.map(({ name, description, scenario }) => ({ name, description, scenario: scenario ?? "seeded" })),
      summary: summarise(all),
      captures: all,
    };
    await writeFile(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    const baseline = isBaseline ? null : await readReport(baselineDir);
    await writeIndex(report, baseline);

    const totals = report.summary.totals;
    console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s. Report covers ${totals.captures} captures: ${totals.failed} failed, ${totals.stepFailed} step-failed.`);
    console.log(`Findings (all captures in report): ${describeTotals(totals)}`);
    if (baseline) {
      // Compare this run's captures with the same surface x viewport in the baseline.
      const changes = [];
      const matched = { now: summarise([]).totals, before: summarise([]).totals };
      for (const record of order(captures)) {
        const previous = baseline.captures.find((entry) => entry.surface === record.surface && entry.viewport === record.viewport);
        const now = counts(record);
        const before = previous && counts(previous);
        if (!now || !before) continue;
        for (const key of findingKeys) { matched.now[key] += now[key]; matched.before[key] += before[key]; }
        const delta = findingKeys.filter((key) => now[key] !== before[key]).map((key) => `${key} ${before[key]} -> ${now[key]}`);
        if (delta.length) changes.push(`  ${record.surface} ${record.viewport}: ${delta.join(", ")}`);
      }
      console.log(`Versus baseline (${describeSource(baseline.source)}, ${baseline.generatedAt}) for the same captures:\n  now:    ${describeTotals(matched.now)}\n  before: ${describeTotals(matched.before)}`);
      if (changes.length) console.log(changes.join("\n"));
    }
    console.log(`Report: ${path.join(outDir, "report.json")}\nIndex:  ${path.join(outDir, "index.html")}`);
    if (totals.failed || totals.stepFailed) process.exitCode = 1;
  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});
