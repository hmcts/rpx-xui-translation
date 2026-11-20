import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const files = ['LICENCE', 'index.d.ts', 'index.mjs', 'package.json'];
const forwarding = "export * from '@hmcts/rpx-xui-core-lib/i18n';\n";
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, timeout: 60_000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr ?? result.error?.message ?? ''}`);
  return result.stdout;
}

export function packCoreFacade({ root = repository, output = 'dist/core-facade' } = {}) {
  assert.equal(process.versions.node, '24.22.2', 'Use pinned Node 24.22.2');
  const npm = resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
  assert.ok(existsSync(npm) && lstatSync(npm).isFile(), 'Pinned Node installation must include its npm CLI');
  const project = join(root, 'projects/rpx-xui-translation-core-facade');
  assert.deepEqual(readdirSync(project).sort(), files, 'Facade must contain only its four declared files');
  for (const file of files) assert.ok(lstatSync(join(project, file)).isFile(), 'Facade inputs must be regular files');
  const inputs = () => Object.fromEntries(files.map(file => [file, hash(readFileSync(join(project, file)))]));
  const before = inputs();
  const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  assert.deepEqual(manifest, {
    name: 'rpx-xui-translation', version: '0.0.0-core-preview.0', private: true, type: 'module', license: 'MIT',
    exports: { '.': { types: './index.d.ts', default: './index.mjs' } }, files: ['index.mjs', 'index.d.ts', 'LICENCE'],
    peerDependencies: { '@hmcts/rpx-xui-core-lib': '0.0.0' },
  }, 'Facade manifest must retain private preview identity, canonical entries and exact Core ownership');
  for (const file of ['index.mjs', 'index.d.ts']) assert.equal(readFileSync(join(project, file), 'utf8'), forwarding, 'Facade entries must be canonical pure reexports');
  const repositoryLicenceSha256 = hash(readFileSync(join(root, 'LICENCE')));
  assert.equal(before.LICENCE, repositoryLicenceSha256, 'Facade licence must match the repository licence');
  const sourceSha = run('/usr/bin/git', ['rev-parse', 'HEAD'], root).toString().trim();
  const dirty = run('/usr/bin/git', ['status', '--porcelain', '--untracked-files=all'], root).length > 0;
  output = resolve(root, output);
  assert.ok(!output.startsWith(`${project}/`), 'Generated output must be outside facade source');
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', project, '--offline', '--ignore-scripts', '--json', '--pack-destination', output, '--cache', join(output, 'npm-cache')], root).toString());
  assert.equal(packed.length, 1, 'Exactly one facade archive is required');
  assert.equal(packed[0].filename, 'rpx-xui-translation-0.0.0-core-preview.0.tgz');
  const tarball = join(output, packed[0].filename);
  assert.deepEqual(run('/usr/bin/tar', ['-tzf', tarball], root).toString().trim().split('\n').sort(), files.map(file => `package/${file}`), 'Packed files must exactly match declared inputs');
  for (const file of files) assert.equal(hash(run('/usr/bin/tar', ['-xOf', tarball, `package/${file}`], root)), before[file], `Packed ${file} differs from source`);
  assert.deepEqual(inputs(), before, 'Facade input changed while packing');
  assert.equal(hash(readFileSync(join(root, 'LICENCE'))), repositoryLicenceSha256, 'Repository licence changed while packing');
  const provenance = { schemaVersion: 1, sourceSha, dirty, inputs: before, inputSha256: hash(JSON.stringify(before)), repositoryLicenceSha256, tarball, sha256: hash(readFileSync(tarball)), evidence: join(output, 'provenance.json') };
  writeFileSync(provenance.evidence, `${JSON.stringify(provenance, null, 2)}\n`);
  return provenance;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(packCoreFacade({ output: process.argv[2] }), null, 2));
}
