import { createHash } from 'node:crypto';

const WIRE_VERSION = 1;
const DEFAULT_MAX_RECORDS = 10000;
const DEFAULT_MAX_FINDINGS = 5000;

export class AuditError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'AuditError';
    this.code = code;
    Object.freeze(this);
  }
}

function safeObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new AuditError('INVALID_INPUT', `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new AuditError('ACCESSOR_INPUT', `${label} contains an accessor`);
    if (typeof key !== 'string') throw new AuditError('INVALID_INPUT', `${label} contains a non-string key`);
  }
}

function id(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || !/^[A-Za-z0-9._:/-]+$/.test(value)) throw new AuditError('INVALID_ID', `${label} is invalid`);
  return value;
}

function normalizeRecord(record) {
  safeObject(record, 'record');
  return Object.freeze({
    id: id(record.id, 'record.id'),
    digest: record.digest == null ? null : id(record.digest, 'record.digest'),
    version: record.version == null ? null : String(record.version),
    lifecycle: record.lifecycle == null ? null : String(record.lifecycle),
    parents: Array.isArray(record.parents) ? [...new Set(record.parents.map(v => id(v, 'record.parent')))].sort() : [],
  });
}

function normalizeSnapshot(input, limit, label) {
  safeObject(input, label);
  if (!Array.isArray(input.records)) throw new AuditError('INVALID_SNAPSHOT', `${label}.records must be an array`);
  if (input.records.length > limit) throw new AuditError('INVALID_LIMIT', `${label} exceeds ${limit}`);
  const records = input.records.map(normalizeRecord).sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new AuditError('DUPLICATE_ID', `${label} contains duplicate id ${record.id}`);
    seen.add(record.id);
  }
  return Object.freeze(records);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

function sha256(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }

const severityRank = { critical: 0, warning: 1, info: 2 };

function classifyChanges(before, after) {
  const changes = [];
  if (before.digest !== after.digest) changes.push({ category: 'DIGEST_DRIFT', severity: 'critical' });
  if (before.version !== after.version) changes.push({ category: 'VERSION_DRIFT', severity: 'warning' });
  if (before.lifecycle !== after.lifecycle) changes.push({ category: 'LIFECYCLE_DRIFT', severity: 'warning' });
  if (before.parents.join('\u0000') !== after.parents.join('\u0000')) changes.push({ category: 'LINEAGE_DRIFT', severity: 'warning' });
  return changes;
}

export function auditSnapshots(baseline, current, options = {}) {
  safeObject(options, 'options');
  const limits = {
    maxRecords: options.maxRecords ?? DEFAULT_MAX_RECORDS,
    maxFindings: options.maxFindings ?? DEFAULT_MAX_FINDINGS,
  };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new AuditError('INVALID_LIMIT', `${key} must be a safe integer >= 1`);
  const before = normalizeSnapshot(baseline, limits.maxRecords, 'baseline');
  const after = normalizeSnapshot(current, limits.maxRecords, 'current');
  const left = new Map(before.map(r => [r.id, r]));
  const right = new Map(after.map(r => [r.id, r]));
  const findings = [];
  const push = finding => {
    if (findings.length >= limits.maxFindings) throw new AuditError('INVALID_LIMIT', `report exceeds ${limits.maxFindings} findings`);
    findings.push(Object.freeze(finding));
  };

  for (const r of before) if (!right.has(r.id)) push({ id: r.id, state: 'removed', category: 'REMOVED', severity: 'critical', changes: [] });
  for (const r of after) if (!left.has(r.id)) push({ id: r.id, state: 'added', category: 'ADDED', severity: 'warning', changes: [] });

  for (const recordId of [...left.keys()].filter(k => right.has(k)).sort()) {
    const changes = classifyChanges(left.get(recordId), right.get(recordId));
    if (changes.length) {
      push({ id: recordId, state: 'changed', category: 'CHANGED', severity: changes.some(c => c.severity === 'critical') ? 'critical' : 'warning', changes: Object.freeze(changes.map(Object.freeze)) });
    } else {
      push({ id: recordId, state: 'unchanged', category: 'UNCHANGED', severity: 'info', changes: [] });
    }
  }

  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id) || a.category.localeCompare(b.category));
  return Object.freeze({ counts: Object.freeze({ baseline: before.length, current: after.length, findings: findings.length }), findings: Object.freeze(findings) });
}

export function serializeAudit(report) {
  safeObject(report, 'report');
  const payload = canonical({ version: WIRE_VERSION, report });
  return JSON.stringify({ version: WIRE_VERSION, checksum: sha256(payload), payload });
}

export function parseAudit(serialized) {
  if (typeof serialized !== 'string') throw new AuditError('INVALID_REPORT', 'serialized report must be a string');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch (cause) { throw new AuditError('INVALID_REPORT', 'invalid report JSON', { cause }); }
  if (envelope?.version !== WIRE_VERSION || typeof envelope.payload !== 'string' || typeof envelope.checksum !== 'string') throw new AuditError('INVALID_REPORT', 'invalid report envelope');
  if (sha256(envelope.payload) !== envelope.checksum) throw new AuditError('INTEGRITY_MISMATCH', 'audit report checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch (cause) { throw new AuditError('INVALID_REPORT', 'invalid report payload', { cause }); }
  if (payload.version !== WIRE_VERSION || !payload.report) throw new AuditError('INVALID_REPORT', 'unsupported report payload');
  return Object.freeze(payload.report);
}

export { DEFAULT_MAX_RECORDS, DEFAULT_MAX_FINDINGS };
