import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Cache, CacheCubeError } from '../src/index.js';

class FakeClock {
  constructor(now = 0) { this.value = now; }
  now() { return this.value; }
  advance(ms) { this.value += ms; }
}

test('set/get/has/delete are deterministic', () => {
  const cache = new Cache();
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.has('a'), true);
  assert.equal(cache.delete('a'), true);
  assert.equal(cache.has('a'), false);
});

test('TTL uses injected clock deterministically', () => {
  const clock = new FakeClock(100);
  const cache = new Cache({ clock });
  cache.set('a', 'value', { ttlMs: 50 });
  assert.equal(cache.get('a'), 'value');
  clock.advance(49);
  assert.equal(cache.get('a'), 'value');
  clock.advance(1);
  assert.equal(cache.get('a'), undefined);
});

test('bounded capacity evicts the least recently used entry', () => {
  const cache = new Cache({ maxEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('c'), true);
  assert.equal(cache.stats().evictions, 1);
});

test('namespace is isolated and statistics are immutable snapshots', () => {
  const a = new Cache({ namespace: 'a' });
  const b = new Cache({ namespace: 'b' });
  a.set('key', 1);
  b.set('key', 2);
  assert.equal(a.get('key'), 1);
  assert.equal(b.get('key'), 2);
  const stats = a.stats();
  assert.equal(Object.isFrozen(stats), true);
});

test('getOrCompute de-duplicates concurrent computation', async () => {
  const cache = new Cache();
  let calls = 0;
  const compute = async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 15));
    return 42;
  };
  const values = await Promise.all([
    cache.getOrCompute('x', compute),
    cache.getOrCompute('x', compute),
    cache.getOrCompute('x', compute)
  ]);
  assert.deepEqual(values, [42, 42, 42]);
  assert.equal(calls, 1);
  assert.equal(await cache.getOrCompute('x', compute), 42);
  assert.equal(calls, 1);
});

test('getOrCompute supports cancellation', async () => {
  const cache = new Cache();
  const controller = new AbortController();
  const promise = cache.getOrCompute('x', async ({ signal }) => {
    await new Promise(resolve => setTimeout(resolve, 20));
    signal.throwIfAborted();
    return 1;
  }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(promise, error => error?.name === 'AbortError' || error?.code === 'ABORTED');
  assert.equal(cache.has('x'), false);
});

test('invalidate and clear remove exactly the selected entries', () => {
  const cache = new Cache();
  cache.set('user:1', 1);
  cache.set('user:2', 2);
  cache.set('system:1', 3);
  assert.equal(cache.invalidate(key => key.startsWith('user:')), 2);
  assert.equal(cache.stats().size, 1);
  assert.equal(cache.clear(), 1);
  assert.equal(cache.stats().size, 0);
});

test('invalid contracts are deterministic', () => {
  assert.throws(() => new Cache({ maxEntries: 0 }), error => error instanceof CacheCubeError && error.code === 'INVALID_MAX_ENTRIES');
  assert.throws(() => new Cache().set('x', 1, { ttlMs: 0 }), error => error instanceof CacheCubeError && error.code === 'INVALID_TTL');
  assert.throws(() => new Cache().getOrCompute('x', null), error => error instanceof CacheCubeError && error.code === 'INVALID_COMPUTE');
});
