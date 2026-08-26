import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';

const FORMAT = 'FRJ1';
const DEFAULT_LIMITS = Object.freeze({
  maxJournalBytes: 4 * 1024 * 1024,
  maxRecordBytes: 64 * 1024,
  maxOperations: 4096,
  maxTransitions: 64,
  maxObservations: 64,
  maxReferenceBytes: 16 * 1024,
  maxDiagnosticsBytes: 2048,
});
const STATES = new Set(['prepared', 'started', 'progressing', 'succeeded', 'failed', 'cancelled', 'interrupted', 'recovery-decided']);
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'recovery-decided']);
const TRANSITIONS = new Map([
  ['prepared', new Set(['started', 'cancelled'])],
  ['started', new Set(['progressing', 'cancelled', 'interrupted', 'failed', 'succeeded'])],
  ['progressing', new Set(['progressing', 'cancelled', 'interrupted', 'failed', 'succeeded'])],
  ['interrupted', new Set(['recovery-decided'])],
  ['failed', new Set(['recovery-decided'])],
]);

export class RecoveryJournalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RecoveryJournalError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}

const fail = (code, message, details = {}) => { throw new RecoveryJournalError(code, message, details); };
const freeze = (value) => Object.freeze(value);

function isObject(value) { return value !== null && typeof value === 'object'; }
function utf8(value) { return Buffer.byteLength(value, 'utf8'); }
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }

function assertPlainData(value, label, seen = new Set(), depth = 0) {
  if (depth > 12) fail('INVALID_INPUT', `${label} exceeds validation depth`);
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
    assertPlainData(descriptor.value, `${label}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function assertCapabilities(capabilities) {
  if (!isObject(capabilities) || Array.isArray(capabilities)) fail('INVALID_INPUT', 'capabilities must be an object');
  for (const key of Object.getOwnPropertyNames(capabilities)) {
    const d = Object.getOwnPropertyDescriptor(capabilities, key);
    if (!d || !('value' in d)) fail('ACCESSOR_INPUT', `capabilities.${key} is accessor-backed`);
    if (typeof d.value !== 'function') fail('CAPABILITY_FAILURE', `${key} capability must be callable`);
  }
  for (const key of ['read', 'write', 'now', 'identity', 'hash']) {
    if (typeof capabilities[key] !== 'function') fail('CAPABILITY_FAILURE', `${key} capability is required`);
  }
}

const nativeCapabilities = Object.freeze({
  read: (path) => readFile(path, 'utf8'),
  write: async (path, text) => appendFile(path, text, 'utf8'),
  now: () => Date.now(),
  identity: () => randomUUID(),
  hash,
  exists: async (path) => { try { await stat(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; } },
  preparePath: async (path) => { const slash = path.lastIndexOf('/'); const parent = slash > 0 ? path.slice(0, slash) : '.'; await mkdir(parent, { recursive: true }); return path; },
});

function normalizeLimits(input) {
  assertPlainData(input, 'limits');
  const limits = { ...DEFAULT_LIMITS, ...input };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_LIMIT', `${key} must be a positive safe integer`);
  return freeze(limits);
}

function normalizeConfig(options) {
  assertPlainData(options, 'options');
  if (typeof options.path !== 'string' || options.path.length === 0) fail('INVALID_INPUT', 'journal path is required');
  const limits = normalizeLimits(options.limits ?? {});
  return freeze({ path: options.path, limits });
}

function safeDiagnostic(error, limit) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return message.slice(0, Math.max(1, Math.min(limit, 2048)));
}

function payloadFor(record) {
  const { integrity, ...payload } = record;
  return payload;
}

function sealRecord(record, hashFn) {
  const payload = canonical(payloadFor(record));
  return freeze({ ...record, integrity: `sha256:${hashFn(payload)}` });
}

function verifyRecord(record, hashFn) {
  assertPlainData(record, 'record');
  if (record.format !== FORMAT || !Number.isSafeInteger(record.sequence) || record.sequence < 1 || typeof record.integrity !== 'string') fail('JOURNAL_CORRUPTION', 'record envelope is invalid');
  const expected = `sha256:${hashFn(canonical(payloadFor(record)))}`;
  if (record.integrity !== expected) fail('INTEGRITY_MISMATCH', 'record integrity mismatch');
  return record;
}

function parseJournal(text, limits, hashFn) {
  if (typeof text !== 'string' || utf8(text) > limits.maxJournalBytes) fail('JOURNAL_SIZE_LIMIT', 'journal exceeds configured size');
  if (text.length === 0) return [];
  const lines = text.split('\n').filter(Boolean);
  if (lines.length > limits.maxOperations * (limits.maxTransitions + limits.maxObservations + 4)) fail('RECOVERY_WORK_LIMIT', 'journal work bound exceeded');
  const records = [];
  let previous = 0;
  for (const line of lines) {
    if (utf8(line) > limits.maxRecordBytes) fail('RECORD_SIZE_LIMIT', 'record exceeds configured size');
    let record; try { record = JSON.parse(line); } catch { fail('JOURNAL_CORRUPTION', 'journal record is not valid JSON'); }
    verifyRecord(record, hashFn);
    if (record.sequence !== previous + 1) fail('SEQUENCE_CONFLICT', 'journal sequence is not contiguous');
    previous = record.sequence;
    records.push(record);
  }
  return records;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function operationMap(records) {
  const map = new Map();
  for (const record of records) {
    if (record.kind === 'operation') {
      if (map.has(record.operationId)) fail('DUPLICATE_OPERATION', 'duplicate operation identifier');
      map.set(record.operationId, { operationId: record.operationId, intent: record.intent, state: 'prepared', transitions: 0, observations: 0, decision: null, outcome: null });
    } else {
      const op = map.get(record.operationId);
      if (!op) fail('JOURNAL_CORRUPTION', 'record references unknown operation');
      if (record.kind === 'transition') { op.state = record.to; op.transitions += 1; }
      if (record.kind === 'observation') op.observations += 1;
      if (record.kind === 'outcome') { op.state = record.state; op.outcome = record.outcome; }
      if (record.kind === 'recovery-decision') { op.state = 'recovery-decided'; op.decision = record.decision; }
    }
  }
  return map;
}

function immutableOperation(op) { return freeze({ ...op, intent: freeze(clone(op.intent)), outcome: op.outcome ? freeze(clone(op.outcome)) : null, decision: op.decision ? freeze(clone(op.decision)) : null }); }

export function createRecoveryJournal(options, capabilities = nativeCapabilities) {
  assertCapabilities(capabilities);
  const config = normalizeConfig(options);
  const journalId = (() => { try { return capabilities.identity(); } catch { fail('CAPABILITY_FAILURE', 'identity capability failed'); } })();
  if (typeof journalId !== 'string' || !journalId || journalId.length > 128) fail('CAPABILITY_FAILURE', 'identity capability returned invalid value');
  const state = { journalId, path: config.path, limits: config.limits, nextSequence: 1, records: [], operations: new Map() };
  async function load() {
    let text = '';
    try { text = await capabilities.read(config.path); } catch (error) { if (error?.code !== 'ENOENT') throw new RecoveryJournalError('PERSISTENCE_FAILURE', 'journal read failed'); }
    const records = parseJournal(text, config.limits, capabilities.hash);
    state.records = records;
    state.nextSequence = records.length + 1;
    state.operations = operationMap(records);
    return freeze({ journalId: state.journalId, recordCount: records.length, nextSequence: state.nextSequence });
  }
  async function append(kind, operationId, data) {
    const base = { format: FORMAT, sequence: state.nextSequence, journalId: state.journalId, kind, operationId: operationId ?? null, ...clone(data) };
    assertPlainData(base, 'record');
    const sealed = sealRecord(base, capabilities.hash);
    const line = `${JSON.stringify(sealed)}\n`;
    if (utf8(line) > config.limits.maxRecordBytes) fail('RECORD_SIZE_LIMIT', 'record exceeds configured size');
    if (state.records.reduce((n, r) => n + utf8(JSON.stringify(r)) + 1, 0) + utf8(line) > config.limits.maxJournalBytes) fail('JOURNAL_SIZE_LIMIT', 'journal exceeds configured size');
    try { await capabilities.write(config.path, line); } catch (error) { throw new RecoveryJournalError('PERSISTENCE_FAILURE', 'journal append failed', { diagnostic: safeDiagnostic(error, config.limits.maxDiagnosticsBytes) }); }
    state.records.push(sealed); state.nextSequence += 1;
    return sealed;
  }
  async function ensureLoaded() { if (state.records.length === 0 && state.nextSequence === 1) await load(); }
  return freeze({
    journalId,
    path: config.path,
    limits: config.limits,
    load,
    async beginOperation(intent) {
      assertPlainData(intent, 'intent');
      await ensureLoaded();
      if (state.operations.size >= config.limits.maxOperations) fail('JOURNAL_SIZE_LIMIT', 'operation count exceeds limit');
      const operationId = typeof intent.operationId === 'string' && intent.operationId ? intent.operationId : capabilities.identity();
      if (typeof operationId !== 'string' || utf8(operationId) > config.limits.maxReferenceBytes) fail('INVALID_INPUT', 'operation identifier is invalid');
      if (state.operations.has(operationId)) fail('DUPLICATE_OPERATION', 'operation identifier already exists');
      const createdAt = capabilities.now();
      if (!Number.isSafeInteger(createdAt) || createdAt < 0) fail('CAPABILITY_FAILURE', 'now capability returned invalid timestamp');
      const normalizedIntent = freeze({ ...clone(intent), operationId, createdAt });
      await append('operation', operationId, { intent: normalizedIntent });
      state.operations.set(operationId, { operationId, intent: normalizedIntent, state: 'prepared', transitions: 0, observations: 0, decision: null, outcome: null });
      return immutableOperation(state.operations.get(operationId));
    },
    async transition(operationId, to, metadata = {}) {
      assertPlainData(metadata, 'transition.metadata');
      await ensureLoaded();
      const op = state.operations.get(operationId); if (!op) fail('INVALID_INPUT', 'unknown operation');
      if (TERMINAL.has(op.state)) fail('TERMINAL_STATE', 'terminal operation cannot transition');
      if (!STATES.has(to) || !TRANSITIONS.get(op.state)?.has(to)) fail('INVALID_TRANSITION', 'invalid lifecycle transition');
      if (op.transitions >= config.limits.maxTransitions) fail('RECOVERY_WORK_LIMIT', 'transition limit exceeded');
      await append('transition', operationId, { from: op.state, to, metadata: clone(metadata), observedAt: capabilities.now() });
      op.state = to; op.transitions += 1;
      return immutableOperation(op);
    },
    async observe(operationId, observation) {
      assertPlainData(observation, 'observation');
      await ensureLoaded();
      const op = state.operations.get(operationId); if (!op) fail('INVALID_INPUT', 'unknown operation');
      if (op.observations >= config.limits.maxObservations) fail('RECOVERY_WORK_LIMIT', 'observation limit exceeded');
      await append('observation', operationId, { observation: clone(observation), observedAt: capabilities.now() });
      op.observations += 1;
      return immutableOperation(op);
    },
    async complete(operationId, stateName, outcome = {}) {
      assertPlainData(outcome, 'outcome');
      await ensureLoaded();
      const op = state.operations.get(operationId); if (!op) fail('INVALID_INPUT', 'unknown operation');
      if (!['succeeded', 'failed', 'cancelled'].includes(stateName) || !TRANSITIONS.get(op.state)?.has(stateName)) fail('INVALID_TRANSITION', 'invalid terminal outcome');
      await append('outcome', operationId, { state: stateName, outcome: clone(outcome), completedAt: capabilities.now() });
      op.state = stateName; op.outcome = clone(outcome);
      return immutableOperation(op);
    },
    async inspectRecoverable() {
      await ensureLoaded();
      return freeze([...state.operations.values()].filter((op) => ['prepared', 'started', 'progressing', 'interrupted', 'failed'].includes(op.state)).map(immutableOperation));
    },
    async decide(operationId, decision) {
      assertPlainData(decision, 'decision');
      await ensureLoaded();
      const op = state.operations.get(operationId); if (!op) fail('INVALID_INPUT', 'unknown operation');
      if (!['interrupted', 'failed'].includes(op.state)) fail('INVALID_TRANSITION', 'operation is not awaiting recovery decision');
      if (op.decision) fail('DUPLICATE_DECISION', 'recovery decision already exists');
      const allowed = new Set(['resume-permitted', 'rollback-required', 'manual-review', 'discard-record']);
      if (!allowed.has(decision.kind)) fail('INVALID_INPUT', 'unsupported recovery decision');
      const record = await append('recovery-decision', operationId, { decision: clone(decision), decidedAt: capabilities.now() });
      op.state = 'recovery-decided'; op.decision = clone(decision);
      return freeze({ operation: immutableOperation(op), record: freeze({ ...record }) });
    },
    async snapshot() {
      await ensureLoaded();
      return freeze({ format: FORMAT, journalId: state.journalId, path: state.path, nextSequence: state.nextSequence, records: freeze(state.records.map((r) => freeze(clone(r)))) });
    },
  });
}

export { FORMAT as FILESYSTEM_RECOVERY_JOURNAL_FORMAT, nativeCapabilities };
