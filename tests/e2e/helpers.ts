import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const fixture = (path: string) => resolve('fixtures/qa', path);
export async function open(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Load demo', exact: true })).toBeVisible();
}
export async function demo(page: Page) {
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeEnabled();
}
export async function upload(page: Page, before: string, after: string, keys = ['sku']) {
  await page.getByLabel('Before file', { exact: true }).setInputFiles(fixture(before));
  await page.getByLabel('After file', { exact: true }).setInputFiles(fixture(after));
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  for (const key of keys) await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: key, exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
}
export async function downloadText(page: Page, format: 'JSON' | 'HTML') {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: `Export ${format}`, exact: true }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  try { await expect(page.getByRole('button', { name: `Export ${format}`, exact: true })).toBeFocused(); }
  catch { throw new Error(`Export focus was lost to: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 500))}`); }
  const path = await download.path();
  if (!path) throw new Error('Download did not produce a file');
  return readFile(path, 'utf8');
}
export async function assertGolden(page: Page) {
  const report = JSON.parse(await downloadText(page, 'JSON'));
  expect(report.schemaVersion).toBe('1');
  expect(report.status).toBe('complete');
  expect(report.summary).toEqual({ before: 3, after: 3, added: 1, removed: 1, changed: 1, unchanged: 1, changedCells: 1 });
  expect(report.rows.map((row: { key: string[]; status: string }) => [row.key[0], row.status])).toEqual([['A17', 'changed'], ['B04', 'removed'], ['C09', 'added'], ['U03', 'unchanged']]);
  expect(report.rows[0].changes).toEqual([{ column: 'price', before: { kind: 'value', value: '14900' }, after: { kind: 'value', value: '16900' } }]);
  return report;
}
