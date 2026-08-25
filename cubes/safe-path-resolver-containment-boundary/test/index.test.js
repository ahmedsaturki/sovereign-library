import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SafePathResolverError,
  canonicalizePath,
  comparePaths,
  isContained,
  normalizePath,
  parseReport,
  resolveContained,
  resolvePath,
  serializeReport,
} from '../src/index.js';

const expectCode = (fn, code) => assert.throws(fn, (error) => error instanceof SafePathResolverError && error.code === code);
const expectRejectCode = (fn, code) => assert.rejects(fn, (error) => error instanceof SafePathResolverError && error.code === code);

test('lexical normalization is deterministic and root aware', () => {
  assert.equal(normalizePath('/a/b/../c'), '/a/c');
  assert.equal(normalizePath('a/./b'), 'a/b');
  assert.equal(normalizePath('C:\\work\\app'), 'C:/work/app');
  assert.equal(normalizePath('//server/share/app'), '//server/share/app');
  assert.equal(normalizePath('//?/C:/work/app'), '//?/C:/work/app');
});

test('drive-relative paths are rejected and absolute roots cannot traverse upward', () => {
  expectCode(() => normalizePath('C:foo'), 'ROOT_MISMATCH');
  expectCode(() => normalizePath('/a/../../x'), 'TRAVERSAL_ESCAPE');
  expectCode(() => resolvePath('/root', '../outside'), 'TRAVERSAL_ESCAPE');
});

test('relative paths require explicit absolute base', () => {
  assert.equal(resolvePath('/root', 'a/b'), '/root/a/b');
  assert.equal(resolvePath('C:/root', 'a/b'), 'C:/root/a/b');
  expectCode(() => resolvePath('relative-root', 'a'), 'MISSING_BASE');
});

test('segment containment is not string-prefix containment', () => {
  assert.deepEqual(isContained('/root/app/file.txt', '/root/app'), {
    format: 'SPR1', status: 'contained', path: '/root/app/file.txt', root: '/root/app', reason: 'segment-contained'
  });
  assert.equal(isContained('/root/application', '/root/app').status, 'outside');
  assert.equal(isContained('C:/root/a', 'D:/root').reason, 'root-mismatch');
});

test('resolveContained blocks traversal and sibling-prefix escapes', () => {
  assert.equal(resolveContained('/root/app', 'safe/file.txt'), '/root/app/safe/file.txt');
  expectCode(() => resolveContained('/root/app', '../outside'), 'TRAVERSAL_ESCAPE');
  expectCode(() => resolveContained('/root/app', '/root/application/file.txt'), 'TRAVERSAL_ESCAPE');
});

test('case comparison is explicit and host independent', () => {
  assert.notEqual(comparePaths('/Root/File', '/root/file'), 0);
  assert.equal(comparePaths('/Root/File', '/root/file', { caseMode: 'insensitive' }), 0);
});

test('UNC and namespace roots remain distinct by identity', () => {
  assert.equal(isContained('//server/share/a', '//server/share').status, 'contained');
  assert.equal(isContained('//server/other/a', '//server/share').reason, 'root-mismatch');
  assert.equal(isContained('//?/C:/a', '//?/C:').status, 'contained');
  assert.equal(isContained('//?/D:/a', '//?/C:').reason, 'root-mismatch');
});

test('capability seams are executable hooks, not plain configuration data', async () => {
  const caps = Object.freeze({
    realpath: async (value) => value.replace('/logical', '/real'),
    lstat: async () => ({ isSymbolicLink: false }),
  });
  const result = await canonicalizePath('/logical/file.txt', '/logical', caps, { symlinkPolicy: 'follow-contained' });
  assert.equal(result.status, 'contained');
  const options = {};
  Object.defineProperty(options, 'caseMode', { get() { throw new Error('getter must not execute'); }, enumerable: true });
  await expectRejectCode(() => canonicalizePath('/logical/file', '/logical', caps, options), 'ACCESSOR_INPUT');
});

test('filesystem-aware canonicalization rejects canonical escape', async () => {
  const caps = {
    realpath: async (value) => value.endsWith('/root') ? '/srv/root' : '/srv/outside/file',
  };
  await expectRejectCode(() => canonicalizePath('/root/file', '/root', caps, { symlinkPolicy: 'follow-contained' }), 'SYMLINK_ESCAPE');
});

test('reject-symlink policy is explicit and recovers after rejection', async () => {
  const caps = {
    realpath: async (value) => value,
    lstat: async () => ({ isSymbolicLink: true }),
  };
  await expectRejectCode(() => canonicalizePath('/root/link', '/root', caps, { symlinkPolicy: 'reject-symlink' }), 'SYMLINK_REJECTED');
  const valid = await canonicalizePath('/root/file', '/root', { realpath: async value => value, lstat: async () => ({ isSymbolicLink: false }) }, { symlinkPolicy: 'reject-symlink' });
  assert.equal(valid.status, 'contained');
});

test('serialization round-trips and caller input remains untouched', () => {
  const report = isContained('/root/app/file', '/root/app');
  const serialized = serializeReport(report);
  const parsed = parseReport(serialized);
  assert.deepEqual(parsed, report);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(JSON.stringify(report), JSON.stringify(isContained('/root/app/file', '/root/app')));
});

test('malformed, oversized, circular, and accessor inputs fail closed', () => {
  expectCode(() => normalizePath(''), 'INVALID_PATH');
  expectCode(() => normalizePath('a'.repeat(32769)), 'LIMIT_EXCEEDED');
  const circular = {}; circular.self = circular;
  expectCode(() => isContained('/a', circular), 'CAPABILITY_RESULT_INVALID');
  expectCode(() => parseReport('{bad'), 'MALFORMED_SERIALIZATION');
});

test('default lexical mode requires no filesystem access', () => {
  assert.deepEqual(isContained('/root/a', '/root'), {
    format: 'SPR1', status: 'contained', path: '/root/a', root: '/root', reason: 'segment-contained'
  });
});
