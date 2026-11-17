import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, publicUrl } from './browser.js';
import { extract, devtoolsSnippet } from './extractor.js';

export function scoreLinks(links, origin) {
  const choices = new Map();
  for (const link of links) {
    let url;
    try { url = new URL(link.url); } catch { continue; }
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.search || url.hash || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) continue;
    if (/(?:^|\/)(?:legal|privacy|terms|help|support|login|sign-in|signup|auth|cookies|[a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i.test(url.pathname)) continue;
    const top = url.pathname.split('/').filter(Boolean)[0];
    if (!top) continue;
    const score = (link.nav ? 100 : 0) + (/product|pricing|business|company|about|work|case-stud/i.test(url.pathname + ' ' + link.text) ? 50 : 0) - url.pathname.split('/').length;
    if (!choices.has(top) || choices.get(top).score < score) choices.set(top, { url: url.href, score, text: link.text });
  }
  return [...choices.values()].sort((a, b) => b.score - a.score);
}

export async function capture(target, out, { headed = false, pageCount = 4 } = {}) {
  const start = performance.now();
  const requested = publicUrl(target);
  await mkdir(resolve(out, 'screenshots/source'), { recursive: true });
  await writeFile(resolve(out, 'devtools-extractor.js'), devtoolsSnippet());
  const browser = await launch(headed);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  // No resource-type blocks, stealth flags, proxy rotation or challenge solving.
  const page = await context.newPage();
  const pages = [], errors = [];
  async function visit(url, width, height, label) {
    await page.setViewportSize({ width, height });
    let response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    publicUrl(page.url());
    const challenged = async () => /just a moment|verify you are human|checking your browser|access denied|security verification|captcha/i.test((await page.title()) + ' ' + (await page.locator('body').innerText()).slice(0, 1800));
    if (await challenged()) {
      if (!headed) throw new Error('BOT_CHALLENGE: Stopped. Choose --headed and complete the check yourself, or paste devtools-extractor.js into DevTools on the source page and use --snapshot snapshot.json.');
      console.log('Complete the browser check in Chrome. Waiting up to 3 minutes; no automatic solving.');
      await page.waitForFunction(() => !/just a moment|verify you are human|checking your browser|captcha/i.test(document.title + ' ' + document.body.innerText.slice(0, 1800)), null, { timeout: 180000 });
      // Read the actual post-check response, not the original challenge's 403 status.
      response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      publicUrl(page.url());
      if(await challenged())throw new Error('BOT_CHALLENGE: The check is still present. Stopped; use the DevTools fallback instead.');
    }
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()} for ${url}`);
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 8000))]));
    await page.waitForTimeout(1200);
    // Bound infinite feeds, reporting coverage instead of silently hanging.
    const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
    const scrollLimit = Math.min(heightBefore + 1800, 60000);
    for (let y = 0; y < scrollLimit; y += height * .8) {
      await page.evaluate(y => scrollTo(0, y), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => { scrollTo(0, 0); for (const a of document.getAnimations()) { try { a.finish(); } catch { a.pause(); } } });
    await page.waitForTimeout(300);
    const data = await page.evaluate(extract);
    data.status = response?.status() || null;
    data.scrollCoverage = { initialHeight: heightBefore, limit: scrollLimit, bounded: heightBefore > scrollLimit };
    await page.screenshot({ path: resolve(out, `screenshots/source/${label}.png`), fullPage: true });
    pages.push(data);
    return data;
  }
  try {
    const home = new URL('/', requested);
    const homepage = await visit(home.href, 1440, 900, 'home-desktop');
    const candidates = scoreLinks(homepage.links, home.origin);
    const picks = requested.pathname !== '/' ? [requested.href] : [];
    const used = new Set(picks.map(u => new URL(u).pathname.split('/').filter(Boolean)[0]));
    for (const item of candidates) {
      const top = new URL(item.url).pathname.split('/').filter(Boolean)[0];
      if (!used.has(top) && picks.length < pageCount) { picks.push(item.url); used.add(top); }
    }
    for (const [index, url] of picks.entries()) {
      try { await visit(url, 1440, 900, `page-${index + 1}`); }
      catch (error) { if (error.message.includes('BOT_CHALLENGE')) throw error; errors.push({ url, error: error.message }); }
    }
    await visit(home.href, 390, 844, 'home-mobile');
    if (requested.pathname !== '/') await visit(requested.href, 390, 844, 'target-mobile');
    const snapshot = { schemaVersion: 1, capturedAt: new Date().toISOString(), target: requested.href, pages, candidates, errors, durationMs: Math.round(performance.now() - start) };
    await writeFile(resolve(out, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
    return snapshot;
  } finally { await browser.close(); }
}
