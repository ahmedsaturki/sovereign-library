import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentError, createAgentRuntime } from '../src/index.js';

function makeRuntime(limits = {}) {
  return createAgentRuntime({
    definition: {
      id: 'demo-agent',
      version: '1',
      tools: [
        { name: 'echo', description: 'echo input', handler: async input => ({ echoed: input }) },
        { name: 'sum', handler: async input => Number(input.a) + Number(input.b) },
      ],
    },
    limits,
  });
}

test('definition and tool registry are deterministic', () => {
  const runtime = makeRuntime();
  assert.deepEqual(runtime.tools.names, ['echo', 'sum']);
  assert.deepEqual(runtime.definition, { id: 'demo-agent', version: '1', tools: runtime.definition.tools });
});

test('accessor definitions fail before getter evaluation', () => {
  let evaluated = false;
  const definition = { id: 'x', tools: [] };
  Object.defineProperty(definition, 'id', { get() { evaluated = true; return 'x'; }, enumerable: true });
  assert.throws(() => createAgentRuntime({ definition }), e => e instanceof AgentError && e.code === 'INVALID_DEFINITION');
  assert.equal(evaluated, false);
});

test('session lifecycle is deterministic and snapshots are immutable', async () => {
  const runtime = makeRuntime();
  const session = runtime.createSession({ id: 's1' });
  const initial = session.snapshot();
  assert.equal(initial.state, 'created');
  const completed = await session.runTurn('hello', { execute: async ({ messages }) => ({ output: `reply:${messages.at(-1).content}` }) });
  assert.equal(completed.state, 'completed');
  assert.equal(completed.output, 'reply:hello');
  assert.ok(Object.isFrozen(completed));
  assert.ok(Object.isFrozen(completed.messages));
});

test('tool calls use deterministic allowlisting and immutable results', async () => {
  const runtime = makeRuntime();
  const session = runtime.createSession({ id: 's2' });
  session.transition('running');
  const result = await session.invokeTool({ name: 'sum', input: { a: 2, b: 3 } });
  assert.deepEqual(result, { name: 'sum', ok: true, result: 5 });
  assert.ok(Object.isFrozen(result));
  await assert.rejects(() => session.invokeTool({ name: 'missing', input: {} }), e => e instanceof AgentError && e.code === 'TOOL_NOT_ALLOWED');
});

test('tool result accessors and circular values fail closed', async () => {
  const runtime = createAgentRuntime({ definition: { id: 'x', tools: [{ name: 'bad', handler: async () => { const value = {}; Object.defineProperty(value, 'secret', { get: () => 'x', enumerable: true }); return value; } }] } });
  const session = runtime.createSession();
  session.transition('running');
  await assert.rejects(() => session.invokeTool({ name: 'bad', input: {} }), e => e instanceof AgentError && e.code === 'INVALID_DEFINITION');
});

test('step, tool-call, message, output and result limits recover deterministically', async () => {
  const runtime = makeRuntime({ maxMessages: 2, maxSteps: 1, maxToolCalls: 1, maxOutputBytes: 4 });
  const session = runtime.createSession({ id: 'bounded' });
  await assert.rejects(() => session.runTurn('hello', { execute: async () => ({ output: '12345' }) }), e => e instanceof AgentError && e.code === 'LIMIT_EXCEEDED');
  const snapshot = session.snapshot();
  assert.equal(snapshot.state, 'failed');
  assert.throws(() => session.retry());
});

test('retry is bounded and returns session to running', () => {
  const runtime = makeRuntime({ maxRetries: 2 });
  const session = runtime.createSession({ id: 'retry' });
  session.transition('running');
  session.transition('failed');
  assert.equal(session.retry().state, 'running');
  session.transition('failed');
  assert.equal(session.retry().state, 'running');
  session.transition('failed');
  assert.throws(() => session.retry(), e => e instanceof AgentError && e.code === 'LIMIT_EXCEEDED');
});

test('cancel is terminal and blocks later execution', async () => {
  const runtime = makeRuntime();
  const session = runtime.createSession({ id: 'cancel' });
  session.cancel();
  assert.equal(session.state, 'cancelled');
  await assert.rejects(() => session.runTurn('nope'), e => e instanceof AgentError && e.code === 'INVALID_STATE');
});

test('external AbortSignal is honored before work starts', async () => {
  const runtime = makeRuntime();
  const session = runtime.createSession({ id: 'abort' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => session.runTurn('hello', { signal: controller.signal, execute: async () => ({ output: 'x' }) }), e => e instanceof AgentError && e.code === 'CANCELLED');
  assert.equal(session.state, 'cancelled');
});

test('timeout becomes typed terminal failure', async () => {
  const runtime = makeRuntime();
  const session = runtime.createSession({ id: 'timeout' });
  await assert.rejects(() => session.runTurn('slow', { timeoutMs: 1, execute: () => new Promise(resolve => setTimeout(() => resolve({ output: 'late' }), 10)) }), e => e instanceof AgentError && e.code === 'TIMEOUT');
  assert.equal(session.state, 'timed_out');
});

test('source input is never mutated', async () => {
  const runtime = makeRuntime();
  const input = { role: 'user', content: 'hello' };
  const before = JSON.stringify(input);
  const session = runtime.createSession();
  await session.runTurn(input, { execute: async () => ({ output: 'ok' }) });
  assert.equal(JSON.stringify(input), before);
});
