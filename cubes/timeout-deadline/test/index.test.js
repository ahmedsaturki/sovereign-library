import test from 'node:test';
import assert from 'node:assert/strict';
import { Deadline, FakeClock, TimeoutError, createDeadline, deadlineFromAbsolute, withDeadline } from '../src/index.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('creates deterministic deadlines and reports remaining time', () => {
  const clock = new FakeClock(100);
  const deadline = createDeadline(50, { clock });
  assert.equal(deadline.deadlineAt, 150);
  assert.equal(deadline.remainingMs(), 50);
  clock.advance(20);
  assert.equal(deadline.remainingMs(), 30);
  assert.equal(deadline.isExpired(), false);
  assert.equal(Object.isFrozen(deadline), true);
});

test('absolute deadline and child deadline cannot extend the parent', () => {
  const clock = new FakeClock(100);
  const parent = deadlineFromAbsolute(200, { clock });
  assert.equal(parent.child(50).deadlineAt, 150);
  assert.equal(parent.child(500).deadlineAt, 200);
  assert.throws(() => parent.child(-1), RangeError);
});

test('expired deadline rejects before starting operation', async () => {
  const clock = new FakeClock(100);
  const deadline = new Deadline(100, clock);
  let called = false;
  await assert.rejects(withDeadline(() => { called = true; }, deadline), e => e instanceof TimeoutError && e.code === 'TIMEOUT');
  assert.equal(called, false);
});

test('withDeadline returns successful operation and cleans timer', async () => {
  const clock = new FakeClock(0);
  const deadline = createDeadline(1000, { clock });
  const value = await withDeadline(async () => 'ok', deadline);
  assert.equal(value, 'ok');
});

test('withDeadline aborts the operation on timeout and returns TimeoutError', async () => {
  const clock = new FakeClock(0);
  const deadline = createDeadline(20, { clock });
  let observedSignal = null;
  await assert.rejects(withDeadline(({ signal }) => {
    observedSignal = signal;
    return new Promise(resolve => setTimeout(resolve, 100));
  }, deadline), e => e instanceof TimeoutError && e.code === 'TIMEOUT');
  assert.equal(observedSignal.aborted, true);
});

test('parent AbortSignal cancels operation and does not become timeout', async () => {
  const clock = new FakeClock(0);
  const deadline = createDeadline(1000, { clock });
  const controller = new AbortController();
  const reason = new Error('cancelled by parent');
  const promise = withDeadline(({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), deadline, { signal: controller.signal });
  await flush();
  controller.abort(reason);
  await assert.rejects(promise, error => error === reason);
});

test('deadline snapshot is immutable and updates remaining time', () => {
  const clock = new FakeClock(0);
  const deadline = createDeadline(25, { clock });
  const snapshot = deadline.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.remainingMs, 25);
  clock.advance(25);
  assert.equal(deadline.snapshot().expired, true);
});

test('invalid clocks and arguments fail early', () => {
  assert.throws(() => new Deadline(10, {}), TypeError);
  assert.throws(() => createDeadline(-1), RangeError);
  assert.throws(() => deadlineFromAbsolute(-1), RangeError);
  assert.throws(() => withDeadline(() => {}, {}), TypeError);
});
