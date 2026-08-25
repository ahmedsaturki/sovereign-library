import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileGlob,
  evaluateRules,
  matchGlob,
  normalizeCandidatePath,
  parsePattern,
  serializePattern,
  GlobPathMatcherError,
} from '../src/index.js';

const expectCode = (fn, code) => assert.throws(fn, (error) => error instanceof GlobPathMatcherError && error.code === code);

test('matches literals, stars, questions, and recursive double stars', () => {
  assert.equal(matchGlob(compileGlob('src/app.js'), 'src/app.js'), true);
  assert.equal(matchGlob(compileGlob('src/*.js'), 'src/app.js'), true);
  assert.equal(matchGlob(compileGlob('src/*.js'), 'src/lib/app.js'), false);
  assert.equal(matchGlob(compileGlob('src/?.js'), 'src/a.js'), true);
  assert.equal(matchGlob(compileGlob('src/?.js'), 'src/ab.js'), false);
  assert.equal(matchGlob(compileGlob('src/**/test.js'), 'src/test.js'), true);
  assert.equal(matchGlob(compileGlob('src/**/test.js'), 'src/a/b/test.js'), true);
});

test('keeps recursive semantics segment-bound and rejects embedded double stars as special syntax', () => {
  assert.equal(matchGlob(compileGlob('src/a**b.js'), 'src/axxby.js'), false);
  assert.equal(matchGlob(compileGlob('src/**/a**b.js'), 'src/x/a**b.js'), true);
});

test('supports explicit escaping and rejects incomplete escapes', () => {
  assert.equal(matchGlob(compileGlob('literal/\\*.txt'), 'literal/*.txt'), true);
  assert.equal(matchGlob(compileGlob('literal/\\?.txt'), 'literal/?.txt'), true);
  assert.equal(matchGlob(compileGlob('literal/\\\\.txt', { separatorNormalization: false }), 'literal/\\.txt', { separatorNormalization: false }), true);
  expectCode(() => compileGlob('literal/abc\\'), 'INVALID_ESCAPE');
});

test('normalizes separators deterministically without touching the filesystem', () => {
  const matcher = compileGlob('src/tools/*.js');
  assert.equal(matchGlob(matcher, 'src\\tools\\index.js'), true);
  assert.equal(normalizeCandidatePath('src\\tools\\index.js'), 'src/tools/index.js');
  expectCode(() => normalizeCandidatePath('src//tools/index.js'), 'INVALID_PATH');
});

test('keeps absolute and relative paths distinct by default and anchors absolute roots', () => {
  assert.equal(matchGlob(compileGlob('/src/*.js'), '/src/app.js'), true);
  assert.equal(matchGlob(compileGlob('/src/*.js'), 'src/app.js'), false);
  assert.equal(matchGlob(compileGlob('src/*.js'), '/src/app.js'), false);
  assert.equal(matchGlob(compileGlob('C:/src/*.js'), 'C:/src/app.js'), true);
  assert.equal(matchGlob(compileGlob('C:/src/*.js'), 'D:/src/app.js'), false);
});

test('case behavior is explicit and does not depend on host OS defaults', () => {
  assert.equal(matchGlob(compileGlob('Src/*.JS'), 'src/App.js'), false);
  assert.equal(matchGlob(compileGlob('Src/*.JS', { caseMode: 'insensitive' }), 'src/App.js'), true);
});

test('dotfile policy is explicit', () => {
  const matcher = compileGlob('**/*');
  assert.equal(matchGlob(matcher, '.env'), true);
  assert.equal(matchGlob(matcher, '.env', { dotfiles: 'exclude' }), false);
});

test('dot segments and traversal are deterministic', () => {
  assert.equal(normalizeCandidatePath('a/./b', { normalizeDotSegments: true }), 'a/b');
  assert.equal(normalizeCandidatePath('a/b/../c', { normalizeDotSegments: true }), 'a/c');
  expectCode(() => normalizeCandidatePath('/a/../../c', { normalizeDotSegments: true }), 'TRAVERSAL_ESCAPE');
  expectCode(() => normalizeCandidatePath('../c', { normalizeDotSegments: true }), 'TRAVERSAL_ESCAPE');
});

test('rule evaluation is deterministic and defaults to last-match-wins', () => {
  const rules = [
    { pattern: '**/*.js', action: 'include' },
    { pattern: 'test/**', action: 'exclude' },
  ];
  assert.deepEqual(evaluateRules(rules, 'src/app.js'), { matched: true, action: 'include', ruleIndex: 0 });
  assert.deepEqual(evaluateRules(rules, 'test/app.js'), { matched: true, action: 'exclude', ruleIndex: 1 });
  assert.deepEqual(evaluateRules(rules, 'README.md', { defaultAction: 'exclude' }), { matched: false, action: 'exclude', ruleIndex: null });
});

test('first-match-wins is explicit', () => {
  const rules = [
    { pattern: '**', action: 'include' },
    { pattern: 'secret/**', action: 'exclude' },
  ];
  assert.deepEqual(evaluateRules(rules, 'secret/key.txt', { firstMatchWins: true }), { matched: true, action: 'include', ruleIndex: 0 });
});

test('compiled matchers are immutable and serialization is deterministic/integrity protected', () => {
  const matcher = compileGlob('src/**/test?.js', { caseMode: 'insensitive' });
  assert.equal(Object.isFrozen(matcher), true);
  assert.equal(Object.isFrozen(matcher.segments), true);
  const one = serializePattern(matcher);
  const two = serializePattern(compileGlob('src/**/test?.js', { caseMode: 'insensitive' }));
  assert.equal(one, two);
  assert.deepEqual(parsePattern(one), matcher);
  const tampered = JSON.parse(one);
  tampered.payload = tampered.payload.replace('src/', 'lib/');
  expectCode(() => parsePattern(JSON.stringify(tampered)), 'INTEGRITY_MISMATCH');
});

test('rejects malformed matcher payloads and recovers for later valid work', () => {
  expectCode(() => parsePattern('{bad'), 'MALFORMED_SERIALIZATION');
  expectCode(() => parsePattern(JSON.stringify({ format: 'GPM1', checksum: '0'.repeat(64), payload: '{"format":"GPM1","version":99}' })), 'INTEGRITY_MISMATCH');
  const valid = compileGlob('a/**/b');
  assert.equal(matchGlob(valid, 'a/b'), true);
});

test('rejects circular/accessor inputs without poisoning later operations', () => {
  const options = {}; options.self = options;
  expectCode(() => compileGlob('a/*', options), 'CIRCULAR_INPUT');
  const accessor = {};
  Object.defineProperty(accessor, 'caseMode', { get() { throw new Error('must not execute getter'); }, enumerable: true });
  expectCode(() => compileGlob('a/*', accessor), 'ACCESSOR_INPUT');
  assert.equal(matchGlob(compileGlob('a/*'), 'a/b'), true);
});

test('enforces pattern/path/rule/segment limits', () => {
  expectCode(() => compileGlob('*'.repeat(4097)), 'LIMIT_EXCEEDED');
  expectCode(() => normalizeCandidatePath('a'.repeat(32769)), 'LIMIT_EXCEEDED');
  expectCode(() => normalizeCandidatePath(Array.from({ length: 1025 }, () => 'a').join('/')), 'LIMIT_EXCEEDED');
  expectCode(() => evaluateRules(Array.from({ length: 4097 }, () => ({ pattern: '*', action: 'include' })), 'x'), 'LIMIT_EXCEEDED');
});
