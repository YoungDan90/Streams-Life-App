import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 5'],  // Mobile-first — the app is designed for mobile
        browserName: 'chromium',
      },
    },
  ],
  // Do NOT start the dev server automatically — tests run against mocked responses
  // and don't need the full stack to be running.
  // To run with real backend: npx next dev & npx playwright test
})
