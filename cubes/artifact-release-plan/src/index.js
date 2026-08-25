import crypto from 'node:crypto';

export const MAX_ARTIFACTS = 4096;
export const MAX_DEPENDENCIES = 8192;
export const MAX_STEPS = 8192;
export const MAX_EVIDENCE = 2048;
export const MAX_STRING = 4096;
export const MAX_DEPTH = 8;
export const MAX_NODES = 4096;

const ADMISSION_VERDICTS = new Set(['eligible', 'blocked']);

export class ReleasePlanError extends Error {
  constructor(code, message) { super(message); this.name = 'ReleasePlanError'; this.code = code; Object.freeze(this); }
}

function fail(code, message) { throw new ReleasePlanError(code, message); }
function assertString(value, label) { if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING) fail('INVALID_INPUT', `${label} must be a bounded non-empty string`); }
function assertPlainRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    if (typeof key !== 'string') fail('INVALID_INPUT', `${label} has unsupported key type`);
  }
}
function scanSafe(value, seen, depth = 0, nodes = 0, label = 'input') {
  if (depth > MAX_DEPTH) fail('BOUNDS', `${label} exceeds maximum depth`);
  if (value === null || typeof value !== 'object') return nodes + 1;
  if (seen.has(value)) fail('CIRCULAR_INPUT', `${label} is circular`);
  seen.add(value);
  let total = nodes + 1;
  if (Array.isArray(value)) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) if (!('value' in descriptor)) fail('ACCESSOR_INPUT', `${label} contains an accessor property`);
    for (const child of value) total = scanSafe(child, seen, depth + 1, total, label);
  } else {
    assertPlainRecord(value, label);
    for (const child of Object.values(value)) total = scanSafe(child, seen, depth + 1, total, label);
  }
  seen.delete(value);
  if (total > MAX_NODES) fail('BOUNDS', `${label} exceeds maximum node count`);
  return total;
}
function clone(value) { return structuredClone(value); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freezeDeep(child); Object.freeze(value); }
  return value;
}
function normalizeArtifacts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > MAX_ARTIFACTS) fail('BOUNDS', 'artifact count exceeds limit');
  const seen = new Set(); const normalized = [];
  for (const artifact of artifacts) {
    assertPlainRecord(artifact, 'artifact'); scanSafe(artifact, new Set(), 0, 0, 'artifact'); assertString(artifact.id, 'artifact.id');
    if (seen.has(artifact.id)) fail('DUPLICATE_ARTIFACT', `duplicate artifact id: ${artifact.id}`);
    seen.add(artifact.id);
    if (artifact.admissionVerdict !== undefined && !ADMISSION_VERDICTS.has(artifact.admissionVerdict)) fail('INVALID_ADMISSION', `unsupported admission verdict for ${artifact.id}`);
    const refs = artifact.evidenceRefs ?? [];
    if (!Array.isArray(refs) || refs.length > MAX_EVIDENCE) fail('INVALID_EVIDENCE', `evidenceRefs are invalid for ${artifact.id}`);
    normalized.push({ id: artifact.id, admissionVerdict: artifact.admissionVerdict, evidenceRefs: refs.map((ref) => { assertString(ref, 'evidenceRef'); return ref; }) });
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id)); return normalized;
}
function normalizeDependencies(dependencies, artifactIds) {
  if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCIES) fail('BOUNDS', 'dependency count exceeds limit');
  const seen = new Set(); const normalized = [];
  for (const dependency of dependencies) {
    assertPlainRecord(dependency, 'dependency'); scanSafe(dependency, new Set(), 0, 0, 'dependency'); assertString(dependency.from, 'dependency.from'); assertString(dependency.to, 'dependency.to');
    if (!artifactIds.has(dependency.from) || !artifactIds.has(dependency.to)) fail('UNKNOWN_ARTIFACT', 'dependency references an unknown artifact');
    if (dependency.from === dependency.to) fail('CYCLE', `self dependency: ${dependency.from}`);
    const key = `${dependency.from}\u0000${dependency.to}`; if (seen.has(key)) fail('DUPLICATE_DEPENDENCY', `duplicate dependency: ${dependency.from} -> ${dependency.to}`); seen.add(key);
    normalized.push({ from: dependency.from, to: dependency.to });
  }
  normalized.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)); return normalized;
}
function normalizeConfig(config = {}) {
  assertPlainRecord(config, 'config'); scanSafe(config, new Set(), 0, 0, 'config');
  const maxSteps = config.maxSteps ?? MAX_STEPS; const maxEvidence = config.maxEvidence ?? MAX_EVIDENCE;
  if (!Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > MAX_STEPS) fail('INVALID_LIMIT', 'maxSteps is invalid');
  if (!Number.isInteger(maxEvidence) || maxEvidence < 0 || maxEvidence > MAX_EVIDENCE) fail('INVALID_LIMIT', 'maxEvidence is invalid');
  if (config.requireAdmission !== undefined && typeof config.requireAdmission !== 'boolean') fail('INVALID_CONFIG', 'requireAdmission must be boolean');
  return { maxSteps, maxEvidence, requireAdmission: config.requireAdmission ?? true };
}
function topologicalOrder(artifacts, dependencies) {
  const ids = artifacts.map((artifact) => artifact.id); const indegree = new Map(ids.map((id) => [id, 0])); const outgoing = new Map(ids.map((id) => [id, []]));
  for (const { from, to } of dependencies) { outgoing.get(from).push(to); indegree.set(to, indegree.get(to) + 1); }
  for (const values of outgoing.values()) values.sort((a, b) => a.localeCompare(b));
  const ready = ids.filter((id) => indegree.get(id) === 0).sort((a, b) => a.localeCompare(b)); const order = [];
  while (ready.length > 0) {
    const id = ready.shift(); order.push(id);
    for (const child of outgoing.get(id)) { const next = indegree.get(child) - 1; indegree.set(child, next); if (next === 0) { ready.push(child); ready.sort((a, b) => a.localeCompare(b)); } }
  }
  if (order.length !== ids.length) fail('CYCLE', 'dependency graph contains a cycle');
  return order;
}
function buildEvidence(artifact, maxEvidence) { return artifact.evidenceRefs.slice(0, maxEvidence); }

export function buildReleasePlan(artifacts, dependencies, config = {}) {
  const normalizedConfig = normalizeConfig(config); const normalizedArtifacts = normalizeArtifacts(artifacts); const artifactIds = new Set(normalizedArtifacts.map((artifact) => artifact.id));
  const normalizedDependencies = normalizeDependencies(dependencies, artifactIds); const byId = new Map(normalizedArtifacts.map((artifact) => [artifact.id, artifact]));
  if (normalizedConfig.requireAdmission) for (const artifact of normalizedArtifacts) {
    if (artifact.admissionVerdict === undefined) fail('MISSING_ADMISSION', `missing admission verdict for ${artifact.id}`);
    if (artifact.admissionVerdict !== 'eligible') fail('BLOCKED_ADMISSION', `artifact ${artifact.id} is not release-eligible`);
  }
  const order = topologicalOrder(normalizedArtifacts, normalizedDependencies); if (order.length > normalizedConfig.maxSteps) fail('BOUNDS', 'release steps exceed limit');
  const dependencyMap = new Map(order.map((id) => [id, []])); for (const edge of normalizedDependencies) dependencyMap.get(edge.to).push(edge.from); for (const list of dependencyMap.values()) list.sort((a, b) => a.localeCompare(b));
  const steps = order.map((id, index) => ({ step: index + 1, artifactId: id, dependsOn: dependencyMap.get(id).slice(), evidenceRefs: buildEvidence(byId.get(id), normalizedConfig.maxEvidence), action: 'plan_only' }));
  return freezeDeep({ format: 'SRP1', mode: 'dry_run', verdict: 'planned', counts: { artifacts: normalizedArtifacts.length, dependencies: normalizedDependencies.length, steps: steps.length }, order, steps });
}
export function serializeReleasePlan(report) {
  assertPlainRecord(report, 'report'); scanSafe(report, new Set(), 0, 0, 'report'); const payload = JSON.stringify(stable(report)); const checksum = crypto.createHash('sha256').update(payload).digest('hex'); return JSON.stringify({ format: 'SRP1', checksum, payload });
}
export function parseReleasePlan(serialized) {
  assertString(serialized, 'serialized'); let envelope; try { envelope = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'invalid JSON envelope'); }
  assertPlainRecord(envelope, 'envelope'); if (envelope.format !== 'SRP1' || typeof envelope.checksum !== 'string' || typeof envelope.payload !== 'string') fail('INVALID_SERIALIZATION', 'invalid SRP1 envelope');
  const actual = crypto.createHash('sha256').update(envelope.payload).digest('hex'); if (actual !== envelope.checksum) fail('INTEGRITY_MISMATCH', 'checksum mismatch');
  let report; try { report = JSON.parse(envelope.payload); } catch { fail('INVALID_SERIALIZATION', 'invalid payload'); }
  scanSafe(report, new Set(), 0, 0, 'report'); return freezeDeep(stable(report));
}
