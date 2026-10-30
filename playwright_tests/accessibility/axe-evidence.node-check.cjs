const assert = require('node:assert/strict');
const { test } = require('node:test');
// Node 24 strips the TypeScript types of this module natively.
const { advisoryStatus, axeFindings, axeReviewItems, buildManifestEntry, renderEvidenceHtml } = require('./axe-evidence.ts');

const incompleteOnly = {
  violations: [],
  incomplete: [{
    id: 'color-contrast',
    impact: 'serious',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    nodes: [{ target: ['#language-switch'] }, { target: ['.notice', 'span'] }]
  }]
};

test('an incomplete-only axe result is recorded as needs-review, not passed', () => {
  const evidence = { feature: 'Translation demo', pageState: 'English default', language: 'en',
    findings: axeFindings(incompleteOnly), review: axeReviewItems(incompleteOnly) };

  assert.equal(advisoryStatus(evidence), 'needs-review');
  const entry = buildManifestEntry('A1 English default state', evidence, 'axe-1.html', 'axe-1.json');
  assert.equal(entry.status, 'needs-review');
  assert.equal(entry.violationCount, 0);
  assert.equal(entry.reviewCount, 2);
  assert.deepEqual(entry.reviewRules, ['color-contrast']);
  assert.match(entry.summary, /1 incomplete check\(s\) need review/);

  const html = renderEvidenceHtml('A1 English default state', evidence);
  assert.match(html, /Outcome: needs-review/);
  assert.match(html, /<h2>Needs review<\/h2>[\s\S]*color-contrast[\s\S]*#language-switch, \.notice span/);
  assert.doesNotMatch(html, /No incomplete checks recorded/);
});

test('status precedence is findings, then needs-review, then passed', () => {
  const finding = { rule: 'region', impact: 'moderate', summary: 'All page content should be contained by landmarks', targets: ['h1'] };
  const review = axeReviewItems(incompleteOnly);
  assert.equal(advisoryStatus({ findings: [finding], review }), 'issues-found');
  assert.equal(advisoryStatus({ findings: [], review }), 'needs-review');
  assert.equal(advisoryStatus({ findings: [], review: [] }), 'passed');
});
