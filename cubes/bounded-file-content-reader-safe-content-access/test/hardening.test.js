import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileContent, readFileStream, FileContentReaderError } from '../src/index.js';

function capabilities(bytes, overrides = {}) {
  const state = { opened: 0, closed: 0, reads: 0 };
  const handle = {};
  return {
    state,
    open: async () => { state.opened += 1; return handle; },
    read: async (_handle, target, targetOffset, length, position) => {
      state.reads += 1;
      const available = Math.max(0, Math.min(length, bytes.length - position));
      for (let index = 0; index < available; index += 1) target[targetOffset + index] = bytes[position + index];
      return { bytesRead: available };
    },
    close: async () => { state.closed += 1; },
    lstat: async () => ({ isSymbolicLink: () => false }),
    stat: async () => ({ size: bytes.length, mtimeMs: 1, ino: 1, dev: 1 }),
    realpath: async (path) => path,
    contain: async () => true,
    now: () => 1000,
    ...overrides,
  };
}

async function expectCode(fn, code) {
  await assert.rejects(fn, (error) => error instanceof FileContentReaderError && error.code === code);
}

test('readFileStream is the canonical bounded streaming API and preserves backpressure', async () => {
  const caps = capabilities(new Uint8Array([97, 98, 99, 100]));
  const seen = [];
  const stream = readFileStream('/tmp/file', { chunkSize: 2 }, caps);
  for await (const chunk of stream) {
    seen.push([...chunk.data]);
    assert.ok(caps.state.reads <= seen.length);
  }
  assert.deepEqual(seen, [[97, 98], [99, 100]]);
  assert.equal(caps.state.closed, 1);
});

test('stream text decoding remains strict across split UTF-8 sequences', async () => {
  const bytes = new Uint8Array([0xe2, 0x82, 0xac, 65]);
  const caps = capabilities(bytes);
  const chunks = [];
  for await (const chunk of readFileStream('/tmp/file', { mode: 'text', chunkSize: 1 }, caps)) chunks.push(chunk.data);
  assert.deepEqual(chunks, ['', '', '€', 'A']);
  assert.equal(caps.state.closed, 1);
});

test('stream LF normalization handles CRLF split across chunks', async () => {
  const bytes = new TextEncoder().encode('a\r\nb');
  const caps = capabilities(bytes);
  const chunks = [];
  for await (const chunk of readFileStream('/tmp/file', { mode: 'text', chunkSize: 2, newline: 'lf' }, caps)) chunks.push(chunk.data);
  assert.equal(chunks.join(''), 'a\nb');
});

test('strict consistency degrades to best-effort when metadata capability is unavailable', async () => {
  const caps = capabilities(new Uint8Array([1, 2]), { stat: undefined });
  const result = await readFileContent('/tmp/file', {}, caps);
  assert.equal(result.consistency, 'best-effort');
});

test('cleanup failure does not replace a primary read failure', async () => {
  const caps = capabilities(new Uint8Array([1]), {
    read: async () => { throw Object.assign(new Error('read failure'), { code: 'EIO' }); },
    close: async () => { caps.state.closed += 1; throw Object.assign(new Error('close failure'), { code: 'EIO' }); },
  });
  await assert.rejects(
    () => readFileContent('/tmp/file', {}, caps),
    (error) => error.code === 'READ_FAILURE' && error.details?.cleanup?.code === 'CLOSE_FAILURE',
  );
  assert.equal(caps.state.opened, 1);
  assert.equal(caps.state.closed, 1);
});

test('work budget stops streaming before an additional read', async () => {
  const caps = capabilities(new Uint8Array([1, 2, 3, 4]));
  await expectCode(
    async () => {
      for await (const _chunk of readFileStream('/tmp/file', { chunkSize: 1, maxWorkUnits: 8 }, caps)) { /* consume */ }
    },
    'WORK_BUDGET_EXCEEDED',
  );
  assert.ok(caps.state.reads <= 1);
  assert.equal(caps.state.closed, 1);
});
