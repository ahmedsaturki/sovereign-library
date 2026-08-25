import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitBreakerError, FakeClock } from '../src/index.js';

const failure = Object.assign(new Error('temporary'), { retryable: true });

test('starts closed and executes successfully', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2 });
  assert.equal(breaker.getState(), 'CLOSED');
  assert.equal(await breaker.execute(() => 'ok'), 'ok');
  assert.equal(breaker.getStats().successes, 1);
});

test('opens after the configured failure threshold', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2 });
  await assert.rejects(breaker.execute(() => { throw failure; }));
  await assert.rejects(breaker.execute(() => { throw failure; }));
  assert.equal(breaker.getState(), 'OPEN');
  await assert.rejects(breaker.execute(() => 'blocked'), e => e instanceof CircuitBreakerError && e.code === 'OPEN');
});

test('cooldown moves open circuit to half-open deterministically', async () => {
  const clock = new FakeClock(0);
  const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, clock });
  await assert.rejects(breaker.execute(() => { throw failure; }));
  assert.equal(breaker.getState(), 'OPEN');
  clock.advance(99);
  assert.equal(breaker.getState(), 'OPEN');
  clock.advance(1);
  assert.equal(breaker.getState(), 'HALF_OPEN');
});

test('half-open limits concurrent probes and successful probes recover', async () => {
  const clock = new FakeClock(0);
  const breaker = new CircuitBreaker({ failureThreshold: 1, successThreshold: 2, cooldownMs: 10, halfOpenMaxProbes: 1, clock });
  await assert.rejects(breaker.execute(() => { throw failure; }));
  clock.advance(10);
  let release;
  const probe = breaker.execute(() => new Promise(resolve => { release = resolve; }));
  await Promise.resolve();
  await assert.rejects(breaker.execute(() => 'blocked'), e => e instanceof CircuitBreakerError && e.code === 'PROBE_LIMIT');
  release('ok');
  assert.equal(await probe, 'ok');
  assert.equal(breaker.getState(), 'HALF_OPEN');
  assert.equal(await breaker.execute(() => 'ok'), 'ok');
  assert.equal(breaker.getState(), 'CLOSED');
});

test('half-open failure returns circuit to open', async () => {
  const clock = new FakeClock(0);
  const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10, clock });
  await assert.rejects(breaker.execute(() => { throw failure; }));
  clock.advance(10);
  assert.equal(breaker.getState(), 'HALF_OPEN');
  await assert.rejects(breaker.execute(() => { throw failure; }));
  assert.equal(breaker.getState(), 'OPEN');
});

test('non-retryable failures are recorded but do not open the circuit', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1 });
  await assert.rejects(breaker.execute(() => { throw new Error('business'); }));
  assert.equal(breaker.getState(), 'CLOSED');
  assert.equal(breaker.getStats().failures, 1);
});

test('manual reset closes an open circuit', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1 });
  await assert.rejects(breaker.execute(() => { throw failure; }));
  assert.equal(breaker.getState(), 'OPEN');
  breaker.reset();
  assert.equal(breaker.getState(), 'CLOSED');
  assert.equal(breaker.getStats().resets, 1);
});

test('abort is surfaced without counting as a probe failure', async () => {
  const breaker = new CircuitBreaker({ failureThreshold: 1 });
  const controller = new AbortController();
  controller.abort(new Error('stop'));
  await assert.rejects(breaker.execute(() => 'never', { signal: controller.signal }), e => e instanceof CircuitBreakerError && e.code === 'CANCELLED');
  assert.equal(breaker.getState(), 'CLOSED');
  assert.equal(breaker.getStats().failures, 0);
});

test('stats are immutable snapshots and close prevents new work', async () => {
  const breaker = new CircuitBreaker();
  const snapshot = breaker.getStats();
  assert.equal(Object.isFrozen(snapshot), true);
  breaker.close();
  assert.equal(breaker.canExecute(), false);
  await assert.rejects(breaker.execute(() => 'blocked'), e => e instanceof CircuitBreakerError && e.code === 'CLOSED');
});

test('invalid configuration fails early', () => {
  assert.throws(() => new CircuitBreaker({ failureThreshold: 0 }), RangeError);
  assert.throws(() => new CircuitBreaker({ successThreshold: 0 }), RangeError);
  assert.throws(() => new CircuitBreaker({ cooldownMs: -1 }), RangeError);
  assert.throws(() => new CircuitBreaker({ halfOpenMaxProbes: 0 }), RangeError);
  assert.throws(() => new CircuitBreaker({ clock: {} }), TypeError);
});
