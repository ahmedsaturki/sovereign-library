const DEFAULTS = Object.freeze({
  maxDocuments: 10000,
  maxFieldsPerDocument: 32,
  maxFieldBytes: 1024 * 1024,
  maxTokensPerField: 50000,
  maxUniqueTerms: 200000,
  maxPostingsPerTerm: 10000,
  maxQueryBytes: 16 * 1024,
  maxQueryTerms: 32,
  maxPrefixTerms: 256,
  maxPhraseCandidates: 5000,
  maxResults: 100,
  maxIdBytes: 256,
  maxFieldNameBytes: 128,
});

const objectLike = (value) => value !== null && typeof value === 'object';
const bytes = (value) => Buffer.byteLength(value, 'utf8');

export class SearchError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'SearchError';
    this.code = code;
    this.path = options.path ?? null;
    Object.freeze(this);
  }
}

const fail = (code, message, options = {}) => { throw new SearchError(code, message, options); };

function rejectAccessors(value, path) {
  if (!objectLike(value)) return;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CONFIG', 'Accessor properties are not supported', { path: `${path}.${key}` });
  }
}

function limitsOf(input = {}) {
  if (!objectLike(input) || Array.isArray(input)) fail('INVALID_CONFIG', 'Limits must be an object', { path: 'config.limits' });
  rejectAccessors(input, 'config.limits');
  const limits = Object.freeze({ ...DEFAULTS, ...input });
  for (const [name, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_CONFIG', `${name} must be a positive safe integer`);
  return limits;
}

function clonePublic(value, path = 'value') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (!objectLike(value)) fail('INVALID_CONFIG', 'Unsupported value', { path });
  rejectAccessors(value, path);
  if (Array.isArray(value)) return Object.freeze(value.map((item, i) => clonePublic(item, `${path}[${i}]`)));
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = clonePublic(value[key], `${path}.${key}`);
  return Object.freeze(out);
}

function tokenize(text, limits, path, query = false) {
  if (typeof text !== 'string') fail(query ? 'INVALID_QUERY' : 'INVALID_DOCUMENT', 'Text value must be a string', { path });
  const maxBytes = query ? limits.maxQueryBytes : limits.maxFieldBytes;
  if (bytes(text) > maxBytes) fail(query ? 'QUERY_LIMIT' : 'INDEX_LIMIT', 'Text value exceeds configured limit', { path });
  const normalized = text.normalize('NFKC').toLowerCase();
  const result = [];
  const re = /[\p{L}\p{N}]+/gu;
  let match;
  while ((match = re.exec(normalized)) !== null) {
    if (result.length >= limits.maxTokensPerField) fail('INDEX_LIMIT', 'Token count exceeds configured limit', { path });
    result.push(match[0]);
  }
  return result;
}

function normalizeDocument(document, limits) {
  if (!objectLike(document) || Array.isArray(document)) fail('INVALID_DOCUMENT', 'Document must be an object', { path: 'document' });
  rejectAccessors(document, 'document');
  if (typeof document.id !== 'string' || document.id.length === 0 || bytes(document.id) > limits.maxIdBytes) fail('INVALID_DOCUMENT', 'Document id is invalid', { path: 'document.id' });
  if (!objectLike(document.fields) || Array.isArray(document.fields)) fail('INVALID_DOCUMENT', 'Document fields must be an object', { path: 'document.fields' });
  rejectAccessors(document.fields, 'document.fields');
  const names = Object.keys(document.fields).sort();
  if (names.length > limits.maxFieldsPerDocument) fail('INDEX_LIMIT', 'Field count exceeds configured limit', { path: 'document.fields' });
  const fields = {};
  for (const name of names) {
    if (name.length === 0 || bytes(name) > limits.maxFieldNameBytes) fail('INVALID_DOCUMENT', 'Field name is invalid', { path: 'document.fields' });
    fields[name] = tokenize(document.fields[name], limits, `document.fields.${name}`);
  }
  return Object.freeze({ id: document.id, fields: Object.freeze(fields) });
}

function cloneIndexFields(fields) {
  const output = new Map();
  for (const [field, terms] of fields) {
    const nextTerms = new Map();
    for (const [term, docs] of terms) {
      const nextDocs = new Map();
      for (const [id, posting] of docs) nextDocs.set(id, { freq: posting.freq, positions: [...posting.positions] });
      nextTerms.set(term, nextDocs);
    }
    output.set(field, nextTerms);
  }
  return output;
}

function stats(state) {
  return Object.freeze({ documents: state.documents.size, fields: state.fieldNames.size, terms: state.termCount, postings: state.postingCount, version: state.version });
}

function score(total, df, tf) {
  return (1 + Math.log(Math.max(1, tf))) * (Math.log(1 + total / (1 + df)) + 1);
}

function finish(entries, limit) {
  entries.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return Object.freeze(entries.slice(0, limit).map((entry) => Object.freeze({ id: entry.id, score: Number.isFinite(entry.score) ? entry.score : 0, matches: entry.matches })));
}

export function createSearchIndex(config = {}) {
  if (!objectLike(config) || Array.isArray(config)) fail('INVALID_CONFIG', 'Configuration must be an object');
  rejectAccessors(config, 'config');
  const limits = limitsOf(config.limits ?? {});
  let state = { documents: new Map(), fields: new Map(), fieldNames: new Set(), termCount: 0, postingCount: 0, version: 0 };

  function addTo(target, document) {
    if (target.documents.size >= limits.maxDocuments && !target.documents.has(document.id)) fail('INDEX_LIMIT', 'Document count exceeds limit');
    target.documents.set(document.id, document);
    for (const [field, tokens] of Object.entries(document.fields)) {
      target.fieldNames.add(field);
      let terms = target.fields.get(field);
      if (!terms) { terms = new Map(); target.fields.set(field, terms); }
      const positions = new Map();
      for (let i = 0; i < tokens.length; i += 1) (positions.get(tokens[i]) ?? positions.set(tokens[i], []).get(tokens[i])).push(i);
      for (const [term, pos] of positions) {
        let docs = terms.get(term);
        if (!docs) {
          if (target.termCount >= limits.maxUniqueTerms) fail('INDEX_LIMIT', 'Unique term count exceeds limit');
          docs = new Map(); terms.set(term, docs); target.termCount += 1;
        }
        if (docs.size >= limits.maxPostingsPerTerm && !docs.has(document.id)) fail('INDEX_LIMIT', 'Posting count exceeds limit', { path: `field.${field}.${term}` });
        docs.set(document.id, { freq: pos.length, positions: pos });
        target.postingCount += 1;
      }
    }
  }

  function removeFrom(target, document) {
    for (const [field, tokens] of Object.entries(document.fields)) {
      const terms = target.fields.get(field);
      if (!terms) continue;
      for (const term of new Set(tokens)) {
        const docs = terms.get(term);
        if (!docs) continue;
        if (docs.delete(document.id)) target.postingCount -= 1;
        if (docs.size === 0) { terms.delete(term); target.termCount -= 1; }
      }
      if (terms.size === 0) { target.fields.delete(field); target.fieldNames.delete(field); }
    }
    target.documents.delete(document.id);
  }

  function mutate(document, mode) {
    const normalized = normalizeDocument(document, limits);
    const previous = state.documents.get(normalized.id);
    if (mode === 'add' && previous) fail('DUPLICATE_DOCUMENT', 'Document id already exists', { path: 'document.id' });
    if (mode === 'update' && !previous) fail('UNKNOWN_DOCUMENT', 'Document id does not exist', { path: 'document.id' });
    const next = { documents: new Map(state.documents), fields: cloneIndexFields(state.fields), fieldNames: new Set(state.fieldNames), termCount: state.termCount, postingCount: state.postingCount, version: state.version + 1 };
    if (previous) removeFrom(next, previous);
    addTo(next, normalized);
    state = next;
  }

  function fieldName(field) {
    if (typeof field !== 'string' || field.length === 0 || bytes(field) > limits.maxFieldNameBytes) fail('INVALID_QUERY', 'Invalid query field', { path: 'query.field' });
    return field;
  }

  function queryTerms(values) {
    if (!Array.isArray(values) || values.length === 0 || values.length > limits.maxQueryTerms) fail('QUERY_LIMIT', 'Invalid query term count', { path: 'query.terms' });
    return values.map((value) => {
      const parsed = tokenize(value, limits, 'query.terms', true);
      if (parsed.length !== 1) fail('INVALID_QUERY', 'Each query term must normalize to one token', { path: 'query.terms' });
      return parsed[0];
    });
  }

  function resultLimit(value) {
    if (value === undefined) return limits.maxResults;
    if (!Number.isSafeInteger(value) || value < 1 || value > limits.maxResults) fail('QUERY_LIMIT', 'Invalid result limit', { path: 'query.limit' });
    return value;
  }

  function docsFor(field, term) {
    const docs = state.fields.get(field)?.get(term);
    return docs ? new Map(docs) : new Map();
  }

  function ranked(field, terms, mode) {
    const postings = terms.map((term) => docsFor(field, term));
    const ids = new Set();
    if (mode === 'and') {
      if (postings.some((docs) => docs.size === 0)) return [];
      for (const id of postings[0].keys()) if (postings.every((docs) => docs.has(id))) ids.add(id);
    } else for (const docs of postings) for (const id of docs.keys()) ids.add(id);
    const results = [];
    for (const id of ids) {
      let totalScore = 0;
      let matches = 0;
      for (const docs of postings) {
        const posting = docs.get(id);
        if (!posting) continue;
        matches += 1;
        totalScore += score(state.documents.size, docs.size, posting.freq);
      }
      results.push({ id, score: totalScore, matches });
    }
    return results;
  }

  function snapshot() {
    const documents = [...state.documents.values()].sort((a, b) => a.id.localeCompare(b.id)).map((document) => Object.freeze({ id: document.id, fields: clonePublic(Object.fromEntries(Object.entries(document.fields).map(([field, tokens]) => [field, tokens.join(' ')]))) }));
    return Object.freeze({ version: state.version, stats: stats(state), documents: Object.freeze(documents) });
  }

  return Object.freeze({
    add(document) { mutate(document, 'add'); return stats(state); },
    update(document) { mutate(document, 'update'); return stats(state); },
    remove(id) {
      if (typeof id !== 'string' || id.length === 0 || bytes(id) > limits.maxIdBytes) fail('INVALID_DOCUMENT', 'Document id is invalid', { path: 'document.id' });
      const previous = state.documents.get(id);
      if (!previous) fail('UNKNOWN_DOCUMENT', 'Document id does not exist', { path: 'document.id' });
      const next = { documents: new Map(state.documents), fields: cloneIndexFields(state.fields), fieldNames: new Set(state.fieldNames), termCount: state.termCount, postingCount: state.postingCount, version: state.version + 1 };
      removeFrom(next, previous);
      state = next;
      return stats(state);
    },
    rebuild(documents) {
      if (!Array.isArray(documents) || documents.length > limits.maxDocuments) fail('INDEX_LIMIT', 'Document collection exceeds limit', { path: 'documents' });
      const next = { documents: new Map(), fields: new Map(), fieldNames: new Set(), termCount: 0, postingCount: 0, version: state.version + 1 };
      for (const document of documents) {
        const normalized = normalizeDocument(document, limits);
        if (next.documents.has(normalized.id)) fail('DUPLICATE_DOCUMENT', 'Duplicate document id', { path: 'document.id' });
        addTo(next, normalized);
      }
      state = next;
      return stats(state);
    },
    term({ field: name, value, limit } = {}) {
      const [term] = queryTerms([value]);
      return finish(ranked(fieldName(name), [term], 'or'), resultLimit(limit));
    },
    and({ field: name, terms, limit } = {}) {
      return finish(ranked(fieldName(name), queryTerms(terms), 'and'), resultLimit(limit));
    },
    or({ field: name, terms, limit } = {}) {
      return finish(ranked(fieldName(name), queryTerms(terms), 'or'), resultLimit(limit));
    },
    prefix({ field: name, value, limit } = {}) {
      const field = fieldName(name);
      if (typeof value !== 'string' || bytes(value) > limits.maxQueryBytes) fail('INVALID_QUERY', 'Invalid prefix', { path: 'query.value' });
      const [prefix] = queryTerms([value]);
      const terms = state.fields.get(field);
      if (!terms) return Object.freeze([]);
      const matches = [...terms.keys()].filter((term) => term.startsWith(prefix)).sort();
      if (matches.length > limits.maxPrefixTerms) fail('QUERY_LIMIT', 'Prefix expansion exceeds limit', { path: 'query.value' });
      return finish(ranked(field, matches, 'or'), resultLimit(limit));
    },
    phrase({ field: name, terms, limit } = {}) {
      const field = fieldName(name);
      const tokens = queryTerms(terms);
      const candidates = ranked(field, tokens, 'and');
      if (candidates.length > limits.maxPhraseCandidates) fail('QUERY_LIMIT', 'Phrase candidate count exceeds limit', { path: 'query.terms' });
      const termsMap = state.fields.get(field);
      const results = [];
      for (const candidate of candidates) {
        const positions = tokens.map((token) => termsMap.get(token).get(candidate.id).positions);
        let hits = 0;
        for (const start of positions[0]) {
          let match = true;
          for (let i = 1; i < positions.length; i += 1) if (!positions[i].includes(start + i)) { match = false; break; }
          if (match) hits += 1;
        }
        if (hits > 0) results.push({ id: candidate.id, score: candidate.score + hits * 2, matches: candidate.matches });
      }
      return finish(results, resultLimit(limit));
    },
    snapshot,
    stats: () => stats(state),
  });
}
