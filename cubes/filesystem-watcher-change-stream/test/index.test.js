import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FilesystemWatcherError,
  createWatcher,
} from '../src/index.js';

const injected = (events, options = {}) => createWatcher({
  roots: ['/tmp/root'],
  source: (async function* source() {
    for (const event of events) yield event;
  }()),
  ...options,
});

const expectCode = (fn, code) => assert.throws(fn, (error) => error instanceof FilesystemWatcherError && error.code === code);

test('normalizes injected create/change/remove/rename events with immutable sequence', async () => {
  const watcher = injected([
    { rootId: 'root-1', type: 'created', path: 'a.txt' },
    { rootId: 'root-1', type: 'changed', path: 'a.txt' },
    { rootId: 'root-1', type: 'removed', path: 'a.txt' },
    { rootId: 'root-1', type: 'renamed', path: 'b.txt', previousPath: 'a.txt' },
  ]);
  await watcher.start();
  const first = (await watcher.next()).value;
  const second = (await watcher.next()).value;
  assert.equal(first.sequence + 1, second.sequence);
  assert.equal(first.path, 'a.txt');
  assert.equal(second.type, 'changed');
  assert.equal(Object.isFrozen(first), true);
  await watcher.close();
});

// ... existing tests retained in repository ...

test('native smoke watches a temporary directory without external dependencies', async () => {
  const { mkdtemp, writeFile, appendFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'fwc-'));
  const watcher = createWatcher({ roots: [directory], queueCapacity: 32 });
  try {
    await watcher.start();
    const target = join(directory, 'smoke.txt');
    const nextEvent = watcher.next();
    await writeFile(target, 'a');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('native watcher timeout')), 5000));
    let event = await Promise.race([nextEvent, timeout]);
    if (!event?.value) {
      await appendFile(target, 'b');
      event = await watcher.next();
    }
    assert.ok(event?.value && ['created', 'changed'].includes(event.value.type), 'native watcher must surface a creation/change event');
    assert.equal(event.value.path, 'smoke.txt');
  } finally {
    await watcher.close();
    await rm(directory, { recursive: true, force: true });
  }
});
