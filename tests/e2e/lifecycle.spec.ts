import { test, expect } from '@playwright/test';
import { open, demo, upload, fixture, downloadText, assertGolden } from './helpers';

test('malformed and oversized inputs report explicit errors, then recover', async ({ page }) => {
  await open(page);
  for (const name of ['broken.csv', 'broken.json', 'nested.json', 'unsafe-integer.json', 'duplicate-property.json']) {
    await page.getByLabel('Before file', { exact: true }).setInputFiles(fixture(`F12/${name}`));
    await page.getByLabel('After file', { exact: true }).setInputFiles(fixture('F01/after.csv'));
    await page.getByRole('button', { name: 'Preview files', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  }
  await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'too-big.csv', mimeType: 'text/csv', buffer: Buffer.alloc(16 * 1024 * 1024 + 1, 65) });
  await expect(page.getByRole('alert')).toBeVisible();
  await upload(page, 'F01/before.csv', 'F01/after.csv'); await assertGolden(page);
});

test('64 KiB value boundary succeeds and one byte above blocks', async ({ page }) => {
  await open(page);
  for (const length of [65536, 65537]) {
    const content = JSON.stringify([{ sku: 'A17', value: 'x'.repeat(length) }]);
    for (const label of ['Before file', 'After file']) await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'boundary.json', mimeType: 'application/json', buffer: Buffer.from(content) });
    await page.getByRole('button', { name: 'Preview files', exact: true }).click();
    if (length === 65536) {
      await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
      await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
      expect(JSON.parse(await downloadText(page, 'JSON')).summary.unchanged).toBe(1);
    } else {
      await expect(page.getByRole('alert')).toContainText('LIMIT_EXCEEDED');
      await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
    }
  }
});

test('two supported 100-column inputs allow a 199-column union', async ({ page }) => {
  await open(page);
  for (const [label, prefix] of [['Before file', 'old'], ['After file', 'new']]) {
    const record = Object.fromEntries([['sku', 'A17'], ...Array.from({ length: 99 }, (_, i) => [`${prefix}${i}`, 'value'])]);
    await page.getByLabel(label!, { exact: true }).setInputFiles({ name: `${prefix}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([record])) });
  }
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
  const report = JSON.parse(await downloadText(page, 'JSON'));
  expect(report.columns.compared).toHaveLength(199);
  expect(report.summary.changedCells).toBe(198);
  expect(report.summary.changed).toBe(1);
});

test('new input invalidates report, pagination and sort have no stale rows', async ({ page }) => {
  await open(page);
  const rows = ['sku,value', ...Array.from({ length: 125 }, (_, i) => `K${String(i).padStart(3, '0')},${i}`)].join('\n');
  for (const label of ['Before file', 'After file']) await page.getByLabel(label, { exact: true }).setInputFiles({ name: 'page.csv', mimeType: 'text/csv', buffer: Buffer.from(rows) });
  await page.getByRole('button', { name: 'Preview files', exact: true }).click();
  await page.getByRole('group', { name: 'Key columns', exact: true }).getByRole('checkbox', { name: 'sku', exact: true }).check();
  await page.getByRole('button', { name: 'Compare snapshots', exact: true }).click();
  await expect(page.getByRole('button', { name: 'K000', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'K049', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'K050', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'K050', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'K099', exact: true })).toBeVisible();
  await page.getByLabel('Sort records', { exact: true }).selectOption({ label: 'Key descending' });
  await expect(page.getByRole('button', { name: 'K124', exact: true })).toBeVisible();
  await page.getByLabel('After file', { exact: true }).setInputFiles(fixture('F01/after.csv'));
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  await upload(page, 'F01/before.csv', 'F01/after.csv'); await assertGolden(page);
});

test('worker terminate cancels work and old completion cannot replace a new job', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const qa = { workers: 0, terminated: 0, staleDelivered: 0 };
    Object.assign(window, { __qaWorkers: qa });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options); qa.workers++;
        const originalPost = this.postMessage.bind(this);
        this.postMessage = (message: unknown) => {
          // Delay the first job deterministically, outside production code.
          if (qa.workers === 1) {
            setTimeout(() => originalPost(message), 500);
          } else originalPost(message);
        };
        const descriptor = Object.getOwnPropertyDescriptor(NativeWorker.prototype, 'onmessage');
        let handler: ((event: MessageEvent) => unknown) | null = null;
        Object.defineProperty(this, 'onmessage', {
          get: () => handler,
          set: value => { handler = value; descriptor?.set?.call(this, value); },
        });
        const nativeTerminate = this.terminate.bind(this);
        this.terminate = () => {
          qa.terminated++; nativeTerminate();
          // Inject a structurally valid stale response after termination, not a dropped malformed message.
          const oldHandler = handler;
          setTimeout(() => {
            oldHandler?.(new MessageEvent('message', { data: {
              type: 'complete', job: 1, request: 1, elapsed: 1,
              summary: { before: 99, after: 99, added: 0, removed: 0, changed: 99, unchanged: 0, changedCells: 99 },
              columns: { before: ['sku'], after: ['sku'], added: [], removed: [], compared: ['sku'] },
              page: { total: 99, page: 0, rows: [{ id: 0, key: 'STALE-SENTINEL', status: 'changed', fields: [] }] },
            } })); qa.staleDelivered++;
          }, 700);
        };
      }
    };
  });
  await open(page);
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText(/Cancelled\./)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaWorkers: { terminated: number } }).__qaWorkers.terminated)).toBeGreaterThan(0);
  await demo(page); await assertGolden(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaWorkers: { staleDelivered: number } }).__qaWorkers.staleDelivered)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'STALE-SENTINEL', exact: true })).not.toBeVisible();
  await assertGolden(page);
});

test('worker asset failure is visible and can recover', async ({ page }) => {
  await page.route('**/*worker*.js', route => route.abort());
  await open(page);
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/*worker*.js');
  await demo(page); await assertGolden(page);
});

test('fatal malformed worker reply clears unusable preview and supports reload', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options); Object.assign(window, { __qaWorker: this });
      }
    };
  });
  await open(page); await demo(page);
  await page.evaluate(() => (window as unknown as { __qaWorker: Worker }).__qaWorker.dispatchEvent(new MessageEvent('message', { data: { malformed: true } })));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare snapshots', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  await upload(page, 'F01/before.csv', 'F01/after.csv'); await assertGolden(page);
});

test('invalid worker request with valid envelope returns diagnostic instead of hanging', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const post = this.postMessage.bind(this);
        this.postMessage = (message: unknown) => {
          if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'compare') {
            post({ ...message, ignored: Array.from({ length: 101 }, (_, i) => `column${i}`) });
          } else post(message);
        };
      }
    };
  });
  await open(page); await upload(page, 'F01/before.csv', 'F01/after.csv');
  await expect(page.getByRole('alert')).toContainText('INVALID_CONFIG');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).not.toBeVisible();
  await demo(page); await assertGolden(page);
});

test('two contexts and repeated reset retain no files or object URLs', async ({ page, browser }) => {
  await page.addInitScript(() => {
    const urls = new Set<string>(); const create = URL.createObjectURL; const revoke = URL.revokeObjectURL;
    Object.assign(window, { __qaUrls: urls });
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
  });
  await open(page);
  const second = await browser.newContext();
  const other = await second.newPage(); await other.goto(page.url());
  for (let i = 0; i < 3; i++) {
    await demo(page); await downloadText(page, 'JSON');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaUrls: Set<string> }).__qaUrls.size)).toBe(0);
  await expect(other.getByRole('button', { name: 'Export JSON', exact: true })).not.toBeVisible();
  await second.close();
});
