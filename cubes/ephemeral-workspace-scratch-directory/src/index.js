import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname, relative, sep } from 'node:path';

const FORMAT = 'EWC1';
const MAX_PATH = 4096;
const MAX_ID = 128;
const MAX_METADATA = 4096;
const MAX_RECORD = 16 * 1024;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ROOT_NAME = '.sovereign-workspaces';

export class WorkspaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
    Object.freeze(this);
  }
}

function fail(code, message) {
  throw new WorkspaceError(code, message);
}

function validateData(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('LIMIT_EXCEEDED', `${label} exceeds depth limit`);
  if (value === null) return;
  const type = typeof value;
  if (['undefined', 'function', 'symbol', 'bigint'].includes(type)) fail('UNSUPPORTED_VALUE', `${label} contains unsupported value`);
  if (type === 'number' && !Number.isFinite(value)) fail('UNSUPPORTED_VALUE', `${label} contains non-finite number`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !Array.isArray(value)) fail('UNSUPPORTED_VALUE', `${label} must be plain data`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', `${label} contains a symbol key`);
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

function digest(payload) {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function boundedText(value, label, max = MAX_PATH) {
  if (typeof value !== 'string' || !value) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  if (value.length > max) fail('LIMIT_EXCEEDED', `${label} exceeds ${max}`);
  return value;
}

function capability(value, label) {
  if (typeof value !== 'function') fail('INVALID_CAPABILITY', `${label} must be a function`);
  return value;
}

function normalizeOptions(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_OPTIONS', 'options must be a plain object');
  const proto = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype && proto !== null) fail('INVALID_OPTIONS', 'options must be a plain object');
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== 'string') fail('UNSUPPORTED_VALUE', 'options contains a symbol key');
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `options.${key} is accessor-backed`);
  }

  const parent = resolve(boundedText(raw.parent ?? `${process.cwd()}/${DEFAULT_ROOT_NAME}`, 'parent'));
  const owner = raw.owner ?? null;
  if (owner !== null) {
    validateData(owner, 'owner');
    if (Buffer.byteLength(canonical(owner), 'utf8') > MAX_METADATA) fail('LIMIT_EXCEEDED', 'owner metadata exceeds maximum size');
  }

  const ttlMs = raw.ttlMs ?? 0;
  if (!Number.isInteger(ttlMs) || ttlMs < 0 || ttlMs > MAX_TTL_MS) fail('INVALID_TTL', 'ttlMs is invalid');

  const clock = raw.clock ?? { now: () => Date.now() };
  if (!clock || typeof clock.now !== 'function') fail('INVALID_CAPABILITY', 'clock must expose now()');

  const idGenerator = raw.idGenerator ?? randomUUID;
  capability(idGenerator, 'idGenerator');

  const fsOps = raw.fsOps ?? { mkdir, readFile, writeFile, rm, lstat };
  for (const name of ['mkdir', 'readFile', 'writeFile', 'rm', 'lstat']) capability(fsOps[name], `fsOps.${name}`);

  const recoveryToken = raw.recoveryToken ?? null;
  if (recoveryToken !== null) boundedText(recoveryToken, 'recoveryToken', 256);

  const cleanupDepth = raw.maxCleanupDepth ?? 64;
  if (!Number.isInteger(cleanupDepth) || cleanupDepth < 1 || cleanupDepth > 256) fail('LIMIT_EXCEEDED', 'maxCleanupDepth is invalid');

  return { parent, owner, ttlMs, clock, idGenerator, fsOps, recoveryToken, cleanupDepth };
}

function makeRecord(record) {
  const payload = canonical(record);
  if (Buffer.byteLength(payload, 'utf8') > MAX_RECORD) fail('LIMIT_EXCEEDED', 'workspace record exceeds maximum size');
  return { format: FORMAT, checksum: digest(payload), payload };
}

function parseRecord(serialized) {
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_RECORD) fail('LIMIT_EXCEEDED', 'workspace record exceeds maximum size');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { fail('MALFORMED_WORKSPACE_RECORD', 'workspace record is not JSON'); }
  validateData(envelope, 'workspaceRecord');
  if (envelope.format !== FORMAT || typeof envelope.payload !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.checksum ?? '')) fail('MALFORMED_WORKSPACE_RECORD', 'workspace record envelope is invalid');
  if (digest(envelope.payload) !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'workspace record checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch { fail('MALFORMED_WORKSPACE_RECORD', 'workspace record payload is not JSON'); }
  validateData(payload, 'workspaceRecord.payload');
  return payload;
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.includes(`..${sep}`);
}

function snapshot(base, extra = {}) {
  return freezeDeep({ ...base, ...extra });
}

function nowIso(clock) {
  return new Date(clock.now()).toISOString();
}

function expiresAt(clock, ttlMs) {
  return ttlMs > 0 ? new Date(clock.now() + ttlMs).toISOString() : null;
}

export async function createWorkspace(options = {}) {
  const { parent, owner, ttlMs, clock, idGenerator, fsOps, recoveryToken, cleanupDepth } = normalizeOptions(options);
  let parentStat;
  try {
    parentStat = await fsOps.lstat(parent);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      try { await fsOps.mkdir(parent, { recursive: true }); parentStat = await fsOps.lstat(parent); }
      catch { fail('WORKSPACE_CREATION_FAILED', 'workspace parent could not be established'); }
    } else if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'workspace parent permission denied');
    else fail('WORKSPACE_CREATION_FAILED', 'workspace parent could not be inspected');
  }
  if (!parentStat?.isDirectory?.() || parentStat.isSymbolicLink?.()) fail('INVALID_PARENT', 'workspace parent must be a real directory');

  const workspaceId = String(idGenerator());
  if (!/^[A-Za-z0-9-]{8,128}$/.test(workspaceId)) fail('INVALID_WORKSPACE_ID', 'generated workspace id is invalid');
  const workspacePath = resolve(parent, `workspace-${workspaceId}`);
  if (!isInside(parent, workspacePath)) fail('PATH_ESCAPE', 'workspace path escapes parent');

  const createdAt = nowIso(clock);
  const expires = expiresAt(clock, ttlMs);
  const ownerToken = recoveryToken ?? String(idGenerator());
  boundedText(ownerToken, 'recoveryToken', 256);
  const recordPath = resolve(workspacePath, '.workspace.json');
  const record = { format: FORMAT, workspaceId, workspacePath, parentPath: parent, createdAt, expiresAt: expires, owner, recoveryToken: ownerToken };
  let state = 'creating';

  try {
    await fsOps.mkdir(workspacePath, { recursive: false });
    await fsOps.writeFile(recordPath, JSON.stringify(makeRecord(record)), { encoding: 'utf8', flag: 'wx' });
    state = 'active';
  } catch (error) {
    try { await fsOps.rm(workspacePath, { recursive: true, force: true }); } catch { /* best effort */ }
    if (error?.code === 'EEXIST') fail('WORKSPACE_BUSY', 'generated workspace path already exists');
    if (error?.code === 'EACCES' || error?.code === 'EPERM') fail('PERMISSION_DENIED', 'workspace creation permission denied');
    fail('WORKSPACE_CREATION_FAILED', 'workspace directory could not be created safely');
  }

  let cleaned = false;

  async function verifyOwnedDirectory() {
    let stat;
    try { stat = await fsOps.lstat(workspacePath); } catch { fail('OWNERSHIP_MISMATCH', 'workspace directory is no longer available'); }
    if (!stat.isDirectory?.() || stat.isSymbolicLink?.()) fail('OWNERSHIP_MISMATCH', 'workspace directory is no longer the original directory');
    if (!isInside(parent, workspacePath) || workspacePath !== record.workspacePath) fail('PATH_ESCAPE', 'workspace path identity changed');
    let parsed;
    try { parsed = parseRecord(await fsOps.readFile(recordPath, 'utf8')); } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      fail('MALFORMED_WORKSPACE_RECORD', 'workspace record is unavailable');
    }
    if (parsed.workspaceId !== workspaceId || parsed.workspacePath !== workspacePath || parsed.parentPath !== parent) fail('OWNERSHIP_MISMATCH', 'workspace identity does not match its record');
    return parsed;
  }

  async function path() {
    if (cleaned) fail('WORKSPACE_ALREADY_CLEANED', 'workspace has already been cleaned');
    await verifyOwnedDirectory();
    return workspacePath;
  }

  function isExpired() {
    if (!record.expiresAt) return false;
    return Date.parse(record.expiresAt) <= clock.now();
  }

  async function cleanup() {
    if (cleaned) return snapshot(base(), { state: 'cleaned' });
    state = 'cleaning';
    await verifyOwnedDirectory();
    const rel = relative(parent, workspacePath);
    if (!rel || rel.startsWith('..') || workspacePath === parent) fail('PATH_ESCAPE', 'refusing to delete outside workspace boundary');
    if (rel.split(sep).length > cleanupDepth) fail('LIMIT_EXCEEDED', 'workspace cleanup depth exceeds limit');
    try { await fsOps.rm(workspacePath, { recursive: true, force: true }); }
    catch { state = 'failed'; fail('CLEANUP_FAILED', 'workspace subtree could not be removed safely'); }
    cleaned = true;
    state = 'cleaned';
    return snapshot(base());
  }

  function base() {
    return { workspaceId, workspacePath, parentPath: parent, createdAt, expiresAt: expires, owner, state };
  }

  return snapshot(base(), { path, cleanup, isExpired });
}

export async function recoverWorkspace(options = {}) {
  const { parent, clock, fsOps, recoveryToken, cleanupDepth } = normalizeOptions(options);
  const workspaceId = boundedText(options.workspaceId, 'workspaceId', MAX_ID);
  const root = resolve(parent);
  const target = resolve(root, `workspace-${workspaceId}`);
  if (!isInside(root, target)) fail('PATH_ESCAPE', 'recovery target escapes parent');
  if (!recoveryToken) fail('STALE_RECOVERY_REJECTED', 'recoveryToken is required for conservative recovery');
  if (!/^[A-Za-z0-9-]{8,128}$/.test(workspaceId)) fail('INVALID_WORKSPACE_ID', 'workspaceId is invalid');
  const stat = await fsOps.lstat(target).catch(() => null);
  if (!stat) fail('STALE_RECOVERY_REJECTED', 'workspace does not exist');
  if (!stat.isDirectory?.() || stat.isSymbolicLink?.()) fail('OWNERSHIP_MISMATCH', 'recovery target is not a real directory');
  const recordPath = resolve(target, '.workspace.json');
  const record = parseRecord(await fsOps.readFile(recordPath, 'utf8'));
  if (record.workspaceId !== workspaceId || record.workspacePath !== target || record.parentPath !== root) fail('OWNERSHIP_MISMATCH', 'workspace record identity mismatch');
  if (record.recoveryToken !== recoveryToken) fail('OWNERSHIP_MISMATCH', 'recovery authority does not match workspace record');
  if (!record.expiresAt || Date.parse(record.expiresAt) > clock.now()) fail('STALE_RECOVERY_REJECTED', 'workspace is not stale according to configured expiry');
  const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || rel.split(sep).length > cleanupDepth) fail('PATH_ESCAPE', 'recovery target is outside configured boundary');
  try { await fsOps.rm(target, { recursive: true, force: true }); }
  catch { fail('CLEANUP_FAILED', 'stale workspace could not be removed safely'); }
  return freezeDeep({ workspaceId, workspacePath: target, state: 'recovered' });
}

export function serializeWorkspaceRecord(record) {
  return JSON.stringify(makeRecord(record));
}

export function parseWorkspaceRecord(serialized) {
  return freezeDeep(parseRecord(serialized));
}

export const EPHEMERAL_WORKSPACE_FORMAT = FORMAT;
export const EPHEMERAL_WORKSPACE_STATES = Object.freeze(['creating', 'active', 'cleaning', 'cleaned', 'failed', 'expired', 'orphaned', 'unsupported']);
