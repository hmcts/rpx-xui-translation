import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { packCoreFacade } from './pack-core-facade.mjs';

const source = new URL('../', import.meta.url);
const project = 'projects/rpx-xui-translation-core-facade';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'translation-facade-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(new URL(project, source), join(root, project), { recursive: true });
  cpSync(new URL('LICENCE', source), join(root, 'LICENCE'));
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']]) {
    assert.equal(spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).status, 0);
  }
  return { root, output: join(root, 'dist/preview') };
}

test('packs unchanged facade source and retains artifact/source provenance', t => {
  const options = fixture(t);
  const result = packCoreFacade(options);
  assert.match(result.sourceSha, /^[a-f0-9]{40}$/);
  assert.equal(result.dirty, false);
  assert.equal(result.sha256, hash(readFileSync(result.tarball)));
  assert.deepEqual(Object.keys(result.inputs).sort(), ['LICENCE', 'index.d.ts', 'index.mjs', 'package.json']);
  for (const [file, digest] of Object.entries(result.inputs)) assert.equal(digest, hash(readFileSync(join(options.root, project, file))));
  assert.deepEqual(JSON.parse(readFileSync(join(options.output, 'provenance.json'), 'utf8')), result);
  assert.throws(() => packCoreFacade(options), /exist/i);
});

test('records a dirty counterpart checkout honestly', t => {
  const options = fixture(t);
  writeFileSync(join(options.root, 'uncommitted-note'), 'synthetic');
  assert.equal(packCoreFacade(options).dirty, true);
});

for (const [name, mutate] of [
  ['nonprivate package', p => { p.private = false; }],
  ['production version', p => { p.version = '1.2.18'; }],
  ['wrong package name', p => { p.name = 'another-package'; }],
  ['runtime dependency', p => { p.dependencies = { dexie: '4.4.7' }; }],
  ['different Core peer', p => { p.peerDependencies['@hmcts/rpx-xui-core-lib'] = '^0.0.0'; }],
  ['noncanonical runtime entry', p => { p.exports['.'].default = './another.mjs'; }],
]) {
  test(`rejects ${name} before creating package output`, t => {
    const options = fixture(t), path = join(options.root, project, 'package.json');
    const p = JSON.parse(readFileSync(path, 'utf8')); mutate(p); writeFileSync(path, JSON.stringify(p));
    assert.throws(() => packCoreFacade(options), /manifest/);
    assert.equal(existsSync(options.output), false);
  });
}
for (const file of ['index.mjs', 'index.d.ts', 'LICENCE']) {
  test(`rejects altered ${file} before packing`, t => {
    const options = fixture(t);
    writeFileSync(join(options.root, project, file), 'noncanonical content\n');
    assert.throws(() => packCoreFacade(options), /canonical|licence/);
    assert.equal(existsSync(options.output), false);
  });
}

test('rejects an undeclared source file before packing', t => {
  const options = fixture(t);
  writeFileSync(join(options.root, project, 'extra.js'), 'synthetic');
  assert.throws(() => packCoreFacade(options), /four declared files/);
  assert.equal(existsSync(options.output), false);
});

test('rejects a symlinked input before packing', t => {
  const options = fixture(t), file = join(options.root, project, 'LICENCE');
  rmSync(file); symlinkSync(join(options.root, 'LICENCE'), file);
  assert.throws(() => packCoreFacade(options), /regular files/);
  assert.equal(existsSync(options.output), false);
});

for (const timing of ['before', 'after']) {
  test(`rejects source mutation ${timing} npm packs the artifact`, t => {
    const options = fixture(t), bin = join(options.root, 'bin');
    mkdirSync(bin);
    const target = join(options.root, project, 'index.mjs');
    const npm = join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
    const mutate = `writeFileSync(${JSON.stringify(target)}, 'export const changed = true;\\n');`;
    writeFileSync(join(bin, 'npm'), `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';\n${timing === 'before' ? mutate : ''}\nconst result=spawnSync(process.execPath,[${JSON.stringify(npm)},...process.argv.slice(2)],{stdio:'inherit'});\n${timing === 'after' ? mutate : ''}\nprocess.exitCode=result.status??1;\n`, { mode: 0o755 });
    const previous = process.env.PATH;
    t.after(() => { process.env.PATH = previous; });
    process.env.PATH = `${bin}:${previous}`;
    assert.throws(() => packCoreFacade(options), timing === 'before' ? /Packed index.mjs differs from source/ : /input changed while packing/);
    assert.equal(existsSync(join(options.output, 'provenance.json')), false);
  });
}
