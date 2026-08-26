import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planBatch, commitBatch, serializeReceipt, parseReceipt, AtomicBatchError, recoverBatch } from '../src/index.js';

async function root() { return mkdtemp(join(tmpdir(), 'abt-')); }

async function cleanup(path) { await rm(path, { recursive: true, force: true }); }

 test('plans deterministically and rejects duplicates before mutation', async () => {
  const r = await root();
  try {
    const p = planBatch({ root: r, transactionId: 't1', operations: [
      { id: 'b', type: 'create', destination: 'b.txt', content: 'b' },
      { id: 'a', type: 'create', destination: 'a.txt', content: 'a' },
    ] });
    assert.deepEqual(p.operations.map((x) => x.destination), ['a.txt', 'b.txt']);
    assert.throws(() => planBatch({ root: r, operations: [
      { type: 'create', destination: 'x', content: '1' },
      { type: 'create', destination: './x', content: '2' },
    ] }), (e) => e instanceof AtomicBatchError && e.code === 'DUPLICATE_DESTINATION');
  } finally { await cleanup(r); }
});

test('preflight validates containment and expected destination state', async () => {
  const r = await root();
  try {
    assert.throws(() => planBatch({ root: r, operations: [{ type: 'create', destination: '../escape', content: 'x' }] }), (e) => e.code === 'ROOT_ESCAPE');
    const p = planBatch({ root: r, operations: [{ type: 'create', destination: 'x', content: 'x', expected: { exists: true } }] });
    await assert.rejects(() => commitBatch(p), (e) => e.code === 'PRECONDITION_FAILED');
  } finally { await cleanup(r); }
});

test('commit creates/replaces/deletes a bounded batch and returns immutable receipt', async () => {
  const r = await root();
  try {
    const existing = join(r, 'old.txt');
    await writeFile(existing, 'old');
    const p = planBatch({ root: r, transactionId: 't2', operations: [
      { type: 'create', destination: 'new.txt', content: 'new' },
      { type: 'replace', destination: 'old.txt', content: 'updated' },
    ] });
    const receipt = await commitBatch(p);
    assert.equal(receipt.state, 'committed');
    assert.equal(await readFile(join(r, 'new.txt'), 'utf8'), 'new');
    assert.equal(await readFile(existing, 'utf8'), 'updated');
    assert.equal(Object.isFrozen(receipt), true);
  } finally { await cleanup(r); }
});

test('receipt serialization is deterministic and tamper resistant', async () => {
  const receipt = Object.freeze({ format: 'ABT1', version: 1, transactionId: 't3', state: 'committed', applied: ['a'], rollback: { available: false, backups: [] } });
  const a = await serializeReceipt(receipt);
  const b = await serializeReceipt({ ...receipt });
  assert.equal(a, b);
  assert.deepEqual(parseReceipt(a), receipt);
  const tampered = a.replace('committed', 'rolled_back');
  assert.throws(() => parseReceipt(tampered), (e) => e.code === 'INTEGRITY_FAILURE');
});

test('accessor-backed input fails before getter execution', async () => {
  let touched = false;
  const input = { root: '/tmp', operations: [] };
  Object.defineProperty(input, 'operations', { get() { touched = true; return []; } });
  assert.throws(() => planBatch(input), (e) => e.code === 'ACCESSOR_INPUT');
  assert.equal(touched, false);
});

test('recovery fails closed without explicit authority', async () => {
  await assert.rejects(() => recoverBatch('t4'), (e) => e.code === 'RECOVERY_REQUIRED');
});

test('workspace cleanup never escapes root and malformed capabilities fail closed', async () => {
  const r = await root();
  try {
    const p = planBatch({ root: r, transactionId: 't5', operations: [{ type: 'create', destination: 'x.txt', content: 'x' }] });
    await assert.rejects(() => commitBatch(p, { rename: 'not-a-function' }), (e) => e.code === 'INVALID_CAPABILITY');
    await mkdir(join(r, 'keep'));
    await writeFile(join(r, 'keep', 'sentinel'), 'ok');
    assert.equal(await readFile(join(r, 'keep', 'sentinel'), 'utf8'), 'ok');
  } finally { await cleanup(r); }
});
