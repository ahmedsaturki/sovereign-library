import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, readFile, lstat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { quarantineItem, restoreQuarantined, purgeQuarantined, SafeFileQuarantineError } from '../src/index.js';

async function expectCode(fn, code) {
  await assert.rejects(fn, (error) => error instanceof SafeFileQuarantineError && error.code === code);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sovereign-quarantine-'));
  const source = join(root, 'source');
  const quarantine = join(root, 'quarantine');
  await mkdir(quarantine);
  await writeFile(source, 'secret-content');
  return { root, source, quarantine };
}

test('quarantines and restores a regular file without copy fallback', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    const receipt = await quarantineItem(source, { quarantineRoot: quarantine });
    assert.equal(receipt.format, 'SFQ1');
    assert.equal(receipt.status, 'quarantined');
    await assert.rejects(() => lstat(source));
    assert.equal((await readFile(receipt.payloadPath, 'utf8')), 'secret-content');

    const restored = await restoreQuarantined(receipt);
    assert.equal(restored.status, 'restored');
    assert.equal(await readFile(source, 'utf8'), 'secret-content');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('quarantines a directory tree and preserves its contents', async () => {
  const { root, source, quarantine } = await fixture();
  const dir = join(root, 'folder');
  await rm(source, { force: true });
  await mkdir(join(dir, 'nested'), { recursive: true });
  await writeFile(join(dir, 'nested', 'a.txt'), 'A');
  try {
    const receipt = await quarantineItem(dir, { quarantineRoot: quarantine });
    assert.equal(receipt.kind, 'directory');
    assert.equal(await readFile(join(receipt.payloadPath, 'nested', 'a.txt'), 'utf8'), 'A');
    await restoreQuarantined(receipt);
    assert.equal(await readFile(join(dir, 'nested', 'a.txt'), 'utf8'), 'A');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source symlink is rejected before mutation', async () => {
  const { root, source, quarantine } = await fixture();
  const target = join(root, 'target');
  const link = join(root, 'link');
  await writeFile(target, 'target');
  await symlink(target, link);
  try {
    await expectCode(() => quarantineItem(link, { quarantineRoot: quarantine }), 'SYMLINK_REJECTED');
    assert.equal(await readFile(target, 'utf8'), 'target');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('relative paths and relative quarantine roots fail closed', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    await expectCode(() => quarantineItem('./source', { quarantineRoot: quarantine }), 'INVALID_INPUT');
    await expectCode(() => quarantineItem(source, { quarantineRoot: './quarantine' }), 'INVALID_INPUT');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source and quarantine roots may not overlap', async () => {
  const { root, source } = await fixture();
  try {
    await expectCode(() => quarantineItem(source, { quarantineRoot: root }), 'ROOT_OVERLAP');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('restore never overwrites an existing destination', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    const receipt = await quarantineItem(source, { quarantineRoot: quarantine });
    await writeFile(source, 'newer');
    await expectCode(() => restoreQuarantined(receipt), 'DESTINATION_COLLISION');
    assert.equal(await readFile(source, 'utf8'), 'newer');
    assert.equal(await readFile(receipt.payloadPath, 'utf8'), 'secret-content');
    await purgeQuarantined(receipt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('purge requires the exact validated receipt and removes only quarantined payload', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    const receipt = await quarantineItem(source, { quarantineRoot: quarantine });
    const tampered = { ...receipt, token: `${receipt.token}-other` };
    await expectCode(() => purgeQuarantined(tampered), 'RECEIPT_MISMATCH');
    await purgeQuarantined(receipt);
    assert.equal(await lstat(receipt.payloadPath).then(() => true).catch(() => false), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cross-device rename fails closed and leaves source intact', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    const capabilities = {
      lstat,
      stat: async (p) => lstat(p),
      realpath: async (p) => p,
      mkdir: async (...args) => mkdir(...args),
      rename: async () => { const error = new Error('EXDEV'); error.code = 'EXDEV'; throw error; },
      readFile,
      writeFile,
      rm,
      now: () => 1,
      token: () => 'fixed-token',
      contain: async (target, base) => target !== base && target.startsWith(`${base}/`),
    };
    await expectCode(() => quarantineItem(source, { quarantineRoot: quarantine }, capabilities), 'CROSS_DEVICE_MOVE');
    assert.equal(await readFile(source, 'utf8'), 'secret-content');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('manifest write failure attempts rollback and exposes recovery', async () => {
  const { root, source, quarantine } = await fixture();
  try {
    const capabilities = {
      lstat,
      stat: async (p) => lstat(p),
      realpath: async (p) => p,
      mkdir: async (...args) => mkdir(...args),
      rename: async (...args) => import('node:fs/promises').then(({ rename }) => rename(...args)),
      readFile,
      writeFile: async () => { throw new Error('manifest down'); },
      rm,
      now: () => 1,
      token: () => 'rollback-token',
      contain: async (target, base) => target !== base && target.startsWith(`${base}/`),
    };
    await expectCode(() => quarantineItem(source, { quarantineRoot: quarantine }, capabilities), 'FILESYSTEM_FAILURE');
    assert.equal(await readFile(source, 'utf8'), 'secret-content');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('accessor-backed inputs fail before getter execution', async () => {
  let touched = false;
  const options = { quarantineRoot: '/tmp/q' };
  Object.defineProperty(options, 'root', { get() { touched = true; throw new Error('getter'); } });
  const { root, source, quarantine } = await fixture();
  try {
    options.quarantineRoot = quarantine;
    await expectCode(() => quarantineItem(source, options), 'ACCESSOR_INPUT');
    assert.equal(touched, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
