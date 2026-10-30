import { defineConfig, devices } from '@playwright/test';
import { buildReporters, demoUse, demoWebServer } from './playwright.config';
import { accessibilityOdhinFolder } from './playwright_tests/accessibility/axe-evidence';

const isCi = !!process.env.CI;

/*
 * Accessibility advisory: axe findings are attached as evidence and never fail the run.
 * Execution, fake or report errors still fail it.
 */
export default defineConfig({
  testDir: './playwright_tests/accessibility',
  testMatch: '*.a11y.spec.ts',
  forbidOnly: isCi,
  retries: 0,
  outputDir: 'test-results/accessibility/browser',
  reporter: buildReporters({
    htmlFolder: 'playwright-report/accessibility',
    junitFile: 'test-results/accessibility/junit.xml',
    odhinFolder: accessibilityOdhinFolder,
    odhinIndex: 'index.html',
    odhinTitle: 'RPX XUI Translation accessibility (advisory)'
  }),
  use: demoUse,
  projects: [{ name: 'chromium-a11y', use: { ...devices['Desktop Chrome'] } }],
  webServer: demoWebServer
});
