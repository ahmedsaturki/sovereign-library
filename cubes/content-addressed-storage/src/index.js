import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_LIMITS = Object.freeze({ maxObjectBytes: 16 * 1024 * 1024, maxObjects: 4096, maxAddressBytes: 128, maxMetadataBytes: 16 * 1024 });
class CasError extends Error { constructor(code, message) { super(message); this.name = 'CasError'; this.code = code; Object.freeze(this); } }
const fail = (code, message) => { throw new CasError(code, message); };
const validateOptions = (options = {}) => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_CONFIG', 'Options must be an object');
  for (const key of Reflect.ownKeys(options)) { const d = Object.getOwnPropertyDescriptor(options, key); if (!d || !('value' in d)) fail('INVALID_CONFIG', 'Accessor configuration is not allowed'); }
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...(options.limits ?? {}) });
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_CONFIG', 'Invalid limit');
  return { root: path.resolve(options.root ?? '.cas'), limits };
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalizeAddress = (value, limits) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail('INVALID_ADDRESS', 'Invalid CAS address');
  if (Buffer.byteLength(value, 'utf8') > limits.maxAddressBytes) fail('LIMIT_EXCEEDED', 'Address exceeds limit');
  return value;
};
const toBytes = (value, limits) => {
  let bytes;
  if (typeof value === 'string') bytes = Buffer.from(value);
  else if (value instanceof Uint8Array) bytes = Buffer.from(value);
  else fail('UNSUPPORTED_VALUE', 'Object must be string or Uint8Array');
  if (bytes.byteLength > limits.maxObjectBytes) fail('LIMIT_EXCEEDED', 'Object exceeds limit');
  return bytes;
};
const objectPath = (root, address) => path.join(root, address.slice(0, 2), address.slice(2, 4), address);
async function ensureSafeRoot(root) { await fs.mkdir(root, { recursive: true }); }

class CasStore {
  constructor(options = {}) { const c = validateOptions(options); this.root = c.root; this.limits = c.limits; this.closed = false; }
  _assertOpen() { if (this.closed) fail('CLOSED', 'CAS store is closed'); }
  async open() { this._assertOpen(); await ensureSafeRoot(this.root); return this; }
  close() { this.closed = true; }
  async put(value, metadata = {}) {
    this._assertOpen(); const bytes = toBytes(value, this.limits);
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) fail('INVALID_METADATA', 'Metadata must be an object');
    for (const key of Reflect.ownKeys(metadata)) { const d = Object.getOwnPropertyDescriptor(metadata, key); if (!d || !('value' in d)) fail('INVALID_METADATA', 'Accessor metadata is not allowed'); }
    const metadataText = JSON.stringify(metadata);
    if (Buffer.byteLength(metadataText, 'utf8') > this.limits.maxMetadataBytes) fail('LIMIT_EXCEEDED', 'Metadata exceeds limit');
    const address = digest(bytes); const file = objectPath(this.root, address); await ensureSafeRoot(path.dirname(file));
    try { const existing = await fs.readFile(file); if (digest(existing) !== address) fail('CORRUPT_OBJECT', 'Stored object integrity failure'); return address; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`; await fs.writeFile(temp, bytes, { flag: 'wx' });
    try { await fs.rename(temp, file); } catch (error) { try { await fs.unlink(temp); } catch {} if (error?.code !== 'EEXIST') throw error; }
    const metaFile = `${file}.meta`; await fs.writeFile(metaFile, metadataText, { flag: 'wx' }).catch(async (error) => { if (error?.code !== 'EEXIST') throw error; });
    return address;
  }
  async has(address) { this._assertOpen(); try { await fs.access(objectPath(this.root, normalizeAddress(address, this.limits))); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } }
  async get(address) { this._assertOpen(); const normalized = normalizeAddress(address, this.limits); try { const bytes = await fs.readFile(objectPath(this.root, normalized)); if (digest(bytes) !== normalized) fail('CORRUPT_OBJECT', 'Object digest mismatch'); return Object.freeze(new Uint8Array(bytes)); } catch (error) { if (error?.code === 'ENOENT') fail('NOT_FOUND', 'Object not found'); throw error; } }
  async delete(address) { this._assertOpen(); const normalized = normalizeAddress(address, this.limits); const file = objectPath(this.root, normalized); try { await fs.unlink(file); } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } try { await fs.unlink(`${file}.meta`); } catch (error) { if (error?.code !== 'ENOENT') throw error; } return true; }
  async metadata(address) { this._assertOpen(); const normalized = normalizeAddress(address, this.limits); try { const text = await fs.readFile(`${objectPath(this.root, normalized)}.meta`, 'utf8'); return Object.freeze(JSON.parse(text)); } catch (error) { if (error?.code === 'ENOENT') return Object.freeze({}); throw error; } }
}
export { DEFAULT_LIMITS, CasError, CasStore, digest, normalizeAddress };
