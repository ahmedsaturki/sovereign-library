import crypto from 'node:crypto';

export const MAX_CANDIDATES = 4096;
export const MAX_EVIDENCE = 2048;
export const MAX_STRING = 4096;
export const MAX_DEPTH = 8;
export const MAX_NODES = 4096;

const ADMISSION = new Set(['eligible', 'blocked']);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SEMVER = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ID = /^[-A-Za-z0-9_.:]+$/;

export class ReleaseSnapshotError extends Error {
  constructor(code, message) { super(message); this.name = 'ReleaseSnapshotError'; this.code = code; Object.freeze(this); }
}
function fail(code, message) { throw new ReleaseSnapshotError(code, message); }
function assertString(value, label) { if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded non-empty string`); }
function assertPlain(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) { const d = Object.getOwnPropertyDescriptor(value, key); if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`); if (typeof key !== 'string') fail('INVALID_INPUT', `${label} has unsupported key type`); }
}
function scanSafe(value, seen, depth = 0, nodes = 0, label = 'input') {
  if (depth > MAX_DEPTH) fail('BOUNDS', `${label} exceeds maximum depth`);
  if (value === null || typeof value !== 'object') return nodes + 1;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  seen.add(value); let total = nodes + 1;
  if (Array.isArray(value)) {
    for (const d of Object.values(Object.getOwnPropertyDescriptors(value))) if (!('value' in d)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    for (const child of value) total = scanSafe(child, seen, depth + 1, total, label);
  } else { assertPlain(value, label); for (const child of Object.values(value)) total = scanSafe(child, seen, depth + 1, total, label); }
  seen.delete(value); if (total > MAX_NODES) fail('BOUNDS', `${label} exceeds maximum node count`); return total;
}
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; }
function freezeDeep(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freezeDeep(child); Object.freeze(value); } return value; }
function validateCandidate(candidate) {
  assertPlain(candidate, 'candidate'); scanSafe(candidate, new Set(), 0, 0, 'candidate');
  assertString(candidate.id, 'candidate.id'); if (!ID.test(candidate.id)) fail('INVALID_ID', `invalid candidate id: ${candidate.id}`);
  assertString(candidate.version, 'candidate.version'); if (!SEMVER.test(candidate.version)) fail('INVALID_VERSION', `invalid version for ${candidate.id}`);
  assertString(candidate.digest, 'candidate.digest'); if (!DIGEST.test(candidate.digest)) fail('INVALID_DIGEST', `invalid digest for ${candidate.id}`);
  if (!ADMISSION.has(candidate.admissionVerdict)) fail('INVALID_ADMISSION', `invalid admission verdict for ${candidate.id}`);
  const refs = candidate.evidenceRefs ?? []; if (!Array.isArray(refs) || refs.length > MAX_EVIDENCE) fail('INVALID_EVIDENCE', `invalid evidenceRefs for ${candidate.id}`);
  const evidenceRefs = refs.map((ref) => { assertString(ref, 'evidenceRef'); return ref; });
  return { id: candidate.id, version: candidate.version, digest: candidate.digest, admissionVerdict: candidate.admissionVerdict, evidenceRefs };
}

export function buildReleaseSnapshot(candidates, config = {}) {
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) fail('BOUNDS', 'candidate count exceeds limit');
  assertPlain(config, 'config'); scanSafe(config, new Set(), 0, 0, 'config');
  const maxEvidence = config.maxEvidence ?? MAX_EVIDENCE; if (!Number.isInteger(maxEvidence) || maxEvidence < 0 || maxEvidence > MAX_EVIDENCE) fail('INVALID_LIMIT', 'maxEvidence is invalid');
  const seen = new Set(); const normalized = [];
  for (const candidate of candidates) {
    const item = validateCandidate(candidate);
    if (seen.has(item.id)) fail('DUPLICATE_CANDIDATE', `duplicate candidate id: ${item.id}`);
    seen.add(item.id); item.evidenceRefs = item.evidenceRefs.slice(0, maxEvidence); normalized.push(item);
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version) || a.digest.localeCompare(b.digest));
  const snapshot = {
    format: 'SCS1',
    mode: 'candidate_snapshot',
    verdict: normalized.every((candidate) => candidate.admissionVerdict === 'eligible') ? 'release_ready' : 'contains_blocked',
    counts: { candidates: normalized.length, eligible: normalized.filter((candidate) => candidate.admissionVerdict === 'eligible').length, blocked: normalized.filter((candidate) => candidate.admissionVerdict === 'blocked').length },
    candidates: normalized,
  };
  return freezeDeep(snapshot);
}

export function serializeReleaseSnapshot(snapshot) {
  assertPlain(snapshot, 'snapshot'); scanSafe(snapshot, new Set(), 0, 0, 'snapshot');
  const payload = JSON.stringify(stable(snapshot)); const checksum = crypto.createHash('sha256').update(payload).digest('hex');
  return JSON.stringify({ format: 'SCS1', checksum, payload });
}
export function parseReleaseSnapshot(serialized) {
  assertString(serialized, 'serialized'); let envelope; try { envelope = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'invalid JSON envelope'); }
  assertPlain(envelope, 'envelope'); if (envelope.format !== 'SCS1' || typeof envelope.checksum !== 'string' || typeof envelope.payload !== 'string') fail('INVALID_SERIALIZATION', 'invalid SCS1 envelope');
  const actual = crypto.createHash('sha256').update(envelope.payload).digest('hex'); if (actual !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'checksum mismatch');
  let snapshot; try { snapshot = JSON.parse(envelope.payload); } catch { fail('INVALID_SERIALIZATION', 'invalid payload'); }
  scanSafe(snapshot, new Set(), 0, 0, 'snapshot'); return freezeDeep(stable(snapshot));
}
