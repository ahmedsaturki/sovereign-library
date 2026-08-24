import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySink, Logger, LoggerCubeError, ConsoleSink } from '../src/index.js';

const clock = { wallNow: () => '2026-01-01T00:00:00.000Z', monoNow: () => 123.5 };

test('minimum level filters lower records', () => {
  const sink = new InMemorySink();
  const logger = new Logger({ minLevel: 'warn', sinks: [sink], clock });
  assert.equal(logger.info('ignored'), null);
  const record = logger.warn('kept');
  assert.equal(record.level, 'warn');
  assert.equal(sink.snapshot().length, 1);
});

test('record shape and child context are deterministic', () => {
  const sink = new InMemorySink();
  const logger = new Logger({ sinks: [sink], context: { app: 'x', requestId: 'r1' }, clock });
  const child = logger.child({ taskId: 't1' });
  const record = child.info('hello', { answer: 42 });
  assert.deepEqual(record, {
    version: 1,
    ts: '2026-01-01T00:00:00.000Z',
    monoMs: 123.5,
    level: 'info',
    message: 'hello',
    context: { app: 'x', requestId: 'r1', taskId: 't1' },
    fields: { answer: 42 }
  });
});

test('errors are normalized safely', () => {
  const sink = new InMemorySink();
  const logger = new Logger({ sinks: [sink], clock });
  const record = logger.error('boom', { error: new TypeError('bad') });
  assert.equal(record.fields.error.name, 'TypeError');
  assert.equal(record.fields.error.message, 'bad');
});

test('sink failures are isolated and reported', () => {
  const sink = new InMemorySink();
  const seen = [];
  const logger = new Logger({ sinks: [{ write() { throw new Error('sink down'); } }, sink], clock, onSinkError: error => seen.push(error.message) });
  logger.info('ok');
  assert.deepEqual(seen, ['sink down']);
  assert.equal(sink.snapshot().length, 1);
});

test('in-memory sink is bounded', () => {
  const sink = new InMemorySink({ maxRecords: 2 });
  sink.write({ id: 1 }); sink.write({ id: 2 }); sink.write({ id: 3 });
  assert.deepEqual(sink.snapshot(), [{ id: 2 }, { id: 3 }]);
});

test('large records are rejected deterministically', () => {
  const logger = new Logger({ sinks: [], clock, maxRecordBytes: 256 });
  assert.throws(() => logger.info('x'.repeat(500)), error => error instanceof LoggerCubeError && error.code === 'RECORD_TOO_LARGE');
});

test('console sink routes levels correctly', () => {
  const calls = { info: [], warn: [], error: [] };
  const sink = new ConsoleSink({ consoleLike: { info: x => calls.info.push(x), warn: x => calls.warn.push(x), error: x => calls.error.push(x) } });
  sink.write({ level: 'info', message: 'i' });
  sink.write({ level: 'warn', message: 'w' });
  sink.write({ level: 'error', message: 'e' });
  assert.equal(calls.info.length, 1); assert.equal(calls.warn.length, 1); assert.equal(calls.error.length, 1);
});

test('invalid contracts fail with typed errors', () => {
  assert.throws(() => new Logger({ minLevel: 'nope' }), error => error.code === 'INVALID_LEVEL');
  assert.throws(() => new InMemorySink({ maxRecords: 0 }), error => error.code === 'INVALID_MAX_RECORDS');
});
