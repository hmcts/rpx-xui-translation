import { defineConfig, devices, ReporterDescription } from '@playwright/test';
import packageJson from './package.json';

const demoPort = 4300;
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const isCi = !!process.env.CI;

/* Comma-separated subset of dot,list,html,junit,odhin (e.g. PLAYWRIGHT_REPORTERS=list,html,junit,odhin). */
const supportedReporters = ['dot', 'list', 'html', 'junit', 'odhin'];
const defaultReporters = isCi ? 'dot,html,junit,odhin' : 'list,html,junit,odhin';
const reporterNames = (process.env.PLAYWRIGHT_REPORTERS ?? defaultReporters)
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const unknownReporters = reporterNames.filter((name) => !supportedReporters.includes(name));
if (unknownReporters.length > 0) {
  throw new Error(`Unsupported Playwright reporter(s): ${unknownReporters.join(', ')}`);
}

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';

function reporterFor(name: string): ReporterDescription {
  switch (name) {
    case 'html':
      return ['html', { open: 'never', outputFolder: 'playwright-report' }];
    case 'junit':
      return ['junit', { outputFile: 'test-results/junit.xml' }];
    case 'odhin':
      return [
        './playwright_tests/reporters/odhin-adaptive.reporter.cjs',
        {
          outputFolder: process.env.PW_ODHIN_OUTPUT ?? 'test-results/odhin',
          indexFilename: process.env.PW_ODHIN_INDEX ?? 'translation-playwright.html',
          title: 'RPX XUI Translation Playwright',
          project: 'RPX XUI Translation',
          release: `${packageJson.version} (${branch})`,
          testEnvironment: isCi ? 'CI' : 'local',
          embedAssets: false,
          embedAttachments: false,
          startServer: false,
          consoleLog: true,
          consoleError: true,
          testOutput: 'only-on-failure'
        }
      ];
    default:
      return [name as 'dot' | 'list'];
  }
}

export default defineConfig({
  testDir: './playwright_tests',
  forbidOnly: isCi,
  retries: 0,
  reporter: reporterNames.map(reporterFor),
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
