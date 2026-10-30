/*
 * Verifies the accessibility advisory package before upload: exactly one English and one Welsh axe record,
 * every manifest-linked JSON/HTML file present and non-empty, and the Accessibility tab in the Odhín index.
 * Usage: node playwright_tests/accessibility/verify-evidence.cjs <odhin accessibility folder>
 */
const fs = require('node:fs');
const path = require('node:path');

const expectedLanguages = ['cy', 'en'];

function nonEmptyFile(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0;
}

function verifyAccessibilityEvidence(reportFolder) {
  const evidenceFolder = path.join(reportFolder, 'accessibility-evidence');
  const manifestNames = fs.existsSync(evidenceFolder)
    ? fs.readdirSync(evidenceFolder).filter((name) => /^manifest-entry-.+\.json$/.test(name)).sort()
    : [];
  if (manifestNames.length !== expectedLanguages.length) {
    throw new Error(`Expected ${expectedLanguages.length} accessibility evidence manifests (EN, CY), found ${manifestNames.length}`);
  }

  const entries = manifestNames.map((name) => ({ name, entry: JSON.parse(fs.readFileSync(path.join(evidenceFolder, name), 'utf8')) }));
  const languages = entries.map(({ entry }) => entry?.context?.language).sort();
  if (JSON.stringify(languages) !== JSON.stringify(expectedLanguages)) {
    throw new Error(`Expected exactly one EN and one CY axe record, found languages ${JSON.stringify(languages)}`);
  }

  for (const { name, entry } of entries) {
    if (entry.engine !== 'axe') {
      throw new Error(`${name}: expected an axe record, found engine ${JSON.stringify(entry.engine)}`);
    }
    for (const field of ['htmlFileName', 'jsonFileName']) {
      const linked = entry[field];
      if (typeof linked !== 'string' || !linked || linked !== path.basename(linked)) {
        throw new Error(`${name}: ${field} must name a file inside accessibility-evidence, got ${JSON.stringify(linked)}`);
      }
      if (!nonEmptyFile(path.join(evidenceFolder, linked))) {
        throw new Error(`${name}: linked ${field} ${linked} is missing or empty`);
      }
    }
  }

  const index = path.join(reportFolder, 'index.html');
  if (!nonEmptyFile(index) || !fs.readFileSync(index, 'utf8').includes('id="TabAccessibility"')) {
    throw new Error('Accessibility evidence tab missing from the Odhín report');
  }
  return entries.map(({ entry }) => `${entry.context.language}: ${entry.status}`);
}

if (require.main === module) {
  try {
    const summary = verifyAccessibilityEvidence(process.argv[2] ?? 'test-results/odhin/accessibility');
    console.log(`Accessibility evidence verified (${summary.join('; ')})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { verifyAccessibilityEvidence };
