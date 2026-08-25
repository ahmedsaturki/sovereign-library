import crypto from 'node:crypto';

export const MAX_METADATA = 128;
export const MAX_EVIDENCE = 2048;
export const MAX_STRING = 4096;
export const MAX_DEPTH = 8;
export const MAX_NODES = 4096;
const ID = /^[-A-Za-z0-9_.:]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

export class ReleaseClosureError extends Error {
  constructor(code, message) { super(message); this.name = 'ReleaseClosureError'; this.code = code; Object.freeze(this); }
}
const fail = (code, message) => { throw new ReleaseClosureError(code, message); };
function str(v, label) { if (typeof v !== 'string' || v.length === 0 || v.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded string`); }
function plain(v, label) { if (v === null || typeof v !== 'object' || Array.isArray(v)) fail('INVALID_INPUT', `${label} must be a plain object`); for (const k of Reflect.ownKeys(v)) { const d = Object.getOwnPropertyDescriptor(v, k); if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`); if (typeof k !== 'string') fail('INVALID_INPUT', `${label} has unsupported key type`); } }
function scan(v, seen, depth = 0, nodes = 0, label = 'input') { if (depth > MAX_DEPTH) fail('BOUNDS', `${label} exceeds maximum depth`); if (v === null || typeof v !== 'object') return nodes + 1; if (seen.has(v)) fail('CIRCULAR_INPUT', `${label} is circular`); seen.add(v); let total = nodes + 1; if (Array.isArray(v)) { for (const d of Object.values(Object.getOwnPropertyDescriptors(v))) if (!('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`); for (const x of v) total = scan(x, seen, depth + 1, total, label); } else { plain(v, label); for (const x of Object.values(v)) total = scan(x, seen, depth + 1, total, label); } seen.delete(v); if (total > MAX_NODES) fail('BOUNDS', `${label} exceeds maximum node count`); return total; }
function stable(v) { if (Array.isArray(v)) return v.map(stable); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])); return v; }
function freeze(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const x of Object.values(v)) freeze(x); Object.freeze(v); } return v; }
function validateRef(ref, label) { plain(ref, label); scan(ref, new Set(), 0, 0, label); str(ref.id, `${label}.id`); if (!ID.test(ref.id)) fail('INVALID_ID', `invalid ${label}.id`); str(ref.checksum, `${label}.checksum`); if (!SHA256.test(ref.checksum)) fail('INVALID_CHECKSUM', `invalid ${label}.checksum`); }

export function buildReleaseClosure(snapshot, approval, options = {}) {
  validateRef(snapshot, 'snapshot'); validateRef(approval, 'approval'); plain(options, 'options'); scan(options, new Set(), 0, 0, 'options');
  if (approval.status !== 'approved') fail('NOT_APPROVED', 'approval record is not approved');
  if (snapshot.id !== approval.snapshotId) fail('SNAPSHOT_MISMATCH', 'snapshot id does not match approval');
  if (snapshot.checksum !== approval.snapshotChecksum) fail('SNAPSHOT_MISMATCH', 'snapshot checksum does not match approval');
  const receiptId = options.receiptId ?? `closure:${snapshot.id}`; str(receiptId, 'receiptId'); if (!ID.test(receiptId)) fail('INVALID_ID', 'invalid receiptId');
  const metadata = options.metadata ?? {}; plain(metadata, 'metadata'); scan(metadata, new Set(), 0, 0, 'metadata');
  const keys = Object.keys(metadata); if (keys.length > MAX_METADATA) fail('BOUNDS', 'metadata count exceeds limit'); for (const key of keys) str(key, 'metadata key');
  const refs = options.evidenceRefs ?? []; if (!Array.isArray(refs) || refs.length > MAX_EVIDENCE) fail('INVALID_EVIDENCE', 'invalid evidenceRefs'); refs.forEach((ref) => str(ref, 'evidenceRef'));
  return freeze({ format: 'SRC1', mode: 'closure_receipt', status: 'closed', receiptId, snapshot: { id: snapshot.id, checksum: snapshot.checksum }, approval: { id: approval.id, checksum: approval.checksum, status: approval.status }, metadata: stable(metadata), evidenceRefs: refs.slice() });
}
export function serializeReleaseClosure(receipt) { plain(receipt, 'receipt'); scan(receipt, new Set(), 0, 0, 'receipt'); const payload = JSON.stringify(stable(receipt)); const checksum = crypto.createHash('sha256').update(payload).digest('hex'); return JSON.stringify({ format: 'SRC1', checksum, payload }); }
export function parseReleaseClosure(serialized) { str(serialized, 'serialized'); let env; try { env = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'invalid JSON envelope'); } plain(env, 'envelope'); if (env.format !== 'SRC1' || typeof env.checksum !== 'string' || typeof env.payload !== 'string') fail('INVALID_SERIALIZATION', 'invalid SRC1 envelope'); const actual = crypto.createHash('sha256').update(env.payload).digest('hex'); if (actual !== env.checksum) fail('INTEGRITY_MISMATCH', 'checksum mismatch'); let receipt; try { receipt = JSON.parse(env.payload); } catch { fail('INVALID_SERIALIZATION', 'invalid payload'); } scan(receipt, new Set(), 0, 0, 'receipt'); return freeze(stable(receipt)); }
