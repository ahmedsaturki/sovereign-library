import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_MAX_VALUE_BYTES = 5 * 1024 * 1024;

export class StorageCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'StorageCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

function validateName(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200 || value.includes('/') || value.includes('\\') || value === '.' || value === '..') {
    throw new StorageCubeError(`INVALID_${label.toUpperCase()}`, `${label} must be a non-empty safe name`);
  }
  return value;
}

function encode(value, maxBytes) {
  let json;
  try { json = JSON.stringify(value); }
  catch (error) { throw new StorageCubeError('INVALID_VALUE', 'Value is not JSON-safe', { cause: error }); }
  if (json === undefined) throw new StorageCubeError('INVALID_VALUE', 'Value is not JSON-serializable');
  const bytes = Buffer.byteLength(json);
  if (bytes > maxBytes) throw new StorageCubeError('VALUE_TOO_LARGE', `Value exceeds ${maxBytes} bytes`);
  return json;
}

function fileFor(root, namespace, key) {
  const digest = createHash('sha256').update(key).digest('hex');
  return join(root, namespace, `${digest}.json`);
}

async function atomicWrite(file, content) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  try {
    await (await import('node:fs/promises')).writeFile(temp, content, 'utf8');
    try {
      await rename(temp, file);
    } catch (error) {
      if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error.code)) throw error;
      await rm(file, { force: true });
      await rename(temp, file);
    }
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

export class Storage {
  constructor(options = {}) {
    if (typeof options.root !== 'string' || options.root.length === 0) throw new StorageCubeError('INVALID_ROOT', 'root must be a non-empty path');
    this.root = resolve(options.root);
    this.maxValueBytes = options.maxValueBytes ?? DEFAULT_MAX_VALUE_BYTES;
    if (!Number.isSafeInteger(this.maxValueBytes) || this.maxValueBytes <= 0) throw new StorageCubeError('INVALID_VALUE_LIMIT', 'maxValueBytes must be a positive safe integer');
  }

  async init() { await mkdir(this.root, { recursive: true }); return this; }

  async set(namespace, key, value, options = {}) {
    validateName(namespace, 'namespace');
    validateName(key, 'key');
    const json = encode({ version: 1, key, createdAt: Date.now(), expiresAt: options.ttlMs == null ? null : Date.now() + options.ttlMs, value }, this.maxValueBytes);
    if (options.ttlMs != null && (!Number.isSafeInteger(options.ttlMs) || options.ttlMs <= 0)) throw new StorageCubeError('INVALID_TTL', 'ttlMs must be a positive safe integer');
    await atomicWrite(fileFor(this.root, namespace, key), json);
    return true;
  }

  async get(namespace, key) {
    validateName(namespace, 'namespace');
    validateName(key, 'key');
    const file = fileFor(this.root, namespace, key);
    let raw;
    try { raw = await readFile(file, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw new StorageCubeError('READ_FAILED', `Unable to read key ${key}`, { cause: error, retryable: true });
    }
    let record;
    try { record = JSON.parse(raw); }
    catch (error) { throw new StorageCubeError('CORRUPT_RECORD', `Stored record for ${key} is invalid JSON`, { cause: error }); }
    if (!record || record.version !== 1 || record.key !== key) throw new StorageCubeError('CORRUPT_RECORD', `Stored record for ${key} is invalid`);
    if (record.expiresAt != null && Date.now() >= record.expiresAt) { await rm(file, { force: true }); return undefined; }
    return record.value;
  }

  async has(namespace, key) { return (await this.get(namespace, key)) !== undefined; }

  async delete(namespace, key) { validateName(namespace, 'namespace'); validateName(key, 'key'); await rm(fileFor(this.root, namespace, key), { force: true }); return true; }

  async list(namespace) {
    validateName(namespace, 'namespace');
    const dir = join(this.root, namespace);
    let entries;
    try { entries = await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return Promise.all(entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(async e => {
      const file = join(dir, e.name);
      try { const record = JSON.parse(await readFile(file, 'utf8')); if (record.expiresAt != null && Date.now() >= record.expiresAt) { await rm(file, { force: true }); return null; } return record.key; }
      catch { throw new StorageCubeError('CORRUPT_RECORD', `Stored record ${e.name} is invalid`); }
    })).then(values => values.filter(Boolean).sort());
  }

  async info(namespace, key) {
    validateName(namespace, 'namespace');
    validateName(key, 'key');
    const file = fileFor(this.root, namespace, key);
    try { const meta = await stat(file); return { path: file, bytes: meta.size, modifiedAt: meta.mtimeMs }; }
    catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  }
}
