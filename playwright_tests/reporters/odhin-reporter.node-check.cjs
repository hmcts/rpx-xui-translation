// Vendored from hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393 e2e/reporters/odhin-report-enhancer.node-check.cjs; local edits marked ADAPTED
// ADAPTED: diverges from common-lib@b27d3cd2 for F4: adds a real-CLI never-settling hook regression (upstream tests delayed resolution only).
// ADAPTED: renamed from odhin-report-enhancer.node-check.cjs; keeps the fail-closed, CLI exit, real failed-report and feature-name checks. Dropped CommonLib-enhancer-specific layout/verifier checks. ADAPTED: adds retained-output, suppression and lane-specific screenshot/trace checks for the hybrid presentation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
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
    const pageErrors = []; // ADAPTED: the external js/chartjs.js must load without the removed file-chart initializer
    page.on('pageerror', (error) => pageErrors.push(error.message)); // ADAPTED
    page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`); }); // ADAPTED
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
    assert.deepEqual(pageErrors, [], 'failed report renders without page or console errors'); // ADAPTED
  } finally {
    await browser.close();
  }
});

// ADAPTED: the WebApp enhancer derives features from a declared `feature` annotation or the spec file name,
// ADAPTED: not from describe titles; assert that contract plus the empty feature-stat shape.
test('derives features from annotations or the spec file name', () => { // ADAPTED
  assert.equal(deriveFeatureName('/workspace/playwright_tests/smoke/translation-demo.spec.ts'), 'translation-demo.spec'); // ADAPTED
  assert.equal(deriveFeatureName('/workspace/playwright_tests/smoke/translation-demo.spec.ts', [{ type: 'feature', description: 'Translation' }]), 'Translation'); // ADAPTED
  assert.equal(deriveFeatureName(undefined), 'unknown'); // ADAPTED
  assert.deepEqual(createEmptyFeatureStat('Translation'), { // ADAPTED
    name: 'Translation', totalTests: 0, durationMs: 0, passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0, flaky: 0 // ADAPTED
  }); // ADAPTED
}); // ADAPTED

// ADAPTED: the reporter passes test.annotations to deriveFeatureName (feature annotation first, spec basename fallback).
test('reporter groups results by feature annotation or spec file name', async () => { // ADAPTED
  const Reporter = require('./odhin-adaptive.reporter.cjs'); // ADAPTED
  const reporter = new Reporter({ profile: false, createInnerReporter: () => ({ onTestEnd() {} }) }); // ADAPTED
  const result = { status: 'passed', retry: 0, duration: 1, steps: [], attachments: [] }; // ADAPTED
  const file = '/workspace/playwright_tests/smoke/translation-demo.spec.ts'; // ADAPTED
  await reporter.onTestEnd({ id: 'annotated', location: { file }, retries: 0, annotations: [{ type: 'feature', description: 'Translation' }], titlePath: () => ['', 'chromium', 'Suite', 'annotated'] }, result); // ADAPTED
  await reporter.onTestEnd({ id: 'plain', location: { file }, retries: 0, annotations: [], titlePath: () => ['', 'chromium', 'Suite', 'plain'] }, result); // ADAPTED
  await reporter.flushInnerCallbacks(); // ADAPTED
  assert.deepEqual(reporter.testMetadata.map((entry) => entry.feature), ['Translation', 'translation-demo.spec']); // ADAPTED
  assert.deepEqual([...reporter.featureStats.keys()], ['Translation', 'translation-demo.spec']); // ADAPTED
}); // ADAPTED

// ADAPTED (F4): a hook that never settles must fail the real CLI within the deadline (upstream only tests delayed resolution).
test('Playwright CLI exits nonzero when a reporter hook never settles', () => { // ADAPTED
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odhin-hang-proof-')); // ADAPTED
  try { // ADAPTED
    const reporterPath = require.resolve('./odhin-adaptive.reporter.cjs'); // ADAPTED
    const testPath = require.resolve('@playwright/test'); // ADAPTED
    fs.writeFileSync(path.join(root, 'probe.spec.cjs'), `const { test, expect } = require(${JSON.stringify(testPath)}); test('passing contract', () => expect(2 + 2).toBe(4));`); // ADAPTED
    fs.writeFileSync(path.join(root, 'reporter.cjs'), `const fs = require('node:fs'); const path = require('node:path'); const Reporter = require(${JSON.stringify(reporterPath)}); const hang = () => new Promise(() => {}); module.exports = class extends Reporter { constructor(options) { super({ outputFolder: options.outputFolder, profile: false, runtimeHookTimeoutMs: 250, finalizationTimeoutMs: 250, createInnerReporter: () => ({ onTestEnd() { if (options.mode === 'test-end') return hang(); }, onEnd() { if (options.mode === 'end') return hang(); fs.mkdirSync(options.outputFolder); fs.writeFileSync(path.join(options.outputFolder, 'index.html'), '<html><body>Report</body></html>'); } }) }); } };`); // ADAPTED
    for (const mode of ['healthy', 'test-end', 'end']) { // ADAPTED
      fs.writeFileSync(path.join(root, 'playwright.config.cjs'), `module.exports = { testDir: ${JSON.stringify(root)}, testMatch: 'probe.spec.cjs', outputDir: ${JSON.stringify(path.join(root, 'results'))}, reporter: [['./reporter.cjs', {mode:${JSON.stringify(mode)},outputFolder:${JSON.stringify(path.join(root, mode))}}]] };`); // ADAPTED
      const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '-c', path.join(root, 'playwright.config.cjs')], { cwd: root, encoding: 'utf8', timeout: 60_000 }); // ADAPTED
      assert.equal(result.error, undefined, `${mode}: CLI did not finish within 60s`); // ADAPTED
      assert.equal(result.status, mode === 'healthy' ? 0 : 1, `${mode}\n${result.stdout}${result.stderr}`); // ADAPTED
      if (mode !== 'healthy') assert.match(result.stderr, /timed out after 250ms/, mode); // ADAPTED
    } // ADAPTED
  } finally { // ADAPTED
    fs.rmSync(root, { recursive: true, force: true }); // ADAPTED
  } // ADAPTED
}); // ADAPTED

// ADAPTED: exercise real failed/timed-out result output and diagnostics from a nondefault lane directory.
const { parse } = require('node-html-parser');

function diagnosticReport(t, testOutput) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-report-diagnostics-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputFolder = path.join(root, 'report');
  const laneOutput = path.join(root, 'cross-browser-lane-results');
  const stdoutMarker = `stdout-${path.basename(root)}`;
  const stderrMarker = `stderr-${path.basename(root)}`;
  fs.writeFileSync(path.join(root, 'diagnostics.spec.cjs'), `
const { test, expect } = require(${JSON.stringify(require.resolve('@playwright/test'))});
for (const status of ['failed', 'timedOut']) {
  test(status, async ({ page }) => {
    test.setTimeout(3000);
    await page.setContent('<h1>Synthetic diagnostic fixture</h1>');
    console.log(process.env.OUTPUT_MARKER + ':' + status);
    console.error(process.env.ERROR_MARKER + ':' + status);
    if (status === 'failed') expect(1).toBe(2);
    else await new Promise(() => {});
  });
}
test('passed', () => { console.log(process.env.OUTPUT_MARKER); });
test.skip('skipped', () => {});
test('empty-output', () => { expect(1).toBe(2); });
`);
  fs.writeFileSync(path.join(root, 'playwright.config.cjs'), `module.exports = {
    testDir: ${JSON.stringify(root)}, testMatch: 'diagnostics.spec.cjs', workers: 1, retries: 0,
    outputDir: ${JSON.stringify(laneOutput)},
    use: { screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'off' },
    reporter: [[${JSON.stringify(require.resolve('./odhin-adaptive.reporter.cjs'))}, {
      outputFolder: ${JSON.stringify(outputFolder)}, profile: false, lightweight: true, embedAssets: false,
      startServer: false, ${testOutput === false ? 'testOutput: false,' : ''}
    }]],
  };`);
  const child = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '-c', path.join(root, 'playwright.config.cjs')], {
    cwd: root, encoding: 'utf8', timeout: 60_000, env: { ...process.env, OUTPUT_MARKER: stdoutMarker, ERROR_MARKER: stderrMarker },
  });
  assert.equal(child.error, undefined, child.stdout + child.stderr);
  assert.equal(child.status, 1, child.stdout + child.stderr);
  const html = fs.readFileSync(path.join(outputFolder, 'index.html'), 'utf8');
  return { root: parse(html), outputFolder, laneOutput, html, stdoutMarker, stderrMarker };
}

function resultModal(root, title) {
  const row = root.querySelectorAll('#test-list-table tbody tr').find((node) => node.querySelector('td')?.textContent.trim() === title);
  assert.ok(row, `missing result ${title}`);
  const target = row.getAttribute('data-bs-target').slice(1);
  const modal = root.querySelectorAll('[id]').find((node) => node.getAttribute('id') === target);
  assert.ok(modal, `missing modal ${title}`);
  return modal;
}

test('failed and timed-out results link their retained output, screenshot and trace from the lane folder', (t) => {
  const { root, outputFolder, laneOutput, html, stdoutMarker, stderrMarker } = diagnosticReport(t);
  const laneFiles = fs.readdirSync(laneOutput, { recursive: true }).map((file) => path.join(laneOutput, file));
  for (const status of ['failed', 'timedOut']) {
    const modal = resultModal(root, status);
    for (const [name, extension] of [['screenshot', '.png'], ['trace', '.zip']]) {
      const link = modal.querySelectorAll('a[href]').find((node) => node.getAttribute('href').endsWith(extension));
      assert.ok(link, `${status}: missing ${name} link`);
      const copied = path.resolve(outputFolder, link.getAttribute('href'));
      assert.ok(fs.statSync(copied).size > 0, `${status}: missing copied ${name}`);
      const laneFile = laneFiles.find((file) => path.relative(laneOutput, file).split(path.sep)[0].includes(status) &&
        file.endsWith(extension) && fs.readFileSync(file).equals(fs.readFileSync(copied)));
      assert.ok(laneFile, `${status}: report ${name} must match the actual lane attachment bytes`);
    }
    const link = modal.querySelector('a[download="test-output.log"]');
    assert.ok(link, `${status}: missing retained-output download link`);
    const log = fs.readFileSync(path.resolve(outputFolder, link.getAttribute('href')), 'utf8');
    assert.ok(log.includes(`${stdoutMarker}:${status}`));
    assert.ok(log.includes(`${stderrMarker}:${status}`));
  }
  for (const status of ['passed', 'skipped', 'empty-output']) {
    assert.equal(resultModal(root, status).querySelector('a[download="test-output.log"]'), null, `${status}: no invented output link`);
  }
  assert.ok(!html.includes(stdoutMarker) && !html.includes(stderrMarker), 'output stays external to HTML');
  assert.equal(root.querySelectorAll('a[href$=".webm"]').length, 0, 'video remains disabled');
});

test('testOutput false suppresses failure logs and their links', (t) => {
  const { root, outputFolder, html, stdoutMarker, stderrMarker } = diagnosticReport(t, false);
  assert.equal(root.querySelectorAll('a[download="test-output.log"]').length, 0);
  assert.equal(fs.existsSync(path.join(outputFolder, 'logs')), false);
  assert.ok(!html.includes(stdoutMarker) && !html.includes(stderrMarker));
});

test('presentation escapes each result log link and targets only its own modal', () => {
  const { applyPresentation } = require('./presentation/enhance.cjs');
  const root = parse('<html><head></head><body><table id="test-list-table"><thead><tr></tr></thead><tbody></tbody></table><div id="failed"><div class="modal-body"></div></div><div id="timedOut"><div class="modal-body"></div></div><div id="empty"><div class="modal-body"></div></div></body></html>');
  applyPresentation(root, [{ target: '#failed', logFileName: 'logs/failed&\"<x>.log' }, { target: '#timedOut', logFileName: 'logs/timedOut.log' }, { target: '#empty' }]);
  assert.match(root.querySelector('#failed .modal-body').innerHTML, /href="\.\/logs\/failed&amp;&quot;&lt;x&gt;\.log" download="test-output.log"/);
  assert.equal(root.querySelector('#timedOut a').getAttribute('href'), './logs/timedOut.log');
  assert.equal(root.querySelector('#empty a'), null);
});
