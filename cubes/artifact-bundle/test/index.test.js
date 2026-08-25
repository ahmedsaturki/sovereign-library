import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBundle, parseBundle, verifyBundle, extractBundle, ArtifactBundleError } from '../src/index.js';

test('bundle bytes are deterministic regardless of input order', () => {
  const a = createBundle([{ path: 'b.txt', bytes: new Uint8Array([2]) }, { path: 'a.txt', bytes: new Uint8Array([1]) }], { metadata: { z: 2, a: 1 } });
  const b = createBundle([{ path: 'a.txt', bytes: new Uint8Array([1]) }, { path: 'b.txt', bytes: new Uint8Array([2]) }], { metadata: { a: 1, z: 2 } });
  assert.deepEqual([...a.bytes], [...b.bytes]);
});

test('parse and verify round-trip is immutable and integrity-safe', () => {
  const bundle = createBundle([{ path: 'hello.txt', bytes: new TextEncoder().encode('hello') }]);
  const parsed = parseBundle(bundle.bytes);
  assert.equal(parsed.entries[0].path, 'hello.txt');
  assert.equal(parsed.entries[0].data, Buffer.from('hello').toString('base64'));
  assert.equal(verifyBundle(bundle.bytes).ok, true);
  assert.throws(() => { parsed.entries.push({}); }, TypeError);
});

test('unsafe paths, duplicates, accessors and malformed bundles fail closed', () => {
  assert.throws(() => createBundle([{ path: '../x', bytes: new Uint8Array([1]) }]), ArtifactBundleError);
  assert.throws(() => createBundle([{ path: 'x', bytes: new Uint8Array([1]) }, { path: 'x', bytes: new Uint8Array([2]) }]), /Duplicate path/);
  const accessor = {};
  Object.defineProperty(accessor, 'path', { enumerable: true, get() { throw new Error('getter'); } });
  assert.throws(() => createBundle([accessor]), /accessor/);
  assert.throws(() => parseBundle('not-a-bundle'), /header/);
  const malformed = createBundle([{ path: 'x', bytes: new Uint8Array([1]) }]).bytes.toString().replace('AQ==', 'Ag==');
  assert.throws(() => parseBundle(malformed), /INTEGRITY_MISMATCH/);
});

test('extraction is safe, exact, and idempotent for identical existing files', async () => {
  const bundle = createBundle([{ path: 'dir/file.txt', bytes: Buffer.from('exact') }]);
  const target = await mkdtemp(path.join(tmpdir(), 'bundle-'));
  const result = await extractBundle(bundle.bytes, target);
  assert.equal(result.entries, 1);
  assert.equal(await readFile(path.join(target, 'dir', 'file.txt'), 'utf8'), 'exact');
  const repeat = await extractBundle(bundle.bytes, target);
  assert.equal(repeat.entries, 1);
  await writeFile(path.join(target, 'dir', 'file.txt'), 'tampered');
  await assert.rejects(() => extractBundle(bundle.bytes, target), /Existing file differs/);
});

test('bounds fail closed and later valid input recovers', () => {
  assert.throws(() => createBundle([{ path: 'x', bytes: new Uint8Array(8) }], { limits: { maxEntryBytes: 2 } }), /Entry exceeds/);
  const valid = createBundle([{ path: 'x', bytes: new Uint8Array([1]) }]);
  assert.equal(verifyBundle(valid.bytes).ok, true);
});
