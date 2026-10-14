import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { largePair } from '../fixtures/qa/generate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, '.tools/ms-playwright');
const { chromium } = await import('@playwright/test');
const url = process.env.ROWTRACE_URL ?? 'http://127.0.0.1:4173/rowtrace/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const cdp = await context.newCDPSession(page);
const requests = [];
page.on('request', request => requests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() }));
await page.addInitScript(() => {
  const lab = { longTasks: [], largestContentfulPaint: [], layoutShifts: [], messages: [], workersCreated: 0, workersTerminated: 0, cancelClick: null, cancelConfirmedMs: null };
  globalThis.__rowtraceLab = lab;
  const NativeWorker = globalThis.Worker;
  globalThis.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args); lab.workersCreated++;
      let terminated = false;
      const nativeTerminate = this.terminate.bind(this);
      this.terminate = () => { if (!terminated) { terminated = true; lab.workersTerminated++; } nativeTerminate(); };
      const nativePost = this.postMessage.bind(this);
      this.postMessage = (...parameters) => { lab.messages.push({ type: parameters[0]?.type, time: performance.now() }); return nativePost(...parameters); };
    }
  };
  for (const [type, key] of [['longtask', 'longTasks'], ['largest-contentful-paint', 'largestContentfulPaint'], ['layout-shift', 'layoutShifts']]) {
    try { new globalThis.PerformanceObserver(list => { for (const entry of list.getEntries()) lab[key].push({ startTime: entry.startTime, duration: entry.duration, value: entry.value, hadRecentInput: entry.hadRecentInput }); }).observe({ type, buffered: true }); } catch { /* Unsupported metrics remain an empty list. */ }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('button')?.textContent.trim() === 'Cancel') { lab.cancelClick = performance.now(); lab.cancelConfirmedMs = null; }
  }, true);
  new globalThis.MutationObserver(() => {
    if (lab.cancelClick !== null && lab.cancelConfirmedMs === null && document.querySelector('[role="status"]')?.textContent.includes('Cancelled.')) {
      const started = lab.cancelClick; lab.cancelConfirmedMs = -1;
      requestAnimationFrame(() => requestAnimationFrame(() => { lab.cancelConfirmedMs = performance.now() - started; }));
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
});
const settings = { cpuRate: 4, network: { offline: false, latency: 20, downloadThroughput: 20 * 1024 * 1024 / 8, uploadThroughput: 20 * 1024 * 1024 / 8 }, viewport: { width: 1440, height: 900 }, headless: true, reducedMotion: 'reduce' };
await cdp.send('Emulation.setCPUThrottlingRate', { rate: settings.cpuRate });
await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', settings.network);
await cdp.send('Performance.enable');
const result = { generatedAt: new Date().toISOString(), url, browser: browser.version(), settings, limitations: ['CDP CPU throttle is a laboratory renderer model; coverage of worker CPU throttling is not independently verified.', 'No real mobile device, field users, p75, or field INP. LCP and layout shifts are single lab observations.', 'CDP JSHeapUsedSize is main renderer heap, excludes worker heap and OS RSS. Forced GC is diagnostic, not normal user behavior.', 'Automation input and instrumentation are not a manual exploratory pass.'], cancellation: [], memoryCycles: [] };
const button = name => page.getByRole('button', { name, exact: true });
async function selectPair(pair) {
  await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'synthetic-before.csv', mimeType: 'text/csv', buffer: Buffer.from(pair.before) });
  await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'synthetic-after.csv', mimeType: 'text/csv', buffer: Buffer.from(pair.after) });
}
async function previewAndCompare() {
  await button('Preview files').click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await button('Compare snapshots').click();
  await button('Export JSON').waitFor();
}
async function memorySnapshot() {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const lab = await page.evaluate(() => ({ created: globalThis.__rowtraceLab.workersCreated, terminated: globalThis.__rowtraceLab.workersTerminated }));
  return { metrics: Object.fromEntries(metrics.filter(value => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners'].includes(value.name)).map(value => [value.name, value.value])), workers: lab };
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  result.initialRequests = [...requests];
  result.initialMemory = await memorySnapshot();
  const longPair = largePair(20000, 'long');
  const trace = [];
  cdp.on('Tracing.dataCollected', event => trace.push(...event.value));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,blink.user_timing', transferMode: 'ReportEvents' });
  await selectPair(longPair);
  result.largeFixture = { rows: 20000, columns: 3, seed: 82741, changedFraction: 1, beforeBytes: Buffer.byteLength(longPair.before), afterBytes: Buffer.byteLength(longPair.after) };
  const start = await page.evaluate(() => performance.now());
  await button('Preview files').click();
  const pendingAtControlStart = await button('Cancel').isVisible();
  // A real enabled control is exercised while the worker parses the large fixture.
  await page.locator('#language').selectOption('ru');
  await page.locator('#language').selectOption('en');
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await button('Compare snapshots').click();
  await button('Export JSON').waitFor();
  const complete = await page.evaluate(() => performance.now());
  const beforeActions = await page.evaluate(() => globalThis.__rowtraceLab.messages.filter(value => ['load', 'compare'].includes(value.type)).length);
  await button('S00000').click();
  await page.getByLabel('Sort records', { exact: true }).selectOption('desc');
  await button('S19999').waitFor();
  const afterActions = await page.evaluate(() => globalThis.__rowtraceLab.messages.filter(value => ['load', 'compare'].includes(value.type)).length);
  result.processing = { start, complete, wallMs: complete - start, pendingAtControlStart, controlsUsed: ['language ru', 'language en', 'scroll', 'row detail', 'sort descending'], parserOrCompareRequestsBeforeControls: beforeActions, parserOrCompareRequestsAfterControls: afterActions };
  const traceComplete = new Promise(resolveComplete => cdp.once('Tracing.tracingComplete', resolveComplete));
  await cdp.send('Tracing.end'); await traceComplete;
  await mkdir(join(root, 'evidence'), { recursive: true });
  await writeFile(join(root, 'evidence/performance-browser-trace.json.gz'), gzipSync(JSON.stringify({ traceEvents: trace })));
  result.trace = { path: 'evidence/performance-browser-trace.json.gz', events: trace.length };
  await button('Reset').click();
  for (let iteration = 0; iteration < 3; iteration++) {
    await selectPair(longPair); await button('Preview files').click(); await button('Cancel').click();
    await page.waitForFunction(() => typeof globalThis.__rowtraceLab.cancelConfirmedMs === 'number' && globalThis.__rowtraceLab.cancelConfirmedMs >= 0);
    result.cancellation.push(await page.evaluate(() => ({ clickToTwoAnimationFramesMs: globalThis.__rowtraceLab.cancelConfirmedMs, workersCreated: globalThis.__rowtraceLab.workersCreated, workersTerminated: globalThis.__rowtraceLab.workersTerminated })));
    await button('Reset').click();
  }
  const sparsePair = largePair(20000, 'sparse');
  for (let iteration = 0; iteration < 5; iteration++) {
    await selectPair(sparsePair); await previewAndCompare();
    const complete = await memorySnapshot(); await button('Reset').click();
    result.memoryCycles.push({ iteration, complete, afterReset: await memorySnapshot() });
  }
  result.observations = await page.evaluate(() => globalThis.__rowtraceLab);
  result.requests = requests;
  await writeFile(join(root, 'evidence/performance-browser.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ browser: result.browser, processing: result.processing, cancellation: result.cancellation, memoryCycles: result.memoryCycles, longTasks: result.observations.longTasks }, null, 2) + '\n');
} finally { await browser.close(); }
