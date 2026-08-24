import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_READ_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_WRITE_BYTES = 10 * 1024 * 1024;

export class FilesystemCubeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'FilesystemCubeError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.cause = options.cause;
  }
}

function wrapError(code, message, cause) {
  if (cause instanceof FilesystemCubeError) return cause;
  return new FilesystemCubeError(code, message, { cause });
}

function validatePath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FilesystemCubeError('INVALID_PATH', 'Path must be a non-empty string');
  }
  if (value.includes('\0')) {
    throw new FilesystemCubeError('INVALID_PATH', 'Path contains a null byte');
  }
  return value;
}

function resolvePath(value, options = {}) {
  const raw = validatePath(value);
  const resolved = path.resolve(options.cwd ?? process.cwd(), raw);
  if (!options.root) return resolved;

  const root = path.resolve(options.cwd ?? process.cwd(), options.root);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new FilesystemCubeError('PATH_OUTSIDE_ROOT', 'Resolved path escapes the configured root');
  }
  return resolved;
}

function validateLimit(value, fallback, code) {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new FilesystemCubeError(code, 'Size limit must be a positive safe integer');
  }
  return limit;
}

export function resolve(value, options = {}) {
  return resolvePath(value, options);
}

export async function exists(filePath, options = {}) {
  const target = resolvePath(filePath, options);
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw wrapError('ACCESS_FAILED', `Unable to access: ${target}`, error);
  }
}

export async function stat(filePath, options = {}) {
  const target = resolvePath(filePath, options);
  try {
    return await fs.stat(target);
  } catch (error) {
    throw wrapError(error?.code === 'ENOENT' ? 'NOT_FOUND' : 'STAT_FAILED', `Unable to stat: ${target}`, error);
  }
}

export async function readBytes(filePath, options = {}) {
  const target = resolvePath(filePath, options);
  const maxBytes = validateLimit(options.maxBytes, DEFAULT_MAX_READ_BYTES, 'INVALID_READ_LIMIT');
  let info;
  try {
    info = await fs.stat(target);
  } catch (error) {
    throw wrapError(error?.code === 'ENOENT' ? 'NOT_FOUND' : 'STAT_FAILED', `Unable to stat: ${target}`, error);
  }
  if (!info.isFile()) throw new FilesystemCubeError('NOT_A_FILE', `Expected a file: ${target}`);
  if (info.size > maxBytes) throw new FilesystemCubeError('READ_TOO_LARGE', `File exceeds ${maxBytes} bytes`);
  try {
    return await fs.readFile(target);
  } catch (error) {
    throw wrapError('READ_FAILED', `Unable to read: ${target}`, error);
  }
}

export async function readText(filePath, options = {}) {
  return (await readBytes(filePath, options)).toString(options.encoding ?? 'utf8');
}

function normalizeWriteData(data) {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) return Buffer.from(data);
  throw new FilesystemCubeError('INVALID_DATA', 'Binary writes expect Buffer or Uint8Array');
}

export async function writeBytes(filePath, data, options = {}) {
  const target = resolvePath(filePath, options);
  const bytes = normalizeWriteData(data);
  const maxBytes = validateLimit(options.maxBytes, DEFAULT_MAX_WRITE_BYTES, 'INVALID_WRITE_LIMIT');
  if (bytes.length > maxBytes) throw new FilesystemCubeError('WRITE_TOO_LARGE', `Data exceeds ${maxBytes} bytes`);
  try {
    if (options.mkdir) await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { mode: options.mode, flag: options.flag ?? 'w' });
  } catch (error) {
    throw wrapError('WRITE_FAILED', `Unable to write: ${target}`, error);
  }
}

export async function writeText(filePath, value, options = {}) {
  if (typeof value !== 'string') throw new FilesystemCubeError('INVALID_DATA', 'writeText expects a string');
  return writeBytes(filePath, Buffer.from(value, options.encoding ?? 'utf8'), options);
}

export async function appendBytes(filePath, data, options = {}) {
  return writeBytes(filePath, data, { ...options, flag: 'a' });
}

export async function appendText(filePath, value, options = {}) {
  return writeText(filePath, value, { ...options, flag: 'a' });
}

export async function atomicWriteBytes(filePath, data, options = {}) {
  const target = resolvePath(filePath, options);
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    if (options.mkdir) await fs.mkdir(path.dirname(target), { recursive: true });
    await writeBytes(temporary, data, { ...options, mkdir: false });
    try {
      await fs.rename(temporary, target);
    } catch (error) {
      if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') throw error;
      await fs.rm(target, { force: true });
      await fs.rename(temporary, target);
    }
  } catch (error) {
    try { await fs.unlink(temporary); } catch {}
    throw wrapError('ATOMIC_WRITE_FAILED', `Unable to atomically replace: ${target}`, error);
  }
}

export async function atomicWriteText(filePath, value, options = {}) {
  if (typeof value !== 'string') throw new FilesystemCubeError('INVALID_DATA', 'atomicWriteText expects a string');
  return atomicWriteBytes(filePath, Buffer.from(value, options.encoding ?? 'utf8'), options);
}

export async function list(directoryPath = '.', options = {}) {
  const target = resolvePath(directoryPath, options);
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      type: entry.isFile() ? 'file' : entry.isDirectory() ? 'directory' : 'other'
    }));
  } catch (error) {
    throw wrapError(error?.code === 'ENOENT' ? 'NOT_FOUND' : 'LIST_FAILED', `Unable to list: ${target}`, error);
  }
}

export async function mkdir(directoryPath, options = {}) {
  const target = resolvePath(directoryPath, options);
  try {
    await fs.mkdir(target, { recursive: options.recursive ?? true, mode: options.mode });
  } catch (error) {
    throw wrapError('MKDIR_FAILED', `Unable to create directory: ${target}`, error);
  }
}

export async function remove(filePath, options = {}) {
  const target = resolvePath(filePath, options);
  try {
    await fs.rm(target, { recursive: options.recursive ?? false, force: options.force ?? false });
  } catch (error) {
    throw wrapError(error?.code === 'ENOENT' ? 'NOT_FOUND' : 'REMOVE_FAILED', `Unable to remove: ${target}`, error);
  }
}

export async function copy(sourcePath, destinationPath, options = {}) {
  const source = resolvePath(sourcePath, options);
  const destination = resolvePath(destinationPath, options);
  try {
    if (options.mkdir) await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, {
      recursive: options.recursive ?? false,
      force: options.force ?? false,
      errorOnExist: options.errorOnExist ?? false
    });
  } catch (error) {
    throw wrapError('COPY_FAILED', `Unable to copy ${source} to ${destination}`, error);
  }
}

export async function move(sourcePath, destinationPath, options = {}) {
  const source = resolvePath(sourcePath, options);
  const destination = resolvePath(destinationPath, options);
  try {
    if (options.mkdir) await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
  } catch (error) {
    throw wrapError('MOVE_FAILED', `Unable to move ${source} to ${destination}`, error);
  }
}
