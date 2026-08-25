import test from 'node:test';
import assert from 'node:assert/strict';
import { Bulkhead, BulkheadError } from '../src/index.js';

test('immediate admission respects the concurrency limit', () => {
  const bulkhead = new Bulkhead({ limit: 2 });
  const first = bulkhead.tryAcquire();
  const second = bulkhead.tryAcquire();
  const third = bulkhead.tryAcquire();
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, true);
  assert.equal(third.acquired, false);
  first.lease.release();
  second.lease.release();
  assert.equal(bulkhead.getStats().active, 0);
});

test('queued acquisitions are served FIFO', async () => {
  const bulkhead = new Bulkhead({ limit: 1, maxQueue: 3 });
  const first = await bulkhead.acquire();
  const order = [];
  const second = bulkhead.acquire().then(lease => { order.push('a'); return lease; });
  const third = bulkhead.acquire().then(lease => { order.push('b'); return lease; });
  first.release();
  const secondLease = await second;
  assert.deepEqual(order, ['a']);
  secondLease.release();
  const thirdLease = await third;
  assert.deepEqual(order, ['a', 'b']);
  thirdLease.release();
});

test('queue overflow is explicit and does not enqueue', async () => {
  const bulkhead = new Bulkhead({ limit: 1, maxQueue: 1 });
  const active = await bulkhead.acquire();
  const queued = bulkhead.acquire();
  await assert.rejects(bulkhead.acquire(), error => error instanceof BulkheadError && error.code === 'QUEUE_FULL' && error.overflowed === true);
  assert.equal(bulkhead.getStats().queued, 1);
  assert.equal(bulkhead.getStats().queuedTotal, 1);
  active.release();
  const next = await queued;
  next.release();
});

test('queued AbortSignal cancellation removes the waiter', async () => {
  const bulkhead = new Bulkhead({ limit: 1, maxQueue: 2 });
  const active = await bulkhead.acquire();
  const controller = new AbortController();
  const pending = bulkhead.acquire({ signal: controller.signal });
  controller.abort(new Error('stop'));
  await assert.rejects(pending, error => error instanceof BulkheadError && error.code === 'CANCELLED' && error.cancelled === true);
  assert.equal(bulkhead.getStats().queued, 0);
  assert.equal(bulkhead.getStats().cancelled, 1);
  active.release();
});

test('double release is rejected deterministically', async () => {
  const bulkhead = new Bulkhead({ limit: 1 });
  const lease = await bulkhead.acquire();
  lease.release();
  assert.throws(() => lease.release(), error => error instanceof BulkheadError && error.code === 'DOUBLE_RELEASE');
});

test('close rejects queued work and prevents new admissions', async () => {
  const bulkhead = new Bulkhead({ limit: 1, maxQueue: 2 });
  const active = await bulkhead.acquire();
  const pending = bulkhead.acquire();
  bulkhead.close();
  await assert.rejects(pending, error => error instanceof BulkheadError && error.code === 'CLOSED');
  assert.throws(() => bulkhead.tryAcquire(), error => error instanceof BulkheadError && error.code === 'CLOSED');
  active.release();
  assert.equal(bulkhead.getStats().closed, true);
  assert.equal(bulkhead.getStats().queued, 0);
});

test('statistics are immutable snapshots', () => {
  const bulkhead = new Bulkhead({ limit: 2, maxQueue: 1 });
  const snapshot = bulkhead.getStats();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(snapshot.active, 0);
  assert.equal(snapshot.available, 2);
  assert.equal(snapshot.queued, 0);
  assert.equal(snapshot.queuedTotal, 0);
});

test('invalid configuration fails early', () => {
  assert.throws(() => new Bulkhead({ limit: 0 }), RangeError);
  assert.throws(() => new Bulkhead({ maxQueue: -1 }), RangeError);
  assert.throws(() => new Bulkhead({ clock: {} }), TypeError);
});
