import { mkdir, readFile, writeFile, rename, rm, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const FORMAT = 'FLC1';
const MAX_PATH = 4096;
const MAX_RECORD = 16 * 1024;
const MAX_METADATA = 4096;
const MAX_RENEW_MS = 24 * 60 * 60 * 1000;
const MAX_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const STATES = Object.freeze(['created', 'acquiring', 'acquired', 'renewing', 'releasing', 'released', 'busy', 'expired', 'lost', 'failed', 'unsupported']);

export class FileLeaseError extends Error {
  constructor(code, message) { super(message); this.name = 'FileLeaseError'; this.code = code; Object.freeze(this); }
}
function fail(code, message) { throw new FileLeaseError(code, message); }

function validateData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('DEPTH_LIMIT', `${label} exceeds depth limit`);
  if (value === null) return;
  const type = typeof value;
  if (type === 'undefined' || type === 'function' || type === 'symbol' || type === 'bigint') fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', `${label} contains a symbol key`);
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    validateData(d.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}
function canonical(value) { return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((k) => [k, item[k]])) : item); }
function hash(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function freezeDeep(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freezeDeep(child); return Object.freeze(value); }
function boundedText(value, label, max = MAX_PATH) { if (typeof value !== 'string' || !value) fail('INVALID_INPUT', `${label} must be a non-empty string`); if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max}`); return value; }
function parseIso(value, label) { boundedText(value, label, 64); const date = new Date(value); if (Number.isNaN(date.getTime())) fail('INVALID_TIMESTAMP', `${label} is invalid`); return date.toISOString(); }
function normalizeOptions(raw = {}) {
  validateData(raw, 'options');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_OPTIONS', 'options must be a plain object');
  const resourcePath = resolve(boundedText(raw.resourcePath, 'resourcePath'));
  if (resourcePath.length > MAX_PATH) fail('LIMIT_EXCEEDED', 'resourcePath exceeds maximum length');
  const lockPath = resolve(boundedText(raw.lockPath ?? `${resourcePath}.sovereign-lease`, 'lockPath'));
  if (lockPath.length > MAX_PATH) fail('LIMIT_EXCEEDED', 'lockPath exceeds maximum length');
  const ttlMs = raw.ttlMs ?? 0;
  if (!Number.isInteger(ttlMs) || ttlMs < 0 || ttlMs > MAX_RENEW_MS) fail('INVALID_TTL', 'ttlMs is invalid');
  const staleRecovery = raw.staleRecovery ?? false;
  if (typeof staleRecovery !== 'boolean') fail('INVALID_RECOVERY', 'staleRecovery must be boolean');
  const owner = raw.owner ?? null;
  if (owner !== null) validateData(owner, 'owner');
  if (owner !== null && Buffer.byteLength(canonical(owner), 'utf8') > MAX_METADATA) fail('LIMIT_EXCEEDED', 'owner metadata exceeds maximum size');
  const clock = raw.clock ?? (() => Date.now());
  const uuid = raw.uuid ?? (() => randomUUID());
  const fsOps = raw.fsOps ?? { mkdir, readFile, writeFile, rename, rm, readdir };
  if (!clock || !uuid || !fsOps || typeof clock.now !== 'function') fail('INVALID_SEAM', 'clock must expose now() and uuid/fs operations must be valid');
  return { resourcePath, lockPath, ttlMs, staleRecovery, owner, clock, uuid, fsOps };
}

function makePayload(record) {
  const payload = canonical(record);
  if (Buffer.byteLength(payload, 'utf8') > MAX_RECORD) fail('LIMIT_EXCEEDED', 'lock record exceeds maximum size');
  return { format: FORMAT, checksum: hash(payload), payload };
}
function parseRecord(serialized) {
  let envelope; try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_LOCK_RECORD', 'lock record is not JSON'); }
  validateData(envelope, 'lockRecord');
  if (envelope.format !== FORMAT || typeof envelope.payload !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.checksum ?? '')) fail('MALFORMED_LOCK_RECORD', 'lock record envelope is invalid');
  if (hash(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'lock record checksum mismatch');
  let payload; try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_LOCK_RECORD', 'lock record payload is not JSON'); }
  validateData(payload, 'lockRecord.payload');
  return payload;
}

export async function acquireLease(options) {
  const normalized = normalizeOptions(options);
  const { fsOps, clock, uuid, lockPath, ttlMs, staleRecovery, owner, resourcePath } = normalized;
  const leaseId = String(uuid());
  if (!/^[A-Za-z0-9-]{8,128}$/.test(leaseId)) fail('INVALID_LEASE_ID', 'generated lease id is invalid');
  const ownerPath = `${lockPath}/owner-${leaseId}.json`;
  const acquiredAt = new Date(clock.now()).toISOString();
  const expiresAt = ttlMs > 0 ? new Date(clock.now() + ttlMs).toISOString() : null;
  const record = { format: FORMAT, leaseId, resourcePath, lockPath, owner, acquiredAt, expiresAt };
  let state = 'acquiring';
  let lost = false;
  const exists = async () => { try { await fsOps.readdir(lockPath); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } };
  const readCurrent = async () => { const entries = await fsOps.readdir(lockPath); const ownerFile = entries.find((name) => /^owner-[A-Za-z0-9-]+\.json$/.test(name)); if (!ownerFile) fail('MALFORMED_LOCK_RECORD', 'lock directory has no owner record'); return parseRecord(await fsOps.readFile(`${lockPath}/${ownerFile}`, 'utf8')); };
  async function recoverStale() {
    if (!staleRecovery) return false;
    let current; try { current = await readCurrent(); } catch (error) { if (error.code === 'MALFORMED_LOCK_RECORD' || error.code === 'INTEGRITY_MISMATCH') throw error; throw error; }
    if (!current.expiresAt) return false;
    const expiration = Date.parse(current.expiresAt);
    const now = clock.now();
    if (!Number.isFinite(expiration) || expiration > now) return false;
    const quarantine = `${lockPath}.stale-${uuid()}`;
    await fsOps.rename(lockPath, quarantine);
    try { await fsOps.rm(quarantine, { recursive: true, force: true }); } catch { /* best-effort quarantine cleanup */ }
    return true;
  }
  try {
    try {
      await fsOps.mkdir(lockPath, { recursive: false });
    } catch (error) {
      if (error?.code === 'EEXIST') {
        if (!(await recoverStale())) { state = 'busy'; fail('LOCK_BUSY', `lease is already held: ${lockPath}`); }
        await fsOps.mkdir(lockPath, { recursive: false });
      } else if (error?.code === 'ENOTDIR' || error?.code === 'EROFS') {
        state = 'unsupported'; fail('UNSUPPORTED_ATOMICITY', 'filesystem cannot create the advisory lock directory');
      } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        state = 'failed'; fail('PERMISSION_DENIED', 'permission denied while creating advisory lock');
      } else throw error;
    }
    await fsOps.writeFile(ownerPath, JSON.stringify(makePayload(record)), { encoding: 'utf8', flag: 'wx' });
    state = 'acquired';
  } catch (error) {
    if (state === 'acquired') throw error;
    if (error instanceof FileLeaseError) throw error;
    state = 'failed'; fail('ACQUISITION_FAILED', 'failed to establish advisory lease');
  }

  async function verifyOwnership() {
    if (lost || ['released', 'expired'].includes(state)) fail('INVALID_STATE', 'lease is no longer active');
    try {
      const current = parseRecord(await fsOps.readFile(ownerPath, 'utf8'));
      if (current.leaseId !== leaseId) { lost = true; state = 'lost'; fail('OWNERSHIP_LOST', 'lease ownership is no longer held'); }
      if (current.expiresAt && Date.parse(current.expiresAt) <= clock.now()) { lost = true; state = 'expired'; fail('LEASE_EXPIRED', 'lease has expired'); }
      return current;
    } catch (error) {
      if (error instanceof FileLeaseError) throw error;
      lost = true; state = 'lost'; fail('OWNERSHIP_LOST', 'lease owner record is no longer available');
    }
  }

  async function renew() {
    if (ttlMs <= 0) fail('INVALID_STATE', 'renew is unavailable without ttlMs');
    state = 'renewing';
    const current = await verifyOwnership();
    const renewed = { ...current, acquiredAt: current.acquiredAt, expiresAt: new Date(clock.now() + ttlMs).toISOString() };
    await fsOps.writeFile(ownerPath, JSON.stringify(makePayload(renewed)), { encoding: 'utf8', flag: 'w' });
    state = 'acquired';
    return freezeDeep({ leaseId, lockPath, resourcePath, owner, expiresAt: renewed.expiresAt, state });
  }

  async function release() {
    if (state === 'released') return freezeDeep({ leaseId, lockPath, resourcePath, state });
    if (state === 'lost' || state === 'expired') { state = 'released'; return freezeDeep({ leaseId, lockPath, resourcePath, state }); }
    state = 'releasing';
    await verifyOwnership();
    try { await fsOps.rm(ownerPath, { force: true }); } catch (error) { state = 'failed'; fail('RELEASE_FAILED', 'failed to remove current owner record'); }
    try { await fsOps.rm(lockPath, { recursive: false, force: false }); } catch (error) {
      if (error?.code !== 'ENOTEMPTY' && error?.code !== 'EEXIST' && error?.code !== 'ENOENT') { state = 'failed'; fail('RELEASE_FAILED', 'lock was not safely empty after owner release'); }
    }
    state = 'released';
    return freezeDeep({ leaseId, lockPath, resourcePath, state });
  }

  return freezeDeep({ leaseId, lockPath, resourcePath, owner, acquiredAt, expiresAt, state, renew, release });
}

export function serializeLeaseRecord(record) { return JSON.stringify(makePayload(record)); }
export function parseLeaseRecord(serialized) { return freezeDeep(parseRecord(serialized)); }
export const FILE_LEASE_FORMAT = FORMAT;
export const FILE_LEASE_STATES = STATES;
