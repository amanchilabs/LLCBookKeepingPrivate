import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { glob, globSync, globStream } from 'glob';
import { Minimatch } from 'minimatch';
import { createFingerprintAsync } from '@expo/fingerprint';

// Exercise the public APIs used by Expo before retaining scoped advisory fixes.
const fixture = await mkdtemp(join(tmpdir(), 'llc-toolchain-'));
try {
  await mkdir(join(fixture, 'src'));
  await writeFile(join(fixture, 'src/entry.ts'), 'export {};');
  await writeFile(join(fixture, 'src/ignored.test.ts'), 'export {};');
  const options = { cwd: fixture, ignore: ['**/*.test.ts'] };
  assert.deepEqual(await glob('src/**/*.ts', options), ['src/entry.ts']);
  assert.deepEqual(globSync('src/**/*.ts', options), ['src/entry.ts']);
  const streamed = [];
  for await (const file of globStream('src/**/*.ts', options)) streamed.push(file);
  assert.deepEqual(streamed, ['src/entry.ts']);
  const require = createRequire(import.meta.url);
  assert.deepEqual(require('glob').sync('src/**/*.ts', options), ['src/entry.ts']);
  const matcher = new Minimatch('!**/*.test.ts');
  assert.equal(matcher.negate, true);
  assert.equal(matcher.pattern, '**/*.test.ts');
  assert.equal(matcher.match('src/entry.ts'), true);
  assert.equal(matcher.match('src/ignored.test.ts'), false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(glob('**/*', { cwd: fixture, signal: controller.signal }), { name: 'AbortError' });
} finally {
  await rm(fixture, { recursive: true, force: true });
}
const fingerprint = await createFingerprintAsync(process.cwd(), {
  platforms: ['ios', 'android'], ignorePaths: ['ios/**', 'android/**'],
});
assert.match(fingerprint.hash, /^[0-9a-f]+$/);
assert.ok(fingerprint.sources.length > 0);
console.log(`PASS: Expo glob/matcher APIs, abort handling, and fingerprint (${fingerprint.sources.length} sources).`);
