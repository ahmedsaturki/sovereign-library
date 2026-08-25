import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetryPolicy, RetryRunner, RetryError} from '../src/index.js';
import {FakeClock} from '../src/clock.js';

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test('fixed and exponential policies compute deterministic delays', () => {
  const fixed = createRetryPolicy({backoff: 'fixed', baseDelayMs: 100});
  const exp = createRetryPolicy({backoff: 'exponential', baseDelayMs: 100, factor: 2});
  assert.equal(fixed.delayFor(3), 100);
  assert.equal(exp.delayFor(1), 100);
  assert.equal(exp.delayFor(2), 200);
  assert.equal(exp.delayFor(3), 400);
});

test('jitter is deterministic when random source is injected', () => {
  const full = createRetryPolicy({baseDelayMs: 100, jitter: 'full', random: () => 0.25});
  const bounded = createRetryPolicy({baseDelayMs: 100, jitter: 'bounded', random: () => 0.25});
  assert.equal(full.delayFor(1), 25);
  assert.equal(bounded.delayFor(1), 63);
});

test('retry runner retries retryable failures and returns attempt history', async () => {
  const clock = new FakeClock(0);
  const runner = new RetryRunner(createRetryPolicy({maxAttempts: 3, baseDelayMs: 100}), {clock});
  let count = 0;
  const promise = runner.run(async ({signal}) => {
    count += 1;
    if (count < 3) throw Object.assign(new Error('temporary'), {retryable: true});
    assert.equal(signal.aborted, false);
    return 'ok';
  });
  await flushMicrotasks();
  clock.advance(100);
  await flushMicrotasks();
  clock.advance(200);
  await flushMicrotasks();
  const result = await promise;
  assert.equal(result.value, 'ok');
  assert.equal(result.attempts.length, 3);
  assert.equal(result.attempts[0].retry, true);
  assert.equal(result.attempts[1].delayMs, 200);
});

test('non-retryable errors stop immediately', async () => {
  const runner = new RetryRunner(createRetryPolicy({maxAttempts: 5}), {clock: new FakeClock(0)});
  await assert.rejects(runner.run(() => { throw new Error('fatal'); }), error => error instanceof RetryError && error.code === 'RETRY_EXHAUSTED' && error.attempts === 1);
});

test('attempt timeout aborts the attempt and is retryable by default', async () => {
  const clock = new FakeClock(0);
  const runner = new RetryRunner(createRetryPolicy({maxAttempts: 2, baseDelayMs: 50}), {clock});
  const promise = runner.run(({signal}) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  }), {attemptTimeoutMs: 100});
  await flushMicrotasks();
  clock.advance(100);
  await flushMicrotasks();
  clock.advance(50);
  await flushMicrotasks();
  clock.advance(100);
  await flushMicrotasks();
  await assert.rejects(promise, error => error instanceof RetryError && error.code === 'RETRY_EXHAUSTED' && error.attempts === 2);
});

test('AbortSignal cancels during backoff and cleans the timer', async () => {
  const clock = new FakeClock(0);
  const runner = new RetryRunner(createRetryPolicy({maxAttempts: 3, baseDelayMs: 100}), {clock});
  const controller = new AbortController();
  const promise = runner.run(() => { throw Object.assign(new Error('temporary'), {retryable: true}); }, {signal: controller.signal});
  await flushMicrotasks();
  controller.abort(new Error('stop'));
  await assert.rejects(promise, error => error instanceof RetryError && error.code === 'CANCELLED');
  assert.equal(clock.timers.size, 0);
});

test('total budget prevents a retry that would exceed the budget', async () => {
  const clock = new FakeClock(0);
  const runner = new RetryRunner(createRetryPolicy({maxAttempts: 5, baseDelayMs: 100, totalBudgetMs: 50}), {clock});
  const promise = runner.run(() => { throw Object.assign(new Error('temporary'), {retryable: true}); });
  await flushMicrotasks();
  await assert.rejects(promise, error => error instanceof RetryError && error.code === 'BUDGET_EXCEEDED');
});

test('policy validation rejects invalid configuration', () => {
  assert.throws(() => createRetryPolicy({maxAttempts: 0}), RangeError);
  assert.throws(() => createRetryPolicy({backoff: 'unknown'}), TypeError);
  assert.throws(() => createRetryPolicy({factor: 0}), RangeError);
  assert.throws(() => createRetryPolicy({jitter: 'unknown'}), TypeError);
});
