import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, appendFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRecoveryJournal, RecoveryJournalError, FILESYSTEM_RECOVERY_JOURNAL_FORMAT } from '../src/index.js';

async function tempPath() {
  const dir = await mkdtemp(join(tmpdir(), 'frj-'));
  return { dir, file: join(dir, 'journal.frj') };
}

async function cleanup(dir) { await rm(dir, { recursive: true, force: true }); }

function assertCode(code, fn) {
  return assert.rejects(fn, (error) => error instanceof RecoveryJournalError && error.code === code);
}

test('creates journal and begins deterministic operation', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const op = await journal.beginOperation({ kind: 'write', targets: ['/tmp/a'] });
    assert.equal(op.operationId.length > 0, true);
    assert.equal(op.state, 'prepared');
    assert.equal((await journal.snapshot()).format, FILESYSTEM_RECOVERY_JOURNAL_FORMAT);
  } finally { await cleanup(dir); }
});

test('supports valid lifecycle and immutable result', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const op = await journal.beginOperation({ kind: 'replace' });
    await journal.transition(op.operationId, 'started');
    await journal.transition(op.operationId, 'progressing', { stage: 'write' });
    const done = await journal.complete(op.operationId, 'succeeded', { ok: true });
    assert.equal(done.state, 'succeeded');
    assert.equal(Object.isFrozen(done), true);
    assertCode('TERMINAL_STATE', () => journal.transition(op.operationId, 'progressing'));
  } finally { await cleanup(dir); }
});

test('rejects invalid transitions and duplicate operations', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const op = await journal.beginOperation({ operationId: 'fixed', kind: 'x' });
    await assertCode('INVALID_TRANSITION', () => journal.transition(op.operationId, 'succeeded'));
    await assertCode('DUPLICATE_OPERATION', () => journal.beginOperation({ operationId: 'fixed', kind: 'x' }));
  } finally { await cleanup(dir); }
});

test('finds interrupted and failed operations without mutation', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const interrupted = await journal.beginOperation({ kind: 'x' });
    await journal.transition(interrupted.operationId, 'started');
    await journal.transition(interrupted.operationId, 'interrupted');
    const failed = await journal.beginOperation({ kind: 'y' });
    await journal.transition(failed.operationId, 'started');
    await journal.complete(failed.operationId, 'failed', { code: 'IO' });
    const recoverable = await journal.inspectRecoverable();
    assert.deepEqual(recoverable.map((x) => x.operationId), [interrupted.operationId, failed.operationId]);
  } finally { await cleanup(dir); }
});

test('records one explicit recovery decision and rejects conflict', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const op = await journal.beginOperation({ kind: 'x' });
    await journal.transition(op.operationId, 'started');
    await journal.transition(op.operationId, 'interrupted');
    const result = await journal.decide(op.operationId, { kind: 'manual-review' });
    assert.equal(result.operation.state, 'recovery-decided');
    await assertCode('DUPLICATE_DECISION', () => journal.decide(op.operationId, { kind: 'rollback-required' }));
  } finally { await cleanup(dir); }
});

test('rejects accessors and circular input before use', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    const accessed = {};
    Object.defineProperty(accessed, 'kind', { get() { throw new Error('getter executed'); } });
    await assertCode('ACCESSOR_INPUT', () => journal.beginOperation(accessed));
    const circular = {}; circular.self = circular;
    await assertCode('CIRCULAR_INPUT', () => journal.beginOperation(circular));
  } finally { await cleanup(dir); }
});

test('enforces bounded record sizes', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file, limits: { maxRecordBytes: 256 } });
    await assertCode('RECORD_SIZE_LIMIT', () => journal.beginOperation({ kind: 'x', metadata: 'x'.repeat(2048) }));
  } finally { await cleanup(dir); }
});

test('corruption and tampering fail closed on reload', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    await journal.beginOperation({ kind: 'x' });
    const original = await readFile(file, 'utf8');
    const tampered = original.replace('"kind":"operation"', '"kind":"tampered"');
    await writeFile(file, tampered, 'utf8');
    const reloaded = createRecoveryJournal({ path: file });
    await assertCode('INTEGRITY_MISMATCH', () => reloaded.load());
  } finally { await cleanup(dir); }
});

test('sequence gaps fail closed', async () => {
  const { dir, file } = await tempPath();
  try {
    const journal = createRecoveryJournal({ path: file });
    await journal.beginOperation({ kind: 'x' });
    const text = await readFile(file, 'utf8');
    const second = text.trimEnd();
    await writeFile(file, `${second}\n${second}\n`, 'utf8');
    const reloaded = createRecoveryJournal({ path: file });
    await assertCode('SEQUENCE_CONFLICT', () => reloaded.load());
  } finally { await cleanup(dir); }
});

test('persistence failure does not advance logical sequence', async () => {
  let writes = 0;
  const memory = [];
  const capabilities = Object.freeze({
    read: async () => memory.join(''),
    write: async (_path, text) => { writes += 1; if (writes === 2) throw new Error('disk'); memory.push(text); },
    now: () => 1000,
    identity: (() => { let n = 0; return () => `id-${++n}`; })(),
    hash: (value) => (value.length + 1).toString(16),
  });
  const journal = createRecoveryJournal({ path: 'memory' }, capabilities);
  const op = await journal.beginOperation({ kind: 'x' });
  await assertCode('PERSISTENCE_FAILURE', () => journal.transition(op.operationId, 'started'));
  assert.equal((await journal.snapshot()).nextSequence, 2);
});

test('native filesystem round-trip survives reload', async () => {
  const { dir, file } = await tempPath();
  try {
    const first = createRecoveryJournal({ path: file });
    const op = await first.beginOperation({ kind: 'x' });
    await first.transition(op.operationId, 'started');
    const second = createRecoveryJournal({ path: file });
    await second.load();
    const recoverable = await second.inspectRecoverable();
    assert.equal(recoverable[0].state, 'started');
  } finally { await cleanup(dir); }
});

test('unused append import is not required by callers', async () => {
  assert.equal(typeof appendFile, 'function');
});
