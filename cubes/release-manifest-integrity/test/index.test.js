import test from 'node:test';
import assert from 'node:assert/strict';
import { createManifest, verifyManifest, serializeManifest, parseManifest, ManifestIntegrityError } from '../src/index.js';

test('manifest ordering is deterministic and immutable', () => {
  const manifest = createManifest([{ path: 'b.txt', content: 'B' }, { path: 'a.txt', content: 'A' }]);
  assert.deepEqual(manifest.entries.map((e) => e.path), ['a.txt', 'b.txt']);
  assert(Object.isFrozen(manifest));
  assert(Object.isFrozen(manifest.entries));
});

test('digest and byte counts are exact', () => {
  const manifest = createManifest([{ path: 'hello.txt', content: 'hello' }]);
  assert.equal(manifest.entries[0].bytes, 5);
  assert.equal(manifest.entries[0].sha256, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});

test('serialize and parse preserve canonical manifest', () => {
  const manifest = createManifest([{ path: 'x', content: '1' }]);
  assert.deepEqual(parseManifest(serializeManifest(manifest)), manifest);
});

test('verification reports missing, extra, and mismatched entries deterministically', () => {
  const manifest = createManifest([{ path: 'a', content: 'A' }, { path: 'b', content: 'B' }]);
  const report = verifyManifest(manifest, [{ path: 'a', content: 'X' }, { path: 'c', content: 'C' }]);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['b']);
  assert.deepEqual(report.extra, ['c']);
  assert.deepEqual(report.mismatched.map((x) => x.path), ['a']);
});

test('unsafe paths, duplicates, accessors, and malformed manifests fail closed', () => {
  assert.throws(() => createManifest([{ path: '../x', content: '' }]), (e) => e instanceof ManifestIntegrityError && e.code === 'INVALID_PATH');
  assert.throws(() => createManifest([{ path: 'x', content: '' }, { path: 'x', content: '' }]), /Duplicate path/);
  let touched = false;
  const entry = {};
  Object.defineProperty(entry, 'path', { get() { touched = true; return 'x'; } });
  assert.throws(() => createManifest([entry]), /accessor/);
  assert.equal(touched, false);
  assert.throws(() => parseManifest('{bad'), /Malformed JSON/);
});

test('bounds fail closed and later valid calls recover', () => {
  assert.throws(() => createManifest([{ path: 'x', content: '12345' }], { limits: { maxContentBytes: 2 } }), /exceeds limit/);
  assert.equal(createManifest([{ path: 'x', content: '1' }]).entries.length, 1);
});
