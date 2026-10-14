import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { open, demo, upload, downloadText } from './helpers';

test('hostile text stays inert, files remain RAM-only and no canary leaves browser', async ({ page, context }) => {
  const traffic: string[] = [];
  const errors: string[] = [];
  context.on('request', request => traffic.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  page.on('pageerror', error => errors.push(error.message));
  await open(page); await upload(page, 'F13/before.json', 'F13/after.json');
  await page.getByRole('button', { name: 'ROWTRACE-CANARY-82741', exact: true }).click();
  await expect(page.getByRole('complementary').getByText('prototype is data', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(globalThis, '__rowtraceXss'))).toBe(false);
  const raw = await downloadText(page, 'JSON');
  expect(raw).toContain('ROWTRACE-CANARY-82741');
  const html = await downloadText(page, 'HTML');
  expect(html).not.toMatch(/<script\b|<img\b|<iframe\b/i);
  expect(html).toContain('&lt;img');
  const report = await context.newPage();
  await report.route('**/*', route => route.abort());
  await report.setContent(html);
  await expect(report.getByText('ROWTRACE-CANARY-82741', { exact: false }).first()).toBeVisible();
  expect(await report.locator('script,img,iframe').count()).toBe(0);
  expect(traffic.join('\n')).not.toContain('ROWTRACE-CANARY-82741');
  expect(traffic.join('\n')).not.toContain('ROWTRACE-XSS');
  expect(await page.evaluate(() => location.href + JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('ROWTRACE-CANARY');
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('axe checks initial, result and blocking diagnostics without exclusions', async ({ page }, testInfo) => {
  await open(page);
  for (const state of ['initial', 'result', 'diagnostics']) {
    if (state === 'result') await demo(page);
    if (state === 'diagnostics') {
      await page.getByRole('button', { name: 'Duplicate-key demo', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('DUPLICATE_KEY');
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    await testInfo.attach(`axe-${state}.json`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.violations).toEqual([]);
  }
});

test('blocked storage and failed export recover without recomputing', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('QA storage denied', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('QA storage denied', 'SecurityError'); };
  });
  await open(page); await demo(page);
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = (...args) => { URL.createObjectURL = original; throw new Error(`QA controlled export failure ${args.length}`); };
  });
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(JSON.parse(await downloadText(page, 'JSON')).summary.changed).toBe(1);
});

test('offline after shell load supports local import and self-contained HTML', async ({ page, context }) => {
  await open(page);
  // First worker/chunk load occurs during demo. Offline shell is not claimed.
  await demo(page); await downloadText(page, 'HTML');
  await context.setOffline(true);
  await upload(page, 'F01/before.csv', 'F01/after.csv');
  const html = await downloadText(page, 'HTML');
  expect(html).toContain('14900'); expect(html).toContain('16900');
  expect(html).not.toMatch(/<(?:script|link|img)\b/i);
});
