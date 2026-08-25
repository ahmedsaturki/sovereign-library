import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchIndex, SearchError } from '../src/index.js';

const docs = [
  { id: 'a', fields: { title: 'Native Browser Automation', body: 'fast deterministic browser control' } },
  { id: 'b', fields: { title: 'Browser Testing', body: 'deterministic tests for web applications' } },
  { id: 'c', fields: { title: 'Local Search', body: 'fast local text search' } },
];

test('indexes documents and performs exact term search deterministically', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  const first = index.term({ field: 'body', value: 'FAST' });
  const second = index.term({ field: 'body', value: 'fast' });
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((x) => x.id), ['a', 'c']);
  assert.ok(first[0].score > 0);
});

test('AND and OR semantics are correct and tie-breaking is deterministic', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  assert.deepEqual(index.and({ field: 'body', terms: ['deterministic', 'browser'] }).map((x) => x.id), ['a']);
  assert.deepEqual(index.or({ field: 'body', terms: ['browser', 'search'] }).map((x) => x.id), ['a', 'c']);
});

test('prefix expansion and phrase matching work', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  assert.deepEqual(index.prefix({ field: 'body', value: 'brow' }).map((x) => x.id), ['a']);
  assert.deepEqual(index.phrase({ field: 'body', terms: ['fast', 'deterministic'] }).map((x) => x.id), ['a']);
});

test('update and remove replace postings atomically', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  index.update({ id: 'a', fields: { title: 'Updated', body: 'unique replacement' } });
  assert.deepEqual(index.term({ field: 'body', value: 'browser' }).map((x) => x.id), []);
  assert.deepEqual(index.term({ field: 'body', value: 'unique' }).map((x) => x.id), ['a']);
  index.remove('a');
  assert.deepEqual(index.term({ field: 'body', value: 'unique' }).map((x) => x.id), []);
});

test('failed rebuild leaves prior state intact', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  const before = index.term({ field: 'body', value: 'fast' });
  assert.throws(() => index.rebuild([{ id: 'x', fields: { body: 'ok' } }, { id: 'x', fields: { body: 'duplicate' } }]), (error) => error instanceof SearchError && error.code === 'DUPLICATE_DOCUMENT');
  assert.deepEqual(index.term({ field: 'body', value: 'fast' }), before);
});

test('failed mutation does not change source or index', () => {
  const index = createSearchIndex({ limits: { maxDocuments: 2 } });
  index.rebuild(docs.slice(0, 2));
  const source = { id: 'z', fields: { body: 'third document' } };
  const before = JSON.stringify(source);
  assert.throws(() => index.add(source), (error) => error.code === 'INDEX_LIMIT');
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(index.stats().documents, 2);
});

test('results, stats, and config are immutable', () => {
  const index = createSearchIndex();
  index.rebuild(docs);
  const result = index.term({ field: 'body', value: 'fast' });
  assert.throws(() => { result[0].id = 'changed'; });
  const snapshot = index.snapshot();
  assert.throws(() => { snapshot.documents.push('x'); });
  assert.equal(index.stats().documents, 3);
});

test('invalid queries and bounds fail with typed errors', () => {
  const index = createSearchIndex({ limits: { maxResults: 2, maxQueryTerms: 2, maxPrefixTerms: 1 } });
  index.rebuild(docs);
  assert.throws(() => index.and({ field: 'body', terms: [] }), (error) => error.code === 'QUERY_LIMIT');
  assert.throws(() => index.and({ field: 'body', terms: ['a', 'b', 'c'] }), (error) => error.code === 'QUERY_LIMIT');
  assert.throws(() => index.term({ field: '', value: 'fast' }), (error) => error.code === 'INVALID_QUERY');
  assert.throws(() => index.term({ field: 'body', value: 'fast', limit: 3 }), (error) => error.code === 'QUERY_LIMIT');
});

test('accessor configs are rejected before evaluation', () => {
  const config = { get limits() { throw new Error('must not execute'); } };
  assert.throws(() => createSearchIndex(config), (error) => error.code === 'INVALID_CONFIG');
});
