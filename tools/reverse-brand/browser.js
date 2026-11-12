import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

export async function launch(headed = false) {
  const executablePath = process.env.CHROME_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  ].find(existsSync);
  if (!executablePath) throw new Error('Installed Chrome not found. Set CHROME_PATH to its executable.');
  return chromium.launch({ executablePath, headless: !headed, args: ['--disable-gpu'], timeout: 30000 });
}

export function publicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use a public HTTP(S) URL without credentials.');
  // Public-target CLI: do not accidentally crawl loopback, private networks or metadata endpoints.
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '[::1]' || host.endsWith('.local') || host.endsWith('.localhost') ||
      /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(':'))
    throw new Error('Private/local targets are not supported.');
  url.hash = '';
  return url;
}
