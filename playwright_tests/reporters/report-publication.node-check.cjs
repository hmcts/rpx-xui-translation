// Vendored from hmcts/rpx-xui-common-lib@b27d3cd20a9ed08cf2ba7fdf50926c59d4250393 e2e/reporters/report-publication.node-check.cjs; local edits marked ADAPTED
// ADAPTED: functional artifact discovery, F5 (tested merge provenance) and F6 (identical re-publish skips the empty archive commit).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { Script } = require('node:vm');

const workflows = path.join(__dirname, '../../.github/workflows');
const functionalWorkflow = fs.readFileSync(path.join(workflows, 'npmpublish.yml'), 'utf8');
const accessibilityWorkflow = fs.readFileSync(path.join(workflows, 'accessibility-odhin.yml'), 'utf8');
const crossBrowserWorkflow = fs.readFileSync(path.join(workflows, 'cross-browser-odhin.yml'), 'utf8');
const publisherWorkflow = fs.readFileSync(path.join(workflows, 'publish-odhin.yml'), 'utf8');

function jobBlock(workflow, name) {
  return workflow.split(/(?=^  [\w-]+:\r?$)/m).find((block) => block.startsWith(`  ${name}:`));
}

function foldedCondition(job) {
  const folded = job?.match(/^    if: >-\r?\n((?:      .*\r?\n)+)/m)?.[1].trim();
  assert(folded?.startsWith('${{') && folded.endsWith('}}'), 'Expected a folded GitHub expression');
  return folded.slice(3, -2).trim();
}

const publisherJob = jobBlock(publisherWorkflow, 'publish-odhin');
const functionalBuildJob = jobBlock(functionalWorkflow, 'build');
const publisherCondition = new Script(`(${foldedCondition(publisherJob)})`);

test('Odhín source jobs are read-only and upload exact evidence only', () => {
  assert.match(functionalWorkflow, /^permissions:\r?\n  contents: read/m);
  assert.match(accessibilityWorkflow, /^permissions:\r?\n  contents: read/m);
  assert.match(crossBrowserWorkflow, /^permissions:\r?\n  contents: read/m);
  assert.doesNotMatch(functionalBuildJob, /contents: write|pages: write|id-token: write/);
  assert.doesNotMatch(accessibilityWorkflow, /contents: write|pages: write|id-token: write/);
  assert.doesNotMatch(crossBrowserWorkflow, /contents: write|pages: write|id-token: write/);
  assert.doesNotMatch(functionalWorkflow, /  publish-odhin:|workflow_call/);
  assert.doesNotMatch(accessibilityWorkflow, /publish-odhin|workflow_call/);
  assert.doesNotMatch(crossBrowserWorkflow, /publish-odhin|workflow_call/);

  assert.match(functionalWorkflow, /name: translation-functional-report\r?\n/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(functionalWorkflow, /name: translation-playwright-evidence\r?\n/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(functionalBuildJob, /yarn playwright install --with-deps chromium\r?\n/);
  assert.ok(
    functionalBuildJob.indexOf('Install Playwright browsers') < functionalBuildJob.indexOf('yarn test:reporters'), // ADAPTED: translation names/paths
    'browser-backed Odhín checks must run after Chromium is installed'
  );
  assert.doesNotMatch(functionalBuildJob, /yarn playwright install --with-deps chromium firefox webkit/);
  assert.match(functionalBuildJob, /yarn playwright test --project=chromium/);
  assert.doesNotMatch(functionalWorkflow, /outputs:|evidence_url|odhin_artifact_ready|odhin_prepare/);

  assert.match(accessibilityWorkflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(accessibilityWorkflow, /^  (pull_request|push):/m);
  assert.match(accessibilityWorkflow, /ref:\r?\n\s+description: Branch, tag, or commit SHA to test/);
  assert.match(accessibilityWorkflow, /ref: \$\{\{ inputs\.ref \}\}/);
  // ADAPTED: the lean axe advisory (D20) runs yarn test:a11y and the shared Odhín browser check.
  for (const command of ['yarn test:a11y', 'yarn test:e2e:odhin-check']) { // ADAPTED
    assert.match(accessibilityWorkflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); // ADAPTED
  } // ADAPTED
  assert.match(accessibilityWorkflow, /PW_ODHIN_OUTPUT: test-results\/odhin\/accessibility/); // ADAPTED
  assert.doesNotMatch(functionalBuildJob, /test:a11y|smoke-firefox|smoke-webkit/); // ADAPTED: advisory packs stay out of default CI
  assert.match(accessibilityWorkflow, /name: translation-accessibility-report\r?\n/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(accessibilityWorkflow, /set -euo pipefail\r?\n\s+node playwright_tests\/accessibility\/verify-evidence\.cjs test-results\/odhin\/accessibility\r?\n\s+rm -rf accessibility-odhin-artifact/); // ADAPTED: packaging first verifies one EN and one CY axe record, their linked files and the Accessibility tab
  assert.match(accessibilityWorkflow, /odhin-source\.json/);
  assert.match(accessibilityWorkflow, /path: accessibility-odhin-artifact\//);

  assert.match(crossBrowserWorkflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(crossBrowserWorkflow, /^  (pull_request|push):/m);
  assert.match(crossBrowserWorkflow, /ref:\r?\n\s+description: Branch, tag, or commit SHA to test/);
  assert.match(crossBrowserWorkflow, /ref: \$\{\{ inputs\.ref \}\}/);
  assert.match(crossBrowserWorkflow, /fetch-depth: 0/);
  assert.match(crossBrowserWorkflow, /persist-credentials: false/);
  assert.match(crossBrowserWorkflow, /yarn playwright install --with-deps chromium firefox webkit/);
  assert.match(crossBrowserWorkflow, /yarn playwright test --project=smoke-firefox --project=smoke-webkit/); // ADAPTED: translation names/paths
  assert.doesNotMatch(crossBrowserWorkflow, /yarn playwright test --project=chromium/);
  assert.match(crossBrowserWorkflow, /name: translation-cross-browser-report\r?\n/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(crossBrowserWorkflow, /name: translation-cross-browser-evidence\r?\n/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(crossBrowserWorkflow, /odhin-source\.json/);
  assert.match(crossBrowserWorkflow, /path: cross-browser-odhin-artifact\//);
  assert.match(crossBrowserWorkflow, /TARGET_SHA="\$\(git rev-parse HEAD\)"/);
  assert.match(crossBrowserWorkflow, /steps\.cross_browser\.outcome == 'success' \|\| steps\.cross_browser\.outcome == 'failure'/);
  assert.match(crossBrowserWorkflow, /steps\.odhin_browser\.outcome == 'success'/);
});

test('publisher is a trusted workflow_run with a validated manual recovery path and scoped write permissions', () => {
  assert.match(publisherWorkflow, /^  workflow_run:/m);
  assert.match(publisherWorkflow, /^  workflow_dispatch:\r?\n    inputs:\r?\n      source_run_id:/m);
  assert.match(publisherWorkflow, /workflows:\r?\n      - Node\.js Package\r?\n      - Translation accessibility \(advisory\)\r?\n      - Translation cross-browser \(advisory\)/); // ADAPTED: translation names/paths
  assert.match(publisherWorkflow, /types:\r?\n      - completed/);
  assert.doesNotMatch(publisherWorkflow, /workflow_call/);
  assert.match(publisherWorkflow, /^permissions:\r?\n  contents: read/m);
  assert.match(publisherJob, /actions: read/);
  assert.match(publisherJob, /contents: write/);
  assert.match(publisherJob, /pages: write/);
  assert.match(publisherJob, /id-token: write/);

  const checkout = publisherJob.match(/- uses: actions\/checkout@v7[\s\S]*?(?=      - uses: actions\/setup-node@v7)/)?.[0] ?? '';
  assert.match(checkout, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(checkout, /persist-credentials: false/);
  assert.doesNotMatch(checkout, /pull_request|head_ref/);

  const resolver = publisherJob.match(/- name: Resolve and validate exact source run[\s\S]*?(?=      - name: Check exact upstream report)/)?.[0] ?? '';
  assert.match(resolver, /SOURCE_RUN_ID: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.source_run_id \|\| github\.event\.workflow_run\.id \}\}/);
  assert.match(resolver, /actions\/runs\/\$SOURCE_RUN_ID/);
  assert.match(resolver, /run\.head_repository\?\.full_name !== process\.env\.GITHUB_REPOSITORY/);
  assert.match(resolver, /Unsupported Odhín source workflow/);
  assert.match(resolver, /\["success", "failure"\]\.includes\(run\.conclusion\)/);
  assert.match(resolver, /"translation-functional-report"/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(resolver, /"translation-accessibility-report"/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
  assert.match(resolver, /"translation-cross-browser-report"/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)

  const download = publisherJob.match(/- name: Download exact upstream report[\s\S]*?(?=      - name: Prepare)/)?.[0] ?? '';
  assert.match(download, /name: \$\{\{ steps\.source\.outputs\.artifact_name \}\}/);
  assert.match(download, /repository: \$\{\{ github\.repository \}\}/);
  assert.match(download, /run-id: \$\{\{ steps\.source\.outputs\.source_run_id \}\}/);
  assert.match(download, /github-token: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(download, /continue-on-error:\s*true/);
  assert.match(publisherJob, /- name: Check exact upstream report is available/);
  assert.match(publisherJob, /No publishable `%s` artifact was produced/);
  for (const stepName of [
    'Download exact upstream report',
    'Prepare and persist immutable Odhín history',
    'Configure GitHub Pages',
    'Upload Odhín site',
    'Publish Odhín report',
    'Link report in Actions'
  ]) {
    const step = publisherJob.match(new RegExp(`- name: ${stepName}[\\s\\S]*?(?=      - name:|$)`))?.[0] ?? '';
    assert.match(step, /if: \$\{\{ steps\.upstream_report\.outputs\.available == 'true' \}\}/, `${stepName} must be skipped without exact evidence`);
  }
  assert.ok(publisherJob.indexOf('Download exact upstream report') < publisherJob.indexOf('Prepare and persist immutable Odhín history'));

  assert.match(publisherJob, /ODHIN_BRANCH: \$\{\{ steps\.source\.outputs\.source_branch \}\}/);
  assert.match(publisherJob, /ODHIN_SHA: \$\{\{ steps\.source\.outputs\.source_sha \}\}/);
  assert.match(publisherJob, /ODHIN_RUN_KEY: \$\{\{ steps\.source\.outputs\.source_run_id \}\}-attempt-\$\{\{ steps\.source\.outputs\.source_run_attempt \}\}/);
  assert.match(publisherJob, /ODHIN_SOURCE_RUN_ID: \$\{\{ steps\.source\.outputs\.source_run_id \}\}/);
  assert.match(publisherJob, /ODHIN_SOURCE_RUN_ATTEMPT: \$\{\{ steps\.source\.outputs\.source_run_attempt \}\}/);
  assert.match(publisherJob, /ODHIN_RUN_URL: \$\{\{ steps\.source\.outputs\.source_url \}\}/);
  assert.match(publisherJob, /UPSTREAM_URL: \$\{\{ steps\.source\.outputs\.source_url \}\}/);
  assert.match(publisherJob, /--run-id "\$ODHIN_SOURCE_RUN_ID"/);
  assert.match(publisherJob, /--run-attempt "\$ODHIN_SOURCE_RUN_ATTEMPT"/);
  assert.match(publisherJob, /--report-type "\$ODHIN_REPORT_TYPE"/);
  assert.match(publisherJob, /evidence\/odhin-source\.json/);
  // ADAPTED (F5): odhin-source.json is required for every report type; upstream reads it for advisory reports only.
  assert.doesNotMatch(publisherJob, /if \[ "\$ODHIN_REPORT_TYPE" != 'functional' \]; then/); // ADAPTED
  assert.match(publisherJob, /^          test -s evidence\/odhin-source\.json$/m); // ADAPTED
  assert.match(publisherJob, /if git -C odhin-site diff --cached --quiet; then[\s\S]*?else\r?\n\s+git -C odhin-site commit[^\n]*\r?\n\s+git [^\n]*push origin HEAD:odhin-reports\r?\n\s+fi/); // ADAPTED (F6): identical recovery re-publish skips the empty commit
  assert.match(publisherJob, /"translation-cross-browser-report"/); // ADAPTED: translation names/paths; anchored (upstream is unanchored)
});

test('Pages publication uses a fresh latest-only site instead of copying the archive', () => {
  assert.match(publisherJob, /--site pages-site/);
  assert.match(publisherJob, /--latest-only true/);
  assert.doesNotMatch(publisherJob, /cp -R odhin-site\/\. pages-site/);

  const pagesInvocation = publisherJob.match(
    /^[ \t]+node playwright_tests\/reporters\/odhin-site-publisher\.cjs \\\r?\n(?:(?:[ \t]+--[^\r\n]+)\\\r?\n)*[ \t]+--site pages-site \\\r?\n(?:(?:[ \t]+--[^\r\n]+)\\\r?\n)*[ \t]+--latest-only true >\/dev\/null$/m // ADAPTED: translation names/paths
  )?.[0] ?? '';
  assert.match(pagesInvocation, /--report-type "\$ODHIN_REPORT_TYPE"/);
});

test('Actions summary links use the current Pages report, immutable archive, and triggering workflow', () => {
  const linkStep = publisherJob.match(
    /^      - name: Link report in Actions\r?\n[\s\S]*?(?=^      - (?:name|uses):|^  [\w-]+:|(?![\s\S]))/m
  )?.[0] ?? '';

  assert.match(linkStep, /pages_url="\$\{PAGES_URL%\/\}"/);
  assert.match(linkStep, /PAGES_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(linkStep, /RUN_PATH: \$\{\{ steps\.publish_report\.outputs\.run_url_path \}\}/);
  assert.match(linkStep, /UPSTREAM_URL: \$\{\{ steps\.source\.outputs\.source_url \}\}/);
  assert.match(linkStep, /printf [^\n]*\[Open current public report\]\(%s\/%s\)[^\n]*"\$pages_url" "\$RUN_PATH" >> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(linkStep, /printf [^\n]*\[Open immutable report archive\]\(%s\/%s\)[^\n]*"\$GITHUB_SERVER_URL\/\$GITHUB_REPOSITORY\/tree\/odhin-reports" "\$RUN_PATH" >> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(linkStep, /printf [^\n]*\[Open the triggering workflow evidence\]\(%s\)[^\n]*"\$UPSTREAM_URL" >> "\$GITHUB_STEP_SUMMARY"/);
});

const cases = [
  { name: 'same-repository PR success publishes', workflow: 'Node.js Package', event: 'pull_request', conclusion: 'success', want: true },
  { name: 'same-repository PR failure publishes its valid report', workflow: 'Node.js Package', event: 'pull_request', conclusion: 'failure', want: true },
  { name: 'same-repository PR cancellation does not publish', workflow: 'Node.js Package', event: 'pull_request', conclusion: 'cancelled', want: false },
  { name: 'master push success publishes', workflow: 'Node.js Package', event: 'push', branch: 'master', conclusion: 'success', want: true },
  { name: 'Release push success publishes', workflow: 'Node.js Package', event: 'push', branch: 'Release', conclusion: 'success', want: true },
  { name: 'feature push does not publish', workflow: 'Node.js Package', event: 'push', branch: 'test/private', conclusion: 'success', want: false },
  { name: 'foreign repository PR never publishes', workflow: 'Node.js Package', event: 'pull_request', conclusion: 'success', sourceRepo: 'outside/fork', want: false },
  { name: 'manual dispatch of the functional workflow cannot bypass its trigger policy', workflow: 'Node.js Package', event: 'workflow_dispatch', want: false },
  { name: 'manual accessibility success publishes', workflow: 'Translation accessibility (advisory)', event: 'workflow_dispatch', conclusion: 'success', workflowBranch: 'master', want: true }, // ADAPTED: translation names/paths
  { name: 'manual accessibility failure does not publish', workflow: 'Translation accessibility (advisory)', event: 'workflow_dispatch', conclusion: 'failure', workflowBranch: 'master', want: false }, // ADAPTED: translation names/paths
  { name: 'manual accessibility from a feature workflow does not publish', workflow: 'Translation accessibility (advisory)', event: 'workflow_dispatch', conclusion: 'success', workflowBranch: 'test/untrusted', want: false }, // ADAPTED: translation names/paths
  { name: 'accessibility push cannot publish', workflow: 'Translation accessibility (advisory)', event: 'push', conclusion: 'success', want: false }, // ADAPTED: translation names/paths
  { name: 'manual cross-browser success publishes', workflow: 'Translation cross-browser (advisory)', event: 'workflow_dispatch', conclusion: 'success', workflowBranch: 'master', want: true }, // ADAPTED: translation names/paths
  { name: 'manual cross-browser failure publishes its valid report', workflow: 'Translation cross-browser (advisory)', event: 'workflow_dispatch', conclusion: 'failure', workflowBranch: 'master', want: true }, // ADAPTED: translation names/paths
  { name: 'manual cross-browser cancellation does not publish', workflow: 'Translation cross-browser (advisory)', event: 'workflow_dispatch', conclusion: 'cancelled', workflowBranch: 'master', want: false }, // ADAPTED: translation names/paths
  { name: 'manual cross-browser from a feature workflow does not publish', workflow: 'Translation cross-browser (advisory)', event: 'workflow_dispatch', conclusion: 'success', workflowBranch: 'test/untrusted', want: false }, // ADAPTED: translation names/paths
  { name: 'cross-browser push cannot publish', workflow: 'Translation cross-browser (advisory)', event: 'push', conclusion: 'success', want: false }, // ADAPTED: translation names/paths
  { name: 'unrelated workflow cannot publish', workflow: 'anything else', event: 'workflow_dispatch', conclusion: 'success', want: false },
  { name: 'manual publisher enters the validated recovery path from master', eventName: 'workflow_dispatch', refName: 'master', want: true },
  { name: 'manual publisher cannot execute a feature branch', eventName: 'workflow_dispatch', refName: 'test/untrusted', want: false },
];

for (const scenario of cases) {
  test(scenario.name, () => {
    const context = {
      github: {
        repository: 'hmcts/rpx-xui-translation', // ADAPTED: translation names/paths
        event_name: scenario.eventName,
        ref_name: scenario.refName,
        event: {
          workflow_run: {
            name: scenario.workflow,
            event: scenario.event,
            conclusion: scenario.conclusion,
            head_branch: scenario.workflowBranch ?? scenario.branch ?? 'feature/example',
            head_repository: { full_name: scenario.sourceRepo ?? 'hmcts/rpx-xui-translation' }, // ADAPTED: translation names/paths
          },
          repository: { default_branch: 'master' },
        },
      },
    };
    assert.equal(publisherCondition.runInNewContext(context), scenario.want);
  });
}

// ADAPTED (F5): provenance of the functional report. Runs the real workflow scripts against a pull-request merge checkout.
const { execFileSync } = require('node:child_process'); // ADAPTED
const os = require('node:os'); // ADAPTED

function stepRunScript(workflow, stepName) { // ADAPTED
  const lines = workflow.split(/\r?\n/); // ADAPTED
  const start = lines.findIndex((line) => line.trim() === `- name: ${stepName}`); // ADAPTED
  assert.ok(start >= 0, `missing step ${stepName}`); // ADAPTED
  const runLine = lines.findIndex((line, index) => index > start && /^\s+run: \|$/.test(line)); // ADAPTED
  const indent = lines[runLine].indexOf('run:') + 2; // ADAPTED
  const body = []; // ADAPTED
  for (const line of lines.slice(runLine + 1)) { // ADAPTED
    if (line.trim() && line.length - line.trimStart().length < indent) break; // ADAPTED
    body.push(line.slice(indent)); // ADAPTED
  } // ADAPTED
  return body.join('\n'); // ADAPTED
} // ADAPTED

test('functional summary links uploaded artifacts before separate Pages publication', (t) => { // ADAPTED
  const summary = functionalBuildJob.match(/- name: Link functional report in Actions[\s\S]*/)?.[0] ?? ''; // ADAPTED
  assert.ok(summary, 'missing functional artifact summary'); // ADAPTED
  assert.match(functionalBuildJob, /- name: Upload Playwright evidence\r?\n        id: evidence_artifact/); // ADAPTED
  assert.match(functionalBuildJob, /- name: Upload functional report\r?\n        id: functional_artifact\r?\n        if: \$\{\{ !cancelled\(\) && steps\.odhin_browser\.outcome == 'success' \}\}/); // ADAPTED
  assert.ok(functionalBuildJob.indexOf('- name: Upload Playwright evidence') < functionalBuildJob.indexOf('- name: Link functional report in Actions')); // ADAPTED
  assert.ok(functionalBuildJob.indexOf('- name: Upload functional report') < functionalBuildJob.indexOf('- name: Link functional report in Actions')); // ADAPTED
  assert.match(summary, /REPORT_ARTIFACT_URL: \$\{\{ steps\.functional_artifact\.outputs\.artifact-url \}\}/); // ADAPTED
  assert.match(summary, /EVIDENCE_ARTIFACT_URL: \$\{\{ steps\.evidence_artifact\.outputs\.artifact-url \}\}/); // ADAPTED
  const condition = new Script(`(${summary.match(/if: \$\{\{ (.*) \}\}/)?.[1]})`); // ADAPTED
  for (const scenario of [ // ADAPTED
    { functional: 'success', upload: 'success', cancelled: false, want: true }, // ADAPTED
    { functional: 'failure', upload: 'success', cancelled: false, want: true }, // ADAPTED
    { functional: 'success', upload: 'failure', cancelled: false, want: false }, // ADAPTED
    { functional: 'failure', upload: 'skipped', cancelled: false, want: false }, // ADAPTED
    { functional: 'success', upload: 'success', cancelled: true, want: false }, // ADAPTED
  ]) { // ADAPTED
    assert.equal(condition.runInNewContext({ // ADAPTED
      cancelled: () => scenario.cancelled, // ADAPTED
      steps: { functional: { outcome: scenario.functional }, functional_artifact: { outcome: scenario.upload } }, // ADAPTED
    }), scenario.want, JSON.stringify(scenario)); // ADAPTED
  } // ADAPTED
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-odhin-summary-')); // ADAPTED
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); // ADAPTED
  const summaryPath = path.join(root, 'summary.md'); // ADAPTED
  const reportUrl = 'https://github.example.test/hmcts/rpx-xui-translation/actions/runs/123/artifacts/456'; // ADAPTED
  const script = stepRunScript(functionalWorkflow, 'Link functional report in Actions'); // ADAPTED
  for (const evidenceUrl of ['https://github.example.test/hmcts/rpx-xui-translation/actions/runs/123/artifacts/789', '']) { // ADAPTED
    fs.writeFileSync(summaryPath, 'Existing summary\n'); // ADAPTED
    execFileSync('bash', ['-c', script], { cwd: root, env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, REPORT_ARTIFACT_URL: reportUrl, EVIDENCE_ARTIFACT_URL: evidenceUrl } }); // ADAPTED
    const rendered = fs.readFileSync(summaryPath, 'utf8'); // ADAPTED
    assert.ok(rendered.startsWith('Existing summary\n')); // ADAPTED
    assert.ok(rendered.includes(`[Download browser-verified Odhín report](${reportUrl})`)); // ADAPTED
    assert.match(rendered, /Extract the whole ZIP, then open `translation-playwright\.html`/); // ADAPTED
    assert.match(rendered, /GitHub Pages publication runs separately/); // ADAPTED
    assert.match(rendered, /workflow is merged to `master`/); // ADAPTED
    if (evidenceUrl) assert.ok(rendered.includes(`[Download Playwright evidence](${evidenceUrl})`)); // ADAPTED
    else assert.doesNotMatch(rendered, /\[Download Playwright evidence\]/); // ADAPTED
    assert.doesNotMatch(rendered, /\]\(\)/); // ADAPTED
  } // ADAPTED
}); // ADAPTED

test('functional report provenance is the tested merge checkout, not the PR head', (t) => { // ADAPTED
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-odhin-provenance-')); // ADAPTED
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); // ADAPTED
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=probe', '-c', 'user.email=probe@example.invalid', ...args], { encoding: 'utf8' }).trim(); // ADAPTED
  git('init', '-q', '-b', 'master'); // ADAPTED
  git('commit', '-q', '--allow-empty', '-m', 'base'); // ADAPTED
  const baseSha = git('rev-parse', 'HEAD'); // ADAPTED
  git('checkout', '-q', '-b', 'feature/pr'); // ADAPTED
  git('commit', '-q', '--allow-empty', '-m', 'pr head'); // ADAPTED
  const headSha = git('rev-parse', 'HEAD'); // ADAPTED
  git('checkout', '-q', 'master'); // ADAPTED
  git('commit', '-q', '--allow-empty', '-m', 'master moved'); // ADAPTED
  git('merge', '-q', '--no-ff', '--no-edit', 'feature/pr'); // ADAPTED
  const mergeSha = git('rev-parse', 'HEAD'); // ADAPTED
  assert.notEqual(mergeSha, headSha); // ADAPTED
  fs.mkdirSync(path.join(root, 'test-results', 'odhin'), { recursive: true }); // ADAPTED

  const record = stepRunScript(functionalWorkflow, 'Record tested revision for the functional report'); // ADAPTED
  execFileSync('bash', ['-c', record], { cwd: root, env: { ...process.env, SOURCE_BRANCH: 'feature/pr', PR_HEAD_SHA: headSha, PR_BASE_SHA: baseSha, GITHUB_RUN_ID: '900001', GITHUB_RUN_ATTEMPT: '2' } }); // ADAPTED
  const source = JSON.parse(fs.readFileSync(path.join(root, 'test-results', 'odhin', 'odhin-source.json'), 'utf8')); // ADAPTED
  assert.deepEqual(source, { rawBranch: 'feature/pr', sha: mergeSha, headSha, baseSha, runId: '900001', runAttempt: '2' }); // ADAPTED

  // ADAPTED: the publisher's identity block, with the API head SHA as its starting value.
  const prepare = stepRunScript(publisherWorkflow, 'Prepare and persist immutable Odhín history'); // ADAPTED
  const identity = prepare.slice(0, prepare.indexOf('report_repo_url=')); // ADAPTED
  fs.mkdirSync(path.join(root, 'evidence')); // ADAPTED
  fs.copyFileSync(path.join(root, 'test-results', 'odhin', 'odhin-source.json'), path.join(root, 'evidence', 'odhin-source.json')); // ADAPTED
  const published = execFileSync('bash', ['-c', `${identity}\nprintf '%s %s' "$ODHIN_BRANCH" "$ODHIN_SHA"`], { cwd: root, encoding: 'utf8', // ADAPTED
    env: { ...process.env, ODHIN_REPORT_TYPE: 'functional', ODHIN_BRANCH: 'feature/pr', ODHIN_SHA: headSha, ODHIN_SOURCE_RUN_ID: '900001', ODHIN_SOURCE_RUN_ATTEMPT: '2' } }); // ADAPTED
  assert.equal(published, `feature/pr ${mergeSha}`); // ADAPTED
  assert.equal(fs.existsSync(path.join(root, 'evidence', 'odhin-source.json')), false, 'identity file is not published'); // ADAPTED
}); // ADAPTED

// ADAPTED: execute source identity and attempt checks, including stale artifacts and automatic-event races.
const { spawnSync } = require('node:child_process');

for (const [workflow, stepName, artifact] of [
  [functionalWorkflow, 'Record tested revision for the functional report', 'test-results/odhin'],
  [accessibilityWorkflow, 'Package exact accessibility report and target identity', 'accessibility-odhin-artifact'],
  [crossBrowserWorkflow, 'Package exact cross-browser report and target identity', 'cross-browser-odhin-artifact'],
]) {
  test(`${artifact} manifest binds the tested revision to its source attempt`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-source-attempt-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, artifact), { recursive: true });
    const script = stepRunScript(workflow, stepName).match(/node <<'NODE'\n([\s\S]*?)\nNODE/)[1];
    execFileSync(process.execPath, ['-e', script], { cwd: root, env: { ...process.env,
      TARGET_SHA: 'a'.repeat(40), TARGET_REF: 'refs/heads/test/provenance', SOURCE_BRANCH: 'test/provenance',
      PR_HEAD_SHA: 'b'.repeat(40), GITHUB_RUN_ID: '900001', GITHUB_RUN_ATTEMPT: '2',
    } });
    const source = JSON.parse(fs.readFileSync(path.join(root, artifact, 'odhin-source.json'), 'utf8'));
    assert.equal(source.runId, '900001');
    assert.equal(source.runAttempt, '2');
    assert.equal(source.rawBranch, 'test/provenance');
    assert.equal(source.sha, 'a'.repeat(40));
  });
}

test('source resolver freezes manual identity and rejects a newer attempt than the automatic event', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-resolve-attempt-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runPath = path.join(root, 'run.json');
  const output = path.join(root, 'output');
  const run = { id: 900001, run_attempt: 2, name: 'Node.js Package', head_branch: 'test/provenance',
    head_sha: 'a'.repeat(40), conclusion: 'failure', head_repository: { full_name: 'hmcts/rpx-xui-translation' } };
  fs.writeFileSync(runPath, JSON.stringify(run));
  const script = `gh() { cat "$RUN_FIXTURE"; }\n${stepRunScript(publisherWorkflow, 'Resolve and validate exact source run')}`;
  for (const [event, attempt, accepted] of [['workflow_run', '1', false], ['workflow_run', '2', true], ['workflow_dispatch', '', true]]) {
    fs.writeFileSync(output, '');
    const child = spawnSync('bash', ['-c', script], { cwd: root, encoding: 'utf8', env: { ...process.env,
      GITHUB_EVENT_NAME: event, SOURCE_RUN_ATTEMPT: attempt, SOURCE_RUN_ID: '900001', RUN_FIXTURE: runPath,
      GITHUB_REPOSITORY: 'hmcts/rpx-xui-translation', GITHUB_SERVER_URL: 'https://github.example.test', GITHUB_OUTPUT: output,
    } });
    assert.equal(child.status, accepted ? 0 : 1, `${event} attempt ${attempt}: ${child.stderr}`);
    if (accepted) {
      assert.match(fs.readFileSync(output, 'utf8'), /source_run_attempt=2\n/);
      assert.match(fs.readFileSync(output, 'utf8'), /actions\/runs\/900001\/attempts\/2/);
    } else {
      assert.match(child.stderr, /attempt/i);
      assert.equal(fs.readFileSync(output, 'utf8'), '');
    }
  }
  assert.match(publisherWorkflow, /SOURCE_RUN_ATTEMPT: \$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.run_attempt \|\| '' \}\}/);
});

test('publisher rejects stale or unbound artifacts before any archive or Pages writes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-validate-attempt-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'evidence'));
  const file = path.join(root, 'evidence/odhin-source.json');
  const prepare = stepRunScript(publisherWorkflow, 'Prepare and persist immutable Odhín history');
  const identity = prepare.slice(0, prepare.indexOf('report_repo_url='));
  for (const [label, fields, accepted] of [
    ['matching', { runId: '900001', runAttempt: '2' }, true],
    ['attempt-1 artifact after attempt-2 setup failure', { runId: '900001', runAttempt: '1' }, false],
    ['wrong run', { runId: '900002', runAttempt: '2' }, false],
    ['legacy manifest', {}, false],
    ['numeric identity', { runId: 900001, runAttempt: 2 }, false],
    ['malformed identity', { runId: '900001', runAttempt: '02' }, false],
  ]) {
    fs.writeFileSync(file, JSON.stringify({ rawBranch: 'test/provenance', sha: 'a'.repeat(40), ...fields }));
    const child = spawnSync('bash', ['-c', `${identity}\nprintf 'publication reached: %s %s' "$ODHIN_BRANCH" "$ODHIN_SHA"`], {
      cwd: root, encoding: 'utf8', env: { ...process.env, ODHIN_SOURCE_RUN_ID: '900001', ODHIN_SOURCE_RUN_ATTEMPT: '2' },
    });
    assert.equal(child.status, accepted ? 0 : 1, `${label}: ${child.stderr}`);
    if (accepted) assert.equal(child.stdout, `publication reached: test/provenance ${'a'.repeat(40)}`);
    else {
      assert.match(child.stderr, /source.*(identity|attempt)/i, label);
      assert.doesNotMatch(child.stdout, /publication reached/);
      assert.equal(fs.existsSync(file), true, 'rejected provenance stays available for diagnosis');
    }
    assert.equal(fs.existsSync(path.join(root, 'odhin-site')), false);
    assert.equal(fs.existsSync(path.join(root, 'pages-site')), false);
  }
  fs.writeFileSync(file, '{broken');
  assert.throws(() => execFileSync('bash', ['-c', identity], { cwd: root, stdio: 'pipe' }));
});
