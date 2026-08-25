import { createHash } from 'node:crypto';

const DEFAULT_MAX_EVENTS = 10000;
const DEFAULT_MAX_METADATA_KEYS = 32;
const DEFAULT_MAX_METADATA_STRING = 2048;
const DEFAULT_MAX_TRAVERSAL_DEPTH = 64;
const DEFAULT_MAX_RESULTS = 1000;
const WIRE_VERSION = 1;

export class ProvenanceError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ProvenanceError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function assertPlainObject(value, code, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ProvenanceError(code, `${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new ProvenanceError('ACCESSOR_INPUT', `${label} contains an accessor`);
    if (typeof key !== 'string') throw new ProvenanceError(code, `${label} contains a non-string key`);
  }
}

function cloneAndValidateMetadata(input, limits) {
  assertPlainObject(input ?? {}, 'INVALID_METADATA', 'metadata');
  const keys = Object.keys(input ?? {});
  if (keys.length > limits.maxMetadataKeys) throw new ProvenanceError('INVALID_LIMIT', `metadata exceeds ${limits.maxMetadataKeys} keys`);
  const output = {};
  for (const key of keys.sort()) {
    const value = input[key];
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      if (typeof value === 'string' && value.length > limits.maxMetadataString) throw new ProvenanceError('INVALID_LIMIT', `metadata value for ${key} exceeds limit`);
      output[key] = value;
      continue;
    }
    throw new ProvenanceError('INVALID_METADATA', `metadata value for ${key} is unsupported`);
  }
  return output;
}

function assertId(value, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9._:/-]+$/.test(value)) throw new ProvenanceError('INVALID_ID', `${label} is invalid`);
  return value;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

function checksumPayload(payload) {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function immutableSnapshot(events, artifacts) {
  const snapshot = {
    events: events.map(event => Object.freeze({
      ...event,
      parents: Object.freeze([...event.parents]),
      metadata: Object.freeze({ ...event.metadata }),
    })),
    artifacts: artifacts.map(artifact => Object.freeze({ ...artifact })),
  };
  Object.freeze(snapshot.events);
  Object.freeze(snapshot.artifacts);
  return Object.freeze(snapshot);
}

export function createProvenanceLedger(options = {}) {
  assertPlainObject(options, 'INVALID_OPTIONS', 'options');
  const limits = Object.freeze({
    maxEvents: options.maxEvents ?? DEFAULT_MAX_EVENTS,
    maxMetadataKeys: options.maxMetadataKeys ?? DEFAULT_MAX_METADATA_KEYS,
    maxMetadataString: options.maxMetadataString ?? DEFAULT_MAX_METADATA_STRING,
    maxTraversalDepth: options.maxTraversalDepth ?? DEFAULT_MAX_TRAVERSAL_DEPTH,
    maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
  });
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new ProvenanceError('INVALID_LIMIT', `${key} must be a safe integer >= 1`);
  }

  const events = [];
  const eventIds = new Set();
  const artifacts = new Map();
  let sequence = 0;

  function addArtifact(id) {
    assertId(id, 'artifactId');
    if (!artifacts.has(id)) artifacts.set(id, { id });
  }

  function append(input) {
    assertPlainObject(input, 'INVALID_EVENT', 'event');
    if (events.length >= limits.maxEvents) throw new ProvenanceError('INVALID_LIMIT', `ledger limit ${limits.maxEvents} reached`, { statusCode: 413 });
    const eventId = assertId(input.eventId, 'eventId');
    if (eventIds.has(eventId)) throw new ProvenanceError('DUPLICATE_EVENT', `event ${eventId} already exists`, { statusCode: 409 });
    const actor = assertId(input.actor, 'actor');
    const action = assertId(input.action, 'action');
    const source = assertId(input.source, 'source');
    const parents = Array.isArray(input.parents) ? [...new Set(input.parents.map(parent => assertId(parent, 'parentArtifact')))].sort() : [];
    const derived = assertId(input.derivedArtifact, 'derivedArtifact');
    for (const parent of parents) addArtifact(parent);
    addArtifact(derived);
    const event = {
      eventId,
      sequence: sequence++,
      actor,
      action,
      source,
      parents,
      derivedArtifact: derived,
      metadata: cloneAndValidateMetadata(input.metadata ?? {}, limits),
    };
    events.push(Object.freeze(event));
    eventIds.add(eventId);
    return Object.freeze({ ...event, parents: Object.freeze([...parents]), metadata: Object.freeze({ ...event.metadata }) });
  }

  function snapshot() {
    return immutableSnapshot(events, [...artifacts.values()]);
  }

  function traverse(startArtifact, direction, options = {}) {
    assertId(startArtifact, 'artifactId');
    const maxDepth = options.maxDepth ?? limits.maxTraversalDepth;
    const maxResults = options.maxResults ?? limits.maxResults;
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > limits.maxTraversalDepth) throw new ProvenanceError('INVALID_LIMIT', 'maxDepth exceeds bounds');
    if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > limits.maxResults) throw new ProvenanceError('INVALID_LIMIT', 'maxResults exceeds bounds');
    const adjacency = new Map();
    for (const event of events) {
      const target = direction === 'ancestors' ? event.derivedArtifact : event.parents;
      const neighbors = direction === 'ancestors' ? event.parents : [event.derivedArtifact];
      if (!adjacency.has(target instanceof Array ? target[0] : target)) { /* no-op; build below */ }
      for (const node of Array.isArray(target) ? target : [target]) {
        if (!adjacency.has(node)) adjacency.set(node, []);
        for (const neighbor of neighbors) if (neighbor !== node) adjacency.get(node).push(neighbor);
      }
    }
    const queue = [{ id: startArtifact, depth: 0 }];
    const seen = new Set([startArtifact]);
    const result = [];
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      const next = [...(adjacency.get(current.id) ?? [])].sort();
      for (const neighbor of next) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        result.push(Object.freeze({ id: neighbor, depth: current.depth + 1 }));
        if (result.length >= maxResults) return Object.freeze(result);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
    return Object.freeze(result);
  }

  function serialize() {
    const payload = canonical({ version: WIRE_VERSION, limits, events: events.map(event => ({ ...event })), artifacts: [...artifacts.values()] });
    const checksum = checksumPayload(payload);
    return JSON.stringify({ version: WIRE_VERSION, checksum, payload });
  }

  function stats() {
    return Object.freeze({ events: events.length, artifacts: artifacts.size });
  }

  return Object.freeze({ append, snapshot, ancestors: (artifactId, options) => traverse(artifactId, 'ancestors', options), descendants: (artifactId, options) => traverse(artifactId, 'descendants', options), serialize, stats, limits });
}

export function parseProvenanceSnapshot(serialized, options = {}) {
  if (typeof serialized !== 'string' || serialized.length === 0) throw new ProvenanceError('INVALID_SNAPSHOT', 'serialized snapshot is invalid');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch (cause) { throw new ProvenanceError('INVALID_SNAPSHOT', 'snapshot is not valid JSON', { cause }); }
  if (envelope?.version !== WIRE_VERSION || typeof envelope.payload !== 'string' || typeof envelope.checksum !== 'string') throw new ProvenanceError('INVALID_SNAPSHOT', 'unsupported snapshot format');
  if (checksumPayload(envelope.payload) !== envelope.checksum) throw new ProvenanceError('INTEGRITY_MISMATCH', 'snapshot checksum mismatch');
  let payload;
  try { payload = JSON.parse(envelope.payload); } catch (cause) { throw new ProvenanceError('INVALID_SNAPSHOT', 'snapshot payload is invalid', { cause }); }
  if (payload.version !== WIRE_VERSION) throw new ProvenanceError('INVALID_SNAPSHOT', 'unsupported payload version');
  const ledger = createProvenanceLedger({ ...options, ...(payload.limits ?? {}) });
  for (const event of payload.events ?? []) ledger.append(event);
  return ledger;
}

export { DEFAULT_MAX_EVENTS, DEFAULT_MAX_METADATA_KEYS, DEFAULT_MAX_METADATA_STRING, DEFAULT_MAX_TRAVERSAL_DEPTH, DEFAULT_MAX_RESULTS };
