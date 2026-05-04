import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const libraryPackagePath = path.join(repoRoot, 'projects', 'rpx-xui-translation', 'package.json');
const distPackagePath = path.join(repoRoot, 'dist', 'rpx-xui-translation', 'package.json');

const libraryPackage = readJson(libraryPackagePath);
const distPackage = readJson(distPackagePath);

distPackage.dependencies = sortDependencies(libraryPackage.dependencies || {});
distPackage.peerDependencies = sortDependencies(libraryPackage.peerDependencies || {});

writeJson(distPackagePath, distPackage);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sortDependencies(dependencies) {
  return Object.keys(dependencies)
    .sort()
    .reduce((sortedDependencies, dependencyName) => {
      sortedDependencies[dependencyName] = dependencies[dependencyName];
      return sortedDependencies;
    }, {});
}
