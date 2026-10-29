import { defineConfig, devices } from '@playwright/test';

const demoPort = 4300;
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const isCi = !!process.env.CI;

export default defineConfig({
  testDir: './playwright_tests',
  forbidOnly: isCi,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${demoPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: externalBaseUrl ? undefined : {
    command: `yarn ng serve rpx-xui-translation-demo --host 127.0.0.1 --port ${demoPort}`,
    url: `http://127.0.0.1:${demoPort}`,
    reuseExistingServer: !isCi,
    timeout: 3 * 60_000
  }
});
