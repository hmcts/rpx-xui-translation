// Vendored from hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393 e2e/reporters/odhin-site-publisher.node-check.cjs; local edits marked ADAPTED
// ADAPTED: functional report type only; dropped the accessibility and cross-browser publication cases.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { publishReport, slugifyBranch } = require('./odhin-site-publisher.cjs');

const assetPaths = [
  'presentation/report.css',
  'presentation/feature.css',
  'presentation/report.js',
  'js/chartjs.js',
  'images/chart.png',
  'screenshots/test.png',
  'traces/trace.zip',
  'logs/browser.log'
];

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function createSource(root, label, { includeIndex = true } = {}) {
  assetPaths.forEach((assetPath) => fs.mkdirSync(path.dirname(path.join(root, assetPath)), { recursive: true }));
  if (includeIndex) {
    // ADAPTED: translation index name on the next line.
    fs.writeFileSync(path.join(root, 'translation-playwright.html'), `<!doctype html>
<html><body>
<link rel="stylesheet" href="./presentation/report.css">
<link rel="stylesheet" href="./presentation/feature.css">
<script src="./presentation/report.js"></script>
<script src="./js/chartjs.js"></script>
<img src="./images/chart.png">
<img src="./screenshots/test.png">
<p>${label}</p></body></html>`);
  }
  assetPaths.forEach((assetPath) => fs.writeFileSync(path.join(root, assetPath), `${label}:${assetPath}`));
}

function publish({ source, site, branch, reportType = 'functional', runId, runAttempt = '1', sha = 'a'.repeat(40), latestOnly = false }) {
  return publishReport({
    sourceDir: source,
    siteDir: site,
    rawBranch: branch,
    reportType,
    runKey: `${runId}-attempt-${runAttempt}`,
    runId,
    runAttempt,
    sha,
    runUrl: `https://github.com/hmcts/rpx-xui-translation/actions/runs/${runId}/attempts/${runAttempt}`, // ADAPTED: repository
    latestOnly
  });
}

test('builds a current-run Pages projection without copying immutable archive history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'common-lib-odhin-pages-'));
  const source = path.join(root, 'source');
  const archive = path.join(root, 'archive');
  const pages = path.join(root, 'pages');
  try {
    createSource(source, 'older archived run');
    publish({ source, site: archive, branch: 'master', runId: '30' });
    createSource(source, 'current public run');
    publish({ source, site: archive, branch: 'master', runId: '31' });

    publishReport({
      sourceDir: source,
      siteDir: pages,
      rawBranch: 'master',
      reportType: 'functional',
      runKey: '31-attempt-1',
      runId: '31',
      runAttempt: '1',
      sha: 'a'.repeat(40),
      runUrl: 'https://github.com/hmcts/rpx-xui-translation/actions/runs/31/attempts/1', // ADAPTED: repository
      latestOnly: true
    });

    assert.ok(fs.existsSync(path.join(archive, 'reports/master/runs/30-attempt-1')), 'peer archive retains older evidence');
    assert.ok(fs.existsSync(path.join(archive, 'reports/master/runs/31-attempt-1')), 'peer archive retains the current evidence');
    assert.equal(fs.existsSync(path.join(pages, 'reports/master/runs/30-attempt-1')), false, 'Pages omits older archive evidence');
    assert.ok(fs.existsSync(path.join(pages, 'reports/master/runs/31-attempt-1/index.html')), 'Pages retains the current report');
    assert.match(fs.readFileSync(path.join(pages, 'index.html'), 'utf8'), /Only the current report is published on this Pages site/);
    const publicReport = fs.readFileSync(path.join(pages, 'reports/master/runs/31-attempt-1/index.html'), 'utf8');
    assert.match(publicReport, /Current public Functional Odhín report/);
    assert.doesNotMatch(publicReport, /This report is immutable|Open Accessibility Odhín history|Open Cross-browser Odhín history/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function assertHistoryLinkResolves(runFile, html, label, expectedHistoryFile) {
  const match = html.match(new RegExp(`href="([^"]+)"[^>]*>Open ${label} history`));
  assert.ok(match, `missing ${label} history link`);
  assert.equal(path.resolve(path.dirname(runFile), match[1]), path.dirname(expectedHistoryFile));
  assert.ok(fs.existsSync(expectedHistoryFile), `missing ${label} history index`);
}

test('retains immutable branch history, external assets and master links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'common-lib-odhin-'));
  const source = path.join(root, 'source');
  const site = path.join(root, 'site');
  try {
    createSource(source, 'master-10');
    const masterFirst = publish({ source, site, branch: 'master', runId: '10', sha: 'm'.repeat(40) });
    const firstRunDir = path.join(site, 'reports', masterFirst.branchSlug, 'runs', '10-attempt-1');
    const firstHtml = fs.readFileSync(path.join(firstRunDir, 'index.html'), 'utf8');
    const firstAssetDigests = Object.fromEntries(assetPaths.map((assetPath) => [assetPath, digest(path.join(firstRunDir, assetPath))]));

    createSource(source, 'feature-11-attempt-1');
    const featureFirst = publish({ source, site, branch: 'feature/a-b', runId: '11', sha: 'f'.repeat(40) });
    createSource(source, 'feature-11-attempt-2');
    publish({ source, site, branch: 'feature/a-b', runId: '11', runAttempt: '2', sha: 'g'.repeat(40) });

    createSource(source, 'collision-12');
    const collision = publish({ source, site, branch: 'feature-a-b', runId: '12', sha: 'c'.repeat(40) });
    createSource(source, 'master-13');
    publish({ source, site, branch: 'master', runId: '13', sha: 'n'.repeat(40) });
    createSource(source, 'hostile-14');
    const hostile = publish({ source, site, branch: 'feature/<script>', runId: '14', sha: 'h'.repeat(40) });

    assert.equal(masterFirst.branchSlug, 'master');
    assert.notEqual(slugifyBranch('feature/a-b'), slugifyBranch('feature-a-b'));
    assert.match(featureFirst.branchSlug, /^[a-z0-9._-]+$/);
    assert.match(collision.branchSlug, /^[a-z0-9._-]+$/);
    assert.notEqual(featureFirst.branchSlug, collision.branchSlug);
    assert.equal(slugifyBranch('feature/<script>'), hostile.branchSlug);

    const featureDir = path.join(site, 'reports', featureFirst.branchSlug);
    const featureIndex = fs.readFileSync(path.join(featureDir, 'index.html'), 'utf8');
    const rootIndex = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
    assert.match(featureIndex, /Open latest Functional Odhín report.*11-attempt-2/s);
    assert.match(featureIndex, /11-attempt-1/);
    assert.match(featureIndex, /11-attempt-2/);
    assert.doesNotMatch(featureIndex, /10-attempt-1|12-attempt-1/);
    assert.match(rootIndex, /href="\.\/reports\/master\/"/);
    assert.match(rootIndex, new RegExp(`reports/${featureFirst.branchSlug}/`));
    assert.match(rootIndex, /feature\/&lt;script&gt;/);
    assert.ok(fs.existsSync(path.join(site, '.nojekyll')));

    assert.equal(fs.readFileSync(path.join(firstRunDir, 'index.html'), 'utf8'), firstHtml);
    assetPaths.forEach((assetPath) => {
      const copied = path.join(firstRunDir, assetPath);
      assert.ok(fs.existsSync(copied), `missing copied asset ${assetPath}`);
      assert.equal(digest(copied), firstAssetDigests[assetPath], `changed copied asset ${assetPath}`);
    });
    assert.doesNotMatch(firstHtml, /data:image\//);
    assert.doesNotMatch(firstHtml, /id="odhin-enhancer-styles"/);

    assert.throws(() => publish({ source, site, branch: 'master', runId: '10', sha: 'z'.repeat(40) }), /already exists|will not be overwritten/);
    assert.equal(fs.readFileSync(path.join(firstRunDir, 'index.html'), 'utf8'), firstHtml);

    const masterBranch = JSON.parse(fs.readFileSync(path.join(site, 'reports', 'master', 'odhin-branch.json'), 'utf8'));
    assert.deepEqual(masterBranch.runs.map((run) => run.runKey), ['13-attempt-1', '10-attempt-1']);
    assert.equal(masterBranch.runs[0].rawBranch, 'master');
    assert.equal(masterBranch.runs[0].runUrl, 'https://github.com/hmcts/rpx-xui-translation/actions/runs/13/attempts/1'); // ADAPTED: repository
    assert.equal(masterBranch.runs[0].sha, 'n'.repeat(40));

    const collidingSlug = slugifyBranch('feature/collision');
    const collidingDir = path.join(site, 'reports', collidingSlug);
    fs.mkdirSync(collidingDir, { recursive: true });
    fs.writeFileSync(path.join(collidingDir, 'odhin-branch.json'), JSON.stringify({ rawBranch: 'different-branch' }));
    assert.throws(
      () => publish({ source, site, branch: 'feature/collision', runId: '15', sha: 'x'.repeat(40) }),
      /branch slug collision/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an incomplete report before creating public history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'common-lib-odhin-invalid-'));
  const source = path.join(root, 'source');
  const site = path.join(root, 'site');
  try {
    createSource(source, 'invalid', { includeIndex: false });
    assert.throws(() => publish({ source, site, branch: 'broken', runId: '99' }), /HTML index is missing/);
    assert.equal(fs.existsSync(path.join(site, 'reports')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('builds a latest-only Pages projection without copying archive history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'common-lib-odhin-latest-'));
  const source = path.join(root, 'source');
  const archive = path.join(root, 'archive');
  const pages = path.join(root, 'pages');
  try {
    createSource(source, 'old');
    publish({ source, site: archive, branch: 'master', runId: '30' });
    createSource(source, 'current');
    publish({ source, site: archive, branch: 'master', runId: '31' });
    publish({ source, site: pages, branch: 'master', runId: '31', latestOnly: true });

    assert.ok(fs.existsSync(path.join(archive, 'reports/master/runs/30-attempt-1')));
    assert.ok(fs.existsSync(path.join(archive, 'reports/master/runs/31-attempt-1')));
    assert.ok(fs.existsSync(path.join(pages, 'reports/master/runs/31-attempt-1')));
    assert.equal(fs.existsSync(path.join(pages, 'reports/master/runs/30-attempt-1')), false);
    const latestFunctionalIndex = fs.readFileSync(path.join(pages, 'reports/master/index.html'), 'utf8');
    // ADAPTED: no accessibility history exists for the functional-only publisher.
    assert.equal(fs.existsSync(path.join(pages, 'reports/master/accessibility')), false); // ADAPTED
    const latestFunctionalReport = fs.readFileSync(path.join(pages, 'reports/master/runs/31-attempt-1/index.html'), 'utf8');
    assert.doesNotMatch(latestFunctionalIndex, /30-attempt-1|Run history/);
    assert.match(latestFunctionalIndex, /href="\.\/runs\/31-attempt-1\/">Open latest Functional Odhín report/);
    assert.doesNotMatch(latestFunctionalIndex, /Open Accessibility Odhín history/);
    assert.doesNotMatch(latestFunctionalReport, /Open Accessibility Odhín history/);
    const latestFunctionalRoot = fs.readFileSync(path.join(pages, 'index.html'), 'utf8');
    assert.match(latestFunctionalRoot, /Only the current report is published on this Pages site/);
    assert.match(latestFunctionalRoot, /<a href="\.\/reports\/master\/">Open master report<\/a>/);
    assert.match(latestFunctionalRoot, /<li><a href="\.\/reports\/master\/">master<\/a>/);
    assert.ok(fs.existsSync(path.join(pages, 'reports/master/runs/31-attempt-1/presentation/report.css')));
    assert.throws(
      () => publish({ source, site: pages, branch: 'master', runId: '32', latestOnly: true }),
      /must start empty/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ADAPTED: replaces the accessibility/cross-browser cases; translation publishes the functional report type only.
test('rejects report types other than functional', () => { // ADAPTED
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-odhin-types-')); // ADAPTED
  const source = path.join(root, 'source'); // ADAPTED
  try { // ADAPTED
    createSource(source, 'functional'); // ADAPTED
    for (const reportType of ['accessibility', 'cross-browser']) { // ADAPTED
      assert.throws(() => publish({ source, site: path.join(root, reportType), branch: 'master', reportType, runId: '50' }), /Unsupported Odhín report type/); // ADAPTED
    } // ADAPTED
  } finally { // ADAPTED
    fs.rmSync(root, { recursive: true, force: true }); // ADAPTED
  } // ADAPTED
}); // ADAPTED
