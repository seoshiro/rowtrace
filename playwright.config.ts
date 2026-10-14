import { defineConfig } from '@playwright/test';

const live = process.env.ROWTRACE_URL;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: live ?? 'http://127.0.0.1:4173/rowtrace/',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' }, testMatch: '**/contract.spec.ts' },
    { name: 'webkit', use: { browserName: 'webkit' }, testMatch: '**/contract.spec.ts' },
  ],
  ...(live ? {} : { webServer: {
    command: 'npm run preview -w @seoshiro/rowtrace-web -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/rowtrace/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  } }),
});
