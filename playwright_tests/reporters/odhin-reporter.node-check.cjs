// Vendored from hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393 e2e/reporters/odhin-report-enhancer.node-check.cjs; local edits marked ADAPTED
// ADAPTED: renamed from odhin-report-enhancer.node-check.cjs; keeps the fail-closed, CLI exit, real failed-report and feature-name checks. Dropped CommonLib-enhancer-specific checks (external presentation/ assets, verifier source regexes, log/lightweight trimming, WebApp layout/a11y markup).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { parse } = require('node-html-parser');
const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('node:url');

const { createEmptyFeatureStat, deriveFeatureName } = require('./odhin-report-enhancer.cjs'); // ADAPTED: enhanceGeneratedReport is exercised through the reporter

function validReport(t) {
  const outputFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-valid-'));
  t.after(() => fs.rmSync(outputFolder, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outputFolder, 'index.html'), '<html><body>Report</body></html>');
  return outputFolder;
}

test('reporter failures override a passing test run instead of returning false green', async (t) => {
  const Reporter = require('./odhin-adaptive.reporter.cjs');
  const reporter = new Reporter({ outputFolder: validReport(t), profile: false, createInnerReporter: () => ({
    onEnd() { throw new Error('controlled report failure'); },
  }) });
  assert.deepEqual(await reporter.onEnd({ status: 'passed' }), { status: 'failed' });
});

test('reporter runtime hook failures and timeouts fail the final result', async (t) => {
  const Reporter = require('./odhin-adaptive.reporter.cjs');
  for (const invoke of [() => { throw new Error('controlled callback failure'); }, () => new Promise(resolve => setTimeout(resolve, 20))]) {
    const reporter = new Reporter({ outputFolder: validReport(t), profile: false, runtimeHookTimeoutMs: 1, createInnerReporter: () => ({}) });
    await reporter.enqueueInnerCallback('controlled', invoke);
    assert.deepEqual(await reporter.onEnd({ status: 'passed' }), { status: 'failed' });
  }
});

test('reporter preserves inner failure overrides and does not turn failed tests green', async (t) => {
  const Reporter = require('./odhin-adaptive.reporter.cjs');
  const failed = new Reporter({ outputFolder: validReport(t), profile: false, createInnerReporter: () => ({ onEnd: async () => ({ status: 'failed' }) }) });
  assert.deepEqual(await failed.onEnd({ status: 'passed' }), { status: 'failed' });
  const outputFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-healthy-'));
  t.after(() => fs.rmSync(outputFolder, { recursive: true, force: true }));
  const healthy = new Reporter({ outputFolder, profile: false, createInnerReporter: () => ({ onEnd: async () => {
    fs.writeFileSync(path.join(outputFolder, 'index.html'), '<html><body>Report</body></html>');
    return { status: 'passed' };
  } }) });
  assert.equal(await healthy.onEnd({ status: 'failed' }), undefined);
});

test('missing, empty or wrong primary report fails closed', async (t) => {
  const Reporter = require('./odhin-adaptive.reporter.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-missing-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const mode of ['absent', 'empty', 'wrong']) {
    const outputFolder = path.join(root, mode);
    if (mode !== 'absent') {
      fs.mkdirSync(outputFolder);
      fs.writeFileSync(path.join(outputFolder, mode === 'empty' ? 'required.html' : 'other.html'), mode === 'empty' ? '' : '<html>Other report</html>');
    }
    const reporter = new Reporter({ outputFolder, indexFilename: 'required.html', profile: false,
      createInnerReporter: () => ({ onEnd: async () => undefined }) });
    assert.deepEqual(await reporter.onEnd({ status: 'passed' }), { status: 'failed' }, mode);
  }
});

test('finalisation timeout and enhancement errors fail the run', async (t) => {
  const Reporter = require('./odhin-adaptive.reporter.cjs');
  const slow = new Reporter({ outputFolder: validReport(t), profile: false, finalizationTimeoutMs: 1,
    createInnerReporter: () => ({ onEnd: () => new Promise(resolve => setTimeout(resolve, 20)) }) });
  assert.deepEqual(await slow.onEnd({ status: 'passed' }), { status: 'failed' });
  const outputFolder = validReport(t);
  // ADAPTED: the WebApp enhancer inlines its presentation instead of writing presentation/, so make a second
  // ADAPTED: .html entry unreadable (a directory) to force a controlled enhancement error.
  fs.mkdirSync(path.join(outputFolder, 'unreadable.html')); // ADAPTED
  const reporter = new Reporter({ outputFolder, profile: false, createInnerReporter: () => ({}) });
  reporter.featureStats.set('feature', createEmptyFeatureStat('feature'));
  assert.deepEqual(await reporter.onEnd({ status: 'passed' }), { status: 'failed' });
});

test('Playwright CLI exits nonzero for a report failure despite a passing test', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-exit-proof-'));
  try {
    const reporterPath = require.resolve('./odhin-adaptive.reporter.cjs');
    const testPath = require.resolve('@playwright/test');
    fs.writeFileSync(path.join(root, 'probe.spec.cjs'), `const { test, expect } = require(${JSON.stringify(testPath)}); test('passing contract', () => expect(2 + 2).toBe(4));`);
    fs.writeFileSync(path.join(root, 'reporter.cjs'), `const fs = require('node:fs'); const path = require('node:path'); const Reporter = require(${JSON.stringify(reporterPath)}); module.exports = class extends Reporter { constructor(options) { super({outputFolder: options.outputFolder, profile:false, createInnerReporter: () => ({ onEnd() { if(options.mode !== 'missing') { fs.mkdirSync(options.outputFolder); fs.writeFileSync(path.join(options.outputFolder, 'index.html'), '<html><body>Report</body></html>'); } if(options.mode === 'throw') throw new Error('controlled report failure'); } })}); } };`);
    for (const mode of ['healthy', 'throw', 'missing']) {
      fs.writeFileSync(path.join(root, 'playwright.config.cjs'), `module.exports = { testDir: ${JSON.stringify(root)}, testMatch: 'probe.spec.cjs', outputDir: ${JSON.stringify(path.join(root, 'results'))}, reporter: [['./reporter.cjs', {mode:${JSON.stringify(mode)},outputFolder:${JSON.stringify(path.join(root, mode))}}]] };`);
      const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '-c', path.join(root, 'playwright.config.cjs')], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, mode === 'healthy' ? 0 : 1, result.stdout + result.stderr);
      if (mode === 'throw') assert.match(result.stderr, /controlled report failure/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a real failed Odhín report keeps native step evidence operable', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-failed-steps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputFolder = path.join(root, 'report');
  const report = path.join(outputFolder, 'failed-steps.html');
  const reporterPath = require.resolve('./odhin-adaptive.reporter.cjs');
  const testPath = require.resolve('@playwright/test');

  fs.writeFileSync(
    path.join(root, 'failed-steps.spec.cjs'),
    `const { test, expect } = require(${JSON.stringify(testPath)});
test('controlled Odhín failure', async () => {
  await test.step('failure step retained in report', async () => {
    expect('actual').toBe('expected');
  });
});`
  );
  fs.writeFileSync(
    path.join(root, 'playwright.config.cjs'),
    `module.exports = {
  testDir: ${JSON.stringify(root)},
  testMatch: 'failed-steps.spec.cjs',
  reporter: [[${JSON.stringify(reporterPath)}, {
    outputFolder: ${JSON.stringify(outputFolder)},
    indexFilename: 'failed-steps.html',
    profile: false,
    lightweight: true,
    embedAssets: false,
    startServer: false
  }]]
};`
  );

  const result = spawnSync(
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test', '-c', path.join(root, 'playwright.config.cjs')],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(fs.statSync(report).size > 0, 'real failed Odhín report is emitted');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(report).href);
    await page.locator('#odhin-feature-summary .feature-toggle').click();
    await page.locator('#feature-tests-0 .feature-test-steps').click();
    const modal = page.locator('.modal.show').last();
    await modal.waitFor();
    assert.ok(await page.locator('#test-list-table .result-status-failed').count(), 'report retains the failed result');
    assert.equal(await modal.locator('.result-tab-header button.active').textContent().then((text) => text.trim()), 'Steps', 'feature drill-down opens the native Steps tab');
    const visibleSteps = modal.locator('.result-tabcontent[style*="display: block"] .stepLine');
    assert.ok(await visibleSteps.count(), 'failed result renders native step evidence');
    assert.match((await visibleSteps.allTextContents()).join(' '), /failure step retained in report/, 'failed result retains the original step');
  } finally {
    await browser.close();
  }
});

// ADAPTED: the WebApp enhancer derives features from a declared `feature` annotation or the spec file name,
// ADAPTED: not from describe titles; assert that contract plus the empty feature-stat shape.
test('derives features from annotations or the spec file name', () => { // ADAPTED
  const titlePath = ['', 'chromium', 'smoke/translation-demo.spec.ts', 'Translation demo smoke', 'S1 renders English']; // ADAPTED
  assert.equal(deriveFeatureName('/workspace/playwright_tests/smoke/translation-demo.spec.ts', titlePath), 'translation-demo.spec'); // ADAPTED
  assert.equal(deriveFeatureName('/workspace/playwright_tests/smoke/translation-demo.spec.ts', [{ type: 'feature', description: 'Translation' }]), 'Translation'); // ADAPTED
  assert.equal(deriveFeatureName(undefined), 'unknown'); // ADAPTED
  assert.deepEqual(createEmptyFeatureStat('Translation'), { // ADAPTED
    name: 'Translation', totalTests: 0, durationMs: 0, passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0, flaky: 0 // ADAPTED
  }); // ADAPTED
}); // ADAPTED
