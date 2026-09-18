import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { lstat as nativeLstat, stat as nativeStat, realpath as nativeRealpath, mkdir as nativeMkdir, rename as nativeRename, readFile as nativeReadFile, writeFile as nativeWriteFile, rm as nativeRm } from 'node:fs/promises';
import { resolveContained } from '#safe-path-resolver';

const FORMAT = 'SFQ1';
const MAX_PATH = 32 * 1024;
const MAX_TOKEN = 128;
const MAX_MANIFEST = 32 * 1024;
const MAX_DIAGNOSTIC = 2048;
const MAX_RECOVERY = 2;

export class SafeFileQuarantineError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SafeFileQuarantineError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const fail = (code, message, details = {}) => { throw new SafeFileQuarantineError(code, message, details); };
const freeze = (value) => Object.freeze(value);

function assertPlain(value, label, seen = new Set(), depth = 0) {
  if (depth > 10) fail('INVALID_INPUT', `${label} exceeds validation depth`);
  if (value === null) return;
  const type = typeof value;
  if (['function', 'symbol', 'bigint', 'undefined'].includes(type)) fail('INVALID_INPUT', `${label} contains unsupported data`);
  if (type !== 'object') return;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) fail('INVALID_INPUT', `${label} must be plain data`);
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label}.${key} is accessor-backed`);
    assertPlain(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function assertCapabilities(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) fail('INVALID_INPUT', 'capabilities must be an object');
  for (const key of Object.getOwnPropertyNames(c)) {
    const descriptor = Object.getOwnPropertyDescriptor(c, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `capabilities.${key} is accessor-backed`);
    if (typeof descriptor.value !== 'function') fail('CAPABILITY_FAILURE', `${key} capability must be callable`);
  }
  for (const key of ['lstat', 'mkdir', 'rename', 'readFile', 'writeFile', 'rm', 'now', 'token']) {
    if (typeof c[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
  }
}

const defaultCapabilities = Object.freeze({
  lstat: nativeLstat,
  stat: nativeStat,
  realpath: nativeRealpath,
  mkdir: nativeMkdir,
  rename: nativeRename,
  readFile: nativeReadFile,
  writeFile: nativeWriteFile,
  rm: nativeRm,
  now: () => Date.now(),
  token: () => randomUUID(),
  contain: async (target, root) => {
    try { resolveContained(root, target, { separatorNormalization: true, normalizeDotSegments: true }); return true; } catch { return false; }
  },
});

function nativeError(error) {
  if (error?.code === 'ENOENT') return new SafeFileQuarantineError('NOT_FOUND', 'path not found');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new SafeFileQuarantineError('PERMISSION_DENIED', 'permission denied');
  if (error?.code === 'EEXIST') return new SafeFileQuarantineError('DESTINATION_COLLISION', 'destination already exists');
  if (error?.code === 'EXDEV') return new SafeFileQuarantineError('CROSS_DEVICE_MOVE', 'cross-device move is not supported');
  return new SafeFileQuarantineError('FILESYSTEM_FAILURE', 'filesystem operation failed');
}

function isAbsolutePath(value) {
  return /^(?:[A-Za-z]:[\\/])|^(?:\\\\)|^\//.test(value);
}

function normalizePath(value, label, requireAbsolute = false) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || value.length > MAX_PATH) fail('INVALID_INPUT', `${label} is invalid`);
  if (requireAbsolute && !isAbsolutePath(value)) fail('INVALID_INPUT', `${label} must be absolute`);
  return value;
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function digest(payload) {
  return createHash('sha256').update(payload).digest('hex');
}

function boundedMessage(error) {
  return typeof error?.message === 'string' ? error.message.slice(0, MAX_DIAGNOSTIC) : '';
}

function immutableReceipt(data) {
  return freeze({ ...data, sourceObservation: data.sourceObservation ? freeze({ ...data.sourceObservation }) : undefined });
}

async function resolveApprovedPath(path, options) {
  const raw = normalizePath(path, 'path');
  if (options.root !== null) {
    try { return resolveContained(options.root, raw, { separatorNormalization: true, normalizeDotSegments: true }); }
    catch { fail('ROOT_ESCAPE', 'path escapes declared root'); }
  }
  if (!isAbsolutePath(raw)) fail('INVALID_INPUT', 'relative path requires root');
  return raw;
}

async function ensureDisjointRoots(sourcePath, quarantineRoot, capabilities) {
  if (typeof capabilities.realpath !== 'function' || typeof capabilities.contain !== 'function') fail('CAPABILITY_FAILURE', 'realpath and containment capabilities are required');
  let sourceReal; let rootReal;
  try { sourceReal = await capabilities.realpath(sourcePath); rootReal = await capabilities.realpath(quarantineRoot); }
  catch (error) { throw nativeError(error); }
  if (await capabilities.contain(rootReal, sourceReal) || await capabilities.contain(sourceReal, rootReal)) fail('ROOT_OVERLAP', 'source and quarantine roots must be disjoint');
}

async function readSourceObservation(path, capabilities) {
  let entry;
  try { entry = await capabilities.lstat(path); } catch (error) { throw nativeError(error); }
  if (!entry || typeof entry !== 'object' || typeof entry.isSymbolicLink !== 'function' || typeof entry.isDirectory !== 'function' || typeof entry.isFile !== 'function') fail('CAPABILITY_FAILURE', 'malformed lstat result');
  if (entry.isSymbolicLink()) fail('SYMLINK_REJECTED', 'symlink/reparse source is rejected');
  if (!entry.isFile() && !entry.isDirectory()) fail('UNSUPPORTED_TYPE', 'only files and directories are supported');
  let stat = null;
  if (typeof capabilities.stat === 'function') {
    try { stat = await capabilities.stat(path); } catch { stat = null; }
  }
  return { kind: entry.isDirectory() ? 'directory' : 'file', size: Number.isSafeInteger(stat?.size) && stat.size >= 0 ? stat.size : null, mtimeMs: Number.isFinite(stat?.mtimeMs) ? stat.mtimeMs : null };
}

function validateOptions(options) {
  assertPlain(options, 'options');
  const normalized = Object.freeze({ root: null, quarantineRoot: null, ...options });
  normalizePath(normalized.quarantineRoot, 'quarantineRoot', true);
  if (normalized.root !== null) normalizePath(normalized.root, 'root', true);
  return normalized;
}

function tokenValue(capabilities) {
  let token;
  try { token = capabilities.token(); } catch { fail('CAPABILITY_FAILURE', 'token capability failed'); }
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN || !/^[A-Za-z0-9._-]+$/.test(token)) fail('CAPABILITY_FAILURE', 'token capability returned invalid identity');
  return token;
}

function manifestPayload(receipt) {
  return { format: receipt.format, token: receipt.token, sourcePath: receipt.sourcePath, quarantineRoot: receipt.quarantineRoot, quarantinePath: receipt.quarantinePath, payloadPath: receipt.payloadPath, kind: receipt.kind, createdAt: receipt.createdAt, sourceObservation: receipt.sourceObservation };
}

function buildManifest(receipt) {
  const payload = manifestPayload(receipt);
  const canonical = canonicalize(payload);
  return JSON.stringify({ ...payload, integrity: `sha256:${digest(canonical)}` });
}

function parseManifest(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_MANIFEST) fail('MANIFEST_INVALID', 'manifest is invalid or oversized');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('MANIFEST_INVALID', 'manifest is not valid JSON'); }
  assertPlain(parsed, 'manifest');
  if (parsed.format !== FORMAT || typeof parsed.token !== 'string' || typeof parsed.integrity !== 'string') fail('MANIFEST_INVALID', 'manifest identity is malformed');
  const expected = digest(canonicalize(manifestPayload(parsed)));
  if (parsed.integrity !== `sha256:${expected}`) fail('MANIFEST_TAMPERED', 'manifest integrity mismatch');
  return parsed;
}

async function validateReceipt(receipt, capabilities) {
  assertPlain(receipt, 'receipt');
  for (const key of ['format', 'token', 'sourcePath', 'quarantineRoot', 'quarantinePath', 'payloadPath', 'kind', 'createdAt', 'status']) if (!(key in receipt)) fail('RECEIPT_INVALID', `receipt.${key} is missing`);
  if (receipt.format !== FORMAT || typeof receipt.token !== 'string' || receipt.token.length > MAX_TOKEN) fail('RECEIPT_INVALID', 'receipt identity is malformed');
  normalizePath(receipt.sourcePath, 'receipt.sourcePath'); normalizePath(receipt.quarantineRoot, 'receipt.quarantineRoot', true); normalizePath(receipt.quarantinePath, 'receipt.quarantinePath', true); normalizePath(receipt.payloadPath, 'receipt.payloadPath', true);
  const manifestPath = join(receipt.quarantinePath, 'manifest.json');
  let raw;
  try { raw = await capabilities.readFile(manifestPath, 'utf8'); } catch (error) { throw nativeError(error); }
  const manifest = parseManifest(raw);
  for (const key of ['token', 'sourcePath', 'quarantineRoot', 'quarantinePath', 'payloadPath', 'kind', 'createdAt']) if (manifest[key] !== receipt[key]) fail('RECEIPT_MISMATCH', 'receipt does not match quarantine manifest');
  return { manifest, manifestPath };
}

async function cleanupPath(path, capabilities) {
  try { await capabilities.rm(path, { recursive: true, force: false }); return null; }
  catch (error) { return nativeError(error); }
}

export async function quarantineItem(path, options = {}, capabilities = defaultCapabilities) {
  assertCapabilities(capabilities);
  const o = validateOptions(options);
  const sourcePath = await resolveApprovedPath(path, o);
  const quarantineRoot = normalizePath(o.quarantineRoot, 'quarantineRoot', true);
  await ensureDisjointRoots(sourcePath, quarantineRoot, capabilities);
  const sourceObservation = await readSourceObservation(sourcePath, capabilities);
  try { await capabilities.mkdir(quarantineRoot, { recursive: true }); } catch (error) { throw nativeError(error); }
  const token = tokenValue(capabilities);
  const quarantinePath = join(quarantineRoot, `.sfq-${token}`);
  const payloadPath = join(quarantinePath, 'payload');
  try { await capabilities.mkdir(quarantinePath); } catch (error) { throw nativeError(error); }
  let moved = false;
  try {
    await capabilities.rename(sourcePath, payloadPath);
    moved = true;
    const receipt = immutableReceipt({ format: FORMAT, token, sourcePath, quarantineRoot, quarantinePath, payloadPath, kind: sourceObservation.kind, createdAt: capabilities.now(), status: 'quarantined', sourceObservation });
    await capabilities.writeFile(join(quarantinePath, 'manifest.json'), buildManifest(receipt), 'utf8');
    return receipt;
  } catch (error) {
    const primary = error instanceof SafeFileQuarantineError ? error : nativeError(error);
    const recovery = {};
    if (moved) {
      try { await capabilities.rename(payloadPath, sourcePath); recovery.rollback = 'restored'; }
      catch (rollbackError) { recovery.rollback = 'failed'; recovery.rollbackError = boundedMessage(rollbackError); }
    }
    const cleanupError = await cleanupPath(quarantinePath, capabilities);
    throw new SafeFileQuarantineError(primary.code, primary.message, { ...primary.details, recovery, cleanupError: cleanupError ? cleanupError.code : null });
  }
}

export async function restoreQuarantined(receipt, options = {}, capabilities = defaultCapabilities) {
  assertCapabilities(capabilities);
  assertPlain(receipt, 'receipt');
  const verified = await validateReceipt(receipt, capabilities);
  validateOptions({ ...options, quarantineRoot: receipt.quarantineRoot });
  if (receipt.status !== 'quarantined') fail('RECEIPT_INVALID', 'receipt is not restorable');
  try { await capabilities.lstat(receipt.sourcePath); fail('DESTINATION_COLLISION', 'restore destination already exists'); }
  catch (error) { if (!(error instanceof SafeFileQuarantineError) && error?.code !== 'ENOENT') throw nativeError(error); if (error instanceof SafeFileQuarantineError) throw error; }
  try { await capabilities.rename(receipt.payloadPath, receipt.sourcePath); } catch (error) { throw nativeError(error); }
  const cleanupManifest = await cleanupPath(verified.manifestPath, capabilities);
  const cleanupRoot = await cleanupPath(receipt.quarantinePath, capabilities);
  return immutableReceipt({ ...receipt, status: 'restored', cleanupPending: Boolean(cleanupManifest || cleanupRoot) });
}

export async function purgeQuarantined(receipt, options = {}, capabilities = defaultCapabilities) {
  assertCapabilities(capabilities);
  assertPlain(receipt, 'receipt');
  const verified = await validateReceipt(receipt, capabilities);
  validateOptions({ ...options, quarantineRoot: receipt.quarantineRoot });
  if (receipt.status !== 'quarantined') fail('RECEIPT_INVALID', 'receipt is not purgeable');
  const payloadCleanup = await cleanupPath(receipt.payloadPath, capabilities);
  if (payloadCleanup) throw new SafeFileQuarantineError(payloadCleanup.code, payloadCleanup.message, { stage: 'payload' });
  const manifestCleanup = await cleanupPath(verified.manifestPath, capabilities);
  const rootCleanup = await cleanupPath(receipt.quarantinePath, capabilities);
  return immutableReceipt({ ...receipt, status: 'purged', cleanupPending: Boolean(manifestCleanup || rootCleanup) });
}

export { defaultCapabilities, FORMAT as SAFE_FILE_QUARANTINE_FORMAT };
