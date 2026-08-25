import { createHash, randomUUID } from 'node:crypto';
import { fsync as fsyncCallback } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, resolve, sep } from 'node:path';

const FORMAT = 'AFW1';
const MAX_PATH = 4096;
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_METADATA = 4096;
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const fsyncAsync = promisify(fsyncCallback);

export class AtomicFileWriterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AtomicFileWriterError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) {
  throw new AtomicFileWriterError(code, message);
}

function capability(value, label) {
  if (typeof value !== 'function') fail('INVALID_CAPABILITY', `${label} must be a function`);
  return value;
}

function validateData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('LIMIT_EXCEEDED', `${label} exceeds maximum depth`);
  if (value === null) return;
  const type = typeof value;
  if (['undefined', 'function', 'symbol', 'bigint'].includes(type)) fail('UNSUPPORTED_INPUT', `${label} contains unsupported data`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_INPUT', `${label} contains a non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_INPUT', `${label} must be plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_INPUT', `${label} contains symbol keys`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validateData(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function canonical(value) {
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);
}

function toBytes(data) {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (Buffer.isBuffer(data)) return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  fail('UNSUPPORTED_INPUT', 'data must be string, Buffer, or Uint8Array');
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function isInside(parent, child) {
  const root = resolve(parent);
  const target = resolve(child);
  const relative = target.slice(root.length);
  return target !== root && (relative.startsWith(sep) || root.endsWith(sep));
}

function normalizeOptions(raw, path) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_OPTIONS', 'options must be a plain object');
  const proto = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', 'options must be a plain object');
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_INPUT', 'options contains symbol keys');
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }

  if (typeof path !== 'string' || !path) fail('INVALID_DESTINATION', 'path must be a non-empty string');
  if (path.length > MAX_PATH) fail('LIMIT_EXCEEDED', 'path exceeds maximum length');

  const modePolicy = raw.modePolicy ?? 'default';
  if (!['default', 'preserve-existing', 'explicit'].includes(modePolicy)) fail('INVALID_MODE_POLICY', 'unsupported mode policy');
  if (modePolicy === 'explicit' && (!Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 0o7777)) fail('INVALID_MODE_POLICY', 'explicit mode is invalid');

  const durability = raw.durability ?? 'none';
  if (!['none', 'file', 'file-and-directory'].includes(durability)) fail('INVALID_DURABILITY', 'unsupported durability mode');

  const metadata = raw.metadata ?? null;
  if (metadata !== null) {
    validateData(metadata, 'metadata');
    if (Buffer.byteLength(canonical(metadata), 'utf8') > MAX_METADATA) fail('LIMIT_EXCEEDED', 'metadata exceeds maximum size');
  }

  const idGenerator = raw.idGenerator ?? randomUUID;
  capability(idGenerator, 'idGenerator');
  const clock = raw.clock ?? { now: () => Date.now() };
  if (!clock || typeof clock.now !== 'function') fail('INVALID_CAPABILITY', 'clock must expose now()');
  const fsOps = raw.fsOps ?? { mkdir, open, rename, lstat, unlink, chmod };
  for (const name of ['mkdir', 'open', 'rename', 'lstat', 'unlink', 'chmod']) capability(fsOps[name], `fsOps.${name}`);
  if (durability !== 'none') capability(raw.fsync ?? fsyncAsync, 'fsync');

  const expectedDigest = raw.digest ?? null;
  if (expectedDigest !== null) {
    if (typeof expectedDigest !== 'string' || !expectedDigest.startsWith('sha256:') || !HEX_SHA256.test(expectedDigest.slice(7))) fail('INVALID_DIGEST', 'digest must be sha256:<64 lowercase hex>');
  }

  return {
    path: resolve(path), modePolicy, mode: raw.mode, durability, metadata,
    idGenerator, clock, fsOps, fsync: raw.fsync ?? fsyncAsync, expectedDigest,
  };
}

async function inspectDestination(fsOps, destination) {
  try {
    const info = await fsOps.lstat(destination);
    if (info.isSymbolicLink?.()) fail('UNSAFE_SYMLINK', 'symbolic-link destination is not allowed');
    if (!info.isFile?.()) fail('DESTINATION_NOT_REGULAR', 'destination is not a regular file');
    return { exists: true, mode: info.mode };
  } catch (error) {
    if (error instanceof AtomicFileWriterError) throw error;
    if (error?.code === 'ENOENT') return { exists: false, mode: null };
    if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'destination cannot be inspected');
    fail('INVALID_DESTINATION', 'destination cannot be inspected');
  }
}

async function inspectDirectory(fsOps, directory) {
  try {
    const info = await fsOps.lstat(directory);
    if (info.isSymbolicLink?.() || !info.isDirectory?.()) fail('INVALID_DESTINATION', 'destination parent must be a real directory');
  } catch (error) {
    if (error instanceof AtomicFileWriterError) throw error;
    fail('INVALID_DESTINATION', 'destination parent cannot be inspected');
  }
}

async function closeHandle(handle) {
  if (!handle) return;
  try { await handle.close(); } catch { /* best effort */ }
}

export async function writeFileAtomic(path, input, options = {}) {
  const opts = normalizeOptions(options, path);
  const { path: destination, modePolicy, mode, durability, metadata, idGenerator, clock, fsOps, fsync: sync, expectedDigest } = opts;
  const directory = dirname(destination);
  await inspectDirectory(fsOps, directory);
  const destinationState = await inspectDestination(fsOps, destination);
  const operationId = String(idGenerator());
  if (!/^[A-Za-z0-9-]{8,128}$/.test(operationId)) fail('INVALID_OPERATION_ID', 'generated operation id is invalid');
  const candidate = resolve(directory, `.${destination.split(sep).pop()}.sovereign-${operationId}.tmp`);
  if (!isInside(directory, candidate)) fail('PATH_ESCAPE', 'temporary candidate escapes destination directory');

  const bytes = typeof input === 'function' ? null : toBytes(input);
  if (bytes && bytes.byteLength > MAX_BYTES) fail('LIMIT_EXCEEDED', 'input exceeds maximum size');

  let handle = null;
  let owned = false;
  let written = 0;
  let candidateDigest = null;

  const cleanup = async () => {
    if (!owned) return null;
    try {
      await fsOps.unlink(candidate);
      owned = false;
    } catch (error) {
      if (error?.code === 'ENOENT') owned = false;
      else return new AtomicFileWriterError('CANDIDATE_CLEANUP_FAILED', 'temporary candidate cleanup failed');
    }
    return null;
  };

  try {
    try { handle = await fsOps.open(candidate, 'wx'); owned = true; }
    catch (error) {
      if (error?.code === 'EEXIST') fail('CANDIDATE_COLLISION', 'temporary candidate already exists');
      if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'temporary candidate cannot be created');
      fail('CANDIDATE_CREATION_FAILED', 'temporary candidate could not be created');
    }

    const hash = createHash('sha256');
    const writer = freezeDeep({
      async write(chunk) {
        const chunkBytes = toBytes(chunk);
        if (written + chunkBytes.byteLength > MAX_BYTES) fail('LIMIT_EXCEEDED', 'streamed input exceeds maximum size');
        await handle.write(chunkBytes);
        hash.update(chunkBytes);
        written += chunkBytes.byteLength;
      },
    });

    if (bytes) await writer.write(bytes);
    else {
      const result = await input(writer);
      if (result !== undefined) validateData(result, 'writer result');
    }

    candidateDigest = `sha256:${hash.digest('hex')}`;
    await closeHandle(handle);
    handle = null;

    if (expectedDigest && candidateDigest !== expectedDigest) fail('DIGEST_MISMATCH', 'candidate digest does not match expected digest');

    if (modePolicy === 'preserve-existing' && destinationState.exists) await fsOps.chmod(candidate, destinationState.mode & 0o7777);
    if (modePolicy === 'explicit') await fsOps.chmod(candidate, mode);

    if (durability !== 'none') {
      const fd = await fsOps.open(candidate, 'r');
      try { await sync(fd.fd); } finally { await closeHandle(fd); }
      if (durability === 'file-and-directory') {
        const dirFd = await fsOps.open(directory, 'r');
        try { await sync(dirFd.fd); } finally { await closeHandle(dirFd); }
      }
    }

    try { await fsOps.rename(candidate, destination); owned = false; }
    catch (error) {
      if (error?.code === 'EXDEV') fail('CROSS_DEVICE_REPLACEMENT', 'atomic replacement cannot cross filesystem devices');
      if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'destination replacement permission denied');
      fail('REPLACEMENT_FAILED', 'atomic destination replacement failed');
    }

    if (durability === 'file-and-directory') {
      const dirFd = await fsOps.open(directory, 'r');
      try { await sync(dirFd.fd); } finally { await closeHandle(dirFd); }
    }

    return freezeDeep({
      format: FORMAT, operationId, destination, bytesWritten: written, digest: candidateDigest,
      existedBefore: destinationState.exists, replaced: true, durability, metadata,
      timestamp: new Date(clock.now()).toISOString(),
    });
  } catch (error) {
    await closeHandle(handle);
    const cleanupError = await cleanup();
    if (error instanceof AtomicFileWriterError) {
      if (cleanupError) fail(cleanupError.code, `${error.message}; ${cleanupError.message}`);
      throw error;
    }
    if (cleanupError) throw cleanupError;
    fail('WRITE_FAILED', 'atomic file write failed');
  }
}

export const ATOMIC_FILE_WRITER_FORMAT = FORMAT;
export const ATOMIC_FILE_WRITER_DURABILITY = Object.freeze(['none', 'file', 'file-and-directory']);
