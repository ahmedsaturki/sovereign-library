import test from 'node:test';
import assert from 'node:assert/strict';
import { Result, ResultError, errors, serializeError } from '../src/index.js';

test('ok and err are immutable tagged results', () => {
  const ok = Result.ok(42);
  const err = Result.err(new Error('boom'));
  assert.equal(Result.is(ok), true);
  assert.equal(Result.is(err), true);
  assert.equal(ok.ok, true);
  assert.equal(err.ok, false);
  assert.equal(Object.isFrozen(ok), true);
  assert.equal(Object.isFrozen(err), true);
});

test('map and andThen preserve failures', () => {
  assert.equal(Result.unwrap(Result.map(Result.ok(2), value => value * 2)), 4);
  const err = Result.err(errors.validation('bad'));
  assert.strictEqual(Result.map(err, () => 1), err);
  assert.strictEqual(Result.andThen(err, () => Result.ok(1)), err);
});

test('mapErr and recover transform failures deterministically', () => {
  const result = Result.err(errors.unknown('x'));
  const mapped = Result.mapErr(result, error => errors.retryable('TEMP', error.message));
  assert.equal(mapped.error.code, 'TEMP');
  assert.equal(mapped.error.retryable, true);
  assert.equal(Result.unwrap(Result.recover(mapped, () => Result.ok(9))), 9);
});

test('fromThrowable normalizes thrown values', () => {
  const result = Result.fromThrowable(() => { throw new TypeError('bad'); }, { code: 'TYPE_FAILURE' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TYPE_FAILURE');
  assert.equal(result.error.cause instanceof TypeError, true);
});

test('fromPromise converts rejection into Result', async () => {
  const result = await Result.fromPromise(Promise.reject(new Error('network')), { code: 'NETWORK' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'NETWORK');
});

test('cancelled and timeout errors expose explicit semantics', () => {
  const cancelled = errors.cancelled();
  const timeout = errors.timedOut();
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.retryable, false);
  assert.equal(timeout.timedOut, true);
  assert.equal(timeout.retryable, true);
});

test('serializeError preserves code flags and nested causes safely', () => {
  const cause = new Error('root');
  const error = new ResultError('WRAPPED', 'wrapped', { cause, retryable: true, details: { a: 1 } });
  const serialized = serializeError(error);
  assert.deepEqual(serialized.cause.message, 'root');
  assert.equal(serialized.code, 'WRAPPED');
  assert.equal(serialized.retryable, true);
  assert.equal(Object.isFrozen(serialized), true);
});

test('serializeError handles circular cause chains deterministically', () => {
  const first = new Error('first');
  const second = new Error('second', { cause: first });
  first.cause = second;
  const serialized = serializeError(first);
  assert.equal(serialized.cause.message, 'second');
  assert.equal(serialized.cause.cause.message, '[circular cause]');
});

test('match and ensure are exhaustive and deterministic', () => {
  const result = Result.ok(5);
  assert.equal(Result.match(result, { ok: value => value + 1, err: () => 0 }), 6);
  assert.equal(Result.unwrap(Result.ensure(result, value => value > 0)), 5);
  assert.equal(Result.ensure(result, value => value < 0).error.code, 'UNKNOWN_ERROR');
});

test('unwrap and unwrapOr have explicit failure behavior', () => {
  const err = Result.err(errors.validation('bad'));
  assert.throws(() => Result.unwrap(err), /bad/);
  assert.equal(Result.unwrapOr(err, 7), 7);
});
