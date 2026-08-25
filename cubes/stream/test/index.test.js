import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_CHUNK_BYTES, StreamError, collect, createPipeline, runPipeline } from '../src/index.js';

async function* sourceOf(...chunks) {
  for (const chunk of chunks) yield chunk;
}

test('pipeline preserves order and applies transforms lazily', async () => {
  const seen = [];
  const pipeline = createPipeline(sourceOf(1, 2, 3), [async (value, context) => {
    seen.push(context.index);
    return value * 2;
  }]);
  assert.deepEqual(await collect(pipeline), [2, 4, 6]);
  assert.deepEqual(seen, [0, 1, 2]);
});

test('multiple transforms execute in order', async () => {
  const pipeline = createPipeline(sourceOf('a', 'b'), [
    value => value.toUpperCase(),
    value => `${value}!`,
  ]);
  assert.deepEqual(await collect(pipeline), ['A!', 'B!']);
});

test('runPipeline awaits sink writes and finalizes once', async () => {
  const output = [];
  let ended = 0;
  const result = await runPipeline(sourceOf('a', 'b', 'c'), [value => value + value], {
    async write(chunk) { output.push(chunk); },
    async end() { ended += 1; },
  });
  assert.deepEqual(output, ['aa', 'bb', 'cc']);
  assert.equal(ended, 1);
  assert.deepEqual(result, { chunks: 3 });
});

test('bounded chunks reject oversized input and output', async () => {
  await assert.rejects(() => collect(sourceOf('12345'), { maxChunkBytes: 4 }), error => error instanceof StreamError && error.code === 'CHUNK_TOO_LARGE');
  assert.throws(() => createPipeline(sourceOf('a'), [null], { maxChunkBytes: 4 }), error => error instanceof StreamError && error.code === 'INVALID_TRANSFORM');
  const pipeline = createPipeline(sourceOf('a'), [() => '12345'], { maxChunkBytes: 4 });
  await assert.rejects(() => collect(pipeline), error => error instanceof StreamError && error.code === 'CHUNK_TOO_LARGE');
});

test('cancellation stops the pipeline deterministically', async () => {
  const controller = new AbortController();
  async function* cancellingSource() {
    yield 'a';
    controller.abort();
    yield 'b';
  }
  await assert.rejects(() => collect(cancellingSource(), { signal: controller.signal }), error => error instanceof StreamError && error.code === 'CANCELLED');
});

test('source, transform, and sink failures are typed', async () => {
  async function* brokenSource() { throw new Error('source boom'); }
  await assert.rejects(() => collect(brokenSource()), error => error instanceof StreamError && error.code === 'SOURCE_FAILED');

  const brokenTransform = createPipeline(sourceOf('x'), [() => { throw new Error('transform boom'); }]);
  await assert.rejects(() => collect(brokenTransform), error => error instanceof StreamError && error.code === 'TRANSFORM_FAILED');

  const failed = [];
  await assert.rejects(() => runPipeline(sourceOf('x'), [], {
    async write() { throw new Error('sink boom'); },
    async fail(error) { failed.push(error.code); },
  }), error => error instanceof StreamError && error.code === 'SINK_FAILED');
  assert.deepEqual(failed, ['SINK_FAILED']);
});

test('sink cleanup failure does not hide the original failure', async () => {
  await assert.rejects(() => runPipeline(sourceOf('x'), [], {
    async write() { throw new Error('primary'); },
    async fail() { throw new Error('cleanup'); },
  }), error => error instanceof StreamError && error.code === 'SINK_FAILED');
});

test('collect enforces a bounded chunk count', async () => {
  await assert.rejects(() => collect(sourceOf(1, 2, 3), { maxChunks: 2 }), error => error instanceof StreamError && error.code === 'BUFFER_LIMIT');
});

test('invalid contracts fail early and the default chunk limit is finite', () => {
  assert.equal(DEFAULT_MAX_CHUNK_BYTES, 1_048_576);
  assert.throws(() => createPipeline({}, []), error => error instanceof StreamError && error.code === 'INVALID_SOURCE');
  assert.throws(() => createPipeline(sourceOf('x'), [null]), error => error instanceof StreamError && error.code === 'INVALID_TRANSFORM');
  assert.throws(() => createPipeline(sourceOf('x'), [], { maxChunkBytes: 0 }), error => error instanceof StreamError && error.code === 'INVALID_LIMIT');
});
