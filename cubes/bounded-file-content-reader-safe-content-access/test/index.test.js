import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readFileContent,
  readFileChunks,
  FileContentReaderError,
} from '../src/index.js';

async function fixture(content = 'hello\r\nworld') {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-reader-'));
  const file = join(root, 'file.txt');
  await writeFile(file, content, 'utf8');
  return { root, file };
}

async function expectRejectCode(fn, code) {
  await assert.rejects(
    fn,
    (error) => error instanceof FileContentReaderError && error.code === code,
  );
}

function capsFor(bytes, options = {}) {
  let closed = 0;
  let opened = 0;
  const handle = {
    bytes,
    close: async () => {
      closed += 1;
    },
  };

  return {
    state: () => ({ opened, closed }),
    open: async () => {
      opened += 1;
      return handle;
    },
    read: async (handleValue, target, targetOffset, length, position) => {
      const count = Math.max(
        0,
        Math.min(length, handleValue.bytes.length - position),
      );
      for (let i = 0; i < count; i += 1) {
        target[targetOffset + i] = handleValue.bytes[position + i];
      }
      return { bytesRead: count };
    },
    close: async (handleValue) => handleValue.close(),
    lstat: async () => options.lstat ?? { isSymbolicLink: () => false },
    stat: async () =>
      options.stat ?? { size: bytes.length, mtimeMs: 1, ino: 1, dev: 1 },
    realpath: async (path) => path,
    contain: async () => true,
    now: () => (options.now ? options.now() : 1000),
  };
}

test('binary read returns exact bytes and bounds output', async () => {
  const { root, file } = await fixture('abcdef');
  try {
    const out = await readFileContent(file, { mode: 'binary', length: 3 });
    assert.deepEqual([...out.data], [97, 98, 99]);
    assert.equal(out.actualBytes, 3);
    assert.equal(out.eof, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('offset and EOF semantics are deterministic', async () => {
  const { root, file } = await fixture('abcdef');
  try {
    const first = await readFileContent(file, {
      mode: 'binary',
      offset: 4,
      length: 10,
    });
    assert.deepEqual([...first.data], [101, 102]);
    assert.equal(first.eof, true);

    const second = await readFileContent(file, { mode: 'binary', offset: 99 });
    assert.equal(second.actualBytes, 0);
    assert.equal(second.eof, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('length zero does not open the file', async () => {
  const capabilities = capsFor(new TextEncoder().encode('abc'));
  const output = await readFileContent('/x', { length: 0 }, capabilities);
  assert.equal(output.actualBytes, 0);
  assert.equal(capabilities.state().opened, 0);
});

test('valid UTF-8 text and LF normalization', async () => {
  const { root, file } = await fixture('a\r\nb\rc');
  try {
    const output = await readFileContent(file, { mode: 'text', newline: 'lf' });
    assert.equal(output.text, 'a\nb\nc');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('invalid UTF-8 fails closed', async () => {
  const capabilities = capsFor(new Uint8Array([0xff, 0xff]));
  await expectRejectCode(
    () => readFileContent('/x', { mode: 'text' }, capabilities),
    'DECODE_ERROR',
  );
});

test('BOM policies are explicit', async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 97]);
  assert.equal(
    (await readFileContent('/x', { mode: 'text', bom: 'strip' }, capsFor(bytes))).text,
    'a',
  );
  assert.equal(
    (await readFileContent('/x', { mode: 'text', bom: 'preserve' }, capsFor(bytes))).text,
    '\uFEFFa',
  );
  await expectRejectCode(
    () => readFileContent('/x', { mode: 'text', bom: 'reject' }, capsFor(bytes)),
    'DECODE_ERROR',
  );
});

test('chunked mode is ordered and bounded', async () => {
  const capabilities = capsFor(new TextEncoder().encode('abcdefgh'));
  const chunks = [];
  for await (const item of readFileChunks('/x', { chunkSize: 2 }, capabilities)) {
    chunks.push(new TextDecoder().decode(item.data));
  }
  assert.deepEqual(chunks, ['ab', 'cd', 'ef', 'gh']);
  assert.equal(capabilities.state().closed, 1);
});

test('stream consumer cancellation closes owned handle', async () => {
  const controller = new AbortController();
  const capabilities = capsFor(new Uint8Array(16).fill(97));
  let seen = 0;
  try {
    for await (const _ of readFileChunks(
      '/x',
      { chunkSize: 2, signal: controller.signal },
      capabilities,
    )) {
      seen += 1;
      controller.abort();
    }
  } catch (error) {
    assert.equal(error.code, 'ABORTED');
  }
  assert.equal(capabilities.state().closed, 1);
  assert.ok(seen >= 1);
});

test('work budget is enforced', async () => {
  await expectRejectCode(
    () => readFileContent('/x', { maxWorkUnits: 1 }, capsFor(new Uint8Array(8))),
    'WORK_BUDGET_EXCEEDED',
  );
});

test('deadline is enforced', async () => {
  let tick = 0;
  const capabilities = capsFor(new Uint8Array(8), {
    now: () => {
      tick += 100;
      return tick;
    },
  });
  await expectRejectCode(
    () => readFileContent('/x', { deadlineMs: 50 }, capabilities),
    'DEADLINE_EXCEEDED',
  );
});

test('pre-aborted signal fails before open', async () => {
  const controller = new AbortController();
  controller.abort();
  const capabilities = capsFor(new Uint8Array(4));
  await expectRejectCode(
    () => readFileContent('/x', { signal: controller.signal }, capabilities),
    'ABORTED',
  );
  assert.equal(capabilities.state().opened, 0);
});

test('symlink reject and report policies are explicit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-link-'));
  const target = join(root, 'target');
  const link = join(root, 'link');
  try {
    await writeFile(target, 'x');
    await symlink(target, link);
    await expectRejectCode(() => readFileContent(link), 'SYMLINK_REJECTED');
    const report = await readFileContent(link, { symlinkPolicy: 'report' });
    assert.equal(report.kind, 'symlink');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('follow-contained accepts only contained targets', async () => {
  const capabilities = capsFor(new Uint8Array([97]));
  capabilities.lstat = async () => ({ isSymbolicLink: () => true });
  capabilities.realpath = async () => '/root/file';
  capabilities.contain = async (target, root) => target.startsWith(root);
  capabilities.open = async () => ({
    bytes: new Uint8Array([97]),
    close: async () => {},
  });

  const output = await readFileContent(
    '/root/link',
    { root: '/root', symlinkPolicy: 'follow-contained' },
    capabilities,
  );
  assert.equal(output.actualBytes, 1);

  capabilities.contain = async () => false;
  await expectRejectCode(
    () =>
      readFileContent(
        '/root/link',
        { root: '/root', symlinkPolicy: 'follow-contained' },
        capabilities,
      ),
    'ROOT_ESCAPE',
  );
});

test('relative path requires root', async () => {
  await expectRejectCode(() => readFileContent('./file'), 'INVALID_PATH');
});

test('root anchoring prevents escape', async () => {
  await expectRejectCode(
    () => readFileContent('../file', { root: '/root' }),
    'ROOT_ESCAPE',
  );
});

test('accessor options and capabilities are rejected before getter execution', async () => {
  let hit = false;
  const options = {};
  Object.defineProperty(options, 'maxBytes', {
    get() {
      hit = true;
      throw new Error('getter');
    },
  });
  await expectRejectCode(
    () => readFileContent('/x', options, capsFor(new Uint8Array(1))),
    'ACCESSOR_INPUT',
  );
  assert.equal(hit, false);

  const capabilities = capsFor(new Uint8Array(1));
  Object.defineProperty(capabilities, 'stat', {
    get() {
      hit = true;
      throw new Error('getter');
    },
  });
  await expectRejectCode(
    () => readFileContent('/x', {}, capabilities),
    'ACCESSOR_INPUT',
  );
  assert.equal(hit, false);
});

test('strict consistency detects file mutation when metadata changes', async () => {
  let count = 0;
  const capabilities = capsFor(new Uint8Array([97, 98]));
  capabilities.stat = async () => {
    count += 1;
    return { size: count === 1 ? 2 : 3, mtimeMs: count, ino: 1, dev: 1 };
  };
  await expectRejectCode(
    () => readFileContent('/x', {}, capabilities),
    'CHANGED_DURING_READ',
  );
});

test('results are immutable and inputs are preserved', async () => {
  const options = { mode: 'binary', length: 2 };
  const before = JSON.stringify(options);
  const output = await readFileContent(
    '/x',
    options,
    capsFor(new Uint8Array([1, 2])),
  );
  assert.equal(Object.isFrozen(output), true);
  assert.equal(JSON.stringify(options), before);
  assert.equal(Object.isFrozen(output.data), false);
});

test('diagnostics never include content bytes', async () => {
  const capabilities = capsFor(new Uint8Array([65, 66, 67]));
  capabilities.open = async () => {
    throw new Error('secret-file-content-ABC');
  };
  const output = await readFileContent(
    '/x',
    { partial: 'return' },
    capabilities,
  );
  assert.equal(output.ok, false);
  assert.equal(output.error.message.includes('ABC'), false);
});

test('capability read rejects invalid bytesRead', async () => {
  const capabilities = capsFor(new Uint8Array([1]));
  capabilities.read = async () => ({ bytesRead: -1 });
  await expectRejectCode(
    () => readFileContent('/x', {}, capabilities),
    'CAPABILITY_FAILURE',
  );
  assert.equal(capabilities.state().closed, 1);
});
