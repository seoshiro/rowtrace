import { test, expect } from '@playwright/test';
import { open, demo, upload, downloadText, assertGolden } from './helpers';

test('demo golden, details, filters, empty state and deterministic export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page); await demo(page);
  const initial = await assertGolden(page);
  await page.getByRole('button', { name: 'A17', exact: true }).click();
  await expect(page.getByRole('complementary').getByText('14900', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByText('16900', { exact: true })).toBeVisible();
  for (const status of ['Changed', 'Added', 'Removed', 'Unchanged'] as const) {
    await page.getByRole('button', { name: status, exact: true }).click();
    await expect(page.getByRole('button', { name: { Changed: 'A17', Added: 'C09', Removed: 'B04', Unchanged: 'U03' }[status], exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Search records', { exact: true }).fill('no-such-key');
  await expect(page.getByText('No records match.', { exact: true })).toBeVisible();
  await page.getByLabel('Search records', { exact: true }).fill('');
  expect(JSON.parse(await downloadText(page, 'JSON'))).toEqual(initial);
  const html = await downloadText(page, 'HTML');
  expect(html).toContain('14900'); expect(html).toContain('16900');
  expect(html).not.toMatch(/<script\b/i);
  expect(errors).toEqual([]);
});

test('CSV import, explicit key, duplicate blocks, malformed input recovers', async ({ page }) => {
  await open(page);
  await upload(page, 'F01/before.csv', 'F01/after.csv'); await assertGolden(page);
  await upload(page, 'F04/before.csv', 'F04/after.csv');
  await expect(page.getByRole('alert')).toContainText('DUPLICATE_KEY');
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  await upload(page, 'F01/before.csv', 'F01/after.csv'); await assertGolden(page);
});

test('flat JSON preserves missing null empty and scalar types', async ({ page }) => {
  await open(page); await upload(page, 'F10/before.json', 'F10/after.json');
  const report = JSON.parse(await downloadText(page, 'JSON'));
  expect(report.summary.changed).toBe(6);
  const missing = report.rows.find((row: { key: string[] }) => row.key[0] === 'missing');
  expect(missing.changes).toEqual([{ column: 'value', before: { kind: 'missing' }, after: { kind: 'value', value: '' } }]);
  const nil = report.rows.find((row: { key: string[] }) => row.key[0] === 'null');
  expect(nil.changes).toEqual([{ column: 'value', before: { kind: 'value', value: null }, after: { kind: 'missing' } }]);
});

test('BOM multiline Unicode and composite collision remain correct', async ({ page }) => {
  await open(page);
  for (const id of ['F07', 'F08']) {
    await upload(page, `${id}/before.csv`, `${id}/after.csv`);
    expect(JSON.parse(await downloadText(page, 'JSON')).hasChanges).toBe(false);
  }
  await upload(page, 'F09/before.json', 'F09/after.json', ['first', 'second']);
  const report = JSON.parse(await downloadText(page, 'JSON'));
  expect(report.summary.changed).toBe(1); expect(report.summary.unchanged).toBe(1);
});

test('empty datasets, schema changes, ignored columns and explicit delimiter', async ({ page }) => {
  await open(page); await upload(page, 'F06/before.csv', 'F06/after.csv');
  const empty = JSON.parse(await downloadText(page, 'JSON'));
  expect(empty.summary).toEqual({ before: 0, after: 0, changed: 0, unchanged: 0, added: 0, removed: 0, changedCells: 0 });
  await upload(page, 'F11/before.csv', 'F11/after.csv');
  const schema = JSON.parse(await downloadText(page, 'JSON'));
  expect(schema.columns.added).toEqual(['added']); expect(schema.columns.removed).toEqual(['removed']);
  await upload(page, 'F01/before.csv', 'F01/after.csv');
  await page.getByRole('group', { name: 'Ignore columns', exact: true }).getByRole('checkbox', { name: 'price', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
  const ignored = JSON.parse(await downloadText(page, 'JSON'));
  expect(ignored.config.ignoreColumns).toEqual(['price']); expect(ignored.summary.changed).toBe(0);
  for (const label of ['Before file', 'After file']) await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'semicolon.csv', mimeType: 'text/csv', buffer: Buffer.from('sku;value\nA17;"one;two"\n') });
  await page.getByRole('combobox', { name: 'CSV delimiter', exact: true }).selectOption(';');
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
  const semicolon = JSON.parse(await downloadText(page, 'JSON'));
  expect(semicolon.summary.unchanged).toBe(1); expect(semicolon.rows[0].before.value).toBe('one;two');
});
