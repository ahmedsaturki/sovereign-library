import { createHash } from 'node:crypto';

export const DEFAULT_LIMITS = Object.freeze({
  maxReferenceLength: 512,
  maxNameLength: 128,
  maxVersionLength: 128,
  maxTagLength: 64,
  maxDigestLength: 160,
  maxCandidates: 1000,
  maxResults: 100,
});

export class ArtifactReferenceError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ArtifactReferenceError';
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    Object.freeze(this);
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertFinitePositiveInteger(value, key) {
  if (!Number.isSafeInteger(value) || value < 1) throw new ArtifactReferenceError('INVALID_LIMIT', `${key} must be a safe integer >= 1`);
}

function assertNoAccessors(value, path = 'input', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new ArtifactReferenceError('CIRCULAR_INPUT', `${path} contains a circular reference`);
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new ArtifactReferenceError('ACCESSOR_INPUT', `${path} contains an accessor at ${String(key)}`);
    if (typeof descriptor.value === 'object' && descriptor.value !== null) assertNoAccessors(descriptor.value, `${path}.${String(key)}`, seen);
  }
  seen.delete(value);
}

function ownClone(value, path = 'input', seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  assertNoAccessors(value, path);
  if (!isPlainRecord(value) && !Array.isArray(value) && !(value instanceof Uint8Array)) throw new ArtifactReferenceError('UNSUPPORTED_VALUE', `${path} contains an unsupported value`);
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  const out = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Reflect.ownKeys(value)) out[key] = ownClone(value[key], `${path}.${String(key)}`, seen);
  return out;
}

function normalizeLimits(input = {}) {
  if (!isPlainRecord(input)) throw new ArtifactReferenceError('INVALID_LIMITS', 'limits must be a plain object');
  assertNoAccessors(input, 'limits');
  const limits = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS)) {
    if (input[key] !== undefined) {
      assertFinitePositiveInteger(input[key], key);
      limits[key] = input[key];
    }
  }
  return Object.freeze(limits);
}

function assertText(value, key, maxLength) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) throw new ArtifactReferenceError('INVALID_FIELD', `${key} must be a non-empty bounded string`);
  if (value.includes('\0') || /[\r\n\t]/u.test(value)) throw new ArtifactReferenceError('INVALID_FIELD', `${key} contains unsupported control characters`);
  return value.trim();
}

function normalizeName(value, limits) {
  const name = assertText(value, 'name', limits.maxNameLength).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._/-]*$/u.test(name)) throw new ArtifactReferenceError('INVALID_NAME', 'artifact name is invalid');
  return name;
}

function normalizeVersion(value, limits) {
  const version = assertText(value, 'version', limits.maxVersionLength);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/u.test(version)) throw new ArtifactReferenceError('INVALID_VERSION', 'artifact version is invalid');
  return version;
}

function normalizeTag(value, limits) {
  const tag = assertText(value, 'tag', limits.maxTagLength).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(tag)) throw new ArtifactReferenceError('INVALID_TAG', 'artifact tag is invalid');
  return tag;
}

function normalizeDigest(value, limits) {
  const digest = assertText(value, 'digest', limits.maxDigestLength).toLowerCase();
  if (!/^(?:sha256:)?[a-f0-9]{64}$/u.test(digest)) throw new ArtifactReferenceError('INVALID_DIGEST', 'artifact digest must be SHA-256 hex or sha256:<hex>');
  return digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
}

export function parseArtifactReference(reference, input = {}) {
  const limits = normalizeLimits(input);
  const raw = assertText(reference, 'reference', limits.maxReferenceLength);
  let rest = raw;
  let digest = null;
  const hashIndex = rest.indexOf('#');
  if (hashIndex !== -1) {
    digest = normalizeDigest(rest.slice(hashIndex + 1), limits);
    rest = rest.slice(0, hashIndex);
  }
  let name;
  let version = null;
  let tag = null;
  const atIndex = rest.lastIndexOf('@');
  if (atIndex > 0) {
    name = normalizeName(rest.slice(0, atIndex), limits);
    const suffix = assertText(rest.slice(atIndex + 1), 'suffix', Math.max(limits.maxVersionLength, limits.maxTagLength));
    if (/^[a-z0-9][a-z0-9._-]*$/u.test(suffix) && !/^v?\d+(?:\.\d+){0,2}(?:[-+][a-z0-9.-]+)?$/iu.test(suffix)) tag = normalizeTag(suffix, limits);
    else version = normalizeVersion(suffix, limits);
  } else {
    const colonIndex = rest.lastIndexOf(':');
    if (colonIndex > 0 && !rest.includes('://')) {
      name = normalizeName(rest.slice(0, colonIndex), limits);
      version = normalizeVersion(rest.slice(colonIndex + 1), limits);
    } else {
      name = normalizeName(rest, limits);
    }
  }
  const canonical = `${name}${version ? `@${version}` : ''}${tag ? `@${tag}` : ''}${digest ? `#${digest}` : ''}`;
  return Object.freeze({ raw, name, version, tag, digest, canonical });
}

function normalizeCandidate(candidate, limits, index) {
  if (!isPlainRecord(candidate)) throw new ArtifactReferenceError('INVALID_CANDIDATE', `candidate ${index} must be a plain object`);
  assertNoAccessors(candidate, `candidates[${index}]`);
  const name = normalizeName(candidate.name, limits);
  const version = candidate.version == null ? null : normalizeVersion(candidate.version, limits);
  const digest = candidate.digest == null ? null : normalizeDigest(candidate.digest, limits);
  const tags = candidate.tags == null ? [] : candidate.tags;
  if (!Array.isArray(tags)) throw new ArtifactReferenceError('INVALID_TAGS', `candidate ${index} tags must be an array`);
  if (tags.length > limits.maxResults) throw new ArtifactReferenceError('LIMIT_EXCEEDED', `candidate ${index} has too many tags`);
  const normalizedTags = [...new Set(tags.map(tag => normalizeTag(tag, limits)))].sort();
  const id = candidate.id == null ? `${name}${version ? `@${version}` : ''}${digest ? `#${digest}` : ''}` : assertText(candidate.id, `candidate ${index} id`, 256);
  const identity = `${name}|${version ?? ''}|${digest ?? ''}|${normalizedTags.join(',')}`;
  return Object.freeze({ id, name, version, digest, tags: Object.freeze(normalizedTags), identity });
}

function candidateSort(a, b) {
  return a.name.localeCompare(b.name) || (a.version ?? '').localeCompare(b.version ?? '') || (a.digest ?? '').localeCompare(b.digest ?? '') || a.id.localeCompare(b.id);
}

function digestScore(reference, candidate) {
  return reference.digest && candidate.digest === reference.digest ? 100 : -1;
}

function exactVersionScore(reference, candidate) {
  return reference.version && candidate.name === reference.name && candidate.version === reference.version ? 90 : -1;
}

function tagScore(reference, candidate) {
  return reference.tag && candidate.name === reference.name && candidate.tags.includes(reference.tag) ? 80 : -1;
}

function nameScore(reference, candidate) {
  return !reference.version && !reference.tag && !reference.digest && candidate.name === reference.name ? 70 : -1;
}

function freezeResult(result) {
  return Object.freeze({
    reference: Object.freeze({ ...result.reference }),
    status: result.status,
    matches: Object.freeze(result.matches.map(match => Object.freeze({ ...match, tags: Object.freeze([...match.tags]) }))),
  });
}

export function createArtifactReferenceResolver(input = {}) {
  if (!isPlainRecord(input)) throw new ArtifactReferenceError('INVALID_OPTIONS', 'resolver options must be a plain object');
  const limits = normalizeLimits(input.limits);
  let candidates = [];

  function setCandidates(nextCandidates) {
    if (!Array.isArray(nextCandidates)) throw new ArtifactReferenceError('INVALID_CANDIDATES', 'candidates must be an array');
    if (nextCandidates.length > limits.maxCandidates) throw new ArtifactReferenceError('LIMIT_EXCEEDED', `candidate count exceeds ${limits.maxCandidates}`);
    const normalized = nextCandidates.map((candidate, index) => normalizeCandidate(candidate, limits, index)).sort(candidateSort);
    const identities = new Set();
    for (const candidate of normalized) {
      if (identities.has(candidate.identity)) throw new ArtifactReferenceError('DUPLICATE_CANDIDATE', `duplicate candidate identity: ${candidate.id}`);
      identities.add(candidate.identity);
    }
    candidates = normalized;
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({ limits, candidates: Object.freeze(candidates.map(candidate => Object.freeze({ id: candidate.id, name: candidate.name, version: candidate.version, digest: candidate.digest, tags: Object.freeze([...candidate.tags]) }))) });
  }

  function resolveReference(reference) {
    const parsed = parseArtifactReference(reference, limits);
    const scored = [];
    for (const candidate of candidates) {
      const score = Math.max(digestScore(parsed, candidate), exactVersionScore(parsed, candidate), tagScore(parsed, candidate), nameScore(parsed, candidate));
      if (score > 0) scored.push({ candidate, score });
    }
    scored.sort((a, b) => b.score - a.score || candidateSort(a.candidate, b.candidate));
    const topScore = scored[0]?.score ?? -1;
    const matches = scored.filter(entry => entry.score === topScore).map(entry => entry.candidate);
    if (matches.length === 0) throw new ArtifactReferenceError('REFERENCE_NOT_FOUND', `no candidate matches ${parsed.canonical}`, { statusCode: 404 });
    if (matches.length > limits.maxResults) throw new ArtifactReferenceError('LIMIT_EXCEEDED', `result count exceeds ${limits.maxResults}`);
    if (matches.length > 1) throw new ArtifactReferenceError('AMBIGUOUS_REFERENCE', `reference ${parsed.canonical} matches multiple candidates`, { statusCode: 409 });
    return freezeResult({ reference: parsed, status: 'resolved', matches });
  }

  setCandidates(input.candidates ?? []);
  return Object.freeze({
    setCandidates,
    resolve: resolveReference,
    snapshot,
  });
}

export function digestReference(reference) {
  const parsed = typeof reference === 'string' ? parseArtifactReference(reference) : reference;
  return `sha256:${createHash('sha256').update(parsed.canonical).digest('hex')}`;
}
