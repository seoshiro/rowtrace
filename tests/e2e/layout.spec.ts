import { test, expect, type Page } from '@playwright/test';
import { open, demo, downloadText, upload } from './helpers';

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
for (const [width, height] of [[320, 740], [360, 800], [390, 844], [430, 932], [768, 1024], [1280, 720], [1440, 900], [1920, 1080], [844, 390]]) {
  test(`viewport ${width}x${height}: controls, detail, diagnostic and export`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: width!, height: height! });
    await open(page); await noPageOverflow(page);
    if (width === 320 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`initial-${width}.png`), fullPage: true });
    await demo(page); await noPageOverflow(page);
    await page.getByRole('button', { name: 'A17', exact: true }).click();
    await noPageOverflow(page);
    await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
    await downloadText(page, 'JSON');
    await testInfo.attach('result.png', { body: await page.screenshot({ path: testInfo.outputPath(`result-${width}.png`), fullPage: true }), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Duplicate-key demo', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('DUPLICATE_KEY');
    await noPageOverflow(page);
  });
}

test('language changes preserve report, selected row and search', async ({ page }) => {
  await open(page); await demo(page);
  const report = await downloadText(page, 'JSON');
  await page.getByRole('button', { name: 'A17', exact: true }).click();
  await page.getByLabel('Search records', { exact: true }).fill('A17');
  await page.getByLabel('Language', { exact: true }).selectOption('ru');
  await expect(page.getByRole('button', { name: 'Скачать JSON', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
  await page.locator('select').first().selectOption('kk');
  await expect(page.getByRole('button', { name: 'JSON жүктеу', exact: true })).toBeVisible();
  await page.locator('select').first().selectOption('en');
  await expect(page.getByLabel('Search records', { exact: true })).toHaveValue('A17');
  expect(await downloadText(page, 'JSON')).toBe(report);
});

test('keyboard activation, focus styles and reduced-motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const load = page.getByRole('button', { name: 'Load demo', exact: true });
  // Tab navigation starts at browser document entry; no DOM focus shortcut for the demo.
  let reached = false;
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    if (await load.evaluate(el => el === document.activeElement)) { reached = true; break; }
  }
  expect(reached).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeEnabled();
  const row = page.getByRole('button', { name: 'A17', exact: true });
  await row.focus();
  const outline = await row.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
});

test('long values readable at 320 CSS px without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await open(page);
  const value = 'synthetic-long-value-'.repeat(200);
  const header = 'long_header_'.repeat(60);
  for (const [label, suffix] of [['Before file', 'before'], ['After file', 'after']]) {
    await page.getByLabel(label!, { exact: true }).setInputFiles({ name: `${suffix}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ sku: 'LONG', [header]: value + suffix }])) });
  }
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
  await page.getByRole('button', { name: 'LONG', exact: true }).click();
  await expect(page.getByText(value + 'before', { exact: true })).toBeVisible();
  await noPageOverflow(page);
  await upload(page, 'F01/before.csv', 'F01/after.csv');
});
