import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportEngine, ReportError } from '../src/index.js';

test('build is deterministic regardless of row object key order', () => {
  const engine = createReportEngine();
  const definition = { id: 'sales', columns: [{ id: 'name', key: 'name' }, { id: 'amount', key: 'amount' }], order: [{ column: 'name' }] };
  const a = engine.build([{ amount: 2, name: 'B' }, { name: 'A', amount: 1 }], definition);
  const b = engine.build([{ name: 'A', amount: 1 }, { amount: 2, name: 'B' }], definition);
  assert.deepEqual(a.rows, b.rows);
  assert.deepEqual(a.columns, b.columns);
});

test('filters, ordering and pagination-ready snapshots are immutable', () => {
  const engine = createReportEngine({ limits: { maxRows: 10 } });
  const snapshot = engine.build(
    [{ name: 'C', amount: 3 }, { name: 'A', amount: 1 }, { name: 'B', amount: 2 }],
    { columns: [{ id: 'name' }, { id: 'amount' }], filter: row => row.amount >= 2, order: [{ column: 'name', direction: 'asc' }] },
  );
  assert.deepEqual(snapshot.rows, [{ name: 'B', amount: 2 }, { name: 'C', amount: 3 }]);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.rows));
  assert.throws(() => { snapshot.rows[0].name = 'X'; }, TypeError);
});

test('grouping supports deterministic count and numeric aggregates', () => {
  const engine = createReportEngine();
  const snapshot = engine.build(
    [{ team: 'A', amount: 2 }, { team: 'A', amount: 4 }, { team: 'B', amount: 3 }],
    { columns: [{ id: 'team' }, { id: 'amount' }], groupBy: ['team'], aggregates: [{ column: 'amount', op: 'sum', as: 'total' }, { column: 'amount', op: 'avg', as: 'average' }, { column: 'amount', op: 'count', as: 'count' }], order: [{ column: 'team' }] },
  );
  assert.deepEqual(snapshot.rows, [
    { team: 'A', amount: 2, total: 6, average: 3, count: 2 },
    { team: 'B', amount: 3, total: 3, average: 3, count: 1 },
  ]);
});

test('JSON export is stable and bounded', () => {
  const engine = createReportEngine({ limits: { maxOutputBytes: 2048 } });
  const snapshot = engine.build([{ name: 'A', value: 1 }], { columns: [{ id: 'name' }, { id: 'value' }] });
  const text = engine.toJson(snapshot);
  assert.equal(text, JSON.stringify(snapshot));
});

test('CSV export escapes commas, quotes, newlines, and nulls deterministically', () => {
  const engine = createReportEngine();
  const snapshot = engine.build([{ name: 'A,B', note: 'x"y\nz', empty: null }], { columns: [{ id: 'name' }, { id: 'note' }, { id: 'empty' }] });
  const csv = engine.toCsv(snapshot, { nullValue: 'NULL' });
  assert.equal(csv, 'name,note,empty\r\n"A,B","x""y\nz",NULL\r\n');
});

test('async CSV streaming emits bounded chunks', async () => {
  const engine = createReportEngine();
  const snapshot = engine.build(Array.from({ length: 5 }, (_, i) => ({ id: i, value: `v${i}` })), { columns: [{ id: 'id' }, { id: 'value' }] });
  const chunks = [];
  for await (const chunk of engine.streamCsv(snapshot, { rowsPerChunk: 2 })) chunks.push(chunk);
  assert.equal(chunks.length, 3);
  assert.ok(chunks[0].includes('id,value'));
});

test('accessor definitions fail before evaluating getters', () => {
  const engine = createReportEngine();
  let evaluated = false;
  const definition = { columns: [{ id: 'name' }] };
  Object.defineProperty(definition, 'columns', { get() { evaluated = true; return [{ id: 'name' }]; }, enumerable: true });
  assert.throws(() => engine.build([{ name: 'A' }], definition), error => error instanceof ReportError && error.code === 'INVALID_DEFINITION');
  assert.equal(evaluated, false);
});

test('accessor rows fail without evaluating getters', () => {
  const engine = createReportEngine();
  let evaluated = false;
  const row = {};
  Object.defineProperty(row, 'secret', { get() { evaluated = true; return 'x'; }, enumerable: true });
  assert.throws(() => engine.build([row], { columns: [{ id: 'secret' }] }), error => error instanceof ReportError && error.code === 'INVALID_DEFINITION');
  assert.equal(evaluated, false);
});

test('bounds and malformed definitions fail closed and later valid calls recover', () => {
  const engine = createReportEngine({ limits: { maxRows: 2, maxGroups: 1 } });
  assert.throws(() => engine.build([{ a: 1 }, { a: 2 }, { a: 3 }], { columns: [{ id: 'a' }] }), error => error instanceof ReportError && error.code === 'LIMIT_EXCEEDED');
  assert.throws(() => engine.build([{ a: 1 }], { columns: [] }), error => error instanceof ReportError && error.code === 'INVALID_DEFINITION');
  const valid = engine.build([{ a: 1 }], { columns: [{ id: 'a' }] });
  assert.deepEqual(valid.rows, [{ a: 1 }]);
});

test('source rows are never mutated', () => {
  const engine = createReportEngine();
  const rows = [{ z: 2, a: 1 }];
  const before = JSON.stringify(rows);
  engine.build(rows, { columns: [{ id: 'a' }, { id: 'z' }] });
  assert.equal(JSON.stringify(rows), before);
});

test('failed export limit does not poison later valid export', () => {
  const engine = createReportEngine({ limits: { maxOutputBytes: 128 } });
  const small = engine.build([{ a: null }], { columns: [{ id: 'a' }] });
  assert.throws(() => engine.toCsv(small, { nullValue: 'X'.repeat(200) }), error => error instanceof ReportError && error.code === 'LIMIT_EXCEEDED');
  const normal = createReportEngine().toCsv(small);
  assert.ok(normal.includes('a'));
});
