import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_OPERATIONS,
  DiffPatchError,
  applyPatch,
  createDiffEngine,
  diff,
} from '../src/index.js';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

test('diff is deterministic and patch reproduces the target', () => {
  const before = { z: 1, nested: { b: true, a: 'old' }, list: [1, 2, 3] };
  const after = { nested: { a: 'new', c: null }, list: [1, 9], added: 'yes' };
  const operations = diff(before, after);
  assert.deepEqual(operations, [
    { op: 'remove', path: '/z' },
    { op: 'add', path: '/added', value: 'yes' },
    { op: 'replace', path: '/list/1', value: 9 },
    { op: 'remove', path: '/list/2' },
    { op: 'remove', path: '/nested/b' },
    { op: 'replace', path: '/nested/a', value: 'new' },
    { op: 'add', path: '/nested/c', value: null },
  ]);
  assert.deepEqual(applyPatch(before, operations), after);
  assert.deepEqual(diff(before, after), diff(before, after));
});

test('root replacement works without mutating source', () => {
  const source = { a: 1 };
  const operations = diff(source, [1, 2]);
  const result = applyPatch(source, operations);
  assert.deepEqual(result, [1, 2]);
  assert.deepEqual(source, { a: 1 });
  assert.notStrictEqual(result, source);
});

test('JSON pointer escaping handles slash and tilde keys', () => {
  const before = { 'a/b': 1, 'x~y': 2 };
  const after = { 'a/b': 3, 'x~y': 4 };
  const operations = diff(before, after);
  assert.deepEqual(operations.map((item) => item.path), ['/a~1b', '/x~0y']);
  assert.deepEqual(applyPatch(before, operations), after);
});

test('arrays support nested replacement, add, and trailing removal', () => {
  const before = { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] };
  const after = { rows: [{ id: 1 }, { id: 4 }, { id: 5 }, { id: 6 }] };
  const operations = diff(before, after);
  assert.deepEqual(applyPatch(before, operations), after);
});

test('diff and patch outputs are deeply immutable', () => {
  const operations = diff({ a: { b: 1 } }, { a: { b: 2 } });
  assert.ok(Object.isFrozen(operations));
  assert.ok(Object.isFrozen(operations[0]));
  assert.ok(Object.isFrozen(operations[0].value));
  const result = applyPatch({ a: { b: 1 } }, operations);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.a));
  deepFreeze(operations);
});

test('source and operation inputs remain unchanged', () => {
  const source = { nested: { value: 1 } };
  const operations = [{ op: 'replace', path: '/nested/value', value: 2 }];
  const originalOperations = structuredClone(operations);
  const result = applyPatch(source, operations);
  assert.deepEqual(source, { nested: { value: 1 } });
  assert.deepEqual(operations, originalOperations);
  assert.deepEqual(result, { nested: { value: 2 } });
});

test('invalid paths, duplicate paths, and conflicting adds fail closed', () => {
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'replace', path: 'a', value: 2 }]), (error) => error instanceof DiffPatchError && error.code === 'INVALID_PATH');
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'replace', path: '/a', value: 2 }, { op: 'replace', path: '/a', value: 3 }]), (error) => error.code === 'CONFLICTING_OPERATION');
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'add', path: '/a', value: 2 }]), (error) => error.code === 'CONFLICTING_OPERATION');
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'remove', path: '/missing' }]), (error) => error.code === 'PATH_NOT_FOUND');
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'add', path: '', value: 2 }]), (error) => error.code === 'INVALID_OPERATION');
});

test('unsupported values and circular references fail closed', () => {
  assert.throws(() => diff({ value: Infinity }, { value: 1 }), (error) => error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => diff({ date: new Date() }, { date: 'x' }), (error) => error.code === 'UNSUPPORTED_OBJECT');
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => diff(cycle, {}), (error) => error.code === 'CIRCULAR_REFERENCE');
});

test('bounds are deterministic', () => {
  const engine = createDiffEngine({ maxOperations: 1, maxDepth: 2, maxNodes: 10, maxStringBytes: 4, maxValueBytes: 100 });
  assert.equal(DEFAULT_MAX_OPERATIONS, 10000);
  assert.throws(() => engine.diff({ a: 1, b: 2 }, { a: 2, b: 3 }), (error) => error.code === 'OPERATION_LIMIT');
  assert.throws(() => engine.diff({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }), (error) => error.code === 'DEPTH_LIMIT');
  assert.throws(() => engine.diff({ a: '12345' }, { a: '1' }), (error) => error.code === 'STRING_LIMIT');
});

test('error diagnostics do not copy arbitrary values', () => {
  const secret = 'TOP-SECRET-VALUE';
  try { diff({ secret }, { secret: 'x' }); assert.fail('expected no error'); } catch (error) { assert.equal(error.message.includes(secret), false); }
  assert.throws(() => applyPatch({ a: 1 }, [{ op: 'replace', path: '/missing', value: secret }]), (error) => error.code === 'PATH_NOT_FOUND');
});

test('operation value is validated and cloned before application', () => {
  const value = { nested: { ok: true } };
  const operations = [{ op: 'add', path: '/new', value }];
  const result = applyPatch({}, operations);
  value.nested.ok = false;
  assert.equal(result.new.nested.ok, true);
});
