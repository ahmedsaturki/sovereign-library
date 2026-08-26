import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat, unlink, writeFile, lstat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const VERSION = 1;
const MAX_SERIALIZED = 128 * 1024;
const MAX_OPERATIONS = 256;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PATH = 4096;
const ABT_PREFIX = 'ABT1';

const DEFAULTS = Object.freeze({
  maxOperations: MAX_OPERATIONS,
  maxTotalBytes: MAX_TOTAL_BYTES,
  maxFileBytes: MAX_FILE_BYTES,
  maxPathLength: MAX_PATH,
  symlinkPolicy: 'reject',
  atomicity: 'auto',
  durability: 'best-effort',
});

export class AtomicBatchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AtomicBatchError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rejectAccessors(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new AtomicBatchError('INVALID_INPUT', 'circular input');
  seen.add(value);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new AtomicBatchError('ACCESSOR_INPUT', 'accessor input rejected');
    rejectAccessors(descriptor.value, seen);
  }
  seen.delete(value);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digest(payload) {
  return createHash('sha256').update(`${ABT_PREFIX}|${VERSION}|${canonicalJson(payload)}`).digest('hex');
}

function normalizeOptions(options = {}) {
  rejectAccessors(options);
  const merged = { ...DEFAULTS, ...options };
  if (!Number.isSafeInteger(merged.maxOperations) || merged.maxOperations < 1 || merged.maxOperations > MAX_OPERATIONS) throw new AtomicBatchError('LIMIT_EXCEEDED', 'invalid maxOperations');
  if (!Number.isSafeInteger(merged.maxTotalBytes) || merged.maxTotalBytes < 0 || merged.maxTotalBytes > MAX_TOTAL_BYTES) throw new AtomicBatchError('LIMIT_EXCEEDED', 'invalid maxTotalBytes');
  if (!Number.isSafeInteger(merged.maxFileBytes) || merged.maxFileBytes < 0 || merged.maxFileBytes > MAX_FILE_BYTES) throw new AtomicBatchError('LIMIT_EXCEEDED', 'invalid maxFileBytes');
  if (!['reject', 'follow-contained'].includes(merged.symlinkPolicy)) throw new AtomicBatchError('INVALID_INPUT', 'invalid symlinkPolicy');
  if (!['auto', 'strong-local', 'best-effort'].includes(merged.atomicity)) throw new AtomicBatchError('INVALID_INPUT', 'invalid atomicity');
  if (!['best-effort', 'required'].includes(merged.durability)) throw new AtomicBatchError('INVALID_INPUT', 'invalid durability');
  return Object.freeze(merged);
}

function normalizeRoot(root) {
  if (typeof root !== 'string' || root.length === 0 || root.length > MAX_PATH || !isAbsolute(root)) throw new AtomicBatchError('INVALID_ROOT', 'root must be an absolute path');
  return resolve(root);
}

function safeRelative(root, input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_PATH) throw new AtomicBatchError('INVALID_PATH', 'invalid destination path');
  const candidate = resolve(root, input);
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new AtomicBatchError('ROOT_ESCAPE', 'destination escapes transaction root');
  if (candidate === root) throw new AtomicBatchError('INVALID_PATH', 'destination must be a file path');
  return { absolute: candidate, relative: rel.split(sep).join('/') };
}

function operationBytes(operation) {
  if (!['create', 'replace', 'delete'].includes(operation.type)) throw new AtomicBatchError('UNSUPPORTED_OPERATION', 'unsupported operation');
  if (operation.type === 'delete') return 0;
  if (typeof operation.content !== 'string' && !(operation.content instanceof Uint8Array)) throw new AtomicBatchError('INVALID_INPUT', 'create/replace requires bounded content');
  const bytes = operation.content instanceof Uint8Array ? Buffer.from(operation.content) : Buffer.from(operation.content, 'utf8');
  if (bytes.byteLength > MAX_FILE_BYTES) throw new AtomicBatchError('LIMIT_EXCEEDED', 'file content exceeds limit');
  return bytes;
}

function buildCapabilitySet(capabilities = {}) {
  const names = ['lstat', 'stat', 'mkdir', 'readFile', 'writeFile', 'rename', 'unlink', 'rm', 'mkdtemp', 'clock', 'identity', 'atomicityProof'];
  const out = {};
  for (const name of names) if (capabilities[name] !== undefined && typeof capabilities[name] !== 'function') throw new AtomicBatchError('INVALID_CAPABILITY', `${name} must be a function`);
  out.lstat = capabilities.lstat ?? lstat;
  out.stat = capabilities.stat ?? stat;
  out.mkdir = capabilities.mkdir ?? mkdir;
  out.readFile = capabilities.readFile ?? readFile;
  out.writeFile = capabilities.writeFile ?? writeFile;
  out.rename = capabilities.rename ?? rename;
  out.unlink = capabilities.unlink ?? unlink;
  out.rm = capabilities.rm ?? rm;
  out.mkdtemp = capabilities.mkdtemp ?? mkdtemp;
  out.clock = capabilities.clock ?? (() => Date.now());
  out.identity = capabilities.identity ?? (() => cryptoRandomId());
  out.atomicityProof = capabilities.atomicityProof ?? (() => false);
  return out;
}

function cryptoRandomId() {
  return createHash('sha256').update(`${process.pid}|${Date.now()}|${Math.random()}`).digest('hex').slice(0, 24);
}

function freezeCopy(value) {
  return deepFreeze(JSON.parse(JSON.stringify(value)));
}

export function planBatch(input, capabilities = {}, options = {}) {
  const opts = normalizeOptions(options);
  rejectAccessors(input);
  if (!isPlainObject(input)) throw new AtomicBatchError('INVALID_INPUT', 'transaction input must be plain data');
  const root = normalizeRoot(input.root);
  const capability = buildCapabilitySet(capabilities);
  if (opts.atomicity === 'strong-local' && capability.atomicityProof({ root, operations: input.operations ?? [] }) !== true) {
    throw new AtomicBatchError('ATOMICITY_UNPROVEN', 'strong-local atomicity requires explicit capability proof');
  }
  if (!Array.isArray(input.operations) || input.operations.length > opts.maxOperations) throw new AtomicBatchError('LIMIT_EXCEEDED', 'too many operations');
  const seen = new Set();
  const operations = [];
  let totalBytes = 0;
  for (const raw of input.operations) {
    if (!isPlainObject(raw)) throw new AtomicBatchError('INVALID_INPUT', 'operation must be plain data');
    const destination = safeRelative(root, raw.destination);
    if (seen.has(destination.relative)) throw new AtomicBatchError('DUPLICATE_DESTINATION', 'duplicate destination');
    seen.add(destination.relative);
    const bytes = operationBytes(raw);
    totalBytes += bytes.byteLength;
    if (totalBytes > opts.maxTotalBytes) throw new AtomicBatchError('LIMIT_EXCEEDED', 'transaction content exceeds limit');
    operations.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : `op-${operations.length + 1}`,
      type: raw.type,
      destination: destination.relative,
      absolute: destination.absolute,
      expected: raw.expected ?? null,
      content: raw.type === 'delete' ? null : bytes.toString('base64'),
    });
  }
  operations.sort((a, b) => a.destination.localeCompare(b.destination) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const guaranteeLevel = opts.atomicity === 'strong-local' ? 'strong-local' : 'best-effort';
  return freezeCopy({
    format: ABT_PREFIX,
    version: VERSION,
    transactionId: input.transactionId ?? capability.identity(),
    root,
    guaranteeLevel,
    durability: opts.durability,
    symlinkPolicy: opts.symlinkPolicy,
    operations,
  });
}

async function exists(path, cap) {
  try { await cap.lstat(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

export async function commitBatch(plan, capabilities = {}, options = {}) {
  if (!plan || plan.format !== ABT_PREFIX || plan.version !== VERSION) throw new AtomicBatchError('INVALID_PLAN', 'invalid transaction plan');
  const opts = normalizeOptions(options);
  const cap = buildCapabilitySet(capabilities);
  const workspace = await cap.mkdtemp(join(plan.root, `.abt-${plan.transactionId}-`));
  const backups = [];
  const applied = [];
  const startedAt = cap.clock();
  try {
    for (const op of plan.operations) {
      const existsNow = await exists(op.absolute, cap);
      if (op.expected?.exists === true && !existsNow) throw new AtomicBatchError('PRECONDITION_FAILED', 'expected destination to exist', { destination: op.destination });
      if (op.expected?.exists === false && existsNow) throw new AtomicBatchError('PRECONDITION_FAILED', 'expected destination to be absent', { destination: op.destination });
    }

    for (const op of plan.operations) {
      const staged = join(workspace, `${String(applied.length).padStart(6, '0')}.stage`);
      if (op.type !== 'delete') await cap.writeFile(staged, Buffer.from(op.content, 'base64'), { flag: 'wx' });
      const backup = join(workspace, `${String(applied.length).padStart(6, '0')}.backup`);
      if (await exists(op.absolute, cap)) {
        await cap.rename(op.absolute, backup);
        backups.push({ op, backup });
      }
      if (op.type !== 'delete') await cap.rename(staged, op.absolute);
      applied.push(op.id);
    }
    await cap.rm(workspace, { recursive: true, force: true });
    return freezeCopy({
      format: ABT_PREFIX,
      version: VERSION,
      transactionId: plan.transactionId,
      state: 'committed',
      guaranteeLevel: plan.guaranteeLevel,
      durability: plan.durability,
      startedAt,
      completedAt: cap.clock(),
      applied,
      rollback: { available: false, reason: 'cleanup_complete', backups: [] },
      integrity: digest({ transactionId: plan.transactionId, state: 'committed', applied }),
    });
  } catch (error) {
    let rollbackFailed = false;
    for (let i = applied.length - 1; i >= 0; i -= 1) {
      const op = plan.operations.find((candidate) => candidate.id === applied[i]);
      const backup = backups.find((candidate) => candidate.op.id === op.id)?.backup;
      try {
        if (await exists(op.absolute, cap)) await cap.unlink(op.absolute);
        if (backup && await exists(backup, cap)) await cap.rename(backup, op.absolute);
      } catch { rollbackFailed = true; }
    }
    try { await cap.rm(workspace, { recursive: true, force: true }); } catch { rollbackFailed = true; }
    if (rollbackFailed) throw new AtomicBatchError('RECOVERY_REQUIRED', 'transaction failed and rollback is incomplete', { transactionId: plan.transactionId, applied });
    if (error instanceof AtomicBatchError) throw error;
    throw new AtomicBatchError('FAILED_COMMIT', 'transaction commit failed', { transactionId: plan.transactionId });
  }
}

export async function serializeReceipt(receipt) {
  rejectAccessors(receipt);
  const payload = { ...receipt };
  delete payload.integrity;
  const envelope = { format: ABT_PREFIX, version: VERSION, payload, integrity: digest(payload) };
  const serialized = canonicalJson(envelope);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) throw new AtomicBatchError('LIMIT_EXCEEDED', 'serialized receipt exceeds limit');
  return serialized;
}

export function parseReceipt(serialized) {
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED) throw new AtomicBatchError('LIMIT_EXCEEDED', 'invalid serialized receipt size');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { throw new AtomicBatchError('MALFORMED_SERIALIZATION', 'malformed receipt'); }
  if (envelope?.format !== ABT_PREFIX || envelope?.version !== VERSION || !envelope?.payload || typeof envelope.integrity !== 'string') throw new AtomicBatchError('MALFORMED_SERIALIZATION', 'invalid receipt envelope');
  const expected = digest(envelope.payload);
  const actual = Buffer.from(envelope.integrity, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBytes.length || !timingSafeEqual(actual, expectedBytes)) throw new AtomicBatchError('INTEGRITY_FAILURE', 'receipt integrity verification failed');
  return deepFreeze(envelope.payload);
}

export async function rollbackBatch(receipt, capabilities = {}) {
  if (!receipt || receipt.state !== 'committed') throw new AtomicBatchError('INVALID_RECEIPT', 'rollback requires a committed receipt');
  if (receipt.rollback?.available !== true) throw new AtomicBatchError('ROLLBACK_UNAVAILABLE', 'rollback material is no longer available');
  throw new AtomicBatchError('RECOVERY_REQUIRED', 'rollback after cleanup requires explicit recovery material');
}

export async function recoverBatch(transactionId, capabilities = {}, options = {}) {
  const cap = buildCapabilitySet(capabilities);
  const opts = normalizeOptions(options);
  if (typeof transactionId !== 'string' || !transactionId) throw new AtomicBatchError('INVALID_INPUT', 'invalid transaction id');
  if (!opts.recoveryWorkspace) throw new AtomicBatchError('RECOVERY_REQUIRED', 'explicit recovery workspace authority required');
  const workspace = resolve(opts.recoveryWorkspace);
  if (!(await exists(workspace, cap))) return freezeCopy({ transactionId, state: 'recovery_required', reason: 'workspace_missing' });
  return freezeCopy({ transactionId, state: 'recovery_required', reason: 'operator_review_required' });
}
