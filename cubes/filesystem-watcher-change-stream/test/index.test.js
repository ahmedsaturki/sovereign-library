import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatcher, FILESYSTEM_WATCHER_FORMAT } from '../src/index.js';

async function* sourceOf(events) { for (const event of events) yield event; }

function controlledSource(events) {
  let index = 0;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  return {
    done,
    source: {
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            if (index < events.length) return { value: events[index++], done: false };
            finish();
            return { value: undefined, done: true };
          },
        };
      },
    },
  };
}

const root = '/virtual/project';

function injected(events, overrides = {}) {
  return createWatcher({ roots: [root], source: sourceOf(events), ...overrides });
}

test('normalizes injected create/change/remove/rename events with immutable sequence', async () => {
  const watcher = injected([
    { rootId: 'root-1', type: 'created', path: 'a.txt' },
    { rootId: 'root-1', type: 'changed', path: 'a.txt' },
    { rootId: 'root-1', type: 'removed', path: 'a.txt' },
    { rootId: 'root-1', type: 'renamed', path: 'b.txt', previousPath: 'a.txt' },
  ]);
  await watcher.start();
  const values = [await watcher.next(), await watcher.next(), await watcher.next(), await watcher.next()];
  assert.deepEqual(values.map((item) => item.value.type), ['created', 'changed', 'removed', 'renamed']);
  assert.deepEqual(values.map((item) => item.value.sequence), [1, 2, 3, 4]);
  assert.equal(values[0].value.format, FILESYSTEM_WATCHER_FORMAT);
  assert.deepEqual(values[3].value.previousPath, 'a.txt');
  assert.equal(Object.isFrozen(values[0].value), true);
  await watcher.close();
});

test('supports all overflow policies with bounded queue', async () => {
  for (const overflow of ['reject_new', 'drop_oldest', 'drop_newest']) {
    const { source, done } = controlledSource([
      { rootId: 'root-1', type: 'created', path: '1.txt' },
      { rootId: 'root-1', type: 'created', path: '2.txt' },
      { rootId: 'root-1', type: 'created', path: '3.txt' },
    ]);
    const watcher = createWatcher({ roots: [root], source, queueCapacity: 2, overflow });
    await watcher.start();
    await done;
    const first = await watcher.next();
    const second = await watcher.next();
    assert.equal(first.done, false);
    assert.equal(second.done, false);
    assert.ok(watcher.stats().overflow > 0);
    assert.ok(watcher.stats().queued <= 2);
    await watcher.close();
  }
});

test('injected sources are capability hooks and are never frozen or traversed as configuration data', async () => {
  const source = sourceOf([{ rootId: 'root-1', type: 'created', path: 'x.txt' }]);
  assert.equal(Object.isFrozen(source), false);
  const watcher = createWatcher({ roots: [root], source });
  assert.equal(Object.isFrozen(source), false);
  await watcher.start();
  assert.equal((await watcher.next()).value.path, 'x.txt');
  assert.equal(Object.isFrozen(source), false);
  await watcher.close();
});

test('close is idempotent and next terminates cleanly', async () => {
  const watcher = injected([]);
  await watcher.start();
  await watcher.close();
  await watcher.close();
  assert.equal((await watcher.next()).done, true);
});

test('invalid configuration and paths fail closed before use', () => {
  assert.throws(() => createWatcher({ roots: [] }), (error) => error.code === 'INVALID_ROOTS');
  assert.throws(() => createWatcher({ roots: [root], queueCapacity: 0 }), (error) => error.code === 'INVALID_QUEUE');
  assert.throws(() => createWatcher({ roots: [root], overflow: 'unknown' }), (error) => error.code === 'INVALID_OVERFLOW');
  assert.throws(() => createWatcher({ roots: [root], debounceMs: -1 }), (error) => error.code === 'INVALID_DEBOUNCE');
  assert.throws(() => createWatcher({ roots: [root], recursive: 'yes' }), (error) => error.code === 'INVALID_RECURSIVE');
});

test('accessors and circular values are rejected without getter execution', () => {
  const env = {};
  Object.defineProperty(env, 'roots', { get() { throw new Error('getter must not execute'); } });
  assert.throws(() => createWatcher(env), (error) => error.code === 'ACCESSOR_INPUT');
  const circular = { roots: [root] }; circular.self = circular;
  assert.throws(() => createWatcher(circular), (error) => error.code === 'CIRCULAR_INPUT');
});

test('unknown roots and path escapes fail closed and a new watcher recovers', async () => {
  const watcher = injected([{ rootId: 'other', type: 'created', path: 'x' }]);
  await watcher.start();
  await assert.rejects(() => watcher.next(), (error) => error.code === 'UNKNOWN_ROOT');
  await watcher.close();
  const valid = injected([{ rootId: 'root-1', type: 'created', path: 'ok.txt' }]);
  await valid.start();
  assert.equal((await valid.next()).value.path, 'ok.txt');
  await valid.close();
});

test('native smoke watches a temporary directory without external dependencies', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'fwc-'));
  const watcher = createWatcher({ roots: [directory], queueCapacity: 32 });
  await watcher.start();
  const target = join(directory, 'smoke.txt');
  await writeFile(target, 'a');
  const event = await Promise.race([
    watcher.next(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('native watcher timeout')), 3000)),
  ]);
  assert.ok(['created', 'changed'].includes(event.value.type));
  await watcher.close();
  await rm(directory, { recursive: true, force: true });
});

test('debounce is explicit and bounded', async () => {
  const watcher = injected([
    { rootId: 'root-1', type: 'changed', path: 'a.txt' },
    { rootId: 'root-1', type: 'changed', path: 'a.txt' },
  ], { debounceMs: 5 });
  await watcher.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const event = await watcher.next();
  assert.equal(event.value.path, 'a.txt');
  await watcher.close();
});
