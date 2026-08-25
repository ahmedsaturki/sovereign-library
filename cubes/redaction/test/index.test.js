import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_MAX_STRING_BYTES,
  DEFAULT_REPLACEMENT,
  RedactionError,
  createRedactor,
} from '../src/index.js';

test('sensitive keys are redacted recursively without mutating input', () => {
  const source = {
    user: {
      name: 'Ahmed',
      password: 'super-secret',
      profile: { apiKey: 'key-123', city: 'Sadat' },
    },
    authorization: 'Bearer should-not-survive',
    values: ['safe', { clientSecret: 'nested-secret' }],
  };
  const original = structuredClone(source);
  const redactor = createRedactor();
  const result = redactor.redactWithReport(source);
  assert.deepEqual(source, original);
  assert.equal(result.value.user.password, DEFAULT_REPLACEMENT);
  assert.equal(result.value.user.profile.apiKey, DEFAULT_REPLACEMENT);
  assert.equal(result.value.authorization, DEFAULT_REPLACEMENT);
  assert.equal(result.value.values[1].clientSecret, DEFAULT_REPLACEMENT);
  assert.equal(result.value.user.name, 'Ahmed');
  assert.ok(result.report.redactedPaths.includes('$.authorization'));
  assert.ok(result.report.redactedPaths.includes('$.user.password'));
  assert.ok(!JSON.stringify(result.report).includes('super-secret'));
});

test('string secret patterns redact Bearer, Basic and PEM private keys', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----';
  const redactor = createRedactor();
  const text = `Authorization: Bearer abc.def.ghi; Basic dXNlcjpwYXNz; ${pem}`;
  const output = redactor.redactString(text);
  assert.ok(!output.includes('abc.def.ghi'));
  assert.ok(!output.includes('dXNlcjpwYXNz'));
  assert.ok(!output.includes('BEGIN PRIVATE KEY'));
  assert.equal((output.match(/\[REDACTED\]/g) ?? []).length, 3);
});

test('custom key and string rules are deterministic', () => {
  const redactor = createRedactor({
    sensitiveKeys: ['internalId'],
    keyPatterns: [/^x-secret-/i],
    stringRules: [
      { pattern: /SECRET-[0-9]+/g, replacement: '<HIDDEN>' },
      /\bPIN\s+\d{4}\b/g,
    ],
  });
  const source = { internalId: '42', 'X-Secret-Token': 'value', note: 'SECRET-123 PIN 4321' };
  const output = redactor.redact(source);
  assert.deepEqual(output, { internalId: DEFAULT_REPLACEMENT, 'X-Secret-Token': DEFAULT_REPLACEMENT, note: '<HIDDEN> [REDACTED]' });
});

test('custom matcher receives safe path metadata', () => {
  const paths = [];
  const redactor = createRedactor({ keyMatcher: (key, path) => { paths.push(path); return key === 'sensitive'; } });
  const output = redactor.redact({ nested: { sensitive: 'secret' } });
  assert.equal(output.nested.sensitive, DEFAULT_REPLACEMENT);
  assert.ok(paths.includes('$.nested.sensitive'));
  assert.ok(paths.every(path => !path.includes('secret')));
});

test('cycles fail closed before recursive leakage', () => {
  const source = { safe: 'ok' };
  source.self = source;
  const redactor = createRedactor();
  assert.throws(() => redactor.redact(source), error => error instanceof RedactionError && error.code === 'CIRCULAR_REFERENCE');
});

test('unsupported objects and values fail deterministically', () => {
  const redactor = createRedactor();
  assert.throws(() => redactor.redact(new Date()), error => error.code === 'UNSUPPORTED_OBJECT');
  assert.throws(() => redactor.redact(undefined), error => error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => redactor.redact(NaN), error => error.code === 'UNSUPPORTED_VALUE');
  assert.throws(() => redactor.redact(Symbol('secret')), error => error.code === 'UNSUPPORTED_VALUE');
});

test('depth, node, string and output limits are enforced', () => {
  assert.throws(() => createRedactor({ maxDepth: 0 }), error => error.code === 'INVALID_LIMIT');
  assert.throws(() => createRedactor({ maxNodes: 0 }), error => error.code === 'INVALID_LIMIT');
  assert.throws(() => createRedactor({ maxStringBytes: 4 }).redact('12345'), error => error.code === 'STRING_TOO_LARGE');
  assert.throws(() => createRedactor({ maxOutputBytes: 8, replacement: 'x' }).redact({ long: '123456789' }), error => error.code === 'OUTPUT_TOO_LARGE');
  assert.throws(() => createRedactor({ maxDepth: 1 }).redact({ nested: { value: 'x' } }), error => error.code === 'MAX_DEPTH_EXCEEDED');
  assert.throws(() => createRedactor({ maxNodes: 2 }).redact({ a: 1, b: 2 }), error => error.code === 'NODE_LIMIT');
});

test('redacted output and report are deeply immutable', () => {
  const result = createRedactor().redactWithReport({ password: 'secret', child: { token: 'abc' } });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.child), true);
  assert.equal(Object.isFrozen(result.report), true);
  assert.equal(Object.isFrozen(result.report.redactedPaths), true);
  assert.throws(() => { result.value.password = 'leak'; }, TypeError);
});

test('report ordering is deterministic', () => {
  const result = createRedactor().redactWithReport({ z: { password: 'a' }, a: { token: 'b' } });
  assert.deepEqual(result.report.redactedPaths, ['$.a.token', '$.z.password']);
});

test('replacement is validated and configuration is immutable', () => {
  assert.equal(DEFAULT_MAX_DEPTH, 20);
  assert.equal(DEFAULT_MAX_NODES, 10_000);
  assert.equal(DEFAULT_MAX_STRING_BYTES, 1_048_576);
  assert.equal(DEFAULT_MAX_OUTPUT_BYTES, 4 * 1_048_576);
  assert.equal(DEFAULT_REPLACEMENT, '[REDACTED]');
  const redactor = createRedactor({ replacement: '<secret>' });
  assert.equal(Object.isFrozen(redactor.config), true);
  assert.equal(redactor.redact({ password: 'x' }).password, '<secret>');
  assert.throws(() => createRedactor({ replacement: '' }), error => error.code === 'INVALID_REPLACEMENT');
});
