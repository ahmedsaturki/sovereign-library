import { createHash } from 'node:crypto';

const DEFAULT_MAX_RECORDS = 10000;
const DEFAULT_MAX_MISMATCHES = 5000;
const WIRE_VERSION = 1;

export class ReconciliationError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ReconciliationError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertSafeObject(value, code, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ReconciliationError(code, `${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new ReconciliationError('ACCESSOR_INPUT', `${label} contains an accessor`);
    if (typeof key !== 'string') throw new ReconciliationError(code, `${label} contains a non-string key`);
  }
}

function assertId(value, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9._:/-]+$/.test(value)) throw new ReconciliationError('INVALID_ID', `${label} is invalid`);
  return value;
}

function normalizeRecord(record) {
  assertSafeObject(record, 'INVALID_RECORD', 'record');
  const id = assertId(record.id, 'record.id');
  const normalized = {
    id,
    digest: record.digest === undefined ? null : assertId(record.digest, 'record.digest'),
    version: record.version === undefined ? null : String(record.version),
    lifecycle: record.lifecycle === undefined ? null : String(record.lifecycle),
    parents: Array.isArray(record.parents) ? [...new Set(record.parents.map(value => assertId(value, 'record.parent')))].sort() : [],
  };
  return Object.freeze(normalized);
}

function normalizeSnapshot(snapshot, limits, label) {
  assertSafeObject(snapshot, 'INVALID_SNAPSHOT', label);
  if (!Array.isArray(snapshot.records)) throw new ReconciliationError('INVALID_SNAPSHOT', `${label}.records must be an array`);
  if (snapshot.records.length > limits.maxRecords) throw new ReconciliationError('INVALID_LIMIT', `${label} exceeds ${limits.maxRecords} records`, { statusCode: 413 });
  const records = snapshot.records.map(normalizeRecord).sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new ReconciliationError('DUPLICATE_ID', `${label} contains duplicate artifact id ${record.id}`, { statusCode: 409 });
    seen.add(record.id);
  }
  return Object.freeze(records);
}

function classify(a, b) {
  const issues = [];
  if (a.digest !== b.digest) issues.push({ category: 'DIGEST_MISMATCH', severity: 'critical' });
  if (a.version !== b.version) issues.push({ category: 'VERSION_MISMATCH', severity: 'warning' });
  if (a.lifecycle !== b.lifecycle) issues.push({ category: 'LIFECYCLE_MISMATCH', severity: 'warning' });
  if (a.parents.join('\u0000') !== b.parents.join('\u0000')) issues.push({ category: 'LINEAGE_MISMATCH', severity: 'warning' });
  return issues;
}

const severityRank = { critical: 0, warning: 1, info: 2 };
function sortIssues(a, b) {
  return severityRank[a.severity] - severityRank[b.severity] || a.category.localeCompare(b.category) || a.id.localeCompare(b.id) || a.side.localeCompare(b.side);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

function sha256(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }

export function reconcileSnapshots(left, right, options = {}) {
  assertSafeObject(options, 'INVALID_OPTIONS', 'options');
  const limits = Object.freeze({
    maxRecords: options.maxRecords ?? DEFAULT_MAX_RECORDS,
    maxMismatches: options.maxMismatches ?? DEFAULT_MAX_MISMATCHES,
  });
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new ReconciliationError('INVALID_LIMIT', `${key} must be a safe integer >= 1`);
  const leftRecords = normalizeSnapshot(left, limits, 'left');
  const rightRecords = normalizeSnapshot(right, limits, 'right');
  const leftMap = new Map(leftRecords.map(record => [record.id, record]));
  const rightMap = new Map(rightRecords.map(record => [record.id, record]));
  const issues = [];

  function push(issue) {
    if (issues.length >= limits.maxMismatches) throw new ReconciliationError('INVALID_LIMIT', `mismatch report exceeds ${limits.maxMismatches}`, { statusCode: 413 });
    issues.push(Object.freeze(issue));
  }

  for (const record of leftRecords) if (!rightMap.has(record.id)) push({ id: record.id, side: 'left', category: 'MISSING_RIGHT', severity: 'critical' });
  for (const record of rightRecords) if (!leftMap.has(record.id)) push({ id: record.id, side: 'right', category: 'EXTRA_RIGHT', severity: 'warning' });

  const shared = [...leftMap.keys()].filter(id => rightMap.has(id)).sort();
  for (const id of shared) {
    for (const issue of classify(leftMap.get(id), rightMap.get(id))) push({ id, side: 'both', ...issue });
  }

  const report = {
    equal: issues.length === 0,
    counts: Object.freeze({ left: leftRecords.length, right: rightRecords.length, mismatches: issues.length }),
    issues: Object.freeze(issues.sort(sortIssues)),
  };
  return Object.freeze(report);
}

export function serializeReport(report) {
  assertSafeObject(report, 'INVALID_REPORT', 'report');
  const payload = canonical({ version: WIRE_VERSION, report });
  return JSON.stringify({ version: WIRE_VERSION, checksum: sha256(payload), payload });
}

export function parseReport(serialized) {
  if (typeof serialized !== 'string') throw new ReconciliationError('INVALID_REPORT', 'serialized report must be a string');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch (cause) { throw new ReconciliationError('INVALID_REPORT', 'invalid report JSON', { cause }); }
  if (envelope?.version !== WIRE_VERSION || typeof envelope.payload !== 'string' || typeof envelope.checksum !== 'string') throw new ReconciliationError('INVALID_REPORT', 'invalid report envelope');
  if (sha256(envelope.payload) !== envelope.checksum) throw new ReconciliationError('INTEGRITY_MISMATCH', 'report checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch (cause) { throw new ReconciliationError('INVALID_REPORT', 'invalid report payload', { cause }); }
  if (payload.version !== WIRE_VERSION || !payload.report) throw new ReconciliationError('INVALID_REPORT', 'unsupported report payload');
  return Object.freeze(payload.report);
}

export { DEFAULT_MAX_RECORDS, DEFAULT_MAX_MISMATCHES };
