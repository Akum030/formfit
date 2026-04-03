import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    permissions: ['camera', 'microphone'],
    // Headed mode so browser is visible during tests
    headless: false,
    // Slow down actions so we can visually verify
    launchOptions: {
      slowMo: 300,
    },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Assumes servers are already running
  webServer: undefined,
});
