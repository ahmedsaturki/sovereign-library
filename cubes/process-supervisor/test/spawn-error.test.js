import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createProcessSupervisor, ProcessSupervisorError } from '../src/index.js';

function caps(spawn) {
  let id = 0;
  return {
    spawn,
    now: () => 1,
    identity: () => `spawn-${++id}`,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer),
  };
}

test('spawn error rejects start instead of hanging', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  const supervisor = createProcessSupervisor({ command: 'missing' }, caps(() => {
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    return child;
  }));
  await assert.rejects(supervisor.start(), error => error instanceof ProcessSupervisorError && error.code === 'SPAWN_FAILED');
  assert.equal(supervisor.inspect().state, 'failed');
  assert.equal(supervisor.inspect().childPid, null);
});

test('active start cancellation is typed and terminates owned child', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killSignals = [];
  child.kill = (signal) => { child.killSignals.push(signal); return true; };
  const supervisor = createProcessSupervisor({ command: 'node', gracefulSignal: 'SIGTERM', forcedSignal: 'SIGKILL' }, caps(() => child));
  const controller = new AbortController();
  const pending = supervisor.start({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error instanceof ProcessSupervisorError && error.code === 'CANCELLED');
  assert.equal(child.killSignals.at(-1), 'SIGKILL');
});
