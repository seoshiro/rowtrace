import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { largePair } from '../../fixtures/qa/generate.mjs';

const url = process.env.ROWTRACE_URL;
const expectedCommit = process.env.ROWTRACE_SHA;
if (!url || !expectedCommit || !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('Set confirmed ROWTRACE_URL and full ROWTRACE_SHA before running live audit');
const output = resolve(process.env.ROWTRACE_AUDIT_OUT ?? 'evidence/live');
await mkdir(output, { recursive: true });
const qa = resolve('fixtures/qa');
const temp = await mkdtemp(join(tmpdir(), 'rowtrace-live-'));
const temporaryFiles = [];
const evidence = { kind: 'automated-live-browser-audit', manualExploratory: false, url, expectedCommit, platform: process.platform, node: process.version, started: new Date().toISOString(), passes: [], limitations: ['Fresh browser contexts and touch/viewport emulation on Windows; no physical phone or native screen reader.', 'Real CUA exploratory remains blocked by launcher HRESULT 0x80070003.'] };

async function download(page, format, name) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: `Export ${format}`, exact: true }).click();
  const file = await event;
  if (await file.failure()) throw new Error(`Download failed: ${await file.failure()}`);
  const filePath = await file.path();
  if (!filePath) throw new Error('Missing downloaded file');
  const text = await readFile(filePath, 'utf8');
  if (name) await file.saveAs(join(output, name));
  return text;
}
async function demo(page) {
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeEnabled();
}
async function upload(page, before, after) {
  await page.getByLabel('Before file', { exact: true }).setInputFiles(join(qa, before));
  await page.getByLabel('After file', { exact: true }).setInputFiles(join(qa, after));
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
}
function golden(report) {
  expect(report.schemaVersion).toBe('1'); expect(report.status).toBe('complete');
  expect(report.summary).toEqual({ before: 3, after: 3, added: 1, removed: 1, changed: 1, unchanged: 1, changedCells: 1 });
  expect(report.rows[0].key).toEqual(['A17']);
  expect(report.rows[0].changes).toEqual([{ column: 'price', before: { kind: 'value', value: '14900' }, after: { kind: 'value', value: '16900' } }]);
}
async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, name), fullPage: true });
}
async function runPass(number) {
  const browser = await chromium.launch();
  const viewport = number === 1 ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, locale: 'en-US', hasTouch: number === 2, isMobile: number === 2 });
  const pass = { number, context: 'fresh browser process + fresh isolated context', browser: browser.version(), viewport, touchEmulation: number === 2, checks: [], requests: [], consoleErrors: [], pageErrors: [], failedResponses: [] };
  evidence.passes.push(pass);
  context.on('request', request => pass.requests.push({ method: request.method(), url: request.url(), body: request.postData() ?? '' }));
  context.on('response', response => { if (response.status() >= 400) pass.failedResponses.push({ status: response.status(), url: response.url() }); });
  await context.addInitScript(() => {
    const Original = window.Worker;
    const state = { created: 0, terminated: 0 };
    Object.assign(window, { __qaWorkerLifecycle: state });
    window.Worker = class extends Original {
      constructor(workerUrl, options) {
        super(workerUrl, options); state.created++;
        const terminate = this.terminate.bind(this);
        this.terminate = () => { state.terminated++; terminate(); };
      }
    };
  });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') pass.consoleErrors.push(message.text()); });
  page.on('pageerror', error => pass.pageErrors.push(error.message));
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Load demo', exact: true })).toBeVisible();
    const versionResponse = await page.request.get(new URL('version.json', url).href);
    expect(versionResponse.status()).toBe(200);
    pass.version = await versionResponse.json(); expect(pass.version.commit).toBe(expectedCommit);
    pass.checks.push('L01/L12 cold canonical entry and exact published SHA');
    await demo(page);
    golden(JSON.parse(await download(page, 'JSON', `pass-${number}-demo.json`)));
    await page.getByRole('button', { name: 'A17', exact: true }).click();
    await expect(page.getByRole('complementary').getByText('14900', { exact: true })).toBeVisible();
    await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
    pass.checks.push('L03/L04 computed demo golden and A17 before/after details');
    await capture(page, `pass-${number}-demo.png`);
    await page.getByRole('button', { name: 'Changed', exact: true }).click();
    await page.getByLabel('Search records', { exact: true }).fill('NOT-A-KEY');
    await expect(page.getByText('No records match.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(page.getByRole('button', { name: 'B04', exact: true })).toBeVisible();
    pass.checks.push('L05 combined filter/search/empty/recovery');
    await upload(page, 'F01/before.csv', 'F01/after.csv'); golden(JSON.parse(await download(page, 'JSON')));
    await upload(page, 'F10/before.json', 'F10/after.json');
    expect(JSON.parse(await download(page, 'JSON')).summary.changed).toBe(6);
    pass.checks.push('L06 actual file-input CSV and typed flat JSON import');
    if (number === 1) {
      await upload(page, 'F04/before.csv', 'F04/after.csv');
      await expect(page.getByRole('alert')).toContainText('DUPLICATE_KEY');
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
      pass.checks.push('L07 duplicate keys block complete export');
      await upload(page, 'F13/before.json', 'F13/after.json');
      const html = await download(page, 'HTML', 'pass-1-hostile-report.html');
      expect(html).not.toMatch(/<(?:script|img|iframe)\b/i); expect(html).toContain('&lt;img');
      const report = await context.newPage();
      await context.setOffline(true);
      await report.setContent(html);
      await expect(report.getByText('ROWTRACE-CANARY-82741', { exact: false }).first()).toBeVisible();
      expect(await report.locator('script,img,iframe').count()).toBe(0);
      await context.setOffline(false); await report.close();
      expect(JSON.stringify(pass.requests)).not.toContain('ROWTRACE-CANARY-82741');
      expect(JSON.stringify(pass.requests)).not.toContain('ROWTRACE-XSS');
      expect(await page.evaluate(() => window.location.href + JSON.stringify(localStorage) + JSON.stringify(window.sessionStorage))).not.toContain('ROWTRACE-CANARY');
      pass.checks.push('L08 actual HTML download, inert hostile text, offline rendering, canary absent from requests/storage/URL');
      await demo(page);
      await page.getByLabel('Search records', { exact: true }).fill('A17');
      await page.getByRole('button', { name: 'A17', exact: true }).click();
      await page.getByLabel('Language', { exact: true }).selectOption('ru');
      await expect(page.getByRole('button', { name: 'Скачать JSON', exact: true })).toBeVisible();
      await page.locator('#language').selectOption('kk');
      await expect(page.getByRole('button', { name: 'JSON жүктеу', exact: true })).toBeVisible();
      await page.locator('#language').selectOption('en');
      await expect(page.getByLabel('Search records', { exact: true })).toHaveValue('A17');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      const load = page.getByRole('button', { name: 'Load demo', exact: true });
      await load.focus(); await page.keyboard.press('Enter');
      golden(JSON.parse(await download(page, 'JSON')));
      await page.setViewportSize({ width: 320, height: 740 });
      await page.getByRole('button', { name: 'A17', exact: true }).click();
      await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.setViewportSize(viewport);
      pass.checks.push('L09/L10 scripted keyboard activation; RU/KK/EN preserve data/search; reset and reanalysis');
      const pair = largePair(20000, 'long');
      const paths = [join(temp, 'large-before.csv'), join(temp, 'large-after.csv')];
      await writeFile(paths[0], pair.before); await writeFile(paths[1], pair.after); temporaryFiles.push(...paths);
      await page.getByLabel('Before file', { exact: true }).setInputFiles(paths[0]);
      await page.getByLabel('After file', { exact: true }).setInputFiles(paths[1]);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const beforeCancel = await page.evaluate(() => window.__qaWorkerLifecycle.terminated);
      await page.getByRole('button', { name: 'Preview files', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Cancelled.');
      expect(await page.evaluate(() => window.__qaWorkerLifecycle.terminated)).toBeGreaterThan(beforeCancel);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
      await demo(page); golden(JSON.parse(await download(page, 'JSON')));
      pass.checks.push('L11 actual 20,000-row bounded import cancellation at CPU4x, native Worker.terminate observed, immediate demo recovery');
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
      pass.checks.push('L02 canonical refresh and RAM-only reset');
    } else {
      const html = await download(page, 'HTML', 'pass-2-report.html');
      expect(html).not.toMatch(/<script\b/i);
      const longValue = 'synthetic-long-value-'.repeat(100);
      for (const [label, suffix] of [['Before file', 'before'], ['After file', 'after']]) {
        const content = JSON.stringify([{ sku: 'LONG', ['header_'.repeat(60)]: longValue + suffix }]);
        await page.getByLabel(label, { exact: true }).setInputFiles({ name: `${suffix}.json`, mimeType: 'application/json', buffer: Buffer.from(content) });
      }
      await page.getByRole('button', { name: 'Preview files', exact: true }).click();
      await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
      await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
      await page.getByRole('button', { name: 'LONG', exact: true }).click();
      await expect(page.getByRole('complementary').getByText(longValue + 'before', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await capture(page, 'pass-2-import.png');
      pass.checks.push('Independent cold mobile viewport: CSV/JSON imports, actual JSON/HTML downloads, long headers/values readable, no document overflow');
    }
    expect(pass.failedResponses).toEqual([]); expect(pass.consoleErrors).toEqual([]); expect(pass.pageErrors).toEqual([]);
    const urls = pass.requests.map(request => request.url);
    expect(urls.some(value => /\/assets\/index-.*\.js/.test(value))).toBe(true);
    expect(urls.some(value => /\/assets\/worker-.*\.js/.test(value))).toBe(true);
    expect(urls.some(value => /\/demo\/before\.csv/.test(value))).toBe(true);
    pass.checks.push('L02 real main/worker/demo assets loaded; no HTTP4xx/5xx, console errors or uncaught page errors');
    pass.status = 'PASS';
  } catch (error) {
    pass.status = 'FAIL'; pass.error = error instanceof Error ? error.message : String(error);
    await capture(page, `pass-${number}-failure.png`).catch(() => {});
    throw error;
  } finally {
    pass.requestCount = pass.requests.length;
    pass.requestSha256 = createHash('sha256').update(JSON.stringify(pass.requests)).digest('hex');
    // Request list contains only public static URLs; request bodies must remain absent.
    await browser.close();
  }
}
try {
  await runPass(1); await runPass(2); evidence.status = 'PASS';
} catch (error) { evidence.status = 'FAIL'; process.exitCode = 1; console.error(error); }
finally {
  evidence.finished = new Date().toISOString();
  await writeFile(join(output, 'audit.json'), JSON.stringify(evidence, null, 2) + '\n');
  for (const path of temporaryFiles) await unlink(path).catch(() => {});
  await rmdir(temp).catch(() => {});
  console.log(JSON.stringify({ status: evidence.status, expectedCommit, passes: evidence.passes.map(pass => ({ number: pass.number, status: pass.status, checks: pass.checks })) }, null, 2));
}
