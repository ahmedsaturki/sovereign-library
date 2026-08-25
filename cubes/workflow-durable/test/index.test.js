import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowEngine, WorkflowError } from '../src/index.js';

test('runs deterministic sequential tasks and records history', async () => {
  const engine = createWorkflowEngine();
  const workflow = engine.define({ id: 'seq', version: '1', steps: [
    { id: 'one', kind: 'task', run: ({ input }) => input + 1 },
    { id: 'two', kind: 'task', run: ({ input }) => input + 2 },
  ] });
  const execution = engine.start(workflow, 1);
  const snapshot = await execution.run();
  assert.equal(snapshot.state, 'SUCCEEDED');
  assert.deepEqual(snapshot.history.map((entry) => entry.type), ['WORKFLOW_STARTED', 'STEP_STARTED', 'STEP_SUCCEEDED', 'STEP_STARTED', 'STEP_SUCCEEDED', 'WORKFLOW_SUCCEEDED']);
});

test('runs bounded parallel steps and preserves logical order in history', async () => {
  const engine = createWorkflowEngine();
  const workflow = engine.define({ id: 'parallel', steps: [{ id: 'p', kind: 'parallel', steps: [
    { id: 'a', kind: 'task', run: async () => 'a' },
    { id: 'b', kind: 'task', run: async () => 'b' },
  ] }] });
  const snapshot = await engine.start(workflow).run();
  const started = snapshot.history.filter((entry) => entry.type === 'STEP_STARTED').map((entry) => entry.stepId);
  assert.deepEqual(started, ['p', 'a', 'b']);
});

test('conditional step records selected branch', async () => {
  const engine = createWorkflowEngine();
  const workflow = engine.define({ id: 'branch', steps: [{
    id: 'choose', kind: 'if', when: ({ input }) => input.ok,
    then: [{ id: 'yes', kind: 'task', run: () => 'yes' }],
    else: [{ id: 'no', kind: 'task', run: () => 'no' }],
  }] });
  const snapshot = await engine.start(workflow, { ok: true }).run();
  assert.ok(snapshot.history.some((entry) => entry.type === 'BRANCH_SELECTED' && entry.branch === 'then'));
});

test('retries failed steps and records attempts', async () => {
  const engine = createWorkflowEngine();
  let attempts = 0;
  const workflow = engine.define({ id: 'retry', steps: [{ id: 'task', kind: 'task', retries: 2, run: () => {
    attempts += 1;
    if (attempts < 3) throw new Error('transient');
    return 'ok';
  } }] });
  const snapshot = await engine.start(workflow).run();
  assert.equal(snapshot.state, 'SUCCEEDED');
  assert.equal(attempts, 3);
  assert.equal(snapshot.history.filter((entry) => entry.type === 'STEP_RETRY').length, 2);
});

test('timeout becomes typed failure without crashing the engine', async () => {
  const engine = createWorkflowEngine({ limits: { maxTimeoutMs: 100 } });
  const workflow = engine.define({ id: 'timeout', steps: [{ id: 'slow', kind: 'task', timeoutMs: 1, run: async ({ signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (signal.aborted) throw new WorkflowError('STEP_TIMEOUT', 'timeout');
    return true;
  } }] });
  const snapshot = await engine.start(workflow).run();
  assert.equal(snapshot.state, 'FAILED');
  assert.ok(snapshot.history.some((entry) => entry.type === 'STEP_TIMEOUT'));
});

test('cancellation is propagated and produces a canceled terminal state', async () => {
  const engine = createWorkflowEngine();
  const workflow = engine.define({ id: 'cancel', steps: [{ id: 'wait', kind: 'task', run: async ({ signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (signal.aborted) throw new WorkflowError('CANCELED', 'canceled');
    return true;
  } }] });
  const execution = engine.start(workflow);
  execution.cancel();
  const snapshot = await execution.run();
  assert.equal(snapshot.state, 'CANCELED');
});

test('invalid workflow definitions and duplicate step ids fail closed', () => {
  const engine = createWorkflowEngine();
  assert.throws(() => engine.define({ id: 'bad', steps: [
    { id: 'x', kind: 'task', run: () => 1 },
    { id: 'x', kind: 'task', run: () => 2 },
  ] }), (error) => error instanceof WorkflowError && error.code === 'DUPLICATE_STEP');
});

test('history is immutable and replay validates sequence', async () => {
  const engine = createWorkflowEngine();
  const workflow = engine.define({ id: 'replay', steps: [{ id: 'x', kind: 'task', run: () => 1 }] });
  const snapshot = await engine.start(workflow).run();
  assert.throws(() => { snapshot.history.push('x'); });
  const replayed = engine.replay(workflow, snapshot.history);
  assert.equal(replayed.state, 'SUCCEEDED');
  assert.throws(() => engine.replay(workflow, [{ seq: 2 }]), (error) => error.code === 'REPLAY_FAILURE');
});
