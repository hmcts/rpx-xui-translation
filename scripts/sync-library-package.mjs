import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const rootPackagePath = path.join(repoRoot, 'package.json');
const libraryPackagePath = path.join(repoRoot, 'projects', 'rpx-xui-translation', 'package.json');
const distPackagePath = path.join(repoRoot, 'dist', 'rpx-xui-translation', 'package.json');

const rootPackage = readJson(rootPackagePath);
const libraryPackage = readJson(libraryPackagePath);
const distPackage = readJson(distPackagePath);

const distDependencies = distPackage.dependencies || {};
const rootDependencies = rootPackage.dependencies || {};
const peerDependencies = libraryPackage.peerDependencies || {};

const mergedDependencies = { ...distDependencies };

for (const [dependencyName, version] of Object.entries(rootDependencies)) {
  if (peerDependencies[dependencyName]) {
    continue;
  }

  mergedDependencies[dependencyName] = version;
}

distPackage.dependencies = Object.keys(mergedDependencies)
  .sort()
  .reduce((dependencies, dependencyName) => {
    dependencies[dependencyName] = mergedDependencies[dependencyName];
    return dependencies;
  }, {});

writeJson(distPackagePath, distPackage);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
