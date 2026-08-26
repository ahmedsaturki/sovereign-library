import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createProcessSupervisor, ProcessSupervisorError } from '../src/index.js';

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.killSignals = [];
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.killed = false;
  }
  kill(signal) {
    this.killSignals.push(signal);
    this.killed = true;
    return true;
  }
}

function harness() {
  const children = [];
  let now = 1_000;
  let ids = 0;
  const capabilities = {
    spawn: () => {
      const child = new FakeChild(2000 + children.length);
      children.push(child);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
    now: () => now,
    identity: () => `sup-${++ids}`,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer),
  };
  return { children, capabilities, advance(ms) { now += ms; } };
}

test('starts and exposes immutable running snapshot', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', args: ['-e', ''] }, h.capabilities);
  const snapshot = await supervisor.start();
  assert.equal(snapshot.state, 'running');
  assert.equal(snapshot.childPid, 2000);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.stats), true);
});

test('rejects second start while a child is active', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  await supervisor.start();
  await assert.rejects(supervisor.start(), error => error instanceof ProcessSupervisorError && error.code === 'BUSY');
});

test('graceful stop escalates to forced kill after bounded grace period', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', stopGracePeriodMs: 5 }, h.capabilities);
  await supervisor.start();
  const stopPromise = supervisor.stop();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(h.children[0].killSignals, ['SIGTERM', 'SIGKILL']);
  h.children[0].emit('close', null, 'SIGKILL');
  const stopped = await stopPromise;
  assert.equal(stopped.state, 'idle');
});

test('explicit restart never creates two live children at once', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', restartBackoffMs: 0, maxRestartAttempts: 3 }, h.capabilities);
  await supervisor.start();
  const restartPromise = supervisor.restart();
  await new Promise(resolve => setTimeout(resolve, 1));
  h.children[0].emit('close', 0, null);
  const restarted = await restartPromise;
  assert.equal(restarted.state, 'running');
  assert.equal(h.children.length, 2);
  assert.equal(h.children[0].killSignals[0], 'SIGTERM');
});

test('automatic restart consumes bounded attempts only after unexpected exit', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', restartBackoffMs: 0, maxRestartAttempts: 2 }, h.capabilities);
  await supervisor.start();
  h.children[0].emit('close', 1, null);
  await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(h.children.length, 2);
  h.children[1].emit('close', 1, null);
  await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(h.children.length, 3);
  h.children[2].emit('close', 1, null);
  assert.equal((await supervisor.inspect()).state, 'failed');
});

test('restart disabled does not create a hidden restart loop', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  await supervisor.start();
  h.children[0].emit('close', 1, null);
  await new Promise(resolve => setTimeout(resolve, 2));
  const snapshot = supervisor.inspect();
  assert.equal(h.children.length, 1);
  assert.equal(snapshot.state, 'failed');
});

test('stale child generation cannot mutate current child state', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', restartBackoffMs: 0, maxRestartAttempts: 2 }, h.capabilities);
  await supervisor.start();
  const first = h.children[0];
  first.emit('close', 1, null);
  await new Promise(resolve => setTimeout(resolve, 2));
  const second = h.children[1];
  first.emit('close', 0, null);
  const snapshot = supervisor.inspect();
  assert.equal(snapshot.childPid, second.pid);
  assert.equal(snapshot.activeGeneration > 0, true);
});

test('health inspection is read-only', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  const before = supervisor.inspect();
  const after = supervisor.inspect();
  assert.deepEqual(before, after);
  assert.equal(h.children.length, 0);
});

test('output accounting is bounded and fails the managed run', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node', maxOutputBytes: 4 }, h.capabilities);
  await supervisor.start();
  h.children[0].stdout.emit('data', Buffer.from('12345'));
  h.children[0].emit('close', 1, 'SIGTERM');
  const snapshot = supervisor.inspect();
  assert.equal(snapshot.state, 'failed');
  assert.match(snapshot.lastDiagnostic, /output exceeded/i);
});

test('accessor and circular inputs fail before spawn', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  const accessor = {};
  Object.defineProperty(accessor, 'deadlineMs', { get() { throw new Error('getter'); } });
  await assert.rejects(supervisor.start(accessor), error => error instanceof ProcessSupervisorError && error.code === 'ACCESSOR_INPUT');
  const circular = {}; circular.self = circular;
  await assert.rejects(supervisor.stop(circular), error => error instanceof ProcessSupervisorError && error.code === 'CIRCULAR_INPUT');
  assert.equal(h.children.length, 0);
});

test('pre-aborted operations fail before touching the child', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(supervisor.start({ signal: controller.signal }), error => error instanceof ProcessSupervisorError && error.code === 'CANCELLED');
  assert.equal(h.children.length, 0);
});

test('close is terminal and cleans active child ownership', async () => {
  const h = harness();
  const supervisor = createProcessSupervisor({ command: 'node' }, h.capabilities);
  await supervisor.start();
  const closed = await supervisor.close();
  assert.equal(closed.state, 'closed');
  assert.equal(closed.closed, true);
  await assert.rejects(supervisor.start(), error => error instanceof ProcessSupervisorError && error.code === 'SUPERVISOR_CLOSED');
  assert.equal(h.children[0].killSignals.at(-1), 'SIGKILL');
});

test('invalid limits and unsupported shell settings fail closed at configuration boundary', () => {
  assert.throws(() => createProcessSupervisor({ command: 'node', stopGracePeriodMs: 0 }), ProcessSupervisorError);
  assert.throws(() => createProcessSupervisor({ command: 'node', maxRestartBackoffMs: 1, restartBackoffMs: 2 }), ProcessSupervisorError);
  assert.throws(() => createProcessSupervisor({ command: 'node', env: Object.create(null, { PATH: { get() { return 'x'; } } }) }), ProcessSupervisorError);
});
