import test from 'node:test';
import assert from 'node:assert/strict';
import { createNdjsonProcessAdapter, createRuntime, InferenceError } from '../src/index.js';

function echoAdapter() {
  return {
    async infer(request) {
      return { text: request.messages.map(m => `${m.role}:${m.content}`).join('|'), usage: { input: request.messages.length } };
    },
    async stream(request) {
      const text = request.messages.at(-1).content;
      return (async function* () {
        for (const part of [text.slice(0, 1), text.slice(1)]) yield { type: 'delta', text: part };
      })();
    },
  };
}

test('normalizes ordered messages and returns immutable result', async () => {
  const runtime = createRuntime({ adapter: echoAdapter() });
  const input = { messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] };
  const result = await runtime.infer(input);
  assert.equal(result.text, 'system:S|user:U');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.request));
  assert.equal(result.request.messages[1].content, 'U');
  assert.deepEqual(input, { messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] });
});

test('stream emits deterministic start, deltas, and done', async () => {
  const runtime = createRuntime({ adapter: echoAdapter() });
  const events = [];
  for await (const event of runtime.stream({ messages: [{ role: 'user', content: 'hello' }] })) events.push(event);
  assert.deepEqual(events.map(e => e.type), ['start', 'delta', 'delta', 'done']);
  assert.equal(events.filter(e => e.type === 'delta').map(e => e.text).join(''), 'hello');
});

test('message and context bounds fail closed and later valid requests recover', async () => {
  const runtime = createRuntime({ adapter: echoAdapter(), limits: { maxMessages: 1, maxMessageBytes: 4, maxContextBytes: 4 } });
  await assert.rejects(() => runtime.infer({ messages: [{ role: 'user', content: 'hello' }] }), error => error instanceof InferenceError && error.code === 'BOUNDS_EXCEEDED');
  const result = await runtime.infer({ messages: [{ role: 'user', content: 'ok' }] });
  assert.equal(result.text, 'user:ok');
});

test('accessor requests fail before getter evaluation', async () => {
  const runtime = createRuntime({ adapter: echoAdapter() });
  let evaluated = false;
  const request = {};
  Object.defineProperty(request, 'messages', { get() { evaluated = true; return [{ role: 'user', content: 'x' }]; }, enumerable: true });
  await assert.rejects(() => runtime.infer(request), error => error instanceof InferenceError && error.code === 'INVALID_CONFIG');
  assert.equal(evaluated, false);
});

test('cancellation is distinct from timeout', async () => {
  const runtime = createRuntime({ adapter: { async infer(_request, { signal }) { await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 200); signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); }); return { text: 'late' }; } } });
  const controller = new AbortController();
  const pending = runtime.infer({ messages: [{ role: 'user', content: 'x' }] }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(() => pending, error => error instanceof InferenceError && error.code === 'CANCELLED');
});

test('timeout aborts owned work', async () => {
  const runtime = createRuntime({ adapter: { async infer(_request, { signal }) { await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 200); signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); }); return { text: 'late' }; } } , limits: { timeoutMs: 20 } });
  await assert.rejects(() => runtime.infer({ messages: [{ role: 'user', content: 'x' }] }), error => error instanceof InferenceError && error.code === 'TIMEOUT');
});

test('malformed adapter result is rejected', async () => {
  const runtime = createRuntime({ adapter: { async infer() { return { text: 42 }; } } });
  await assert.rejects(() => runtime.infer({ messages: [{ role: 'user', content: 'x' }] }), error => error instanceof InferenceError && error.code === 'ADAPTER_PROTOCOL');
});

test('stream output bounds are enforced', async () => {
  const runtime = createRuntime({ limits: { maxOutputBytes: 3 }, adapter: { async stream() { return (async function* () { yield { type: 'delta', text: 'ab' }; yield { type: 'delta', text: 'cd' }; })(); } } });
  const stream = runtime.stream({ messages: [{ role: 'user', content: 'x' }] });
  const first = await stream.next();
  assert.equal(first.value.type, 'start');
  assert.deepEqual((await stream.next()).value, { type: 'delta', text: 'ab' });
  await assert.rejects(() => stream.next(), error => error instanceof InferenceError && error.code === 'BOUNDS_EXCEEDED');
});

test('native NDJSON process adapter returns a result without shell execution', async () => {
  const command = process.execPath;
  const script = "process.stdin.setEncoding('utf8'); let buf=''; process.stdin.on('data',d=>buf+=d); process.stdin.on('end',()=>{ const r=JSON.parse(buf.trim()); process.stdout.write(JSON.stringify({type:'result',text:r.messages[0].content.toUpperCase()})+'\\n'); });";
  const runtime = createRuntime({ adapter: createNdjsonProcessAdapter({ command, args: ['-e', script] }) });
  const result = await runtime.infer({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(result.text, 'HELLO');
});

test('native process non-zero exit becomes typed failure', async () => {
  const adapter = createNdjsonProcessAdapter({ command: process.execPath, args: ['-e', 'process.exit(7)'] });
  const runtime = createRuntime({ adapter });
  await assert.rejects(() => runtime.infer({ messages: [{ role: 'user', content: 'x' }] }), error => error instanceof InferenceError && error.code === 'PROCESS_EXIT');
});

test('runtime errors do not copy arbitrary provider payloads', async () => {
  const runtime = createRuntime({ adapter: { async infer() { throw new Error('SECRET-PAYLOAD-123'); } } });
  const error = await runtime.infer({ messages: [{ role: 'user', content: 'x' }] }).then(() => null, e => e);
  assert.equal(error.code, 'ADAPTER_FAILURE');
  assert.equal(error.message, 'Inference adapter failed');
});
