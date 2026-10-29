import { defineConfig, devices, ReporterDescription } from '@playwright/test';
import packageJson from './package.json';

const demoPort = 4300;
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const isCi = !!process.env.CI;

/* Comma-separated subset of dot,list,html,junit,odhin (e.g. PLAYWRIGHT_REPORTERS=list,html,junit,odhin). */
const supportedReporters = ['dot', 'list', 'html', 'junit', 'odhin'];
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';

export type ReportLocations = {
  htmlFolder: string;
  junitFile: string;
  odhinFolder: string;
  odhinIndex: string;
  odhinTitle: string;
};

const functionalReports: ReportLocations = {
  htmlFolder: 'playwright-report',
  junitFile: 'test-results/junit.xml',
  odhinFolder: 'test-results/odhin',
  odhinIndex: 'translation-playwright.html',
  odhinTitle: 'RPX XUI Translation Playwright'
};

export function buildReporters(locations: ReportLocations): ReporterDescription[] {
  const defaultReporters = isCi ? 'dot,html,junit,odhin' : 'list,html,junit,odhin';
  const reporterNames = (process.env.PLAYWRIGHT_REPORTERS || defaultReporters)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (reporterNames.length === 0) {
    throw new Error('PLAYWRIGHT_REPORTERS lists no reporters');
  }

  const unknownReporters = reporterNames.filter((name) => !supportedReporters.includes(name));
  if (unknownReporters.length > 0) {
    throw new Error(`Unsupported Playwright reporter(s): ${unknownReporters.join(', ')}`);
  }

  return reporterNames.map((name): ReporterDescription => {
    switch (name) {
      case 'html':
        return ['html', { open: 'never', outputFolder: locations.htmlFolder }];
      case 'junit':
        return ['junit', { outputFile: locations.junitFile }];
      case 'odhin':
        return [
          './playwright_tests/reporters/odhin-adaptive.reporter.cjs',
          {
            outputFolder: process.env.PW_ODHIN_OUTPUT ?? locations.odhinFolder,
            indexFilename: process.env.PW_ODHIN_INDEX ?? locations.odhinIndex,
            title: locations.odhinTitle,
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
  });
}

export const demoUse = {
  baseURL: externalBaseUrl ?? `http://127.0.0.1:${demoPort}`,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure'
} as const;

export const demoWebServer = externalBaseUrl ? undefined : {
  command: `yarn ng serve rpx-xui-translation-demo --host 127.0.0.1 --port ${demoPort}`,
  url: `http://127.0.0.1:${demoPort}`,
  reuseExistingServer: !isCi,
  timeout: 3 * 60_000
};

/*
 * `yarn test:e2e` and CI run `--project=chromium` only.
 * smoke-firefox and smoke-webkit are the on-demand cross-browser advisory (`yarn test:e2e:crossbrowser`).
 * The accessibility advisory has its own config (playwright.accessibility.config.ts).
 */
export default defineConfig({
  testDir: './playwright_tests',
  testIgnore: '**/accessibility/**',
  forbidOnly: isCi,
  retries: 0,
  reporter: buildReporters(functionalReports),
  use: demoUse,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'smoke-firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'smoke-webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: demoWebServer
});
