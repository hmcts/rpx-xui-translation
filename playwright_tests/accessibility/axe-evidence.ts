import type { TestInfo } from '@playwright/test';
import type { AxeResults, Result } from 'axe-core';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Default Odhín folder of the accessibility advisory run (playwright.accessibility.config.ts). */
export const accessibilityOdhinFolder = 'test-results/odhin/accessibility';

export type AdvisoryFinding = {
  rule: string;
  impact: string;
  summary: string;
  targets: string[];
};

export type AdvisoryEvidence = {
  feature: string;
  pageState: string;
  language: string;
  /** Confirmed findings (axe violations plus local advisory checks). */
  findings: AdvisoryFinding[];
  /** Checks axe could not complete (axe `incomplete`): they need investigation and are not passes. */
  review: AdvisoryFinding[];
  axe?: AxeResults;
};

export type AdvisoryStatus = 'issues-found' | 'needs-review' | 'passed';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char] ?? char);
}

function toAdvisoryFinding(result: Result): AdvisoryFinding {
  return {
    rule: result.id,
    impact: result.impact ?? 'unknown',
    summary: result.help,
    targets: result.nodes.map((node) => node.target.join(' '))
  };
}

export function axeFindings(results: Pick<AxeResults, 'violations'>): AdvisoryFinding[] {
  return results.violations.map(toAdvisoryFinding);
}

export function axeReviewItems(results: Pick<AxeResults, 'incomplete'>): AdvisoryFinding[] {
  return results.incomplete.map(toAdvisoryFinding);
}

/** Same precedence as common-lib's accessibility audit: findings, then needs-review, then passed. */
export function advisoryStatus(evidence: Pick<AdvisoryEvidence, 'findings' | 'review'>): AdvisoryStatus {
  if (evidence.findings.length) {
    return 'issues-found';
  }
  return evidence.review.length ? 'needs-review' : 'passed';
}

function renderRows(items: AdvisoryFinding[], emptyText: string): string {
  const rows = items
    .map((item) => `<tr><td>${escapeHtml(item.rule)}</td><td>${escapeHtml(item.impact)}</td><td>${escapeHtml(item.summary)}</td><td>${escapeHtml(item.targets.join(', '))}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Rule</th><th>Impact</th><th>Summary</th><th>Targets</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4">${emptyText}</td></tr>`}</tbody></table>`;
}

export function renderEvidenceHtml(testTitle: string, evidence: AdvisoryEvidence): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(testTitle)}</title></head>
<body><main><h1>${escapeHtml(testTitle)}</h1>
<p>Advisory evidence: findings are reported, not enforced. State: ${escapeHtml(evidence.pageState)} (${escapeHtml(evidence.language)}). Outcome: ${advisoryStatus(evidence)}.</p>
<h2>Findings</h2>
${renderRows(evidence.findings, 'No confirmed findings recorded.')}
<h2>Needs review</h2>
<p>Checks the scanner could not complete. Investigate them; they are not passes.</p>
${renderRows(evidence.review, 'No incomplete checks recorded.')}
</main></body></html>
`;
}

/** Manifest entry read by the vendored WebApp Accessibility workspace (field names as in common-lib accessibilityAudit.ts). */
export function buildManifestEntry(testTitle: string, evidence: AdvisoryEvidence, htmlFileName: string, jsonFileName: string) {
  const status = advisoryStatus(evidence);
  const reviewCount = evidence.review.reduce((sum, item) => sum + item.targets.length, 0); // incomplete node results, as in common-lib
  return {
    engine: 'axe',
    testTitle,
    feature: evidence.feature,
    pageState: evidence.pageState,
    context: { language: evidence.language },
    htmlFileName,
    jsonFileName,
    violationCount: evidence.findings.length,
    reviewCount,
    reviewRules: evidence.review.map((item) => item.rule),
    status,
    summary: {
      'issues-found': `${evidence.findings.length} advisory finding(s)`,
      'needs-review': `${evidence.review.length} incomplete check(s) need review`,
      passed: 'No findings or incomplete checks recorded'
    }[status],
    rules: evidence.findings.map((finding) => finding.rule),
    targets: evidence.findings.flatMap((finding) => finding.targets),
    findings: evidence.findings.map(({ rule, targets, summary }) => ({ rule, targets, summary }))
  };
}

/**
 * Attaches the evidence to the Playwright result and writes it beside the Odhín report, where the
 * vendored enhancer reads `accessibility-evidence/manifest-entry-*.json`. Findings never fail the test.
 */
export async function recordAdvisoryEvidence(testInfo: TestInfo, evidence: AdvisoryEvidence): Promise<void> {
  const json = JSON.stringify(evidence, null, 2);
  await testInfo.attach('accessibility-advisory.json', { body: json, contentType: 'application/json' });

  const evidenceFolder = join(process.env.PW_ODHIN_OUTPUT ?? accessibilityOdhinFolder, 'accessibility-evidence');
  const key = createHash('sha256').update(`${testInfo.testId}:${testInfo.retry}`).digest('hex').slice(0, 16);
  const htmlFileName = `axe-${key}.html`;
  const jsonFileName = `axe-${key}.json`;
  mkdirSync(evidenceFolder, { recursive: true });
  writeFileSync(join(evidenceFolder, jsonFileName), json);
  writeFileSync(join(evidenceFolder, htmlFileName), renderEvidenceHtml(testInfo.title, evidence));
  writeFileSync(join(evidenceFolder, `manifest-entry-${key}.json`), JSON.stringify(buildManifestEntry(testInfo.title, evidence, htmlFileName, jsonFileName)));
}
