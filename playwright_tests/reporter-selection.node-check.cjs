const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

// Loads the real playwright.config.ts through the Playwright CLI; --list starts no web server or browser.
function listWith(env) {
  // Keep the probe's Odhín output out of the real test-results/odhin report folder.
  const odhinOutput = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-reporter-selection-'));
  const cleanEnv = { ...process.env, PW_ODHIN_OUTPUT: odhinOutput };
  delete cleanEnv.PLAYWRIGHT_REPORTERS;
  delete cleanEnv.PLAYWRIGHT_DEFAULT_REPORTER;
  delete cleanEnv.CI;
  const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--list', '--project=chromium'], {
    cwd: repoRoot, encoding: 'utf8', env: { ...cleanEnv, ...env }
  });
  fs.rmSync(odhinOutput, { recursive: true, force: true });
  return result;
}

test('PLAYWRIGHT_DEFAULT_REPORTER is the fallback when PLAYWRIGHT_REPORTERS is unset', () => {
  const result = listWith({ PLAYWRIGHT_DEFAULT_REPORTER: 'list,unknown-default' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Unsupported Playwright reporter\(s\): unknown-default/);
});

test('PLAYWRIGHT_REPORTERS takes precedence over PLAYWRIGHT_DEFAULT_REPORTER', () => {
  const result = listWith({ PLAYWRIGHT_REPORTERS: 'list', PLAYWRIGHT_DEFAULT_REPORTER: 'unknown-default' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Total: [1-9]\d* tests? in [1-9]\d* files?/);
  assert.doesNotMatch(result.stdout, /odhin-profile/, 'only the list reporter is active');
});

test('the default reporter is used and validated, including an empty list', () => {
  const listOnly = listWith({ PLAYWRIGHT_DEFAULT_REPORTER: 'list' });
  assert.equal(listOnly.status, 0, listOnly.stdout + listOnly.stderr);
  assert.doesNotMatch(listOnly.stdout, /odhin-profile/, 'the built-in odhin set is not used');
  const empty = listWith({ PLAYWRIGHT_DEFAULT_REPORTER: ',' });
  assert.notEqual(empty.status, 0);
  assert.match(empty.stdout + empty.stderr, /PLAYWRIGHT_REPORTERS lists no reporters/);
  const builtIn = listWith({});
  assert.equal(builtIn.status, 0, builtIn.stdout + builtIn.stderr);
  assert.match(builtIn.stdout, /odhin-profile/, 'built-in set includes odhin');
});
