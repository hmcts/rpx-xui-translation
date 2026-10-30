const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { verifyAccessibilityEvidence } = require('./verify-evidence.cjs');

function writePackage(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-a11y-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const evidence = path.join(root, 'accessibility-evidence');
  fs.mkdirSync(evidence);
  for (const language of ['en', 'cy']) {
    fs.writeFileSync(path.join(evidence, `axe-${language}.html`), `<html>${language}</html>`);
    fs.writeFileSync(path.join(evidence, `axe-${language}.json`), '{"violations":[]}');
    fs.writeFileSync(path.join(evidence, `manifest-entry-${language}.json`), JSON.stringify({
      engine: 'axe', context: { language }, status: 'passed', htmlFileName: `axe-${language}.html`, jsonFileName: `axe-${language}.json`
    }));
  }
  fs.writeFileSync(path.join(root, 'index.html'), '<button>Accessibility</button><div id="TabAccessibility"></div>');
  return { root, evidence };
}

test('accepts one EN and one CY axe record with linked evidence files', (t) => {
  const { root } = writePackage(t);
  assert.deepEqual(verifyAccessibilityEvidence(root).sort(), ['cy: passed', 'en: passed']);
});

test('rejects missing or empty manifest-linked evidence files', (t) => {
  const { root, evidence } = writePackage(t);
  fs.rmSync(path.join(evidence, 'axe-cy.html'));
  assert.throws(() => verifyAccessibilityEvidence(root), /linked htmlFileName axe-cy\.html is missing or empty/);
  fs.writeFileSync(path.join(evidence, 'axe-cy.html'), '<html>cy</html>');
  fs.writeFileSync(path.join(evidence, 'axe-en.json'), '');
  assert.throws(() => verifyAccessibilityEvidence(root), /linked jsonFileName axe-en\.json is missing or empty/);
});

test('rejects a wrong manifest count, duplicated language or missing tab', (t) => {
  const { root, evidence } = writePackage(t);
  const cyManifest = path.join(evidence, 'manifest-entry-cy.json');
  const cy = fs.readFileSync(cyManifest, 'utf8');
  fs.writeFileSync(cyManifest, cy.replace('"cy"', '"en"'));
  assert.throws(() => verifyAccessibilityEvidence(root), /exactly one EN and one CY/);
  fs.rmSync(cyManifest);
  assert.throws(() => verifyAccessibilityEvidence(root), /Expected 2 accessibility evidence manifests/);
  fs.writeFileSync(cyManifest, cy);
  fs.writeFileSync(path.join(root, 'index.html'), '<button>Accessibility</button>');
  assert.throws(() => verifyAccessibilityEvidence(root), /Accessibility evidence tab missing/);
});
