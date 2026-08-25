import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionError, createExecutionEngine } from '../src/index.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('executes dependencies in deterministic order and records immutable results', async () => {
  const order = [];
  const engine = createExecutionEngine({ tasks: [
    { id: 'b', dependsOn: ['a'], run: async ({ results }) => { order.push('b'); return `${results.a}:b`; } },
    { id: 'a', run: async () => { order.push('a'); return 'ok'; } },
  ] });
  const result = await engine.run();
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.results.b, 'ok:b');
  assert.ok(Object.isFrozen(result));
});

test('rejects duplicate tasks, unknown dependencies, and cycles', () => {
  assert.throws(() => createExecutionEngine({ tasks: [
    { id: 'x', run() {} }, { id: 'x', run() {} },
  ]}), e => e instanceof ExecutionError && e.code === 'DUPLICATE_TASK');
  assert.throws(() => createExecutionEngine({ tasks: [
    { id: 'x', dependsOn: ['missing'], run() {} },
  ]}), e => e instanceof ExecutionError && e.code === 'INVALID_DEFINITION');
  assert.throws(() => createExecutionEngine({ tasks: [
    { id: 'a', dependsOn: ['b'], run() {} }, { id: 'b', dependsOn: ['a'], run() {} },
  ]}), e => e instanceof ExecutionError && e.code === 'CYCLE_DETECTED');
});

test('retries failures deterministically and succeeds after recovery', async () => {
  let count = 0;
  const engine = createExecutionEngine({ tasks: [{ id: 'recover', maxRetries: 1, run: async () => {
    count += 1;
    if (count === 1) throw new Error('temporary');
    return 'recovered';
  }}] });
  const result = await engine.run();
  assert.equal(result.status, 'succeeded');
  assert.equal(result.attempts.recover, 2);
  assert.equal(result.results.recover, 'recovered');
});

test('timeout produces explicit timed_out outcome', async () => {
  const engine = createExecutionEngine({ tasks: [{ id: 'slow', timeoutMs: 5, run: () => wait(20) }] });
  const result = await engine.run();
  assert.equal(result.status, 'failed');
  assert.equal(result.states.slow, 'timed_out');
  assert.equal(result.errors.slow.code, 'TASK_TIMEOUT');
});

test('failed dependency skips downstream work', async () => {
  let downstream = false;
  const engine = createExecutionEngine({ tasks: [
    { id: 'fail', run: async () => { throw new Error('boom'); } },
    { id: 'downstream', dependsOn: ['fail'], run: async () => { downstream = true; } },
  ] });
  const result = await engine.run();
  assert.equal(result.states.fail, 'failed');
  assert.equal(result.states.downstream, 'skipped');
  assert.equal(downstream, false);
});

test('cancellation prevents later work and is visible in snapshot', async () => {
  const engine = createExecutionEngine({ tasks: [
    { id: 'a', run: async () => { await wait(5); engine.cancel(); return 'a'; } },
    { id: 'b', dependsOn: ['a'], run: async () => 'b' },
  ] });
  const result = await engine.run();
  assert.equal(result.status, 'cancelled');
  assert.equal(result.states.b, 'cancelled');
  assert.equal(engine.snapshot().status, 'cancelled');
});

test('bounds fail closed and source definitions remain usable', () => {
  const task = { id: 'x', run: async () => 'ok' };
  const engine = createExecutionEngine({ tasks: [task] }, { limits: { maxTasks: 1 } });
  assert.deepEqual(engine.taskIds, ['x']);
  assert.equal(task.id, 'x');
  assert.throws(() => createExecutionEngine({ tasks: [{ id: 'x', run() {} }, { id: 'y', run() {} }] }, { limits: { maxTasks: 1 } }), e => e instanceof ExecutionError && e.code === 'INVALID_DEFINITION');
});
