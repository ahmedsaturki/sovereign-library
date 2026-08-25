import test from 'node:test';
import assert from 'node:assert/strict';
import {RateLimiter} from '../src/index.js';
import {FakeClock} from '../src/clock.js';

test('burst capacity grants immediately and then exposes bounded retry delay', () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 2, refillPerSecond: 2, clock});
  assert.equal(limiter.tryAcquire().acquired, true);
  assert.equal(limiter.tryAcquire().acquired, true);
  const blocked = limiter.tryAcquire();
  assert.equal(blocked.acquired, false);
  assert.equal(blocked.retryAfterMs, 500);
});

test('refill restores tokens deterministically without exceeding capacity', () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 2, refillPerSecond: 2, clock});
  limiter.tryAcquire();
  limiter.tryAcquire();
  clock.advance(500);
  assert.equal(limiter.tryAcquire().acquired, true);
  assert.equal(limiter.getStats().tokens < 2, true);
  clock.advance(5000);
  assert.equal(limiter.getStats().tokens <= 2, true);
});

test('queued waiters are served FIFO', async () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 1, refillPerSecond: 1, maxQueue: 3, clock});
  assert.equal(limiter.tryAcquire().acquired, true);
  const order = [];
  const a = limiter.acquire().then(() => order.push('a'));
  const b = limiter.acquire().then(() => order.push('b'));
  clock.advance(1000);
  await Promise.resolve();
  assert.deepEqual(order, ['a']);
  clock.advance(1000);
  await Promise.resolve();
  assert.deepEqual(order, ['a', 'b']);
  await Promise.all([a, b]);
});

test('queue overflow rejects without adding a waiter', async () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 1, refillPerSecond: 1, maxQueue: 1, clock});
  limiter.tryAcquire();
  const first = limiter.acquire();
  await assert.rejects(limiter.acquire(), /queue is full/);
  assert.equal(limiter.getStats().queued, 1);
  clock.advance(1000);
  await first;
});

test('AbortSignal cancels a queued waiter and cleans the queue', async () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 1, refillPerSecond: 1, maxQueue: 2, clock});
  limiter.tryAcquire();
  const controller = new AbortController();
  const pending = limiter.acquire({signal: controller.signal});
  controller.abort(new Error('cancelled by test'));
  await assert.rejects(pending, /cancelled by test/);
  assert.equal(limiter.getStats().queued, 0);
  assert.equal(limiter.getStats().cancelled, 1);
});

test('aborted signal before acquire rejects synchronously through Promise state', async () => {
  const controller = new AbortController();
  controller.abort();
  const limiter = new RateLimiter();
  await assert.rejects(limiter.acquire({signal: controller.signal}), /aborted/i);
});

test('clear rejects all pending waiters and removes their timers/listeners', async () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 1, refillPerSecond: 1, maxQueue: 2, clock});
  limiter.tryAcquire();
  const a = limiter.acquire();
  const b = limiter.acquire();
  limiter.clear(new Error('cleared'));
  await assert.rejects(a, /cleared/);
  await assert.rejects(b, /cleared/);
  assert.equal(limiter.getStats().queued, 0);
});

test('stats are immutable snapshots and track grants/rejections/overflow', () => {
  const clock = new FakeClock(0);
  const limiter = new RateLimiter({capacity: 1, refillPerSecond: 1, maxQueue: 0, clock});
  limiter.tryAcquire();
  limiter.tryAcquire();
  assert.equal(limiter.getStats().rejected, 1);
  assert.equal(limiter.getStats().overflowed, 1);
  assert.equal(Object.isFrozen(limiter.getStats()), true);
});

test('invalid configuration and unsafe clock contracts fail early', () => {
  assert.throws(() => new RateLimiter({capacity: 0}), RangeError);
  assert.throws(() => new RateLimiter({refillPerSecond: 0}), RangeError);
  assert.throws(() => new RateLimiter({maxQueue: -1}), RangeError);
  assert.throws(() => new RateLimiter({clock: {now() { return 0; }}}), TypeError);
});
