import test from 'node:test';
import assert from 'node:assert/strict';
import { schema, validators, ValidationError } from '../src/index.js';

test('primitive types and bounds validate deterministically', () => {
  const s = schema({ type: 'string', minLength: 3, maxLength: 5 });
  assert.equal(s.safeParse('abcd').success, true);
  assert.equal(s.safeParse('a').issues[0].code, 'MIN_LENGTH');
});

test('object shapes validate nested required fields', () => {
  const s = validators.object({ id: { type: 'integer', required: true }, name: { type: 'string' } });
  const result = s.safeParse({ name: 'A' });
  assert.equal(result.success, false);
  assert.equal(result.issues[0].path, '$.id');
});

test('arrays validate item schemas and length bounds', () => {
  const s = validators.array({ type: 'integer', min: 0 }, { minItems: 1, maxItems: 2 });
  assert.equal(s.safeParse([1, 2]).success, true);
  assert.equal(s.safeParse([1, -2]).issues[0].path, '$[1]');
});

test('enum and literal constraints are deterministic', () => {
  const s = schema({ type: 'string', enum: ['a', 'b'] });
  assert.equal(s.safeParse('c').issues[0].code, 'ENUM');
  assert.equal(validators.literal(42).parse(42), 42);
});

test('unknown-key policy supports error, strip and preserve', () => {
  const error = validators.object({ id: { type: 'integer' } }, { unknownKeys: 'error' });
  assert.equal(error.safeParse({ id: 1, extra: true }).issues[0].code, 'UNKNOWN_KEY');
  const strip = validators.object({ id: { type: 'integer' } }, { unknownKeys: 'strip' });
  assert.deepEqual(strip.parse({ id: 1, extra: true }), { id: 1 });
});

test('coercion is opt-in only', () => {
  const s = schema({ type: 'integer' });
  assert.equal(s.safeParse('42').success, false);
  assert.equal(s.parse('42', { coerce: true }), 42);
});

test('custom validators return structured deterministic issues', () => {
  const s = schema({ type: 'string', validate: value => value.startsWith('A') || 'must start with A' });
  const result = s.safeParse('Bob');
  assert.equal(result.issues[0].code, 'CUSTOM');
  assert.equal(result.issues[0].message, 'must start with A');
});

test('parse throws typed ValidationError', () => {
  assert.throws(() => validators.integer({ min: 1 }).parse(0), error => error instanceof ValidationError && error.code === 'VALIDATION_FAILED');
});

test('schema definitions are immutable and reusable', () => {
  const s = schema({ type: 'object', shape: { id: { type: 'integer' } } });
  assert.equal(Object.isFrozen(s.definition), true);
  assert.equal(s.safeParse({ id: 1 }).success, true);
  assert.equal(s.safeParse({ id: 2 }).success, true);
});


test('invalid schema definitions fail early', () => {
  assert.throws(() => schema({ type: 'does-not-exist' }), TypeError);
});
