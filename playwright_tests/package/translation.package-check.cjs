const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { after, before, test } = require('node:test');

const repo = path.resolve(__dirname, '../..');
let consumer;

function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

before(() => {
  const dist = path.join(repo, 'dist/rpx-xui-translation');
  assert.ok(fs.existsSync(path.join(dist, 'package.json')), 'Run yarn build:library before yarn test:package');
  fs.mkdirSync(path.join(repo, 'tmp'), { recursive: true });
  consumer = fs.mkdtempSync(path.join(repo, 'tmp/translation-package-'));
  const packed = JSON.parse(run('npm', ['pack', dist, '--ignore-scripts', '--json', '--pack-destination', consumer], repo));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, 'rpx-xui-translation');
  const installed = path.join(consumer, 'node_modules/rpx-xui-translation');
  fs.mkdirSync(installed, { recursive: true });
  run('tar', ['-xzf', path.join(consumer, packed[0].filename), '-C', installed, '--strip-components=1']);
  // Reuse the library's locked runtime dependencies; Angular peers resolve from the repository.
  fs.symlinkSync(path.join(repo, 'projects/rpx-xui-translation/node_modules'), path.join(installed, 'node_modules'), 'dir');
});

after(() => {
  if (consumer) fs.rmSync(consumer, { recursive: true, force: true });
});

test('packed public exports configure one translation service across root and child consumers', () => {
  fs.writeFileSync(path.join(consumer, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import '@angular/compiler';
import { createEnvironmentInjector, importProvidersFrom } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as translation from 'rpx-xui-translation';

assert.deepEqual(Object.keys(translation).sort(), [
  'RpxTranslatePipe', 'RpxTranslationConfig', 'RpxTranslationModule', 'RpxTranslationService', 'YesOrNoValue'
]);
const { RpxTranslationConfig, RpxTranslationModule, RpxTranslationService, YesOrNoValue } = translation;
assert.equal(new RpxTranslationConfig().debounceTimeMs, 300);
assert.equal(new RpxTranslationConfig().testMode, false);
assert.deepEqual(YesOrNoValue, { YES: 'Yes', NO: 'No' });
globalThis.document = { cookie: '' };
const config = { baseUrl: '/translations', debounceTimeMs: 20, validity: { days: 1 }, testMode: false };
const transport = { post() { throw new Error('English must not request a translation'); } };
const root = createEnvironmentInjector([
  importProvidersFrom(RpxTranslationModule.forRoot(config)),
  { provide: HttpClient, useValue: transport }
]);
const child = createEnvironmentInjector([
  importProvidersFrom(RpxTranslationModule.forChild()),
  { provide: HttpClient, useValue: transport }
], root);
try {
  const service = root.get(RpxTranslationService);
  assert.ok(service instanceof RpxTranslationService);
  assert.equal(root.get(RpxTranslationConfig), config);
  assert.equal(child.get(RpxTranslationConfig), config);
  assert.equal(child.get(RpxTranslationService), service);
  assert.equal(service.language, 'en');
  assert.equal(await firstValueFrom(child.get(RpxTranslationService).getTranslation$('  Packed English phrase  ')), 'Packed English phrase');
  assert.equal(document.cookie, 'exui-preferred-language=en; SameSite=Strict;');
} finally {
  child.destroy();
  root.destroy();
}
`);
  run(process.execPath, ['consumer.mjs']);
});

test('packed declarations compile a strict consumer of the public API', () => {
  fs.writeFileSync(path.join(consumer, 'consumer.mts'), `
import type { ModuleWithProviders } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  RpxTranslationConfig, RpxTranslationModule, RpxTranslationService, RpxTranslatePipe, YesOrNoValue,
  type RpxLanguage, type Replacements
} from 'rpx-xui-translation';

const config: RpxTranslationConfig = { baseUrl: '/translations', debounceTimeMs: 20, validity: { days: 1 }, testMode: false };
const language: RpxLanguage = 'cy';
const replacements: Replacements = { NUMBER: '1234' };
const root: ModuleWithProviders<RpxTranslationModule> = RpxTranslationModule.forRoot(config);
const child: ModuleWithProviders<RpxTranslationModule> = RpxTranslationModule.forChild();
export function consume(service: RpxTranslationService, pipe: RpxTranslatePipe): Observable<string> {
  service.language = language;
  const rendered: string | null = pipe.transform('Question', null, YesOrNoValue.YES);
  void [root, child, rendered];
  return service.getTranslationWithReplacements$('Case %NUMBER%', replacements);
}
`);
  run(process.execPath, [
    require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'nodenext',
    '--moduleResolution', 'nodenext', '--target', 'es2022', '--lib', 'es2022,dom',
    '--types', 'node', 'consumer.mts'
  ]);
});
