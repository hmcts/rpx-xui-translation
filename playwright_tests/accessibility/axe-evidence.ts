import type { TestInfo } from '@playwright/test';
import type { AxeResults } from 'axe-core';
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
  findings: AdvisoryFinding[];
  axe?: AxeResults;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char] ?? char);
}

export function axeFindings(results: AxeResults): AdvisoryFinding[] {
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? 'unknown',
    summary: violation.help,
    targets: violation.nodes.map((node) => node.target.join(' '))
  }));
}

function renderHtml(testTitle: string, evidence: AdvisoryEvidence): string {
  const rows = evidence.findings
    .map((finding) => `<tr><td>${escapeHtml(finding.rule)}</td><td>${escapeHtml(finding.impact)}</td><td>${escapeHtml(finding.summary)}</td><td>${escapeHtml(finding.targets.join(', '))}</td></tr>`)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(testTitle)}</title></head>
<body><main><h1>${escapeHtml(testTitle)}</h1>
<p>Advisory evidence: findings are reported, not enforced. State: ${escapeHtml(evidence.pageState)} (${escapeHtml(evidence.language)}).</p>
<table><thead><tr><th>Rule</th><th>Impact</th><th>Summary</th><th>Targets</th></tr></thead>
<tbody>${rows || '<tr><td colspan="4">No findings recorded.</td></tr>'}</tbody></table>
</main></body></html>
`;
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
  writeFileSync(join(evidenceFolder, htmlFileName), renderHtml(testInfo.title, evidence));
  writeFileSync(join(evidenceFolder, `manifest-entry-${key}.json`), JSON.stringify({
    engine: 'axe',
    testTitle: testInfo.title,
    feature: evidence.feature,
    pageState: evidence.pageState,
    context: { language: evidence.language },
    htmlFileName,
    jsonFileName,
    violationCount: evidence.findings.length,
    status: evidence.findings.length ? 'issues-found' : 'passed',
    summary: evidence.findings.length ? `${evidence.findings.length} advisory finding(s)` : 'No findings recorded',
    rules: evidence.findings.map((finding) => finding.rule),
    targets: evidence.findings.flatMap((finding) => finding.targets),
    findings: evidence.findings.map(({ rule, targets, summary }) => ({ rule, targets, summary }))
  }));
}
