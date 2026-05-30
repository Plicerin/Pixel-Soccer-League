import { chromium } from 'playwright-core';

const CDP_CANDIDATES = (process.env.PSL_CDP_URL || 'http://127.0.0.1:9222,http://[::1]:9222').split(',');
const TARGET_URL = process.env.PSL_URL || 'http://localhost:3001';

async function connectExistingBrowser() {
  let lastError = null;
  for (const cdpUrl of CDP_CANDIDATES) {
    try {
      return await chromium.connectOverCDP(cdpUrl.trim());
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Could not connect to an existing browser CDP session. Start/reuse Edge with remote debugging first. ${lastError?.message || lastError}`);
}

function summarizeResource(entry) {
  return {
    name: String(entry.name || '').replace(/^https?:\/\/[^/]+/, ''),
    initiatorType: entry.initiatorType,
    durationMs: Math.round(entry.duration),
    transferKB: Math.round((entry.transferSize || 0) / 1024),
    decodedKB: Math.round((entry.decodedBodySize || 0) / 1024),
  };
}

const browser = await connectExistingBrowser();
try {
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages().find((p) => p.url().startsWith(TARGET_URL)) || await context.newPage();
  page.setDefaultTimeout(45_000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    performance.clearMarks();
    performance.clearMeasures();
    window.pslPerf = { marks: {}, measures: {} };
  });
  const start = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.pslPerf?.marks?.['psl:engine:init:end'], null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource')
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: entry.duration,
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
      }))
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 20);
    const measures = Object.fromEntries(performance.getEntriesByType('measure').map((entry) => [entry.name, Math.round(entry.duration)]));
    return {
      url: location.href,
      navigation: nav ? {
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadEventMs: Math.round(nav.loadEventEnd - nav.startTime),
        responseEndMs: Math.round(nav.responseEnd - nav.startTime),
      } : null,
      pslPerf: window.pslPerf || null,
      measures,
      resources,
    };
  });

  console.log(JSON.stringify({
    wallReloadMs: Date.now() - start,
    ...result,
    resources: result.resources.map(summarizeResource),
  }, null, 2));
} finally {
  // Do not close a browser we attached to over CDP; this script is intended to
  // reuse the developer's existing visible Edge/Chrome session.
}
