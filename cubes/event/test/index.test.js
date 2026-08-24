import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, EventCubeError } from '../src/index.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

test('listeners run in deterministic registration order', () => {
  const bus = new EventBus();
  const order = [];
  bus.on('event', () => order.push(1));
  bus.on('event', () => order.push(2));
  bus.on('event', () => order.push(3));
  assert.equal(bus.emit('event', 'x'), 3);
  assert.deepEqual(order, [1, 2, 3]);
});

test('once listener runs exactly once', () => {
  const bus = new EventBus();
  let calls = 0;
  bus.once('event', () => { calls += 1; });
  bus.emit('event');
  bus.emit('event');
  assert.equal(calls, 1);
});

test('unsubscribe and AbortSignal cancellation remove listeners', () => {
  const bus = new EventBus();
  let calls = 0;
  const controller = new AbortController();
  const off = bus.on('event', () => { calls += 1; }, { signal: controller.signal });
  assert.equal(bus.listenerCount('event'), 1);
  controller.abort();
  assert.equal(bus.listenerCount('event'), 0);
  assert.equal(off(), false);
  bus.emit('event');
  assert.equal(calls, 0);
});

test('listener errors are isolated and reported after all listeners run', () => {
  const bus = new EventBus();
  const calls = [];
  bus.on('event', () => { calls.push('a'); throw new Error('boom'); });
  bus.on('event', () => calls.push('b'));
  assert.throws(() => bus.emit('event'), error => error instanceof Error);
  assert.deepEqual(calls, ['a', 'b']);
});

test('emitAsync is ordered and awaits each listener', async () => {
  const bus = new EventBus();
  const order = [];
  bus.on('event', async () => { order.push('a'); await flush(); order.push('a-done'); });
  bus.on('event', () => order.push('b'));
  assert.equal(await bus.emitAsync('event'), 2);
  assert.deepEqual(order, ['a', 'a-done', 'b']);
});

test('re-entrant emission uses a stable listener snapshot', () => {
  const bus = new EventBus();
  const order = [];
  let nested = false;
  bus.on('event', () => {
    order.push('a');
    if (!nested) { nested = true; bus.emit('event'); }
  });
  bus.on('event', () => order.push('b'));
  bus.emit('event');
  assert.deepEqual(order, ['a', 'a', 'b', 'b']);
});

test('waitFor resolves only on matching payload and cleans up', async () => {
  const bus = new EventBus();
  const waiting = bus.waitFor('data', { filter: value => value.id === 2, timeoutMs: 1000 });
  bus.emit('data', { id: 1 });
  assert.equal(bus.listenerCount('data'), 1);
  bus.emit('data', { id: 2 });
  assert.deepEqual(await waiting, { id: 2 });
  assert.equal(bus.listenerCount('data'), 0);
});

test('waitFor abort and timeout are deterministic', async () => {
  const abortController = new AbortController();
  const bus = new EventBus();
  const waiting = bus.waitFor('data', { signal: abortController.signal });
  abortController.abort();
  await assert.rejects(waiting, error => error instanceof EventCubeError && error.code === 'ABORTED');
  assert.equal(bus.listenerCount('data'), 0);
  await assert.rejects(bus.waitFor('data', { timeoutMs: 5 }), error => error instanceof EventCubeError && error.code === 'TIMEOUT');
  assert.equal(bus.listenerCount('data'), 0);
});

test('maxListeners and close are enforced', () => {
  const bus = new EventBus({ maxListeners: 1 });
  const off = bus.on('event', () => {});
  assert.throws(() => bus.on('event', () => {}), error => error.code === 'LISTENER_LIMIT');
  assert.equal(off(), true);
  assert.equal(bus.close(), true);
  assert.equal(bus.close(), false);
  assert.throws(() => bus.emit('event'), error => error.code === 'CLOSED');
});

test('invalid contracts are deterministic', () => {
  const bus = new EventBus();
  assert.throws(() => bus.on('', () => {}), error => error.code === 'INVALID_EVENT_NAME');
  assert.throws(() => bus.on('event', 'nope'), error => error.code === 'INVALID_LISTENER');
  assert.throws(() => new EventBus({ maxListeners: -1 }), error => error.code === 'INVALID_MAX_LISTENERS');
  assert.throws(() => bus.waitFor('event', { timeoutMs: 0 }), error => error.code === 'INVALID_TIMEOUT');
});
